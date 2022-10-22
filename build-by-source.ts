import {
  CSS,
  groupBy,
  jsonfeedToAtom,
  mustache,
  path,
  render,
} from "./deps.ts";
import {
  BuildOptions,
  BuiltMarkdownInfo,
  DayInfo,
  Feed,
  FeedInfo,
  FeedItem,
  FileInfo,
  Item,
  Nav,
  RunOptions,
  WeekOfYear,
} from "./interface.ts";
import {
  CONTENT_DIR,
  FEED_NAV,
  HOME_NAV,
  INDEX_HTML_PATH,
  INDEX_MARKDOWN_PATH,
  SUBSCRIBE_NAV,
  SUBSCRIPTION_URL,
} from "./constant.ts";
import {
  formatHumanTime,
  formatNumber,
  getBaseFeed,
  getDistRepoContentPath,
  getDomain,
  getPublicPath,
  getRepoHTMLURL,
  nav1ToHtml,
  nav1ToMarkdown,
  nav2ToHtml,
  nav2ToMarkdown,
  parseDayInfo,
  parseWeekInfo,
  pathnameToFeedUrl,
  pathnameToFilePath,
  pathnameToOverviewFilePath,
  pathnameToWeekFilePath,
  readTextFile,
  slugy,
  startDateOfWeek,
  writeJSONFile,
  writeTextFile,
} from "./util.ts";
import log from "./log.ts";
import { getFile, getHtmlFile, getItems } from "./db.ts";
import renderMarkdown from "./render-markdown.ts";
let htmlIndexTemplateContent = "";
export default async function main(
  fileInfo: FileInfo,
  runOptions: RunOptions,
  buildOptions: BuildOptions,
): Promise<BuiltMarkdownInfo> {
  const config = runOptions.config;
  const siteConfig = config.site;
  const dbMeta = buildOptions.dbMeta;
  const dbSources = dbMeta.sources;
  const sourceConfig = fileInfo.sourceConfig;
  const sourceCategory = sourceConfig.category;
  const sourceMeta = fileInfo.sourceMeta;
  const filepath = fileInfo.filepath;
  const fileConfig = sourceConfig.files[filepath];
  const repoMeta = sourceMeta.meta;
  const sourceIdentifier = sourceConfig.identifier;
  const dbSource = dbSources[sourceIdentifier];
  const originalFilepath = fileConfig.filepath;
  const commitMessage = `Update ${sourceIdentifier}/${originalFilepath}`;
  const sourceFileConfig = fileConfig;
  // get items

  const items = await getItems(sourceIdentifier, originalFilepath);
  // const getDbFinishTime = Date.now();
  // log.debug(`get db items cost ${getDbFinishTime - startTime}ms`);
  const dbFileMeta = dbSource.files[originalFilepath];
  const domain = getDomain();
  const isBuildMarkdown = runOptions.markdown;
  const isBuildHtml = runOptions.html;
  if (!isBuildMarkdown && !isBuildHtml) {
    return {
      commitMessage,
    };
  }
  if (!htmlIndexTemplateContent) {
    htmlIndexTemplateContent = await readTextFile("./templates/index.html.mu");
  }
  let relativeFolder = sourceIdentifier;
  if (!sourceFileConfig.index) {
    // to README.md path
    const filepathExtname = path.extname(originalFilepath);
    const originalFilepathWithoutExt = originalFilepath.slice(
      0,
      -filepathExtname.length,
    );
    relativeFolder = path.join(relativeFolder, originalFilepathWithoutExt);
  }
  const baseFeed = getBaseFeed();
  for (let i = 0; i < 2; i++) {
    const buildMarkdownStartTime = Date.now();
    const isDay = i === 0;
    const nav1: Nav[] = [
      {
        name: HOME_NAV,
        markdown_url: "/" + INDEX_MARKDOWN_PATH,
        url: "/",
      },
      {
        name: FEED_NAV,
        url: pathnameToFeedUrl(fileConfig.pathname, isDay),
      },
      {
        name: SUBSCRIBE_NAV,
        url: SUBSCRIPTION_URL,
      },
      {
        name: `🔗 ${sourceIdentifier}`,
        url: getRepoHTMLURL(
          repoMeta.url,
          repoMeta.default_branch,
          originalFilepath,
        ),
      },
      {
        name: `⭐ ${formatNumber(repoMeta.stargazers_count)}`,
      },
      {
        name: `🏷️ ${sourceCategory}`,
      },
    ];

    const nav2: Nav[] = [
      {
        name: "Daily",
        markdown_url: pathnameToFilePath(fileConfig.pathname),
        url: fileConfig.pathname,
        active: i === 0,
      },
      {
        name: "Weekly",

        markdown_url: pathnameToWeekFilePath(fileConfig.pathname),
        url: fileConfig.pathname + "week/",
        active: i === 1,
      },
      {
        name: "Overview",
        markdown_url: pathnameToOverviewFilePath(fileConfig.pathname),
        url: fileConfig.pathname + "readme/",
        active: i === 2,
      },
    ];

    const feedTitle = `Track ${fileConfig.name} Updates ${
      isDay ? "Daily" : "Weekly"
    }`;
    const feedDescription = repoMeta.description;
    const groups = groupBy(
      items,
      isDay ? "updated_day" : "updated_week",
    ) as Record<
      string,
      Item[]
    >;
    const groupKeys = Object.keys(groups);
    // sort
    groupKeys.sort((a: string, b: string) => {
      if (isDay) {
        return parseDayInfo(Number(b)).date.getTime() -
          parseDayInfo(Number(a)).date.getTime();
      } else {
        return parseWeekInfo(Number(b)).date.getTime() -
          parseWeekInfo(Number(a)).date.getTime();
      }
    });

    const dailyRelativeFolder = isDay
      ? relativeFolder
      : path.join(relativeFolder, `week`);

    let feedItems: FeedItem[] = groupKeys.map((key) => {
      const groupItems = groups[key];
      const categoryGroup = groupBy(groupItems, "category") as Record<
        string,
        Item[]
      >;
      let groupMarkdown = "";
      let groupHtml = "";
      const categoryKeys: string[] = Object.keys(categoryGroup);
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      let datePublished: Date = tomorrow;
      let dateModified: Date = new Date(0);
      categoryKeys.forEach((key: string) => {
        const categoryItem = categoryGroup[key][0];
        if (key) {
          groupMarkdown += `\n\n### ${key}\n`;
          groupHtml += `<h3>${categoryItem.category_html}</h3>`;
        }
        categoryGroup[key].forEach((item) => {
          groupMarkdown += `\n${item.markdown}`;
          groupHtml += `\n${item.html}`;
          const itemUpdatedAt = new Date(item.updated_at);
          if (itemUpdatedAt.getTime() > dateModified.getTime()) {
            dateModified = itemUpdatedAt;
          }
          if (itemUpdatedAt.getTime() < datePublished.getTime()) {
            datePublished = itemUpdatedAt;
          }
        });
      });
      let dayInfo: DayInfo | WeekOfYear;
      if (isDay) {
        dayInfo = parseDayInfo(Number(key));
      } else {
        dayInfo = parseWeekInfo(Number(key));
      }
      const slug = dayInfo.path + "/";
      const itemUrl = `${domain}/${dayInfo.path}/#${slugy(fileConfig.name)}`;
      const url = `${domain}/${slug}`;
      const feedItem: FeedItem = {
        id: itemUrl,
        title: `${fileConfig.name} Updates on ${dayInfo.name}`,
        _short_title: dayInfo.name,
        _slug: slug,
        _filepath: pathnameToFilePath("/" + slug),
        url: itemUrl,
        external_url: url,
        _external_slug: slug,
        date_published: datePublished.toISOString(),
        date_modified: dateModified.toISOString(),
        content_text: groupMarkdown,
        content_html: groupHtml,
      };
      return feedItem;
    });

    // sort feedItems by date published
    feedItems.sort((a, b) => {
      const aDate = new Date(a.date_published);
      const bDate = new Date(b.date_published);
      return bDate.getTime() - aDate.getTime();
    });

    const feedSeoTitle =
      `Track ${fileConfig.name} (${sourceIdentifier}) Updates ${
        isDay ? "Daily" : "Weekly"
      }`;
    const feedInfo: FeedInfo = {
      ...baseFeed,
      title: feedTitle,
      _seo_title: `${feedSeoTitle} - ${siteConfig.title}`,
      description: repoMeta.description || "",
      home_page_url: `${domain}/${dailyRelativeFolder}/`,
      feed_url: `${domain}/${dailyRelativeFolder}/feed.json`,
    };
    const feed: Feed = {
      ...feedInfo,
      items: feedItems,
    };
    const markdownDoc = `# ${feed.title}${
      feed.description ? `\n\n${feed.description}` : ""
    }

${nav1ToMarkdown(nav1)}

${nav2ToMarkdown(nav2)}

${
      feedItems.map((item) => {
        return `\n\n## [${item._short_title}](/${CONTENT_DIR}/${item._external_slug}${INDEX_MARKDOWN_PATH})${item.content_text}`;
      }).join("")
    }`;
    if (isBuildMarkdown) {
      const markdownDistPath = path.join(
        getDistRepoContentPath(),
        dailyRelativeFolder,
        INDEX_MARKDOWN_PATH,
      );
      await writeTextFile(markdownDistPath, markdownDoc);
      const writeMarkdownTime = Date.now();
      log.debug(
        `build ${markdownDistPath} success, cost ${
          writeMarkdownTime - buildMarkdownStartTime
        }ms`,
      );
    }
    // build html
    if (isBuildHtml) {
      // add body, css to feed
      // const body = renderMarkdown(markdownDoc);

      const body = `<h1>${feed.title}</h1>
${feed.description ? "<p>" + feed.description + "</p>" : ""}
<p>${nav1ToHtml(nav1)}</p>
<p>${nav2ToHtml(nav2)}</p>
${
        feedItems.map((item) => {
          return `<h2><a href="${item.url}">${item._short_title}</a></h2>${item.content_html}`;
        }).join("")
      }`;
      const htmlDoc = mustache.render(htmlIndexTemplateContent, {
        ...feedInfo,
        body,
        CSS,
      });
      const htmlDistPath = path.join(
        getPublicPath(),
        dailyRelativeFolder,
        INDEX_HTML_PATH,
      );
      await writeTextFile(htmlDistPath, htmlDoc);
      log.debug(`build ${htmlDistPath} success`);

      // build feed json
      const feedJsonDistPath = path.join(
        getPublicPath(),
        dailyRelativeFolder,
        "feed.json",
      );
      // remote the current day feed, cause there is maybe some new items

      if (isDay) {
        // today start
        const today = new Date();
        const todayStart = new Date(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate(),
        );
        const todayStartTimestamp = todayStart.getTime();
        feedItems = feedItems.filter((item) => {
          const itemDate = new Date(item.date_published);
          return itemDate.getTime() < todayStartTimestamp;
        });
      } else {
        // week
        // get week start date
        const startWeekDate = startDateOfWeek(new Date());
        const startWeekDateTimestamp = startWeekDate.getTime();
        feedItems = feedItems.filter((item) => {
          const itemDate = new Date(item.date_published);
          return itemDate.getTime() < startWeekDateTimestamp;
        });
      }
      feed.items = feedItems;

      await writeJSONFile(feedJsonDistPath, feed);
      // build rss
      // @ts-ignore: node modules
      const feedOutput = jsonfeedToAtom(feed, {
        language: "en",
      });
      const rssDistPath = path.join(
        getPublicPath(),
        dailyRelativeFolder,
        "feed.xml",
      );
      await writeTextFile(rssDistPath, feedOutput);
    }
  }

  // build overview markdown
  // first get readme content

  const buildOverviewMarkdownStartTime = Date.now();
  const readmeContent = await getFile(sourceIdentifier, filepath);

  const overviewMarkdownPath = path.join(
    getDistRepoContentPath(),
    relativeFolder,
    "readme",
    INDEX_MARKDOWN_PATH,
  );
  const overviewTitle = `${fileConfig.name} Overview`;
  const nav1: Nav[] = [
    {
      name: HOME_NAV,
      markdown_url: "/" + INDEX_MARKDOWN_PATH,
      url: "/",
    },
    {
      name: FEED_NAV,
      url: pathnameToFeedUrl(fileConfig.pathname, true),
    },
    {
      name: SUBSCRIBE_NAV,
      url: SUBSCRIPTION_URL,
    },
    {
      name: `😺 ${sourceIdentifier}`,
      url: getRepoHTMLURL(
        repoMeta.url,
        repoMeta.default_branch,
        originalFilepath,
      ),
    },
    {
      name: `⭐ ${formatNumber(repoMeta.stargazers_count)}`,
    },
    {
      name: `🏷️ ${sourceCategory}`,
    },
  ];

  const nav2: Nav[] = [
    {
      name: "Daily",
      markdown_url: pathnameToFilePath(fileConfig.pathname),
      url: fileConfig.pathname,
    },
    {
      name: "Weekly",

      markdown_url: pathnameToWeekFilePath(fileConfig.pathname),
      url: fileConfig.pathname + "week/",
    },
    {
      name: "Overview",
      markdown_url: pathnameToOverviewFilePath(fileConfig.pathname),
      url: fileConfig.pathname + "readme/",
      active: true,
    },
  ];

  const readmeRendered = `# ${overviewTitle}

${repoMeta.description}

${nav1ToMarkdown(nav1)}

${nav2ToMarkdown(nav2)}

---

${readmeContent}
`;
  await writeTextFile(overviewMarkdownPath, readmeRendered);
  const buildOverviewMarkdownEndTime = Date.now();
  log.debug(
    `build ${overviewMarkdownPath} success, cost ${
      buildOverviewMarkdownEndTime - buildOverviewMarkdownStartTime
    }ms`,
  );
  if (isBuildHtml) {
    const readmeHtmlContent = await getHtmlFile(sourceIdentifier, filepath);
    // add body, css to feed
    // const body = renderMarkdown(readmeRendered);
    const body = `<h1>${overviewTitle}</h1>
<p>${repoMeta.description}</p>
<p>${nav1ToHtml(nav1)}</p>
<p>${nav2ToHtml(nav2)}</p>
${readmeHtmlContent}
`;
    const overviewSeoTitle =
      `${fileConfig.name} (${sourceIdentifier}) Overview`;
    const overviewFeedInfo: FeedInfo = {
      ...baseFeed,
      title: overviewTitle,
      _seo_title: `${overviewSeoTitle} - ${siteConfig.title}`,
      description: repoMeta.description,
      home_page_url: `${domain}/${relativeFolder}/readme/`,
      feed_url: `${domain}/${relativeFolder}/feed.json`,
    };
    const htmlDoc = mustache.render(htmlIndexTemplateContent, {
      ...overviewFeedInfo,
      body: body,
      CSS,
    });
    const htmlDistPath = path.join(
      getPublicPath(),
      relativeFolder,
      "readme",
      INDEX_HTML_PATH,
    );
    await writeTextFile(htmlDistPath, htmlDoc);
    log.debug(`build ${htmlDistPath} success`);
  }

  return {
    commitMessage,
  };
}

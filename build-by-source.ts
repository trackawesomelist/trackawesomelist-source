import {
  CSS,
  DB,
  groupBy,
  jsonfeedToAtom,
  mustache,
  path,
  titleCase,
} from "./deps.ts";
import {
  BuildOptions,
  BuiltMarkdownInfo,
  DayInfo,
  Feed,
  FeedItem,
  FileInfo,
  Item,
  ItemDetail,
  RunOptions,
  WeekOfYear,
} from "./interface.ts";
import {
  CONTENT_DIR,
  INDEX_HTML_PATH,
  INDEX_MARKDOWN_PATH,
} from "./constant.ts";
import {
  formatHumanTime,
  formatNumber,
  getBaseFeed,
  getDbMeta,
  getDistRepoContentPath,
  getDomain,
  getItemsDetails,
  getPublicPath,
  getRepoHTMLURL,
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
import { getFile, getItems } from "./db.ts";
import renderMarkdown from "./render-markdown.ts";
let htmlIndexTemplateContent = "";
export default async function main(
  db: DB,
  fileInfo: FileInfo,
  runOptions: RunOptions,
  buildOptions: BuildOptions,
): Promise<BuiltMarkdownInfo> {
  let startTime = Date.now();
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

  const items = getItems(db, sourceIdentifier, originalFilepath);
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
  for (let i = 0; i < 2; i++) {
    const buildMarkdownStartTime = Date.now();
    const baseFeed = getBaseFeed();
    const isDay = i === 0;
    let currentNavHeader = `[ Daily / [Weekly](${
      pathnameToWeekFilePath(fileConfig.pathname)
    }) / [Overview](${pathnameToOverviewFilePath(fileConfig.pathname)}) ]`;
    if (!isDay) {
      currentNavHeader = `[ [Daily](${
        pathnameToFilePath(fileConfig.pathname)
      }) / Weekly / [Overview](${
        pathnameToOverviewFilePath(fileConfig.pathname)
      }) ]`;
    }
    const nav = `[Home](/${INDEX_MARKDOWN_PATH}) · [Feed](${
      pathnameToFeedUrl(fileConfig.pathname, isDay)
    }) · [Repo](${
      getRepoHTMLURL(repoMeta.url, repoMeta.default_branch, originalFilepath)
    }) · ${sourceCategory} · ⭐ ${
      formatNumber(repoMeta.stargazers_count)
    } ·  📝 ${formatHumanTime(new Date(dbFileMeta.updated_at))} · ✅ ${
      formatHumanTime(new Date(dbFileMeta.checked_at))
    } 

${currentNavHeader}

`;
    const feedTitle = `Track ${titleCase(repoMeta.name)}  ${
      isDay ? "Daily" : "Weekly"
    }`;
    const feedDescription = repoMeta.description;
    const footer = ``;
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
      const categoryKeys: string[] = Object.keys(categoryGroup);
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      let datePublished: Date = tomorrow;
      let dateModified: Date = new Date(0);
      categoryKeys.forEach((key: string) => {
        groupMarkdown += `\n\n### ${key}`;
        categoryGroup[key].forEach((item) => {
          groupMarkdown += `\n${item.markdown}`;
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
        title: dayInfo.name,
        _slug: slug,
        _filepath: pathnameToFilePath("/" + slug),
        url: itemUrl,
        external_url: url,
        _external_slug: slug,
        date_published: datePublished.toISOString(),
        date_modified: dateModified.toISOString(),
        content_text: groupMarkdown,
        content_html: renderMarkdown(groupMarkdown),
      };
      return feedItem;
    });

    // sort feedItems by date published
    feedItems.sort((a, b) => {
      const aDate = new Date(a.date_published);
      const bDate = new Date(b.date_published);
      return bDate.getTime() - aDate.getTime();
    });

    const title = `Track ${repoMeta.name}  ${isDay ? "Daily" : "Weekly"}`;
    const feed: Feed = {
      ...baseFeed,
      title,
      _seo_title: `${title} - ${siteConfig.title}`,
      description: repoMeta.description,
      home_page_url: `${domain}/${dailyRelativeFolder}/`,
      feed_url: `${domain}/${dailyRelativeFolder}/feed.json`,
      items: feedItems,
      _nav_text: nav,
    };
    const markdownDoc = `# ${feed.title}

${feed.description}

${feed._nav_text}${
      feedItems.map((item) => {
        return `\n\n## [${item.title}](/${CONTENT_DIR}/${item._external_slug}${INDEX_MARKDOWN_PATH})${item.content_text}`;
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
      const body = renderMarkdown(markdownDoc);
      const htmlDoc = mustache.render(htmlIndexTemplateContent, {
        ...feed,
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
  const readmeContent = getFile(db, fileInfo);

  const currentNavHeader = `[ [Daily](${
    pathnameToFilePath(fileConfig.pathname)
  }) / [Weekly](${pathnameToWeekFilePath(fileConfig.pathname)}) / Overview ]`;

  const nav = `
[Home](/${INDEX_MARKDOWN_PATH}) · [Feed](${
    pathnameToFeedUrl(fileConfig.pathname, true)
  }) · [Repo](${
    getRepoHTMLURL(repoMeta.url, repoMeta.default_branch, filepath)
  }) · ⭐ ${formatNumber(repoMeta.stargazers_count)} ·  📝 ${
    formatHumanTime(new Date(dbFileMeta.updated_at))
  } · ✅ ${formatHumanTime(new Date(dbFileMeta.checked_at))} 

${currentNavHeader}

---
`;
  const overviewMarkdownPath = path.join(
    getDistRepoContentPath(),
    relativeFolder,
    "readme",
    INDEX_MARKDOWN_PATH,
  );
  const overviewHtmlPath = path.join(
    getPublicPath(),
    relativeFolder,
    "readme",
    INDEX_HTML_PATH,
  );
  const readmeRendered = `# ${repoMeta.name}

${repoMeta.description}

${nav}

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
    // add body, css to feed
    const body = renderMarkdown(readmeRendered);
    const htmlDoc = mustache.render(htmlIndexTemplateContent, {
      _seo_title: `${titleCase(repoMeta.name)}`,
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

import {
  CSS,
  fromMarkdown,
  gfm,
  gfmFromMarkdown,
  gfmToMarkdown,
  groupBy,
  mustache,
  titleCase,
  toMarkdown,
} from "./deps.ts";
import { DB, fs, path } from "./deps.ts";
import Github from "./adapters/github.ts";
import {
  BuiltMarkdownInfo,
  DayInfo,
  DbMetaSource,
  Feed,
  FeedItem,
  File,
  FileInfo,
  FileMeta,
  FileMetaWithSource,
  Item,
  ItemDetail,
  ItemsJson,
  RunOptions,
  Source,
  WeekOfYear,
} from "./interface.ts";
import {
  INDEX_HTML_PATH,
  INDEX_MARKDOWN_PATH,
  RECENTLY_UPDATED_COUNT,
} from "./constant.ts";
import {
  exists,
  formatHumanTime,
  formatNumber,
  getBaseFeed,
  getDataItemsPath,
  getDataRawPath,
  getDayNumber,
  getDbMeta,
  getDistRepoGitUrl,
  getDistRepoPath,
  getDomain,
  getItemsDetails,
  getPublicPath,
  getRepoHTMLURL,
  getUTCDay,
  getWeekNumber,
  isDev,
  isMock,
  parseDayInfo,
  parseItemsFilepath,
  parseWeekInfo,
  readJSONFile,
  readTextFile,
  sha1,
  walkFile,
  writeDbMeta,
  writeJSONFile,
  writeTextFile,
} from "./util.ts";
import log from "./log.ts";
import { getItems, getUpdatedFiles } from "./db.ts";
import formatMarkdownItem from "./format-markdown-item.ts";
import buildHtml from "./build-html.ts";
import renderMarkdown from "./render-markdown.ts";
let htmlIndexTemplateContent = "";
export default async function main(
  db: DB,
  fileInfo: FileInfo,
  runOptions: RunOptions,
): Promise<BuiltMarkdownInfo> {
  const config = runOptions.config;
  const siteConfig = config.site;
  const dbMeta = await getDbMeta();
  const dbSources = dbMeta.sources;
  const sourceConfig = fileInfo.sourceConfig;
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
  const dbFileMeta = dbSource.files[originalFilepath];
  const distRepoPath = getDistRepoPath();
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
    const baseFeed = getBaseFeed();
    const isDay = i === 0;
    let currentNavHeader =
      `[ Daily / [Weekly](/${sourceIdentifier}/week/${INDEX_MARKDOWN_PATH}) / [Overview](/${sourceIdentifier}/readme/${INDEX_MARKDOWN_PATH}) ]`;
    if (!isDay) {
      currentNavHeader =
        `[ [Daily](/${sourceIdentifier}/${INDEX_MARKDOWN_PATH}) / Weekly / [Overview](/${sourceIdentifier}/readme/${INDEX_MARKDOWN_PATH}) ]`;
    }
    const nav = `[Home](/${INDEX_MARKDOWN_PATH}) · [Feed](/${relativeFolder}/${
      isDay ? "" : "week/"
    }feed.json) · [Repo](${
      getRepoHTMLURL(repoMeta.url, repoMeta.default_branch, originalFilepath)
    }) · ⭐ ${formatNumber(repoMeta.stargazers_count)} ·  📝 ${
      formatHumanTime(new Date(dbFileMeta.updated_at))
    } · ✅ ${formatHumanTime(new Date(dbFileMeta.checked_at))} 

${currentNavHeader}
`;
    const feedTitle = `Track ${titleCase(repoMeta.name)}  ${
      isDay ? "Daily" : "Weekly"
    }`;
    const feedDescription = repoMeta.description;
    const footer = ``;
    const allItems: ItemDetail[] = getItemsDetails(items);
    const groups = groupBy(
      allItems,
      isDay ? "updated_day" : "updated_week",
    ) as Record<
      string,
      ItemDetail[]
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
    const feedItems: FeedItem[] = groupKeys.map((key) => {
      const items = groups[key];
      const categoryGroup = groupBy(items, "category") as Record<
        string,
        ItemDetail[]
      >;
      let groupMarkdown = "";
      const categoryKeys: string[] = Object.keys(categoryGroup);
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      let datePublished: Date = tomorrow;
      let dateModified: Date = new Date(0);
      categoryKeys.forEach((key: string) => {
        groupMarkdown += `### ${key}\n\n`;
        categoryGroup[key].forEach((item) => {
          groupMarkdown += `${item.markdown}\n`;
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
      const slug = isDay ? dayInfo.path : dayInfo.path + "/week";
      const url = `${domain}/${slug}`;
      const feedItem: FeedItem = {
        id: url,
        title: dayInfo.name,
        _title_suffix: "",
        url,
        _slug: slug,
        date_published: datePublished.toISOString(),
        date_modified: dateModified.toISOString(),
        content_text: groupMarkdown,
        content_html: renderMarkdown(groupMarkdown),
      };
      return feedItem;
    });

    const dailyRelativeFolder = isDay
      ? relativeFolder
      : path.join(relativeFolder, `week`);

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

${feed._nav_text}

${
      feedItems.map((item) => {
        return `## [${item.title}](/${item._slug}/${INDEX_MARKDOWN_PATH})

${item.content_text}
`;
      }).join("\n\n")
    }

`;
    if (isBuildMarkdown) {
      const markdownDistPath = path.join(
        getDistRepoPath(),
        dailyRelativeFolder,
        INDEX_MARKDOWN_PATH,
      );
      await writeTextFile(markdownDistPath, markdownDoc);
      log.debug(`build ${markdownDistPath} success`);
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
      await writeJSONFile(feedJsonDistPath, feed);
    }
  }

  // build overview markdown
  // first get readme content

  const api = new Github(sourceConfig);
  const readmeContent = await api.getConent(filepath);

  const currentNavHeader =
    `[ [Daily](/${relativeFolder}/${INDEX_MARKDOWN_PATH}) / [Weekly](/${relativeFolder}/week/${INDEX_MARKDOWN_PATH}) / Overview ]`;

  const nav = `
[Home](/${INDEX_MARKDOWN_PATH}) · [Feed](/${relativeFolder}/feed.json) · [Repo](${
    getRepoHTMLURL(repoMeta.url, repoMeta.default_branch, filepath)
  }) · ⭐ ${formatNumber(repoMeta.stargazers_count)} ·  📝 ${
    formatHumanTime(new Date(dbFileMeta.updated_at))
  } · ✅ ${formatHumanTime(new Date(dbFileMeta.checked_at))} 

${currentNavHeader}

---
`;
  const overviewMarkdownPath = path.join(
    getDistRepoPath(),
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
  const tree = fromMarkdown(readmeContent, "utf8", {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });

  // format link etc.
  const overviewMarkdownTree = await formatMarkdownItem(tree, fileInfo);
  const overviewMarkdownContent = toMarkdown(
    overviewMarkdownTree,
    {
      extensions: [gfmToMarkdown()],
    },
  );

  const readmeRendered = `# ${repoMeta.name}

${repoMeta.description}

${nav}

${overviewMarkdownContent}
`;
  await writeTextFile(overviewMarkdownPath, readmeRendered);
  log.debug(`build ${overviewMarkdownPath} success`);
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

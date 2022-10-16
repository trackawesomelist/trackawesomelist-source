import { CSS, groupBy, mustache } from "./deps.ts";
import { DB, fs, path } from "./deps.ts";
import {
  BuiltMarkdownInfo,
  Config,
  DbMetaSource,
  Feed,
  FeedItem,
  File,
  FileMeta,
  FileMetaWithSource,
  Item,
  ItemDetail,
  ItemsJson,
  RunOptions,
  Source,
} from "./interface.ts";
import {
  INDEX_HTML_PATH,
  INDEX_MARKDOWN_PATH,
  RECENTLY_UPDATED_COUNT,
} from "./constant.ts";
import {
  exists,
  getBaseFeed,
  getDataItemsPath,
  getDataRawPath,
  getDbMeta,
  getDistRepoContentPath,
  getDistRepoGitUrl,
  getDistRepoPath,
  getDomain,
  getItemsDetails,
  getPublicPath,
  getUTCDay,
  isDev,
  parseDayInfo,
  parseItemsFilepath,
  parseWeekInfo,
  pathnameToFilePath,
  readJSONFile,
  readTextFile,
  sha1,
  walkFile,
  writeDbMeta,
  writeJSONFile,
  writeTextFile,
} from "./util.ts";
import renderMarkdown from "./render-markdown.ts";
import log from "./log.ts";
import { getDayItems, getItems, getUpdatedFiles, getWeekItems } from "./db.ts";
let htmlIndexTemplateContent = "";
function groupByFile(item: Item) {
  return item.source_identifier + "/" + item.file;
}
export default async function main(
  db: DB,
  number: number,
  options: RunOptions,
): Promise<BuiltMarkdownInfo> {
  // test is day or week
  const domain = getDomain();
  const isDay = number.toString().length === 8;
  const isBuildMarkdown = options.markdown || false;
  const isBuildSite = options.html || false;

  if (!isBuildMarkdown && !isBuildSite) {
    log.info("skip build timeline markdown and html");
    return {
      commitMessage: "",
    };
  }

  const config = options.config;
  const sourcesConfig = config.sources;
  let title = "";
  let commitMessage = "";
  let items: Record<string, Item> = {};
  let distMarkdownRelativePath = "";
  const baseFeed = getBaseFeed();
  let feedTitle = "";
  let feedDescription = "";
  if (!htmlIndexTemplateContent) {
    htmlIndexTemplateContent = await readTextFile("./templates/index.html.mu");
  }
  if (isDay) {
    const dayInfo = parseDayInfo(number);
    commitMessage = `Update day ${dayInfo.path}`;
    title = dayInfo.name;
    distMarkdownRelativePath = dayInfo.path;
    // get items
    items = getDayItems(db, number);
  } else {
    const weekInfo = parseWeekInfo(number);
    commitMessage = `Update week ${weekInfo.path}`;
    title = weekInfo.name;
    distMarkdownRelativePath = weekInfo.path;
    // get items
    items = getWeekItems(db, number);
  }
  feedTitle = `${title}`;
  feedDescription = `Awesome list updated on ${title}`;

  const feedItems = itemsToFeedItems(items, config);
  const nav = `[Home](/) | [Week](/week/)

<!-- toc -->`;
  const feed: Feed = {
    ...baseFeed,
    title: feedTitle,
    description: feedDescription,
    _seo_title: feedTitle,
    feed_url: `${domain}/feed.json`,
    home_page_url: domain,
    _nav_text: nav,
    items: feedItems,
  };

  const markdownDoc = `# ${feed.title}

${feed.description}

${feed._nav_text}

${
    feedItems.map((item) => {
      return `## [${item.title}](/${item._slug}${INDEX_MARKDOWN_PATH})

${item.content_text}
`;
    }).join("\n\n")
  }

`;
  if (isBuildMarkdown) {
    // build daily markdown
    // sort
    const distRepoPath = getDistRepoContentPath();
    const dailyMarkdownPath = path.join(
      distRepoPath,
      distMarkdownRelativePath,
      INDEX_MARKDOWN_PATH,
    );

    await writeTextFile(dailyMarkdownPath, markdownDoc);
    // log.debug(`build ${dailyMarkdownPath} success`);
  }
  if (isBuildSite) {
    // add body, css to feed
    const body = renderMarkdown(markdownDoc);
    const htmlDoc = mustache.render(htmlIndexTemplateContent, {
      ...feed,
      body,
      CSS,
    });
    const htmlDistPath = path.join(
      getPublicPath(),
      distMarkdownRelativePath,
      INDEX_HTML_PATH,
    );
    await writeTextFile(htmlDistPath, htmlDoc);
    log.debug(`build ${htmlDistPath} success`);

    // build feed json
    const feedJsonDistPath = path.join(
      getPublicPath(),
      distMarkdownRelativePath,
      "feed.json",
    );
    await writeJSONFile(feedJsonDistPath, feed);
  }
  return {
    commitMessage,
  };
}

export function itemsToFeedItems(
  items: Record<string, Item>,
  config: Config,
): FeedItem[] {
  const allItems: Item[] = [];
  for (const itemSha1 of Object.keys(items)) {
    const item = items[itemSha1];
    allItems.push(item);
  }
  const domain = getDomain();
  const sourcesConfig = config.sources;
  const groups = groupBy(allItems, groupByFile) as Record<
    string,
    Item[]
  >;
  const groupKeys = Object.keys(groups);
  let feedItems: FeedItem[] = groupKeys.map((key) => {
    const items = groups[key];

    let groupMarkdown = "";
    const categoryGroup = groupBy(items, "category") as Record<
      string,
      Item[]
    >;

    const categoryKeys = Object.keys(categoryGroup);
    if (categoryKeys.length === 0) {
      throw new Error(`${key} has no categories`);
    }
    let firstItem: Item | undefined;

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    let datePublished: Date = tomorrow;
    let dateModified: Date = new Date(0);
    categoryKeys.forEach((key) => {
      groupMarkdown += `### ${key}\n\n`;
      categoryGroup[key].forEach((item) => {
        groupMarkdown += item.markdown + "\n";
        firstItem = item;
        const itemUpdated = new Date(item.updated_at);
        if (itemUpdated.getTime() < datePublished.getTime()) {
          datePublished = itemUpdated;
        }
        if (itemUpdated.getTime() > dateModified.getTime()) {
          dateModified = itemUpdated;
        }
      });
    });
    if (!firstItem) {
      throw new Error(`${key} has no firstItem`);
    }
    // get file path
    const sourceFileConfig =
      sourcesConfig[firstItem.source_identifier].files[firstItem.file];

    const slug = sourceFileConfig.pathname.slice(1);

    const itemUrl = `${domain}/${slug}`;
    const feedItem: FeedItem = {
      id: itemUrl,
      title: sourceFileConfig.name,
      _slug: slug,
      url: itemUrl,
      content_text: groupMarkdown,
      content_html: renderMarkdown(groupMarkdown),
      date_published: datePublished.toISOString(),
      date_modified: dateModified.toISOString(),
    };
    return feedItem;
  });
  // sort feedItems by date published
  feedItems = feedItems.sort((a, b) => {
    const aDate = new Date(a.date_published);
    const bDate = new Date(b.date_published);
    return bDate.getTime() - aDate.getTime();
  });
  return feedItems;
}
export function itemsToFeedItemsByDate(
  items: Record<string, Item>,
  config: Config,
  isDay: boolean,
): FeedItem[] {
  const allItems: ItemDetail[] = getItemsDetails(items);
  const domain = getDomain();
  const sourcesConfig = config.sources;
  const groups = groupBy(
    allItems,
    isDay ? "updated_day" : "updated_week",
  ) as Record<
    string,
    ItemDetail[]
  >;
  let groupKeys = Object.keys(groups);
  // sort
  groupKeys = groupKeys.sort((a: string, b: string) => {
    if (isDay) {
      return parseDayInfo(Number(b)).date.getTime() -
        parseDayInfo(Number(a)).date.getTime();
    } else {
      return parseWeekInfo(Number(b)).date.getTime() -
        parseWeekInfo(Number(a)).date.getTime();
    }
  });
  // removve the last one
  groupKeys = groupKeys.slice(0, groupKeys.length - 1);
  let feedItems: FeedItem[] = groupKeys.map((key) => {
    const items = groups[key];

    let groupMarkdown = "";
    const categoryGroup = groupBy(items, groupByFile) as Record<
      string,
      ItemDetail[]
    >;

    const categoryKeys = Object.keys(categoryGroup);
    if (categoryKeys.length === 0) {
      throw new Error(`${key} has no categories`);
    }
    let firstItem: Item | undefined;

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    let datePublished: Date = tomorrow;
    let dateModified: Date = new Date(0);
    categoryKeys.forEach((key) => {
      const firstSourceItem = categoryGroup[key][0];
      const sourceFileConfig = sourcesConfig[firstSourceItem.source_identifier]
        .files[firstSourceItem.file];
      groupMarkdown += `#### [${sourceFileConfig.name}](${
        pathnameToFilePath(sourceFileConfig.pathname)
      })\n\n`;
      // group by category
      const categoryItems = categoryGroup[key];
      const categoryGroupByCategory = groupBy(
        categoryItems,
        "category",
      );

      const categoryGroupByCategoryKeys = Object.keys(
        categoryGroupByCategory,
      );
      categoryGroupByCategoryKeys.forEach((categoryKey) => {
        const items = categoryGroupByCategory[categoryKey];
        groupMarkdown += `##### ${categoryKey}\n\n`;

        items.forEach((item: ItemDetail) => {
          groupMarkdown += item.markdown + "\n";
          firstItem = item;
          const itemUpdated = new Date(item.updated_at);
          if (itemUpdated.getTime() < datePublished.getTime()) {
            datePublished = itemUpdated;
          }
          if (itemUpdated.getTime() > dateModified.getTime()) {
            dateModified = itemUpdated;
          }
        });
        groupMarkdown += "\n\n";
      });
    });
    if (!firstItem) {
      throw new Error(`${key} has no firstItem`);
    }
    // get file path
    const sourceFileConfig =
      sourcesConfig[firstItem.source_identifier].files[firstItem.file];

    const dayInfo = isDay
      ? parseDayInfo(Number(key))
      : parseWeekInfo(Number(key));
    const slug = dayInfo.path + "/";
    const itemUrl = `${domain}/${slug}`;
    const feedItem: FeedItem = {
      id: itemUrl,
      title: dayInfo.name,
      _slug: slug,
      url: itemUrl,
      content_text: groupMarkdown,
      content_html: renderMarkdown(groupMarkdown),
      date_published: datePublished.toISOString(),
      date_modified: dateModified.toISOString(),
    };
    return feedItem;
  });
  // sort feedItems by date published
  feedItems = feedItems.sort((a, b) => {
    const aDate = new Date(a.date_published);
    const bDate = new Date(b.date_published);
    return bDate.getTime() - aDate.getTime();
  });
  return feedItems;
}

import { groupBy, mustache } from "./deps.ts";
import { DB, fs, path } from "./deps.ts";
import {
  BuiltMarkdownInfo,
  DbMetaSource,
  Feed,
  FeedItem,
  File,
  FileMeta,
  FileMetaWithSource,
  Item,
  ItemsJson,
  PageCategoryItem,
  PageData,
  PageItem,
  RunOptions,
  Source,
} from "./interface.ts";
import { INDEX_MARKDOWN_PATH, RECENTLY_UPDATED_COUNT } from "./constant.ts";
import {
  exists,
  getBaseFeed,
  getDataItemsPath,
  getDataRawPath,
  getDbMeta,
  getDistRepoGitUrl,
  getDistRepoPath,
  getUTCDay,
  isDev,
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
import { getDayItems, getItems, getUpdatedFiles, getWeekItems } from "./db.ts";
let dayTemplateContent = "";
function groupByFile(item: Item) {
  return item.source_identifier + "/" + item.file;
}
export default async function main(
  db: DB,
  number: number,
  options: RunOptions,
): Promise<BuiltMarkdownInfo> {
  // test is day or week
  const isDay = number.toString().length === 8;
  const isBuildSite = options.html || false;
  const config = options.config;
  const sourcesConfig = config.sources;
  let title = "";
  let commitMessage = "";
  let items: Record<string, Item> = {};
  let distMarkdownRelativePath = "";
  const baseFeed = getBaseFeed();
  let feedTitle = "";
  let feedDescription = "";
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
  const pageData: PageData = {
    groups: [],
    title,
    nav: `[Home](/${INDEX_MARKDOWN_PATH}) · [Feed](/)`,
  };
  const feedItems: FeedItem[] = [];
  const allItems: Item[] = [];
  for (const itemSha1 of Object.keys(items)) {
    const item = items[itemSha1];
    allItems.push(item);
  }

  const groups = groupBy(allItems, groupByFile) as Record<
    string,
    PageCategoryItem[]
  >;
  const groupKeys = Object.keys(groups);
  pageData.groups = groupKeys.map((key) => {
    const items = groups[key];

    const categoryGroup = groupBy(items, "category") as Record<
      string,
      PageItem[]
    >;

    const categoryKeys = Object.keys(categoryGroup);
    const categoryItems: PageCategoryItem[] = categoryKeys.map((key) => {
      return {
        category: key,
        items: categoryGroup[key],
      };
    });
    const item = categoryItems[0].items[0];
    // get file path
    const sourceFileConfig =
      sourcesConfig[item.source_identifier].files[item.file];

    return {
      group_name: item.source_identifier,
      group_suffix: "",
      group_url: sourceFileConfig.pathname + INDEX_MARKDOWN_PATH,
      items: categoryItems,
    };
  });

  // build daily markdown
  // sort
  const distRepoPath = getDistRepoPath();
  const dailyMarkdownPath = path.join(
    distRepoPath,
    distMarkdownRelativePath,
    INDEX_MARKDOWN_PATH,
  );
  if (!dayTemplateContent) {
    dayTemplateContent = await readTextFile("./templates/day.md.mu");
  }
  const itemMarkdownContentRendered = mustache.render(
    dayTemplateContent,
    pageData,
  );
  await writeTextFile(dailyMarkdownPath, itemMarkdownContentRendered);
  // log.debug(`build ${dailyMarkdownPath} success`);
  return {
    commitMessage,
  };
}

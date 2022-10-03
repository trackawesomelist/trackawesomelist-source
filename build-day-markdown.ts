import { groupBy, mustache } from "./deps.ts";
import { DB, fs, path } from "./deps.ts";
import {
  BuiltMarkdownInfo,
  DbMetaSource,
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
  getDataItemsPath,
  getDataRawPath,
  getDbMeta,
  getDistRepoGitUrl,
  getDistRepoPath,
  getUTCDay,
  isDev,
  parseDayInfo,
  parseItemsFilepath,
  readJSONFile,
  readTextFile,
  sha1,
  walkFile,
  writeDbMeta,
  writeJSONFile,
  writeTextFile,
} from "./util.ts";
import log from "./log.ts";
import { getDayItems, getItems, getUpdatedFiles } from "./db.ts";
let dayTemplateContent = "";
function groupByFile(item: Item) {
  return item.source_identifier + "/" + item.file;
}
export default async function main(
  db: DB,
  dayNumber: number,
): Promise<BuiltMarkdownInfo> {
  const dayInfo = parseDayInfo(dayNumber);
  const commitMessage = `Update day ${dayInfo.path}`;
  // get items
  const items = getDayItems(db, dayNumber);
  const pageData: PageData = {
    groups: [],
  };

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
    return {
      group_name: categoryItems[0].items[0].source_identifier,
      group_suffix: "",
      items: categoryItems,
    };
  });

  // build daily markdown
  // sort
  const distRepoPath = getDistRepoPath();
  const dailyMarkdownPath = path.join(
    distRepoPath,
    dayInfo.path,
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

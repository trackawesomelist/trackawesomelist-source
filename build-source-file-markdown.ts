import { groupBy, mustache } from "./deps.ts";
import { DB, fs, path } from "./deps.ts";
import parsers from "./parsers/mod.ts";
import {
  BuiltMarkdownInfo,
  DbMetaSource,
  File,
  FileMeta,
  FileMetaWithSource,
  Item,
  ItemDetail,
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
  getDayNumber,
  getDbMeta,
  getDistRepoGitUrl,
  getDistRepoPath,
  getItemsDetails,
  getUTCDay,
  getWeekNumber,
  isDev,
  isMock,
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
import { getItems, getUpdatedFiles } from "./db.ts";
let dayTemplateContent = "";
export default async function main(
  db: DB,
  file: File,
  sourceConfig: Source,
): Promise<BuiltMarkdownInfo> {
  const sourceIdentifier = file.source_identifier;
  const originalFilepath = file.file;
  const commitMessage = `Update ${sourceIdentifier}/${originalFilepath}`;
  const sourceFileConfig = sourceConfig.files[originalFilepath];
  // get items
  const items = getItems(db, sourceIdentifier, originalFilepath);
  const pageData: PageData = {
    groups: [],
  };

  const allItems: ItemDetail[] = getItemsDetails(items);
  const groups = groupBy(allItems, "updated_day") as Record<
    string,
    PageCategoryItem[]
  >;
  const groupKeys = Object.keys(groups);
  // sort
  groupKeys.sort((a: string, b: string) => {
    return parseDayInfo(Number(b)).date.getTime() -
      parseDayInfo(Number(a)).date.getTime();
  });
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
      group_name: parseDayInfo(Number(key)).name,
      group_suffix: "",
      items: categoryItems,
    };
  });

  let dailyMarkdownRelativePath = INDEX_MARKDOWN_PATH;
  if (!sourceFileConfig.index) {
    // to README.md path
    const originalFilepathWithoutExt = originalFilepath.slice(
      0,
      -path.extname(originalFilepath),
    );
    dailyMarkdownRelativePath = path.join(
      originalFilepathWithoutExt,
      INDEX_MARKDOWN_PATH,
    );
  }
  // build daily markdown
  // sort
  const distRepoPath = getDistRepoPath();
  const dailyMarkdownPath = path.join(
    distRepoPath,
    sourceIdentifier,
    dailyMarkdownRelativePath,
  );
  if (!dayTemplateContent) {
    dayTemplateContent = await readTextFile("./templates/file-by-day.md.mu");
  }
  const itemMarkdownContentRendered = mustache.render(
    dayTemplateContent,
    pageData,
  );
  await writeTextFile(dailyMarkdownPath, itemMarkdownContentRendered);
  log.info(`build ${dailyMarkdownPath} success`);
  return {
    commitMessage,
  };
}

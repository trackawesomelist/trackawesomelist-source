import {
  fromMarkdown,
  gfm,
  gfmFromMarkdown,
  gfmToMarkdown,
  toMarkdown,
} from "./deps.ts";
import {
  DayInfo,
  DBIndex,
  DBMeta,
  File,
  FileInfo,
  Item,
  WeekOfYear,
} from "./interface.ts";
import log from "./log.ts";
import formatMarkdownItem from "./format-markdown-item.ts";
import {
  getDayNumber,
  getDbContentPath,
  getDbItemsPath,
  getWeekNumber,
  parseDayInfo,
  parseWeekInfo,
  readJSONFile,
  readTextFile,
  writeJSONFile,
  writeTextFile,
} from "./util.ts";
export type StringOrNumber = string | number;
export function getFile(
  sourceIdentifier: string,
  filepath: string,
): Promise<string> {
  const fileDbPath = getDbContentPath(sourceIdentifier, filepath);
  return readTextFile(fileDbPath);
}
export async function updateFile(
  fileInfo: FileInfo,
  content: string,
) {
  const file = fileInfo.filepath;
  const sourceConfig = fileInfo.sourceConfig;
  const sourceIdentifier = sourceConfig.identifier;
  // check items length
  const tree = fromMarkdown(content, "utf8", {
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
  const dbContentPath = getDbContentPath(sourceIdentifier, file);
  await writeTextFile(dbContentPath, overviewMarkdownContent);
}
export async function updateItems(
  fileInfo: FileInfo,
  items: Record<string, Item>,
  dbIndex: DBIndex,
) {
  const file = fileInfo.filepath;
  const sourceConfig = fileInfo.sourceConfig;
  const sourceIdentifier = sourceConfig.identifier;
  const sourceCategory = sourceConfig.category;
  const itemKeys = Object.keys(items);
  if (itemKeys.length === 0) {
    return;
  }
  const dbItemsPath = getDbItemsPath(
    fileInfo.sourceConfig.identifier,
    fileInfo.filepath,
  );
  await writeJSONFile(dbItemsPath, items);

  // write to index
  // delete old index
  const keys = Object.keys(dbIndex);
  for (const key of keys) {
    if (key.startsWith(sourceIdentifier + ":")) {
      delete dbIndex[key];
    }
  }
  for (const itemKey of itemKeys) {
    const item = items[itemKey];
    dbIndex[`${sourceIdentifier}:${fileInfo.filepath}:${item.sha1}`] = {
      t: new Date(item.updated_at).getTime(),
      d: item.updated_day,
      w: item.updated_week,
    };
  }
}

export interface UpdatedItemsParam {
  since_date: Date;
  source_identifiers?: string[];
}
export interface ItemsResult {
  items: Record<string, Item>;
  since_id: number;
  has_next: boolean;
}
export function getItems(
  sourceIdentifier: string,
  file: string,
): Promise<Record<string, Item>> {
  const dbItemsPath = getDbItemsPath(sourceIdentifier, file);
  return readJSONFile(dbItemsPath) as Promise<Record<string, Item>>;
}
export async function getItemsByDays(
  days: number[],
  dbIndex: DBIndex,
  isDay: boolean,
): Promise<Record<string, Item>> {
  const keys = Object.keys(dbIndex);
  const items: Record<string, Item> = {};
  const indexKey = isDay ? "d" : "w";
  const todos: Record<string, string[]> = {};
  for (const key of keys) {
    const item = dbIndex[key];

    if (days.includes(item[indexKey])) {
      const arr = key.split(":");
      const sourceIdentifier = arr[0];
      const file = arr[1];
      const sha1 = arr[2];
      const dbItemsPath = getDbItemsPath(sourceIdentifier, file);
      if (!todos[dbItemsPath]) {
        todos[dbItemsPath] = [];
      }
      todos[dbItemsPath].push(sha1);
    }
  }
  const todoKeys = Object.keys(todos);
  const promises: Promise<void>[] = [];
  for (const todoKey of todoKeys) {
    promises.push(readJSONFile(todoKey));
  }
  let rIndex = 0;
  const results = await Promise.all(promises) as unknown as Record<
    string,
    Item
  >[];
  for (const result of results) {
    for (const sha1 of todos[todoKeys[rIndex]]) {
      if (!result[sha1]) {
        throw new Error(`sha1 ${sha1} not found in ${todoKeys[rIndex]}`);
      }
      items[sha1] = result[sha1];
    }
    rIndex++;
  }
  return items;
}
export async function getDayItems(
  dayNumber: number,
  dbIndex: DBIndex,
  isDay: boolean,
): Promise<Record<string, Item>> {
  const keys = Object.keys(dbIndex);
  const items: Record<string, Item> = {};
  const indexKey = isDay ? "d" : "w";

  const todos: Record<string, string[]> = {};
  for (const key of keys) {
    const item = dbIndex[key];
    if (item[indexKey] === dayNumber) {
      const arr = key.split(":");
      const sourceIdentifier = arr[0];
      const file = arr[1];
      const sha1 = arr[2];
      const dbItemsPath = getDbItemsPath(sourceIdentifier, file);
      if (!todos[dbItemsPath]) {
        todos[dbItemsPath] = [];
      }
      todos[dbItemsPath].push(sha1);
    }
  }

  const todoKeys = Object.keys(todos);
  const promises: Promise<void>[] = [];
  for (const todoKey of todoKeys) {
    promises.push(readJSONFile(todoKey));
  }
  let rIndex = 0;
  const results = await Promise.all(promises) as unknown as Record<
    string,
    Item
  >[];
  for (const result of results) {
    for (const sha1 of todos[todoKeys[rIndex]]) {
      if (!result[sha1]) {
        throw new Error(`sha1 ${sha1} not found in ${todoKeys[rIndex]}`);
      }
      items[sha1] = result[sha1];
    }
    rIndex++;
  }
  return items;
}
export function getUpdatedFiles(
  options: UpdatedItemsParam,
  dbIndex: DBIndex,
): File[] {
  const filesSet: Set<string> = new Set();
  const keys = Object.keys(dbIndex);
  console.log("options", options);
  for (const key of keys) {
    const item = dbIndex[key];
    const arr = key.split(":");
    const sourceIdentifier = arr[0];
    const file = arr[1];
    if (options.since_date) {
      if (item.t < options.since_date?.getTime()) {
        continue;
      }
    }
    if (options.source_identifiers && options.source_identifiers.length > 0) {
      if (!options.source_identifiers.includes(sourceIdentifier)) {
        continue;
      }
    }
    filesSet.add(`${sourceIdentifier}:${file}`);
  }
  const files: File[] = [];

  for (const file of filesSet) {
    const arr = file.split(":");
    const sourceIdentifier = arr[0];
    const filepath = arr[1];
    files.push({
      source_identifier: sourceIdentifier,
      file: filepath,
    });
  }

  return files;
}
export function getUpdatedDays(
  dbIndex: DBIndex,
  options: UpdatedItemsParam,
  isDay: boolean,
): (DayInfo | WeekOfYear)[] {
  const days: (DayInfo | WeekOfYear)[] = [];
  const daysSet: Set<number> = new Set();
  const keys = Object.keys(dbIndex);
  const indexKey = isDay ? "d" : "w";
  for (const key of keys) {
    const item = dbIndex[key];
    const arr = key.split(":");
    const sourceIdentifier = arr[0];
    const file = arr[1];
    const sha1 = arr[2];
    if (options.since_date) {
      if (item.t < options.since_date?.getTime()) {
        continue;
      }
    }
    if (options.source_identifiers && options.source_identifiers.length > 0) {
      if (!options.source_identifiers.includes(sourceIdentifier)) {
        continue;
      }
    }
    daysSet.add(item[indexKey]);
  }
  return Array.from(daysSet).sort((a, b) => b - a).map((day) => {
    if (isDay) {
      return parseDayInfo(day);
    } else {
      return parseWeekInfo(day);
    }
  });
}

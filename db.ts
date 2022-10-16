import { DB } from "./deps.ts";
import { DayInfo, File, FileInfo, Item, WeekOfYear } from "./interface.ts";
import log from "./log.ts";
import {
  getDayNumber,
  getWeekNumber,
  parseDayInfo,
  parseWeekInfo,
} from "./util.ts";
export type StringOrNumber = string | number;
export function updateItems(
  db: DB,
  fileInfo: FileInfo,
  items: Record<string, Item>,
) {
  const file = fileInfo.filepath;
  const sourceConfig = fileInfo.sourceConfig;
  const sourceIdentifier = sourceConfig.identifier;
  const sourceCategory = sourceConfig.category;
  const itemKeys = Object.keys(items);
  if (itemKeys.length === 0) {
    return;
  }
  // check items length
  // delete all old items then write new items;
  db.query(
    "delete from items where source_identifier = :source_identifier and file = :file",
    {
      source_identifier: sourceIdentifier,
      file: file,
    },
  );
  let insertQuery =
    "insert into items (source_identifier,source_category, file,category, markdown, updated_at, sha1, checked_at, updated_day, updated_week) values ";
  // tets write new items
  const insertValues: StringOrNumber[] = [];
  let index = 0;
  for (const itemKey of itemKeys) {
    const item = items[itemKey];
    insertQuery += "(?,?,?,?,?,?,?,?,?,?)";
    if (index < itemKeys.length - 1) {
      insertQuery += ",";
    }
    insertValues.push(sourceIdentifier);
    insertValues.push(sourceCategory);
    insertValues.push(file);
    insertValues.push(item.category);
    insertValues.push(item.markdown);
    insertValues.push(new Date(item.updated_at).getTime());
    insertValues.push(item.sha1);
    insertValues.push(new Date(item.checked_at).getTime());
    insertValues.push(getDayNumber(new Date(item.updated_at)));
    insertValues.push(getWeekNumber(new Date(item.updated_at)));
    index++;
  }
  db.query(insertQuery, insertValues);
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
  db: DB,
  sourceIdentifier: string,
  file: string,
): Record<string, Item> {
  const sql =
    "select markdown,category,updated_at,sha1,checked_at from items where source_identifier=:sourceIdentifier and file=:file";
  const items: Record<string, Item> = {};
  for (
    const [markdown, category, updated_at, sha1, checked_at] of db
      .query(sql, {
        sourceIdentifier: sourceIdentifier as string,
        file: file as string,
      })
  ) {
    items[sha1 as string] = {
      file: file,
      source_identifier: sourceIdentifier,
      markdown: markdown as string,
      category: category as string,
      updated_at: new Date(updated_at as number).toISOString(),
      sha1: sha1 as string,
      checked_at: new Date(checked_at as number).toISOString(),
    };
  }
  return items;
}
export function getLatestItemsByTime(
  db: DB,
  since_time: number,
): Record<string, Item> {
  const sql =
    "select markdown,category,updated_at,sha1,checked_at,source_identifier,file from items where updated_at>:since_time";
  const items: Record<string, Item> = {};
  for (
    const [
      markdown,
      category,
      updated_at,
      sha1,
      checked_at,
      sourceIdentifier,
      file,
    ] of db
      .query(sql, {
        since_time,
      })
  ) {
    items[sha1 as string] = {
      file: file as string,
      source_identifier: sourceIdentifier as string,
      markdown: markdown as string,
      category: category as string,
      updated_at: new Date(updated_at as number).toISOString(),
      sha1: sha1 as string,
      checked_at: new Date(checked_at as number).toISOString(),
    };
  }
  return items;
}
export function getItemsByWeeks(
  db: DB,
  weeks: number[],
): Record<string, Item> {
  const sql =
    `select markdown,category,updated_at,sha1,checked_at,source_identifier,file from items where updated_week in (${
      weeks.join(",")
    })`;
  const items: Record<string, Item> = {};
  const groups: Record<string, Item[]> = {};
  for (
    const [
      markdown,
      category,
      updated_at,
      sha1,
      checked_at,
      sourceIdentifier,
      file,
    ] of db
      .query(sql)
  ) {
    const updated_day = getWeekNumber(new Date(updated_at as number));
    if (!groups[updated_day]) {
      groups[updated_day] = [];
    }
    groups[updated_day].push({
      file: file as string,
      source_identifier: sourceIdentifier as string,
      markdown: markdown as string,
      category: category as string,
      updated_at: new Date(updated_at as number).toISOString(),
      sha1: sha1 as string,
      checked_at: new Date(checked_at as number).toISOString(),
    });
  }
  const finalItems: Record<string, Item> = {};
  for (const groupKey of Object.keys(groups)) {
    const group = groups[groupKey];
    for (const item of group) {
      finalItems[item.sha1] = item;
    }
  }
  return finalItems;
}
export function getItemsByDays(
  db: DB,
  days: number[],
): Record<string, Item> {
  const sql =
    `select markdown,category,updated_at,sha1,checked_at,source_identifier,file from items where updated_day in (${
      days.join(",")
    })`;
  const groups: Record<string, Item[]> = {};
  log.debug(`getLatestItemsByDay: ${sql}`);
  for (
    const [
      markdown,
      category,
      updated_at,
      sha1,
      checked_at,
      sourceIdentifier,
      file,
    ] of db
      .query(sql)
  ) {
    const updated_day = getDayNumber(new Date(updated_at as number));
    if (!groups[updated_day]) {
      groups[updated_day] = [];
    }
    groups[updated_day].push({
      file: file as string,
      source_identifier: sourceIdentifier as string,
      markdown: markdown as string,
      category: category as string,
      updated_at: new Date(updated_at as number).toISOString(),
      sha1: sha1 as string,
      checked_at: new Date(checked_at as number).toISOString(),
    });
  }
  // sort groups keys remove the last one
  const groupKeys = Object.keys(groups);
  groupKeys.sort().reverse();
  groupKeys.pop();
  const finalItems: Record<string, Item> = {};
  for (const groupKey of groupKeys) {
    const group = groups[groupKey];
    for (const item of group) {
      finalItems[item.sha1] = item;
    }
  }
  return finalItems;
}
export function getDayItems(
  db: DB,
  dayNumber: number,
): Record<string, Item> {
  const sql =
    "select markdown,category,updated_at,sha1,checked_at,source_identifier,file from items where updated_day=:dayNumber";
  const items: Record<string, Item> = {};
  for (
    const [
      markdown,
      category,
      updated_at,
      sha1,
      checked_at,
      sourceIdentifier,
      file,
    ] of db
      .query(sql, {
        dayNumber,
      })
  ) {
    items[sha1 as string] = {
      file: file as string,
      source_identifier: sourceIdentifier as string,
      markdown: markdown as string,
      category: category as string,
      updated_at: new Date(updated_at as number).toISOString(),
      sha1: sha1 as string,
      checked_at: new Date(checked_at as number).toISOString(),
    };
  }
  return items;
}
export function getWeekItems(
  db: DB,
  number: number,
): Record<string, Item> {
  const sql =
    "select markdown,category,updated_at,sha1,checked_at,source_identifier,file from items where updated_week=:number";
  const items: Record<string, Item> = {};
  for (
    const [
      markdown,
      category,
      updated_at,
      sha1,
      checked_at,
      sourceIdentifier,
      file,
    ] of db
      .query(sql, {
        number,
      })
  ) {
    items[sha1 as string] = {
      file: file as string,
      source_identifier: sourceIdentifier as string,
      markdown: markdown as string,
      category: category as string,
      updated_at: new Date(updated_at as number).toISOString(),
      sha1: sha1 as string,
      checked_at: new Date(checked_at as number).toISOString(),
    };
  }
  return items;
}

export function getUpdatedFiles(
  db: DB,
  options: UpdatedItemsParam,
): File[] {
  let sql = "select file,source_identifier from items where ";
  const params: Record<string, string | number> = {};
  if (options.since_date) {
    sql += "checked_at > :checked_at ";
    params.checked_at = options.since_date?.getTime();
  }
  if (options.source_identifiers && options.source_identifiers.length > 0) {
    if (options.since_date) {
      sql += "and ";
    }
    sql += `source_identifier in (${
      options.source_identifiers?.map((item) => `'${item}'`).join(",")
    }) `;
  }
  sql += "group by file,source_identifier";
  log.debug(`getUpdatedFiles sql: ${sql}`, params);
  const rows = db.query(
    sql,
    params,
  );

  const files: File[] = [];
  for (const [file, source_identifier] of rows) {
    files.push({
      file: file as string,
      source_identifier: source_identifier as string,
    });
  }
  return files;
}
export function getUpdatedDays(
  db: DB,
  options: UpdatedItemsParam,
): DayInfo[] {
  let sql = "select updated_day from items where ";
  const params: Record<string, string | number> = {};
  if (options.since_date) {
    sql += "checked_at > :checked_at ";
    params.checked_at = options.since_date?.getTime();
  }
  if (options.source_identifiers && options.source_identifiers.length > 0) {
    if (options.since_date) {
      sql += "and ";
    }
    sql += `source_identifier in (${
      options.source_identifiers?.map((item) => `'${item}'`).join(",")
    }) `;
  }
  sql += "group by updated_day";

  log.debug(`getUpdatedFiles sql: ${sql}`, params);

  const rows = db.query(
    sql,
    params,
  );

  const files: DayInfo[] = [];
  for (const [updated_day] of rows) {
    files.push(parseDayInfo(updated_day as number));
  }
  // sort by number
  files.sort((a, b) => {
    return b.number - a.number;
  });
  return files;
}

export function getUpdatedWeeks(
  db: DB,
  options: UpdatedItemsParam,
): WeekOfYear[] {
  let sql = "select updated_week from items where ";
  const params: Record<string, string | number> = {};
  if (options.since_date) {
    sql += "checked_at > :checked_at ";
    params.checked_at = options.since_date?.getTime();
  }
  if (options.source_identifiers && options.source_identifiers.length > 0) {
    if (options.since_date) {
      sql += "and ";
    }
    sql += `source_identifier in (${
      options.source_identifiers?.map((item) => `'${item}'`).join(",")
    }) `;
  }
  sql += "group by updated_week";
  log.debug(`getUpdatedFiles sql: ${sql}`, params);
  const rows = db.query(
    sql,
    params,
  );

  const files: WeekOfYear[] = [];
  for (const [updated_day] of rows) {
    files.push(parseWeekInfo(updated_day as number));
  }
  // sort by number
  files.sort((a, b) => {
    return b.number - a.number;
  });
  return files;
}

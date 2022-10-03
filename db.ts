import { DB } from "./deps.ts";
import { DayInfo, File, Item, WeekOfYear } from "./interface.ts";
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
  sourceIdentifier: string,
  file: string,
  items: Record<string, Item>,
) {
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
    "insert into items (source_identifier, file,category, markdown, updated_at, sha1, checked_at, updated_day, updated_week) values ";
  // tets write new items
  const insertValues: StringOrNumber[] = [];
  let index = 0;
  for (const itemKey of itemKeys) {
    const item = items[itemKey];
    insertQuery += "(?,?,?,?,?,?,?,?,?)";
    if (index < itemKeys.length - 1) {
      insertQuery += ",";
    }
    insertValues.push(sourceIdentifier);
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

export function getUpdatedFiles(
  db: DB,
  options: UpdatedItemsParam,
): File[] {
  let sql = "select file,source_identifier from items where ";
  if (options.since_date) {
    sql += "checked_at > :checked_at ";
  }
  sql += "group by file,source_identifier";
  log.debug(`getUpdatedFiles sql: ${sql}`);
  const rows = db.query(
    sql,
    {
      checked_at: options.since_date?.getTime(),
    },
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
  if (options.since_date) {
    sql += "checked_at > :checked_at ";
  }
  sql += "group by updated_day";
  log.debug(`getUpdatedFiles sql: ${sql}`);
  const rows = db.query(
    sql,
    {
      checked_at: options.since_date?.getTime(),
    },
  );

  const files: DayInfo[] = [];
  for (const [updated_day] of rows) {
    files.push(parseDayInfo(updated_day as number));
  }
  return files;
}

export function getUpdatedWeeks(
  db: DB,
  options: UpdatedItemsParam,
): WeekOfYear[] {
  let sql = "select updated_week from items where ";
  if (options.since_date) {
    sql += "checked_at > :checked_at ";
  }
  sql += "group by updated_week";
  log.debug(`getUpdatedFiles sql: ${sql}`);
  const rows = db.query(
    sql,
    {
      checked_at: options.since_date?.getTime(),
    },
  );

  const files: WeekOfYear[] = [];
  for (const [updated_day] of rows) {
    files.push(parseWeekInfo(updated_day as number));
  }
  return files;
}

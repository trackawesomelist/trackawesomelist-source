import {
  getDbIndexFilePath,
  getDbMetaFilePath,
  writeJSONFile,
} from "./util.ts";
import log from "./log.ts";
import dbInitMeta from "./db-meta-init.json" assert { type: "json" };
export default async function initDb() {
  const dbMetaFilePath = getDbMetaFilePath();
  const dbIndexFilePath = getDbIndexFilePath();
  if (!await Deno.stat(dbMetaFilePath).catch(() => false)) {
    log.info("db meta not found, auto init");
    // copy db-meta-init.json
    await writeJSONFile(dbMetaFilePath, dbInitMeta);
  }
  if (!await Deno.stat(dbIndexFilePath).catch(() => false)) {
    log.info("db index not found, auto init");
    // copy db-meta-init.json
    await writeJSONFile(dbIndexFilePath, {});
  }
}

if (import.meta.main) {
  initDb();
}

import { Command, DB, flags } from "./deps.ts";
import log from "./log.ts";
import fetchSources from "./fetch-sources.ts";
import build from "./build.ts";
import serverMarkdown from "./serve-markdown.ts";
import servePublic from "./serve-public.ts";
import {
  getConfig,
  getDbMetaFilePath,
  getFormatedSource,
  getSqlitePath,
  isDev,
  writeJSONFile,
} from "./util.ts";
import { CliOptions, RunOptions } from "./interface.ts";
// import db init meta json
import dbInitMeta from "./db-meta-init.json" assert { type: "json" };
export default async function main(cliOptions: CliOptions, ...args: string[]) {
  if (cliOptions.debug) {
    log.setLevel("debug");
  }
  const config = await getConfig();
  let sourceIdentifiers: string[] = args.length > 0
    ? args
    : Object.keys(config.sources);
  if (
    cliOptions.limit && cliOptions.limit > 0
  ) {
    sourceIdentifiers = sourceIdentifiers.slice(0, cliOptions.limit);
  }
  // check if source exists
  for (const sourceIdentifier of sourceIdentifiers) {
    if (config.sources[sourceIdentifier] === undefined) {
      config.sources[sourceIdentifier] = getFormatedSource(
        sourceIdentifier,
        null,
      );
    }
  }
  const isBuildHtml = cliOptions.html || false;
  const autoInit = cliOptions.autoInit;
  if (autoInit || (isDev())) {
    // check is db meta exists
    const dbMetaFilePath = getDbMetaFilePath();
    if (!await Deno.stat(dbMetaFilePath).catch(() => false)) {
      log.info("db meta not found, auto init");
      // copy db-meta-init.json
      await writeJSONFile(dbMetaFilePath, dbInitMeta);
    }
  }
  // init sqlite db
  // te
  // Open a database
  const db = new DB(getSqlitePath());
  db.execute(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      sha1 TEXT NOT NULL,
      markdown TEXT NOT NULL,
      category TEXT ,
      updated_at INT NOT NULL,
      updated_day INT NOT NULL,
      updated_week INT NOT NULL,
      file TEXT NOT NULL,
      source_identifier TEXT NOT NULL,
      source_category TEXT NOT NULL,
      checked_at INT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_item
    ON items (sha1, file, source_identifier);
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      sha1 TEXT NOT NULL,
      markdown TEXT NOT NULL,
      file TEXT NOT NULL,
      updated_at INT NOT NULL,
      source_identifier TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_file
    ON files (file, source_identifier);
  `);

  const runOptions: RunOptions = {
    config: config,
    sourceIdentifiers: args,
    db,
    ...cliOptions,
  };
  log.info(
    `run options: ${
      JSON.stringify({ sourceIdentifiers: args, ...cliOptions }, null, 2)
    }`,
  );
  if (cliOptions.fetch) {
    await fetchSources(runOptions);
  } else {
    log.info("skip fetch sources");
  }
  // 2. build markdowns, and htmls
  await build(runOptions);

  // 3. serve site
  if (runOptions.serve) {
    log.info("serve site");
    // check is there is html
    if (isBuildHtml) {
      servePublic();
    } else {
      // serve to markdown preview files
      await serverMarkdown(runOptions);
    }
  } else {
    log.info("skip serve site");
  }
  // Close connection
  db.close();
}

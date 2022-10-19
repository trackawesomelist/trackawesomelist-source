import log from "./log.ts";
import fetchSources from "./fetch-sources.ts";
import build from "./build.ts";
import serverMarkdown from "./serve-markdown.ts";
import servePublic from "./serve-public.ts";
import { getConfig, getFormatedSource, getSqlitePath, isDev } from "./util.ts";
import { CliOptions, RunOptions } from "./interface.ts";
import initDb from "./init-db.ts";
// import db init meta json
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
    await initDb();
  }
  // init sqlite db
  // te
  // Open a database
  const runOptions: RunOptions = {
    config: config,
    sourceIdentifiers: args,
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
}

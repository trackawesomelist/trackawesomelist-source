import { flags } from "./deps.ts";

import log from "./log.ts";

import fetchSources from "./workflows/1-fetch-sources.ts";
import buildMarkdown from "./workflows/2-build-markdown.ts";
import serveSite from "./workflows/3-serve-site.ts";
import { getConfig, getFormatedSource, isDebug, isDev } from "./util.ts";
import { RunOptions } from "./interface.ts";
export default async function main() {
  const args = flags.parse(Deno.args);

  let stage: string[] = [];

  if (args.fetch) {
    // only source
    stage = stage.concat([
      "fetch",
      "format",
    ]);
  } else if (args.build) {
    // only build stage
    stage = stage.concat([
      "buildmarkdown",
    ]);
  } else if (args.serve) {
    // only build stage
    stage = stage.concat([
      "buildmarkdown",
      "serve",
    ]);
  } else {
    stage = stage.concat([
      "fetch",
      "buildmarkdown",
    ]);
    if (isDev()) {
      stage.push("serve");
    }
  }
  if (args.stage) {
    stage = (args.stage).split(",");
  }
  if (args["extra-stage"]) {
    const extraStages = (args["extra-stage"]).split(",");
    stage = stage.concat(extraStages);
  }
  if (isDebug()) {
    log.setLevel("debug");
  }
  let isForce = false;
  if (args.force !== undefined) {
    isForce = args.force;
  } else if (Deno.env.get("FORCE") === "1") {
    isForce = true;
  }

  const config = await getConfig();

  let sourceIdentifiers: string[] = Object.keys(config.sources);
  if (Deno.env.get("SOURCE") || args.source) {
    if (args.source) {
      sourceIdentifiers = args.source.split(",");
    } else if (Deno.env.get("SOURCE")) {
      sourceIdentifiers = Deno.env.get("SOURCE")!.split(",");
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
  }
  let push = false;
  if (args.push !== undefined) {
    if (args.push === "1") {
      push = true;
    }
  }
  let port = 8000;
  if (args.port !== undefined) {
    port = args.port;
  }
  const runOptions: RunOptions = {
    config: config,
    sourceIdentifiers,
    force: isForce,
    push,
    port,
  };

  if (stage.includes("fetch")) {
    await fetchSources(runOptions);
  } else {
    log.info("skip fetch stage");
  }

  try {
    // 2. build markdowns
    if (stage.includes("buildmarkdown")) {
      await buildMarkdown(runOptions);
    } else {
      // test
      log.info("skip buildmarkdown stage");
    }
  } catch (e) {
    // log.error(e);
    throw e;
  }

  // 3. serve site
  if (stage.includes("serve")) {
    log.info("serve site");
    await serveSite(runOptions);
  } else {
    log.info("skip serve site");
  }
}

if (import.meta.main) {
  main();
}

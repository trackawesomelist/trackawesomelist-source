import { groupBy, mustache } from "../deps.ts";
import { fs, path } from "../deps.ts";
import {
  File,
  FileMeta,
  FileMetaWithSource,
  Item,
  ItemsJson,
  PageCategoryItem,
  PageData,
  PageItem,
  RunOptions,
} from "../interface.ts";
import { INDEX_MARKDOWN_PATH, RECENTLY_UPDATED_COUNT } from "../constant.ts";
import {
  exists,
  getDataItemsPath,
  getDataRawPath,
  getDbMeta,
  getDistRepoGitUrl,
  getDistRepoPath,
  getRepoHTMLURL,
  getUTCDay,
  isDev,
  parseItemsFilepath,
  readJSONFile,
  readTextFile,
  sha1,
  walkFile,
  writeDbMeta,
  writeJSONFile,
  writeTextFile,
} from "../util.ts";
import log from "../log.ts";
import {
  getItems,
  getUpdatedDays,
  getUpdatedFiles,
  getUpdatedWeeks,
} from "../db.ts";
import buildSourceFileMarkdown from "../build-source-file-markdown.ts";
import buildDayMarkdown from "../build-day-markdown.ts";

export default async function buildMarkdown(options: RunOptions) {
  const config = options.config;
  const sourcesConfig = config.sources;
  const dbMeta = await getDbMeta();
  const db = options.db;
  // get last update time
  let lastCheckedAt = dbMeta.checked_at;
  if (options.force) {
    lastCheckedAt = "1970-01-01T00:00:00.000Z";
  }
  // is any updates
  const allUpdatedFiles: File[] = await getUpdatedFiles(options.db, {
    since_date: new Date(lastCheckedAt),
  });
  log.debug(
    `allUpdatedFiles (${allUpdatedFiles.length}): ${
      JSON.stringify(allUpdatedFiles)
    }`,
  );
  if (allUpdatedFiles.length > 0) {
    log.info(`found ${allUpdatedFiles.length} updated files`);
    const dbSources = dbMeta.sources;
    const distRepoPath = getDistRepoPath();
    // is exist
    const isExist = await exists(distRepoPath);
    if (!isExist) {
      // try to sync from remote
      log.info("cloning from remote...");
      const p = Deno.run({
        cmd: ["git", "clone", getDistRepoGitUrl(), distRepoPath],
      });

      await p.status();
    } else {
      log.info(`dist repo already exist, skip updates`);
      // TODO
      // try to sync
      // const p = Deno.run({
      //   cmd: [
      //     "git",
      //     "--git-dir",
      //     path.join(distRepoPath, ".git"),
      //     "--work-tree",
      //     distRepoPath,
      //     "pull",
      //   ],
      // });

      // await p.status();
    }
    const dayTemplateContent = await readTextFile("./templates/day.md.mu");
    const rootTemplateContent = await readTextFile(
      "./templates/root-readme.md.mu",
    );

    let commitMessage = "Automated update\n\n";
    // start to build
    log.info("start to build markdown...");
    for (const file of allUpdatedFiles) {
      const builtInfo = await buildSourceFileMarkdown(
        db,
        file,
        sourcesConfig[file.source_identifier],
      );
      commitMessage += builtInfo.commitMessage + "\n";
    }

    // update day file
    const updatedDays = getUpdatedDays(db, {
      since_date: new Date(lastCheckedAt),
    });

    for (const day of updatedDays) {
      const builtInfo = await buildDayMarkdown(db, day.number);
      commitMessage += builtInfo.commitMessage + "\n";
    }
    const dbSourcesKeys = Object.keys(dbSources);
    const allFilesMeta: FileMetaWithSource[] = [];
    for (const sourceIdentifier of dbSourcesKeys) {
      const sourceMeta = dbSources[sourceIdentifier];
      const filesMeta = sourceMeta.files;
      const filesMetaKeys = Object.keys(filesMeta);
      for (const originalFilepath of filesMetaKeys) {
        const fileMeta = filesMeta[originalFilepath];
        allFilesMeta.push({
          ...fileMeta,
          sourceIdentifier,
          filepath: originalFilepath,
        });
      }
    }
    const recentlyUpdated = allFilesMeta.sort((a, b) => {
      return new Date(b.updated_at).getTime() -
        new Date(a.updated_at).getTime();
    }).slice(0, RECENTLY_UPDATED_COUNT).map((item) => {
      const sourceConfig = sourcesConfig[item.sourceIdentifier];

      const sourceFileConfig = sourceConfig.files[item.filepath];
      const sourceMeta = dbSources[item.sourceIdentifier].meta;

      return {
        name: item.sourceIdentifier + "/" + sourceFileConfig.name,
        url: sourceFileConfig.pathname,
        source_url: getRepoHTMLURL(
          sourceConfig.url,
          sourceMeta.default_branch,
          item.filepath,
        ),
      };
    });
    const indexPageData = {
      recentlyUpdated,
    };
    // write to index
    const itemMarkdownContentRendered = mustache.render(
      rootTemplateContent,
      indexPageData,
    );
    const indexMarkdownDistPath = path.join(
      getDistRepoPath(),
      INDEX_MARKDOWN_PATH,
    );
    await writeTextFile(indexMarkdownDistPath, itemMarkdownContentRendered);
    log.info(`build ${indexMarkdownDistPath} success`);
    if (options.push) {
      // try to push updates
      log.info("start to push updates...");
      const p1 = Deno.run({
        cmd: [
          "git",
          "--git-dir",
          path.join(distRepoPath, ".git"),
          "--work-tree",
          distRepoPath,
          "add",
          "**/*.md",
        ],
      });
      await p1.status();

      const p2 = Deno.run({
        cmd: [
          "git",
          "--git-dir",
          path.join(distRepoPath, ".git"),
          "--work-tree",
          distRepoPath,
          "commit",
          "-m",
          commitMessage,
        ],
      });
      await p2.status();
      const p3 = Deno.run({
        cmd: [
          "git",
          "--git-dir",
          path.join(distRepoPath, ".git"),
          "--work-tree",
          distRepoPath,
          "push",
        ],
      });
      await p3.status();
    } else {
      log.info("skip push updates...");
    }
  } else {
    log.info("no updated files, skip build markdown");
  }
}

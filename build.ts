import { groupBy, mustache } from "./deps.ts";
import { fs, path } from "./deps.ts";
import {
  File,
  FileInfo,
  FileMeta,
  FileMetaWithSource,
  Item,
  ItemsJson,
  PageCategoryItem,
  PageData,
  PageItem,
  RunOptions,
} from "./interface.ts";
import { INDEX_MARKDOWN_PATH, RECENTLY_UPDATED_COUNT } from "./constant.ts";
import {
  exists,
  getDataItemsPath,
  getDataRawPath,
  getDbMeta,
  getDistRepoGitUrl,
  getDistRepoPath,
  getPublicPath,
  getRepoHTMLURL,
  getStaticPath,
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
} from "./util.ts";
import log from "./log.ts";
import {
  getItems,
  getUpdatedDays,
  getUpdatedFiles,
  getUpdatedWeeks,
} from "./db.ts";
import buildSourceFileMarkdown from "./build-source-file-markdown.ts";
import buildDayMarkdown from "./build-day-markdown.ts";
import buildHtmlFile from "./build-html.ts";

export default async function buildMarkdown(options: RunOptions) {
  const config = options.config;
  const sourcesConfig = config.sources;
  const isBuildSite = options.html;
  const isBuildMarkdown = options.markdown;
  if (!isBuildSite && !isBuildMarkdown) {
    log.info("skip build site or markdown");
    return;
  }
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
    if (options.push) {
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
        // try to sync
        const p = Deno.run({
          cmd: [
            "git",
            "--git-dir",
            path.join(distRepoPath, ".git"),
            "--work-tree",
            distRepoPath,
            "pull",
          ],
        });

        await p.status();
      }
    }
    const dayTemplateContent = await readTextFile("./templates/day.md.mu");
    const rootTemplateContent = await readTextFile(
      "./templates/root-readme.md.mu",
    );

    const htmlTemplate = await readTextFile("./templates/index.html.mu");
    let commitMessage = "Automated update\n\n";
    // start to build
    log.info("start to build markdown...");
    for (const file of allUpdatedFiles) {
      const sourceConfig = sourcesConfig[file.source_identifier];
      const fileInfo: FileInfo = {
        sourceConfig: sourceConfig,
        sourceMeta: dbSources[sourceConfig.identifier],
        filepath: file.file,
      };
      if (isBuildMarkdown) {
        const builtInfo = await buildSourceFileMarkdown(
          db,
          fileInfo,
          options,
        );
        commitMessage += builtInfo.commitMessage + "\n";
      }
      // build html
      // if (isBuildSite) {
      //   await buildHtmlFile(
      //     path.join(getDistRepoPath(), sourceConfig.identifier, file.file),
      //     htmlTemplate,
      //   );
      // }
    }

    // update day file
    const updatedDays = getUpdatedDays(db, {
      since_date: new Date(lastCheckedAt),
    });

    for (const day of updatedDays) {
      if (isBuildMarkdown) {
        const builtInfo = await buildDayMarkdown(db, day.number, options);
        commitMessage += builtInfo.commitMessage + "\n";
      }
      // build html
      // if (isBuildSite) {
      //   await buildHtmlFile(
      //     path.join(getDistRepoPath(), day.path, INDEX_MARKDOWN_PATH),
      //     htmlTemplate,
      //   );
      // }
    }
    // update week file
    const updatedWeeks = getUpdatedWeeks(db, {
      since_date: new Date(lastCheckedAt),
    });
    for (const day of updatedWeeks) {
      if (isBuildMarkdown) {
        const builtInfo = await buildDayMarkdown(db, day.number, options);
        commitMessage += builtInfo.commitMessage + "\n";
      }
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
        url: sourceFileConfig.pathname + INDEX_MARKDOWN_PATH,
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
    if (isBuildMarkdown) {
      await writeTextFile(indexMarkdownDistPath, itemMarkdownContentRendered);

      log.info(`build ${indexMarkdownDistPath} success`);
    }
    if (isBuildSite) {
      await buildHtmlFile(
        indexMarkdownDistPath,
        htmlTemplate,
      );
    }

    // copy static files
    if (isBuildSite) {
      log.info("copy static files...");

      const staticPath = getStaticPath();

      // copy all files from static to public
      // walk files
      for await (const entry of await walkFile(staticPath)) {
        const relativePath = path.relative(staticPath, entry.path);
        const distPath = path.join(getPublicPath(), relativePath);
        await fs.copy(entry.path, distPath, {
          overwrite: true,
        });
      }
    }

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

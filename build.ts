import { groupBy, mustache } from "./deps.ts";
import { fs, path } from "./deps.ts";
import {
  Feed,
  FeedItem,
  File,
  FileInfo,
  FileMeta,
  FileMetaWithSource,
  Item,
  ItemsJson,
  List,
  ListItem,
  RunOptions,
} from "./interface.ts";
import {
  INDEX_MARKDOWN_PATH,
  RECENTLY_UPDATED_COUNT,
  TOP_REPOS_COUNT,
} from "./constant.ts";
import {
  exists,
  getAllSourceCategories,
  getBaseFeed,
  getDataItemsPath,
  getDataRawPath,
  getDbMeta,
  getDistRepoGitUrl,
  getDistRepoPath,
  getIndexFileConfig,
  getItemsDetails,
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
  getLatestItemsByDay,
  getLatestItemsByWeek,
  getUpdatedDays,
  getUpdatedFiles,
  getUpdatedWeeks,
} from "./db.ts";
import buildBySource from "./build-by-source.ts";
import buildByTime, {
  itemsToFeedItems,
  itemsToFeedItemsByDate,
} from "./build-by-time.ts";
import buildHtmlFile from "./build-html.ts";

export default async function buildMarkdown(options: RunOptions) {
  const config = options.config;
  const sourcesConfig = config.sources;
  const sourcesKeys = Object.keys(sourcesConfig);
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
      let isExist = await exists(distRepoPath);
      // is exist, check is a git root dir
      if (isExist) {
        const isGitRootExist = await exists(path.join(distRepoPath, ".git"));
        if (!isGitRootExist) {
          // remote dir
          await Deno.remove(distRepoPath, {
            recursive: true,
          });
          isExist = false;
        }
      }
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
      const builtInfo = await buildBySource(
        db,
        fileInfo,
        options,
      );
      commitMessage += builtInfo.commitMessage + "\n";
    }

    // update day file
    const updatedDays = getUpdatedDays(db, {
      since_date: new Date(lastCheckedAt),
    });

    for (const day of updatedDays) {
      const builtInfo = await buildByTime(db, day.number, options);
      commitMessage += builtInfo.commitMessage + "\n";
    }
    // update week file
    const updatedWeeks = getUpdatedWeeks(db, {
      since_date: new Date(lastCheckedAt),
    });
    for (const day of updatedWeeks) {
      const builtInfo = await buildByTime(db, day.number, options);
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
        name: sourceFileConfig.name,
        url: sourceFileConfig.pathname + INDEX_MARKDOWN_PATH,
        source_url: getRepoHTMLURL(
          sourceConfig.url,
          sourceMeta.default_branch,
          item.filepath,
        ),
      };
    });
    // top 50 repos
    const sortedRepos = dbSourcesKeys.sort(
      (aSourceIdentifier, bSourceIdentifier) => {
        const sourceMeta = dbSources[aSourceIdentifier];
        const aMeta = dbSources[aSourceIdentifier];
        const bMeta = dbSources[bSourceIdentifier];
        const unmaintainedTime = new Date().getTime() -
          2 * 365 * 24 * 60 * 60 * 1000;

        let aAddedScore =
          (new Date(aMeta.updated_at).getTime() - unmaintainedTime) /
          100000;

        let bAddedScore =
          (new Date(bMeta.updated_at).getTime() - unmaintainedTime) /
          100000;

        if (aMeta.meta.stargazers_count < 20000) {
          aAddedScore = aAddedScore / 10;
        }

        if (bMeta.meta.stargazers_count < 20000) {
          bAddedScore = bAddedScore / 10;
        }

        const score = bMeta.meta.stargazers_count + bAddedScore -
          (aAddedScore + aMeta.meta.stargazers_count);

        return score;
      },
    ).slice(0, TOP_REPOS_COUNT).map((sourceIdentifier) => {
      const sourceConfig = sourcesConfig[sourceIdentifier];

      const sourceFileConfig = getIndexFileConfig(sourceConfig.files);
      const sourceMeta = dbSources[sourceIdentifier].meta;

      return {
        name: sourceFileConfig.name,
        url: sourceFileConfig.pathname + INDEX_MARKDOWN_PATH,
        source_url: getRepoHTMLURL(
          sourceConfig.url,
          sourceMeta.default_branch,
          sourceFileConfig.filepath,
        ),
      };
    });
    for (let i = 0; i < 2; i++) {
      const isDay = i === 0;
      let lastItems: Record<string, Item> = {};
      if (isDay) {
        lastItems = getLatestItemsByDay(db, 150);
      } else {
        lastItems = getLatestItemsByWeek(db, 300);
      }

      const feedItems = itemsToFeedItemsByDate(lastItems, config, isDay);

      const indexMarkdownDistPath = path.join(
        getDistRepoPath(),
        isDay ? INDEX_MARKDOWN_PATH : `week/${INDEX_MARKDOWN_PATH}`,
      );
      const baseFeed = getBaseFeed();
      const indexFeed: Feed = {
        ...baseFeed,
        title: "Track Awesome List Updates Daily",
        description: config.site.description,
        _nav_text: "",
        _seo_title:
          `${config.site.title} - Track your Favorite Github Awesome Repo Weekly`,
        home_page_url: config.site.url,
        feed_url: config.site.url + "/feed.json",
        items: [
          ...feedItems.slice(1),
        ],
      };
      const groupByCategory = (sourceIdentifier: string) => {
        const sourceConfig = sourcesConfig[sourceIdentifier];
        return sourceConfig.category;
      };
      const listGroups = groupBy(sourcesKeys, groupByCategory);

      const list: List[] = Object.keys(listGroups).map((category) => {
        const sourceIdentifiers = listGroups[category];
        const items = sourceIdentifiers.map((sourceIdentifier: string) => {
          const sourceConfig = sourcesConfig[sourceIdentifier];
          const indexFileConfig = getIndexFileConfig(sourceConfig.files);
          const item: ListItem = {
            name: indexFileConfig.name,
            url: indexFileConfig.pathname + INDEX_MARKDOWN_PATH,
          };
          return item;
        });
        return {
          category,
          items,
        };
      });
      const indexPageData = {
        recentlyUpdated,
        sortedRepos,
        items: feedItems,
        list,
        feed: {
          ...indexFeed,
          items: [],
        },
      };
      // write to index
      const itemMarkdownContentRendered = mustache.render(
        rootTemplateContent,
        indexPageData,
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

        // build feed json
        const feedJsonDistPath = path.join(
          getPublicPath(),
          isDay ? "feed.json" : `week/feed.json`,
        );
        await writeJSONFile(feedJsonDistPath, indexFeed);
        // build rss
        // @ts-ignore: node modules
        const feedOutput = jsonfeedToAtom(indexFeed, {
          language: "en",
        });
        const rssDistPath = path.join(
          getPublicPath(),
          isDay ? "feed.xml" : `week/feed.xml`,
        );
        await writeTextFile(rssDistPath, feedOutput);
      }
    }
    // build week data
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

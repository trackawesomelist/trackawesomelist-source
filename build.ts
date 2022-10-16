import { groupBy, jsonfeedToAtom, mustache } from "./deps.ts";
import { fs, path, pLimit } from "./deps.ts";
import {
  BuiltMarkdownInfo,
  DayInfo,
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
  WeekOfYear,
} from "./interface.ts";
import {
  INDEX_MARKDOWN_PATH,
  RECENTLY_UPDATED_COUNT,
  TOP_REPOS_COUNT,
} from "./constant.ts";
import {
  exists,
  formatHumanTime,
  getAllSourceCategories,
  getBaseFeed,
  getDataItemsPath,
  getDataRawPath,
  getDbMeta,
  getDistRepoContentPath,
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
  pathnameToFeedUrl,
  pathnameToFilePath,
  readJSONFile,
  readTextFile,
  sha1,
  slug,
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
  const specificSourceIdentifiers = options.sourceIdentifiers;
  const isBuildMarkdown = options.markdown;
  if (!isBuildSite && !isBuildMarkdown) {
    log.info("skip build site or markdown");
    return;
  }
  const dbMeta = await getDbMeta();
  const dbSources = dbMeta.sources;
  let dbItemsLatestUpdatedAt = new Date(0);
  for (const sourceIdentifier of Object.keys(dbSources)) {
    const source = dbSources[sourceIdentifier];
    const files = source.files;
    for (const fileKey of Object.keys(files)) {
      const file = files[fileKey];
      if (
        new Date(file.updated_at).getTime() > dbItemsLatestUpdatedAt.getTime()
      ) {
        dbItemsLatestUpdatedAt = new Date(file.updated_at);
      }
    }
  }
  const db = options.db;
  const startTime = new Date();
  log.info("start build markdown at " + startTime);
  // get last update time
  let lastCheckedAt = dbMeta.checked_at;
  if (options.force) {
    lastCheckedAt = "1970-01-01T00:00:00.000Z";
  }
  let allUpdatedFiles: File[] = [];
  if (specificSourceIdentifiers.length > 0) {
    // build specific source
    for (const sourceIdentifier of specificSourceIdentifiers) {
      const sourceConfig = sourcesConfig[sourceIdentifier];
      for (const file of Object.keys(sourceConfig.files)) {
        allUpdatedFiles.push({
          source_identifier: sourceIdentifier,
          file,
        });
      }
    }
  } else {
    // is any updates
    allUpdatedFiles = getUpdatedFiles(options.db, {
      since_date: new Date(lastCheckedAt),
      source_identifiers: specificSourceIdentifiers,
    });
  }
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
    log.info(
      "start to build sources markdown... total: " + allUpdatedFiles.length,
    );
    let updatedFileIndex = 0;
    let promises: Promise<void>[] = [];
    let limit = pLimit(10);
    for (const file of allUpdatedFiles) {
      const sourceConfig = sourcesConfig[file.source_identifier];
      const fileInfo: FileInfo = {
        sourceConfig: sourceConfig,
        sourceMeta: dbSources[sourceConfig.identifier],
        filepath: file.file,
      };
      promises.push(
        limit(
          () => {
            updatedFileIndex++;
            log.info(
              `[${updatedFileIndex}/${allUpdatedFiles.length}] ${file.source_identifier}/${file.file}`,
            );
            return buildBySource(
              db,
              fileInfo,
              options,
            ).then((builtInfo) => {
              commitMessage += builtInfo.commitMessage + "\n";
            });
          },
        ),
      );
    }
    await Promise.all(promises);

    log.info("build single markdown done");

    // only updated when there is no specific source
    if (options.dayMarkdown) {
      // update day file
      const updatedDays = getUpdatedDays(db, {
        since_date: new Date(lastCheckedAt),
        source_identifiers: specificSourceIdentifiers,
      });

      let updatedDayIndex = 0;
      log.info("start to build day markdown..., total: " + updatedDays.length);
      promises = [];
      for (const day of updatedDays) {
        promises.push(
          limit(() => {
            updatedDayIndex++;
            log.info(`[${updatedDayIndex}/${updatedDays.length}] ${day.path}`);

            return buildByTime(db, day.number, options).then((builtInfo) => {
              commitMessage += builtInfo.commitMessage + "\n";
            });
          }),
        );
      }
      await Promise.all(promises);
      promises = [];
      // update week file
      const updatedWeeks = getUpdatedWeeks(db, {
        since_date: new Date(lastCheckedAt),
        source_identifiers: specificSourceIdentifiers,
      });
      let updatedWeekIndex = 0;
      log.info(
        "start to build week markdown..., total: " + updatedWeeks.length,
      );
      for (const day of updatedWeeks) {
        promises.push(
          limit(() => {
            updatedWeekIndex++;
            log.info(
              `[${updatedWeekIndex}/${updatedWeeks.length}] ${day.path}`,
            );

            return buildByTime(db, day.number, options).then((builtInfo) => {
              commitMessage += builtInfo.commitMessage + "\n";
            });
          }),
        );
      }

      await Promise.all(promises);
    } else {
      log.info("skip build day markdown");
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
        url: pathnameToFilePath(sourceFileConfig.pathname),
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
        url: pathnameToFilePath(sourceFileConfig.pathname),
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
        getDistRepoContentPath(),
        isDay ? INDEX_MARKDOWN_PATH : `week/${INDEX_MARKDOWN_PATH}`,
      );
      const baseFeed = getBaseFeed();
      const indexFeed: Feed = {
        ...baseFeed,
        title: "Track Awesome List Updates Daily",
        description: config.site.description,
        _nav_text: `[View by Weekly](/week/README.md)· [Feed](${
          pathnameToFeedUrl("/", true)
        }) · 📝 ${formatHumanTime(dbItemsLatestUpdatedAt)} · ✅ ${
          formatHumanTime(new Date(dbMeta.checked_at))
        }`,
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
            url: pathnameToFilePath(indexFileConfig.pathname),
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
      // build summary.md
      let summary = "# Track Awesome List\n\n [README](README.md)\n\n";
      let allRepos = "\n- [All Tracked List](all-repos/README.md)";
      const recentlyText = recentlyUpdated.reduce((acc, item) => {
        return acc + `\n  - [${item.name}](${pathnameToFilePath(item.url)})`;
      }, "\n- [Recently Updated](recently-updated/README.md)");
      const topReposText = sortedRepos.reduce((acc, item) => {
        return acc + `\n  - [${item.name}](${pathnameToFilePath(item.url)})`;
      }, "\n- [Top Repos](top/README.md)");
      Object.keys(listGroups).forEach((category) => {
        const sourceIdentifiers = listGroups[category];
        allRepos += `\n  - [${category}](${slug(category)}/README.md)`;
        const items = sourceIdentifiers.map((sourceIdentifier: string) => {
          const sourceConfig = sourcesConfig[sourceIdentifier];
          const indexFileConfig = getIndexFileConfig(sourceConfig.files);
          const filename = indexFileConfig.name;
          allRepos += `\n    - [${filename}](${
            pathnameToFilePath(indexFileConfig.pathname)
          })
      - [weekly](${pathnameToFilePath(indexFileConfig.pathname + "week/")})
      - [overview](${
            pathnameToFilePath(indexFileConfig.pathname + "readme/")
          })`;
        });
      });
      const allDays = getUpdatedDays(db, {
        since_date: new Date(0),
      });
      const allWeeks = getUpdatedWeeks(db, {
        since_date: new Date(0),
      });

      // add days and weeks to summary

      // group days by utc year, month
      const daysByYear = groupBy(allDays, "year");
      let daysText = "\n- [Days](daily/README.md)";
      Object.keys(daysByYear).sort((a, b) => Number(b) - Number(a))
        .forEach(
          (year) => {
            daysText += `\n  - [${year}](${year}/month/README.md)`;
            const daysByMonth = groupBy(daysByYear[year], "month");
            Object.keys(daysByMonth).sort((a, b) => Number(b) - Number(a))
              .forEach((month) => {
                daysText +=
                  `\n    - [${month}](${year}/${month}/day/README.md)`;
                const days = daysByMonth[month] as DayInfo[];
                days.sort((a: DayInfo, b: DayInfo) =>
                  Number(b.day) - Number(a.day)
                )
                  .forEach(
                    (day: DayInfo) => {
                      daysText +=
                        `\n      - [${day.name}](${day.path}/README.md)`;
                    },
                  );
              });
          },
        );
      // group weeks by utc year, month
      // add weeks to summary
      const weeksByYear = groupBy(allWeeks, "year");
      let weeksText = "\n- [Weeks](week/README.md)";
      Object.keys(weeksByYear).sort((a, b) => Number(b) - Number(a))
        .forEach((year) => {
          weeksText += `\n  - [${year}](${year}/week/README.md)`;
          const weeks = weeksByYear[year] as WeekOfYear[];
          weeks.sort((a, b) => Number(b.week) - Number(a.week)).forEach(
            (week: WeekOfYear) => {
              weeksText += `\n    - [${week.name}](${week.path}/README.md)`;
            },
          );
        });

      summary += recentlyText + topReposText + allRepos + daysText + weeksText;
      const summaryMarkdownDistPath = path.join(
        getDistRepoContentPath(),
        "SUMMARY.md",
      );
      await Deno.writeTextFile(summaryMarkdownDistPath, summary);

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

    // copy readme to dist
    const contentReadmePath = path.join(
      getDistRepoContentPath(),
      "README.md",
    );
    const readmeDistPath = path.join(getDistRepoPath(), "README.md");
    await Deno.copyFile(contentReadmePath, readmeDistPath);
    const endTime = new Date();

    log.info(
      `build success, cost ${
        ((endTime.getTime() - startTime.getTime()) / 1000 / 60).toFixed(2)
      }ms`,
    );

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
          ":/*.md",
        ],
      });
      await p1.status();

      const p2 = Deno.run({
        cmd: [
          "git",
          "-c",
          "user.name=github-actions[bot]",
          "-c",
          "user.email=github-actions[bot]@users.noreply.github.com",
          "--git-dir",
          path.join(distRepoPath, ".git"),
          "--work-tree",
          distRepoPath,
          "commit",
          "--author='github-actions[bot]  <github-actions[bot]@users.noreply.github.com>'",
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

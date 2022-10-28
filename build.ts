import { CSS, groupBy, jsonfeedToAtom, mustache } from "./deps.ts";
import { fs, path } from "./deps.ts";
import {
  DayInfo,
  FeedInfo,
  File,
  FileInfo,
  FileMetaWithSource,
  Item,
  List,
  ListItem,
  RunOptions,
  WeekOfYear,
} from "./interface.ts";
import renderMarkdown from "./render-markdown.ts";
import {
  GITHUB_NAV,
  GITHUB_REPO,
  INDEX_MARKDOWN_PATH,
  PROD_DOMAIN,
  SEARCH_NAV,
  SUBSCRIPTION_URL,
  TOP_REPOS_COUNT,
  WEBSITE_NAV,
} from "./constant.ts";
import {
  exists,
  formatHumanTime,
  formatNumber,
  getBaseFeed,
  getDayNumber,
  getDbIndex,
  getDbMeta,
  getDistRepoContentPath,
  getDistRepoGitUrl,
  getDistRepoPath,
  getIndexFileConfig,
  getnextPaginationTextByNumber,
  getPaginationHtmlByNumber,
  getPaginationTextByNumber,
  getPublicPath,
  getRepoHTMLURL,
  getStaticPath,
  getWeekNumber,
  pathnameToFeedUrl,
  pathnameToFilePath,
  pathnameToUrl,
  readTextFile,
  slug,
  walkFile,
  writeDbMeta,
  writeJSONFile,
  writeTextFile,
} from "./util.ts";
import log from "./log.ts";
import { getItemsByDays, getUpdatedDays, getUpdatedFiles } from "./db.ts";
import buildBySource from "./build-by-source.ts";
import buildByTime, { itemsToFeedItemsByDate } from "./build-by-time.ts";

export default async function buildMarkdown(options: RunOptions) {
  const config = options.config;
  const sourcesConfig = config.sources;
  const siteConfig = config.site;
  const sourcesKeys = Object.keys(sourcesConfig);
  const isBuildSite = options.html;
  const specificSourceIdentifiers = options.sourceIdentifiers;
  const isBuildMarkdown = options.markdown;
  const now = new Date();
  if (!isBuildSite && !isBuildMarkdown) {
    log.info("skip build site or markdown");
    return;
  }
  const dbMeta = await getDbMeta();
  const dbIndex = await getDbIndex();
  const dbSources = dbMeta.sources;
  let dbItemsLatestUpdatedAt = new Date(0);
  const htmlIndexTemplateContent = await readTextFile(
    "./templates/index.html.mu",
  );
  const htmlSearchTemplateContent = await readTextFile(
    "./templates/search.html.mu",
  );
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
      const sourceFilesKeys = Object.keys(sourceConfig.files);
      for (const file of sourceFilesKeys) {
        allUpdatedFiles.push({
          source_identifier: sourceIdentifier,
          file,
        });
      }
    }
  } else {
    // is any updates
    log.info(`check updates since ${lastCheckedAt}`);
    allUpdatedFiles = getUpdatedFiles({
      since_date: new Date(lastCheckedAt),
      source_identifiers: specificSourceIdentifiers,
    }, dbIndex);
  }
  if (options.limit && options.limit > 0) {
    allUpdatedFiles = allUpdatedFiles.slice(0, options.limit);
  }
  log.debug(
    `allUpdatedFiles (${allUpdatedFiles.length}) `,
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
    const startBuildSourceTime = new Date();
    let updatedFileIndex = 0;
    for (const file of allUpdatedFiles) {
      const sourceConfig = sourcesConfig[file.source_identifier];
      const fileInfo: FileInfo = {
        sourceConfig: sourceConfig,
        sourceMeta: dbSources[sourceConfig.identifier],
        filepath: file.file,
      };
      updatedFileIndex++;
      log.info(
        `[${updatedFileIndex}/${allUpdatedFiles.length}] ${file.source_identifier}/${file.file}`,
      );
      const builtInfo = await buildBySource(
        fileInfo,
        options,
        {
          paginationHtml: "",
          dbMeta,
          paginationText: "",
          dbIndex,
        },
      );

      commitMessage += builtInfo.commitMessage + "\n";
    }

    const endBuildSourceTime = new Date();
    const buildSourceTime = endBuildSourceTime.getTime() -
      startBuildSourceTime.getTime();
    log.info(
      "build single markdown done, cost ",
      (buildSourceTime / 1000).toFixed(2),
      " seconds",
    );

    const allDays = getUpdatedDays(dbIndex, {
      since_date: new Date(0),
    }, true);
    const allWeeks = getUpdatedDays(dbIndex, {
      since_date: new Date(0),
    }, false);
    // only updated when there is no specific source
    if (options.dayMarkdown) {
      // update day file
      let updatedDays = getUpdatedDays(dbIndex, {
        since_date: new Date(lastCheckedAt),
        source_identifiers: specificSourceIdentifiers,
      }, true);

      if (options.limit && options.limit > 0) {
        updatedDays = updatedDays.slice(0, options.limit);
      }

      let updatedDayIndex = 0;
      log.info("start to build day markdown..., total: " + updatedDays.length);
      const startBuildDayTime = new Date();
      for (const day of updatedDays) {
        const builtInfo = await buildByTime(day.number, options, {
          paginationText: getPaginationTextByNumber(day.number, allDays),
          paginationHtml: getPaginationHtmlByNumber(day.number, allDays),
          dbMeta,
          dbIndex,
        });
        updatedDayIndex++;
        log.debug(
          `build day markdown [${updatedDayIndex}/${updatedDays.length}] ${day.path}`,
        );
        commitMessage += builtInfo.commitMessage + "\n";
      }
      const endBuildDayTime = new Date();
      const buildDayTime = endBuildDayTime.getTime() -
        startBuildDayTime.getTime();
      log.info(
        "build day markdown done, cost ",
        (buildDayTime / 1000).toFixed(2),
        " seconds",
      );

      const startBuildWeekTime = new Date();
      // update week file
      let updatedWeeks = getUpdatedDays(dbIndex, {
        since_date: new Date(lastCheckedAt),
        source_identifiers: specificSourceIdentifiers,
      }, false);
      if (options.limit && options.limit > 0) {
        updatedWeeks = updatedWeeks.slice(0, options.limit);
      }

      let updatedWeekIndex = 0;
      log.info(
        "start to build week markdown..., total: " + updatedWeeks.length,
      );
      for (const day of updatedWeeks) {
        updatedWeekIndex++;
        log.debug(
          `build week markdown [${updatedWeekIndex}/${updatedWeeks.length}] ${day.path}`,
        );

        const builtInfo = await buildByTime(day.number, options, {
          paginationText: getPaginationTextByNumber(day.number, allWeeks),
          paginationHtml: getPaginationHtmlByNumber(day.number, allWeeks),
          dbMeta,
          dbIndex,
        });

        commitMessage += builtInfo.commitMessage + "\n";
      }
      const endBuildWeekTime = new Date();
      const buildWeekTime = endBuildWeekTime.getTime() -
        startBuildWeekTime.getTime();
      log.info(
        "build week markdown done, cost ",
        (buildWeekTime / 1000).toFixed(2),
        " seconds",
      );
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
    // top 50 repos
    // https://bearblog.dev/discover/
    // Score = log10(U) + (S / D * 8600)
    const sortedRepos = dbSourcesKeys.sort(
      (aSourceIdentifier, bSourceIdentifier) => {
        const sourceMeta = dbSources[aSourceIdentifier];
        const aMeta = dbSources[aSourceIdentifier];
        const bMeta = dbSources[bSourceIdentifier];
        const aSourceConfig = sourcesConfig[aSourceIdentifier];
        const bSourceConfig = sourcesConfig[bSourceIdentifier];
        const aIndexFileConfig = getIndexFileConfig(aSourceConfig.files);
        const bIndexFileConfig = getIndexFileConfig(bSourceConfig.files);
        const aIndexFileMeta = aMeta.files[aIndexFileConfig.filepath];
        const bIndexFileMeta = bMeta.files[bIndexFileConfig.filepath];
        const aUpdated = new Date(aIndexFileMeta.updated_at);
        const bUpdated = new Date(bIndexFileMeta.updated_at);
        const unmaintainedTime = new Date().getTime() -
          2 * 365 * 24 * 60 * 60 * 1000;
        // const flagTime = new Date("2020-01-01");
        const aUnmaintained = aUpdated.getTime() <
          unmaintainedTime;
        const bUnmaintained = bUpdated.getTime() <
          unmaintainedTime;

        if (aUnmaintained && !bUnmaintained) {
          return 1;
        }
        if (!aUnmaintained && bUnmaintained) {
          return -1;
        }

        if (aUnmaintained && bUnmaintained) {
          return 0;
        }

        const aScore = aMeta.meta.stargazers_count;
        const aLogScore = Math.log2(aScore);
        const bScore = bMeta.meta.stargazers_count;
        const bLogScore = Math.log2(bScore);
        // console.log("aLogScore", aLogScore);
        // console.log("bLogScore", bLogScore);
        const aUpdatedScore = ((now.getTime() - aUpdated.getTime()) / 1000 /
          604800);
        const bUpdatedScore = ((now.getTime() - bUpdated.getTime()) / 1000 /
          604800);
        const result = (bLogScore - bUpdatedScore) -
          (aLogScore - aUpdatedScore);
        // console.log("result", result);
        return result;

        // return score;
      },
    ).slice(0, TOP_REPOS_COUNT).map((sourceIdentifier, index) => {
      const sourceConfig = sourcesConfig[sourceIdentifier];

      const sourceFileConfig = getIndexFileConfig(sourceConfig.files);
      const sourceMeta = dbSources[sourceIdentifier].meta;
      const dbFileInfo =
        dbSources[sourceIdentifier].files[sourceFileConfig.filepath];

      return {
        order: index + 1,
        name: sourceFileConfig.name,
        url: pathnameToFilePath(sourceFileConfig.pathname),
        star: formatNumber(sourceMeta.stargazers_count),
        source_url: getRepoHTMLURL(
          sourceConfig.url,
          sourceMeta.default_branch,
          sourceFileConfig.filepath,
        ),
        meta: sourceMeta,
        updated: formatHumanTime(new Date(dbFileInfo.updated_at)),
      };
    });
    // write dbMeta
    dbMeta.checked_at = new Date().toISOString();
    for (let i = 0; i < 2; i++) {
      const isDay = i === 0;
      let lastItems: Record<string, Item> = {};
      let jsonFeedItems: Record<string, Item> = {};
      if (isDay) {
        lastItems = await getItemsByDays(
          allDays.slice(0, 3).map((item) => item.number),
          dbIndex,
          isDay,
        );
        jsonFeedItems = await getItemsByDays(
          allDays.slice(1, 15).map((item) => item.number),
          dbIndex,
          isDay,
        );
      } else {
        lastItems = await getItemsByDays(
          allWeeks.slice(0, 1).map((item) => item.number),
          dbIndex,
          isDay,
        );
        jsonFeedItems = await getItemsByDays(
          allWeeks.slice(1, 4).map((item) => item.number),
          dbIndex,
          isDay,
        );
      }

      // console.log("lastItems", lastItems);
      const feedItems = itemsToFeedItemsByDate(lastItems, config, isDay);

      const jsonFeedItemsByDate = itemsToFeedItemsByDate(
        jsonFeedItems,
        config,
        isDay,
      );
      const indexMarkdownDistPath = path.join(
        getDistRepoContentPath(),
        isDay ? INDEX_MARKDOWN_PATH : `week/${INDEX_MARKDOWN_PATH}`,
      );
      const baseFeed = getBaseFeed();
      let indexNav = "";
      if (isDay) {
        indexNav = `[📅 Weekly](/week/README.md) · [${SEARCH_NAV}](${
          pathnameToUrl("/search/")
        }) · [🔥 Feed](${
          pathnameToFeedUrl("/", true)
        }) · [📮 Subscribe](${SUBSCRIPTION_URL}) · [${GITHUB_NAV}](${GITHUB_REPO}) · [${WEBSITE_NAV}](${PROD_DOMAIN}) · 📝 ${
          formatHumanTime(dbItemsLatestUpdatedAt)
        } · ✅ ${formatHumanTime(new Date(dbMeta.checked_at))}`;
      } else {
        indexNav = `[🏠 Home](/README.md) · [${SEARCH_NAV}](${
          pathnameToUrl("/search/")
        }) · [🔥 Feed](${
          pathnameToFeedUrl("/week/", true)
        }) · [📮 Subscribe](${SUBSCRIPTION_URL}) · [${GITHUB_NAV}](${GITHUB_REPO}) · [${WEBSITE_NAV}](${PROD_DOMAIN}) · 📝 ${
          formatHumanTime(dbItemsLatestUpdatedAt)
        } · ✅ ${formatHumanTime(new Date(dbMeta.checked_at))}`;
      }
      const indexFeed: FeedInfo = {
        ...baseFeed,
        title: "Track Awesome List Updates " + (isDay ? "Daily" : "Weekly"),
        _site_title: siteConfig.title,
        description: config.site.description,
        _seo_title:
          `${config.site.title} - Track your Favorite Github Awesome List ${
            isDay ? "Daily" : "Weekly"
          }`,
        home_page_url: config.site.url + (isDay ? "/" : "/week/"),
        feed_url: config.site.url + (isDay ? "/" : "/week/") + "feed.json",
      };
      const groupByCategory = (sourceIdentifier: string) => {
        const sourceConfig = sourcesConfig[sourceIdentifier];
        return sourceConfig.category;
      };
      const listGroups = groupBy(sourcesKeys, groupByCategory);

      const list: List[] = Object.keys(listGroups).sort().map((category) => {
        const sourceIdentifiers = listGroups[category];
        const items = sourceIdentifiers.map((sourceIdentifier: string) => {
          const sourceConfig = sourcesConfig[sourceIdentifier];
          const indexFileConfig = getIndexFileConfig(sourceConfig.files);
          const sourceMeta = dbSources[sourceIdentifier]?.meta;
          const dbFileInfo =
            dbSources[sourceIdentifier]?.files[indexFileConfig.filepath];
          const item: ListItem = {
            name: indexFileConfig.name,
            meta: sourceMeta,
            updated: formatHumanTime(new Date(dbFileInfo?.updated_at ?? 0)),
            url: pathnameToFilePath(indexFileConfig.pathname),
            star: formatNumber(sourceMeta?.stargazers_count ?? 0),
            source_url: sourceConfig.url,
          };
          return item;
        }).sort((a: ListItem, b: ListItem) => a.name.localeCompare(b.name));
        return {
          category,
          items,
        };
      });
      const lastItem = feedItems[feedItems.length - 1];
      const lastItemDate = lastItem.date_published;
      const lastItemDateObj = new Date(lastItemDate);
      let lastDayNumber = 0;
      if (isDay) {
        lastDayNumber = getDayNumber(lastItemDateObj);
      } else {
        lastDayNumber = getWeekNumber(lastItemDateObj);
      }

      const indexPageData = {
        sortedRepos,
        items: feedItems,
        list,
        feed: indexFeed,
        navText: indexNav,
        paginationText: getnextPaginationTextByNumber(
          lastDayNumber,
          isDay ? allDays : allWeeks,
        ),
      };
      // build summary.md
      let summary = "# Track Awesome List\n\n [README](README.md)\n\n";
      let allRepos = "\n- [All Tracked List](all-repos/README.md)";
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

      summary += topReposText + allRepos + daysText + weeksText;
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
        const body = renderMarkdown(itemMarkdownContentRendered);
        const htmlDoc = mustache.render(htmlIndexTemplateContent, {
          ...indexFeed,
          body,
          CSS,
        });

        const htmlPath = path.join(
          getPublicPath(),
          isDay ? "index.html" : "week/index.html",
        );
        await writeTextFile(htmlPath, htmlDoc);

        // build feed json
        const feedJsonDistPath = path.join(
          getPublicPath(),
          isDay ? "feed.json" : `week/feed.json`,
        );
        const finalFeed = {
          ...indexFeed,
          items: jsonFeedItemsByDate,
        };

        await writeJSONFile(feedJsonDistPath, finalFeed);
        // build rss
        // @ts-ignore: node modules
        const feedOutput = jsonfeedToAtom(finalFeed, {
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
    // write dbMeta
    dbMeta.checked_at = new Date().toISOString();
  }
  writeDbMeta(dbMeta);
}

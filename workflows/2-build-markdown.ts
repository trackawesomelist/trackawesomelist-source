import { groupBy, mustache } from "../deps.ts";
import { fs, path } from "../deps.ts";
import parsers from "../parsers/mod.ts";
import {
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

export default async function buildMarkdown(options: RunOptions) {
  const config = options.config;
  const sourcesConfig = config.sources;
  // is any updates
  const allUpdatedFiles: string[] = [];
  for await (const file of await walkFile(getDataItemsPath())) {
    allUpdatedFiles.push(file.path);
  }

  if (allUpdatedFiles.length > 0) {
    log.info(`found ${allUpdatedFiles.length} updated files`);
    const dbMeta = await getDbMeta();
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
      const parsedFile = parseItemsFilepath(file);
      const sourceIdentifier = parsedFile.sourceIdentifier;
      const originalFilepath = parsedFile.originalFilepath;
      const sourceConfig = sourcesConfig[sourceIdentifier];
      const sourceFileConfig = sourceConfig.files[originalFilepath];
      commitMessage += `${sourceIdentifier}/${originalFilepath}\n`;
      // get items
      const itemsJson = await readJSONFile<ItemsJson>(file);
      const items = itemsJson.items;
      const pageData: PageData = {
        groups: [],
      };

      const allItems: PageItem[] = [];
      for (const itemMarkdown of Object.keys(items)) {
        const item = items[itemMarkdown];
        allItems.push({
          markdown: itemMarkdown,
          updated_at: item.updated_at,
          updated_day_on: getUTCDay(new Date(item.updated_at)),
          category: item.category,
        });
      }
      const groups = groupBy(allItems, "updated_day_on") as Record<
        string,
        PageCategoryItem[]
      >;
      const groupKeys = Object.keys(groups);
      // sort
      groupKeys.sort((a: string, b: string) => {
        return new Date(b).getTime() - new Date(a).getTime();
      });
      pageData.groups = groupKeys.map((key) => {
        const items = groups[key];
        const categoryGroup = groupBy(items, "category") as Record<
          string,
          PageItem[]
        >;

        const categoryKeys = Object.keys(categoryGroup);
        categoryKeys.sort((a: string, b: string) => {
          return new Date(b).getTime() - new Date(a).getTime();
        });
        const categoryItems: PageCategoryItem[] = categoryKeys.map((key) => {
          return {
            category: key,
            items: categoryGroup[key],
          };
        });
        return {
          updated_day_on: key,
          items: categoryItems,
        };
      });

      let dailyMarkdownRelativePath = INDEX_MARKDOWN_PATH;
      if (!sourceFileConfig.index) {
        dailyMarkdownRelativePath = originalFilepath;
      }
      // build daily markdown
      // sort
      const dailyMarkdownPath = path.join(
        distRepoPath,
        sourceIdentifier,
        dailyMarkdownRelativePath,
      );
      const itemMarkdownContentRendered = mustache.render(
        dayTemplateContent,
        pageData,
      );
      await writeTextFile(dailyMarkdownPath, itemMarkdownContentRendered);
      log.info(`build ${dailyMarkdownPath} success`);
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
      return {
        name: item.sourceIdentifier + "/" + sourceFileConfig.name,
        url: sourceFileConfig.pathname,
      };
    });
    console.log("recentlyUpdated", recentlyUpdated);
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
    console.log("itemMarkdownContentRendered", itemMarkdownContentRendered);
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

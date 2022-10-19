import {
  DBIndex,
  DBMeta,
  FileInfo,
  Item,
  RepoMetaOverride,
  RunOptions,
  Source,
} from "./interface.ts";

import Github from "./adapters/github.ts";
import {
  exists,
  getCachePath,
  getDayNumber,
  getDbMeta,
  getWeekNumber,
  readTextFile,
  sha1,
  writeDbMeta,
} from "./util.ts";
import log from "./log.ts";
import { DB, fs, path } from "./deps.ts";
import parser from "./parser/mod.ts";
import getGitBlame from "./get-git-blame.ts";
import { updateFile, updateItems } from "./db.ts";
export default async function initItems(
  source: Source,
  options: RunOptions,
  dbMeta: DBMeta,
  dbIndex: DBIndex,
) {
  // first get repo meta info from api
  const api = new Github(source);
  const metaOverrides: RepoMetaOverride = {};
  if (source.default_branch) {
    metaOverrides.default_branch = source.default_branch;
  }
  const meta = await api.getRepoMeta(metaOverrides);
  const sources = dbMeta.sources;
  //check repo folder is empty
  const repoPath = path.join(getCachePath(), "repos", source.identifier);

  const isExist = await exists(repoPath);
  log.debug(`repo ${repoPath} exist cache, try to pull updates`);

  // then git clone the entire repo, and parse the files
  if (isExist) {
    // try to update
    if (options.fetchRepoUpdates) {
      const args: string[] = [
        "--work-tree",
        repoPath,
        "--git-dir",
        path.join(repoPath, ".git"),
      ];

      const p = Deno.run({
        cmd: ["git"].concat(args).concat(["pull"]),
      });
      await p.status();
    }
  } else {
    // ensure parent folder exists
    await fs.ensureDir(path.dirname(repoPath));
    log.info(`cloning ${api.getCloneUrl()} to ${repoPath}`);
    // try to clone
    const p = Deno.run({
      cmd: [
        "git",
        "clone",
        "-b",
        meta.default_branch,
        api.getCloneUrl(),
        repoPath,
      ],
    });
    await p.status();
  }
  const now = new Date();
  sources[source.identifier] = sources[source.identifier] || {
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    meta,
    files: {},
  };

  for (const file of Object.keys(source.files)) {
    const fileConfig = source.files[file];
    const blameInfoMap = await getGitBlame(file, {
      workTree: repoPath,
      gitDir: path.join(repoPath, ".git"),
    });
    const items: Record<string, Item> = {};
    const cachedFilePath = path.join(repoPath, file);
    const content = await readTextFile(cachedFilePath);
    const fileInfo: FileInfo = {
      sourceConfig: source,
      sourceMeta: sources[source.identifier],
      filepath: file,
    };
    const docItems = await parser(content, fileInfo);
    // console.log("docItems", docItems);
    let latestUpdatedAt = new Date(0);
    for (const docItem of docItems) {
      const now = new Date();
      const commitInfo = blameInfoMap.get(docItem.line);
      if (commitInfo) {
        const itemSha1 = await sha1(docItem.rawMarkdown);
        const commitTime = commitInfo.committerTime;
        const commitDate = new Date(Number(commitTime) * 1000);
        const updatedAt = commitDate.toISOString();
        items[itemSha1] = {
          category: docItem.category,
          updated_at: updatedAt,
          source_identifier: source.identifier,
          file,
          markdown: docItem.formatedMarkdown,
          sha1: itemSha1,
          checked_at: now.toISOString(),
          updated_day: getDayNumber(new Date(updatedAt)),
          updated_week: getWeekNumber(new Date(updatedAt)),
        };
        if (commitDate.getTime() > latestUpdatedAt.getTime()) {
          latestUpdatedAt = commitDate;
        }
      } else {
        throw new Error(
          `no commit info for ${source.identifier} ${file} ${docItem.line}`,
        );
      }
    }
    const contentSha1 = await sha1(content);
    // try to get items updated time
    // get created time and updated time from blameinfo
    let createdAt = now;
    for (const blame of blameInfoMap.values()) {
      const commitTime = blame.committerTime;
      const commitDate = new Date(Number(commitTime) * 1000);
      if (commitDate < createdAt) {
        createdAt = commitDate;
      }
    }

    sources[source.identifier].files[file] = {
      sha1: contentSha1,
      updated_at: latestUpdatedAt.toISOString(),
      meta_created_at: now.toISOString(),
      created_at: createdAt.toISOString(),
      checked_at: now.toISOString(),
    };
    //write to file
    // await writeJSONFile(formatedPath, itemsJson);
    // write to db

    await updateFile(fileInfo, content);
    await updateItems(fileInfo, items, dbIndex);

    log.info(
      `init ${source.identifier}/${file} success, total ${
        Object.keys(items).length
      } items`,
    );
  }
  dbMeta.sources = sources;
}

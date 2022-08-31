import { Item, ItemsJson, Source } from "./interface.ts";
import Github from "./adapters/github.ts";
import {
  exists,
  getCachePath,
  getDbMeta,
  getItemsFilePath,
  readTextFile,
  sha1,
  writeDbMeta,
  writeJSONFile,
} from "./util.ts";
import log from "./log.ts";
import { fs, path } from "./deps.ts";
import parsers from "./parsers/mod.ts";
import getGitBlame from "./get-git-blame.ts";
export default async function initItems(source: Source) {
  // first get repo meta info from api
  const api = new Github(source);
  const meta = await api.getRepoMeta();
  const dbMeta = await getDbMeta();
  const sources = dbMeta.sources;
  //check repo folder is empty
  const repoPath = path.join(getCachePath(), "repos", source.identifier);

  const isExist = await exists(repoPath);

  // then git clone the entire repo, and parse the files
  if (isExist) {
    // try to update
    await Deno.run({
      cmd: ["git", "pull"],
    });
  } else {
    // ensure parent folder exists
    await fs.ensureDir(path.dirname(repoPath));
    log.info(`cloning ${api.getCloneUrl()} to ${repoPath}`);
    // try to clone
    const p = Deno.run({
      cmd: ["git", "clone", api.getCloneUrl(), repoPath],
    });
    await p.status();
  }
  const now = new Date();
  sources[source.identifier] = {
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    meta,
    files: {},
  };

  for (const fileObj of source.file) {
    const file = fileObj.path;
    const type = fileObj.type;
    const blameInfoMap = await getGitBlame(file, {
      workTree: repoPath,
      gitDir: path.join(repoPath, ".git"),
    });
    const items: Record<string, Item> = {};
    const cachedFilePath = path.join(repoPath, file);
    const content = await readTextFile(cachedFilePath);
    const docItems = await parsers[type](content);
    for (const docItem of docItems) {
      const commitInfo = blameInfoMap.get(docItem.line);
      if (commitInfo) {
        const commitTime = commitInfo.committerTime;
        const commitDate = new Date(Number(commitTime) * 1000);
        const updatedAt = commitDate.toISOString();
        items[docItem.markdown] = {
          category: docItem.category,
          updated: updatedAt,
        };
      } else {
        throw new Error(
          `no commit info for ${source.identifier} ${file} ${docItem.line}`,
        );
      }
    }
    const contentSha1 = await sha1(content);
    const now = new Date();
    // try to get items updated time
    const itemsJson: ItemsJson = {
      items: items,
    };
    const formatedPath = getItemsFilePath(source.identifier, file);
    // get created time and updated time from blameinfo
    let createdAt = now;
    let updatedAt = now;
    for (const blame of blameInfoMap.values()) {
      const commitTime = blame.committerTime;
      const commitDate = new Date(Number(commitTime) * 1000);
      if (commitDate < createdAt) {
        createdAt = commitDate;
      }
      if (commitDate > updatedAt) {
        updatedAt = commitDate;
      }
    }

    sources[source.identifier].files[file] = {
      sha1: contentSha1,
      updated_at: now.toISOString(),
      created_at: now.toISOString(),
      original_created_at: createdAt.toISOString(),
      checked_at: now.toISOString(),
    };
    //write to file
    await writeJSONFile(formatedPath, itemsJson);
    log.info(`init ${formatedPath} success`);
  }
  dbMeta.sources = sources;
  await writeDbMeta(dbMeta);
}

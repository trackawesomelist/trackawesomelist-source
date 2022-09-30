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
import { DB, fs, path } from "./deps.ts";
import parsers from "./parsers/mod.ts";
import getGitBlame from "./get-git-blame.ts";
import { updateItems } from "./db.ts";
export default async function initItems(db: DB, source: Source) {
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
    const p = Deno.run({
      cmd: ["git", "pull"],
    });
    await p.status();
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

  for (const file of Object.keys(source.files)) {
    const type = source.files[file].type;
    const blameInfoMap = await getGitBlame(file, {
      workTree: repoPath,
      gitDir: path.join(repoPath, ".git"),
    });
    const items: Record<string, Item> = {};
    const cachedFilePath = path.join(repoPath, file);
    const content = await readTextFile(cachedFilePath);
    const docItems = await parsers[type](content);
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
        };
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
      document_created_at: createdAt.toISOString(),
      checked_at: now.toISOString(),
    };
    //write to file
    // await writeJSONFile(formatedPath, itemsJson);
    // write to db
    updateItems(db, source.identifier, file, items);

    log.info(
      `init ${source.identifier}/${file} success, total ${
        Object.keys(items).length
      } items`,
    );
  }
  dbMeta.sources = sources;
  dbMeta.checked_at = now.toISOString();
  await writeDbMeta(dbMeta);
}

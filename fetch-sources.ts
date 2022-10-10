import {
  getDbMeta,
  getItemsFilePath,
  sha1,
  writeDbMeta,
  writeJSONFile,
} from "./util.ts";
import parser from "./parser/mod.ts";
import log from "./log.ts";
import { FileInfo, Item, ItemsJson, RunOptions } from "./interface.ts";
import initItems from "./init-items.ts";
import Github from "./adapters/github.ts";
import { getItems, updateItems } from "./db.ts";
export default async function (options: RunOptions) {
  const sourceIdentifiers = options.sourceIdentifiers;
  const force = options.force;
  const config = options.config;
  const file_min_updated_hours = config.file_min_updated_hours;
  const sourcesMap = config.sources;
  const dbMeta = await getDbMeta();
  const dbSources = dbMeta.sources;
  const db = options.db;

  let sourceIndex = 0;
  for (const sourceIdentifier of sourceIdentifiers) {
    sourceIndex++;
    const source = sourcesMap[sourceIdentifier];
    const files = source.files;

    if (!dbSources[sourceIdentifier]) {
      // need to init source
      await initItems(db, source);
      continue;
    } else {
      // check is all files is init
      const dbSource = dbSources[sourceIdentifier];
      const dbFiles = dbSource.files;
      const dbFileKeys = Object.keys(dbFiles);
      const isAllFilesInit = Object.keys(files).every((file) => {
        return dbFileKeys.includes(file);
      });
      if (!isAllFilesInit) {
        // need to init source
        await initItems(db, source);
        continue;
      }
    }

    const dbSource = dbSources[sourceIdentifier];
    const dbFiles = dbSource.files;
    const api = new Github(source);

    // get file content and save it to raw data path
    for (const file of Object.keys(files)) {
      const dbFileMeta = dbFiles[file];
      const fileConfig = files[file];
      if (!dbFileMeta) {
        // reinit items
        await initItems(db, source);

        break;
      }

      // check is updated

      const dbFileUpdated = new Date(dbFileMeta.checked_at);

      const now = new Date();
      const diff = now.getTime() - dbFileUpdated.getTime();

      if (!force && diff / 1000 / 60 / 60 < file_min_updated_hours) {
        // add max number function
        // not updated
        log.info(
          `${sourceIdentifier}/${file} updated less than ${file_min_updated_hours} hours, skip`,
        );
        continue;
      } else if (!force) {
        log.info(
          `${sourceIdentifier}/${file} updated less than ${file_min_updated_hours} hours, force update`,
        );
      }
      log.info(
        `${sourceIndex}/${sourceIdentifiers.length} try updating ${sourceIdentifier}/${file}`,
      );
      const content = await api.getConent(file);
      const contentSha1 = await sha1(content);
      const dbFileSha1 = dbFileMeta.sha1;
      log.debug(
        "dbFileSha1",
        dbFileSha1,
        "latest file contentSha1",
        contentSha1,
      );

      if (dbFileSha1 === contentSha1 && !force) {
        log.info(`${file} is up to date, cause sha1 is same`);
        continue;
      } else {
        const items = await getItems(db, sourceIdentifier, file);
        const fileInfo: FileInfo = {
          sourceConfig: source,
          filepath: file,
          sourceMeta: dbSource,
        };

        const docItems = await parser(content, fileInfo);
        //compare updated items
        const newItems: Record<string, Item> = {};
        let newCount = 0;
        let totalCount = 0;
        let updatedAt = new Date(0);

        for (const docItem of docItems) {
          const itemSha1 = await sha1(docItem.rawMarkdown);
          totalCount++;
          // check markdown
          if (items[itemSha1]) {
            // it's a old item,
            // stay the same
            newItems[itemSha1] = items[itemSha1];
            if (new Date(items[itemSha1].updated_at) > updatedAt) {
              updatedAt = new Date(items[itemSha1].updated_at);
            }
          } else {
            newCount++;
            const now = new Date();
            // yes
            // this is a new item
            // add it to items
            newItems[itemSha1] = {
              source_identifier: sourceIdentifier,
              file,
              sha1: itemSha1,
              markdown: docItem.formatedMarkdown,
              category: docItem.category,
              updated_at: now.toISOString(),
              checked_at: now.toISOString(),
            };
            if (now > updatedAt) {
              updatedAt = now;
            }
          }
        }

        updateItems(db, fileInfo, newItems);

        dbFiles[file] = {
          ...dbFiles[file],
          updated_at: updatedAt.toISOString(),
          checked_at: now.toISOString(),
          sha1: contentSha1,
        };
        log.info(
          `${sourceIndex}/${sourceIdentifiers.length} ${sourceIdentifier}/${file} updated, ${newCount} new items, ${totalCount} total items`,
        );
      }
    }
    dbMeta.sources[sourceIdentifier].files = dbFiles;
    dbMeta.sources[sourceIdentifier].updated_at = new Date().toISOString();
    dbMeta.checked_at = new Date().toISOString();
    // write to dbMeta
    await writeDbMeta(dbMeta);
  }
}

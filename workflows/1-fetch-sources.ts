import { path } from "../deps.ts";
import {
  exists,
  getDataItemsPath,
  getDataRawPath,
  getDbItemsJson,
  getDbMeta,
  getItemsFilePath,
  readJSONFile,
  readTextFile,
  sha1,
  writeDbMeta,
  writeJSONFile,
  writeTextFile,
} from "../util.ts";
import parsers from "../parsers/mod.ts";

import log from "../log.ts";
import { Item, ItemsJson, RunOptions } from "../interface.ts";
import initItems from "../init-items.ts";
import Github from "../adapters/github.ts";
export default async function (options: RunOptions) {
  const sourceIdentifiers = options.sourceIdentifiers;
  const force = options.force;
  const config = options.config;
  const file_min_updated_hours = config.file_min_updated_hours;
  const sourcesMap = config.sources;
  const dbMeta = await getDbMeta();
  const dbSources = dbMeta.sources;

  let sourceIndex = 0;
  for (const sourceIdentifier of sourceIdentifiers) {
    sourceIndex++;
    const source = sourcesMap[sourceIdentifier];
    const files = source.file;

    if (!dbSources[sourceIdentifier]) {
      // need to init source
      await initItems(source);
      continue;
    }

    const dbSource = dbSources[sourceIdentifier];
    const dbFiles = dbSource.files;
    const api = new Github(source);

    // get file content and save it to raw data path
    for (const file of files) {
      const dbFileMeta = dbFiles[file.path];
      if (!dbFileMeta) {
        // reinit items
        await initItems(source);

        break;
      }

      // check is updated

      const dbFileUpdated = new Date(dbFileMeta.checked_at);

      const now = new Date();
      const diff = now.getTime() - dbFileUpdated.getTime();

      if (!force && diff / 1000 / 60 / 60 < file_min_updated_hours) {
        // not updated
        log.info(
          `${file.path} updated less than ${file_min_updated_hours} hours, skip`,
        );
        continue;
      } else if (!force) {
        log.info(
          `${file.path} updated less than ${file_min_updated_hours} hours, force update`,
        );
      }
      log.info(
        `${sourceIndex}/${sourceIdentifiers.length} try updating ${file.path}`,
      );

      const content = await api.getConent(file.path);
      const contentSha1 = await sha1(content);
      const dbFileSha1 = dbFileMeta.sha1;

      if (dbFileSha1 === contentSha1) {
        log.info(`${file.path} is up to date, cause sha1 is same`);
        continue;
      } else {
        const itemsJson = await getDbItemsJson(sourceIdentifier, file.path);

        const items = itemsJson.items;
        const docItems = await parsers[file.type](content);
        // compare updated items
        const newItems: Record<string, Item> = {};
        let newCount = 0;
        let totalCount = 0;

        for (const docItem of docItems) {
          totalCount++;
          // check markdown
          if (items[docItem.markdown]) {
            // it's a old item,
            // stay the same
            newItems[docItem.markdown] = items[docItem.markdown];
          } else {
            newCount++;

            // yes
            // this is a new item
            // add it to items
            newItems[docItem.markdown] = {
              category: docItem.category,
              updated: new Date().toISOString(),
            };
          }
        }

        // write to file
        const newItemsJson: ItemsJson = {
          ...itemsJson,
          items: newItems,
        };
        await writeJSONFile(
          getItemsFilePath(sourceIdentifier, file.path),
          newItemsJson,
        );

        dbFiles[file.path] = {
          ...dbFiles[file.path],
          updated_at: now.toISOString(),
          checked_at: now.toISOString(),
          sha1: contentSha1,
        };
        log.info(
          `${sourceIndex}/${sourceIdentifiers.length} ${file.path} updated, ${newCount} new items, ${totalCount} total items`,
        );
      }
    }
    dbMeta.sources[sourceIdentifier].files = dbFiles;
    dbMeta.sources[sourceIdentifier].updated_at = new Date().toISOString();
    // write to dbMeta
    await writeDbMeta(dbMeta);
  }
}

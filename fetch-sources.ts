import {
  getDayNumber,
  getDbIndex,
  getDbMeta,
  getWeekNumber,
  sha1,
  writeDbIndex,
  writeDbMeta,
  writeJSONFile,
} from "./util.ts";
import parser from "./parser/mod.ts";
import log from "./log.ts";
import {
  FileInfo,
  Item,
  ParsedItemsFilePath,
  RepoMetaOverride,
  RunOptions,
} from "./interface.ts";
import initItems from "./init-items.ts";
import Github from "./adapters/github.ts";
import { getItems, updateFile, updateItems } from "./db.ts";
import renderMarkdown from "./render-markdown.ts";
export default async function (options: RunOptions) {
  const force = options.forceFetch;
  const isRebuild = options.rebuild;
  const config = options.config;
  const file_min_updated_hours = config.file_min_updated_hours;
  const sourcesMap = config.sources;
  let sourceIdentifiers = options.sourceIdentifiers;
  let isSpecificSource = true;
  if (sourceIdentifiers.length === 0) {
    isSpecificSource = false;
    sourceIdentifiers = Object.keys(sourcesMap);
  }
  // limit
  const limit = options.limit;
  if (limit && limit > 0) {
    sourceIdentifiers = sourceIdentifiers.slice(0, limit);
  }
  const dbMeta = await getDbMeta();
  const dbIndex = await getDbIndex();
  const dbSources = dbMeta.sources;

  const invalidFiles: ParsedItemsFilePath[] = [];
  let sourceIndex = 0;

  try {
    for (const sourceIdentifier of sourceIdentifiers) {
      sourceIndex++;
      log.info(
        `[${sourceIndex}/${sourceIdentifiers.length}] Fetching source: ${sourceIdentifier}`,
      );
      const source = sourcesMap[sourceIdentifier];
      const files = source.files;

      if (!dbSources[sourceIdentifier] || (isSpecificSource && isRebuild)) {
        // need to init source
        await initItems(source, options, dbMeta, dbIndex);
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
          await initItems(source, options, dbMeta, dbIndex);
          continue;
        }
      }

      const dbSource = dbSources[sourceIdentifier];
      const dbFiles = dbSource.files;
      const api = new Github(source);
      const fileKeys = Object.keys(files);
      let fileIndex = 0;
      // get file content and save it to raw data path
      for (const file of fileKeys) {
        fileIndex++;
        const dbFileMeta = dbFiles[file];
        if (!dbFileMeta) {
          // reinit items
          await initItems(source, options, dbMeta, dbIndex);

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
            `${fileIndex}/${fileKeys.length}${sourceIdentifier}/${file} updated less than ${file_min_updated_hours} hours, skip`,
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
          let items: Record<string, Item> = {};
          try {
            items = await getItems(sourceIdentifier, file);
          } catch (e) {
            log.warn(`get items error`, e);
            // try to reinit
            await initItems(source, options, dbMeta, dbIndex);
            continue;
          }
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
          let fileUpdatedAt = new Date(0);

          for (const docItem of docItems) {
            const itemSha1 = await sha1(docItem.rawMarkdown);
            totalCount++;
            // check markdown
            if (items[itemSha1]) {
              // it's a old item,
              // stay the same
              newItems[itemSha1] = {
                source_identifier: sourceIdentifier,
                file,
                sha1: itemSha1,
                markdown: docItem.formatedMarkdown,
                html: renderMarkdown(docItem.formatedMarkdown),
                category: docItem.category,
                category_html: renderMarkdown(docItem.category),
                updated_at: items[itemSha1].updated_at,
                checked_at: now.toISOString(),
                updated_day: items[itemSha1].updated_day,
                updated_week: items[itemSha1].updated_week,
              };
              if (new Date(items[itemSha1].updated_at) > fileUpdatedAt) {
                fileUpdatedAt = new Date(items[itemSha1].updated_at);
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
                html: renderMarkdown(docItem.formatedMarkdown),
                category: docItem.category,
                category_html: renderMarkdown(docItem.category),
                updated_at: now.toISOString(),
                checked_at: now.toISOString(),
                updated_day: getDayNumber(now),
                updated_week: getWeekNumber(now),
              };
              if (now > fileUpdatedAt) {
                fileUpdatedAt = now;
              }
            }
          }

          await updateFile(fileInfo, content);
          await updateItems(fileInfo, newItems, dbIndex);

          dbFiles[file] = {
            ...dbFiles[file],
            updated_at: fileUpdatedAt.toISOString(),
            checked_at: now.toISOString(),
            sha1: contentSha1,
          };
          log.info(
            `${sourceIndex}/${sourceIdentifiers.length} ${sourceIdentifier}/${file} updated, ${newCount} new items, ${totalCount} total items`,
          );
          if (totalCount < 10) {
            invalidFiles.push({
              sourceIdentifier,
              originalFilepath: file,
            });
          }
          // if total count is 0, print it``
          // also update repoMeta

          const metaOverrides: RepoMetaOverride = {};
          if (source.default_branch) {
            metaOverrides.default_branch = source.default_branch;
          }
          const meta = await api.getRepoMeta(metaOverrides);
          dbSource.meta = meta;
          dbMeta.sources[sourceIdentifier].meta = {
            ...dbSource.meta,
            ...meta,
          };
        }
      }
      dbMeta.sources[sourceIdentifier].files = dbFiles;
      dbMeta.sources[sourceIdentifier].updated_at = new Date().toISOString();
    }
    // write to dbMeta
    await writeDbMeta(dbMeta);
    await writeDbIndex(dbIndex);
  } catch (e) {
    // write to dbMeta
    await writeDbMeta(dbMeta);
    await writeDbIndex(dbIndex);
    throw e;
  }
  if (invalidFiles.length > 0) {
    log.error(`Some files is invalid, please check it manually`);
    log.error(invalidFiles);
    await writeJSONFile("temp-invalid-files.json", invalidFiles);
  }
}

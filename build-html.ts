import { CSS, mustache, path, serve, serveFile } from "./deps.ts";
import {
  getDbMeta,
  getDistPath,
  getDistRepoPath,
  getPublicPath,
  readTextFile,
  urlToFilePath,
  walkFile,
  writeTextFile,
} from "./util.ts";
import log from "./log.ts";
import { File, FileInfo, RunOptions } from "./interface.ts";
import render from "./render-markdown.ts";
import { INDEX_MARKDOWN_PATH } from "./constant.ts";
import { getUpdatedFiles } from "./db.ts";
export default async function buildHtmlFile(
  sourceFilePath: string,
  htmlTemplate: string,
) {
  // const originalFilepath = fileInfo.filepath;
  // const sourceMeta = fileInfo.sourceMeta;
  // const sourceConfig = fileInfo.sourceConfig;
  // const sourceIdentifier = sourceConfig.identifier;
  const finalPath = path.join(
    sourceFilePath,
  );
  const fileRelativePath = path.relative(getDistRepoPath(), finalPath);
  try {
    const fileContent = await readTextFile(finalPath);
    const body = render(fileContent);
    const htmlContent = mustache.render(htmlTemplate, { CSS, body });
    // write html Content

    const htmlPath = path.join(
      getPublicPath(),
      fileRelativePath.replace(/README\.md$/, "index.html"),
    );
    await writeTextFile(htmlPath, htmlContent);
    log.info(`build html file success: ${htmlPath}`);
  } catch (e) {
    log.error(`Can not found file ${fileRelativePath}`);
    throw e;
  }
}

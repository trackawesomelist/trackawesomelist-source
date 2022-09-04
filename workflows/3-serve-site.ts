import { CSS, mustache, path, render, serve, serveFile } from "../deps.ts";

import {
  getDistPath,
  getDistRepoPath,
  readTextFile,
  urlToFilePath,
} from "../util.ts";
import log from "../log.ts";
import { RunOptions } from "../interface.ts";
export default async function serveSite(runOptions: RunOptions) {
  const port = runOptions.port;
  const BASE_PATH = getDistRepoPath();
  const htmlTemplate = await readTextFile("./templates/index.html.mu");
  const handler = async (request: Request): Promise<Response> => {
    const filepath = urlToFilePath(request.url);
    const localPath = BASE_PATH + "/" + filepath;
    // check if file exists
    let finalPath: string | undefined;
    try {
      const fileInfo = Deno.statSync(localPath);
      if (fileInfo.isFile) {
        finalPath = localPath;
      }
    } catch (e) {
      log.warn(e);
    }
    if (finalPath) {
      const fileContent = await readTextFile(finalPath);
      log.debug(`serving file: ${finalPath}`);
      const body = render(fileContent, { allowIframes: true });
      const htmlContent = mustache.render(htmlTemplate, { CSS, body });
      return new Response(htmlContent, {
        status: 200,
        headers: {
          "content-type": "text/html",
        },
      });
    } else {
      return Promise.resolve(new Response("Not Found", { status: 404 }));
    }
  };
  log.info(
    `HTTP webserver running. Access it at: http://localhost:${port}/`,
  );
  serve(handler, { port });
}

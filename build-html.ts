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
  INDEX_MARKDOWN_PATH,
  SUBSCRIPTION_URL,
  TOP_REPOS_COUNT,
} from "./constant.ts";
import {
  exists,
  formatHumanTime,
  getBaseFeed,
  getDayNumber,
  getDbIndex,
  getDbMeta,
  getDistRepoContentPath,
  getDistRepoGitUrl,
  getDistRepoPath,
  getIndexFileConfig,
  getnextPaginationTextByNumber,
  getPaginationTextByNumber,
  getPublicPath,
  getRepoHTMLURL,
  getStaticPath,
  getWeekNumber,
  pathnameToFeedUrl,
  pathnameToFilePath,
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

export default async function buildHtml(options: RunOptions) {
  const config = options.config;
  const sourcesConfig = config.sources;
  const sourcesKeys = Object.keys(sourcesConfig);
  const isBuildSite = options.html;
  const specificSourceIdentifiers = options.sourceIdentifiers;

  if (isBuildSite) {
    const htmlIndexTemplateContent = await readTextFile(
      "./templates/index.html.mu",
    );
    // build from markdown
    const markdownPath = getDistRepoContentPath();

    for await (const entry of await walkFile(markdownPath)) {
      const { path: filePath, isFile } = entry;
      if (isFile && filePath.endsWith(".md")) {
        const relativePath = path.relative(path.join(markdownPath), filePath);
        const file = await readTextFile(filePath);
        const html = renderMarkdown(file);
        const htmlPath = path.join(
          getPublicPath(),
          relativePath.replace(/README\.md$/, "index.html"),
        );
        // const htmlDoc = mustache.render(htmlIndexTemplateContent, {
        //   ...indexFeed,
        //   body: html,
        //   CSS,
        // });
        await writeTextFile(htmlPath, html);
      }
    }
  } else {
    log.info("skip build html...");
  }
}

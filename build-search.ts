import { fs, mustache, path } from "./deps.ts";
import {
  getConfig,
  getPublicPath,
  readTextFile,
  writeTextFile,
} from "./util.ts";
import { RunOptions } from "./interface.ts";
export default async function buildSearch(runOptions: RunOptions) {
  const config = runOptions.config;
  const sourcesConfig = config.sources;
  const siteConfig = config.site;
  const htmlSearchTemplateContent = await readTextFile(
    "./templates/search.html.mu",
  );
  // copy search index
  await fs.copy(
    "./temp-morsels/",
    path.join(getPublicPath(), "search-index/"),
    {
      overwrite: true,
    },
  );
  const searchPageData = {
    title: "Search Awesome Projects",
    _site_title: siteConfig.title,
    description: config.site.description,
    _seo_title: `Search Awesome Projects - ${config.site.title}`,
    home_page_url: config.site.url + "/search/",
  };
  const searchHtmlDoc = mustache.render(
    htmlSearchTemplateContent,
    searchPageData,
  );

  const htmlSearchPath = path.join(
    getPublicPath(),
    "search/index.html",
  );
  await writeTextFile(htmlSearchPath, searchHtmlDoc);
}

if (import.meta.main) {
  const config = await getConfig();

  await buildSearch({
    config,
    sourceIdentifiers: [],
    fetchRepoUpdates: false,
    markdown: false,
    fetch: false,
    dayMarkdown: false,
    serve: false,
    port: 8000,
  });
}

import { getConfig, gotWithCache } from "../util.ts";
import { PROD_DOMAIN } from "../constant.ts";

async function check() {
  const config = await getConfig();
  const sources = config.sources;
  const sourcesKeys = Object.keys(sources);
  for (const siteIdentifier of sourcesKeys) {
    const site = sources[siteIdentifier];
    const files = site.files;
    const filesKeys = Object.keys(files);
    for (const fileIdentifier of filesKeys) {
      const file = files[fileIdentifier];
      const url = new URL(file.pathname, PROD_DOMAIN);
      try {
        const response = await gotWithCache(url.href, {});
        console.log("ok", url.href);
      } catch (e) {
        const ignored = ["PatrickJS/awesome-angular"];
        if (ignored.includes(file.pathname.slice(1, -1))) {
          console.warn(`ignored ${url.href}`);
          continue;
        }

        console.log(`Error: ${url}`);
        throw e;
      }
    }
  }
}

if (import.meta.main) {
  await check();
}

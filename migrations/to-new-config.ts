import oldMeta from "./old-meta.json" assert { type: "json" };
import { YAML } from "../deps.ts";
import { Config, RawSource } from "../interface.ts";
import { DEFAULT_CATEGORY } from "../constant.ts";
export function migrate() {
  const awesomelist = oldMeta.awesomeList;
  const sources: Record<string, RawSource> = {};
  const newConfig = YAML.parse(Deno.readTextFileSync("./config.yml")) as Config;
  const newSources = newConfig.sources;
  for (const repo of awesomelist) {
    const source: RawSource = {
      category: repo.category,
      default_branch: repo.defaultBranch,
      files: {
        [repo.readmePath]: {
          index: true,
        },
      },
    };
    sources[repo.repo] = source;
  }
  const mergedSources = {
    ...sources,
    ...newSources,
  };

  //resort the sources keys, by category
  const sortedSources = Object.fromEntries(
    Object.entries(mergedSources).sort((a, b) => {
      const aCategory = a[1]?.category || DEFAULT_CATEGORY;
      const bCategory = b[1]?.category || DEFAULT_CATEGORY;
      if (aCategory > bCategory) {
        return 1;
      } else if (aCategory < bCategory) {
        return -1;
      } else {
        return 0;
      }
    }),
  );

  const yamlSource = YAML.stringify({
    sources: sortedSources,
  });
  Deno.writeTextFileSync("./temp-config.yml", yamlSource);
}

if (import.meta.main) {
  migrate();
}

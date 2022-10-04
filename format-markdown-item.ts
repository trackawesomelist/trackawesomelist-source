import { DocItem, FileInfo } from "./interface.ts";
import { Content, Link, Root, toMarkdown, visit } from "./deps.ts";

import {
  childrenToMarkdown,
  childrenToRoot,
  gotGithubStar,
  isMock,
  promiseLimit,
} from "./util.ts";
import log from "./log.ts";
const GithubSpecialOwner = [
  "marketplace",
  "help",
  "blog",
  "about",
  "explore",
  "topics",
  "issues",
  "pulls",
  "notifications",
  "settings",
  "new",
  "organizations",
  "repositories",
  "packages",
  "people",
  "dashboard",
  "projects",
  "stars",
  "gists",
  "security",
  "marketplace",
  "pricing",
  "customer-stories",
  "nonprofit",
  "education",
  "nonprofit",
  "education",
  "enterprise",
  "login",
  "join",
  "watching",
  "new",
  "integrations",
  "marketplace",
  "pricing",
  "customer-stories",
  "nonprofit",
  "education",
  "nonprofit",
  "education",
  "enterprise",
  "login",
  "join",
  "watching",
  "new",
  "integrations",
  "marketplace",
  "pricing",
  "customer-stories",
  "nonprofit",
  "education",
  "nonprofit",
  "education",
  "enterprise",
  "login",
  "join",
  "watching",
  "new",
  "integrations",
  "marketplace",
  "pricing",
  "customer-stories",
  "nonprofit",
  "education",
  "nonprofit",
  "education",
  "enterprise",
  "login",
  "join",
  "watching",
  "new",
  "integrations",
  "marketplace",
  "pricing",
  "customer-stories",
  "nonprofit",
  "education",
  "nonprofit",
  "education",
  "enterprise",
  "login",
  "join",
  "watching",
  "new",
  "integrations",
  "marketplace",
  "pricing",
  "customer-stories",
  "nonprofit",
  "education",
  "nonprofit",
  "education",
  "enterprise",
  "login",
  "join",
  "watching",
  "new",
  "integrations",
  "marketplace",
  "pricing",
  "customer-stories",
  "nonprofit",
  "education",
  "nonprofit",
  "education",
  "enterprise",
  "login",
  "join",
  "watching",
  "new",
  "integrations",
  "marketplace",
  "pricing",
  "customer-stories",
  "nonprofit",
  "education",
  "nonprofit",
  "education",
  "enterprise",
  "login",
  "join",
  "watching",
  "new",
  "integrations",
  "marketplace",
  "pricing",
  "customer-stories",
  "nonprofit",
  "education",
  "nonprofit",
  "education",
  "enterprise",
  "login",
  "join",
  "watching",
  "new",
  "integrations",
  "marketplace",
  "pricing",
  "customer-stories",
  "nonprofit",
  "education",
  "nonprofit",
  "education",
  "enterprise",
  "login",
  "join",
  "watching",
  "new",
  "integrations",
  "marketplace",
  "pricing",
  "features",
];
export interface MatchedNode {
  node: Link;
  meta: Record<string, string>;
}
export default async function formatItemMarkdown<T>(
  item: Content | Root,
  fileInfo: FileInfo,
): Promise<Content | Root> {
  const fileConfig = fileInfo.fileConfig;
  const repoMeta = fileInfo.repoMeta;
  const repoUrl = repoMeta.url;
  const defaultBranch = repoMeta.default_branch;
  const { options, filepath } = fileConfig;
  // get all github link, and add badge
  const matchedNodes: MatchedNode[] = [];
  visit(item, (node) => {
    if (node.type === "html") {
      if (node.value.includes("<img")) {
        // regex replace img url
        node.value = node.value.replace(/src="([^"]+)"/g, (match, p1) => {
          const url = p1;
          let formated = p1;
          if (url.startsWith("http")) {
            // do nothing
          } else if (url.startsWith("/")) {
            formated = `${repoUrl}/raw/${defaultBranch}${url}`;
          } else {
            formated = `${repoUrl}/raw/${defaultBranch}/${url}`;
          }
          const urlObj = new URL(formated);
          if (urlObj.hostname === "github.com") {
            formated = formated.replace("/blob/", "/raw/");
          }
          return `src="${formated}"`;
        });
      }
    }
    if (node.type === "link" && node.url.startsWith("https")) {
      const url = node.url;
      try {
        const urlObj = new URL(url);
        if (urlObj.hostname === "github.com") {
          // disable white list pathname
          const pathname = urlObj.pathname;
          const pathArr = pathname.split("/");
          const owner = pathArr[1];
          const repo = pathArr[2];

          if (owner && repo && !GithubSpecialOwner.includes(owner)) {
            matchedNodes.push({
              node,
              meta: {
                owner,
                repo,
              },
            });
          }
        }
      } catch (e) {
        log.debug("url parse error", url, e);
      }
    } else if (node.type === "link") {
      // transform relative link to absolute link
      const url = node.url;
      if (url.startsWith("/")) {
        node.url = `${repoUrl}/blob/${defaultBranch}${url}`;
      } else {
        node.url = `${repoUrl}/blob/${defaultBranch}/${filepath}/${url}`;
      }
    } else if (node.type === "image" && !node.url.startsWith("http")) {
      const url = node.url;
      if (url.startsWith("/")) {
        node.url = `${repoUrl}/raw/${defaultBranch}${url}`;
      } else {
        node.url = `${repoUrl}/raw/${defaultBranch}/${url}`;
      }
    }
    // check is there is blob, replace to raw
    if (node.type === "image" && node.url.includes("blob")) {
      const urlObj = new URL(node.url);
      if (urlObj.hostname === "github.com") {
        node.url = node.url.replace("/blob/", "/raw/");
      }
    }
  });
  if (!isMock()) {
    await Promise.all(matchedNodes.map((matched) => {
      const { owner, repo } = matched.meta;
      const node = matched.node;
      return gotGithubStar(owner, repo).then((star: string) => {
        if (star) {
          const badge = ` (⭐${star})`;
          node.children = [
            ...node.children,
            {
              type: "text",
              value: badge,
            },
          ];
        }
      });
    }));
  }
  return item;
}

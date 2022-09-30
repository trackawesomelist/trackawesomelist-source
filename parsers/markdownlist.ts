import { DocItem } from "../interface.ts";
import { Content, fromMarkdown, Link, toMarkdown, visit } from "../deps.ts";
import {
  childrenToMarkdown,
  childrenToRoot,
  gotGithubStar,
  isMock,
  promiseLimit,
} from "../util.ts";
import log from "../log.ts";
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
export async function formatItemMarkdown(item: Content): Promise<Content> {
  // get all github link, and add badge
  const matchedNodes: MatchedNode[] = [];
  visit(item, (node) => {
    if (node.type === "link") {
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

export default async function (content: string): Promise<DocItem[]> {
  const items: DocItem[] = [];
  const tree = fromMarkdown(content, "utf8", {});
  let index = 0;
  let currentLevel = 0;
  let currentSubCategory = "";
  let currentCategory = "";
  let lowestHeadingLevel = 3;
  // first check valided sections
  const validSections: Content[] = [];
  for (const rootNode of tree.children) {
    if (rootNode.type === "heading") {
      currentLevel = rootNode.depth;
      if (currentLevel > lowestHeadingLevel) {
        lowestHeadingLevel = currentLevel;
      }
      validSections.push(rootNode);
    } else if (rootNode.type === "list") {
      // check if all links is author link
      // if so, it's a table of content
      // ignore it
      let isToc = true;
      visit(childrenToRoot(rootNode.children), "link", (node) => {
        if (!node.url.startsWith("#")) {
          isToc = false;
        }
      });
      if (!isToc) {
        validSections.push(rootNode);
      }
    }
  }
  const funcs: (() => Promise<DocItem>)[] = [];
  for (const rootNode of validSections) {
    if (rootNode.type === "heading") {
      currentLevel = rootNode.depth;
      if (lowestHeadingLevel <= 3 && currentLevel === lowestHeadingLevel - 1) {
        currentCategory = toMarkdown(childrenToRoot(rootNode.children));
      } else if (currentLevel === lowestHeadingLevel) {
        currentSubCategory = toMarkdown(childrenToRoot(rootNode.children));
      }
    } else if (rootNode.type === "list") {
      // console.log("rootNode", rootNode);

      for (const item of rootNode.children) {
        if (item.type === "listItem") {
          let category = "";
          if (currentCategory) {
            category = currentCategory.trim().replace(/\n/g, " ");
          }
          if (currentSubCategory) {
            if (category) {
              category += " / ";
            }
            category += currentSubCategory.trim().replace(/\n/g, " ");
          }
          funcs.push(() => {
            return formatItemMarkdown(item).then((formatedItem) => {
              return {
                formatedMarkdown: toMarkdown(formatedItem).trim(),
                rawMarkdown: toMarkdown(item).trim(),
                category: category,
                line: item.position!.end.line,
              };
            });
          });
        }
      }
    }
  }

  return promiseLimit<DocItem>(funcs, 100);
}

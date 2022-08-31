import { DocItem } from "../interface.ts";
import { fromMarkdown, toMarkdown, visit } from "../deps.ts";
import { childrenToMarkdown, childrenToRoot } from "../util.ts";
export default function (content: string): DocItem[] {
  const items: DocItem[] = [];
  const tree = fromMarkdown(content, "utf8", {});

  let currentLevel = 0;
  let currentSubCategory = "";
  let currentCategory = "";
  let lowestHeadingLevel = 3;
  // first check the info
  for (const rootNode of tree.children) {
    if (rootNode.type === "heading") {
      currentLevel = rootNode.depth;
      if (currentLevel > lowestHeadingLevel) {
        lowestHeadingLevel = currentLevel;
      }
    }
  }

  for (const rootNode of tree.children) {
    if (rootNode.type === "heading") {
      currentLevel = rootNode.depth;
      if (lowestHeadingLevel <= 3 && currentLevel === lowestHeadingLevel - 1) {
        currentCategory = toMarkdown(childrenToRoot(rootNode.children));
      } else if (currentLevel === lowestHeadingLevel) {
        currentSubCategory = toMarkdown(childrenToRoot(rootNode.children));
      }
    } else if (rootNode.type === "list") {
      visit(rootNode, "listItem", (node) => {
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
        items.push({
          markdown: toMarkdown(node),
          category: category,
          line: node.position.start.line,
        });
      });
    }
  }
  return items;
}

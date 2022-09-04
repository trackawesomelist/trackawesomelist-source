import { DocItem } from "../interface.ts";
import { Content, fromMarkdown, toMarkdown, visit } from "../deps.ts";
import { childrenToMarkdown, childrenToRoot } from "../util.ts";
export default function (content: string): DocItem[] {
  const items: DocItem[] = [];
  const tree = fromMarkdown(content, "utf8", {});

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
          items.push({
            markdown: toMarkdown(item).trim(),
            category: category,
            line: item.position!.end.line,
          });
        }
      }
    }
  }
  return items;
}

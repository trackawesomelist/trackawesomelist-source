import { DocItem, FileInfo, ParseOptions } from "../../interface.ts";
import {
  Content,
  fromMarkdown,
  Root,
  TableRow,
  toMarkdown,
  visit,
} from "../../deps.ts";
import { childrenToRoot, promiseLimit, writeTextFile } from "../../util.ts";
import _log from "../../log.ts";
import formatMarkdownItem from "../../format-markdown-item.ts";
import { gfm, gfmFromMarkdown, gfmToMarkdown } from "../../deps.ts";
export function getValidSections(tree: Root, options: ParseOptions): Content[] {
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
  return validSections;
}
export function uglyFormatItemIdentifier(
  _fileInfo: FileInfo,
  item: Content | Root,
): string {
  // use link name as identifier
  let linkItem;
  visit(item, "link", (node) => {
    linkItem = node;
    return null;
  });
  if (linkItem) {
    return toMarkdown(linkItem, {
      extensions: [gfmToMarkdown()],
    }).trim();
  } else {
    return toMarkdown(item, {
      extensions: [gfmToMarkdown()],
    }).trim();
  }
}

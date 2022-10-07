import { DocItem, FileInfo, ParseOptions } from "../../interface.ts";
import {
  Content,
  fromMarkdown,
  Link,
  Root,
  toMarkdown,
  visit,
} from "../../deps.ts";
import { childrenToRoot, promiseLimit } from "../../util.ts";
import log from "../../log.ts";
import formatMarkdownItem from "../../format-markdown-item.ts";
export default function (
  content: string,
  fileInfo: FileInfo,
): Promise<DocItem[]> {
  const sourceConfig = fileInfo.sourceConfig;
  const fileConfig = sourceConfig.files[fileInfo.filepath];
  const options = fileConfig.options;
  const items: DocItem[] = [];
  const tree = fromMarkdown(content, "utf8", {});
  let index = 0;
  let currentLevel = 0;
  let currentSubCategory = "";
  let currentCategory = "";
  let lowestHeadingLevel = 3;
  // first check valided sections
  let isReachedValidSection = false;
  const validSections: Content[] = [];
  for (const rootNode of tree.children) {
    if (!isReachedValidSection) {
      // check is valid now
      if (
        rootNode.type === "heading" &&
        rootNode.depth === options.max_heading_level
      ) {
        isReachedValidSection = true;
      } else {
        continue;
      }
    }
    if (rootNode.type === "heading") {
      currentLevel = rootNode.depth;
      if (
        currentLevel > lowestHeadingLevel
      ) {
        lowestHeadingLevel = currentLevel;
      }
      validSections.push(rootNode);
    } else if (rootNode.type !== "list" && rootNode.type !== "thematicBreak") {
      validSections.push(rootNode);
    }
  }
  const min_heading_level = options.min_heading_level || lowestHeadingLevel;
  const max_heading_level = options.max_heading_level || 2;
  const heading_level = options.heading_level || 3;
  const funcs: (() => Promise<DocItem>)[] = [];
  let tempItemSections: Content[] = [];
  for (const rootNode of validSections) {
    if (rootNode.type === "heading" && rootNode.depth <= heading_level) {
      currentLevel = rootNode.depth;
      if (currentLevel === heading_level) {
        // yes this is item start
        if (tempItemSections.length > 0) {
          const item = childrenToRoot(tempItemSections);
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
          const line =
            tempItemSections[tempItemSections.length - 1].position!.end
              .line;
          const fn = () => {
            return formatMarkdownItem(item, fileInfo).then((formatedItem) => {
              return {
                formatedMarkdown: toMarkdown(formatedItem).trim(),
                rawMarkdown: toMarkdown(item).trim(),
                category: category,
                line,
              };
            });
          };
          funcs.push(fn);
        }

        tempItemSections = [rootNode];
      }
      if (
        currentLevel < min_heading_level && currentLevel >= max_heading_level
      ) {
        currentCategory = toMarkdown(childrenToRoot(rootNode.children));
      } else if (currentLevel === min_heading_level) {
        currentSubCategory = toMarkdown(childrenToRoot(rootNode.children));
      }
    } else {
      tempItemSections.push(rootNode);
    }
  }

  // add last item
  if (tempItemSections.length > 1) {
    const item = childrenToRoot(tempItemSections);
    let category = "";
    // TODO category issue
    if (currentCategory) {
      category = currentCategory.trim().replace(/\n/g, " ");
    }
    if (currentSubCategory) {
      if (category) {
        category += " / ";
      }
      category += currentSubCategory.trim().replace(/\n/g, " ");
    }
    const line = tempItemSections[tempItemSections.length - 1].position!.end
      .line;
    const fn = () => {
      return formatMarkdownItem(item, fileInfo).then((formatedItem) => {
        return {
          formatedMarkdown: toMarkdown(formatedItem).trim(),
          rawMarkdown: toMarkdown(item).trim(),
          category: category,
          line: line,
        };
      });
    };
    funcs.push(fn);
  }
  return promiseLimit<DocItem>(funcs);
}

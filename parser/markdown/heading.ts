import {
  DocItem,
  ExpiredValue,
  FileInfo,
  ParseOptions,
} from "../../interface.ts";
import {
  Content,
  fromMarkdown,
  gfm,
  gfmFromMarkdown,
  gfmToMarkdown,
  Link,
  remarkInlineLinks,
  Root,
  toMarkdown,
  visit,
} from "../../deps.ts";
import { childrenToRoot, promiseLimit } from "../../util.ts";
import log from "../../log.ts";
import formatMarkdownItem from "../../format-markdown-item.ts";
import { uglyFormatItemIdentifier } from "./util.ts";
export default function (
  content: string,
  fileInfo: FileInfo,
  dbCachedStars: Record<string, ExpiredValue>,
): Promise<DocItem[]> {
  const sourceConfig = fileInfo.sourceConfig;
  const fileConfig = sourceConfig.files[fileInfo.filepath];
  const options = fileConfig.options;
  const isParseCategory = options.is_parse_category === undefined
    ? true
    : options.is_parse_category;
  const items: DocItem[] = [];
  const tree = fromMarkdown(content, "utf8", {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });
  // @ts-ignore: remarkInlineLinks is not typed
  remarkInlineLinks()(tree);

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
    } else if (rootNode.type === "list") {
      // check if all links is author link
      // if so, it's a table of content
      // ignore it
      let internalLinkCount = 0;
      let externalLinkCount = 0;
      visit(childrenToRoot(rootNode.children), "link", (node) => {
        if (!node.url.startsWith("#")) {
          internalLinkCount++;
        } else {
          externalLinkCount++;
        }
      });
      // for fix some repo's toc include a little external links
      // we still treat it as toc if internal link count is more than 80%
      // for example: https://github.com/EbookFoundation/free-programming-books/blob/main/books/free-programming-books-langs.md#bootstrap
      if (
        externalLinkCount === 0 ||
        (internalLinkCount > 10 && externalLinkCount < 2)
      ) {
        validSections.push(rootNode);
      }
    } else if (rootNode.type !== "thematicBreak") {
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
          const itemIdentifier = uglyFormatItemIdentifier(fileInfo, item);
          const fn = () => {
            return formatMarkdownItem(item, fileInfo, dbCachedStars).then(
              (formatedItem) => {
                return {
                  formatedMarkdown: toMarkdown(formatedItem, {
                    extensions: [gfmToMarkdown()],
                  }).trim(),
                  rawMarkdown: itemIdentifier,
                  category: isParseCategory ? category : "",
                  line,
                };
              },
            );
          };
          funcs.push(fn);
        }

        tempItemSections = [rootNode];
      }
      if (
        currentLevel < min_heading_level && currentLevel >= max_heading_level
      ) {
        currentCategory = toMarkdown(childrenToRoot(rootNode.children), {
          extensions: [gfmToMarkdown()],
        });
      } else if (currentLevel === min_heading_level) {
        currentSubCategory = toMarkdown(childrenToRoot(rootNode.children), {
          extensions: [gfmToMarkdown()],
        });
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
    const itemIdentifier = uglyFormatItemIdentifier(fileInfo, item);
    const fn = () => {
      return formatMarkdownItem(item, fileInfo, dbCachedStars).then(
        (formatedItem) => {
          return {
            formatedMarkdown: toMarkdown(formatedItem, {
              extensions: [gfmToMarkdown()],
            }).trim(),
            rawMarkdown: itemIdentifier,
            category: isParseCategory ? category : "",
            line: line,
          };
        },
      );
    };
    funcs.push(fn);
  }
  return promiseLimit<DocItem>(funcs);
}

function uglyRemoveAutoGeneratedMarkdown(
  fileInfo: FileInfo,
  item: Root,
): Root {
  const sourceConfig = fileInfo.sourceConfig;
  const fileConfig = sourceConfig.files[fileInfo.filepath];
  const sourceIdentifier = sourceConfig.identifier;
  if (sourceIdentifier === "stefanbuck/awesome-browser-extensions-for-github") {
    // remove the last part
    const children = item.children;
    return {
      type: "root",
      children: children.slice(0, children.length - 1),
    };
  } else {
    return item;
  }
}

import { DocItem, FileInfo, ParseOptions } from "../../interface.ts";
import {
  Content,
  fromMarkdown,
  gfm,
  gfmFromMarkdown,
  gfmToMarkdown,
  Link,
  toMarkdown,
  visit,
} from "../../deps.ts";
import { childrenToRoot, getRepoHTMLURL, promiseLimit } from "../../util.ts";
import log from "../../log.ts";
import formatMarkdownItem from "../../format-markdown-item.ts";
import formatCategory from "../../format-category.ts";
export default function (
  content: string,
  fileInfo: FileInfo,
): Promise<DocItem[]> {
  const sourceConfig = fileInfo.sourceConfig;
  const fileConfig = sourceConfig.files[fileInfo.filepath];
  const parseOptions = fileConfig.options;
  const isParseCategory = parseOptions.is_parse_category === undefined
    ? true
    : parseOptions.is_parse_category;
  const items: DocItem[] = [];
  const tree = fromMarkdown(content, "utf8", {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });
  let index = 0;
  let currentLevel = 0;
  let currentSubCategory = "";
  let currentCategory = "";
  let lowestHeadingLevel = 3;
  // first check valided sections
  const validSections: Content[] = [];
  let isReachedValidSection = false;
  const max_heading_level = parseOptions.max_heading_level || 2;
  for (const rootNode of tree.children) {
    // start with the first valid ma  x_heading_level

    if (!isReachedValidSection) {
      // check is valid now
      if (
        rootNode.type === "heading" &&
        rootNode.depth === max_heading_level
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
    }
  }
  const min_heading_level = parseOptions.min_heading_level ||
    lowestHeadingLevel;
  const funcs: (() => Promise<DocItem>)[] = [];
  for (const rootNode of validSections) {
    if (rootNode.type === "heading") {
      currentLevel = rootNode.depth;

      if (
        currentLevel < min_heading_level && currentLevel >= max_heading_level
      ) {
        currentCategory = formatCategory(
          childrenToRoot(rootNode.children),
        );
      } else if (currentLevel === min_heading_level) {
        currentSubCategory = formatCategory(
          childrenToRoot(rootNode.children),
        );
      }
    } else if (rootNode.type === "list") {
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
          if (uglyIsValidCategory(fileInfo, category)) {
            funcs.push(() => {
              return formatMarkdownItem(item, fileInfo).then((formatedItem) => {
                const rawMarkdown = uglyFormatItemIdentifier(fileInfo, item);
                return {
                  formatedMarkdown: toMarkdown(formatedItem, {
                    extensions: [gfmToMarkdown()],
                  }).trim(),
                  rawMarkdown: rawMarkdown ? rawMarkdown : toMarkdown(item, {
                    extensions: [gfmToMarkdown()],
                  }).trim(),
                  category: isParseCategory ? category : "",
                  line: item.position!.end.line,
                };
              });
            });
          }
        }
      }
    }
  }

  return promiseLimit<DocItem>(funcs);
}

function uglyIsValidCategory(
  fileInfo: FileInfo,
  category: string,
): boolean {
  const sourceConfig = fileInfo.sourceConfig;
  const fileConfig = sourceConfig.files[fileInfo.filepath];
  const sourceIdentifier = sourceConfig.identifier;
  if (sourceIdentifier === "KotlinBy/awesome-kotlin") {
    if (category.startsWith("Github Trending / ")) {
      return false;
    }
  }
  return true;
}

function uglyFormatItemIdentifier(
  fileInfo: FileInfo,
  item: Content,
): string | undefined {
  const sourceConfig = fileInfo.sourceConfig;
  const sourceIdentifier = sourceConfig.identifier;
  if (sourceIdentifier === "analysis-tools-dev/static-analysis") {
    // use link name as identifier
    let linkItem;
    visit(item, "link", (node) => {
      linkItem = node;
      return null;
    });
    if (linkItem) {
      return toMarkdown(linkItem).trim();
    } else {
      return undefined;
    }
  }
  return undefined;
}

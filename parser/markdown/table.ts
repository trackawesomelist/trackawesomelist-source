import {
  DocItem,
  ExpiredValue,
  FileConfigInfo,
  FileInfo,
  ParseOptions,
} from "../../interface.ts";
import {
  Content,
  fromMarkdown,
  remarkInlineLinks,
  TableRow,
  toMarkdown,
  visit,
} from "../../deps.ts";
import { childrenToRoot, promiseLimit, writeTextFile } from "../../util.ts";
import _log from "../../log.ts";
import formatMarkdownItem from "../../format-markdown-item.ts";
import { gfm, gfmFromMarkdown, gfmToMarkdown } from "../../deps.ts";

import { uglyFormatItemIdentifier } from "./util.ts";
export default async function (
  content: string,
  fileInfo: FileInfo,
  dbCachedStars: Record<string, ExpiredValue>,
): Promise<DocItem[]> {
  const sourceConfig = fileInfo.sourceConfig;
  const fileConfig = sourceConfig.files[fileInfo.filepath];
  const options = fileConfig.options;
  const parseOptions = fileConfig.options;
  const isParseCategory = parseOptions.is_parse_category === undefined
    ? true
    : parseOptions.is_parse_category;

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
  const validSections: Content[] = [];
  for (const rootNode of tree.children) {
    if (rootNode.type === "heading") {
      currentLevel = rootNode.depth;
      if (currentLevel > lowestHeadingLevel) {
        lowestHeadingLevel = currentLevel;
      }
      validSections.push(rootNode);
    } else if (rootNode.type === "table") {
      validSections.push(rootNode);
    }
  }
  const min_heading_level = options.min_heading_level || lowestHeadingLevel;
  const max_heading_level = options.max_heading_level || 2;
  const funcs: (() => Promise<DocItem>)[] = [];
  // console.log("validSections", validSections);
  for (const rootNode of validSections) {
    // console.log("rootNode", rootNode);
    if (rootNode.type === "heading") {
      currentLevel = rootNode.depth;
      if (
        currentLevel < min_heading_level && currentLevel >= max_heading_level
      ) {
        currentCategory = toMarkdown(childrenToRoot(rootNode.children));
      } else if (currentLevel === min_heading_level) {
        currentSubCategory = toMarkdown(childrenToRoot(rootNode.children));
      }
    } else if (rootNode.type === "table") {
      // console.log("rootNode", rootNode);
      // await writeTextFile("temp.json", JSON.stringify(rootNode));
      let rowIndex = 0;
      for (const item of rootNode.children) {
        // console.log("item", item);
        if (item.type === "tableRow") {
          if (rowIndex === 0) {
            // first row is header
            rowIndex++;
            continue;
          }
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
          const itemIdentifier = uglyFormatItemIdentifier(fileInfo, item);
          funcs.push(() => {
            return formatMarkdownItem(item as TableRow, fileInfo, dbCachedStars)
              .then(
                (formatedItem) => {
                  let markdown = "- ";
                  // transform table row to item
                  (formatedItem as TableRow).children.forEach(
                    (child, cellIndex) => {
                      const tableHeaderCell =
                        rootNode.children[0].children[cellIndex];
                      let tableHeaderCellMarkdown = "";
                      try {
                        tableHeaderCellMarkdown = toMarkdown(
                          tableHeaderCell,
                          {
                            extensions: [gfmToMarkdown()],
                          },
                        ).trim();
                      } catch (e) {
                        console.log("e", e);
                        console.log("tableHeaderCell", tableHeaderCell);
                      }
                      const rowCellMarkdown = toMarkdown(
                        child,
                        {
                          extensions: [gfmToMarkdown()],
                        },
                      ).trim();
                      if (cellIndex > 0) {
                        markdown +=
                          `  ${tableHeaderCellMarkdown}: ${rowCellMarkdown}\n\n`;
                      } else {
                        markdown +=
                          `${tableHeaderCellMarkdown}: ${rowCellMarkdown}\n\n`;
                      }
                    },
                  );

                  return {
                    formatedMarkdown: markdown,
                    rawMarkdown: itemIdentifier,
                    category: isParseCategory ? category : "",
                    line: item.position!.end.line,
                  };
                },
              );
          });
          rowIndex++;
        }
      }
    }
  }

  return promiseLimit<DocItem>(funcs);
}

import { DocItem, FileInfo, ParseOptions } from "../../interface.ts";
import {
  Content,
  EXIT,
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
    return EXIT;
  });

  if (linkItem) {
    const finalMarkdown = toMarkdown(linkItem, {
      extensions: [gfmToMarkdown()],
    }).trim();
    return finalMarkdown;
  } else {
    return toMarkdown(item, {
      extensions: [gfmToMarkdown()],
    }).trim();
  }
}

export function getFakeFileInfo(): FileInfo {
  return {
    "sourceConfig": {
      "identifier": "jaywcjlove/awesome-mac",
      "url": "https://github.com/jaywcjlove/awesome-mac",
      "files": {
        "README.md": {
          "filepath": "README.md",
          "pathname": "/jaywcjlove/awesome-mac/",
          "name": "Awesome Mac",
          "index": true,
          "options": { "type": "list" },
        },
      },
      "category": "Platforms",
    },
    "sourceMeta": {
      "created_at": "2022-10-24T18:24:24.090Z",
      "updated_at": "2022-10-24T18:35:54.686Z",
      "meta": {
        "default_branch": "master",
        "name": "awesome-mac",
        "description":
          " Now we have become very big, Different from the original idea. Collect premium software in various categories.",
        "url": "https://github.com/jaywcjlove/awesome-mac",
        "language": "JavaScript",
        "stargazers_count": 54167,
        "subscribers_count": 1410,
        "forks_count": 5538,
        "tags": [
          "apple",
          "awesome",
          "awesome-list",
          "awesome-lists",
          "list",
          "mac",
          "mac-osx",
          "macos",
          "macosx",
          "software",
        ],
        "updated_at": "2022-10-22T02:50:51Z",
        "created_at": "2016-07-17T15:33:47Z",
        "checked_at": "2022-10-24T18:24:22.929Z",
      },
      "files": {
        "README.md": {
          "sha1": "0049556161b8f5ddc0a3f89dbb9fb952826fd605",
          "updated_at": "2022-10-22T02:50:11.000Z",
          "meta_created_at": "2022-10-24T18:27:22.017Z",
          "created_at": "2016-07-17T15:34:53.000Z",
          "checked_at": "2022-10-24T18:27:22.017Z",
        },
      },
    },
    "filepath": "README.md",
  };
}

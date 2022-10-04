import { DocItem, FileInfo } from "./interface.ts";
import { Content, Link, remove, Root, toMarkdown, visit } from "./deps.ts";

import {
  childrenToMarkdown,
  childrenToRoot,
  gotGithubStar,
  isMock,
  promiseLimit,
} from "./util.ts";
import log from "./log.ts";
export default function formatItemMarkdown<T>(
  item: Content | Root,
  fileInfo: FileInfo,
): string {
  // visit and remove sup item
  remove(item, (node, n) => {
    // remove hash link
    // remote html
    if (node.type === "html") {
      return true;
    }
    if (node.type === "link" && node.url.startsWith("#")) {
      return true;
    } else {
      return false;
    }
  });
  return toMarkdown(item).trim();
}

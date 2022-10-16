import { DocItem, FileInfo, ParseOptions } from "./interface.ts";
import {
  Content,
  fromMarkdown,
  render,
  TableRow,
  toMarkdown,
  visit,
} from "./deps.ts";
import {
  childrenToRoot,
  getDomain,
  promiseLimit,
  writeTextFile,
} from "./util.ts";
import _log from "./log.ts";
import formatMarkdownItem from "./format-markdown-item.ts";
import { gfm, gfmFromMarkdown, gfmToMarkdown } from "./deps.ts";
import { CONTENT_DIR, INDEX_MARKDOWN_PATH } from "./constant.ts";
export default function renderMarkdown(content: string): string {
  const domain = getDomain();
  const tree = fromMarkdown(content, "utf8", {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });
  visit(tree, "link", (node) => {
    const { url } = node;
    if (
      url &&
      (url.startsWith("/" + CONTENT_DIR + "/")) &&
      url.endsWith(INDEX_MARKDOWN_PATH)
    ) {
      node.url = url.slice(CONTENT_DIR.length + 1, -INDEX_MARKDOWN_PATH.length);
    } else if (
      url && (url.startsWith("/")) && url.endsWith(INDEX_MARKDOWN_PATH)
    ) {
      node.url = url.slice(0, -INDEX_MARKDOWN_PATH.length);
    }
  });

  const markdownDist = toMarkdown(tree, {
    extensions: [gfmToMarkdown()],
  });
  return render(markdownDist, {
    allowIframes: true,
  });
}

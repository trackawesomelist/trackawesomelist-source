import { DocItem, FileInfo, ParseOptions } from "./interface.ts";
import {
  Content,
  fromMarkdown,
  render,
  TableRow,
  toMarkdown,
  visit,
} from "./deps.ts";
import { childrenToRoot, getDomain } from "./util.ts";
import _log from "./log.ts";
import {
  gfm,
  gfmFromMarkdown,
  gfmToMarkdown,
  remarkEmoji,
  remarkGemoji,
} from "./deps.ts";
import { CONTENT_DIR, INDEX_MARKDOWN_PATH } from "./constant.ts";
export default function renderMarkdown(content: string): string {
  const domain = getDomain();
  const tree = fromMarkdown(content, "utf8", {
    // @ts-ignore: remarkInlineLinks is not typed
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });
  // @ts-ignore: node function
  const remarkEmojiPlugin = remarkEmoji();
  // @ts-ignore: node function
  remarkEmojiPlugin(tree);
  const remarkGemojiPlugin = remarkGemoji();
  // @ts-ignore: node function
  remarkGemojiPlugin(tree);

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

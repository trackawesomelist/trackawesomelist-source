import { Content, remove, Root, toMarkdown } from "./deps.ts";

export default function formatItemMarkdown(
  item: Content | Root,
): string {
  // visit and remove sup item
  remove(item, (node, _n) => {
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

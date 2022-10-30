import { visit } from "https://esm.sh/unist-util-visit@4.1.1";
import { gemoji, nameToEmoji } from "https://cdn.skypack.dev/gemoji@7?dts";
const find = /:(\+1|[-\w]+):/g;

const own = {}.hasOwnProperty;

export default function remarkGemoji() {
  return (tree) => {
    visit(tree, "text", (node) => {
      const value = node.value;
      /** @type {string[]} */
      const slices = [];
      find.lastIndex = 0;
      let match = find.exec(value);
      let start = 0;

      while (match) {
        const emoji = /** @type {keyof nameToEmoji} */ (match[1]);
        const position = match.index;

        if (own.call(nameToEmoji, emoji) || emoji === "octocat") {
          if (start !== position) {
            slices.push(value.slice(start, position));
          }
          let finalEmoji = nameToEmoji[emoji];
          if (!finalEmoji && emoji === "octocat") {
            finalEmoji = "🐙";
          }

          slices.push(finalEmoji);
          start = position + match[0].length;
        } else {
          find.lastIndex = position + 1;
        }

        match = find.exec(value);
      }

      if (slices.length > 0) {
        slices.push(value.slice(start));
        node.value = slices.join("");
      }
    });
  };
}

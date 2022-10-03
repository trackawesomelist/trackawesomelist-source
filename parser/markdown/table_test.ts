import markdowntable from "./markdowntable.ts";
import { readTextFile } from "../util.ts";
import { assertEquals } from "../test-deps.ts";
Deno.test("markdown table test #1", async () => {
  const content = await readTextFile("./example/public-apis-simple.md");

  const items = await markdowntable(content);
  // assertEquals(items, [
  //   { markdown: "*   Item1\n", categories: ["Subtitle1\n"] },
  //   { markdown: "*   Item2\n", categories: ["Subtitle1\n"] },
  //   { markdown: "*   Item1\n", categories: ["Subtitle2\n"] },
  //   { markdown: "*   Item2\n", categories: ["Subtitle2\n"] },
  // ]);

  // console.log("items", items);
});

Deno.test("markdown table test #2", async () => {
  const content = await readTextFile("./example/books.md");

  const items = markdowntable(content);
});

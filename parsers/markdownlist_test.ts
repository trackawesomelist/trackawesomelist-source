import markdownlist from "./markdownlist.ts";
import { readTextFile } from "../util.ts";
import { assertEquals } from "../deps.ts";
Deno.test("markdown list test #1", async () => {
  const content = await readTextFile("./example/simple.md");

  const items = markdownlist(content);
  // assertEquals(items, [
  //   { markdown: "*   Item1\n", categories: ["Subtitle1\n"] },
  //   { markdown: "*   Item2\n", categories: ["Subtitle1\n"] },
  //   { markdown: "*   Item1\n", categories: ["Subtitle2\n"] },
  //   { markdown: "*   Item2\n", categories: ["Subtitle2\n"] },
  // ]);
});

Deno.test("markdown list test #2", async () => {
  const content = await readTextFile("./example/books.md");

  const items = markdownlist(content);
});

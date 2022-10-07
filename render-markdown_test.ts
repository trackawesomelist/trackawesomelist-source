import render from "./render-markdown.ts";
import { assertEquals } from "./test-deps.ts";
Deno.test("renderMarkdown", () => {
  const result = render("[Hello](/test/README.md)");
  assertEquals(result, `<p><a href="/test/">Hello</a></p>\n`);
});

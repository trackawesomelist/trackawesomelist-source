import { readTextFile, sha1 } from "./util.ts";
import { assertEquals } from "./test-deps.ts";

Deno.test("sha1 #1", async () => {
  const content = "hello world";
  const sum = await sha1(content);
  assertEquals(sum, "2aae6c35c94fcfb415dbe95f408b9ce91ee846ed");
});

Deno.test("sha1 #2", async () => {
  const content = await readTextFile(
    "./dev-current/1-raw/ripienaar/free-for-dev/markdownlist_README.md",
  );
  const sum = await sha1(content);
  assertEquals(sum, "2aae6c35c94fcfb415dbe95f408b9ce91ee846ed");
});

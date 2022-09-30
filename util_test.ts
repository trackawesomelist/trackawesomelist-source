import { getDayNumber, readTextFile, sha1 } from "./util.ts";
import { assertEquals } from "./test-deps.ts";

Deno.test("sha1 #1", async () => {
  const content = "hello world";
  const sum = await sha1(content);
  assertEquals(sum, "2aae6c35c94fcfb415dbe95f408b9ce91ee846ed");
});

Deno.test("getDayNumber", () => {
  const date = new Date("2020-01-01");
  const dayNumber = getDayNumber(date);
  assertEquals(dayNumber, 20200101);
});

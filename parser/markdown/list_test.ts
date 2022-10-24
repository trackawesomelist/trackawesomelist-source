import markdownlist from "./list.ts";
import { getFakeFileInfo } from "./util.ts";
import {
  getDbCachedStars,
  readTextFile,
  writeDbCachedStars,
} from "../../util.ts";
import { assertEquals } from "../../test-deps.ts";
Deno.test("markdown list test #3", async () => {
  const content = await readTextFile("./example/mac.md");
  const dbCachedStars = await getDbCachedStars();
  const items = await markdownlist(content, getFakeFileInfo(), dbCachedStars);
  await writeDbCachedStars(dbCachedStars);
});

import { mustache } from "../deps.ts";
import { fs, path } from "../deps.ts";
import parsers from "../parsers/mod.ts";
import { Item, ItemsJson, RunOptions } from "../interface.ts";
import {
  getCurrentPath,
  getDataRawPath,
  getDistRepoPath,
  isDev,
  parseFilename,
  readJSONFile,
  readTextFile,
  sha1,
  walkFile,
  writeJSONFile,
} from "../util.ts";
import log from "../log.ts";

export default async function buildMarkdown(options: RunOptions) {
}

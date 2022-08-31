/* eslint-disable @typescript-eslint/no-non-null-assertion */
/**
 * Spawns git blame and parses results into JSON, via stream (so, no problem on huge files)
 */

import { camelCase, readLines } from "./deps.ts";

interface BlameOptions {
  /**
   * Annotate only the given line range. May be specified multiple times. Overlapping ranges are allowed.
   * @see {@link https://git-scm.com/docs/git-blame#_specifying_ranges}
   */
  range: string;
  ignoreWhitespace: boolean;
  workTree: string;
  gitDir: string;
  rev: string;
}

interface LineInfo {
  sourceLine: number;
  resultLine: number;
  hash: string;
  numberOfLines: number;
  author: string;
  authorMail: string;
  authorTime: number;
  authorTz: string;
  commiter: string;
  commiterMail: string;
  commiterTime: number;
  commiterTz: string;
  summary: string;
  previous: string;
  filename: string;
  [k: string]: string | number;
}

export default async function getGitBlame(
  filename: string,
  options: Partial<BlameOptions> = {},
  gitPath = "git",
): Promise<Map<number, LineInfo>> {
  /**
   * @see {@link https://git-scm.com/docs/git-blame#_options}
   */
  const args = ["--no-pager", "blame", "--line-porcelain"];
  if (typeof options.workTree === "string") {
    args.unshift(`--work-tree=${options.workTree}`);
  }
  if (typeof options.gitDir === "string") {
    args.unshift(`--git-dir=${options.gitDir}`);
  }
  if (typeof options.ignoreWhitespace === "boolean") {
    args.push("-w");
  }
  if (typeof options.range === "string") {
    args.push(`-L${options.range}`);
  }
  if (typeof options.rev === "string") {
    args.push(options.rev);
  }
  const cmd = [gitPath, ...args, "--", filename];
  const process = Deno.run({
    cmd,
    cwd: options.workTree,
    stdin: "piped",
    stdout: "piped",
  });
  let currentLine: Partial<LineInfo>;
  const linesMap: Map<number, Partial<LineInfo>> = new Map();
  // return linesMap;

  for await (const line of readLines(process.stdout)) {
    // https://git-scm.com/docs/git-blame#_the_porcelain_format
    // Each blame entry always starts with a line of:
    // <40-byte hex sha1> <sourceline> <resultline> <num_lines>
    // like: 49790775624c422f67057f7bb936f35df920e391 94 120 3

    const parsedLine =
      /^(?<hash>[a-f0-9]{40,40})\s(?<sourceline>\d+)\s(?<resultLine>\d+)\s(?<numLines>\d+)$/
        .exec(
          line,
        );
    if (parsedLine?.groups) {
      // this is a new line info
      const sourceLine = parseInt(parsedLine.groups.sourceline, 10);
      const resultLine = parseInt(parsedLine?.groups.resultLine, 10);
      const numberOfLines = parseInt(parsedLine?.groups.numLines, 10);
      currentLine = {
        hash: parsedLine.groups.hash,
        sourceLine,
        resultLine,
        numberOfLines,
      };
      // set for all lines
      for (let i = resultLine; i < resultLine + numberOfLines; i++) {
        linesMap.set(i, currentLine);
      }
    } else {
      if (currentLine!) {
        const commitInfo =
          /^(?<token>[a-z]+(-(?<subtoken>[a-z]+))?)\s(?<data>.+)$/.exec(
            line,
          );
        if (commitInfo?.groups) {
          const property = camelCase(commitInfo.groups.token);
          let value: string | number = commitInfo.groups.data;
          switch (commitInfo.groups.subtoken) {
            case "mail":
              // remove <> from email
              value = value.slice(1, -1);
              break;

            case "time":
              // parse datestamp into number
              value = parseInt(value, 10);
              break;
          }
          currentLine![property] = value;
        }
      }
    }
  }
  return linesMap as Map<number, LineInfo>;
}

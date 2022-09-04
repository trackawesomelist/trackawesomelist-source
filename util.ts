import {
  Content,
  fs,
  path,
  posixPath,
  Root,
  toMarkdown,
  u,
  YAML,
} from "./deps.ts";
import log from "./log.ts";
import {
  Config,
  DBMeta,
  ItemsJson,
  ParsedFilename,
  ParsedItemsFilePath,
  RawConfig,
  RawSource,
  RawSourceFile,
  RawSourceFileWithType,
  Source,
  SourceFile,
} from "./interface.ts";
import { INDEX_MARKDOWN_PATH } from "./constant.ts";
import { NotFound } from "./error.ts";

export const defaultFileType = "markdownlist";

export function isDev() {
  return Deno.env.get("PROD") !== "1";
}
export function isUseCache() {
  return Deno.env.get("CACHE") === "1";
}
export function isMock() {
  if (isDev()) {
    return (Deno.env.get("MOCK") !== "0");
  } else {
    return false;
  }
}

export function isDebug() {
  return Deno.env.get("DEBUG") === "1";
}
export function getCachePath() {
  return path.join(Deno.cwd(), "cache");
}
export async function getConfig(): Promise<Config> {
  const rawConfig = YAML.parse(
    await Deno.readTextFile("config.yml"),
  ) as RawConfig;
  if (!rawConfig.file_min_updated_hours) {
    rawConfig.file_min_updated_hours = 12;
  }
  const config: Config = {
    sources: {},
    file_min_updated_hours: rawConfig.file_min_updated_hours,
  };
  for (const key of Object.keys(rawConfig.sources)) {
    const value = rawConfig.sources[key];
    config.sources[key] = getFormatedSource(key, value);
  }
  return config;
}
export function getFormatedSource(
  key: string,
  value: null | RawSource | undefined,
): Source {
  let url = `https://github.com/${key}`;

  let files: Record<string, SourceFile> = {};
  if (value) {
    if (value.url) {
      url = value.url;
    }
    if (value.files) {
      const keys = Object.keys(value.files);
      for (const fileKey of keys) {
        let fileConfig: RawSourceFileWithType;
        if (typeof value.files === "string") {
          fileConfig = formatFileConfigValue(value.files);
        } else if (value.files) {
          fileConfig = formatFileConfigValue(value.files[fileKey]);
        } else {
          fileConfig = formatFileConfigValue();
        }
        if (keys.length === 1) {
          fileConfig.index = true;
        }
        files[fileKey] = {
          ...fileConfig,
          original_filepath: fileKey,
          pathname: `/${key}/${
            fileConfig.index ? "" : removeExtname(fileKey) +
              "/"
          }`,
          name: fileKey,
        };
      }
      // check is has index file
      let isHasIndex = false;
      for (const rawFileKey of Object.keys(files)) {
        if (files[rawFileKey].index) {
          isHasIndex = true;
          break;
        }
      }
      if (!isHasIndex) {
        throw new Error(`source ${key} has no index file`);
      }
    }
  } else {
    // todo
    files = {
      [INDEX_MARKDOWN_PATH]: {
        original_filepath: INDEX_MARKDOWN_PATH,
        pathname: `/${key}/`,
        name: INDEX_MARKDOWN_PATH,
        type: defaultFileType,
        index: true,
      },
    };
  }

  return {
    identifier: key,
    url,
    files,
  };
}
function formatFileConfigValue(
  fileValue?: string | RawSourceFile | null,
): RawSourceFileWithType {
  if (!fileValue) {
    return {
      type: defaultFileType,
    };
  } else if (typeof fileValue === "string") {
    return {
      type: defaultFileType,
    };
  } else {
    return {
      ...fileValue,
      type: fileValue.type || defaultFileType,
    };
  }
}
export function getCurrentPath() {
  if (isDev()) {
    return "dev-current";
  } else {
    return "current";
  }
}

export function getDistPath() {
  if (isDev()) {
    return "dist";
  } else {
    return "prod-dist";
  }
}
export function getDistRepoPath() {
  return path.join(getDistPath(), "repo");
}
export function getDistRepoGitUrl() {
  const envRepo = Deno.env.get("DIST_REPO");
  if (envRepo) {
    return envRepo;
  } else {
    return `git@github.com:trackawesomelist/trackawesomelist.git`;
  }
}

export function getDataRawPath() {
  return posixPath.join(getCurrentPath(), "1-raw");
}

export function getDbPath() {
  if (isDev()) {
    return "db";
  } else {
    return "prod-db";
  }
}
export function getDataItemsPath() {
  return posixPath.join(getDbPath(), "items");
}
export function getMarkdownDistPath() {
  return posixPath.join(
    getCachePath(),
    isDev() ? "dev-trackawesomelist" : "trackawesomelist",
  );
}
export async function walkFile(path: string) {
  // ensure path exists
  await fs.ensureDir(path);
  // check path exist
  return fs.walk(path, {
    includeDirs: false,
  });
}

export async function walkJSON(path: string) {
  await fs.ensureDir(path);
  return fs.walk(path, {
    includeDirs: false,
    exts: [".json"],
  });
}
export function writeTextFile(path: string, content: string) {
  return fs.ensureFile(path).then(() => {
    return Deno.writeTextFile(path, content);
  });
}
export function readTextFile(path: string) {
  return Deno.readTextFile(path);
}

export async function readJSONFile<T>(path: string): Promise<T> {
  return JSON.parse(await readTextFile(path));
}

export function parseItemsFilepath(filepath: string): ParsedItemsFilePath {
  const relativePath = path.relative(getDataItemsPath(), filepath);
  const splited = relativePath.split(path.sep);
  const sourceIdentifier = splited[0] + "/" + splited[1];
  const repoRelativeFilename = splited.slice(2).join(path.sep);
  const originalFilepath = repoRelativeFilename.slice(0, -5);
  return {
    sourceIdentifier,
    originalFilepath,
  };
}

export function parseFilename(filename: string): ParsedFilename {
  const filenameWithoutExtname = path.basename(
    filename,
    path.extname(filename),
  );
  const splited = filenameWithoutExtname.split("_");
  const type = splited[0];
  return {
    name: splited.slice(1).join("_"),
    ext: path.extname(filename),
    type,
  };
}
export function childrenToRoot(children: Content[]): Root {
  return u("root", children);
}

export function childrenToMarkdown(children: Content[]): string {
  return toMarkdown(childrenToRoot(children));
}
export async function sha1(message: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hash = await crypto.subtle.digest("SHA-1", data);
  const hashArray = Array.from(new Uint8Array(hash)); // convert buffer to byte array
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join(
    "",
  ); // convert bytes to hex string
  return hashHex;
}
export async function exists(filename: string): Promise<boolean> {
  try {
    await Deno.stat(filename);
    // successful, file or directory must exist
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      // file or directory does not exist
      return false;
    } else {
      // unexpected error, maybe permissions, pass it along
      throw error;
    }
  }
}
export function removeExtname(filename: string) {
  const extname = path.extname(filename);
  return filename.slice(0, -extname.length);
}
export function getItemsFilePath(identifier: string, file: string) {
  const itemsFilesPath = path.join(
    getDataItemsPath(),
    identifier,
    file + ".json",
  );
  return itemsFilesPath;
}
export function getDbMetaFilePath() {
  const dbMetaFilePath = path.join(
    getDbPath(),
    "meta.json",
  );
  return dbMetaFilePath;
}
export async function getDbMeta(): Promise<DBMeta> {
  // first check local
  const dbMetaFilePath = getDbMetaFilePath();
  try {
    const dbMeta = await readJSONFile(dbMetaFilePath) as DBMeta;
    return dbMeta;
  } catch (_e) {
    // not found, read from remote
    const dbMeta = await getRemoteData<DBMeta>(dbMetaFilePath);
    return dbMeta;
  }
}
export async function writeDbMeta(dbMeta: DBMeta): Promise<void> {
  // first check local
  const dbMetaFilePath = getDbMetaFilePath();
  await writeJSONFile(dbMetaFilePath, dbMeta);
}

export async function getDbItemsJson(
  sourceIdentifier: string,
  file: string,
): Promise<ItemsJson> {
  const itemsFilesPath = getItemsFilePath(sourceIdentifier, file);
  // first check local
  try {
    const dbMeta = await readJSONFile(itemsFilesPath) as ItemsJson;
    return dbMeta;
  } catch (_e) {
    // not found, read from remote
    const dbMeta = await getRemoteData<ItemsJson>(itemsFilesPath);
    return dbMeta;
  }
}

export function getRemoteData<T>(file: string): T {
  throw new Error("not implemented");
  // return {
  //   sources: {},
  // };
}
export async function writeJSONFile(filePath: string, data: unknown) {
  const file = JSON.stringify(data, null, 2);
  // ensure dir exists
  const dir = path.dirname(filePath);
  await fs.ensureDir(dir);
  await Deno.writeTextFile(filePath, file + "\n");
}
export function getFullYear(date: Date): string {
  return date.getUTCFullYear().toString();
}
export function getFullMonth(date: Date): string {
  const month = date.getUTCMonth() + 1;
  return month < 10 ? `0${month}` : month.toString();
}

export function getFullDay(date: Date): string {
  const day = date.getUTCDate();
  return day < 10 ? `0${day}` : day.toString();
}
export function getUTCDay(date: Date): string {
  return `${getFullYear(date)}-${getFullMonth(date)}-${getFullDay(date)}`;
}
export function urlToFilePath(url: string): string {
  const urlObj = new URL(url);
  const pathname = urlObj.pathname;
  const basename = path.basename(pathname);
  const splited = pathname.split("/");
  const splitedTrimd = splited.filter((item) => item);
  if (splitedTrimd.length === 2) {
    return path.join(splitedTrimd.join(path.SEP), INDEX_MARKDOWN_PATH);
  } else if (splitedTrimd.length > 2) {
    splitedTrimd[splitedTrimd.length - 1] =
      splitedTrimd[splitedTrimd.length - 1] + ".md";
    return path.join(splitedTrimd.join(path.SEP));
  } else if (splitedTrimd.length === 0) {
    // readme
    return INDEX_MARKDOWN_PATH;
  } else {
    return pathname;
  }
}
export async function got(
  url: string,
  init?: RequestInit,
): Promise<string> {
  const c = new AbortController();
  const id = setTimeout(() => c.abort(), 30000);
  const r = await fetch(url, { ...init, signal: c.signal });
  clearTimeout(id);

  if (r.ok) {
    return r.text();
  } else {
    throw new Error(`fetch ${url} failed with status ${r.status}`);
  }
}
export function getCachedFileInfo(
  url: string,
  method: string,
  expired: number,
): string[] {
  const urlObj = new URL(url);
  const host = urlObj.host;
  const pathname = urlObj.pathname;
  const params = urlObj.searchParams;
  const cacheFileFolder = path.join(
    getCachePath(),
    "http",
    encodeURIComponent(host),
    method,
    pathname,
    encodeURIComponent(params.toString()),
  );
  return [cacheFileFolder, (Date.now() + expired) + ".txt"];
}

export async function writeCacheFile(
  url: string,
  method: string,
  body: string,
  expired = 60 * 60 * 24 * 7 * 1000,
) {
  const [cacheFileFolder, cacheFilePath] = getCachedFileInfo(
    url,
    method,
    expired,
  );
  await writeTextFile(path.join(cacheFileFolder, cacheFilePath), body);
  return body;
}

export async function readCachedFile(
  url: string,
  method: string,
  expired = 60 * 60 * 24 * 7 * 1000,
): Promise<string> {
  // check folder is exists
  const cachedFolder = getCachedFileInfo(url, method, expired)[0];
  for await (const file of await Deno.readDir(cachedFolder)) {
    if (file.isFile && file.name.endsWith(".txt")) {
      // check is expired
      const expired = parseInt(file.name.slice(0, -4));
      const filepath = path.join(cachedFolder, file.name);

      if (Date.now() - expired < 0) {
        // not expired
        return readTextFile(filepath);
      } else {
        // expired
        await Deno.remove(filepath);
      }
    }
  }
  throw new NotFound("cached file is expired");
}
export async function gotWithCache(
  url: string,
  init?: RequestInit,
): Promise<string> {
  // check is exists cache
  let cacheFileContent;
  try {
    cacheFileContent = await readCachedFile(url, init?.method ?? "GET");
    log.info(`use cache file for ${url}`);
  } catch (e) {
    if (e.name === "NotFound") {
      // ignore
      log.debug(`not found cache file for ${url}`);
    } else {
      throw e;
    }
  }
  if (cacheFileContent !== undefined) {
    return cacheFileContent;
  }
  const responseText = await got(url, init);
  await writeCacheFile(url, init?.method ?? "GET", responseText);
  return responseText;
}

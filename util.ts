import {
  Content,
  DateTimeFormatter,
  fs,
  kebabCase,
  path,
  posixPath,
  Root,
  slug as slugFn,
  titleCase as titleCaseFn,
  toMarkdown,
  u,
  YAML,
} from "./deps.ts";
import log from "./log.ts";
import {
  BaseFeed,
  Config,
  CustomRequestOptions,
  DayInfo,
  DBIndex,
  DBMeta,
  ExpiredValue,
  FileConfig,
  FileConfigInfo,
  FileInfo,
  Item,
  ItemDetail,
  Nav,
  Pagination,
  PaginationInfo,
  ParsedFilename,
  ParsedItemsFilePath,
  RawConfig,
  RawSource,
  RawSourceFile,
  RawSourceFileWithType,
  Source,
  WeekOfYear,
} from "./interface.ts";
import {
  CONTENT_DIR,
  DEFAULT_CATEGORY,
  DEV_DOMAIN,
  INDEX_MARKDOWN_PATH,
  PROD_DOMAIN,
} from "./constant.ts";
import { NotFound } from "./error.ts";
import { underline } from "https://deno.land/std@0.158.0/fmt/colors.ts";
export const SECOND = 1e3;
export const MINUTE = SECOND * 60;
export const HOUR = MINUTE * 60;
export const DAY = HOUR * 24;
export const WEEK = DAY * 7;
const DAYS_PER_WEEK = 7;
enum Day {
  Sun,
  Mon,
  Tue,
  Wed,
  Thu,
  Fri,
  Sat,
}

export const getDayNumber = (date: Date): number => {
  return Number(
    `${getFullYear(date)}${(getFullMonth(date))}${(getFullDay(date))}`,
  );
};
export const getWeekNumber = (date: Date): number => {
  return weekOfYear(date).number;
};
export const parseDayInfo = (day: number): DayInfo => {
  const year = Math.floor(day / 10000);
  const month = Math.floor(day / 100) % 100;
  const dayNumber = day % 100;
  const date = new Date(Date.UTC(year, month - 1, dayNumber));
  const localeDate = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(date);

  return {
    year,
    id: `${year}-${addZero(month)}-${addZero(dayNumber)}`,
    name: localeDate,
    month,
    day: dayNumber,
    path: `${year}/${addZero(month)}/${addZero(dayNumber)}`,
    number: day,
    date: date,
  };
};

export function startDateOfWeek(date: Date, start_day = 1): Date {
  // Returns the start of the week containing a 'date'. Monday 00:00 UTC is
  // considered to be the boundary between adjacent weeks, unless 'start_day' is
  // specified. A Date object is returned.

  date = new Date(date.getTime());
  const day_of_month = date.getUTCDate();
  const day_of_week = date.getUTCDay();
  const difference_in_days = (
    day_of_week >= start_day
      ? day_of_week - start_day
      : day_of_week - start_day + 7
  );
  date.setUTCDate(day_of_month - difference_in_days);
  date.setUTCHours(0);
  date.setUTCMinutes(0);
  date.setUTCSeconds(0);
  date.setUTCMilliseconds(0);
  return date;
}
export const parseWeekInfo = (week: number): WeekOfYear => {
  // check week number 5 or 6 digit
  // split by year and week
  let year = Math.floor(week / 100);
  let weekOfYear = week % 100;
  if (week < 100000) {
    // week add 0
    year = Math.floor(week / 10);
    weekOfYear = week % 10;
  }

  // week to date
  const date = weekNumberToDate(week);

  return {
    year,
    week: weekOfYear,
    number: week,
    path: `${year}/${weekOfYear}`,
    id: `${year}-${weekOfYear}`,
    name: weekToRange(week),
    date,
  };
};

export function weekToRange(weekNumber: number): string {
  let year = Math.floor(weekNumber / 100);
  let week = weekNumber % 100;
  if (weekNumber < 100000) {
    // week add 0
    year = Math.floor(weekNumber / 10);
    week = weekNumber % 10;
  }
  // Get first day of year
  const yearStart = new Date(Date.UTC(year, 0, 1));

  // year start monday date

  const yearStartMondayDate = startDateOfWeek(yearStart);

  const yearStartMondayFullYear = yearStartMondayDate.getUTCFullYear();

  let yearFirstWeekMonday = yearStartMondayDate;
  if (yearStartMondayFullYear !== year) {
    // then year first week monday is next +7
    yearFirstWeekMonday = new Date(yearStartMondayDate.getTime() + WEEK);
  }

  const weekMonday = yearFirstWeekMonday.getTime() + WEEK * (week - 1);
  const weekSunday = weekMonday + WEEK - 1;

  const weekStartYear = new Date(weekMonday).getUTCFullYear();
  const start = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(weekMonday);

  const end = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(weekSunday);

  return `${start} - ${end}, ${weekStartYear}`;
}
export function weekNumberToDate(weekNumber: number): Date {
  const year = Math.floor(weekNumber / 100);
  const week = weekNumber % 100;
  // Get first day of year
  const yearStart = new Date(Date.UTC(year, 0, 1));

  // year start monday date

  const yearStartMondayDate = startDateOfWeek(yearStart);

  const yearStartMondayFullYear = yearStartMondayDate.getUTCFullYear();

  let yearFirstWeekMonday = yearStartMondayDate;
  if (yearStartMondayFullYear !== year) {
    // then year first week monday is next +7
    yearFirstWeekMonday = new Date(yearStartMondayDate.getTime() + WEEK);
  }

  const weekMonday = yearFirstWeekMonday.getTime() + WEEK * (week - 1);
  const weekSunday = weekMonday + WEEK - 1;
  return new Date(weekMonday);
}
export function weekOfYear(date: Date): WeekOfYear {
  const workingDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );

  const day = workingDate.getUTCDay();

  const nearestThursday = workingDate.getUTCDate() +
    Day.Thu -
    (day === Day.Sun ? DAYS_PER_WEEK : day);

  workingDate.setUTCDate(nearestThursday);

  // Get first day of year
  const yearStart = new Date(Date.UTC(workingDate.getUTCFullYear(), 0, 1));
  const weekYear = workingDate.getUTCFullYear();
  // return the calculated full weeks to nearest Thursday
  const week = Math.ceil(
    (workingDate.getTime() - yearStart.getTime() + DAY) / WEEK,
  );
  return {
    year: weekYear,
    week: week,
    path: `${workingDate.getUTCFullYear()}/${week}`,
    number: Number(`${weekYear}${week}`),
    date: weekNumberToDate(Number(`${weekYear}${addZero(week)}`)),
    id: `${weekYear}-${week}`,
    name: weekToRange(week),
  };
}

export const addZero = function (num: number): string {
  if (num < 10) {
    return "0" + num;
  } else {
    return "" + num;
  }
};
// this function is used to get the config from the config file
//
// and parse it to the right format

// return the max value of the array

export const defaultFileType = "list";
// check is dev
export function isDev() {
  return Deno.env.get("PROD") !== "1";
}
export function getDomain() {
  return isDev() ? DEV_DOMAIN : PROD_DOMAIN;
}
export function isUseCache() {
  return true;
  // return Deno.env.get("CACHE") === "1";
}
export function isMock() {
  if (isDev()) {
    return (Deno.env.get("MOCK") !== "0");
  } else {
    return (Deno.env.get("MOCK") === "1");
  }
}

export function getRepoHTMLURL(
  url: string,
  defaultBranch: string,
  file: string,
): string {
  return `${url}/blob/${defaultBranch}/${file}`;
}
export function getCachePath(isDb: boolean) {
  if (isDb) {
    return path.join(getDbPath(), "cache");
  }
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
    ...rawConfig,
    sources: {},
  };
  for (const key of Object.keys(rawConfig.sources)) {
    const value = rawConfig.sources[key];
    config.sources[key] = getFormatedSource(key, value);
  }
  return config;
}
// https://github.com/markedjs/marked/blob/master/src/Slugger.js
export function slugy(value: string): string {
  return value
    .toLowerCase()
    .trim()
    // remove html tags
    .replace(/<[!\/a-z].*?>/ig, "")
    // remove unwanted chars
    .replace(
      /[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,./:;<=>?@[\]^`{|}~]/g,
      "",
    )
    .replace(/\s/g, "-");
}
export function getIndexFileConfig(
  filesConfig: Record<string, FileConfig>,
): FileConfig {
  const keys = Object.keys(filesConfig);
  for (const key of keys) {
    const fileConfig = filesConfig[key];
    if (fileConfig.index) {
      return fileConfig;
    }
  }
  return filesConfig[keys[0]];
}

export function getAllSourceCategories(config: Config): string[] {
  const sources = config.sources;
  const sourcesKeys = Object.keys(sources);
  const categories: string[] = [];
  for (const sourceKey of sourcesKeys) {
    const source = sources[sourceKey];
    if (!categories.includes(source.category)) {
      categories.push(source.category);
    }
  }
  return categories;
}
export function titleCase(str: string): string {
  // replace - to space
  return titleCaseFn(str.replace(/-/g, " "));
}
export function getFormatedSource(
  key: string,
  value: null | RawSource | undefined,
): Source {
  let url = `https://github.com/${key}`;
  const repo = key;
  // split repo owner and repo name
  let defaultName = titleCase(key.split("/")[1]);
  let name = defaultName;
  let files: Record<string, FileConfig> = {};
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
        if (fileConfig.name) {
          name = fileConfig.name;
        } else {
          if (fileConfig.index) {
            name = defaultName;
          } else {
            name = `${defaultName} (${fileKey})`;
          }
        }
        files[fileKey] = {
          ...fileConfig,
          filepath: fileKey,
          pathname: `/${key}/${
            fileConfig.index ? "" : removeExtname(fileKey) +
              "/"
          }`,
          name: name,
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
    } else {
      files = {
        [INDEX_MARKDOWN_PATH]: {
          filepath: INDEX_MARKDOWN_PATH,
          pathname: `/${key}/`,
          name,
          index: true,
          options: {
            type: defaultFileType,
          },
        },
      };
    }
  } else {
    // todo
    files = {
      [INDEX_MARKDOWN_PATH]: {
        filepath: INDEX_MARKDOWN_PATH,
        pathname: `/${key}/`,
        name,
        index: true,
        options: {
          type: defaultFileType,
        },
      },
    };
  }

  const defaultCategory = DEFAULT_CATEGORY;
  const sourceConfig: Source = {
    identifier: key,
    url,
    files,
    category: value?.category || defaultCategory,
  };

  if (value && value.default_branch) {
    sourceConfig.default_branch = value.default_branch;
  }
  return sourceConfig;
}
// function for format file config value
function formatFileConfigValue(
  fileValue?: string | RawSourceFile | null,
): RawSourceFileWithType {
  if (!fileValue) {
    return {
      options: { type: defaultFileType },
    };
  } else if (typeof fileValue === "string") {
    return {
      options: { type: defaultFileType },
    };
  } else {
    return {
      ...fileValue,
      options: { type: defaultFileType, ...fileValue.options },
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
export function getPublicPath() {
  return path.join(getDbPath(), "public");
}
export function getDistRepoPath() {
  return path.join(getDistPath());
}
export function getDistRepoContentPath() {
  return path.join(getDistPath(), CONTENT_DIR);
}
export function getStaticPath() {
  return "static";
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
export function getSqlitePath() {
  return path.join(getDbPath(), "sqlite.db");
}
export function getDataItemsPath() {
  return posixPath.join(getDbPath(), "items");
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
export function getDbIndexFilePath() {
  const dbMetaFilePath = path.join(
    getDbPath(),
    "index.json",
  );
  return dbMetaFilePath;
}
export async function getDbMeta(): Promise<DBMeta> {
  // first check local
  const dbMetaFilePath = getDbMetaFilePath();
  const dbMeta = await readJSONFile(dbMetaFilePath) as DBMeta;
  return dbMeta;
}
export async function getDbCachedStars(): Promise<
  Record<string, ExpiredValue>
> {
  // first check local
  const dbMetaFilePath = getDbStarsPath();
  try {
    const dbMeta = await readJSONFile(dbMetaFilePath) as Record<
      string,
      ExpiredValue
    >;
    return dbMeta;
  } catch (_e) {
    return {};
  }
}
export function writeDbCachedStars(stars: Record<string, ExpiredValue>) {
  const dbMetaFilePath = getDbStarsPath();
  return writeJSONFile(dbMetaFilePath, stars);
}
export async function getDbIndex(): Promise<DBIndex> {
  // first check local
  const dbMetaFilePath = getDbIndexFilePath();
  const dbMeta = await readJSONFile(dbMetaFilePath) as DBIndex;
  return dbMeta;
}
export async function writeDbMeta(dbMeta: DBMeta): Promise<void> {
  // first check local
  const dbMetaFilePath = getDbMetaFilePath();
  await writeJSONFile(dbMetaFilePath, dbMeta);
}

export async function writeDbIndex(dbIndex: DBIndex): Promise<void> {
  // first check local
  const dbIndexFilePath = getDbIndexFilePath();
  await writeJSONFile(dbIndexFilePath, dbIndex);
}
export function getRemoteData<T>(_file: string): T {
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
  return pathnameToFilePath(pathname);
}
export function pathnameToFilePath(pathname: string): string {
  // is ends with /
  const basename = posixPath.basename(pathname);
  if (pathname.endsWith("/") || !basename.includes(".")) {
    return posixPath.join(
      "/",
      CONTENT_DIR,
      pathname.slice(1),
      INDEX_MARKDOWN_PATH,
    );
  } else if (pathname.endsWith(".md")) {
    return posixPath.join("/", CONTENT_DIR, pathname.slice(1));
  } else {
    return pathname;
  }
}
export function pathnameToWeekFilePath(pathname: string): string {
  return posixPath.join(
    "/",
    CONTENT_DIR,
    pathname.slice(1),
    "week",
    INDEX_MARKDOWN_PATH,
  );
}
export function pathnameToOverviewFilePath(pathname: string): string {
  return posixPath.join(
    "/",
    CONTENT_DIR,
    pathname.slice(1),
    "readme",
    INDEX_MARKDOWN_PATH,
  );
}
export function pathnameToFeedUrl(pathname: string, isDay: boolean): string {
  const domain = getDomain();
  return domain + posixPath.join(pathname, isDay ? "" : "week", "feed.xml");
}
export async function got(
  url: string,
  init: RequestInit = {},
): Promise<string> {
  const c = new AbortController();
  const id = setTimeout(() => c.abort(), 30000);
  const headers = new Headers(init.headers);
  headers.set(
    "User-Agent",
    "Mozilla/5.0 (Windows NT 10.0; rv:105.0) Gecko/20100101 Firefox/105.0",
  );
  const params: RequestInit = {
    ...init,
    headers,
    signal: c.signal,
  };
  const r = await fetch(url, params);
  clearTimeout(id);

  if (r.ok) {
    return r.text();
  } else {
    throw new Error(`fetch ${url} failed with status ${r.status}`);
  }
}
export function getCachedFolder(
  url: string,
  method: string,
  isDb: boolean,
): string {
  const urlObj = new URL(url);
  const host = urlObj.host;
  const pathname = urlObj.pathname;
  const params = urlObj.searchParams;
  const cacheFileFolder = path.join(
    getCachePath(isDb),
    "http",
    encodeURIComponent(host),
    method,
    pathname,
    encodeURIComponent(params.toString()),
  );
  return cacheFileFolder;
}
export function getCachedFileInfo(
  url: string,
  method: string,
  isDb: boolean,
  expired: number,
): string[] {
  return [getCachedFolder(url, method, isDb), (Date.now() + expired) + ".txt"];
}

export async function writeCacheFile(
  url: string,
  method: string,
  body: string,
  isDb: boolean,
  expired?: number,
) {
  expired = expired || 1000 * 60 * 60 * 24 * 3;
  if (isDev()) {
    expired = expired || 1000 * 60 * 60 * 24 * 30;
  }
  const [cacheFileFolder, cacheFilePath] = getCachedFileInfo(
    url,
    method,
    isDb,
    expired,
  );
  await writeTextFile(path.join(cacheFileFolder, cacheFilePath), body);
  return body;
}

export async function readCachedFile(
  url: string,
  method: string,
  isDb: boolean,
): Promise<string> {
  // check folder is exists
  const cachedFolder = getCachedFolder(url, method, isDb);
  for await (const file of Deno.readDir(cachedFolder)) {
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
export async function gotWithDbCache(
  url: string,
  init: RequestInit,
  options?: CustomRequestOptions,
): Promise<string> {
  // check is exists cache
  let cacheFileContent;
  try {
    cacheFileContent = await readCachedFile(url, init?.method ?? "GET", true);
    log.debug(`use cache file for ${url}`);
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
  const expires = options?.expires ?? 15 * 24 * 60 * 60 * 1000;

  await writeCacheFile(
    url,
    init?.method ?? "GET",
    responseText,
    true,
    expires,
  );
  return responseText;
}
export async function gotWithCache(
  url: string,
  init: RequestInit,
  options?: CustomRequestOptions,
): Promise<string> {
  // check is exists cache
  let cacheFileContent;
  try {
    cacheFileContent = await readCachedFile(url, init?.method ?? "GET", false);
    log.debug(`use cache file for ${url}`);
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
  const expires = options?.expires ?? 3 * 24 * 60 * 60 * 1000;
  await writeCacheFile(
    url,
    init?.method ?? "GET",
    responseText,
    false,
    expires,
  );
  return responseText;
}

export async function gotGithubStar(
  owner: string,
  repo: string,
  dbCachedStars: Record<string, ExpiredValue>,
): Promise<string> {
  // check is there is any cache
  const key = `${owner}/${repo}`;
  const cached = getDbExpiredItem(dbCachedStars, key);
  if (cached !== undefined) {
    return cached;
  }

  const url = `https://img.shields.io/github/stars/${key}`;
  const response = await gotWithCache(url, {});
  const endWith = "</text></a></g></svg>";

  if (response.endsWith(endWith)) {
    const text = response.slice(0, -endWith.length);
    const start = text.lastIndexOf(">") + 1;
    const star = text.slice(start);
    // write to cache
    writeDbExpiredItem(
      dbCachedStars,
      key,
      star,
      15 * 24 * 60 * 60 * 1000,
    );

    return star;
  } else {
    log.debug(`got github star failed for ${owner}/${repo}`);
    return "";
  }
  // parse svg got start count
}

export async function promiseLimit<T>(
  funcs: (() => Promise<T>)[],
  limit = 100,
): Promise<T[]> {
  let results: T[] = [];
  while (funcs.length) {
    // 100 at a time
    results = [
      ...results,
      ...await Promise.all(funcs.splice(0, limit).map((f) => f())),
    ];
    log.debug(`promise limit ${funcs.length} left`);
  }
  return results;
}
export const formatUTC = (date: Date, formatString: string) => {
  date = new Date(date.getTime() + 0 * 60 * 60 * 1000);
  const formatter = new DateTimeFormatter(formatString);
  return formatter.format(date, {
    timeZone: "UTC",
  });
};
export const formatHumanTime = (date: Date) => {
  const now = new Date();

  const nowYear = formatUTC(now, "yyyy");
  const dateYear = formatUTC(date, "yyyy");
  const isThisYear = nowYear === dateYear;

  if (isThisYear) {
    return formatUTC(date, "MM/dd");
  } else {
    return formatUTC(date, "yy/MM/dd");
  }
};
export const formatNumber = (num: number): string => {
  const formatter = Intl.NumberFormat("en", { notation: "compact" });
  return formatter.format(num);
};

export function getBaseFeed(): BaseFeed {
  const domain = getDomain();
  return {
    version: "https://jsonfeed.org/version/1",
    icon: `${domain}/icon.png`,
    favicon: `${domain}/favicon.ico`,
    language: "en",
  };
}
export const slug = function (tag: string): string {
  // @ts-ignore: npm module
  return slugFn(kebabCase(tag));
};
export function formatPaginationHtml(
  page: PaginationInfo,
  currentPathname: string,
): string {
  let text = "";
  const isWeek = currentPathname.endsWith("/week/");
  if (page.prev || page.next) {
    text += "<hr>";
  }
  text += "<ul>";
  if (isWeek) {
    if (page.prev) {
      text +=
        `<li> Prev: <a href="${(page.prev
          .pathname)}">${page.prev.title}</a></li>`;
    }
    if (page.next) {
      text +=
        `<li> Next: <a href="${(page.next
          .pathname)}">${page.next.title}</a></li>`;
    }
  } else {
    if (page.prev) {
      text +=
        `<li> Prev: <a href="${(page.prev
          .pathname)}">${page.prev.title}</a></li>`;
    }
    if (page.next) {
      text +=
        `<li> Next: <a href="${(page.next
          .pathname)}">${page.next.title}</a></li>`;
    }
  }
  text += "</ul>";
  return text;
}

export function formatPagination(
  page: PaginationInfo,
  currentPathname: string,
): string {
  let text = "";
  let isWeek = currentPathname.endsWith("/week/");
  let isOverview = currentPathname.endsWith("/readme/");
  if (page.prev || page.next) {
    text += "\n\n---";
  }
  if (isWeek) {
    if (page.prev) {
      text += `\n\n- Prev: [${page.prev.title}](${
        pathnameToWeekFilePath(page.prev.pathname)
      })`;
    }
    if (page.next) {
      text += `${page.prev ? "\n" : "\n\n"}- Next: [${page.next.title}](${
        pathnameToWeekFilePath(page.next.pathname)
      })`;
    }
  } else if (isOverview) {
    if (page.prev) {
      text += `\n\n- Prev: [${page.prev.title}](${
        pathnameToOverviewFilePath(page.prev.pathname)
      })`;
    }
    if (page.next) {
      text += `${page.prev ? "\n" : "\n\n"}- Next: [${page.next.title}](${
        pathnameToOverviewFilePath(page.next.pathname)
      })`;
    }
  } else {
    if (page.prev) {
      text += `\n\n- Prev: [${page.prev.title}](${
        pathnameToFilePath(page.prev.pathname)
      })`;
    }
    if (page.next) {
      text += `${page.prev ? "\n" : "\n\n"}- Next: [${page.next.title}](${
        pathnameToFilePath(page.next.pathname)
      })`;
    }
  }
  return text;
}

export function getPaginationTextByNumber(
  currentNumber: number,
  allDays: (DayInfo | WeekOfYear)[],
): string {
  const currentDay = allDays.find((day: DayInfo | WeekOfYear) =>
    day.number === currentNumber
  );
  if (currentDay === undefined) {
    return "";
  }
  const currentDayIndex = allDays.indexOf(currentDay);
  const prevDay = allDays[currentDayIndex - 1];
  const nextDay = allDays[currentDayIndex + 1];

  const paginationText = formatPagination({
    prev: prevDay === undefined ? undefined : {
      title: prevDay.name,
      pathname: "/" + prevDay.path + "/",
    },
    next: nextDay === undefined ? undefined : {
      title: nextDay.name,
      pathname: "/" + nextDay.path + "/",
    },
  }, "/" + currentDay.path + "/");
  return paginationText;
}

export function getPaginationHtmlByNumber(
  currentNumber: number,
  allDays: (DayInfo | WeekOfYear)[],
): string {
  const currentDay = allDays.find((day: DayInfo | WeekOfYear) =>
    day.number === currentNumber
  );
  if (currentDay === undefined) {
    return "";
  }
  const currentDayIndex = allDays.indexOf(currentDay);
  const prevDay = allDays[currentDayIndex - 1];
  const nextDay = allDays[currentDayIndex + 1];

  const paginationText = formatPaginationHtml({
    prev: prevDay === undefined ? undefined : {
      title: prevDay.name,
      pathname: "/" + prevDay.path + "/",
    },
    next: nextDay === undefined ? undefined : {
      title: nextDay.name,
      pathname: "/" + nextDay.path + "/",
    },
  }, "/" + currentDay.path + "/");
  return paginationText;
}
export function getnextPaginationTextByNumber(
  currentNumber: number,
  allDays: (DayInfo | WeekOfYear)[],
): string {
  const currentDay = allDays.find((day: DayInfo | WeekOfYear) =>
    day.number === currentNumber
  );
  if (currentDay === undefined) {
    return "";
  }
  const currentDayIndex = allDays.indexOf(currentDay);
  const nextDay = allDays[currentDayIndex + 1];

  const paginationText = formatPagination({
    prev: undefined,
    next: nextDay === undefined ? undefined : {
      title: nextDay.name,
      pathname: "/" + nextDay.path + "/",
    },
  }, "/" + currentDay.path + "/");
  return paginationText;
}
export function getDbItemsPath(
  sourceIdentifier: string,
  filepath: string,
): string {
  return path.join(
    getDbPath(),
    "repos",
    sourceIdentifier,
    filepath,
    "items.json",
  );
}
export function getDbContentPath(
  sourceIdentifier: string,
  filepath: string,
): string {
  return path.join(
    getDbPath(),
    "repos",
    sourceIdentifier,
    filepath,
    "README.md",
  );
}

export function getDbContentHtmlPath(
  sourceIdentifier: string,
  filepath: string,
): string {
  return path.join(
    getDbPath(),
    "repos",
    sourceIdentifier,
    filepath,
    "README.html",
  );
}
export function nav1ToMarkdown(nav1: Nav[]) {
  return nav1.map((item) => {
    if (item.url) {
      return `[${item.name}](${item.markdown_url || item.url})`;
    } else {
      return item.name;
    }
  }).join(" · ");
}
export function nav2ToMarkdown(nav1: Nav[]) {
  return "[ " + nav1.map((item) => {
    if (item.url && !item.active) {
      return `[${item.name}](${item.markdown_url || item.url})`;
    } else {
      return item.name;
    }
  }).join(" / ") + " ]";
}
export function nav1ToHtml(nav1: Nav[]) {
  return nav1.map((item) => {
    if (item.url) {
      return `<a href="${item.url}">${item.name}</a>`;
    } else {
      return `<span>${item.name}</span>`;
    }
  }).join("<span> · </span>");
}
export function nav2ToHtml(nav1: Nav[]) {
  return "<span>[ </span>" + nav1.map((item) => {
    if (item.url && !item.active) {
      return `<a href="${item.url}">${item.name}</a>`;
    } else {
      return `<span>${item.name}</span>`;
    }
  }).join("<span> / </span>") + "<span> ]</span>";
}

export function getDbStarsPath() {
  return path.join(getDbPath(), "stars.json");
}

export function writeDbExpiredItem(
  json: Record<string, ExpiredValue>,
  key: string,
  value: string,
  expired: number,
) {
  const now = Date.now();
  const expiredAt = now + expired;
  json[key] = [expiredAt, value];
}

export function getDbExpiredItem(
  json: Record<string, ExpiredValue>,
  key: string,
): string | undefined {
  const now = Date.now();
  const value = json[key];
  if (value === undefined) {
    return undefined;
  }
  if (value[0] < now) {
    delete json[key];
    return undefined;
  }
  return value[1];
}

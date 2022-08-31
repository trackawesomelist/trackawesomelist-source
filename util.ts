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
import {
  ApiInfo,
  Config,
  DBMeta,
  Item,
  ItemsJson,
  ParsedFilename,
  RawConfig,
  RawSource,
  RawSourceFile,
  RepoMeta,
  Source,
  SourceFile,
} from "./interface.ts";
export const defaultFileType = "markdownlist";
export const defaultFilePath = "README.md";
export function isDev() {
  return Deno.env.get("PROD") !== "1";
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

  let file: SourceFile[] = [
    {
      path: "README.md",
      type: defaultFileType,
    },
  ];
  if (value) {
    if (value.url) {
      url = value.url;
    }
    if (value.file) {
      file = [];
      if (Array.isArray(value.file)) {
        for (const fileValue of value.file) {
          file.push(formatFileConfigValue(fileValue));
        }
      } else {
        file.push(formatFileConfigValue(value.file));
      }
    }
  }

  return {
    identifier: key,
    url,
    file,
  };
}
function formatFileConfigValue(fileValue: string | RawSourceFile): SourceFile {
  if (typeof fileValue === "string") {
    return {
      path: fileValue,
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

export async function readJSONFile(path: string) {
  return JSON.parse(await readTextFile(path));
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
    removeExtname(file),
    "items.json",
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

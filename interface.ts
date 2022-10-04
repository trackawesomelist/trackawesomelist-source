import { Content, DB } from "./deps.ts";
export interface WeekOfYear {
  year: number;
  week: number;
  number: number;
  path: string;
  date: Date;
  name: string;
}
export interface BuiltMarkdownInfo {
  commitMessage: string;
}
export interface RepoMetaOverride {
  default_branch?: string;
}
export interface ParseOptions {
  min_heading_level?: number;
  max_heading_level?: number;
  heading_level?: number; // only need for heading type
  type: "table" | "list";
  is_parse_category?: boolean;
}
export interface DayInfo {
  year: number;
  month: number;
  day: number;
  number: number;
  path: string;
  name: string;
  date: Date;
}
export type LevelName = "debug" | "info" | "warn" | "error" | "fatal";
export interface File {
  source_identifier: string;
  file: string;
}
export enum Level {
  Debug = 0,
  Info = 1,
  Warn = 2,
  Error = 3,
  Fatal = 4,
}
export interface ApiInfo {
  url: string;
  headers: Headers;
}
export interface RawSource {
  default_branch?: string;
  url?: string;
  files?: Record<string, RawSourceFile> | string;
}
export interface ParsedItemsFilePath {
  originalFilepath: string;
  sourceIdentifier: string;
}
export interface RawConfig {
  sources: Record<string, RawSource | undefined>;
  file_min_updated_hours: number;
}
export interface RawSourceFile {
  index?: boolean;
  options?: ParseOptions;
}
export interface PageItem {
  source_identifier: string;
  file: string;
  category: string;
  updated_at: string;
  updated_day_on: string;
  markdown: string;
}
export interface PageCategoryItem {
  category: string;
  items: PageItem[];
}
export interface PageData {
  groups: PageGroup[];
  repo_meta?: RepoMeta;
  file_config?: FileConfig;
  source_file_url?: string;
}
export interface FileInfo {
  repoMeta: RepoMeta;
  fileConfig: FileConfig;
  sourceIdentifier: string;
}
export interface FormatMarkdownItemOptions {
  repoUrl: string;
  defaultBranch: string;
  filepath: string;
}
export interface PageGroup {
  group_name: string;
  group_suffix: string;
  items: PageCategoryItem[];
}
export interface RawSourceFileWithType extends RawSourceFile {
  options: ParseOptions;
}
export interface FileConfig extends RawSourceFile {
  filepath: string;
  pathname: string;
  name: string;
  options: ParseOptions;
}
export interface Source {
  identifier: string;
  url: string;
  default_branch?: string;
  files: Record<string, FileConfig>;
}
export interface Config extends RawConfig {
  sources: Record<string, Source>;
}
export interface RunOptions {
  config: Config;
  sourceIdentifiers: string[];
  force: boolean;
  push: boolean;
  port: number;
  db: DB;
}
export interface Item {
  updated_at: string;
  category: string;
  markdown: string;
  sha1: string;
  source_identifier: string;
  file: string;
  checked_at: string;
}
export interface ItemDetail extends Item {
  updated_day: number;
  updated_week: number;
  updated_day_info: DayInfo;
  updated_week_info: WeekOfYear;
}
export interface DocItem {
  rawMarkdown: string;
  formatedMarkdown: string;
  category: string;
  line: number;
}

export interface RepoMeta {
  name: string;
  description: string;
  url: string;
  default_branch: string;
  language: string | undefined;
  stargazers_count: number;
  watchers_count: number;
  forks_count: number;
  tags: string[];
  created_at: string;
  updated_at: string;
  checked_at: string;
}

export interface ItemsJson {
  items: Record<string, Item>;
}

export interface ParsedFilename {
  name: string;
  ext: string;
  type: string;
}
export interface FileMeta {
  sha1: string;
  checked_at: string;
  document_created_at: string;
  updated_at: string;
  created_at: string;
}

export interface FileMetaWithSource extends FileMeta {
  sourceIdentifier: string;
  filepath: string;
}

export interface DbMetaSource {
  files: Record<string, FileMeta>;
  meta: RepoMeta;
  created_at: string;
  updated_at: string;
}
export interface DBMeta {
  sources: Record<string, DbMetaSource>;
  checked_at: string;
}

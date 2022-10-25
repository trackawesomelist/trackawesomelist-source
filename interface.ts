import { Content } from "./deps.ts";
export type ExpiredValue = [number, string];
export interface WeekOfYear {
  year: number;
  week: number;
  number: number;
  path: string;
  date: Date;
  id: string;
  name: string;
}
export interface CustomRequestOptions {
  expires?: number;
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
  type: "table" | "list" | "heading";
  is_parse_category?: boolean;
}
export interface DayInfo {
  year: number;
  month: number;
  day: number;
  number: number;
  path: string;
  name: string;
  id: string;
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
  category?: string;
  default_branch?: string;
  url?: string;
  files?: Record<string, RawSourceFile> | string;
}
export interface ParsedItemsFilePath {
  originalFilepath: string;
  sourceIdentifier: string;
}
export interface Site {
  title: string;
  description: string;
  url: string;
}
export interface RawConfig {
  sources: Record<string, RawSource | undefined>;
  file_min_updated_hours: number;
  site: Site;
}
export interface RawSourceFile {
  index?: boolean;
  name?: string;
  options?: ParseOptions;
}

export interface FileConfigInfo {
  sourceConfig: Source;
  filepath: string;
}
export interface FileInfo extends FileConfigInfo {
  sourceMeta: DbMetaSource;
  filepath: string;
}
export interface FormatMarkdownItemOptions {
  repoUrl: string;
  defaultBranch: string;
  filepath: string;
}
export interface RawSourceFileWithType extends RawSourceFile {
  options: ParseOptions;
}
export interface Nav {
  name: string;
  active?: boolean;
  markdown_url?: string;
  url?: string;
}
export interface FeedConfig {
  nav1: Nav[];
  nav2?: Nav[];
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
  category: string;
  files: Record<string, FileConfig>;
}
export interface ListItem {
  name: string;
  updated: string;
  url: string;
  meta: RepoMeta;
  star: string;
  source_url: string;
}
export interface List {
  category: string;
  items: ListItem[];
}
export interface Config extends RawConfig {
  sources: Record<string, Source>;
}
export interface RunOptions extends CliOptions {
  config: Config;
  sourceIdentifiers: string[];
}
export interface CliOptions {
  debug?: boolean;
  force?: boolean;
  forceFetch?: boolean;
  push?: boolean;
  autoInit?: boolean;
  fetchRepoUpdates: boolean;
  markdown: boolean;
  fetch: boolean;
  dayMarkdown: boolean;
  rebuild?: boolean;
  html?: boolean;
  serve: boolean;
  port: number;
  limit?: number;
}
export interface Item {
  updated_at: string;
  updated_day: number;
  updated_week: number;
  category: string;
  category_html: string;
  markdown: string;
  html: string;
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

export interface Pagination {
  title: string;
  pathname: string;
}
export interface PaginationInfo {
  prev: Pagination | undefined;
  next: Pagination | undefined;
}
export interface BuildOptions {
  paginationText: string;
  dbMeta: DBMeta;
  dbIndex: DBIndex;
}
export interface RepoMeta {
  name: string;
  description: string;
  url: string;
  default_branch: string;
  language: string | undefined;
  stargazers_count: number;
  subscribers_count: number;
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
  created_at: string;
  updated_at: string;
  meta_created_at: string;
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
export interface IndexItem {
  t: number;
  d: number;
  w: number;
}
export type DBIndex = Record<string, IndexItem>;
export interface Author {
  url: string;
  name: string;
  avatar?: string;
}

export interface FeedItem {
  id: string;
  image?: string;
  url: string;
  _slug: string;
  _filepath: string;
  date_published: string;
  date_modified: string;
  tags?: string[];
  authors?: Author[];
  title: string;
  _short_title?: string;
  author?: Author;
  content_text: string;
  content_html: string;
}

export interface BaseFeed {
  version: string;
  icon: string;
  favicon: string;
  language: string;
}
export interface FeedInfo extends BaseFeed {
  title: string;
  _site_title: string;
  _seo_title: string;
  description: string;
  home_page_url: string;
  feed_url: string;
}
export interface Feed extends FeedInfo {
  items: FeedItem[];
}

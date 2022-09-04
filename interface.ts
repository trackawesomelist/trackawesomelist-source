import { Content } from "./deps.ts";
export type LevelName = "debug" | "info" | "warn" | "error" | "fatal";

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
  type?: string;
  index?: boolean;
}
export interface PageItem {
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
}
export interface PageGroup {
  updated_day_on: string;
  items: PageCategoryItem[];
}
export interface RawSourceFileWithType extends RawSourceFile {
  type: string;
}
export interface SourceFile extends RawSourceFile {
  original_filepath: string;
  pathname: string;
  type: string;
  name: string;
}
export interface Source {
  identifier: string;
  url: string;
  files: Record<string, SourceFile>;
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
}
export interface Item {
  updated_at: string;
  category: string;
}
export interface DocItem {
  markdown: string;
  category: string;
  line: number;
}

export interface RepoMeta {
  name: string;
  description: string;
  url: string;
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
  original_created_at: string;
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
}

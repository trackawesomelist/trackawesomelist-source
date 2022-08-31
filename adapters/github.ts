import API from "./api.ts";
import { RepoMeta, Source } from "../interface.ts";
import { base64 } from "../deps.ts";
export default class github extends API {
  repo: string;
  headers: Headers;
  apiPrefix = `https://api.github.com`;
  constructor(source: Source) {
    super(source);
    const githubToken = Deno.env.get("GITHUB_TOKEN");
    if (!githubToken) {
      throw new Error("GITHUB_TOKEN is not set");
    }
    const headerAuthorization = `token ${githubToken}`;
    this.headers = new Headers({
      Authorization: headerAuthorization,
    });
    const urlObj = new URL(source.url);
    this.repo = urlObj.pathname.slice(1);
    if (this.repo.endsWith(".git")) {
      this.repo = this.repo.slice(0, -4);
    }
    if (this.repo.endsWith("/")) {
      this.repo = this.repo.slice(0, -1);
    }
  }
  getCloneUrl(): string {
    return `https://github.com/${this.repo}.git`;
  }
  async getConent(filePath: string): Promise<string> {
    const url = `${this.apiPrefix}/repos/${this.repo}/contents/${filePath}`;
    const result = await fetch(
      url,
      {
        headers: this.headers,
      },
    );
    if (result.ok) {
      const data = await result.json();
      const content = base64.decode(data.content);
      return new TextDecoder().decode(content);
    } else {
      throw new Error(`fetch ${url} failed, ${result.status}`);
    }
  }
  async getRepoMeta(): Promise<RepoMeta> {
    const url = `${this.apiPrefix}/repos/${this.repo}`;
    const result = await fetch(
      url,
      {
        headers: this.headers,
      },
    );
    if (result.ok) {
      const data = await result.json();

      const repoMeta: RepoMeta = {
        name: data.name,
        description: data.description,
        url: data.html_url,
        language: data.language,
        stargazers_count: data.stargazers_count,
        watchers_count: data.watchers_count,
        forks_count: data.forks_count,
        tags: data.topics,
        updated_at: data.pushed_at,
        created_at: data.created_at,
        checked_at: new Date().toISOString(),
      };
      return repoMeta;
    } else {
      throw new Error(`fetch ${url} failed, ${result.status}`);
    }
  }
}

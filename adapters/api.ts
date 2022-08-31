import { RepoMeta, Source } from "../interface.ts";
export default class API {
  source: Source;
  constructor(source: Source) {
    this.source = source;
  }
  getConent(_filePath: string): Promise<string> {
    return Promise.reject("not implemented");
  }
  getRepoMeta(): Promise<RepoMeta> {
    return Promise.reject("not implemented");
  }
}

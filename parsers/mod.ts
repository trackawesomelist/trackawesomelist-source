import markdownlist from "./markdownlist.ts";
import { DocItem } from "../interface.ts";
const parsers: Record<string, (content: string) => DocItem[]> = {
  markdownlist,
};
export default parsers;

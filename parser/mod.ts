import markdownList from "./markdown/list.ts";
import markdownTable from "./markdown/table.ts";
import markdownHeading from "./markdown/heading.ts";
import { DocItem, FileInfo } from "../interface.ts";

export default function (
  content: string,
  options: FileInfo,
): Promise<DocItem[]> {
  const fileConfig = options.sourceConfig.files[options.filepath];
  const type = fileConfig.options.type;
  if (type === "list") {
    return markdownList(content, options);
  }
  if (type === "table") {
    return markdownTable(content, options);
  }
  if (type === "heading") {
    return markdownHeading(content, options);
  }
  throw new Error(`unknown type ${type}`);
}

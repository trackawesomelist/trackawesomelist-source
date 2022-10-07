import { Command } from "./deps.ts";
import main from "./main.ts";
export default async function tal() {
  await new Command()
    .name("tal")
    .version("0.1.0")
    .description("Track Markdown Files Changes")
    .env("DEBUG=<enable:boolean>", "Enable debug output.")
    .env("FORCE=<enable:boolean>", "Enable force update.")
    .option("-d, --debug", "Enable debug output.")
    .option("-f, --force", "Force update.")
    .option("-p, --push", "Push markdown to remote.")
    .option("--no-fetch", "Don't fetch remote sources.")
    .option("--no-markdown", "do not build markdown file.")
    .option("--html", "Build html files.")
    .option("--no-serve", "Serve site.")
    .option(
      "--no-auto-init",
      "do not auto init db meta, for avoid load remote db failed",
    ).option(
      "--port <port:number>",
      "Serve site port.",
      {
        default: 8000,
      },
    )
    .arguments("[files...:string]")
    .action((options, ...args) => {
      console.log(options, args);
      main(options, ...args);
    })
    .parse(Deno.args);
}

if (import.meta.main) {
  await tal();
}

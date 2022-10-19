import { Command } from "./deps.ts";
import main from "./main.ts";
export default async function tal() {
  await new Command()
    .name("tal")
    .version("0.1.0")
    .description("Track Markdown Files Changes")
    .env("DEBUG=<enable:boolean>", "Enable debug output.")
    .env("FORCE=<enable:boolean>", "Enable force update.")
    .env("FORCE_FETCH=<enable:boolean>", "Enable force update fetch.")
    .env("PUSH=<enable:boolean>", "Enable push to remote repo.")
    .env("REBUILD=<enable:boolean>", "Enable rebuild.")
    .env("LIMIT=<enable:number>", "Limit sources to build, for debug.")
    .env("DAY_MARKDOWN=<disable:boolean>", "Disable day markdown output.")
    .env(
      "FETCH_REPO_UPDATES=<disable:boolean>",
      "fetch repo updates when init there is a cache. for dev fast test",
    )
    .option("-d, --debug", "Enable debug output.")
    .option("-f, --force", "Force update markdown.")
    .option("--force-fetch", "Force update sources.")
    .option("--rebuild", "rebuild updates from git repo")
    .option("-p, --push", "Push markdown to remote.")
    .option("--no-fetch", "Don't fetch remote sources.")
    .option("--no-markdown", "do not build markdown file.")
    .option("--no-day-markdown", "do not build day markdown file.")
    .option("--no-fetch-repo-updates", "do not fetch repo updates.")
    .option("--html", "Build html files.")
    .option("--no-serve", "Serve site.")
    .option("--limit <limit:number>", "Limit number of sources to process.")
    .option(
      "--auto-init",
      "auto init db meta, for avoid load remote db failed",
    ).option(
      "--port <port:number>",
      "Serve site port.",
      {
        default: 8000,
      },
    )
    .arguments("[files...:string]")
    .action((options, ...args) => {
      main(options, ...args);
    })
    .parse(Deno.args);
}

if (import.meta.main) {
  await tal();
}

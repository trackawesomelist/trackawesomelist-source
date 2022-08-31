import { colors } from "./deps.ts";
import { Level, LevelName } from "./interface.ts";

export class Timing {
  #t = performance.now();

  reset() {
    this.#t = performance.now();
  }

  stop(message: string) {
    const now = performance.now();
    const d = Math.round(now - this.#t);
    let cf = colors.green;
    if (d > 10000) {
      cf = colors.red;
    } else if (d > 1000) {
      cf = colors.yellow;
    }
    console.debug(colors.dim("TIMING"), message, "in", cf(d + "ms"));
    this.#t = now;
  }
}

export class Logger {
  #level: Level = Level.Info;

  get level(): Level {
    return this.#level;
  }

  setLevel(level: LevelName): void {
    switch (level) {
      case "debug":
        this.#level = Level.Debug;
        break;
      case "info":
        this.#level = Level.Info;
        break;
      case "warn":
        this.#level = Level.Warn;
        break;
      case "error":
        this.#level = Level.Error;
        break;
      case "fatal":
        this.#level = Level.Fatal;
        break;
    }
  }

  debug(...args: unknown[]): void {
    if (this.#level <= Level.Debug) {
      console.debug(colors.dim("DEBUG"), ...args);
    }
  }

  info(...args: unknown[]): void {
    if (this.#level <= Level.Info) {
      console.log(colors.green("INFO"), ...args);
    }
  }

  warn(...args: unknown[]): void {
    if (this.#level <= Level.Warn) {
      console.warn(colors.yellow("WARN"), ...args);
    }
  }

  error(...args: unknown[]): void {
    if (this.#level <= Level.Error) {
      console.error(colors.red("ERROR"), ...args);
    }
  }

  fatal(...args: unknown[]): void {
    if (this.#level <= Level.Fatal) {
      console.error(colors.red("FATAL"), ...args);
      Deno.exit(1);
    }
  }

  timing(): { reset(): void; stop(message: string): void } {
    if (this.level === Level.Debug) {
      return new Timing();
    }
    return { reset: () => {}, stop: () => {} };
  }
}

export default new Logger();

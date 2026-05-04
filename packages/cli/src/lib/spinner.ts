import chalk from "chalk";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const INTERVAL_MS = 80;

export interface Spinner {
  start(): void;
  stop(finalText?: string): void;
}

export function createSpinner(text: string): Spinner {
  let frameIndex = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  return {
    start() {
      if (timer) return;
      process.stdout.write("\x1B[?25l"); // hide cursor
      timer = setInterval(() => {
        const frame = chalk.cyan(FRAMES[frameIndex % FRAMES.length]);
        process.stdout.write(`\r${frame} ${text}`);
        frameIndex++;
      }, INTERVAL_MS);
    },

    stop(finalText?: string) {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      process.stdout.write("\r\x1B[K"); // clear line
      process.stdout.write("\x1B[?25h"); // show cursor
      if (finalText) {
        console.log(finalText);
      }
    },
  };
}

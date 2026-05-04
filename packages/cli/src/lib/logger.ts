import chalk from "chalk";

export const log = {
  success(msg: string) {
    console.log(chalk.green("✓") + " " + msg);
  },
  error(msg: string) {
    console.error(chalk.red("✗") + " " + msg);
  },
  info(msg: string) {
    console.log(chalk.blue("ℹ") + " " + msg);
  },
  warn(msg: string) {
    console.log(chalk.yellow("⚠") + " " + msg);
  },
  plain(msg: string) {
    console.log(msg);
  },
  /** Print a doctor-style check line */
  check(label: string, status: "pass" | "fail" | "warn" | "skip") {
    const icons = {
      pass: chalk.green("[OK]"),
      fail: chalk.red("[FAIL]"),
      warn: chalk.yellow("[WARN]"),
      skip: chalk.dim("[SKIP]"),
    };
    console.log(`  ${icons[status]}  ${label}`);
  },
};

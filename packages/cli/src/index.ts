import { Command } from "commander";
import { authCommand } from "./commands/auth/index.js";
import { doctorCommand } from "./commands/doctor.js";
import { promptCommand } from "./commands/prompt/index.js";
import { watchCommand } from "./commands/watch.js";
import { sessionCommand } from "./commands/session/index.js";
import { VERSION } from "./lib/constants.js";

const program = new Command()
  .name("sprintiq")
  .description("SprintIQ CLI — manage your workspace from the terminal")
  .version(VERSION, "-v, --version")
  .addCommand(authCommand)
  .addCommand(doctorCommand)
  .addCommand(promptCommand)
  .addCommand(watchCommand)
  .addCommand(sessionCommand);

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});

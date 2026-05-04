import { Command } from "commander";
import { loginCommand } from "./login.js";
import { logoutCommand } from "./logout.js";
import { statusCommand } from "./status.js";

export const authCommand = new Command("auth")
  .description("Manage authentication")
  .addCommand(loginCommand)
  .addCommand(logoutCommand)
  .addCommand(statusCommand);

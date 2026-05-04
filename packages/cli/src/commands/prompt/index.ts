import { Command } from "commander";
import chalk from "chalk";
import { SprintIQAPIClient } from "../../lib/api-client.js";
import { getCredentials, writePromptFile } from "../../lib/config.js";
import { generatePrompt } from "../../lib/prompt-generator.js";
import { createSpinner } from "../../lib/spinner.js";
import { log } from "../../lib/logger.js";
import type { TaskPayloadResponse } from "../../types.js";

async function fetchTaskWithRetry(
  api: SprintIQAPIClient,
  taskId: string,
  includeSubtasks: boolean
): Promise<TaskPayloadResponse> {
  try {
    return await api.getTask(taskId, includeSubtasks);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Don't retry client errors
    if (message.includes("HTTP 404") || message.includes("not found")) {
      throw new Error(
        `Task ${taskId} not found. Check the task ID and try again.`
      );
    }
    if (message.includes("HTTP 403") || message.includes("Access denied")) {
      throw new Error(
        `Access denied for task ${taskId}. You may not have workspace access.`
      );
    }
    if (message.includes("HTTP 401") || message.includes("Invalid or expired")) {
      throw new Error(
        "Authentication failed. Run `sprintiq auth login` to re-authenticate."
      );
    }

    // Retry once on timeout / network errors
    await new Promise((r) => setTimeout(r, 1000));
    try {
      return await api.getTask(taskId, includeSubtasks);
    } catch (retryErr) {
      const retryMsg =
        retryErr instanceof Error ? retryErr.message : String(retryErr);
      throw new Error(
        `Failed to fetch task after retry: ${retryMsg}`
      );
    }
  }
}

interface PromptCommandOptions {
  includeSubtasks?: boolean;
  customInstructions?: string;
}

function createPromptAction(printToStdout: boolean) {
  return async (taskId: string, options: PromptCommandOptions) => {
    // Validate auth
    const creds = getCredentials();
    if (!creds) {
      log.error(
        "Not authenticated. Run " +
          chalk.bold("sprintiq auth login") +
          " first."
      );
      process.exit(1);
    }

    const api = new SprintIQAPIClient({ apiKey: creds.api_key });
    const spinner = createSpinner("Fetching task context...");

    try {
      spinner.start();
      const payload = await fetchTaskWithRetry(
        api,
        taskId,
        !!options.includeSubtasks
      );
      spinner.stop();

      const prompt = generatePrompt(payload.task, {
        includeSubtasks: !!options.includeSubtasks,
        customInstructions: options.customInstructions,
        taskUrl: payload.task_url,
      });

      const filePath = writePromptFile(payload.task.task_id, prompt);

      if (printToStdout) {
        console.log();
        console.log(prompt);
        console.log();
      }

      log.success(
        `Prompt saved to ${chalk.dim(filePath)}`
      );
    } catch (err) {
      spinner.stop();
      const message = err instanceof Error ? err.message : String(err);
      log.error(message);
      process.exit(1);
    }
  };
}

const sharedOptions = (cmd: Command) =>
  cmd
    .option("--include-subtasks", "Include incomplete subtasks in the prompt")
    .option(
      "--custom-instructions <text>",
      "Append custom instructions to the prompt"
    );

const previewCommand = sharedOptions(
  new Command("preview")
    .description("Fetch task context, generate prompt, and print to stdout")
    .argument("<task_id>", "The task ID to generate a prompt for")
).action(createPromptAction(true));

const generateCommand = sharedOptions(
  new Command("generate")
    .description("Fetch task context and save prompt to file")
    .argument("<task_id>", "The task ID to generate a prompt for")
).action(createPromptAction(false));

export const promptCommand = new Command("prompt")
  .description("Generate Claude Code prompts from task context")
  .addCommand(previewCommand)
  .addCommand(generateCommand);

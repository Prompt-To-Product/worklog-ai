import * as vscode from "vscode";
import { generateWorklog } from "./worklogGenerator";
import { getGitChanges } from "./gitUtils";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Registers Git hooks for automatic worklog generation
 */
export function registerGitIntegration(context: vscode.ExtensionContext) {
  // Store the last generated worklog
  let lastGeneratedWorklog: string | undefined;

  // Command to store worklog for later use
  context.subscriptions.push(
    vscode.commands.registerCommand("worklog-ai.storeWorklog", (worklog: string) => {
      lastGeneratedWorklog = worklog;
    })
  );

  // Listen for SCM input box changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (
        e.affectsConfiguration("worklogGenerator.includeWorklogInCommitMessage") &&
        vscode.workspace.getConfiguration("worklogGenerator").get("includeWorklogInCommitMessage")
      ) {
        // Get the SCM input box
        const inputBox = vscode.scm.inputBox;

        // If we have a stored worklog, append it to the commit message
        if (lastGeneratedWorklog && inputBox) {
          const currentMessage = inputBox.value;

          // Only append if the message doesn't already contain the worklog
          if (!currentMessage.includes(lastGeneratedWorklog)) {
            inputBox.value =
              currentMessage + (currentMessage ? "\n\n" : "") + "---\n" + lastGeneratedWorklog;
          }

          // Reset the setting
          await vscode.workspace
            .getConfiguration("worklogGenerator")
            .update("includeWorklogInCommitMessage", false, vscode.ConfigurationTarget.Workspace);
        }
      }
    })
  );

  // Register a command to generate worklog before commit
  context.subscriptions.push(
    vscode.commands.registerCommand("worklog-ai.generateWorklogBeforeCommit", async () => {
      const autoGenerate = vscode.workspace
        .getConfiguration("worklogGenerator")
        .get("autoGenerateOnCommit", false);

      if (autoGenerate) {
        try {
          const changes = await getGitChanges();

          if (!changes || changes.trim() === "") {
            return;
          }

          const llmProvider = vscode.workspace
            .getConfiguration("worklogGenerator")
            .get("defaultLlmProvider", "gemini");
          const worklogStyle = vscode.workspace
            .getConfiguration("worklogGenerator")
            .get("defaultWorklogStyle", "business");

          const worklog = await generateWorklog(changes, llmProvider, worklogStyle);

          // Store the worklog
          lastGeneratedWorklog = worklog;

          // Show notification
          const action = await vscode.window.showInformationMessage(
            "Worklog generated. Would you like to include it in your commit message?",
            "Yes",
            "No"
          );

          if (action === "Yes") {
            // Get the SCM input box
            const inputBox = vscode.scm.inputBox;

            if (inputBox) {
              const currentMessage = inputBox.value;

              // Only append if the message doesn't already contain the worklog
              if (!currentMessage.includes(worklog)) {
                inputBox.value =
                  currentMessage + (currentMessage ? "\n\n" : "") + "---\n" + worklog;
              }
            }
          }
        } catch (error) {
          console.error("Error generating worklog before commit:", error);
        }
      }
    })
  );

  // Add a Git pre-commit hook if possible
  setupGitHooks(context).catch((err) => {
    console.error("Failed to set up Git hooks:", err);
  });
}

/**
 * Set up Git hooks for the current repository
 */
async function setupGitHooks(context: vscode.ExtensionContext) {
  try {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;

    // Check if .git directory exists
    try {
      await execAsync("git rev-parse --git-dir", { cwd: rootPath });
    } catch (error) {
      // Not a git repository
      return;
    }

    // We could set up a Git pre-commit hook here, but that would require file system access
    // which might not be appropriate for a VS Code extension
    // Instead, we'll use the SCM API to detect when commits are about to happen

    // Register a command that can be triggered from the SCM view
    vscode.commands.registerCommand("worklog-ai.preCommitHook", async () => {
      await vscode.commands.executeCommand("worklog-ai.generateWorklogBeforeCommit");
    });
  } catch (error) {
    console.error("Error setting up Git hooks:", error);
  }
}

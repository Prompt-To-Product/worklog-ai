import * as vscode from "vscode";
import { generateWorklog } from "./worklogGenerator";
import { getGitChanges } from "./gitUtils";
import { exec } from "child_process";
import { promisify } from "util";
import ConfigService from "./configService";

const execAsync = promisify(exec);

export function registerGitIntegration(context: vscode.ExtensionContext) {
  let lastGeneratedWorklog: string | undefined;

  context.subscriptions.push(
    vscode.commands.registerCommand("worklog-ai.storeWorklog", (worklog: string) => {
      lastGeneratedWorklog = worklog;
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (
        e.affectsConfiguration("worklogGenerator.includeWorklogInCommitMessage") &&
        ConfigService.getIncludeWorklogInCommitMessage()
      ) {
        const inputBox = vscode.scm.inputBox;

        if (lastGeneratedWorklog && inputBox) {
          const currentMessage = inputBox.value;

          if (!currentMessage.includes(lastGeneratedWorklog)) {
            inputBox.value =
              currentMessage + (currentMessage ? "\n\n" : "") + "---\n" + lastGeneratedWorklog;
          }

          await ConfigService.setIncludeWorklogInCommitMessage(false);
        }
      }
    })
  );

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
          lastGeneratedWorklog = worklog;

          const action = await vscode.window.showInformationMessage(
            "Worklog generated. Would you like to include it in your commit message?",
            "Yes",
            "No"
          );

          if (action === "Yes") {
            const inputBox = vscode.scm.inputBox;

            if (inputBox) {
              const currentMessage = inputBox.value;

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

  setupGitHooks(context).catch((err) => {
    console.error("Failed to set up Git hooks:", err);
  });
}

async function setupGitHooks(context: vscode.ExtensionContext) {
  try {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;

    try {
      await execAsync("git rev-parse --git-dir", { cwd: rootPath });
    } catch (error) {
      return;
    }

    vscode.commands.registerCommand("worklog-ai.preCommitHook", async () => {
      await vscode.commands.executeCommand("worklog-ai.generateWorklogBeforeCommit");
    });
  } catch (error) {
    console.error("Error setting up Git hooks:", error);
  }
}

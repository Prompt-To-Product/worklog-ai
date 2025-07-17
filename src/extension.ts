import * as vscode from "vscode";
import * as fs from "fs";
import { generateWorklog } from "./worklogGenerator";
import { getGitChanges, getSelectedCommit } from "./gitUtils";
import { WorklogTreeDataProvider } from "./worklogTreeView";
import { WorklogPanel } from "./worklogPanel";
import { registerGitIntegration } from "./gitIntegration";

/**
 * Activates the Worklog AI extension, registering the tree view, Git integration, and all related commands for AI-powered worklog generation and configuration.
 *
 * This function sets up the extension's UI, command handlers, and configuration prompts, enabling users to generate, view, export, and manage worklogs using various AI providers and styles.
 */
export function activate(context: vscode.ExtensionContext) {
  console.log("Worklog AI extension is now active");

  // Register the TreeView
  const worklogTreeDataProvider = new WorklogTreeDataProvider(context);
  vscode.window.registerTreeDataProvider("worklogGeneratorView", worklogTreeDataProvider);

  // Register Git integration
  registerGitIntegration(context);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("worklog-ai.generateWorklog", async () => {
      try {
        // Get LLM provider choice
        const defaultLlmProvider = vscode.workspace
          .getConfiguration("worklogGenerator")
          .get("defaultLlmProvider", "gemini");
        const llmProvider = await vscode.window.showQuickPick(
          [
            {
              label: "Google Gemini (Default)",
              value: "gemini",
              description: "Uses gemini-2.0-flash model",
            },
            { label: "OpenAI", value: "openai", description: "Uses gpt-4o model" },
            { label: "Local LLM", value: "local", description: "Uses your locally hosted LLM" },
          ],
          {
            placeHolder: "Select AI Provider",
            title: "Choose AI Provider for Worklog Generation",
          }
        );

        if (!llmProvider) {
          return; // User cancelled
        }

        // Check if API key is configured for the selected provider
        if (llmProvider.value === "gemini") {
          const geminiApiKey = vscode.workspace
            .getConfiguration("worklogGenerator")
            .get("geminiApiKey", "");
            
          if (!geminiApiKey) {
            const apiKey = await vscode.window.showInputBox({
              prompt: "Enter your Google Gemini API key",
              placeHolder: "Gemini API key",
              password: true,
              validateInput: (value) => {
                if (!value) {
                  return "API key is required";
                }
                return null;
              }
            });
            
            if (!apiKey) {
              vscode.window.showErrorMessage("Gemini API key is required to generate a worklog.");
              return;
            }
            
            await vscode.workspace
              .getConfiguration("worklogGenerator")
              .update("geminiApiKey", apiKey, vscode.ConfigurationTarget.Global);
          }
        } else if (llmProvider.value === "openai") {
          const openaiApiKey = vscode.workspace
            .getConfiguration("worklogGenerator")
            .get("openaiApiKey", "");
            
          if (!openaiApiKey) {
            const apiKey = await vscode.window.showInputBox({
              prompt: "Enter your OpenAI API key",
              placeHolder: "OpenAI API key",
              password: true,
              validateInput: (value) => {
                if (!value) {
                  return "API key is required";
                }
                return null;
              }
            });
            
            if (!apiKey) {
              vscode.window.showErrorMessage("OpenAI API key is required to generate a worklog.");
              return;
            }
            
            await vscode.workspace
              .getConfiguration("worklogGenerator")
              .update("openaiApiKey", apiKey, vscode.ConfigurationTarget.Global);
          }
        } else if (llmProvider.value === "local") {
          const localLlmBaseUrl = vscode.workspace
            .getConfiguration("worklogGenerator")
            .get("localLlmBaseUrl", "");
            
          if (!localLlmBaseUrl) {
            const baseUrl = await vscode.window.showInputBox({
              prompt: "Enter the base URL for your local LLM API",
              placeHolder: "e.g., http://localhost:11434/v1",
              validateInput: (value) => {
                if (!value) {
                  return "Base URL is required";
                }
                try {
                  new URL(value);
                  return null;
                } catch (e) {
                  return "Please enter a valid URL";
                }
              }
            });
            
            if (!baseUrl) {
              vscode.window.showErrorMessage("Local LLM Base URL is required to generate a worklog.");
              return;
            }
            
            await vscode.workspace
              .getConfiguration("worklogGenerator")
              .update("localLlmBaseUrl", baseUrl, vscode.ConfigurationTarget.Global);
          }
          
          const localLlmModelName = vscode.workspace
            .getConfiguration("worklogGenerator")
            .get("localLlmModelName", "");
            
          if (!localLlmModelName) {
            const modelName = await vscode.window.showInputBox({
              prompt: "Enter the model name for your local LLM",
              placeHolder: "e.g., phi, llama, mistral",
              validateInput: (value) => {
                if (!value) {
                  return "Model name is required";
                }
                return null;
              }
            });
            
            if (!modelName) {
              vscode.window.showErrorMessage("Local LLM Model Name is required to generate a worklog.");
              return;
            }
            
            await vscode.workspace
              .getConfiguration("worklogGenerator")
              .update("localLlmModelName", modelName, vscode.ConfigurationTarget.Global);
          }
        }

        // Get worklog style choice
        const defaultWorklogStyle = vscode.workspace
          .getConfiguration("worklogGenerator")
          .get("defaultWorklogStyle", "business");
        const worklogStyle = await vscode.window.showQuickPick(
          [
            {
              label: "Technical",
              value: "technical",
              description: "Focus on technical details and implementation specifics",
            },
            {
              label: "Business",
              value: "business",
              description: "Focus on business impact with minimal technical jargon",
            },
          ],
          {
            placeHolder: "Select Worklog Style",
            title: "Choose Style for Worklog Generation",
          }
        );

        if (!worklogStyle) {
          return; // User cancelled
        }

        // Get source choice (current changes or specific commit)
        const sourceChoice = await vscode.window.showQuickPick(
          [
            {
              label: "Current Changes",
              value: "current",
              description: "Generate from uncommitted changes",
            },
            { label: "Select Commit", value: "commit", description: "Choose a specific commit" },
          ],
          {
            placeHolder: "Generate worklog from:",
            title: "Select Source for Worklog Generation",
          }
        );

        if (!sourceChoice) {
          return; // User cancelled
        }

        let changes = "";
        if (sourceChoice.value === "current") {
          changes = await getGitChanges();
        } else {
          changes = await getSelectedCommit();
        }

        if (!changes || changes.trim() === "") {
          vscode.window.showInformationMessage("No changes found to generate worklog.");
          return;
        }

        // Show progress indicator
        vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Generating worklog...",
            cancellable: false,
          },
          async (progress) => {
            try {
              const worklog = await generateWorklog(changes, llmProvider.value, worklogStyle.value);

              // Store the worklog in extension context
              context.workspaceState.update("lastGeneratedWorklog", worklog);

              // Update the tree view
              worklogTreeDataProvider.refresh();

              // Show the worklog in a webview panel
              WorklogPanel.createOrShow(context.extensionUri, worklog);
            } catch (error) {
              vscode.window.showErrorMessage(
                `Error generating worklog: ${
                  error instanceof Error ? error.message : String(error)
                }`
              );
            }
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    })
  );

  // Register TreeView commands
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "worklog-ai.selectLlmProvider",
      (treeView: WorklogTreeDataProvider) => {
        treeView.selectLlmProvider();
      }
    ),
    vscode.commands.registerCommand(
      "worklog-ai.selectWorklogStyle",
      (treeView: WorklogTreeDataProvider) => {
        treeView.selectWorklogStyle();
      }
    ),
    vscode.commands.registerCommand(
      "worklog-ai.generateWorklogFromCurrentChanges",
      (treeView: WorklogTreeDataProvider) => {
        treeView.generateFromCurrentChanges();
      }
    ),
    vscode.commands.registerCommand(
      "worklog-ai.generateWorklogFromCommit",
      (treeView: WorklogTreeDataProvider) => {
        treeView.generateFromCommit();
      }
    ),
    vscode.commands.registerCommand("worklog-ai.viewWorklog", (worklog: string) => {
      WorklogPanel.createOrShow(context.extensionUri, worklog);
    }),
    vscode.commands.registerCommand("worklog-ai.refreshView", () => {
      worklogTreeDataProvider.refresh();
    }),
    vscode.commands.registerCommand("worklog-ai.exportWorklog", async (worklog: string) => {
      // Show save dialog
      const saveUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file("worklog.md"),
        filters: {
          Markdown: ["md"],
        },
      });

      if (saveUri && worklog) {
        try {
          fs.writeFileSync(saveUri.fsPath, worklog);
          vscode.window.showInformationMessage(`Worklog exported to ${saveUri.fsPath}`);
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to export worklog: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    }),
    vscode.commands.registerCommand("worklog-ai.copyWorklog", async (worklog: string) => {
      if (worklog) {
        await vscode.env.clipboard.writeText(worklog);
        vscode.window.showInformationMessage("Worklog copied to clipboard!");
      }
    }),
    vscode.commands.registerCommand("worklog-ai.openSettings", () => {
      vscode.commands.executeCommand("workbench.action.openSettings", "worklogGenerator");
    }),
    vscode.commands.registerCommand(
      "worklog-ai.selectBranch",
      (treeView: WorklogTreeDataProvider) => {
        treeView.selectBranch();
      }
    ),
    vscode.commands.registerCommand(
      "worklog-ai.generateWorklogFromSpecificCommit",
      (treeView: WorklogTreeDataProvider, commitHash: string) => {
        treeView.generateFromSpecificCommit(commitHash);
      }
    ),
    vscode.commands.registerCommand(
      "worklog-ai.showAllCommits",
      (treeView: WorklogTreeDataProvider) => {
        treeView.showAllCommits();
      }
    ),
    vscode.commands.registerCommand(
      "worklog-ai.showCommitSelector",
      (treeView: WorklogTreeDataProvider) => {
        treeView.showCommitSelector();
      }
    ),
    vscode.commands.registerCommand(
      "worklog-ai.configureLocalLlmBaseUrl",
      async (treeView: WorklogTreeDataProvider) => {
        const currentBaseUrl = vscode.workspace
          .getConfiguration("worklogGenerator")
          .get("localLlmBaseUrl", "http://localhost:11434/v1");
          
        const baseUrl = await vscode.window.showInputBox({
          prompt: "Enter the base URL for your local LLM API",
          placeHolder: "e.g., http://localhost:11434/v1",
          value: currentBaseUrl,
          validateInput: (value) => {
            if (!value) {
              return "Base URL is required";
            }
            try {
              new URL(value);
              return null;
            } catch (e) {
              return "Please enter a valid URL";
            }
          }
        });
        
        if (baseUrl) {
          await vscode.workspace
            .getConfiguration("worklogGenerator")
            .update("localLlmBaseUrl", baseUrl, vscode.ConfigurationTarget.Global);
          treeView.refresh();
          vscode.window.showInformationMessage(`✅ Local LLM Base URL updated to ${baseUrl}`);
        }
      }
    ),
    vscode.commands.registerCommand(
      "worklog-ai.configureLocalLlmModelName",
      async (treeView: WorklogTreeDataProvider) => {
        const currentModelName = vscode.workspace
          .getConfiguration("worklogGenerator")
          .get("localLlmModelName", "phi");
          
        const modelName = await vscode.window.showInputBox({
          prompt: "Enter the model name for your local LLM",
          placeHolder: "e.g., phi, llama, mistral",
          value: currentModelName,
          validateInput: (value) => {
            if (!value) {
              return "Model name is required";
            }
            return null;
          }
        });
        
        if (modelName) {
          await vscode.workspace
            .getConfiguration("worklogGenerator")
            .update("localLlmModelName", modelName, vscode.ConfigurationTarget.Global);
          treeView.refresh();
          vscode.window.showInformationMessage(`✅ Local LLM Model Name updated to ${modelName}`);
        }
      }
    ),
    vscode.commands.registerCommand(
      "worklog-ai.generateCommitMessage",
      (treeView: WorklogTreeDataProvider) => {
        treeView.generateCommitMessage();
      }
    ),
    vscode.commands.registerCommand(
      "worklog-ai.configureGeminiApiKey",
      async (treeView: WorklogTreeDataProvider) => {
        const apiKey = await vscode.window.showInputBox({
          prompt: "Enter your Google Gemini API key",
          placeHolder: "Gemini API key",
          password: true,
          validateInput: (value) => {
            if (!value) {
              return "API key is required";
            }
            return null;
          }
        });
        
        if (apiKey) {
          await vscode.workspace
            .getConfiguration("worklogGenerator")
            .update("geminiApiKey", apiKey, vscode.ConfigurationTarget.Global);
          treeView.refresh();
          vscode.window.showInformationMessage(`✅ Gemini API key updated successfully`);
        }
      }
    ),
    vscode.commands.registerCommand(
      "worklog-ai.configureOpenAiApiKey",
      async (treeView: WorklogTreeDataProvider) => {
        const apiKey = await vscode.window.showInputBox({
          prompt: "Enter your OpenAI API key",
          placeHolder: "OpenAI API key",
          password: true,
          validateInput: (value) => {
            if (!value) {
              return "API key is required";
            }
            return null;
          }
        });
        
        if (apiKey) {
          await vscode.workspace
            .getConfiguration("worklogGenerator")
            .update("openaiApiKey", apiKey, vscode.ConfigurationTarget.Global);
          treeView.refresh();
          vscode.window.showInformationMessage(`✅ OpenAI API key updated successfully`);
        }
      }
    )
  );
}

export function deactivate() {}

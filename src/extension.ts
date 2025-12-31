import * as vscode from "vscode";
import * as fs from "fs";
import { generateWorklog } from "./worklogGenerator";
import { getGitChanges, getSelectedCommit } from "./gitUtils";
import { WorklogTreeDataProvider } from "./worklogTreeView";
import { WorklogPanel } from "./worklogPanel";
import { registerGitIntegration } from "./gitIntegration";
import ConfigService from "./configService";

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
        const defaultLlmProvider = ConfigService.getDefaultLlmProvider();
        const geminiModel = ConfigService.getSelectedGeminiModel();
        const openaiModel = ConfigService.getSelectedOpenAIModel();
        const localModel = ConfigService.getLocalLlmModelName();
        const geminiApiKey = ConfigService.getGeminiApiKey();
        const openaiApiKey = ConfigService.getOpenAIApiKey();

        const llmProvider = await vscode.window.showQuickPick(
          [
            {
              label: "Google Gemini (Default)",
              value: "gemini",
              description: geminiApiKey ? `Uses ${geminiModel}` : "Requires API key",
            },
            {
              label: "OpenAI",
              value: "openai",
              description: openaiApiKey ? `Uses ${openaiModel}` : "Requires API key"
            },
            {
              label: "Local LLM",
              value: "local",
              description: `Uses ${localModel}`
            },
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
          const localLlmBaseUrl = ConfigService.getLocalLlmBaseUrl();
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
          
          const localLlmModelName = ConfigService.getLocalLlmModelName();
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
        const defaultWorklogStyle = ConfigService.getDefaultWorklogStyle();
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
        const currentBaseUrl = ConfigService.getLocalLlmBaseUrl();
          
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
        const currentModelName = ConfigService.getLocalLlmModelName();
          
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
      "worklog-ai.generatePRTemplate",
      (treeView: WorklogTreeDataProvider) => {
        treeView.generatePRTemplate();
      }
    ),
    vscode.commands.registerCommand(
      "worklog-ai.generatePRFromCommits",
      (treeView: WorklogTreeDataProvider) => {
        treeView.generatePRFromCommits();
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
          // Save the API key first
          await vscode.workspace
            .getConfiguration("worklogGenerator")
            .update("geminiApiKey", apiKey, vscode.ConfigurationTarget.Global);

          // Fetch available models and auto-select the first one
          await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: "Validating API key and fetching models...",
              cancellable: false,
            },
            async () => {
              try {
                const { fetchGeminiModels, setSelectedModel } = await import("./modelService");
                const models = await fetchGeminiModels(apiKey);

                if (models.length > 0) {
                  // Auto-select the first available model
                  await setSelectedModel("gemini", models[0].id);
                  treeView.refresh();
                  vscode.window.showInformationMessage(
                    `✅ Gemini API key configured! Auto-selected model: ${models[0].name}`
                  );
                }
              } catch (error) {
                vscode.window.showErrorMessage(
                  `⚠️ API key saved but failed to fetch models: ${error instanceof Error ? error.message : String(error)}. Please check your API key.`
                );
                treeView.refresh();
              }
            }
          );
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
          // Save the API key first
          await vscode.workspace
            .getConfiguration("worklogGenerator")
            .update("openaiApiKey", apiKey, vscode.ConfigurationTarget.Global);

          // Fetch available models and auto-select the first one
          await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: "Validating API key and fetching models...",
              cancellable: false,
            },
            async () => {
              try {
                const { fetchOpenAIModels, setSelectedModel } = await import("./modelService");
                const models = await fetchOpenAIModels(apiKey);

                if (models.length > 0) {
                  // Auto-select the first available model
                  await setSelectedModel("openai", models[0].id);
                  treeView.refresh();
                  vscode.window.showInformationMessage(
                    `✅ OpenAI API key configured! Auto-selected model: ${models[0].name}`
                  );
                }
              } catch (error) {
                vscode.window.showErrorMessage(
                  `⚠️ API key saved but failed to fetch models: ${error instanceof Error ? error.message : String(error)}. Please check your API key.`
                );
                treeView.refresh();
              }
            }
          );
        }
      }
    ),
    vscode.commands.registerCommand(
      "worklog-ai.selectGeminiModel",
      async (treeView: WorklogTreeDataProvider) => {
        try {
          const { fetchGeminiModels, setSelectedModel, getCachedModels } = await import("./modelService");
          const ConfigService = (await import("./configService")).default;
          const apiKey = ConfigService.getGeminiApiKey();

          if (!apiKey) {
            vscode.window.showErrorMessage("Please configure Gemini API key first");
            return;
          }

          // Check if models are already cached
          const cachedModels = getCachedModels("gemini", apiKey);
          let models: Awaited<ReturnType<typeof fetchGeminiModels>>;

          if (cachedModels) {
            // Use cached models, no progress indicator needed
            models = cachedModels;
          } else {
            // Fetch models with progress indicator
            models = await vscode.window.withProgress(
              {
                location: vscode.ProgressLocation.Notification,
                title: "Fetching available Gemini models...",
                cancellable: false,
              },
              async () => {
                return await fetchGeminiModels(apiKey);
              }
            );
          }

          const currentModel = ConfigService.getSelectedGeminiModel();

          if (models.length === 0) {
            vscode.window.showWarningMessage("No compatible models found for your API key");
            return;
          }

          const items = models.map((model) => ({
            label: model.name,
            description: model.id === currentModel ? `${model.id} ⭐ Current` : model.id,
            value: model.id,
            picked: model.id === currentModel
          }));

          const selected = await vscode.window.showQuickPick(items, {
            placeHolder: "Select Gemini model",
            title: `${models.length} available Gemini models`
          });

          if (selected) {
            await setSelectedModel("gemini", selected.value);
            treeView.refresh();
            vscode.window.showInformationMessage(`✅ Selected: ${selected.label}`);
          }
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to fetch models: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    ),
    vscode.commands.registerCommand(
      "worklog-ai.selectOpenAIModel",
      async (treeView: WorklogTreeDataProvider) => {
        try {
          const { fetchOpenAIModels, setSelectedModel, getCachedModels } = await import("./modelService");
          const ConfigService = (await import("./configService")).default;
          const apiKey = ConfigService.getOpenAIApiKey();

          if (!apiKey) {
            vscode.window.showErrorMessage("Please configure OpenAI API key first");
            return;
          }

          // Check if models are already cached
          const cachedModels = getCachedModels("openai", apiKey);
          let models: Awaited<ReturnType<typeof fetchOpenAIModels>>;

          if (cachedModels) {
            // Use cached models, no progress indicator needed
            models = cachedModels;
          } else {
            // Fetch models with progress indicator
            models = await vscode.window.withProgress(
              {
                location: vscode.ProgressLocation.Notification,
                title: "Fetching available OpenAI models...",
                cancellable: false,
              },
              async () => {
                return await fetchOpenAIModels(apiKey);
              }
            );
          }

          const currentModel = ConfigService.getSelectedOpenAIModel();

          if (models.length === 0) {
            vscode.window.showWarningMessage("No compatible models found for your API key");
            return;
          }

          const items = models.map((model) => ({
            label: model.name,
            description: model.id === currentModel ? `${model.id} ⭐ Current` : model.id,
            value: model.id,
            picked: model.id === currentModel
          }));

          const selected = await vscode.window.showQuickPick(items, {
            placeHolder: "Select OpenAI model",
            title: `${models.length} available OpenAI models`
          });

          if (selected) {
            await setSelectedModel("openai", selected.value);
            treeView.refresh();
            vscode.window.showInformationMessage(`✅ Selected: ${selected.label}`);
          }
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to fetch models: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    )
  );
}

export function deactivate() {}

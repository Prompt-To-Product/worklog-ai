import * as vscode from "vscode";
import { generateWorklog, generateCommitMessage } from "./worklogGenerator";
import {
  getGitChanges,
  getSelectedCommit,
  getUserCommits,
  getBranches,
  getCurrentBranch,
} from "./gitUtils";
import { WorklogPanel } from "./worklogPanel";
import { findPRTemplates, fillPRTemplate, fillPRTemplateFromCommits, PRTemplateInfo } from "./prTemplateService";
import ConfigService from "./configService";

export class WorklogTreeDataProvider implements vscode.TreeDataProvider<WorklogItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<WorklogItem | undefined | null | void> =
    new vscode.EventEmitter<WorklogItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<WorklogItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private llmProvider: string;
  private worklogStyle: string;
  private generatedWorklog: string | undefined;
  private isGenerating: boolean = false;
  private selectedBranch: string | undefined;
  private userCommits: any[] = [];

  constructor(private context: vscode.ExtensionContext) {
    try {
      this.llmProvider = ConfigService.getDefaultLlmProvider();
      this.worklogStyle = ConfigService.getDefaultWorklogStyle();

      // Initialize with current branch
      this.initializeBranch().catch(error => {
        console.error("Failed to initialize branch:", error);
        // Continue with default state if initialization fails
      });

      // Listen for configuration changes
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (ConfigService.affectsConfiguration(e)) {
          this.llmProvider = ConfigService.getDefaultLlmProvider();
          this.worklogStyle = ConfigService.getDefaultWorklogStyle();
          this.refresh();
        }
      });
    } catch (error) {
      console.error("TreeDataProvider constructor error:", error);
      // Set safe defaults
      this.llmProvider = "gemini";
      this.worklogStyle = "business";
    }
  }

  private async initializeBranch() {
    try {
      this.selectedBranch = await getCurrentBranch();
      await this.loadUserCommits();
      this.refresh();
    } catch (error) {
      console.error("Failed to initialize branch:", error);
    }
  }

  private async loadUserCommits() {
    if (this.selectedBranch) {
      try {
        this.userCommits = await getUserCommits(this.selectedBranch);
      } catch (error) {
        console.error("Failed to load user commits:", error);
        this.userCommits = [];
      }
    }
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: WorklogItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: WorklogItem): Promise<WorklogItem[]> {
    try {
      if (element) {
        // Handle expandable sections
        if (element.contextValue === "settingsSection") {
          return this.getSettingsChildren();
        }
        if (element.contextValue === "branchSection") {
          return this.getBranchChildren();
        }
        if (element.contextValue === "commitsSection") {
          return this.getCommitsChildren();
        }
        if (element.contextValue === "resultSection") {
          return this.getResultChildren();
        }
        return [];
      }

      const items: WorklogItem[] = [];

    // Settings section - expanded by default for easy access
    const settingsSection = new WorklogItem(
      "⚙️ Settings",
      vscode.TreeItemCollapsibleState.Collapsed,
      undefined,
      "settingsSection"
    );
    items.push(settingsSection);

    // Branch Selection section
    const branchSection = new WorklogItem(
      "🌿 Branch & Commits",
      vscode.TreeItemCollapsibleState.Expanded,
      undefined,
      "branchSection"
    );
    items.push(branchSection);

    // Show loading state
    if (this.isGenerating) {
      const loadingItem = new WorklogItem(
        "⏳ Generating worklog...",
        vscode.TreeItemCollapsibleState.None,
        undefined,
        "loading",
        "Please wait"
      );
      loadingItem.iconPath = new vscode.ThemeIcon("loading~spin");
      items.push(loadingItem);
    }

    // Show result if available
    if (this.generatedWorklog && !this.isGenerating) {
      const resultSection = new WorklogItem(
        "📄 Latest Worklog",
        vscode.TreeItemCollapsibleState.Collapsed,
        undefined,
        "resultSection"
      );
      items.push(resultSection);
    }

    return items;
    } catch (error) {
      console.error("Error in getChildren:", error);
      // Return a minimal fallback structure that always works
      return [
        new WorklogItem(
          "❌ Error loading view",
          vscode.TreeItemCollapsibleState.None,
          {
            command: "worklog-ai.refreshView",
            title: "Refresh View"
          },
          "error",
          "Click to refresh"
        ),
        new WorklogItem(
          "⚙️ Settings",
          vscode.TreeItemCollapsibleState.Collapsed,
          undefined,
          "settingsSection"
        )
      ];
    }
  }

  private getSettingsChildren(): WorklogItem[] {
    const items: WorklogItem[] = [];

    // AI Provider setting
    const llmProviderItem = new WorklogItem(
      "🤖 AI Provider",
      vscode.TreeItemCollapsibleState.None,
      {
        command: "worklog-ai.selectLlmProvider",
        title: "Select AI Provider",
        arguments: [this],
      },
      "llmProvider",
      this.getLlmProviderLabel()
    );
    llmProviderItem.iconPath = new vscode.ThemeIcon("symbol-enum");
    items.push(llmProviderItem);

    // Worklog Style setting
    const worklogStyleItem = new WorklogItem(
      "📝 Worklog Style",
      vscode.TreeItemCollapsibleState.None,
      {
        command: "worklog-ai.selectWorklogStyle",
        title: "Select Worklog Style",
        arguments: [this],
      },
      "worklogStyle",
      this.getWorklogStyleLabel()
    );
    worklogStyleItem.iconPath = new vscode.ThemeIcon("symbol-enum");
    items.push(worklogStyleItem);

    // Show provider-specific settings based on selected provider
    if (this.llmProvider === "gemini") {
      const geminiApiKey = vscode.workspace
        .getConfiguration("worklogGenerator")
        .get("geminiApiKey", "");
        
      const apiKeyItem = new WorklogItem(
        "🔑 Gemini API Key",
        vscode.TreeItemCollapsibleState.None,
        {
          command: "worklog-ai.configureGeminiApiKey",
          title: "Configure Gemini API Key",
          arguments: [this],
        },
        "geminiApiKey",
        geminiApiKey ? "••••••••" : "Not configured"
      );
      apiKeyItem.iconPath = new vscode.ThemeIcon("key");
      items.push(apiKeyItem);

      // Add model selection for Gemini
      if (geminiApiKey) {
        const selectedModel = vscode.workspace
          .getConfiguration("worklogGenerator")
          .get("selectedGeminiModel", "");

        const modelItem = new WorklogItem(
          selectedModel ? `🤖 Model: ${selectedModel}` : "🤖 Select Model",
          vscode.TreeItemCollapsibleState.None,
          {
            command: "worklog-ai.selectGeminiModel",
            title: "Select Gemini Model",
            arguments: [this],
          },
          "selectedGeminiModel",
          selectedModel ? "Click to change" : "No model selected"
        );
        modelItem.iconPath = new vscode.ThemeIcon("robot");
        items.push(modelItem);
      }
    } else if (this.llmProvider === "openai") {
      const openaiApiKey = vscode.workspace
        .getConfiguration("worklogGenerator")
        .get("openaiApiKey", "");
        
      const apiKeyItem = new WorklogItem(
        "🔑 OpenAI API Key",
        vscode.TreeItemCollapsibleState.None,
        {
          command: "worklog-ai.configureOpenAiApiKey",
          title: "Configure OpenAI API Key",
          arguments: [this],
        },
        "openaiApiKey",
        openaiApiKey ? "••••••••" : "Not configured"
      );
      apiKeyItem.iconPath = new vscode.ThemeIcon("key");
      items.push(apiKeyItem);

      // Add model selection for OpenAI
      if (openaiApiKey) {
        const selectedModel = vscode.workspace
          .getConfiguration("worklogGenerator")
          .get("selectedOpenAIModel", "");

        const modelItem = new WorklogItem(
          selectedModel ? `🤖 Model: ${selectedModel}` : "🤖 Select Model",
          vscode.TreeItemCollapsibleState.None,
          {
            command: "worklog-ai.selectOpenAIModel",
            title: "Select OpenAI Model",
            arguments: [this],
          },
          "selectedOpenAIModel",
          selectedModel ? "Click to change" : "No model selected"
        );
        modelItem.iconPath = new vscode.ThemeIcon("robot");
        items.push(modelItem);
      }
    } else if (this.llmProvider === "local") {
      const localLlmBaseUrl = vscode.workspace
        .getConfiguration("worklogGenerator")
        .get("localLlmBaseUrl", "http://localhost:11434/v1");
        
      const localLlmModelName = vscode.workspace
        .getConfiguration("worklogGenerator")
        .get("localLlmModelName", "phi");
        
      const baseUrlItem = new WorklogItem(
        "🔗 Local LLM Base URL",
        vscode.TreeItemCollapsibleState.None,
        {
          command: "worklog-ai.configureLocalLlmBaseUrl",
          title: "Configure Local LLM Base URL",
          arguments: [this],
        },
        "localLlmBaseUrl",
        localLlmBaseUrl
      );
      baseUrlItem.iconPath = new vscode.ThemeIcon("link");
      items.push(baseUrlItem);
      
      const modelNameItem = new WorklogItem(
        "🏷️ Local LLM Model Name",
        vscode.TreeItemCollapsibleState.None,
        {
          command: "worklog-ai.configureLocalLlmModelName",
          title: "Configure Local LLM Model Name",
          arguments: [this],
        },
        "localLlmModelName",
        localLlmModelName
      );
      modelNameItem.iconPath = new vscode.ThemeIcon("symbol-variable");
      items.push(modelNameItem);
    }

    return items;
  }

  private getBranchChildren(): WorklogItem[] {
    const items: WorklogItem[] = [];

    // Current branch selector
    const branchItem = new WorklogItem(
      "📍 Branch",
      vscode.TreeItemCollapsibleState.None,
      {
        command: "worklog-ai.selectBranch",
        title: "Select Branch",
        arguments: [this],
      },
      "branchSelector",
      this.selectedBranch || "Not selected"
    );
    branchItem.iconPath = new vscode.ThemeIcon("git-branch");
    items.push(branchItem);

    // Generate from current changes - styled as button
    if (!this.isGenerating) {
      const generateFromCurrentItem = new WorklogItem(
        "🚀 Worklog from Changes",
        vscode.TreeItemCollapsibleState.None,
        {
          command: "worklog-ai.generateWorklogFromCurrentChanges",
          title: "Generate from Current Changes",
          arguments: [this],
        },
        "generateCurrentButton",
        "Uncommitted changes"
      );
      generateFromCurrentItem.iconPath = new vscode.ThemeIcon("play-circle");
      items.push(generateFromCurrentItem);

      // Generate commit message - styled as button
      const generateCommitMessageItem = new WorklogItem(
        "📝 Commit Message",
        vscode.TreeItemCollapsibleState.None,
        {
          command: "worklog-ai.generateCommitMessage",
          title: "Generate Commit Message",
          arguments: [this],
        },
        "generateCommitMessageButton",
        "Auto-generate from changes"
      );
      generateCommitMessageItem.iconPath = new vscode.ThemeIcon("git-commit");
      items.push(generateCommitMessageItem);

      // Generate from commit - styled as button
      const generateFromCommitItem = new WorklogItem(
        "📜 Worklog from Commit",
        vscode.TreeItemCollapsibleState.None,
        {
          command: "worklog-ai.showCommitSelector",
          title: "Generate from Commit",
          arguments: [this],
        },
        "generateCommitButton",
        "Pick a commit"
      );
      generateFromCommitItem.iconPath = new vscode.ThemeIcon("history");
      items.push(generateFromCommitItem);

      // Generate PR Template - styled as button
      const generatePRTemplateItem = new WorklogItem(
        "📋 Fill PR Form",
        vscode.TreeItemCollapsibleState.None,
        {
          command: "worklog-ai.generatePRTemplate",
          title: "Fill PR Form",
          arguments: [this],
        },
        "generatePRTemplateButton",
        "Auto-fill PR template from changes"
      );
      generatePRTemplateItem.iconPath = new vscode.ThemeIcon("git-pull-request");
      items.push(generatePRTemplateItem);

      // Generate PR Template from Commits - styled as button
      const generatePRFromCommitsItem = new WorklogItem(
        "📋 Fill PR from Commits",
        vscode.TreeItemCollapsibleState.None,
        {
          command: "worklog-ai.generatePRFromCommits",
          title: "Fill PR from Commits",
          arguments: [this],
        },
        "generatePRFromCommitsButton",
        "Auto-fill PR template from commits"
      );
      generatePRFromCommitsItem.iconPath = new vscode.ThemeIcon("git-pull-request-create");
      items.push(generatePRFromCommitsItem);
    }

    // Show user commits for selected branch
    if (this.selectedBranch) {
      if (this.userCommits.length > 0) {
        const commitsSection = new WorklogItem(
          `📚 Recent Commits (${this.userCommits.length})`,
          vscode.TreeItemCollapsibleState.Collapsed,
          undefined,
          "commitsSection"
        );
        items.push(commitsSection);
      } else {
        const noCommitsItem = new WorklogItem(
          "📭 No commits",
          vscode.TreeItemCollapsibleState.None,
          undefined,
          "noCommits",
          `No commits on '${this.selectedBranch}'`
        );
        noCommitsItem.iconPath = new vscode.ThemeIcon("info");
        items.push(noCommitsItem);
      }
    }

    return items;
  }

  private getCommitsChildren(): WorklogItem[] {
    const items: WorklogItem[] = [];

    // Show first 10 commits
    const commitsToShow = this.userCommits.slice(0, 10);
    for (const commit of commitsToShow) {
      const commitItem = new WorklogItem(
        commit.message.split("\n")[0].substring(0, 50) + (commit.message.length > 50 ? "..." : ""),
        vscode.TreeItemCollapsibleState.None,
        {
          command: "worklog-ai.generateWorklogFromSpecificCommit",
          title: "Generate Worklog from Commit",
          arguments: [this, commit.hash],
        },
        "commitItem",
        `${commit.date} • ${commit.hash.substring(0, 7)}`
      );
      commitItem.iconPath = new vscode.ThemeIcon("git-commit");
      items.push(commitItem);
    }

    if (this.userCommits.length > 10) {
      const moreCommitsItem = new WorklogItem(
        `... and ${this.userCommits.length - 10} more commits`,
        vscode.TreeItemCollapsibleState.None,
        {
          command: "worklog-ai.showAllCommits",
          title: "Show All Commits",
          arguments: [this],
        },
        "moreCommits",
        "Click to see all commits"
      );
      moreCommitsItem.iconPath = new vscode.ThemeIcon("ellipsis");
      items.push(moreCommitsItem);
    }

    return items;
  }

  private getResultChildren(): WorklogItem[] {
    const items: WorklogItem[] = [];

    const resultItem = new WorklogItem(
      "👀 View Worklog",
      vscode.TreeItemCollapsibleState.None,
      {
        command: "worklog-ai.viewWorklog",
        title: "View Worklog",
        arguments: [this.generatedWorklog],
      },
      "worklogResult",
      "Open in panel"
    );
    resultItem.iconPath = new vscode.ThemeIcon("preview");
    items.push(resultItem);

    const copyItem = new WorklogItem(
      "📋 Copy to Clipboard",
      vscode.TreeItemCollapsibleState.None,
      {
        command: "worklog-ai.copyWorklog",
        title: "Copy Worklog",
        arguments: [this.generatedWorklog],
      },
      "copyWorklog",
      "Quick copy"
    );
    copyItem.iconPath = new vscode.ThemeIcon("copy");
    items.push(copyItem);

    const exportItem = new WorklogItem(
      "💾 Save to File",
      vscode.TreeItemCollapsibleState.None,
      {
        command: "worklog-ai.exportWorklog",
        title: "Export Worklog",
        arguments: [this.generatedWorklog],
      },
      "exportWorklog",
      "Export as .md"
    );
    exportItem.iconPath = new vscode.ThemeIcon("save-as");
    items.push(exportItem);

    return items;
  }

  getWorklogStyleLabel(): string {
    switch (this.worklogStyle) {
      case "technical":
        return "Technical";
      case "business":
        return "Business";
      default:
        return "Business";
    }
  }
  
  getLlmProviderLabel(): string {
    switch (this.llmProvider) {
      case "gemini":
        return "Google Gemini";
      case "openai":
        return "OpenAI";
      case "local":
        return "Local LLM";
      default:
        return "Google Gemini";
    }
  }

  async selectLlmProvider(): Promise<void> {
    // Get currently selected models for each provider
    const geminiModel = ConfigService.getSelectedGeminiModel();
    const openaiModel = ConfigService.getSelectedOpenAIModel();
    const localModel = ConfigService.getLocalLlmModelName();
    const geminiApiKey = ConfigService.getGeminiApiKey();
    const openaiApiKey = ConfigService.getOpenAIApiKey();

    const selected = await vscode.window.showQuickPick(
      [
        {
          label: "🔮 Google Gemini",
          value: "gemini",
          description: geminiApiKey ? `Uses ${geminiModel}` : "Requires API key",
          detail: "Fast and efficient - Recommended for most users",
        },
        {
          label: "🧠 OpenAI",
          value: "openai",
          description: openaiApiKey ? `Uses ${openaiModel}` : "Requires API key",
          detail: "Advanced reasoning - Great for complex code analysis",
        },
        {
          label: "🏠 Local LLM",
          value: "local",
          description: `Uses ${localModel}`,
          detail: "Privacy-focused option with customizable model",
        },
      ],
      {
        placeHolder: "Choose your AI provider",
        title: "🤖 Select AI Provider for Worklog Generation",
        matchOnDescription: true,
        matchOnDetail: true,
      }
    );

    if (selected) {
      this.llmProvider = selected.value;
      await vscode.workspace
        .getConfiguration("worklogGenerator")
        .update("defaultLlmProvider", selected.value, vscode.ConfigurationTarget.Global);
      
      // Handle configuration based on the selected provider
      if (selected.value === "gemini") {
        const currentApiKey = vscode.workspace
          .getConfiguration("worklogGenerator")
          .get("geminiApiKey", "");
          
        if (!currentApiKey) {
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
          }
        }
      } else if (selected.value === "openai") {
        const currentApiKey = vscode.workspace
          .getConfiguration("worklogGenerator")
          .get("openaiApiKey", "");
          
        if (!currentApiKey) {
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
          }
        }
      } else if (selected.value === "local") {
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
          }
        }
      }
      
      this.refresh();
      vscode.window.showInformationMessage(`✅ AI Provider changed to ${selected.label}`);
    }
  }

  async selectWorklogStyle(): Promise<void> {
    const selected = await vscode.window.showQuickPick(
      [
        {
          label: "🔧 Technical Style",
          value: "technical",
          description: "Detailed implementation with file names and functions",
        },
        {
          label: "💼 Business Style",
          value: "business",
          description: "Human-readable description of changes",
        },
      ],
      {
        placeHolder: "Choose your worklog style",
        title: "📝 Select Worklog Style",
        matchOnDescription: true,
        matchOnDetail: true,
      }
    );

    if (selected) {
      this.worklogStyle = selected.value;
      await vscode.workspace
        .getConfiguration("worklogGenerator")
        .update("defaultWorklogStyle", selected.value, vscode.ConfigurationTarget.Global);
      this.refresh();
      vscode.window.showInformationMessage(`✅ Worklog style changed to ${selected.label}`);
    }
  }

  async selectBranch(): Promise<void> {
    try {
      const branches = await getBranches();
      if (branches.length === 0) {
        vscode.window.showInformationMessage("No branches found in this repository.");
        return;
      }

      const selected = await vscode.window.showQuickPick(
        branches.map((branch) => ({
          label: branch.name,
          description: branch.current ? "Current branch" : "",
          detail: `Last commit: ${branch.lastCommit}`,
          value: branch.name,
        })),
        {
          placeHolder: "Select a branch to view commits",
          title: "🌿 Select Branch",
          matchOnDescription: true,
          matchOnDetail: true,
        }
      );

      if (selected) {
        this.selectedBranch = selected.value;
        await this.loadUserCommits();
        this.refresh();
        vscode.window.showInformationMessage(`✅ Switched to branch: ${selected.label}`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `❌ Failed to load branches: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async generateFromSpecificCommit(commitHash: string): Promise<void> {
    if (this.isGenerating) {
      vscode.window.showWarningMessage("⏳ Already generating a worklog, please wait...");
      return;
    }

    try {
      this.isGenerating = true;
      this.refresh();

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "🚀 Generating worklog from commit",
          cancellable: true,
        },
        async (progress) => {
          try {
            progress.report({ increment: 0, message: "Analyzing commit changes..." });

            const changes = await getSelectedCommit(commitHash);

            if (!changes || changes.trim() === "") {
              vscode.window.showInformationMessage("📝 No changes found in the selected commit.");
              this.isGenerating = false;
              this.refresh();
              return;
            }

            progress.report({ increment: 30, message: "Processing with AI..." });

            this.generatedWorklog = await generateWorklog(
              changes,
              this.llmProvider,
              this.worklogStyle
            );

            progress.report({ increment: 80, message: "Finalizing worklog..." });

            // Store the worklog in extension context
            this.context.workspaceState.update("lastGeneratedWorklog", this.generatedWorklog);

            // Auto-open the worklog panel
            WorklogPanel.createOrShow(this.context.extensionUri, this.generatedWorklog);

            // Stop the loader before showing the success message
            this.isGenerating = false;
            this.refresh();

            progress.report({ increment: 100, message: "Complete!" });

            // Show success message with action buttons
            const action = await vscode.window.showInformationMessage(
              "✅ Worklog generated successfully!",
              "📋 Copy to Clipboard",
              "💾 Save to File"
            );

            if (action === "📋 Copy to Clipboard") {
              await vscode.env.clipboard.writeText(this.generatedWorklog);
              vscode.window.showInformationMessage("📋 Worklog copied to clipboard!");
            } else if (action === "💾 Save to File") {
              vscode.commands.executeCommand("worklog-ai.exportWorklog", this.generatedWorklog);
            }
          } catch (error) {
            this.isGenerating = false;
            this.refresh();
            vscode.window.showErrorMessage(
              `❌ Error generating worklog: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          }
        }
      );
    } catch (error) {
      this.isGenerating = false;
      this.refresh();
      vscode.window.showErrorMessage(
        `❌ Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async showAllCommits(): Promise<void> {
    if (this.userCommits.length === 0) {
      vscode.window.showInformationMessage("No commits found.");
      return;
    }

    const selected = await vscode.window.showQuickPick(
      this.userCommits.map((commit) => ({
        label: commit.message.split("\n")[0],
        description: `${commit.date} • ${commit.hash.substring(0, 7)}`,
        detail:
          commit.message.length > 100 ? commit.message.substring(0, 100) + "..." : commit.message,
        value: commit.hash,
      })),
      {
        placeHolder: "Select a commit to generate worklog",
        title: `📚 All Your Commits on ${this.selectedBranch}`,
        matchOnDescription: true,
        matchOnDetail: true,
      }
    );

    if (selected) {
      await this.generateFromSpecificCommit(selected.value);
    }
  }

  async showCommitSelector(): Promise<void> {
    try {
      // First, let user select a branch
      const branches = await getBranches();
      if (branches.length === 0) {
        vscode.window.showInformationMessage("No branches found in this repository.");
        return;
      }

      const selectedBranch = await vscode.window.showQuickPick(
        branches.map((branch) => ({
          label: `${branch.current ? "⭐ " : ""}${branch.name}`,
          description: branch.current ? "Current branch" : "",
          detail: `Last commit: ${branch.lastCommit}`,
          value: branch.name,
        })),
        {
          placeHolder: "Select a branch to view commits",
          title: "🌿 Select Branch for Commit Generation",
          matchOnDescription: true,
          matchOnDetail: true,
        }
      );

      if (!selectedBranch) {
        return;
      }

      // Get user commits for the selected branch
      const commits = await getUserCommits(selectedBranch.value);

      if (commits.length === 0) {
        vscode.window.showInformationMessage(
          `No commits found by you on branch '${selectedBranch.value}'.`
        );
        return;
      }

      // Let user select a commit
      const selectedCommit = await vscode.window.showQuickPick(
        commits.map((commit) => ({
          label: commit.message.split("\n")[0],
          description: `${commit.date} • ${commit.hash.substring(0, 7)}`,
          detail:
            commit.message.length > 100 ? commit.message.substring(0, 100) + "..." : commit.message,
          value: commit.hash,
        })),
        {
          placeHolder: "Select a commit to generate worklog",
          title: `📚 Your Commits on ${selectedBranch.value}`,
          matchOnDescription: true,
          matchOnDetail: true,
        }
      );

      if (selectedCommit) {
        await this.generateFromSpecificCommit(selectedCommit.value);
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `❌ Failed to show commit selector: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async generateCommitMessage(): Promise<void> {
    if (this.isGenerating) {
      vscode.window.showWarningMessage("⏳ Already generating, please wait...");
      return;
    }

    try {
      this.isGenerating = true;
      this.refresh();

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "🚀 Generating commit message",
          cancellable: true,
        },
        async (progress) => {
          try {
            progress.report({ increment: 0, message: "Analyzing git changes..." });

            const changes = await getGitChanges();

            if (!changes || changes.trim() === "") {
              vscode.window.showInformationMessage("📝 No changes detected to generate a commit message.");
              this.isGenerating = false;
              this.refresh();
              return;
            }

            progress.report({ increment: 30, message: "Processing with AI..." });
            
            const result = await generateCommitMessage(
              changes,
              this.llmProvider
            );

            progress.report({ increment: 100, message: "Complete!" });

            // Stop the loader before showing the result
            this.isGenerating = false;
            this.refresh();

            // Format the commit message for display
            const formattedResult = `# Generated Commit Message

## Commit Message
\`\`\`
${result.message}
\`\`\`

## Description
${result.description}

---

**Actions:**
- Copy the commit message above to use in your git commit
- You can also copy both message and description together
`;

            // Store the commit message in extension context
            this.context.workspaceState.update("lastGeneratedCommitMessage", result.message);
            this.context.workspaceState.update("lastGeneratedCommitDescription", result.description);

            // Automatically open the details window
            WorklogPanel.createOrShow(this.context.extensionUri, formattedResult, 'commit');

            // Show a brief success notification with copy options
            const action = await vscode.window.showInformationMessage(
              "✅ Commit message generated and opened in details panel",
              "📋 Copy Message",
              "📋 Copy All"
            );

            if (action === "📋 Copy Message") {
              await vscode.env.clipboard.writeText(result.message);
              vscode.window.showInformationMessage("📋 Commit message copied to clipboard!");
            } else if (action === "📋 Copy All") {
              const fullContent = `${result.message}\n\n${result.description}`;
              await vscode.env.clipboard.writeText(fullContent);
              vscode.window.showInformationMessage("📋 Commit message and description copied to clipboard!");
            }
          } catch (error) {
            this.isGenerating = false;
            this.refresh();
            vscode.window.showErrorMessage(
              `❌ Error generating commit message: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          }
        }
      );
    } catch (error) {
      this.isGenerating = false;
      this.refresh();
      vscode.window.showErrorMessage(
        `❌ Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async generatePRTemplate(): Promise<void> {
    if (this.isGenerating) {
      vscode.window.showWarningMessage("⏳ Already generating, please wait...");
      return;
    }

    try {
      // Force refresh the LLM provider setting
      this.llmProvider = vscode.workspace
        .getConfiguration("worklogGenerator")
        .get("defaultLlmProvider", "gemini");
        
      this.isGenerating = true;
      this.refresh();

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "📋 Generating PR template",
          cancellable: true,
        },
        async (progress) => {
          try {
            progress.report({ increment: 0, message: "Finding PR templates..." });

            let templates = await findPRTemplates();

            // If no templates found, offer to paste one manually
            if (templates.length === 0) {
              const action = await vscode.window.showInformationMessage(
                "📋 No PR templates found in .github/ directory.",
                "Paste Template",
                "Cancel"
              );

              if (action === "Paste Template") {
                const manualTemplate = await vscode.window.showInputBox({
                  prompt: "Paste your PR template markdown here (multi-line supported)",
                  placeHolder: "## Description\\n\\n<!-- Describe your changes -->\\n\\n## Type of Change\\n\\n- [ ] Bug fix\\n- [ ] New feature",
                  ignoreFocusOut: true,
                  validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                      return "Template cannot be empty";
                    }
                    return null;
                  }
                });

                if (!manualTemplate) {
                  this.isGenerating = false;
                  this.refresh();
                  return;
                }

                // Create a manual template object
                templates = [{
                  path: "manual-input",
                  name: "Manual Template",
                  content: manualTemplate
                }];
              } else {
                this.isGenerating = false;
                this.refresh();
                return;
              }
            }

            progress.report({ increment: 20, message: "Analyzing git changes..." });

            const changes = await getGitChanges();
            if (!changes || changes.trim() === "") {
              vscode.window.showInformationMessage("📝 No changes detected to fill PR template.");
              this.isGenerating = false;
              this.refresh();
              return;
            }

            progress.report({ increment: 40, message: "Generating worklog content..." });

            const worklogContent = await generateWorklog(changes, this.llmProvider, "business");

            progress.report({ increment: 70, message: "Filling PR template..." });

            let selectedTemplate = templates[0];
            if (templates.length > 1) {
              // Get last selected template
              const lastSelectedPath = vscode.workspace
                .getConfiguration("worklogGenerator")
                .get("lastSelectedPRTemplate", "");

              const templateItems = templates.map(t => ({
                label: t.name,
                description: t.path,
                template: t
              }));

              // Find the last selected template in current list
              let defaultTemplate = templateItems[0];
              if (lastSelectedPath) {
                const lastSelected = templateItems.find(t => t.template.path === lastSelectedPath);
                if (lastSelected) {
                  defaultTemplate = lastSelected;
                  // Move it to the top for visibility
                  const index = templateItems.indexOf(lastSelected);
                  templateItems.splice(index, 1);
                  templateItems.unshift(defaultTemplate);
                }
              }

              const selected = await vscode.window.showQuickPick(templateItems, {
                placeHolder: "Select PR template to fill (last used shown first)"
              });

              if (!selected) {
                this.isGenerating = false;
                this.refresh();
                return;
              }
              selectedTemplate = selected.template;

              // Save the selected template for next time
              await vscode.workspace
                .getConfiguration("worklogGenerator")
                .update("lastSelectedPRTemplate", selectedTemplate.path, vscode.ConfigurationTarget.Global);
            }

            const filledTemplate = await fillPRTemplate(selectedTemplate, worklogContent);

            progress.report({ increment: 100, message: "Complete!" });

            this.isGenerating = false;
            this.refresh();

            // Show the filled template in the WorklogPanel
            WorklogPanel.createOrShow(this.context.extensionUri, filledTemplate, 'pr-template');

            vscode.window.showInformationMessage("✅ PR template filled and opened in details panel");

          } catch (error) {
            this.isGenerating = false;
            this.refresh();
            vscode.window.showErrorMessage(
              `❌ Error generating PR template: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          }
        }
      );
    } catch (error) {
      this.isGenerating = false;
      this.refresh();
      vscode.window.showErrorMessage(
        `❌ Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async generatePRFromCommits(): Promise<void> {
    if (this.isGenerating) {
      vscode.window.showWarningMessage("⏳ Already generating, please wait...");
      return;
    }

    try {
      // Force refresh the LLM provider setting
      this.llmProvider = vscode.workspace
        .getConfiguration("worklogGenerator")
        .get("defaultLlmProvider", "gemini");

      this.isGenerating = true;
      this.refresh();

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "📋 Generating PR template from commits",
          cancellable: true,
        },
        async (progress) => {
          try {
            progress.report({ increment: 0, message: "Finding PR templates..." });

            let templates = await findPRTemplates();

            // If no templates found, offer to paste one manually
            if (templates.length === 0) {
              const action = await vscode.window.showInformationMessage(
                "📋 No PR templates found in .github/ directory.",
                "Paste Template",
                "Cancel"
              );

              if (action === "Paste Template") {
                const manualTemplate = await vscode.window.showInputBox({
                  prompt: "Paste your PR template markdown here (multi-line supported)",
                  placeHolder: "## Description\\n\\n<!-- Describe your changes -->\\n\\n## Type of Change\\n\\n- [ ] Bug fix\\n- [ ] New feature",
                  ignoreFocusOut: true,
                  validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                      return "Template cannot be empty";
                    }
                    return null;
                  }
                });

                if (!manualTemplate) {
                  this.isGenerating = false;
                  this.refresh();
                  return;
                }

                // Create a manual template object
                templates = [{
                  path: "manual-input",
                  name: "Manual Template",
                  content: manualTemplate
                }];
              } else {
                this.isGenerating = false;
                this.refresh();
                return;
              }
            }

            progress.report({ increment: 10, message: "Loading commits..." });

            // Get user commits for selection
            await this.loadUserCommits();
            if (this.userCommits.length === 0) {
              vscode.window.showInformationMessage("📝 No commits found for selection.");
              this.isGenerating = false;
              this.refresh();
              return;
            }

            progress.report({ increment: 20, message: "Selecting commits..." });

            // Show commit selection dialog
            const commitItems = this.userCommits.map(commit => ({
              label: `${commit.hash.substring(0, 8)} - ${commit.message}`,
              description: `${commit.author} • ${commit.date}`,
              picked: false,
              commit: commit
            }));

            const selectedItems = await vscode.window.showQuickPick(commitItems, {
              canPickMany: true,
              placeHolder: "Select commits to include in PR template"
            });

            if (!selectedItems || selectedItems.length === 0) {
              this.isGenerating = false;
              this.refresh();
              return;
            }

            const selectedCommits = selectedItems.map(item => item.commit);

            progress.report({ increment: 40, message: "Generating worklog content..." });

            // Generate combined changes from selected commits
            const commitChanges = await Promise.all(
              selectedCommits.map(async (commit) => {
                try {
                  const changes = await getSelectedCommit(commit.hash);
                  return `Commit: ${commit.hash}\nMessage: ${commit.message}\nChanges:\n${changes}`;
                } catch (error) {
                  return `Commit: ${commit.hash}\nMessage: ${commit.message}\nChanges: Unable to fetch changes`;
                }
              })
            );

            const combinedChanges = commitChanges.join('\n\n---\n\n');
            const worklogContent = await generateWorklog(combinedChanges, this.llmProvider, "business");

            progress.report({ increment: 70, message: "Filling PR template..." });

            let selectedTemplate = templates[0];
            if (templates.length > 1) {
              // Get last selected template
              const lastSelectedPath = vscode.workspace
                .getConfiguration("worklogGenerator")
                .get("lastSelectedPRTemplate", "");

              const templateItems = templates.map(t => ({
                label: t.name,
                description: t.path,
                template: t
              }));

              // Find the last selected template in current list
              let defaultTemplate = templateItems[0];
              if (lastSelectedPath) {
                const lastSelected = templateItems.find(t => t.template.path === lastSelectedPath);
                if (lastSelected) {
                  defaultTemplate = lastSelected;
                  // Move it to the top for visibility
                  const index = templateItems.indexOf(lastSelected);
                  templateItems.splice(index, 1);
                  templateItems.unshift(defaultTemplate);
                }
              }

              const selected = await vscode.window.showQuickPick(templateItems, {
                placeHolder: "Select PR template to fill (last used shown first)"
              });

              if (!selected) {
                this.isGenerating = false;
                this.refresh();
                return;
              }
              selectedTemplate = selected.template;

              // Save the selected template for next time
              await vscode.workspace
                .getConfiguration("worklogGenerator")
                .update("lastSelectedPRTemplate", selectedTemplate.path, vscode.ConfigurationTarget.Global);
            }

            const filledTemplate = await fillPRTemplateFromCommits(selectedTemplate, selectedCommits, worklogContent);

            progress.report({ increment: 100, message: "Complete!" });

            this.isGenerating = false;
            this.refresh();

            // Show the filled template in the WorklogPanel
            WorklogPanel.createOrShow(this.context.extensionUri, filledTemplate, 'pr-template');

            vscode.window.showInformationMessage(
              `✅ PR template filled with ${selectedCommits.length} commits and opened in details panel`
            );

          } catch (error) {
            this.isGenerating = false;
            this.refresh();
            vscode.window.showErrorMessage(
              `❌ Error generating PR template: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          }
        }
      );
    } catch (error) {
      this.isGenerating = false;
      this.refresh();
      vscode.window.showErrorMessage(
        `❌ Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async generateFromCurrentChanges(): Promise<void> {
    if (this.isGenerating) {
      vscode.window.showWarningMessage("⏳ Already generating a worklog, please wait...");
      return;
    }

    try {
      this.isGenerating = true;
      this.refresh();

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "🚀 Generating worklog from current changes",
          cancellable: true,
        },
        async (progress) => {
          try {
            progress.report({ increment: 0, message: "Analyzing git changes..." });

            const changes = await getGitChanges();

            if (!changes || changes.trim() === "") {
              vscode.window.showInformationMessage("📝 No changes detected to generate a worklog.");
              this.isGenerating = false;
              this.refresh();
              return;
            }

            progress.report({ increment: 30, message: "Processing with AI..." });

            this.generatedWorklog = await generateWorklog(
              changes,
              this.llmProvider,
              this.worklogStyle
            );

            progress.report({ increment: 80, message: "Finalizing worklog..." });

            // Store the worklog in extension context
            this.context.workspaceState.update("lastGeneratedWorklog", this.generatedWorklog);

            // Auto-open the worklog panel
            WorklogPanel.createOrShow(this.context.extensionUri, this.generatedWorklog);

            // Stop the loader before showing the success message
            this.isGenerating = false;
            this.refresh();

            progress.report({ increment: 100, message: "Complete!" });

            // Show success message with action buttons
            const action = await vscode.window.showInformationMessage(
              "✅ Worklog generated successfully!",
              "📋 Copy to Clipboard",
              "💾 Save to File"
            );

            if (action === "📋 Copy to Clipboard") {
              await vscode.env.clipboard.writeText(this.generatedWorklog);
              vscode.window.showInformationMessage("📋 Worklog copied to clipboard!");
            } else if (action === "💾 Save to File") {
              vscode.commands.executeCommand("worklog-ai.exportWorklog", this.generatedWorklog);
            }
          } catch (error) {
            this.isGenerating = false;
            this.refresh();
            vscode.window.showErrorMessage(
              `❌ Error generating worklog: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          }
        }
      );
    } catch (error) {
      this.isGenerating = false;
      this.refresh();
      vscode.window.showErrorMessage(
        `❌ Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async generateFromCommit(): Promise<void> {
    if (this.isGenerating) {
      vscode.window.showWarningMessage("⏳ Already generating a worklog, please wait...");
      return;
    }

    try {
      this.isGenerating = true;
      this.refresh();

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "🚀 Generating worklog from selected commit",
          cancellable: true,
        },
        async (progress) => {
          try {
            progress.report({ increment: 0, message: "Selecting commit..." });

            const changes = await getSelectedCommit();

            if (!changes || changes.trim() === "") {
              vscode.window.showInformationMessage("📝 No changes found in the selected commit.");
              this.isGenerating = false;
              this.refresh();
              return;
            }

            progress.report({ increment: 30, message: "Processing with AI..." });

            this.generatedWorklog = await generateWorklog(
              changes,
              this.llmProvider,
              this.worklogStyle
            );

            progress.report({ increment: 80, message: "Finalizing worklog..." });

            // Store the worklog in extension context
            this.context.workspaceState.update("lastGeneratedWorklog", this.generatedWorklog);

            // Auto-open the worklog panel
            WorklogPanel.createOrShow(this.context.extensionUri, this.generatedWorklog);

            // Stop the loader before showing the success message
            this.isGenerating = false;
            this.refresh();

            progress.report({ increment: 100, message: "Complete!" });

            // Show success message with action buttons
            const action = await vscode.window.showInformationMessage(
              "✅ Worklog generated successfully!",
              "📋 Copy to Clipboard",
              "💾 Save to File"
            );

            if (action === "📋 Copy to Clipboard") {
              await vscode.env.clipboard.writeText(this.generatedWorklog);
              vscode.window.showInformationMessage("📋 Worklog copied to clipboard!");
            } else if (action === "💾 Save to File") {
              vscode.commands.executeCommand("worklog-ai.exportWorklog", this.generatedWorklog);
            }
          } catch (error) {
            this.isGenerating = false;
            this.refresh();
            vscode.window.showErrorMessage(
              `❌ Error generating worklog: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          }
        }
      );
    } catch (error) {
      this.isGenerating = false;
      this.refresh();
      vscode.window.showErrorMessage(
        `❌ Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export class WorklogItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command,
    public readonly contextValue?: string,
    public readonly description?: string
  ) {
    super(label, collapsibleState);
    this.tooltip = this.label;
    this.description = description;
    this.contextValue = contextValue;
  }
}

import * as vscode from 'vscode';
import { generateWorklog } from './worklogGenerator';
import { getGitChanges, getSelectedCommit } from './gitUtils';
import { WorklogPanel } from './worklogPanel';

export class WorklogTreeDataProvider implements vscode.TreeDataProvider<WorklogItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<WorklogItem | undefined | null | void> = new vscode.EventEmitter<WorklogItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<WorklogItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private llmProvider: string;
  private worklogStyle: string;
  private generatedWorklog: string | undefined;
  private isGenerating: boolean = false;

  constructor(private context: vscode.ExtensionContext) {
    this.llmProvider = vscode.workspace.getConfiguration('worklogGenerator').get('defaultLlmProvider', 'gemini');
    this.worklogStyle = vscode.workspace.getConfiguration('worklogGenerator').get('defaultWorklogStyle', 'dsu');
    
    // Listen for configuration changes
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('worklogGenerator')) {
        this.llmProvider = vscode.workspace.getConfiguration('worklogGenerator').get('defaultLlmProvider', 'gemini');
        this.worklogStyle = vscode.workspace.getConfiguration('worklogGenerator').get('defaultWorklogStyle', 'dsu');
        this.refresh();
      }
    });
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: WorklogItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: WorklogItem): Promise<WorklogItem[]> {
    if (element) {
      return [];
    }

    const items: WorklogItem[] = [];

    // Settings section
    const settingsSection = new WorklogItem(
      'Settings',
      vscode.TreeItemCollapsibleState.Expanded,
      undefined,
      'settingsSection'
    );
    items.push(settingsSection);

    // LLM Provider dropdown
    const llmProviderItem = new WorklogItem(
      'AI Provider',
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'vscode-worklog.selectLlmProvider',
        title: 'Select AI Provider',
        arguments: [this]
      },
      'llmProvider',
      this.llmProvider === 'gemini' ? 'Google Gemini' : 'OpenAI'
    );
    llmProviderItem.iconPath = new vscode.ThemeIcon('symbol-enum');
    items.push(llmProviderItem);

    // Worklog Style dropdown
    const worklogStyleItem = new WorklogItem(
      'Worklog Style',
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'vscode-worklog.selectWorklogStyle',
        title: 'Select Worklog Style',
        arguments: [this]
      },
      'worklogStyle',
      this.getWorklogStyleLabel()
    );
    worklogStyleItem.iconPath = new vscode.ThemeIcon('symbol-enum');
    items.push(worklogStyleItem);

    // Auto-generate setting
    const autoGenerateItem = new WorklogItem(
      'Auto-generate on Commit',
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'vscode-worklog.toggleAutoGenerate',
        title: 'Toggle Auto-generate on Commit',
        arguments: [this]
      },
      'autoGenerate',
      vscode.workspace.getConfiguration('worklogGenerator').get('autoGenerateOnCommit', false) ? 'Enabled' : 'Disabled'
    );
    autoGenerateItem.iconPath = new vscode.ThemeIcon(
      vscode.workspace.getConfiguration('worklogGenerator').get('autoGenerateOnCommit', false) ? 'check' : 'x'
    );
    items.push(autoGenerateItem);

    // Actions section
    const actionsSection = new WorklogItem(
      'Actions',
      vscode.TreeItemCollapsibleState.Expanded,
      undefined,
      'actionsSection'
    );
    items.push(actionsSection);

    // Generate buttons
    const generateFromCurrentItem = new WorklogItem(
      'Generate from Current Changes',
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'vscode-worklog.generateWorklogFromCurrentChanges',
        title: 'Generate from Current Changes',
        arguments: [this]
      },
      'generateCurrent'
    );
    generateFromCurrentItem.iconPath = new vscode.ThemeIcon('diff');
    items.push(generateFromCurrentItem);

    const generateFromCommitItem = new WorklogItem(
      'Generate from Selected Commit',
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'vscode-worklog.generateWorklogFromCommit',
        title: 'Generate from Selected Commit',
        arguments: [this]
      },
      'generateCommit'
    );
    generateFromCommitItem.iconPath = new vscode.ThemeIcon('git-commit');
    items.push(generateFromCommitItem);

    // Show result if available
    if (this.generatedWorklog) {
      const resultSection = new WorklogItem(
        'Recent Worklog',
        vscode.TreeItemCollapsibleState.Expanded,
        undefined,
        'resultSection'
      );
      items.push(resultSection);
      
      const resultItem = new WorklogItem(
        'View Generated Worklog',
        vscode.TreeItemCollapsibleState.None,
        {
          command: 'vscode-worklog.viewWorklog',
          title: 'View Worklog',
          arguments: [this.generatedWorklog]
        },
        'worklogResult'
      );
      resultItem.iconPath = new vscode.ThemeIcon('preview');
      items.push(resultItem);
      
      const copyItem = new WorklogItem(
        'Copy to Clipboard',
        vscode.TreeItemCollapsibleState.None,
        {
          command: 'vscode-worklog.copyWorklog',
          title: 'Copy Worklog',
          arguments: [this.generatedWorklog]
        },
        'copyWorklog'
      );
      copyItem.iconPath = new vscode.ThemeIcon('copy');
      items.push(copyItem);
      
      const exportItem = new WorklogItem(
        'Export to Markdown',
        vscode.TreeItemCollapsibleState.None,
        {
          command: 'vscode-worklog.exportWorklog',
          title: 'Export Worklog',
          arguments: [this.generatedWorklog]
        },
        'exportWorklog'
      );
      exportItem.iconPath = new vscode.ThemeIcon('save-as');
      items.push(exportItem);
    }

    return items;
  }

  getWorklogStyleLabel(): string {
    switch (this.worklogStyle) {
      case 'technical':
        return 'Technical Style';
      case 'business':
        return 'Business Style';
      case 'dsu':
        return 'Daily Stand-up Style';
      default:
        return 'Daily Stand-up Style';
    }
  }

  async selectLlmProvider(): Promise<void> {
    const selected = await vscode.window.showQuickPick(
      [
        { label: 'Google Gemini', value: 'gemini', description: 'Uses gemini-2.0-flash model' },
        { label: 'OpenAI', value: 'openai', description: 'Uses gpt-4o model' }
      ],
      { 
        placeHolder: 'Select AI Provider',
        title: 'Choose AI Provider for Worklog Generation'
      }
    );

    if (selected) {
      this.llmProvider = selected.value;
      await vscode.workspace.getConfiguration('worklogGenerator').update('defaultLlmProvider', selected.value, vscode.ConfigurationTarget.Global);
      this.refresh();
    }
  }

  async selectWorklogStyle(): Promise<void> {
    const selected = await vscode.window.showQuickPick(
      [
        { 
          label: 'Technical Style', 
          value: 'technical',
          description: 'Focus on technical details and implementation specifics'
        },
        { 
          label: 'Business Style', 
          value: 'business',
          description: 'Focus on business impact with minimal technical jargon'
        },
        { 
          label: 'Daily Stand-up Style', 
          value: 'dsu',
          description: 'Formatted for daily stand-ups with Completed/In Progress/Blockers'
        }
      ],
      { 
        placeHolder: 'Select Worklog Style',
        title: 'Choose Style for Worklog Generation'
      }
    );

    if (selected) {
      this.worklogStyle = selected.value;
      await vscode.workspace.getConfiguration('worklogGenerator').update('defaultWorklogStyle', selected.value, vscode.ConfigurationTarget.Global);
      this.refresh();
    }
  }

  async toggleAutoGenerate(): Promise<void> {
    const currentValue = vscode.workspace.getConfiguration('worklogGenerator').get('autoGenerateOnCommit', false);
    await vscode.workspace.getConfiguration('worklogGenerator').update('autoGenerateOnCommit', !currentValue, vscode.ConfigurationTarget.Global);
    this.refresh();
  }

  async generateFromCurrentChanges(): Promise<void> {
    if (this.isGenerating) {
      vscode.window.showInformationMessage('Already generating a worklog, please wait...');
      return;
    }

    try {
      this.isGenerating = true;
      this.refresh();
      
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Generating worklog from current changes...",
        cancellable: false
      }, async (progress) => {
        try {
          const changes = await getGitChanges();
          
          if (!changes || changes.trim() === '') {
            vscode.window.showInformationMessage('No changes detected to generate a worklog.');
            this.isGenerating = false;
            this.refresh();
            return;
          }
          
          this.generatedWorklog = await generateWorklog(changes, this.llmProvider, this.worklogStyle);
          
          // Store the worklog in extension context
          this.context.workspaceState.update('lastGeneratedWorklog', this.generatedWorklog);
          
          this.isGenerating = false;
          this.refresh();
          
          // Show the worklog in a webview panel
          WorklogPanel.createOrShow(this.context.extensionUri, this.generatedWorklog);
        } catch (error) {
          this.isGenerating = false;
          this.refresh();
          vscode.window.showErrorMessage(`Error generating worklog: ${error instanceof Error ? error.message : String(error)}`);
        }
      });
    } catch (error) {
      this.isGenerating = false;
      this.refresh();
      vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async generateFromCommit(): Promise<void> {
    if (this.isGenerating) {
      vscode.window.showInformationMessage('Already generating a worklog, please wait...');
      return;
    }

    try {
      this.isGenerating = true;
      this.refresh();
      
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Generating worklog from selected commit...",
        cancellable: false
      }, async (progress) => {
        try {
          const changes = await getSelectedCommit();
          
          if (!changes || changes.trim() === '') {
            vscode.window.showInformationMessage('No changes found in the selected commit.');
            this.isGenerating = false;
            this.refresh();
            return;
          }
          
          this.generatedWorklog = await generateWorklog(changes, this.llmProvider, this.worklogStyle);
          
          // Store the worklog in extension context
          this.context.workspaceState.update('lastGeneratedWorklog', this.generatedWorklog);
          
          this.isGenerating = false;
          this.refresh();
          
          // Show the worklog in a webview panel
          WorklogPanel.createOrShow(this.context.extensionUri, this.generatedWorklog);
        } catch (error) {
          this.isGenerating = false;
          this.refresh();
          vscode.window.showErrorMessage(`Error generating worklog: ${error instanceof Error ? error.message : String(error)}`);
        }
      });
    } catch (error) {
      this.isGenerating = false;
      this.refresh();
      vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
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

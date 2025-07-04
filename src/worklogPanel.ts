import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as marked from 'marked';

export class WorklogPanel {
  public static currentPanel: WorklogPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _worklog: string = '';

  public static createOrShow(extensionUri: vscode.Uri, worklog: string) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (WorklogPanel.currentPanel) {
      WorklogPanel.currentPanel._panel.reveal(column);
      WorklogPanel.currentPanel.update(worklog);
      return;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      'worklogResult',
      'Worklog AI',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media')
        ],
        retainContextWhenHidden: true
      }
    );

    WorklogPanel.currentPanel = new WorklogPanel(panel, extensionUri, worklog);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly _extensionUri: vscode.Uri,
    worklog: string
  ) {
    this._panel = panel;
    this._worklog = worklog;

    // Set the webview's initial html content
    this.update(worklog);

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'export':
            this.exportWorklog(this._worklog);
            return;
          case 'copy':
            vscode.env.clipboard.writeText(this._worklog);
            vscode.window.showInformationMessage('Worklog copied to clipboard!');
            return;
          case 'includeInCommit':
            this.includeInCommitMessage(this._worklog);
            return;
        }
      },
      null,
      this._disposables
    );
  }

  public dispose() {
    WorklogPanel.currentPanel = undefined;

    // Clean up our resources
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  public update(worklog: string) {
    this._worklog = worklog;
    this._panel.webview.html = this.getHtmlForWebview(worklog);
  }

  private getHtmlForWebview(worklog: string) {
    // Use the marked library to convert markdown to HTML
    const htmlContent = marked.marked(worklog);

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Worklog AI</title>
        <style>
            body {
                font-family: var(--vscode-font-family);
                color: var(--vscode-editor-foreground);
                padding: 20px;
                line-height: 1.6;
                max-width: 800px;
                margin: 0 auto;
            }
            .header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                padding-bottom: 10px;
                border-bottom: 1px solid var(--vscode-panel-border);
            }
            .header h1 {
                margin: 0;
                font-size: 24px;
                color: var(--vscode-panelTitle-activeForeground);
            }
            .actions {
                display: flex;
                gap: 10px;
                margin-top: 20px;
                padding-top: 15px;
                border-top: 1px solid var(--vscode-panel-border);
            }
            .button {
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                padding: 8px 16px;
                border-radius: 2px;
                cursor: pointer;
                font-size: 13px;
                display: flex;
                align-items: center;
                gap: 5px;
            }
            .button:hover {
                background-color: var(--vscode-button-hoverBackground);
            }
            .button-secondary {
                background-color: var(--vscode-button-secondaryBackground);
                color: var(--vscode-button-secondaryForeground);
            }
            .button-secondary:hover {
                background-color: var(--vscode-button-secondaryHoverBackground);
            }
            .icon {
                width: 16px;
                height: 16px;
                display: inline-block;
            }
            pre {
                background-color: var(--vscode-editor-background);
                padding: 16px;
                border-radius: 4px;
                overflow-x: auto;
                margin: 16px 0;
            }
            code {
                font-family: var(--vscode-editor-font-family);
                font-size: var(--vscode-editor-font-size);
            }
            h1, h2, h3 {
                color: var(--vscode-editor-foreground);
                margin-top: 24px;
                margin-bottom: 16px;
            }
            h1 {
                font-size: 2em;
                border-bottom: 1px solid var(--vscode-panel-border);
                padding-bottom: 0.3em;
            }
            h2 {
                font-size: 1.5em;
                border-bottom: 1px solid var(--vscode-panel-border);
                padding-bottom: 0.3em;
            }
            h3 {
                font-size: 1.25em;
            }
            ul, ol {
                padding-left: 2em;
            }
            li {
                margin: 0.25em 0;
            }
            blockquote {
                border-left: 3px solid var(--vscode-activityBarBadge-background);
                margin-left: 0;
                padding-left: 16px;
                color: var(--vscode-descriptionForeground);
            }
            .content {
                background-color: var(--vscode-editor-background);
                padding: 20px;
                border-radius: 6px;
                margin-bottom: 20px;
            }
            .badge {
                display: inline-block;
                padding: 3px 8px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 500;
                background-color: var(--vscode-badge-background);
                color: var(--vscode-badge-foreground);
                margin-right: 8px;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Worklog AI</h1>
            <div>
                <span class="badge">Generated with AI</span>
            </div>
        </div>
        
        <div class="content">
            ${htmlContent}
        </div>
        
        <div class="actions">
            <button class="button" id="copyBtn">
                <span class="icon">📋</span> Copy to Clipboard
            </button>
            <button class="button" id="exportBtn">
                <span class="icon">📥</span> Export to Markdown
            </button>
        </div>
        
        <script>
            const vscode = acquireVsCodeApi();
            
            document.getElementById('copyBtn').addEventListener('click', () => {
                vscode.postMessage({
                    command: 'copy'
                });
            });
            
            document.getElementById('exportBtn').addEventListener('click', () => {
                vscode.postMessage({
                    command: 'export'
                });
            });
            
            document.getElementById('commitBtn').addEventListener('click', () => {
                vscode.postMessage({
                    command: 'includeInCommit'
                });
            });
        </script>
    </body>
    </html>`;
  }

  private async exportWorklog(worklog: string) {
    // Show save dialog
    const saveUri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file('worklog.md'),
      filters: {
        'Markdown': ['md']
      }
    });

    if (saveUri) {
      try {
        fs.writeFileSync(saveUri.fsPath, worklog);
        vscode.window.showInformationMessage(`Worklog exported to ${saveUri.fsPath}`);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to export worklog: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  private async includeInCommitMessage(worklog: string) {
    // Set configuration to include worklog in commit message
    await vscode.workspace.getConfiguration('worklogGenerator').update('includeWorklogInCommitMessage', true, vscode.ConfigurationTarget.Workspace);
    
    // Store the worklog in global state for later use
    vscode.commands.executeCommand('worklog-ai.storeWorklog', worklog);
    
    vscode.window.showInformationMessage('Worklog will be included in your next commit message. Open the Source Control panel to commit.');
  }
}

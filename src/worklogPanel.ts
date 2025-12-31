import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as marked from 'marked';
import ConfigService from './configService';

export class WorklogPanel {
  public static currentPanel: WorklogPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _worklog: string = '';
  private _contentType: 'worklog' | 'commit' | 'pr-template' = 'worklog';

  public static createOrShow(extensionUri: vscode.Uri, worklog: string, contentType: 'worklog' | 'commit' | 'pr-template' = 'worklog') {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (WorklogPanel.currentPanel) {
      WorklogPanel.currentPanel._panel.reveal(column);
      WorklogPanel.currentPanel.update(worklog, contentType);
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

    WorklogPanel.currentPanel = new WorklogPanel(panel, extensionUri, worklog, contentType);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly _extensionUri: vscode.Uri,
    worklog: string,
    contentType: 'worklog' | 'commit' | 'pr-template' = 'worklog'
  ) {
    this._panel = panel;
    this._worklog = worklog;
    this._contentType = contentType;

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
            vscode.window.showInformationMessage('📋 Worklog copied to clipboard!');
            return;
          case 'copyDsu':
            vscode.env.clipboard.writeText(message.text);
            vscode.window.showInformationMessage('🎤 DSU script copied to clipboard!');
            return;
          case 'generateNew':
            // Execute the appropriate command based on content type
            switch (this._contentType) {
              case 'commit':
                vscode.commands.executeCommand('worklog-ai.generateCommitMessage');
                break;
              case 'pr-template':
                vscode.commands.executeCommand('worklog-ai.fillPRTemplate');
                break;
              case 'worklog':
              default:
                vscode.commands.executeCommand('worklog-ai.generateWorklog');
                break;
            }
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

  public update(worklog: string, contentType?: 'worklog' | 'commit' | 'pr-template') {
    this._worklog = worklog;
    if (contentType) {
      this._contentType = contentType;
    }
    this._panel.webview.html = this.getHtmlForWebview(worklog);
  }

  private formatWorklogContent(htmlContent: string): string {
    // Check if the content contains DSU script section
    if (htmlContent.includes('DSU SCRIPT') || htmlContent.includes('I worked on')) {
      // Split content into worklog and DSU sections
      const sections = htmlContent.split(/DSU SCRIPT|SCRIPT:/i);
      
      if (sections.length > 1) {
        const worklogSection = sections[0];
        const dsuSection = sections[1];
        
        // Clean up the worklog section - remove any "WORKLOG BULLETS:" or "**WORKLOG BULLETS:**" text
        const cleanWorklogSection = worklogSection
          .replace(/\*\*WORKLOG BULLETS:\*\*/g, '')
          .replace(/WORKLOG BULLETS:/g, '')
          .trim();
        
        return `
          <div class="worklog-section">
            <h2>📋 Worklog Bullets</h2>
            ${cleanWorklogSection}
          </div>
          <div class="dsu-section">
            <h2>🗣️ Daily Stand-up Script</h2>
            <div class="dsu-script">
              ${dsuSection}
            </div>
            <button class="button button-secondary" id="copyDsuBtn">
              <span class="icon">🎤</span> Copy DSU Script
            </button>
          </div>
        `;
      }
    }
    
    return htmlContent;
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
                padding: 0;
                margin: 0;
                line-height: 1.6;
                background-color: var(--vscode-editor-background);
            }
            .container {
                max-width: 900px;
                margin: 0 auto;
                padding: 20px;
            }
            .header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 24px;
                padding: 20px;
                background: linear-gradient(135deg, var(--vscode-button-background), var(--vscode-button-hoverBackground));
                border-radius: 12px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }
            .header h1 {
                margin: 0;
                font-size: 28px;
                font-weight: 600;
                color: var(--vscode-button-foreground);
                display: flex;
                align-items: center;
                gap: 12px;
            }
            .header .logo {
                font-size: 32px;
            }
            .badge-container {
                display: flex;
                gap: 8px;
                align-items: center;
            }
            .badge {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 500;
                background-color: var(--vscode-badge-background);
                color: var(--vscode-badge-foreground);
                border: 1px solid var(--vscode-panel-border);
            }
            .content {
                background-color: var(--vscode-editor-background);
                padding: 32px;
                border-radius: 12px;
                margin-bottom: 24px;
                border: 1px solid var(--vscode-panel-border);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
            }
            .actions {
                display: flex;
                gap: 12px;
                padding: 20px;
                background-color: var(--vscode-sideBar-background);
                border-radius: 12px;
                border: 1px solid var(--vscode-panel-border);
                flex-wrap: wrap;
                justify-content: center;
            }
            .button {
                background: linear-gradient(135deg, var(--vscode-button-background), var(--vscode-button-hoverBackground));
                color: var(--vscode-button-foreground);
                border: none;
                padding: 12px 20px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 8px;
                transition: all 0.2s ease;
                min-width: 140px;
                justify-content: center;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }
            .button:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                background: var(--vscode-button-hoverBackground);
            }
            .button:active {
                transform: translateY(0);
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }
            .button-secondary {
                background: linear-gradient(135deg, var(--vscode-button-secondaryBackground), var(--vscode-input-background));
                color: var(--vscode-button-secondaryForeground);
                border: 1px solid var(--vscode-panel-border);
            }
            .button-secondary:hover {
                background: var(--vscode-button-secondaryHoverBackground);
                border-color: var(--vscode-focusBorder);
            }
            .icon {
                font-size: 16px;
                display: inline-block;
            }
            .success-message {
                display: none;
                background-color: var(--vscode-inputValidation-infoBackground);
                color: var(--vscode-inputValidation-infoForeground);
                padding: 12px 16px;
                border-radius: 8px;
                margin-top: 12px;
                border-left: 4px solid var(--vscode-inputValidation-infoBorder);
                animation: slideIn 0.3s ease;
            }
            @keyframes slideIn {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            pre {
                background-color: var(--vscode-textCodeBlock-background);
                padding: 20px;
                border-radius: 8px;
                overflow-x: auto;
                margin: 20px 0;
                border: 1px solid var(--vscode-panel-border);
            }
            code {
                font-family: var(--vscode-editor-font-family);
                font-size: var(--vscode-editor-font-size);
                background-color: var(--vscode-textCodeBlock-background);
                padding: 2px 6px;
                border-radius: 4px;
            }
            h1, h2, h3 {
                color: var(--vscode-editor-foreground);
                margin-top: 32px;
                margin-bottom: 16px;
            }
            h1 {
                font-size: 2.2em;
                border-bottom: 2px solid var(--vscode-panel-border);
                padding-bottom: 12px;
            }
            h2 {
                font-size: 1.6em;
                border-bottom: 1px solid var(--vscode-panel-border);
                padding-bottom: 8px;
            }
            h3 {
                font-size: 1.3em;
                color: var(--vscode-symbolIcon-functionForeground);
            }
            ul, ol {
                padding-left: 24px;
            }
            li {
                margin: 8px 0;
            }
            blockquote {
                border-left: 4px solid var(--vscode-activityBarBadge-background);
                margin-left: 0;
                padding-left: 20px;
                color: var(--vscode-descriptionForeground);
                font-style: italic;
                background-color: var(--vscode-textBlockQuote-background);
                padding: 16px 20px;
                border-radius: 8px;
                margin: 16px 0;
            }
            .stats {
                display: flex;
                gap: 16px;
                margin-top: 16px;
                font-size: 12px;
                color: var(--vscode-descriptionForeground);
            }
            .stat-item {
                display: flex;
                align-items: center;
                gap: 4px;
            }
            .worklog-section {
                margin-bottom: 24px;
                padding-bottom: 20px;
                border-bottom: 1px solid var(--vscode-panel-border);
            }
            .dsu-section {
                margin-top: 24px;
                padding: 20px;
                background-color: var(--vscode-sideBar-background);
                border-radius: 8px;
                border: 1px solid var(--vscode-panel-border);
            }
            .dsu-script {
                background-color: var(--vscode-textCodeBlock-background);
                padding: 16px;
                border-radius: 8px;
                margin: 12px 0;
                border-left: 4px solid var(--vscode-activityBarBadge-background);
                font-style: italic;
                line-height: 1.5;
            }
            .dsu-section h2 {
                margin-top: 0;
                color: var(--vscode-symbolIcon-functionForeground);
            }
            @media (max-width: 600px) {
                .container {
                    padding: 12px;
                }
                .header {
                    flex-direction: column;
                    gap: 12px;
                    text-align: center;
                }
                .actions {
                    flex-direction: column;
                }
                .button {
                    min-width: auto;
                    width: 100%;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>
                    <span class="logo">🤖</span>
                    Worklog AI
                </h1>
                <div class="badge-container">
                    <div class="badge">
                        <span>✨</span> AI Generated
                    </div>
                    <div class="badge">
                        <span>📅</span> ${new Date().toLocaleDateString()}
                    </div>
                </div>
            </div>
            
            <div class="content">
                ${this.formatWorklogContent(htmlContent)}
                <div class="stats">
                    <div class="stat-item">
                        <span>📊</span>
                        <span>Words: ${worklog.split(' ').length}</span>
                    </div>
                    <div class="stat-item">
                        <span>📝</span>
                        <span>Characters: ${worklog.length}</span>
                    </div>
                    <div class="stat-item">
                        <span>⏱️</span>
                        <span>Generated: ${new Date().toLocaleTimeString()}</span>
                    </div>
                </div>
            </div>
            
            <div class="actions">
                <button class="button" id="copyBtn">
                    <span class="icon">📋</span> Copy to Clipboard
                </button>
                <button class="button button-secondary" id="exportBtn">
                    <span class="icon">💾</span> Save as Markdown
                </button>
                <button class="button button-secondary" id="newWorklogBtn">
                    <span class="icon">✨</span> Generate New
                </button>
            </div>
            
            <div class="success-message" id="successMessage">
                <span class="icon">✅</span> <span id="successText"></span>
            </div>
        </div>
        
        <script>
            const vscode = acquireVsCodeApi();
            
            function showSuccess(message) {
                const successDiv = document.getElementById('successMessage');
                const successText = document.getElementById('successText');
                successText.textContent = message;
                successDiv.style.display = 'block';
                setTimeout(() => {
                    successDiv.style.display = 'none';
                }, 3000);
            }
            
            document.getElementById('copyBtn').addEventListener('click', () => {
                vscode.postMessage({
                    command: 'copy'
                });
                showSuccess('Worklog copied to clipboard!');
            });
            
            document.getElementById('exportBtn').addEventListener('click', () => {
                vscode.postMessage({
                    command: 'export'
                });
            });
            
            document.getElementById('newWorklogBtn').addEventListener('click', () => {
                vscode.postMessage({
                    command: 'generateNew'
                });
            });

            // Handle DSU copy button if it exists
            const copyDsuBtn = document.getElementById('copyDsuBtn');
            if (copyDsuBtn) {
                copyDsuBtn.addEventListener('click', () => {
                    const dsuScript = document.querySelector('.dsu-script');
                    if (dsuScript) {
                        vscode.postMessage({
                            command: 'copyDsu',
                            text: dsuScript.textContent.trim()
                        });
                        showSuccess('DSU script copied to clipboard!');
                    }
                });
            }
        </script>
    </body>
    </html>`;
  }

  private async exportWorklog(worklog: string) {
    // Show save dialog
    // Get the workspace folder path or user's home directory as fallback
    let basePath = '';
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      basePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    } else {
      basePath = require('os').homedir();
    }
    
    const fileName = `worklog-${new Date().toISOString().split('T')[0]}.md`;
    const fullPath = require('path').join(basePath, fileName);
    
    const saveUri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(fullPath),
      filters: {
        'Markdown Files': ['md'],
        'Text Files': ['txt'],
        'All Files': ['*']
      },
      saveLabel: '💾 Save Worklog'
    });

    if (saveUri) {
      try {
        // Add metadata header to the exported file
        const exportContent = `<!-- Generated by Worklog AI on ${new Date().toLocaleString()} -->
# Worklog - ${new Date().toLocaleDateString()}

${worklog}

---
*Generated with ❤️ by Worklog AI*`;

        fs.writeFileSync(saveUri.fsPath, exportContent);
        
        const action = await vscode.window.showInformationMessage(
          `✅ Worklog exported successfully!`,
          '📂 Open File',
          '📁 Show in Explorer'
        );

        if (action === '📂 Open File') {
          vscode.commands.executeCommand('vscode.open', saveUri);
        } else if (action === '📁 Show in Explorer') {
          vscode.commands.executeCommand('revealFileInOS', saveUri);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`❌ Failed to export worklog: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  private async includeInCommitMessage(worklog: string) {
    await ConfigService.setIncludeWorklogInCommitMessage(true);

    // Store the worklog in global state for later use
    vscode.commands.executeCommand('worklog-ai.storeWorklog', worklog);

    vscode.window.showInformationMessage('Worklog will be included in your next commit message. Open the Source Control panel to commit.');
  }
}

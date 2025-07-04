import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Get the current git changes (diff)
 */
export async function getGitChanges(): Promise<string> {
  try {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      throw new Error('No workspace folder open');
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    
    // Get staged changes
    const { stdout: stagedChanges } = await execAsync('git diff --staged', { cwd: rootPath });
    
    // Get unstaged changes
    const { stdout: unstagedChanges } = await execAsync('git diff', { cwd: rootPath });
    
    // Combine both types of changes
    const allChanges = stagedChanges + unstagedChanges;
    
    if (!allChanges.trim()) {
      throw new Error('No changes detected in the current workspace');
    }
    
    return allChanges;
  } catch (error) {
    console.error('Error getting git changes:', error);
    throw new Error(`Failed to get git changes: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get changes from a selected commit
 */
export async function getSelectedCommit(): Promise<string> {
  try {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      throw new Error('No workspace folder open');
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    
    // Get recent commits to show in the quick pick
    const { stdout: gitLog } = await execAsync(
      'git log --pretty=format:"%h|%s|%ad" --date=short -n 10', 
      { cwd: rootPath }
    );
    
    const commits = gitLog.split('\n').map(line => {
      const [hash, subject, date] = line.split('|');
      return {
        label: `${date}: ${subject}`,
        description: hash,
        detail: `Commit: ${hash}`,
        hash
      };
    });
    
    if (commits.length === 0) {
      throw new Error('No commits found in the repository');
    }
    
    const selectedCommit = await vscode.window.showQuickPick(commits, {
      placeHolder: 'Select a commit to generate worklog'
    });
    
    if (!selectedCommit) {
      throw new Error('No commit selected');
    }
    
    // Get the changes in the selected commit
    const { stdout: commitChanges } = await execAsync(
      `git show --patch ${selectedCommit.hash}`,
      { cwd: rootPath }
    );
    
    return commitChanges;
  } catch (error) {
    console.error('Error selecting commit:', error);
    throw new Error(`Failed to get selected commit: ${error instanceof Error ? error.message : String(error)}`);
  }
}

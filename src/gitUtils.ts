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
export async function getSelectedCommit(commitHash?: string): Promise<string> {
  try {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      throw new Error('No workspace folder open');
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    
    let selectedHash = commitHash;
    
    if (!selectedHash) {
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
      
      selectedHash = selectedCommit.hash;
    }
    
    // Get the changes in the selected commit
    const { stdout: commitChanges } = await execAsync(
      `git show --patch ${selectedHash}`,
      { cwd: rootPath }
    );
    
    return commitChanges;
  } catch (error) {
    console.error('Error selecting commit:', error);
    throw new Error(`Failed to get selected commit: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get current branch name
 */
export async function getCurrentBranch(): Promise<string> {
  try {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      throw new Error('No workspace folder open');
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const { stdout } = await execAsync('git branch --show-current', { cwd: rootPath });
    
    return stdout.trim();
  } catch (error) {
    console.error('Error getting current branch:', error);
    throw new Error(`Failed to get current branch: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get all branches
 */
export async function getBranches(): Promise<Array<{name: string, current: boolean, lastCommit: string}>> {
  try {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      throw new Error('No workspace folder open');
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const { stdout } = await execAsync('git branch -v', { cwd: rootPath });
    
    const branches = stdout.split('\n')
      .filter(line => line.trim())
      .map(line => {
        const current = line.startsWith('*');
        const cleanLine = line.replace(/^\*?\s+/, '');
        const parts = cleanLine.split(/\s+/);
        const name = parts[0];
        const hash = parts[1];
        const lastCommit = parts.slice(2).join(' ');
        
        return {
          name,
          current,
          lastCommit: `${hash.substring(0, 7)} ${lastCommit}`
        };
      });
    
    return branches;
  } catch (error) {
    console.error('Error getting branches:', error);
    throw new Error(`Failed to get branches: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get user's commits for a specific branch
 */
export async function getUserCommits(branchName: string): Promise<Array<{hash: string, message: string, date: string, author: string}>> {
  try {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      throw new Error('No workspace folder open');
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    
    // Get current user's email
    const { stdout: userEmail } = await execAsync('git config user.email', { cwd: rootPath });
    const email = userEmail.trim();
    
    // Get commits by the current user on the specified branch
    const { stdout: gitLog } = await execAsync(
      `git log ${branchName} --author="${email}" --pretty=format:"%H|%s|%ad|%an" --date=short -n 50`,
      { cwd: rootPath }
    );
    
    if (!gitLog.trim()) {
      return [];
    }
    
    const commits = gitLog.split('\n').map(line => {
      const [hash, message, date, author] = line.split('|');
      return {
        hash,
        message,
        date,
        author
      };
    });
    
    return commits;
  } catch (error) {
    console.error('Error getting user commits:', error);
    return []; // Return empty array instead of throwing error
  }
}

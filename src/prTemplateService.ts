import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { getGitChanges } from "./gitUtils";

export interface PRTemplateInfo {
  path: string;
  name: string;
  content: string;
}

/**
 * Find PR template files in .github directory
 */
export async function findPRTemplates(): Promise<PRTemplateInfo[]> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return [];
  }

  const githubDir = path.join(workspaceFolder.uri.fsPath, ".github");
  const templates: PRTemplateInfo[] = [];

  try {
    const files = await fs.promises.readdir(githubDir);
    
    for (const file of files) {
      if (file.endsWith(".md") && (
        file.toLowerCase().includes("pull_request") || 
        file.toLowerCase().includes("pr_template") ||
        file.toLowerCase().includes("pull-request")
      )) {
        const filePath = path.join(githubDir, file);
        const content = await fs.promises.readFile(filePath, "utf8");
        
        templates.push({
          path: filePath,
          name: file,
          content: content
        });
      }
    }
  } catch (error) {
    console.log("No .github directory or PR templates found");
  }

  return templates;
}

/**
 * Fill PR template with generated content
 */
export async function fillPRTemplate(
  template: PRTemplateInfo,
  changes: string,
  worklogContent: string
): Promise<string> {
  let filledTemplate = template.content;

  // Extract commit messages from changes
  const commitMessages = extractCommitMessages(changes);
  
  // Fill common sections
  filledTemplate = filledTemplate.replace(
    /### Description\s*\n\n[^\n#]*/,
    `### Description\n\n${worklogContent.split('\n').slice(0, 3).join('\n')}`
  );

  filledTemplate = filledTemplate.replace(
    /### Changes Made\s*\n\n[^\n#]*/,
    `### Changes Made\n\n${worklogContent}`
  );

  // Auto-detect change type
  const changeType = detectChangeType(changes, commitMessages);
  if (changeType) {
    filledTemplate = fillChangeType(filledTemplate, changeType);
  }

  return filledTemplate;
}

/**
 * Fill PR template with generated content from selected commits
 */
export async function fillPRTemplateFromCommits(
  template: PRTemplateInfo,
  selectedCommits: any[],
  worklogContent: string
): Promise<string> {
  let filledTemplate = template.content;

  // Extract commit messages and changes
  const commitMessages = selectedCommits.map(c => c.message);
  const allChanges = selectedCommits.map(c => `${c.hash}: ${c.message}`).join('\n');
  
  // Fill common sections
  filledTemplate = filledTemplate.replace(
    /### Description\s*\n\n[^\n#]*/,
    `### Description\n\n${worklogContent.split('\n').slice(0, 3).join('\n')}`
  );

  filledTemplate = filledTemplate.replace(
    /### Changes Made\s*\n\n[^\n#]*/,
    `### Changes Made\n\n${worklogContent}\n\n**Selected Commits:**\n${commitMessages.map(msg => `- ${msg}`).join('\n')}`
  );

  // Auto-detect change type from commits
  const changeType = detectChangeTypeFromCommits(commitMessages);
  if (changeType) {
    filledTemplate = fillChangeType(filledTemplate, changeType);
  }

  return filledTemplate;
}

/**
 * Detect change type from commit messages
 */
function detectChangeTypeFromCommits(commitMessages: string[]): string | null {
  const allMessages = commitMessages.join(' ').toLowerCase();
  
  if (allMessages.includes('fix') || allMessages.includes('bug')) {
    return 'bug-fix';
  }
  if (allMessages.includes('feat') || allMessages.includes('add') || allMessages.includes('new')) {
    return 'new-feature';
  }
  if (allMessages.includes('break') || allMessages.includes('major')) {
    return 'breaking-change';
  }
  
  return null;
}

/**
 * Extract commit messages from git changes
 */
function extractCommitMessages(changes: string): string[] {
  const lines = changes.split('\n');
  const commits: string[] = [];
  
  for (const line of lines) {
    if (line.startsWith('commit ')) {
      const nextLineIndex = lines.indexOf(line) + 4; // Skip commit hash, author, date
      if (nextLineIndex < lines.length) {
        const commitMsg = lines[nextLineIndex]?.trim();
        if (commitMsg) {
          commits.push(commitMsg);
        }
      }
    }
  }
  
  return commits;
}

/**
 * Detect change type from commits and changes
 */
function detectChangeType(changes: string, commits: string[]): string | null {
  const allText = (changes + ' ' + commits.join(' ')).toLowerCase();
  
  if (allText.includes('fix') || allText.includes('bug')) {
    return 'bug-fix';
  }
  if (allText.includes('feat') || allText.includes('add') || allText.includes('new')) {
    return 'new-feature';
  }
  if (allText.includes('break') || allText.includes('major')) {
    return 'breaking-change';
  }
  
  return null;
}

/**
 * Fill change type checkboxes
 */
function fillChangeType(template: string, changeType: string): string {
  const typeMap: { [key: string]: string } = {
    'bug-fix': 'Bug fix (non-breaking change which fixes an issue)',
    'new-feature': 'New feature (non-breaking change which adds functionality)',
    'breaking-change': 'Breaking change (fix or feature that would cause existing functionality to not work as expected)'
  };

  const targetText = typeMap[changeType];
  if (targetText) {
    template = template.replace(
      `- [ ] ${targetText}`,
      `- [x] ${targetText}`
    );
  }

  return template;
}

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import axios from "axios";
import { getGitChanges } from "./gitUtils";
import ConfigService from "./configService";
import { getSelectedModel } from "./modelService";

export interface PRTemplateInfo {
  path: string;
  name: string;
  content: string;
}

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

async function fillTemplateWithAI(
  templateContent: string,
  worklogContent: string,
  commitMessages: string[] | null
): Promise<string> {
  const provider = ConfigService.getDefaultLlmProvider();
  const worklogStyle = ConfigService.getDefaultWorklogStyle();

  const styleInstructions = worklogStyle === "technical"
    ? `**WRITING STYLE: TECHNICAL**
- Use technical terminology and be specific about implementation details
- Include file names, function names, and class names where relevant
- Add small code snippets (1-3 lines max) when they help illustrate changes
- Mention technical concepts like APIs, database changes, algorithms
- Example: "Updated \`UserService.authenticate()\` to use bcrypt hashing instead of MD5"
- Example: "Modified \`config/database.ts\` to add connection pooling (max: 20)"
- Be precise about what was changed at the code level`
    : `**WRITING STYLE: BUSINESS**
- Use plain, non-technical language that stakeholders can understand
- Focus on user-facing changes and business value
- Describe what the change does for users, not how it's implemented
- Avoid mentioning file names, functions, or technical implementation details
- Example: "Improved login security for better user data protection"
- Example: "Enhanced performance for faster page loading"
- Focus on the "why" and "what" rather than the "how"`;

  const prompt = `You are an expert at filling GitHub Pull Request templates. Your task is to carefully analyze the PR template structure and fill it with accurate information based on the changes provided.

**CRITICAL RULES:**
1. **Read the Template Carefully**: Understand every section - Description, Summary, Changes Made, Type of Change checkboxes, Test Plan, etc.
2. **Preserve ALL Template Structure**: Keep every section header, checkbox, markdown formatting exactly as-is
3. **Fill Every Section Properly**:
   - **Description/Summary sections**: Write a brief, flowing paragraph (2-4 sentences) - NO bullet points
   - **Changes Made/What's Changed sections**: Use detailed bullet points (5-8 bullets) with one specific change per bullet
   - **Test Plan sections**: Provide numbered or bulleted testing steps
   - **Breaking Changes sections**: Fill if applicable, otherwise write "N/A" or "None"
4. **DO NOT mention individual commit messages** - summarize the overall changes
5. **Remove placeholder text**: Delete "Describe...", "Explain...", example text, comments like "<!-- ... -->"
6. **Smart Handling**: If a section doesn't apply, write "N/A" or "None" - don't leave template instructions visible

**WRITING STYLE TO FOLLOW:**
${styleInstructions}

**CRITICAL**: The writing style above applies to BOTH description paragraphs AND bullet points in Changes Made section.

**CHECKBOX FILLING INSTRUCTIONS - EXTREMELY IMPORTANT:**
This is the MOST CRITICAL part - you MUST properly mark checkboxes:

1. **Find ALL checkbox sections** in the template (they look like - [ ] or - [x])
2. **For EACH checkbox**, carefully read what it's asking
3. **Analyze the changes** and determine if that checkbox applies
4. **Mark with [x]** if it applies: - [x] New feature
5. **Leave as [ ]** ONLY if it definitely does NOT apply: - [ ] Breaking change

**Common checkbox patterns to look for:**
- **Type of change**: Bug fix / New feature / Breaking change / Documentation update
  - **Bug fix**: If fixing bugs, errors, or issues → Mark [x]
  - **New feature**: If adding new functionality, capabilities, or features → Mark [x]
  - **Breaking change**: If changing existing APIs, removing features, or requiring migration → Mark [x]
  - **Documentation update**: If only updating docs → Mark [x]
  - **Dependency updates/maintenance**: Usually falls under "Bug fix" (for security/stability) or leave unchecked if none apply
  - **IMPORTANT**: You MUST check at least ONE "Type of change" checkbox. If unsure, pick the closest match.

- **Testing checkboxes**: Unit tests / Integration tests / Manual testing
  - If changes include test files or testing code, mark appropriate boxes
  - If no tests were added/changed, leave unchecked

- **Code quality**: Code follows guidelines / Self-review done / Comments added
  - These are usually safe to mark [x] for any code changes
  - Mark "Code follows guidelines" if you made code changes
  - Mark "Self-review done" if you reviewed the changes

- **Documentation**: Documentation updated / No documentation needed
  - If you updated docs or README, mark "updated"
  - If changes don't need documentation, mark "not needed"
  - One of these should typically be checked

**EXAMPLE of proper checkbox filling:**

BEFORE (template):
## Type of change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change

AFTER (if adding a new feature):
## Type of change
- [ ] Bug fix
- [x] New feature
- [ ] Breaking change

**DO NOT leave all checkboxes unchecked!** You MUST analyze and mark the appropriate ones based on the actual changes.

**Changes Made:**
${worklogContent}

${commitMessages ? `**Commit Messages (for context only, do NOT list these in the PR):**\n${commitMessages.join('\n')}\n` : ''}

**PR Template to Fill:**
${templateContent}

**Output the filled template directly (no explanations, no extra text, just the filled template):**`;

  try {
    let filledTemplate: string;

    if (provider === "gemini") {
      filledTemplate = await callGeminiForTemplate(prompt);
    } else if (provider === "openai") {
      filledTemplate = await callOpenAIForTemplate(prompt);
    } else {
      filledTemplate = await callLocalLLMForTemplate(prompt);
    }

    // Clean up the filled template for proper markdown rendering
    return cleanupTemplate(filledTemplate);
  } catch (error) {
    console.error("Error filling template with AI:", error);
    return templateContent;
  }
}

function cleanupTemplate(template: string): string {
  let cleaned = template.trim();

  // Remove any markdown code block wrappers if AI added them
  cleaned = cleaned.replace(/^```markdown\s*/i, '');
  cleaned = cleaned.replace(/^```\s*/i, '');
  cleaned = cleaned.replace(/\s*```\s*$/i, '');

  // Fix spacing around headers - ensure blank line before headers
  cleaned = cleaned.replace(/([^\n])\n(#{1,6}\s)/g, '$1\n\n$2');

  // Ensure blank line after headers (if not already present)
  cleaned = cleaned.replace(/(#{1,6}\s[^\n]+)\n([^#\n])/g, '$1\n\n$2');

  // Ensure checkboxes have proper spacing and format
  cleaned = cleaned.replace(/^-\s*\[([x ])\]\s*/gm, '- [$1] ');

  // Ensure bullet points have consistent spacing
  cleaned = cleaned.replace(/^\*\s+/gm, '* ');

  // Add blank line before bullet lists if not already present
  cleaned = cleaned.replace(/([^\n*-])\n([*-]\s)/gm, '$1\n\n$2');

  // Normalize excessive line breaks - replace 3+ newlines with exactly 2
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // Ensure "N/A" and "None" sections have proper spacing
  cleaned = cleaned.replace(/(N\/A|None)\n([^#\n])/g, '$1\n\n$2');

  return cleaned.trim();
}

async function callGeminiForTemplate(prompt: string): Promise<string> {
  const apiKey = ConfigService.getGeminiApiKey();
  const selectedModel = getSelectedModel("gemini");

  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent`,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096,
      },
    },
    {
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
    }
  );

  const candidate = response.data.candidates[0];

  // Check if the response was cut off
  if (candidate.finishReason && candidate.finishReason !== 'STOP') {
    console.warn(`Gemini API response incomplete for PR template. Finish reason: ${candidate.finishReason}`);
    if (candidate.finishReason === 'MAX_TOKENS') {
      console.warn('PR template response was truncated due to token limit.');
    }
  }

  return candidate.content.parts[0].text;
}

async function callOpenAIForTemplate(prompt: string): Promise<string> {
  const apiKey = ConfigService.getOpenAIApiKey();
  const selectedModel = getSelectedModel("openai");

  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: selectedModel,
      messages: [
        {
          role: "system",
          content: "You are an expert at filling GitHub PR templates concisely and accurately."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 4096,
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    }
  );

  const choice = response.data.choices[0];

  // Check if the response was cut off
  if (choice.finish_reason && choice.finish_reason !== 'stop') {
    console.warn(`OpenAI API response incomplete for PR template. Finish reason: ${choice.finish_reason}`);
    if (choice.finish_reason === 'length') {
      console.warn('PR template response was truncated due to token limit.');
    }
  }

  return choice.message.content;
}

async function callLocalLLMForTemplate(prompt: string): Promise<string> {
  const baseUrl = ConfigService.getLocalLlmBaseUrl();
  const modelName = ConfigService.getLocalLlmModelName();

  const response = await axios.post(
    `${baseUrl}/chat/completions`,
    {
      model: modelName,
      messages: [
        {
          role: "system",
          content: "You are an expert at filling GitHub PR templates concisely and accurately."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 4096,
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const choice = response.data.choices[0];

  // Check if the response was cut off
  if (choice.finish_reason && choice.finish_reason !== 'stop') {
    console.warn(`Local LLM API response incomplete for PR template. Finish reason: ${choice.finish_reason}`);
    if (choice.finish_reason === 'length') {
      console.warn('PR template response was truncated due to token limit.');
    }
  }

  return choice.message.content;
}

export async function fillPRTemplate(
  template: PRTemplateInfo,
  changes: string,
  worklogContent: string
): Promise<string> {
  return await fillTemplateWithAI(template.content, worklogContent, null);
}

export async function fillPRTemplateFromCommits(
  template: PRTemplateInfo,
  selectedCommits: any[],
  worklogContent: string
): Promise<string> {
  const commitMessages = selectedCommits.map(c => c.message);
  return await fillTemplateWithAI(template.content, worklogContent, commitMessages);
}

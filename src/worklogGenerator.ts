import * as vscode from "vscode";
import axios from "axios";

/**
 * Generate a worklog based on code changes using the specified LLM provider and style
 */
export async function generateWorklog(
  changes: string,
  llmProvider: string,
  worklogStyle: string
): Promise<string> {
  try {
    // Get API keys and settings from configuration
    const geminiApiKey = vscode.workspace
      .getConfiguration("worklogGenerator")
      .get("geminiApiKey", "");
    const openaiApiKey = vscode.workspace
      .getConfiguration("worklogGenerator")
      .get("openaiApiKey", "");
    const localLlmBaseUrl = vscode.workspace
      .getConfiguration("worklogGenerator")
      .get("localLlmBaseUrl", "http://localhost:11434/v1");
    const localLlmModelName = vscode.workspace
      .getConfiguration("worklogGenerator")
      .get("localLlmModelName", "phi");

    // Validate API key or settings based on selected provider
    if (llmProvider === "gemini" && !geminiApiKey) {
      throw new Error("Gemini API key not configured. Please add it in the extension settings.");
    }

    if (llmProvider === "openai" && !openaiApiKey) {
      throw new Error("OpenAI API key not configured. Please add it in the extension settings.");
    }

    if (llmProvider === "local" && !localLlmBaseUrl) {
      throw new Error("Local LLM Base URL not configured. Please add it in the extension settings.");
    }

    // Create prompt based on the selected style
    const prompt = createPrompt(changes, worklogStyle);

    // Call the appropriate LLM API
    if (llmProvider === "gemini") {
      return await callGeminiApi(prompt, geminiApiKey);
    } else if (llmProvider === "openai") {
      return await callOpenAiApi(prompt, openaiApiKey);
    } else {
      return await callLocalLlmApi(prompt, localLlmBaseUrl, localLlmModelName);
    }
  } catch (error) {
    console.error("Error generating worklog:", error);
    throw new Error(
      `Failed to generate worklog: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Create a prompt for the LLM based on the selected style
 */
function createPrompt(changes: string, worklogStyle: string): string {
  // Limit changes to avoid exceeding token limits
  const limitedChanges =
    changes.length > 10000 ? changes.substring(0, 10000) + "...[truncated]" : changes;

  let styleInstruction = "";
  let exampleFormat = "";
  let instructions = "";

  switch (worklogStyle) {
    case "commit-message":
      styleInstruction = `
Create a concise git commit message with the following requirements:
- The first line should be a clear summary of the changes (max 100 characters)
- Use the imperative mood (e.g., "Add feature" not "Added feature")
- Focus on the "what" and "why" of the changes, not the "how"
- Be specific but concise
- Start with a capital letter and do not end with a period
`;

      exampleFormat = `
Example Commit Message:
Add user authentication with Google OAuth2

Example Commit Description:
- Implement Google OAuth2 authentication flow
- Add user profile data storage in database
- Create middleware for protected routes
- Update login UI to include Google sign-in button
- Add session management for authenticated users
`;

      instructions = `
INSTRUCTIONS:
Generate exactly two sections:

1. **COMMIT MESSAGE:**
- A single line summary of the changes
- Maximum 100 characters
- Use imperative mood (e.g., "Add feature" not "Added feature")
- Start with a capital letter and do not end with a period

2. **COMMIT DESCRIPTION:**
- Generate 3-5 bullet points explaining the changes in more detail
- Each bullet point should be concise but descriptive
- Focus on the most important and meaningful changes
- Start each bullet with a dash (-)
`;
      break;

    case "technical":
      styleInstruction = `
Create a detailed technical worklog with the following requirements:
- Include specific file names, function names, field names, and class names
- Mention the type of change (added, modified, removed, refactored)
- Be specific about technical implementation details
- Use developer-friendly language and terminology
- Focus on what was technically implemented
- Each bullet point should be specific and actionable
`;

      exampleFormat = `
Example Technical Worklog:
- Added \`calculateTotalPrice()\` function in \`src/utils/pricing.ts\`
- Modified \`UserModel.email\` field validation in \`models/User.js\`
- Removed deprecated \`oldPaymentMethod\` property from \`PaymentService\` class
- Refactored \`processOrder()\` method in \`services/OrderService.ts\` to use async/await
- Created new \`ValidationError\` class in \`src/errors/ValidationError.ts\`
- Updated \`database.config.js\` to include connection pooling settings
- Fixed null pointer exception in \`getUserById()\` method

Example DSU Script:
"I worked on improving the payment processing system. I added a new price calculation function, updated user validation logic, and refactored the order processing to be more reliable. I also created better error handling and fixed some database connection issues."
`;

      instructions = `
INSTRUCTIONS:
Generate exactly two sections:

1. **WORKLOG BULLETS:**
- Generate only bullet points, no paragraphs or explanations
- Each bullet point should be concise but descriptive
- Focus on the most important and meaningful changes
- Ignore minor formatting changes, whitespace, or trivial updates
- Maximum 10 bullet points
- Start each bullet with a dash (-)

2. **DSU SCRIPT:**
- Write a 2-3 sentence script that starts with "I worked on..."
- Make it conversational and suitable for reading in a daily stand-up call
- Summarize the key accomplishments in natural language
- Keep it under 100 words
`;
      break;

    case "business":
    default:
      styleInstruction = `
Create a business-focused worklog using human-readable language:
- Do NOT include file names, function names, or technical jargon
- Use action words like: created, updated, modified, implemented, integrated, optimized, refactored, analyzed, verified, reviewed, enhanced, improved, fixed, resolved, added, removed
- Focus on the business value and impact of changes
- Explain what was accomplished from a user/business perspective
- Each bullet point should describe a meaningful business outcome
- Write as if explaining to a non-technical stakeholder
`;

      exampleFormat = `
Example Business Worklog:
- Created automated pricing calculation system
- Updated user email validation to improve data quality
- Removed outdated payment processing methods
- Improved order processing performance and reliability
- Implemented comprehensive error handling for better user experience
- Enhanced database connection management for better scalability
- Fixed user lookup issues that were causing login problems

Example DSU Script:
"I worked on enhancing our payment system. I created an automated pricing feature, improved user data validation, and made the order processing more reliable. I also implemented better error handling to improve the user experience and fixed some login issues that customers were experiencing."
`;

      instructions = `
INSTRUCTIONS:
Generate exactly two sections:

1. **WORKLOG BULLETS:**
- Generate only bullet points, no paragraphs or explanations
- Each bullet point should be concise but descriptive
- Focus on the most important and meaningful changes
- Ignore minor formatting changes, whitespace, or trivial updates
- Maximum 10 bullet points
- Start each bullet with a dash (-)

2. **DSU SCRIPT:**
- Write a 2-3 sentence script that starts with "I worked on..."
- Make it conversational and suitable for reading in a daily stand-up call
- Summarize the key accomplishments in natural language
- Keep it under 100 words
`;
      break;
  }

  return `
You are a professional software developer creating a worklog entry. Analyze the provided code changes and generate the appropriate output.

STYLE REQUIREMENTS:
${styleInstruction}

FORMAT EXAMPLE:
${exampleFormat}

${instructions}

CODE CHANGES TO ANALYZE:
${limitedChanges}

Generate the output now:
`;
}

/**
 * Call the Gemini API to generate a worklog
 */
async function callGeminiApi(prompt: string, apiKey: string): Promise<string> {
  try {
    const response = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      {
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
      }
    );

    // Extract the generated text from the response
    const generatedText = response.data.candidates[0].content.parts[0].text;
    return generatedText;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        `Gemini API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
      );
    }
    throw new Error(
      `Failed to call Gemini API: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Call the OpenAI API to generate a worklog
 */
async function callOpenAiApi(prompt: string, apiKey: string): Promise<string> {
  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that generates worklogs based on code changes.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.2,
        max_tokens: 1024,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    // Extract the generated text from the response
    const generatedText = response.data.choices[0].message.content;
    return generatedText;
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        `OpenAI API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
      );
    }
    throw new Error(
      `Failed to call OpenAI API: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Call the Local LLM API to generate a worklog
 */
async function callLocalLlmApi(prompt: string, baseUrl: string, modelName: string): Promise<string> {
  try {
    const chatCompletionsUrl = `${baseUrl}/chat/completions`;
    
    const response = await axios.post(
      chatCompletionsUrl,
      {
        model: modelName,
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that generates worklogs based on code changes.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.2,
        max_tokens: 1024,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    // Extract the generated text from the response
    const generatedText = response.data.choices[0].message.content;
    return generatedText;
  } catch (error) {
    console.error("Error calling Local LLM API:", error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        `Local LLM API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
      );
    }
    throw new Error(
      `Failed to call Local LLM API: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

import axios from "axios";
import { getSelectedModel } from "./modelService";
import ConfigService from "./configService";

export async function generateCommitMessage(
  changes: string,
  llmProvider: string
): Promise<{ message: string; description: string }> {
  try {
    const geminiApiKey = ConfigService.getGeminiApiKey();
    const openaiApiKey = ConfigService.getOpenAIApiKey();
    const localLlmBaseUrl = ConfigService.getLocalLlmBaseUrl();
    const localLlmModelName = ConfigService.getLocalLlmModelName();
    
    if (llmProvider === "gemini" && !geminiApiKey) {
      throw new Error("Gemini API key not configured. Please add it in the extension settings.");
    }
    if (llmProvider === "openai" && !openaiApiKey) {
      throw new Error("OpenAI API key not configured. Please add it in the extension settings.");
    }
    if (llmProvider === "local" && !localLlmBaseUrl) {
      throw new Error("Local LLM Base URL not configured. Please add it in the extension settings.");
    }

    const prompt = createCommitMessagePrompt(changes);
    let response: string;
    
    if (llmProvider === "gemini") {
      const selectedModel = getSelectedModel("gemini");
      response = await callGeminiApi(prompt, geminiApiKey, selectedModel);
    } else if (llmProvider === "openai") {
      const selectedModel = getSelectedModel("openai");
      response = await callOpenAiApi(prompt, openaiApiKey, selectedModel);
    } else {
      response = await callLocalLlmApi(prompt, localLlmBaseUrl, localLlmModelName);
    }

    const lines = response.trim().split('\n');
    let message = '';
    let description = '';

    if (lines.length > 0) {
      message = lines[0].replace(/^(#|\*\*|__) ?/, '').replace(/ ?(:|\*\*|__)$/, '');
      message = message.replace(/^(Commit Message|Message|Title|Subject): ?/i, '');
      
      if (message.length > 100) {
        message = message.substring(0, 97) + '...';
      }
    }

    if (lines.length > 1) {
      let startIndex = 1;
      while (startIndex < lines.length && lines[startIndex].trim() === '') {
        startIndex++;
      }
      
      const descriptionLines = [];
      for (let i = startIndex; i < lines.length; i++) {
        if (lines[i].startsWith('# ') || lines[i].match(/^[-=]{3,}$/)) {
          continue;
        }
        let line = lines[i].replace(/^[-*+] /, '');
        descriptionLines.push(line);
      }
      
      description = descriptionLines.join('\n');
    }

    return { 
      message: message.trim(), 
      description: description.trim() 
    };
  } catch (error) {
    console.error("Error generating commit message:", error);
    throw new Error(
      `Failed to generate commit message: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function generateWorklog(
  changes: string,
  llmProvider: string,
  worklogStyle: string
): Promise<string> {
  try {
    const geminiApiKey = ConfigService.getGeminiApiKey();
    const openaiApiKey = ConfigService.getOpenAIApiKey();
    const localLlmBaseUrl = ConfigService.getLocalLlmBaseUrl();
    const localLlmModelName = ConfigService.getLocalLlmModelName();

    if (llmProvider === "gemini" && !geminiApiKey) {
      throw new Error("Gemini API key not configured. Please add it in the extension settings.");
    }
    if (llmProvider === "openai" && !openaiApiKey) {
      throw new Error("OpenAI API key not configured. Please add it in the extension settings.");
    }
    if (llmProvider === "local" && !localLlmBaseUrl) {
      throw new Error("Local LLM Base URL not configured. Please add it in the extension settings.");
    }

    const prompt = createWorklogPrompt(changes, worklogStyle);
    if (llmProvider === "gemini") {
      const selectedModel = getSelectedModel("gemini");
      return await callGeminiApi(prompt, geminiApiKey, selectedModel);
    } else if (llmProvider === "openai") {
      const selectedModel = getSelectedModel("openai");
      return await callOpenAiApi(prompt, openaiApiKey, selectedModel);
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

function createCommitMessagePrompt(changes: string): string {
  const limitedChanges =
    changes.length > 10000 ? changes.substring(0, 10000) + "...[truncated]" : changes;

  return `
You are a professional software developer creating a commit message for code changes. Analyze the provided code changes and generate a concise commit message and description.

REQUIREMENTS:
- Generate a commit message that is between 1 and 100 characters
- The commit message should be clear, concise, and descriptive
- Use imperative mood (e.g., "Add", "Fix", "Update", not "Added", "Fixed", "Updated")
- Focus on WHAT was changed and WHY, not HOW
- Do not include issue numbers or ticket references
- Capitalize the first word and do not end with a period
- For the description, provide 3-5 bullet points that explain the changes in more detail
- Each bullet point should start with a dash (-)
- The description should provide context that isn't obvious from the commit message

EXAMPLE COMMIT MESSAGES:
- "Add user authentication feature"
- "Fix null pointer exception in payment processing"
- "Update documentation for API endpoints"
- "Refactor database connection handling"
- "Optimize image loading performance"

EXAMPLE DESCRIPTIONS:
- Implemented JWT token-based authentication
- Added login and registration endpoints
- Created user session management
- Updated tests to cover authentication flows

CODE CHANGES TO ANALYZE:
${limitedChanges}

Generate a commit message and description now:
`;
}

function createWorklogPrompt(changes: string, worklogStyle: string): string {
  const limitedChanges =
    changes.length > 10000 ? changes.substring(0, 10000) + "...[truncated]" : changes;

  let styleInstruction = "";
  let exampleFormat = "";

  switch (worklogStyle) {
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
      break;
  }

  return `
You are a professional software developer creating a worklog entry. Analyze the provided code changes and generate both a detailed worklog and a DSU script.

STYLE REQUIREMENTS:
${styleInstruction}

FORMAT EXAMPLE:
${exampleFormat}

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

CODE CHANGES TO ANALYZE:
${limitedChanges}

Generate the worklog and DSU script now:
`;
}

async function callGeminiApi(prompt: string, apiKey: string, model: string): Promise<string> {
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
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
          maxOutputTokens: 2048,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
      }
    );

    const candidates = response.data.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error('Gemini API returned no candidates. The response may have been blocked or filtered.');
    }
    const candidate = candidates[0];

    if (candidate.finishReason && candidate.finishReason !== 'STOP') {
      console.warn(`Gemini API response incomplete. Finish reason: ${candidate.finishReason}`);
      if (candidate.finishReason === 'MAX_TOKENS') {
        console.warn('Response was truncated due to token limit. Consider making the prompt more concise.');
      }
    }

    return candidate.content.parts[0].text;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (axios.isAxiosError(error) && error.response) {
      const status = error.response.status;
      const errorData = error.response.data;

      if (status === 429) {
        throw new Error(
          `Rate limit exceeded for model "${model}". Please wait and try again, or select a different model from the model selector.`
        );
      } else if (status === 404) {
        throw new Error(
          `Model "${model}" not found. Please select a valid Gemini model from the model selector.`
        );
      } else if (status === 400) {
        throw new Error(
          `Invalid request to Gemini API. The model "${model}" may not support the required features. Please select a different model.`
        );
      }

      throw new Error(
        `Gemini API error: ${status} - ${JSON.stringify(errorData)}`
      );
    }
    throw new Error(
      `Failed to call Gemini API: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function callOpenAiApi(prompt: string, apiKey: string, model: string): Promise<string> {
  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: model,
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
        max_tokens: 2048,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    const choices = response.data.choices;
    if (!choices || choices.length === 0) {
      throw new Error('OpenAI API returned no choices. The response may have been filtered or incomplete.');
    }
    const choice = choices[0];

    if (choice.finish_reason && choice.finish_reason !== 'stop') {
      console.warn(`OpenAI API response incomplete. Finish reason: ${choice.finish_reason}`);
      if (choice.finish_reason === 'length') {
        console.warn('Response was truncated due to token limit. Consider making the prompt more concise.');
      }
    }

    return choice.message.content;
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    if (axios.isAxiosError(error) && error.response) {
      const status = error.response.status;
      const errorData = error.response.data;

      // Handle specific error cases
      if (status === 429) {
        throw new Error(
          `Rate limit exceeded or model "${model}" is not available for your API key. Try using "gpt-4o" or "gpt-3.5-turbo" instead. Click on the Model selector to choose a different model.`
        );
      } else if (status === 404) {
        throw new Error(
          `Model "${model}" not found. Please select a valid OpenAI model from the model selector.`
        );
      } else if (status === 401) {
        throw new Error(
          `Invalid OpenAI API key. Please check your API key configuration.`
        );
      }

      throw new Error(
        `OpenAI API error: ${status} - ${JSON.stringify(errorData)}`
      );
    }
    throw new Error(
      `Failed to call OpenAI API: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function callLocalLlmApi(prompt: string, baseUrl: string, modelName: string): Promise<string> {
  try {
    const response = await axios.post(
      `${baseUrl}/chat/completions`,
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
        max_tokens: 2048,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const choices = response.data.choices;
    if (!choices || choices.length === 0) {
      throw new Error('Local LLM API returned no choices. Check your local LLM configuration.');
    }
    const choice = choices[0];

    if (choice.finish_reason && choice.finish_reason !== 'stop') {
      console.warn(`Local LLM API response incomplete. Finish reason: ${choice.finish_reason}`);
      if (choice.finish_reason === 'length') {
        console.warn('Response was truncated due to token limit. Consider making the prompt more concise.');
      }
    }

    return choice.message.content;
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

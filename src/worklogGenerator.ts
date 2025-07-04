import * as vscode from 'vscode';
import axios from 'axios';

/**
 * Generate a worklog based on code changes using the specified LLM provider and style
 */
export async function generateWorklog(
  changes: string,
  llmProvider: string,
  worklogStyle: string
): Promise<string> {
  try {
    // Get API keys from settings
    const geminiApiKey = vscode.workspace.getConfiguration('worklogGenerator').get('geminiApiKey', '');
    const openaiApiKey = vscode.workspace.getConfiguration('worklogGenerator').get('openaiApiKey', '');

    // Validate API key based on selected provider
    if (llmProvider === 'gemini' && !geminiApiKey) {
      throw new Error('Gemini API key not configured. Please add it in the extension settings.');
    }

    if (llmProvider === 'openai' && !openaiApiKey) {
      throw new Error('OpenAI API key not configured. Please add it in the extension settings.');
    }

    // Create prompt based on the selected style
    const prompt = createPrompt(changes, worklogStyle);

    // Call the appropriate LLM API
    if (llmProvider === 'gemini') {
      return await callGeminiApi(prompt, geminiApiKey);
    } else {
      return await callOpenAiApi(prompt, openaiApiKey);
    }
  } catch (error) {
    console.error('Error generating worklog:', error);
    throw new Error(`Failed to generate worklog: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Create a prompt for the LLM based on the selected style
 */
function createPrompt(changes: string, worklogStyle: string): string {
  // Limit the changes to avoid exceeding token limits
  const limitedChanges = changes.length > 10000 ? changes.substring(0, 10000) + '...[truncated]' : changes;
  
  let styleInstruction = '';
  
  switch (worklogStyle) {
    case 'technical':
      styleInstruction = 'Focus on technical details and implementation specifics. Use technical terminology and explain the code changes in detail.';
      break;
    case 'business':
      styleInstruction = 'Focus on business impact and value with minimal technical jargon. Explain what the changes accomplish from a business perspective.';
      break;
    case 'dsu':
      styleInstruction = 'Format the worklog for a daily stand-up meeting with "Completed", "In Progress", and "Blockers" sections. Focus on what was done, what is being worked on, and any issues encountered.';
      break;
    default:
      styleInstruction = 'Format the worklog for a daily stand-up meeting with "Completed", "In Progress", and "Blockers" sections.';
  }
  
  return `
Generate a worklog based on the following code changes. ${styleInstruction}
Format the output as bullet points.

CODE CHANGES:
${limitedChanges}

WORKLOG:
`;
}

/**
 * Call the Gemini API to generate a worklog
 */
async function callGeminiApi(prompt: string, apiKey: string): Promise<string> {
  try {
    const response = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      {
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        }
      }
    );

    // Extract the generated text from the response
    const generatedText = response.data.candidates[0].content.parts[0].text;
    return generatedText;
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`Gemini API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }
    throw new Error(`Failed to call Gemini API: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Call the OpenAI API to generate a worklog
 */
async function callOpenAiApi(prompt: string, apiKey: string): Promise<string> {
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that generates worklogs based on code changes.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 1024
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    // Extract the generated text from the response
    const generatedText = response.data.choices[0].message.content;
    return generatedText;
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`OpenAI API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }
    throw new Error(`Failed to call OpenAI API: ${error instanceof Error ? error.message : String(error)}`);
  }
}

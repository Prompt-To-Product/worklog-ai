import * as vscode from "vscode";
import axios from "axios";

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
}

/**
 * Fetch available models from Gemini API
 */
export async function fetchGeminiModels(apiKey: string): Promise<ModelInfo[]> {
  try {
    const response = await axios.get(
      "https://generativelanguage.googleapis.com/v1beta/models",
      {
        headers: {
          "x-goog-api-key": apiKey,
        },
        params: {
          pageSize: 50,
        },
      }
    );

    return response.data.models
      .filter((model: any) => model.supportedGenerationMethods?.includes("generateContent"))
      .map((model: any) => ({
        id: model.name.replace("models/", ""),
        name: model.displayName || model.name.replace("models/", ""),
        provider: "gemini",
      }));
  } catch (error) {
    console.error("Error fetching Gemini models:", error);
    return [
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        provider: "gemini",
      },
    ];
  }
}

/**
 * Fetch available models from OpenAI API
 */
export async function fetchOpenAIModels(apiKey: string): Promise<ModelInfo[]> {
  try {
    const response = await axios.get("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    return response.data.data
      .filter((model: any) => model.id.includes("gpt"))
      .map((model: any) => ({
        id: model.id,
        name: model.id,
        provider: "openai",
      }))
      .sort((a: ModelInfo, b: ModelInfo) => b.id.localeCompare(a.id));
  } catch (error) {
    console.error("Error fetching OpenAI models:", error);
    return [
      {
        id: "gpt-4o",
        name: "GPT-4o",
        provider: "openai",
      },
    ];
  }
}

/**
 * Get selected model for a provider
 */
export function getSelectedModel(provider: string): string {
  const config = vscode.workspace.getConfiguration("worklogGenerator");
  
  switch (provider) {
    case "gemini":
      return config.get("selectedGeminiModel", "gemini-2.0-flash");
    case "openai":
      return config.get("selectedOpenAIModel", "gpt-4o");
    case "local":
      return config.get("localLlmModelName", "phi");
    default:
      return "";
  }
}

/**
 * Set selected model for a provider
 */
export async function setSelectedModel(provider: string, modelId: string): Promise<void> {
  const config = vscode.workspace.getConfiguration("worklogGenerator");
  
  switch (provider) {
    case "gemini":
      await config.update("selectedGeminiModel", modelId, vscode.ConfigurationTarget.Global);
      break;
    case "openai":
      await config.update("selectedOpenAIModel", modelId, vscode.ConfigurationTarget.Global);
      break;
  }
}

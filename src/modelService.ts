import axios from "axios";
import ConfigService from "./configService";

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
}

const modelCache = new Map<string, ModelInfo[]>();

function getCacheKey(provider: string, apiKey: string): string {
  return `${provider}:${apiKey.substring(0, 8)}`;
}

export function getCachedModels(provider: string, apiKey: string): ModelInfo[] | null {
  return modelCache.get(getCacheKey(provider, apiKey)) || null;
}

function setCachedModels(provider: string, apiKey: string, models: ModelInfo[]): void {
  modelCache.set(getCacheKey(provider, apiKey), models);
}

async function isGeminiFree(apiKey: string, modelId: string): Promise<boolean> {
  try {
    await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`,
      { contents: [{ parts: [{ text: "hi" }] }] },
      { headers: { "x-goog-api-key": apiKey }, timeout: 6000 }
    );
    return true;
  } catch (e: any) {
    const msg = e?.response?.data?.error?.message || "";
    return !msg.toLowerCase().includes("billing");
  }
}

export async function fetchGeminiModels(apiKey: string): Promise<ModelInfo[]> {
  const cached = getCachedModels("gemini", apiKey);
  if (cached) {
    return cached;
  }

  try {
    const response = await axios.get(
      "https://generativelanguage.googleapis.com/v1beta/models",
      {
        headers: { "x-goog-api-key": apiKey },
        params: { pageSize: 50 },
        timeout: 10000,
      }
    );

    const models = response.data.models
      .filter((model: any) => {
        const modelId = model.name.replace("models/", "").toLowerCase();
        
        return model.supportedGenerationMethods?.includes("generateContent") &&
               modelId.startsWith("gemini-") &&
               !modelId.match(/gemini-1\.[0-4]/) &&
               modelId.includes("flash") &&
               !["embedding", "aqa", "bison", "vision", "thinking", "nano", "preview", "tts", "audio", "video"]
                 .some(pattern => modelId.includes(pattern));
      })
      .map((model: any) => ({
        id: model.name.replace("models/", ""),
        name: model.displayName || model.name.replace("models/", ""),
        provider: "gemini"
      }))
      .sort((a: ModelInfo, b: ModelInfo) => b.id.localeCompare(a.id));

    if (models.length === 0) {
      throw new Error("No compatible Gemini models found for this API key");
    }

    const free = await Promise.all(
      models.map(async (m: ModelInfo) => (await isGeminiFree(apiKey, m.id)) ? m : null)
    );

    const freeModels = free.filter(Boolean) as ModelInfo[];

    if (!freeModels.length) {
      throw new Error("No free Gemini models available for this API key");
    }

    setCachedModels("gemini", apiKey, freeModels);
    return freeModels;
  } catch (error) {
    console.error("Error fetching Gemini models:", error);
    throw error;
  }
}

export async function fetchOpenAIModels(apiKey: string): Promise<ModelInfo[]> {
  const cached = getCachedModels("openai", apiKey);
  if (cached) {
    return cached;
  }

  try {
    const response = await axios.get("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 10000,
    });

    const models = response.data.data
      .filter((model: any) => {
        const modelId = model.id.toLowerCase();
        
        return modelId.includes("gpt") &&
               !["embedding", "davinci", "curie", "babbage", "ada", "instruct", ":ft-", 
                 "realtime", "audio", "whisper", "tts", "dall-e", "vision", "0301", "0314", "0613"]
                 .some(pattern => modelId.includes(pattern)) &&
               !modelId.match(/^gpt-3[^.]/) &&
               (modelId.includes("gpt-4") || modelId.includes("gpt-3.5"));
      })
      .map((model: any) => ({
        id: model.id,
        name: model.id,
        provider: "openai"
      }))
      .sort((a: ModelInfo, b: ModelInfo) => b.id.localeCompare(a.id));

    setCachedModels("openai", apiKey, models);
    return models;
  } catch (error) {
    console.error("Error fetching OpenAI models:", error);
    throw error;
  }
}

export function getSelectedModel(provider: string): string {
  return ConfigService.getSelectedModel(provider);
}

export async function setSelectedModel(provider: string, modelId: string): Promise<void> {
  await ConfigService.setSelectedModel(provider, modelId);
}

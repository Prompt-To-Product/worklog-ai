import * as vscode from "vscode";


class ConfigService {
  private static readonly CONFIG_SECTION = "worklogGenerator";


  private static getConfig() {
    return vscode.workspace.getConfiguration(this.CONFIG_SECTION);
  }


  static getGeminiApiKey(): string {
    return this.getConfig().get("geminiApiKey", "");
  }


  static getOpenAIApiKey(): string {
    return this.getConfig().get("openaiApiKey", "");
  }


  static getSelectedGeminiModel(): string {
    return this.getConfig().get("selectedGeminiModel", "");
  }


  static getSelectedOpenAIModel(): string {
    return this.getConfig().get("selectedOpenAIModel", "");
  }


  static getDefaultLlmProvider(): string {
    return this.getConfig().get("defaultLlmProvider", "gemini");
  }


  static getLocalLlmBaseUrl(): string {
    return this.getConfig().get("localLlmBaseUrl", "http://localhost:11434/v1");
  }


  static getLocalLlmModelName(): string {
    return this.getConfig().get("localLlmModelName", "phi");
  }


  static getDefaultWorklogStyle(): string {
    return this.getConfig().get("defaultWorklogStyle", "business");
  }


  static getAutoGenerateOnCommit(): boolean {
    return this.getConfig().get("autoGenerateOnCommit", false);
  }


  static getIncludeWorklogInCommitMessage(): boolean {
    return this.getConfig().get("includeWorklogInCommitMessage", false);
  }


  static async setSelectedGeminiModel(modelId: string): Promise<void> {
    await this.getConfig().update(
      "selectedGeminiModel",
      modelId,
      vscode.ConfigurationTarget.Global
    );
  }


  static async setSelectedOpenAIModel(modelId: string): Promise<void> {
    await this.getConfig().update(
      "selectedOpenAIModel",
      modelId,
      vscode.ConfigurationTarget.Global
    );
  }


  static async setIncludeWorklogInCommitMessage(value: boolean): Promise<void> {
    await this.getConfig().update(
      "includeWorklogInCommitMessage",
      value,
      vscode.ConfigurationTarget.Workspace
    );
  }


  static getSelectedModel(provider: string): string {
    switch (provider) {
      case "gemini":
        return this.getSelectedGeminiModel();
      case "openai":
        return this.getSelectedOpenAIModel();
      case "local":
        return this.getLocalLlmModelName();
      default:
        return "";
    }
  }


  static async setSelectedModel(provider: string, modelId: string): Promise<void> {
    switch (provider) {
      case "gemini":
        await this.setSelectedGeminiModel(modelId);
        break;
      case "openai":
        await this.setSelectedOpenAIModel(modelId);
        break;
      case "local":
        await this.getConfig().update(
          "localLlmModelName",
          modelId,
          vscode.ConfigurationTarget.Global
        );
        break;
    }
  }


  static affectsConfiguration(e: vscode.ConfigurationChangeEvent): boolean {
    return e.affectsConfiguration(this.CONFIG_SECTION);
  }
}

export default ConfigService;

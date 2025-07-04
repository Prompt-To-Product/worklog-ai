# Worklog AI for VS Code

Generate professional worklogs instantly from your code changes using AI.

## Features

- **Generate worklogs instantly** from either your uncommitted changes or any specific commit you select
- **Choose your preferred AI provider** between OpenAI or Google Gemini (requires your own API key)
- **Select your ideal worklog style** from three options:
    - **Technical Style**: Focused on implementation details
    - **Business Style**: Emphasizes business impact with minimal technical jargon
- **Daily Stand-up (DSU) Style**: Structured for stand-up meetings with Completed/In Progress/Blockers format
- **Access worklogs directly in VS Code** through the dedicated Worklog AI panel
- **Copy or export worklogs** for sharing with stakeholders
- **Configure automatic worklog generation** when committing changes

## Installation

1. Install the extension from the VS Code Marketplace
2. Configure your API keys in the extension settings

## Usage

### Quick Start

1. Click on the Worklog AI icon in the Activity Bar
2. Configure your preferred AI provider and worklog style
3. Click "Generate from Current Changes" to create a worklog
4. View, copy, or export the generated worklog

### Configuration Options

- **AI Provider**: Choose between Google Gemini (default) or OpenAI
- **Worklog Style**: Select Technical, Business, or Daily Stand-up format
- **Auto-generate on Commit**: Enable to automatically generate worklogs when committing changes

### Keyboard Shortcuts

- Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and type "Generate Worklog"

## Requirements

- VS Code 1.60.0 or higher
- Git repository for commit-based worklogs
- API key for either Google Gemini or OpenAI

## Extension Settings

This extension contributes the following settings:

* `worklogGenerator.geminiApiKey`: API Key for Google Gemini
* `worklogGenerator.openaiApiKey`: API Key for OpenAI
* `worklogGenerator.defaultLlmProvider`: Default AI provider to use (gemini or openai)
* `worklogGenerator.defaultWorklogStyle`: Default style for worklog generation (technical, business, or dsu)
* `worklogGenerator.autoGenerateOnCommit`: Automatically generate worklog when committing changes
* `worklogGenerator.includeWorklogInCommitMessage`: Include generated worklog in commit message

## Privacy & Security

Your code changes and API keys never leave your machine. All processing is done through direct API calls to your chosen AI provider using your own API key.

## License

MIT

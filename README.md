# Worklog AI for VS Code

Generate professional worklogs instantly from your code changes using AI.

## Developers

- **Rahul Sharma** - Software Developer: [https://github.com/rahul-0210/](https://github.com/rahul-0210/)
- **Devendra Parihar** - AI Developer: [https://github.com/Devparihar5](https://github.com/Devparihar5)

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
   - Search for "Worklog AI" in the Extensions view (Ctrl+Shift+X / Cmd+Shift+X)
   - Click "Install"
   
2. Configure your API keys in the extension settings
   - Open VS Code Settings (Ctrl+, / Cmd+,)
   - Search for "Worklog AI"
   - Add your Gemini or OpenAI API key

## Step-by-Step Usage Guide

### Setting Up API Keys

1. Get your API key:
   - For Google Gemini: Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - For OpenAI: Visit [OpenAI Platform](https://platform.openai.com/api-keys)

2. Add your API key to VS Code settings:
   - Open Settings (Ctrl+, / Cmd+,)
   - Search for "worklogGenerator"
   - Enter your key in the appropriate field

### Generating Your First Worklog

1. Open the Worklog AI panel:
   - Click the Worklog AI icon in the Activity Bar (side panel)
   - Or use Command Palette (Ctrl+Shift+P / Cmd+Shift+P) and type "Open Worklog AI Panel"

2. Select your preferences:
   - Choose AI Provider (Gemini or OpenAI)
   - Select Worklog Style (Technical, Business, or DSU)

3. Generate a worklog:
   - For uncommitted changes: Click "Generate from Current Changes"
   - For a specific commit: Click "Generate from Commit" and select the commit

4. View and use your worklog:
   - The generated worklog appears in the panel
   - Use the "Copy" button to copy it to clipboard
   - Use "Export" to save it as a file

### Customizing Your Experience

- **Change default settings**: Modify your preferences in VS Code settings
- **Auto-generate on commit**: Enable this option to automatically create worklogs when committing code
- **Include in commit messages**: Automatically add the worklog to your commit messages

## Keyboard Shortcuts

- Open Worklog AI Panel: `Alt+W` / `Option+W`
- Generate Worklog (from Command Palette): `Ctrl+Shift+P` / `Cmd+Shift+P` → "Generate Worklog"

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

## Troubleshooting

- **No worklog generated**: Ensure your API key is correct and you have sufficient credits
- **Error messages**: Check the Output panel (View → Output → Worklog AI) for detailed error information
- **Slow generation**: Large code changes may take longer to process

## Privacy & Security

Your code changes and API keys never leave your machine. All processing is done through direct API calls to your chosen AI provider using your own API key.

## License

MIT

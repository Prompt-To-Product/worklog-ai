# Worklog AI for VS Code

[![](https://vsmarketplacebadges.dev/version-short/DevendraParihar.worklog-ai.png)](https://marketplace.visualstudio.com/items?itemName=DevendraParihar.worklog-ai)
[![](https://vsmarketplacebadges.dev/downloads-short/DevendraParihar.worklog-ai.png)](https://marketplace.visualstudio.com/items?itemName=DevendraParihar.worklog-ai)
[![](https://vsmarketplacebadges.dev/rating-short/DevendraParihar.worklog-ai.png)](https://marketplace.visualstudio.com/items?itemName=DevendraParihar.worklog-ai)

Generate professional worklogs instantly from your code changes using AI.

## What's new in Worklog AI

- **Enhanced UI**: Improved button labels and organization for better usability
- **Multiple AI Models**: Choose between Google Gemini, OpenAI, or your own locally hosted LLM for worklog generation
- **Multiple Output Types**: Generate technical worklogs, business-focused worklogs, or commit messages
- **Git Integration**: Create worklogs from uncommitted changes, today's changes, or specific commits
- **One-Click Export**: Easily copy or save your worklogs

## Demo

Watch our demo video to see Worklog AI in action:

![](media/worklog-ai-demo.gif)

## About Worklog AI

Worklog AI is a powerful VS Code extension that automatically generates detailed worklogs from your code changes. Whether you need to document your work for team stand-ups, client reports, or personal tracking, Worklog AI saves you time by analyzing your code changes and creating professional summaries.

The extension leverages advanced AI models (Google Gemini or OpenAI) to understand your code modifications and generate meaningful descriptions that can be customized to your specific needs.

## Features

- **AI-Powered Analysis**: Intelligent parsing of code changes to identify meaningful modifications
- **Multiple AI Providers**:
  - **Google Gemini**: Fast and efficient AI model for most use cases
  - **OpenAI**: Advanced reasoning capabilities for complex code analysis
  - **Local LLM**: Use your own locally hosted LLM for privacy and customization ([setup guide](LOCAL_LLM_SETUP.md))
- **Multiple Worklog Styles**:
  - **Technical Style**: Detailed implementation specifics for developer handoffs
  - **Business Style**: Business impact with minimal technical jargon for stakeholder reports
  - **Commit Message**: Concise commit message (max 100 characters) with detailed description
- **Flexible Source Options**: Generate from current uncommitted changes, today's changes, or select specific commits
- **Customizable Settings**: Configure default AI provider, worklog style, and automation options
- **Direct Integration**: Access directly from the VS Code sidebar or Source Control view

## Available Commands

| Command                                        | Description                                             |
| ---------------------------------------------- | ------------------------------------------------------- |
| ✨ **Generate New Worklog**                    | Open the worklog generation wizard                      |
| ✨ **Create Worklog from Uncommitted Changes** | Generate a worklog based on current uncommitted  today's changes |
| 📝 **Create Worklog from Commit History**      | Select a specific commit to generate a worklog          |
| 📤 **Save Worklog to File**                    | Export the generated worklog to a file                  |
| 📋 **Copy Worklog to Clipboard**               | Copy the generated worklog to clipboard                 |
| 🔄 **Refresh Worklog Panel**                   | Refresh the worklog panel                               |
| ⚙️ **Configure Worklog Settings**              | Open the extension settings                             |

## Getting Started

1. **Install the extension** from the VS Code Marketplace
2. **Configure your API key** (if using cloud providers):
   - For Google Gemini: Get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
   - For OpenAI: Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)
   - For Local LLM: Configure your base URL and model name ([see setup guide](LOCAL_LLM_SETUP.md))
3. **Open the Worklog AI panel** from the sidebar
4. **Generate your first worklog** by clicking "Create Worklog from Uncommitted Changes"

## Developers

- **Rahul Sharma** - Software Developer: [https://github.com/rahul-0210/](https://github.com/rahul-0210/)
- **Devendra Parihar** - AI Developer: [https://github.com/Devparihar5](https://github.com/Devparihar5)

## Contributing

For developers interested in contributing or testing this extension locally, please see our [Development Guide](DEVELOPMENT.md).

## License

[MIT](LICENSE)

# Development Guide for Worklog AI Extension

This guide will help you set up and test the Worklog AI extension in development mode on your local machine.

## Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v14 or later)
- [npm](https://www.npmjs.com/) (usually comes with Node.js)
- [Git](https://git-scm.com/)
- [Visual Studio Code](https://code.visualstudio.com/)
- [VS Code Extension Manager (vsce)](https://github.com/microsoft/vscode-vsce) - Install with `npm install -g @vscode/vsce`

## Setting Up the Development Environment

1. **Clone the repository**

   ```bash
   git clone https://github.com/Devparihar5/worklog-ai.git
   cd worklog-ai
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Compile the extension**

   ```bash
   npm run compile
   # Or for continuous compilation during development:
   npm run watch
   ```

## Running the Extension in Development Mode

1. **Open the project in VS Code**

   ```bash
   code .
   ```

2. **Press F5 to start debugging**

   This will:
   - Launch a new VS Code Extension Development Host window
   - Load your extension in development mode
   - Enable you to test the extension functionality

3. **Alternative: Launch from Command Palette**
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS)
   - Type "Debug: Start Debugging" and select it

## Testing the Extension

1. **Manual Testing**

   In the Extension Development Host window:
   - Open a Git repository
   - Make some changes to files
   - Use the Worklog AI sidebar icon to open the extension panel
   - Test generating worklogs from uncommitted changes
   - Test generating worklogs from specific commits
   - Test different AI providers and worklog styles

2. **Setting Up API Keys for Testing**

   You'll need API keys for testing:
   - For Google Gemini: Get a key from [Google AI Studio](https://makersuite.google.com/app/apikey)
   - For OpenAI: Get a key from [OpenAI Platform](https://platform.openai.com/api-keys)
   
   Add these keys to VS Code settings in the Extension Development Host:
   - Open Settings (`Ctrl+,` or `Cmd+,`)
   - Search for "worklogGenerator"
   - Add your API keys to the appropriate fields

3. **Running Automated Tests**

   ```bash
   npm test
   ```

## Debugging

1. **Using Breakpoints**
   - Set breakpoints in your TypeScript files
   - When running in debug mode (F5), execution will pause at these points
   - Examine variables and call stack in the Debug panel

2. **Console Logging**
   - Use `console.log()` statements in your code
   - View output in the Debug Console panel in VS Code

3. **Extension Logs**
   - In the Extension Development Host, open the Output panel (`Ctrl+Shift+U` or `Cmd+Shift+U`)
   - Select "Worklog AI" from the dropdown to see extension-specific logs

## Packaging the Extension Locally

To create a VSIX package for local installation:

```bash
vsce package
```

This will generate a `.vsix` file that you can install in VS Code by:
1. Opening VS Code
2. Going to Extensions view (`Ctrl+Shift+X` or `Cmd+Shift+X`)
3. Clicking the "..." menu and selecting "Install from VSIX..."
4. Selecting the generated `.vsix` file

## Common Issues and Solutions

1. **TypeScript Compilation Errors**
   - Check the Problems panel for details
   - Ensure all dependencies are properly installed
   - Verify TypeScript version compatibility

2. **API Key Issues**
   - Verify API keys are correctly entered in settings
   - Check for rate limiting or quota issues with the AI providers
   - Ensure proper error handling in the code

3. **Git Integration Problems**
   - Verify the workspace is a valid Git repository
   - Check Git is installed and accessible from the command line
   - Look for Git-related errors in the console output

## Contributing

1. Create a new branch for your feature or bugfix
2. Make your changes
3. Test thoroughly using the methods described above
4. Submit a pull request with a clear description of your changes

## Additional Resources

- [VS Code Extension API Documentation](https://code.visualstudio.com/api)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Google Gemini API Documentation](https://ai.google.dev/docs)
- [OpenAI API Documentation](https://platform.openai.com/docs/api-reference)

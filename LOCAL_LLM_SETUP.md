# Setting Up a Local LLM with Ollama for Worklog AI

This guide will help you set up a local Large Language Model (LLM) using [Ollama](https://ollama.ai/) to use with Worklog AI. Running a local LLM gives you complete privacy and control over your data, as your code changes never leave your machine.

## What is Ollama?

Ollama is an open-source tool that lets you run various large language models locally on your machine. It provides a simple way to download, run, and manage these models with a compatible API that Worklog AI can connect to.

## System Requirements

Running LLMs locally requires significant resources. Minimum recommendations:

- **CPU**: Modern multi-core processor (8+ cores recommended)
- **RAM**: 8GB minimum, 16GB+ recommended
- **Storage**: 10GB+ free space (varies by model)
- **GPU**: Optional but highly recommended for better performance
  - NVIDIA GPU with 4GB+ VRAM
  - Apple Silicon (M1/M2/M3) for Mac users

## Installation Steps

### 1. Install Ollama

#### For macOS:
- Download the installer from [ollama.ai](https://ollama.ai/)
- Open the downloaded file and follow the installation instructions
- Once installed, Ollama will run in the background

#### For Linux:
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

#### For Windows:
- Download the installer from [ollama.ai](https://ollama.ai/download/windows)
- Run the installer and follow the instructions
- Once installed, Ollama will run in the background

### 2. Pull a Model

After installing Ollama, you need to download a model. Open your terminal or command prompt and run:

```bash
# For a smaller, faster model (recommended for machines with limited resources)
ollama pull phi

# For a more capable model (requires more resources)
ollama pull llama3

# For a balanced option
ollama pull mistral
```

### 3. Run the Ollama Server

Ollama should start automatically after installation. If it's not running, you can start it with:

```bash
ollama serve
```

This will start the Ollama server on `http://localhost:11434`.

### 4. Configure Worklog AI

Now that your local LLM is running, configure Worklog AI to use it:

1. Open VS Code with the Worklog AI extension installed
2. Click on the Worklog AI icon in the sidebar
3. In the settings section, select "🏠 Local LLM" as your AI provider
4. Enter the following information when prompted:
   - **Base URL**: `http://localhost:11434/v1`
   - **Model Name**: The name of the model you pulled (e.g., `phi`, `llama3`, or `mistral`)

## Available Models

Here are some recommended models to try with Worklog AI:

| Model | Size | Requirements | Best For |
|-------|------|--------------|----------|
| phi | ~1.6GB | Minimal (4GB RAM) | Quick worklog generation, basic code understanding |
| mistral | ~4.1GB | Moderate (8GB RAM) | Good balance of speed and quality |
| llama3 | ~4.7GB | Higher (8GB+ RAM) | More detailed analysis, better code understanding |
| codellama | ~7GB | High (16GB+ RAM) | Specialized for code analysis |

## Troubleshooting

### Model is running slowly
- Try a smaller model like `phi`
- Close other resource-intensive applications
- If you have a compatible GPU, ensure Ollama is using it

### Connection errors
- Make sure the Ollama server is running (`ollama serve`)
- Check that the base URL is correct (`http://localhost:11434/v1`)
- Verify there are no firewalls blocking the connection

### Out of memory errors
- Try a smaller model
- Increase your system's swap space
- Close other applications to free up memory

## Advanced Configuration

### Custom Model Parameters

You can create a custom model configuration with specific parameters:

```bash
ollama create worklog-custom -f Modelfile
```

Where `Modelfile` contains:

```
FROM llama3
PARAMETER temperature 0.2
PARAMETER top_p 0.9
PARAMETER top_k 40
```

Then use `worklog-custom` as your model name in Worklog AI.

### Running on a Different Port

If you need to run Ollama on a different port:

```bash
OLLAMA_HOST=127.0.0.1:8000 ollama serve
```

Then use `http://127.0.0.1:8000/v1` as your base URL in Worklog AI.

## Resources

- [Ollama Documentation](https://github.com/ollama/ollama/blob/main/README.md)
- [Ollama Model Library](https://ollama.ai/library)
- [Ollama GitHub Repository](https://github.com/ollama/ollama)

## Privacy Benefits

Using a local LLM with Worklog AI ensures:

- Your code never leaves your machine
- No data is sent to external API providers
- Complete control over your data and privacy
- No API usage costs or rate limits

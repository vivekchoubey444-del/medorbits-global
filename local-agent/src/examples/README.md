
# Local Agent Examples

Examples for exercising the MedOrbits Local Agent in a controlled environment.

## Requirements

- Node.js 20 or newer
- Repository dependencies installed, if required by the project
- Ollama installed and running for Ollama examples
- A locally available model for chat examples

## Configure

Set the repository root before running examples.

Linux/macOS:

```bash
export MEDORBITS_REPO_ROOT=“/path/to/medorbits-global”
export OLLAMA_HOST=“http://127.0.0.1:11434”
export OLLAMA_MODEL=“llama3.2”
```

PowerShell:

```powershell
$env:MEDORBITS_REPO_ROOT = “C:\path\to\medorbits-global”
$env:OLLAMA_HOST = “http://127.0.0.1:11434”
$env:OLLAMA_MODEL = “llama3.2”
```

## Run

From the repository root:

```bash
node local-agent/src/examples/basic-agent.js
node local-agent/src/examples/ollama-chat.js
node local-agent/src/examples/provider-registry.js
node local-agent/src/examples/read-only-inspection.js
```

## Safety

- Examples do not execute arbitrary model-generated shell commands.
- Read-only inspection should be used before any repository mutation.
- Do not put API keys, passwords, or private tokens in example files.
- Review generated output before using it in production.
- Keep Ollama bound to loopback unless remote access is explicitly secured.
- Confirm that provider adapters and service interfaces match the current repository implementation.

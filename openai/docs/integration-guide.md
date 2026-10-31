# MedOrbits OpenAI Integration Guide

## Architecture

The browser calls MedOrbits backend endpoints. The backend authenticates the user, validates the request, applies rate limits, calls the OpenAI API, validates the response, and returns a controlled result.

Never call OpenAI directly from browser code with a secret API key.

## Setup

1. Install dependencies from `/openai/package.json` or the repository root.
2. Configure `OPENAI_API_KEY`, `OPENAI_MODEL`, and `OPENAI_ENABLED=true` in the backend environment.
3. Import the client and service modules from the API application.
4. Protect routes with MedOrbits user authentication, AI rate limiting, and request validation.
5. Test using mocked responses before enabling production traffic.

## Example service use

```js
const { askAssistant } = require("./services/ai-assistant.service");

const result = await askAssistant({
  message: "Explain the difference between MBBS and BDS."
});

console.log(result.text);
```

The example assumes execution from the `/openai/` directory and valid server-side configuration.

## Data handling

Avoid sending unnecessary personal data, identity documents, credentials, or sensitive records to an AI provider. Obtain appropriate user authorization and apply the organization's privacy and retention policies before processing uploaded documents.

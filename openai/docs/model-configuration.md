# MedOrbits Model Configuration

Configure the model using the server-side `OPENAI_MODEL` environment variable.

Example:

```env
OPENAI_ENABLED=true
OPENAI_API_KEY=replace-with-server-side-secret
OPENAI_MODEL=your-approved-model
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_TIMEOUT_MS=60000
OPENAI_MAX_RETRIES=2
OPENAI_MAX_OUTPUT_TOKENS=1200
```

Choose a model available to the project's API account and verify its supported endpoints and parameters in the current OpenAI documentation.

Do not hardcode model names throughout service modules. Keep model selection centralized in configuration.

Review model changes for quality, latency, cost, safety, and compatibility before production rollout.

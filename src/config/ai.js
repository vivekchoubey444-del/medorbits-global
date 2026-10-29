export function getAIConfig(env = process.env) { return { enabled: Boolean(env.AI_API_URL && env.AI_API_KEY), apiUrl: env.AI_API_URL || "", model: env.AI_MODEL || "", apiKey: env.AI_API_KEY || "" }; }
export default getAIConfig;

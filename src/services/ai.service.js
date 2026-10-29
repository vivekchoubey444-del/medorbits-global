/** AI integration is disabled until a trusted provider is configured. */
export async function generateText() { throw new Error("AI service is not configured. Set up an approved provider before enabling this feature."); }
export async function healthCheck() { return { configured: Boolean(process.env.AI_API_URL && process.env.AI_API_KEY), available: false }; }
export default { generateText, healthCheck };

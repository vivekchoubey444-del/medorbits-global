/** Session settings; production must supply a high-entropy secret. */
export function getSessionConfig(env = process.env) { const secret = env.SESSION_SECRET || ""; if (env.NODE_ENV === "production" && secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters in production"); return { secret, secure: env.NODE_ENV === "production", httpOnly: true, sameSite: "lax" }; }
export default getSessionConfig;

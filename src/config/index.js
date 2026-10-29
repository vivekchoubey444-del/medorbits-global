/** Central environment configuration with explicit validation. */
export function getConfig(env = process.env) {
  return { nodeEnv: env.NODE_ENV || "development", port: Number(env.PORT || 3000), databaseUrl: env.DATABASE_URL || "", maintenanceMode: String(env.MAINTENANCE_MODE).toLowerCase() === "true" };
}
export default getConfig;

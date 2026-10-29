/**
 * MedOrbits source entry point. The production HTTP server remains at the
 * repository root (`server.js`); import this module for source metadata only.
 */
export const serviceName = "MedOrbits";
export const sourceVersion = "3.0.0";
export const runtimeRequirement = ">=20";
export function getRuntimeStatus() { return { service: serviceName, node: process.version, environment: process.env.NODE_ENV || "development" }; }
export default { serviceName, sourceVersion, runtimeRequirement, getRuntimeStatus };

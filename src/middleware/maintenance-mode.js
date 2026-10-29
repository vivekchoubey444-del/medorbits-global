/** Fail-closed maintenance gate. Set MAINTENANCE_MODE=true to enable. */
export default function maintenanceMode(req, res, next) {
  if (String(process.env.MAINTENANCE_MODE).toLowerCase() !== "true") return next();
  const allowHealth = req.path === "/health" || req.path === "/api/health";
  if (allowHealth) return next();
  res.set("Retry-After", "300");
  return res.status(503).json({ success: false, error: "Service temporarily unavailable for maintenance." });
}
export { maintenanceMode };

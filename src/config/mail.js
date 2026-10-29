export function getMailConfig(env = process.env) { return { host: env.SMTP_HOST || "", port: Number(env.SMTP_PORT || 587), user: env.SMTP_USER || "", password: env.SMTP_PASSWORD || "", from: env.MAIL_FROM || "" }; }
export default getMailConfig;

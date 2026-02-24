const LOG_LEVEL = process.env.LOG_LEVEL || "info";
const LEVELS: Record<string, number> = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LEVELS[LOG_LEVEL] ?? 2;

function log(level: string, message: string, data?: unknown) {
  if ((LEVELS[level] ?? 0) <= currentLevel) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    if (data !== undefined) {
      console.error(`${prefix} ${message}`, JSON.stringify(data, null, 2));
    } else {
      console.error(`${prefix} ${message}`);
    }
  }
}

export const logger = {
  error: (msg: string, data?: unknown) => log("error", msg, data),
  warn: (msg: string, data?: unknown) => log("warn", msg, data),
  info: (msg: string, data?: unknown) => log("info", msg, data),
  debug: (msg: string, data?: unknown) => log("debug", msg, data),
};

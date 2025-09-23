export type LogLevel = "debug" | "info" | "warn" | "error";

type LogPayload = Record<string, unknown> | undefined;

type LoggerOptions = {
  level?: LogLevel;
  payload?: LogPayload;
};

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const CURRENT_LEVEL: LogLevel =
  (process.env.LOG_LEVEL as LogLevel | undefined) ?? "info";

const pluckConsole = (level: LogLevel) => {
  switch (level) {
    case "debug":
    case "info":
      return console.log;
    case "warn":
      return console.warn;
    case "error":
    default:
      return console.error;
  }
};

export const logEvent = (
  event: string,
  options: LoggerOptions = {}
) => {
  const level = options.level ?? "info";

  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[CURRENT_LEVEL]) {
    return;
  }

  const payload = {
    event,
    level,
    timestamp: new Date().toISOString(),
    ...options.payload,
  };

  try {
    pluckConsole(level)(JSON.stringify(payload));
  } catch (error) {
    console.error("logger_failed", { error });
  }
};

import { is_tauri } from "$lib/shared/utils/detect_platform";
import { error_message } from "./error_message";

type LogLevel = "error" | "warn" | "info" | "debug";

type LogContext = Record<string, unknown>;

type LogFn = (msg: string) => void;

interface RawLogger {
  error: LogFn;
  warn: LogFn;
  info: LogFn;
  debug: LogFn;
}

export interface Logger {
  error: (msg: string, ctx?: LogContext) => void;
  warn: (msg: string, ctx?: LogContext) => void;
  info: (msg: string, ctx?: LogContext) => void;
  debug: (msg: string, ctx?: LogContext) => void;
  from_error: (msg: string, err: unknown) => void;
}

function format_context(ctx: LogContext): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(ctx)) {
    if (key === "error") {
      parts.push(error_message(value));
    } else {
      parts.push(`${key}=${String(value)}`);
    }
  }
  return parts.join(" ");
}

function format_message(module: string, msg: string, ctx?: LogContext): string {
  const prefix = module ? `[${module}] ` : "";
  const suffix = ctx ? ` ${format_context(ctx)}` : "";
  return `${prefix}${msg}${suffix}`;
}

function create_console_raw_logger(): RawLogger {
  return {
    error: (msg) => {
      console.error(msg);
    },
    warn: (msg) => {
      console.warn(msg);
    },
    info: (msg) => {
      console.info(msg);
    },
    debug: (msg) => {
      console.debug(msg);
    },
  };
}

function wrap_async_log(fn: (msg: string) => Promise<void>): LogFn {
  return (msg: string) => {
    void fn(msg);
  };
}

async function create_tauri_raw_logger(): Promise<RawLogger> {
  const mod = await import("@tauri-apps/plugin-log");
  await mod.attachConsole();
  return {
    error: wrap_async_log(mod.error),
    warn: wrap_async_log(mod.warn),
    info: wrap_async_log(mod.info),
    debug: wrap_async_log(mod.debug),
  };
}

let _raw_logger: RawLogger | null = null;

async function get_raw_logger(): Promise<RawLogger> {
  if (_raw_logger) return _raw_logger;
  _raw_logger = is_tauri
    ? await create_tauri_raw_logger()
    : create_console_raw_logger();
  return _raw_logger;
}

function log_at(level: LogLevel, msg: string) {
  void get_raw_logger().then((l) => {
    l[level](msg);
  });
}

function create_scoped_log_fn(
  module: string,
  level: LogLevel,
): (msg: string, ctx?: LogContext) => void {
  return (msg: string, ctx?: LogContext) => {
    log_at(level, format_message(module, msg, ctx));
  };
}

export function create_logger(module: string): Logger {
  const scoped_error = create_scoped_log_fn(module, "error");
  return {
    error: scoped_error,
    warn: create_scoped_log_fn(module, "warn"),
    info: create_scoped_log_fn(module, "info"),
    debug: create_scoped_log_fn(module, "debug"),
    from_error(msg: string, err: unknown) {
      scoped_error(msg, { error: err });
    },
  };
}

export const logger: Logger = {
  error(msg: string, ctx?: LogContext) {
    log_at("error", format_message("", msg, ctx));
  },
  warn(msg: string, ctx?: LogContext) {
    log_at("warn", format_message("", msg, ctx));
  },
  info(msg: string, ctx?: LogContext) {
    log_at("info", format_message("", msg, ctx));
  },
  debug(msg: string, ctx?: LogContext) {
    log_at("debug", format_message("", msg, ctx));
  },
  from_error(msg: string, err: unknown) {
    log_at("error", format_message("", msg, { error: err }));
  },
};

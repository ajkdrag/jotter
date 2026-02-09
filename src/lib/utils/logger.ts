import { is_tauri } from "$lib/utils/detect_platform";
import { error_message } from "./error_message";

type LogFn = (msg: string) => void;

interface Logger {
  error: LogFn;
  warn: LogFn;
  info: LogFn;
}

function create_console_logger(): Logger {
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
  };
}

function wrap_async_log(fn: (msg: string) => Promise<void>): LogFn {
  return (msg: string) => {
    void fn(msg);
  };
}

async function create_tauri_logger(): Promise<Logger> {
  const mod = await import("@tauri-apps/plugin-log");
  await mod.attachConsole();
  return {
    error: wrap_async_log(mod.error),
    warn: wrap_async_log(mod.warn),
    info: wrap_async_log(mod.info),
  };
}

let _logger: Logger | null = null;

async function get_logger(): Promise<Logger> {
  if (_logger) return _logger;
  _logger = is_tauri ? await create_tauri_logger() : create_console_logger();
  return _logger;
}

function log_at(level: keyof Logger, msg: string) {
  void get_logger().then((l) => {
    l[level](msg);
  });
}

export const logger = {
  error(msg: string) {
    log_at("error", msg);
  },
  warn(msg: string) {
    log_at("warn", msg);
  },
  info(msg: string) {
    log_at("info", msg);
  },

  from_error(prefix: string, err: unknown) {
    log_at("error", `${prefix}: ${error_message(err)}`);
  },
};

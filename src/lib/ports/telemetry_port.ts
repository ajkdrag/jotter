export interface TelemetryPort {
  timing(name: string, ms: number, tags?: Record<string, string>): void
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): void
}


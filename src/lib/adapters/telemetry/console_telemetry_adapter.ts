import type { TelemetryPort } from '$lib/ports/telemetry_port'

export function create_console_telemetry_adapter(): TelemetryPort {
  return {
    timing(name, ms, tags) {
      console.info('[timing]', name, ms, tags ?? {})
    },
    log(level, message, meta) {
      const payload = meta ?? {}
      if (level === 'error') console.error(message, payload)
      else if (level === 'warn') console.warn(message, payload)
      else if (level === 'info') console.info(message, payload)
      else console.debug(message, payload)
    }
  }
}


type LogLevel = 'info' | 'warn' | 'error'

type LogContext = Record<string, unknown>

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  return error
}

function emit(scope: string, level: LogLevel, message: string, context?: LogContext) {
  const payload = {
    scope,
    level,
    message,
    ...context,
  }

  const consoleMethod = level === 'info'
    ? console.info
    : level === 'warn'
      ? console.warn
      : console.error

  consoleMethod(`[${scope}] ${message}`, payload)
}

export function createLogger(scope: string) {
  return {
    info(message: string, context?: LogContext) {
      emit(scope, 'info', message, context)
    },
    warn(message: string, context?: LogContext) {
      emit(scope, 'warn', message, context)
    },
    error(message: string, error?: unknown, context?: LogContext) {
      emit(scope, 'error', message, {
        ...context,
        error: serializeError(error),
      })
    },
  }
}

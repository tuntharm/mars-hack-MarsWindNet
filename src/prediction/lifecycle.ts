export function createPredictLifecycle() {
  let controller: AbortController | null = null

  function abortInFlight(): void {
    controller?.abort()
    controller = null
  }

  function start(): AbortSignal {
    abortInFlight()
    controller = new AbortController()
    return controller.signal
  }

  return { abortInFlight, start }
}

export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const name = 'name' in error ? String(error.name) : ''
  return name === 'AbortError'
}

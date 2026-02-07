export function create_write_queue() {
  const queues = new Map<string, Promise<void>>()

  return async (key: string, task: () => Promise<void>) => {
    const previous = queues.get(key) ?? Promise.resolve()
    const next = previous.then(task, task)
    queues.set(key, next)
    await next
  }
}

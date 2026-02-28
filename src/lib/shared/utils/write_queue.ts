export function create_write_queue() {
  const queues = new Map<string, Promise<void>>();

  return async (key: string, task: () => Promise<void>) => {
    const previous = queues.get(key) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(task);
    queues.set(key, next);
    const cleanup = () => {
      if (queues.get(key) === next) queues.delete(key);
    };
    next.then(cleanup, cleanup);
    await next;
  };
}

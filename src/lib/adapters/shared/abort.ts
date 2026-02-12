export function create_abort_error(): Error {
  const error = new Error("Index run aborted");
  error.name = "AbortError";
  return error;
}

export function throw_if_aborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw create_abort_error();
  }
}

export function is_abort_error(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.message === "Index run aborted")
  );
}

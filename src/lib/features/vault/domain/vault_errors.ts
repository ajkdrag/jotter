export function is_unavailable_vault_error(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("vault unavailable") ||
    normalized.includes("could not be found") ||
    normalized.includes("no such file or directory")
  );
}

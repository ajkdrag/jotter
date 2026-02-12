export function clamp_vault_selection(index: number, total: number): number {
  if (total <= 0) {
    return -1;
  }
  if (index < 0) {
    return 0;
  }
  if (index >= total) {
    return total - 1;
  }
  return index;
}

export function move_vault_selection(
  current: number,
  total: number,
  direction: 1 | -1,
): number {
  if (total <= 0) {
    return -1;
  }

  if (current < 0) {
    return direction === 1 ? 0 : total - 1;
  }

  return (current + direction + total) % total;
}

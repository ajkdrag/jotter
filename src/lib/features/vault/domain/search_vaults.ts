import type { Vault } from "$lib/shared/types/vault";

function substring_score(haystack: string, needle: string): number {
  const index = haystack.indexOf(needle);
  if (index < 0) {
    return -1;
  }
  return 120 + needle.length * 3 - index;
}

function subsequence_score(haystack: string, needle: string): number {
  let hay_index = 0;
  let needle_index = 0;
  let first_match = -1;
  let last_match = -1;

  while (hay_index < haystack.length && needle_index < needle.length) {
    if (haystack[hay_index] === needle[needle_index]) {
      if (first_match < 0) {
        first_match = hay_index;
      }
      last_match = hay_index;
      needle_index += 1;
    }
    hay_index += 1;
  }

  if (needle_index !== needle.length || first_match < 0 || last_match < 0) {
    return -1;
  }

  const span = last_match - first_match + 1;
  const compactness = Math.max(0, needle.length * 2 - (span - needle.length));
  return 60 + compactness - first_match;
}

function best_match_score(haystack: string, needle: string): number {
  return Math.max(
    substring_score(haystack, needle),
    subsequence_score(haystack, needle),
  );
}

export function search_vaults(vaults: Vault[], query: string): Vault[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return vaults;
  }

  const terms = normalized.split(/\s+/).filter(Boolean);
  const scored = vaults
    .map((vault, index) => {
      const name = vault.name.toLowerCase();
      const path = vault.path.toLowerCase();
      let score = 0;

      for (const term of terms) {
        const name_score = best_match_score(name, term);
        const path_score = best_match_score(path, term);
        const term_score = Math.max(name_score, path_score);
        if (term_score < 0) {
          return null;
        }
        score += term_score;
        if (name_score >= path_score) {
          score += 20;
        }
      }

      return { vault, index, score };
    })
    .filter(
      (entry): entry is { vault: Vault; index: number; score: number } =>
        entry !== null,
    )
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.index - right.index;
    });

  return scored.map((entry) => entry.vault);
}

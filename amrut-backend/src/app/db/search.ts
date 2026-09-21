// An unbounded term is what makes an expensive pattern possible in the first place.
export const MAX_SEARCH_LENGTH = 80;

const REGEX_METACHARACTERS = /[.*+?^${}()|[\]\\]/g;

// Renders a value so a regex engine treats every character literally.
export function escapeRegex(value: string): string {
  return value.replace(REGEX_METACHARACTERS, "\\$&");
}

// Prisma's Mongo `contains` is a $regex, so every list endpoint must escape its term here.
export function searchTerm(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim().slice(0, MAX_SEARCH_LENGTH);

  return trimmed.length > 0 ? escapeRegex(trimmed) : undefined;
}

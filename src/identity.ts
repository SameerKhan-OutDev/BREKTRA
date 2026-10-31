/** Derive marks from saved identity; never invent a person in local mode. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/u).filter(Boolean);
  return (words.length > 1 ? [...words[0]][0] + [...words.at(-1)!][0] : [...(words[0] || "")].slice(0, 2).join("")).toLocaleUpperCase();
}

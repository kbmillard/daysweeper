export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s\W_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

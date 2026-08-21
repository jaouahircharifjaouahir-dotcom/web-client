export function isValidBlogId(value: string): boolean {
  return /^\d{5,24}$/.test(value.trim());
}

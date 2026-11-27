/** Plain text from sanitised HTML (for JSON-LD answers). Never used for rendering. */
export function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

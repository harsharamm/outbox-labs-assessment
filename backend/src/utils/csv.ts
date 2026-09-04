const EMAIL_REGEX = /[^\s,;<>()]+@[^\s,;<>()]+\.[^\s,;<>()]+/g;

/**
 * Extracts unique, valid-looking email addresses from an uploaded CSV or
 * plain-text leads file. Deliberately permissive about column layout (a
 * single "email" column, multiple columns, or one address per line all
 * work) since the assignment only asks us to "parse and count".
 */
export function extractEmailsFromBuffer(buffer: Buffer): string[] {
  const text = buffer.toString("utf-8");
  const matches = text.match(EMAIL_REGEX) ?? [];
  const unique = Array.from(new Set(matches.map((e) => e.trim().toLowerCase())));
  return unique;
}

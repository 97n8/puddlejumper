/**
 * htmlSafe - small, well-tested helpers for interpolating untrusted strings
 * into generated HTML/JS contexts.
 *
 * Use the right helper for the right context:
 *   - escapeHtml(s)  - for HTML element text and double-quoted attribute values.
 *   - escapeAttr(s)  - strict attribute escape (also handles single quotes / backticks).
 *   - escapeJsString(s) - for embedding strings into a <script> tag (uses JSON.stringify).
 *   - safeMailtoEmail(s) - accepts only a syntactically reasonable email or returns ''.
 *   - safeUrl(s)     - returns the URL only if it has an http/https/mailto scheme.
 */

export function escapeHtml(input: unknown): string {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');
}

export function escapeAttr(input: unknown): string {
  // Same set as escapeHtml but always quote-safe for both single and double quoted attrs.
  return escapeHtml(input);
}

// Build the U+2028 / U+2029 line/paragraph separator regexes via the RegExp
// constructor. Embedding the literal characters in a regex literal would
// terminate the source line and break the parser.
const LINE_TERMINATOR_RE = new RegExp('[\\u2028\\u2029]', 'g');

/**
 * Embed a string literal inside a <script> block. Returns a quoted JS string
 * (including the surrounding quotes) that is safe against `</script>` breakouts
 * and line-terminator injection (U+2028 / U+2029, which JSON.stringify leaves
 * unescaped but which JS parses as line terminators).
 */
export function escapeJsString(input: unknown): string {
  const json = JSON.stringify(input ?? '');
  return json
    .replace(/</g, '\\u003C')
    .replace(/>/g, '\\u003E')
    .replace(LINE_TERMINATOR_RE, (ch) =>
      ch.charCodeAt(0) === 0x2028 ? '\\u2028' : '\\u2029'
    );
}

const EMAIL_RE = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,}$/;

export function safeMailtoEmail(input: unknown): string {
  if (typeof input !== 'string') return '';
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return '';
  return EMAIL_RE.test(trimmed) ? trimmed : '';
}

export function safeUrl(input: unknown): string {
  if (typeof input !== 'string') return '';
  const trimmed = input.trim();
  try {
    const u = new URL(trimmed);
    if (u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'mailto:') {
      return u.toString();
    }
  } catch {
    // not a URL
  }
  return '';
}

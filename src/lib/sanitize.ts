/**
 * Input sanitization utilities.
 * Strips prompt injection patterns and dangerous control characters
 * before text is sent to the Gemini API.
 */

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions?/gi,
  /forget\s+(all\s+)?previous\s+(instructions?|context)/gi,
  /you\s+are\s+now\s+(a|an)\s+/gi,
  /act\s+as\s+(a|an)\s+/gi,
  /pretend\s+(you\s+are|to\s+be)\s+/gi,
  /system\s*:\s*/gi,
  /\[INST\]/gi,
  /<<SYS>>/gi,
  /<\|im_start\|>/gi,
  /###\s*instruction/gi,
];

/**
 * Sanitize text before sending to AI models.
 * - Strips control characters (null bytes, form feeds, etc.)
 * - Removes prompt injection patterns
 * - Truncates to maxLength
 */
export function sanitizeForAI(text: string, maxLength = 4000): string {
  if (!text || typeof text !== 'string') return '';

  let cleaned = text
    // Strip null bytes and non-printable control characters (keep \n, \r, \t)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize excessive whitespace
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();

  // Remove prompt injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    cleaned = cleaned.replace(pattern, '[removed]');
  }

  return cleaned.substring(0, maxLength);
}

/**
 * Sanitize a plain string field (name, role, location).
 * Strips HTML tags and limits length.
 */
export function sanitizeField(value: string, maxLength = 200): string {
  if (!value || typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/g, '') // strip HTML
    .replace(/[\x00-\x1F\x7F]/g, '') // control chars
    .trim()
    .substring(0, maxLength);
}

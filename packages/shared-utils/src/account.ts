// Validation rules for permanent player accounts (see the account setup/edit screens on
// mobile and PlayerAccountService on the server). Lives here rather than shared-types so both
// client and server enforce the exact same rules from one source instead of drifting.

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 16;
export const DISPLAY_NAME_MAX_LENGTH = 15;

// Letters and numbers only, no spaces, no special characters.
export const USERNAME_PATTERN = /^[A-Za-z0-9]+$/;

// Blocked regardless of format validity — usernames that would be confusing or impersonate
// the game/its staff.
export const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'root',
  'support',
  'system',
  'moderator',
  'mod',
  'null',
  'undefined',
  'gadhachor',
  'gadhachorofficial',
]);

// Zero-width and bidi-override characters that can be used to visually spoof another name
// (e.g. hiding characters or reversing displayed order) without changing the character count.
// Built from explicit code points rather than literal characters so the invisible codepoints
// can't be silently mangled by an editor/terminal.
const HIDDEN_CHARS = [
  0x0000, // NUL through
  0x001f, // ...unit separator (C0 controls) — expanded to a range below
  0x200b, // zero width space
  0x200c, // zero width non-joiner
  0x200d, // zero width joiner
  0x200e, // left-to-right mark
  0x200f, // right-to-left mark
  0x202a, // left-to-right embedding
  0x202b, // right-to-left embedding
  0x202c, // pop directional formatting
  0x202d, // left-to-right override
  0x202e, // right-to-left override
  0x2060, // word joiner
  0xfeff, // zero width no-break space / BOM
];
const HIDDEN_CHAR_PATTERN = new RegExp(
  `[${String.fromCodePoint(0x0000)}-${String.fromCodePoint(0x001f)}${HIDDEN_CHARS.slice(2)
    .map((code) => String.fromCodePoint(code))
    .join('')}]`,
  'u',
);

// Lowercases for uniqueness comparisons — the DB's real uniqueness guarantee is a unique
// index on this same normalization (`lower(username)`), this is just so client-side checks
// agree with it.
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function isValidUsernameFormat(username: string): boolean {
  if (!USERNAME_PATTERN.test(username)) {
    return false;
  }
  if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
    return false;
  }
  return !RESERVED_USERNAMES.has(normalizeUsername(username));
}

export function isValidDisplayName(displayName: string): boolean {
  const trimmed = displayName.trim();
  if (trimmed.length === 0) {
    return false;
  }
  if (HIDDEN_CHAR_PATTERN.test(trimmed)) {
    return false;
  }
  // Count Unicode code points, not UTF-16 code units — a single emoji can otherwise consume
  // 2-7 of the character budget under plain `.length`.
  return [...trimmed].length <= DISPLAY_NAME_MAX_LENGTH;
}

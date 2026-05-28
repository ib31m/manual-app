// Activation, password rules and PUK handling.
// Combines Performance Lite §2.1–2.3 (token, password, Forgot Password→PUK)
// with s-Insight §2.2 (strong password requirements, remember password).

export interface PasswordCheck {
  ok: boolean;
  rules: { label: string; met: boolean }[];
}

/**
 * Strong password requirements (s-Insight §2.2):
 *  - at least 10 characters
 *  - uppercase and lowercase letters
 *  - a number
 *  - a special character
 */
export function checkPassword(pw: string): PasswordCheck {
  const rules = [
    { label: 'At least 10 characters', met: pw.length >= 10 },
    { label: 'An uppercase letter', met: /[A-Z]/.test(pw) },
    { label: 'A lowercase letter', met: /[a-z]/.test(pw) },
    { label: 'A number', met: /[0-9]/.test(pw) },
    { label: 'A special character', met: /[^A-Za-z0-9]/.test(pw) },
  ];
  return { ok: rules.every((r) => r.met), rules };
}

/** 30-day inactivity window for a remembered password (s-Insight §2.2). */
export const REMEMBER_DAYS = 30;

export function rememberedPasswordExpired(lastActiveIso: string): boolean {
  const last = new Date(lastActiveIso).getTime();
  const ageDays = (Date.now() - last) / (1000 * 60 * 60 * 24);
  return ageDays > REMEMBER_DAYS;
}

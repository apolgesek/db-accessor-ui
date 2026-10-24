// Browser login session as returned by the backend's /session routes. Times are Unix ms.
export type SessionSnapshot = {
  sessionId: string;
  serverNow: number;
  idleExpiresAt: number;
  revision: number;
};

export const SESSION_REJECTION_CODES = [
  'SESSION_REQUIRED',
  'SESSION_EXPIRED',
  'SESSION_REVOKED',
  'LOGIN_REQUIRED',
] as const;

export type SessionRejectionCode = (typeof SESSION_REJECTION_CODES)[number];

export function isSessionRejectionCode(value: unknown): value is SessionRejectionCode {
  return SESSION_REJECTION_CODES.includes(value as SessionRejectionCode);
}

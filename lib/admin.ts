/**
 * Admin email allowlist for MY ICE CREAM.
 * This is used for account recognition in the UI only.
 * Never use a client-side email check as the sole authorization control.
 * Enforce admin permissions with verified Firebase Auth claims / Firestore Rules.
 */
const ADMIN_EMAILS = new Set([
  "zaradigitalseva@gmail.com",
  "ngogrant454@gmail.com",
]);

export function isAdminEmail(email: string | null | undefined): boolean {
  return typeof email === "string" && ADMIN_EMAILS.has(email.trim().toLowerCase());
}

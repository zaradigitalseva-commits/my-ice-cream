/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
type JsonMap = Record<string, any>;
const ADMIN_EMAILS = new Set(["zaradigitalseva@gmail.com", "ngogrant454@gmail.com"]);

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
function base64Url(value: string | Uint8Array | ArrayBuffer): string {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function decodeFirestoreValue(value: JsonMap): any {
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("mapValue" in value) return decodeFirestoreFields(value.mapValue.fields || {});
  return null;
}
function decodeFirestoreFields(fields: JsonMap = {}): JsonMap {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeFirestoreValue(value as JsonMap)]));
}
async function verifyAdmin(idToken: string, apiKey: string): Promise<boolean> {
  const response = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + encodeURIComponent(apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken })
  });
  if (!response.ok) return false;
  const result = await response.json() as JsonMap;
  const account = result.users?.[0];
  return Boolean(account && account.emailVerified === true && ADMIN_EMAILS.has(String(account.email || "").trim().toLowerCase()));
}
async function getGoogleAccessToken(serviceAccount: JsonMap): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" })) + "." + base64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  }));
  const pem = String(serviceAccount.private_key || "").replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\\n/g, "").replace(/\s/g, "");
  if (!pem || !serviceAccount.client_email) throw new Error("FCM service account JSON is incomplete.");
  const keyBytes = Uint8Array.from(atob(pem), (character) => character.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", keyBytes, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const assertion = unsigned + "." + base64Url(signature);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion })
  });
  const result = await response.json() as JsonMap;
  if (!response.ok || !result.access_token) throw new Error("Google service-account authentication failed.");
  return result.access_token as string;
}
async function listTokens(projectId: string, accessToken: string): Promise<string[]> {
  const tokens = new Set<string>();
  let pageToken = "";
  do {
    const url = new URL("https://firestore.googleapis.com/v1/projects/" + encodeURIComponent(projectId) + "/databases/(default)/documents/pushSubscriptions");
    url.searchParams.set("pageSize", "1000");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, { headers: { Authorization: "Bearer " + accessToken } });
    if (!response.ok) throw new Error("Could not read registered devices from Firestore (" + response.status + ").");
    const result = await response.json() as JsonMap;
    for (const document of result.documents || []) {
      const token = decodeFirestoreFields(document.fields || {}).token;
      if (typeof token === "string" && token.length > 20) tokens.add(token);
    }
    pageToken = String(result.nextPageToken || "");
  } while (pageToken);
  return Array.from(tokens);
}
export async function POST(request: NextRequest) {
  const idToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!idToken) return jsonError("Admin sign-in is required.", 401);
  const body = await request.json().catch(() => null) as JsonMap | null;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const message = typeof body?.body === "string" ? body.body.trim() : "";
  if (!title || title.length > 120 || !message || message.length > 300) return jsonError("Title (1–120) और Message (1–300 अक्षर) जरूरी हैं।", 400);

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const serviceAccountText = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!projectId || !apiKey || !serviceAccountText) return jsonError("Push service configuration missing है। Hosting environment में Firebase service-account secret जाँचें।", 503);

  try {
    if (!await verifyAdmin(idToken, apiKey)) return jsonError("केवल verified Super Admin पोस्ट भेज सकता है।", 403);
    const serviceAccount = JSON.parse(serviceAccountText) as JsonMap;
    if (serviceAccount.project_id && serviceAccount.project_id !== projectId) return jsonError("FCM service account गलत Firebase project का है।", 503);
    const accessToken = await getGoogleAccessToken(serviceAccount);
    const notificationId = crypto.randomUUID();
    const base = "https://firestore.googleapis.com/v1/projects/" + encodeURIComponent(projectId) + "/databases/(default)/documents";
    const createdAt = new Date().toISOString();
    const postResponse = await fetch(base + "/notifications?documentId=" + encodeURIComponent(notificationId), {
      method: "POST",
      headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
      body: JSON.stringify({ fields: {
        type: { stringValue: "admin" },
        shopName: { stringValue: "MY ICE CREAM" },
        title: { stringValue: title },
        body: { stringValue: message },
        createdAt: { timestampValue: createdAt }
      }})
    });
    if (!postResponse.ok) throw new Error("Post publish failed in Firestore (" + postResponse.status + ").");
    const tokens = await listTokens(projectId, accessToken);
    let sent = 0;
    let failed = 0;
    const failures: string[] = [];
    for (let start = 0; start < tokens.length; start += 20) {
      const batch = tokens.slice(start, start + 20);
      const results = await Promise.all(batch.map(async (token) => {
        const response = await fetch("https://fcm.googleapis.com/v1/projects/" + encodeURIComponent(projectId) + "/messages:send", {
          method: "POST",
          headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
          body: JSON.stringify({ message: {
            token,
            notification: { title: title, body: message },
            data: { url: "/", notificationId: notificationId },
            webpush: {
              headers: { TTL: "86400", Urgency: "high" },
              notification: { icon: "/my-ice-cream-app.svg", badge: "/my-ice-cream-app.svg", tag: "admin-" + notificationId, renotify: true },
              fcmOptions: { link: "/" }
            }
          }})
        });
        if (response.ok) return { ok: true, error: "" };
        const error = await response.json().catch(() => ({})) as JsonMap;
        return { ok: false, error: String(error.error?.status || response.status) };
      }));
      for (const result of results) {
        if (result.ok) sent++;
        else { failed++; if (!failures.includes(result.error)) failures.push(result.error); }
      }
    }
    return NextResponse.json({ published: true, notificationId, subscribers: tokens.length, sent, failed, failures: failures.slice(0, 3) });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Announcement could not be sent.", 500);
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

type JsonMap = Record<string, any>;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function base64Url(value: string | Uint8Array | ArrayBuffer): string {
  const bytes = typeof value === "string"
    ? new TextEncoder().encode(value)
    : value instanceof Uint8Array
      ? value
      : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function decodeJwtPayload(token: string): JsonMap | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")));
  } catch {
    return null;
  }
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function decodeFirestoreValue(value: JsonMap): any {
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;
  if ("mapValue" in value) return decodeFirestoreFields(value.mapValue.fields || {});
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(decodeFirestoreValue);
  return null;
}

function decodeFirestoreFields(fields: JsonMap = {}): JsonMap {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeFirestoreValue(value as JsonMap)]));
}

function firestoreFields(data: JsonMap): JsonMap {
  const fields: JsonMap = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string") fields[key] = { stringValue: value };
    else if (typeof value === "number") fields[key] = Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
    else if (typeof value === "boolean") fields[key] = { booleanValue: value };
    else if (value && typeof value === "object" && "timestamp" in value) fields[key] = { timestampValue: value.timestamp };
    else if (value === null) fields[key] = { nullValue: null };
  }
  return fields;
}

async function firestoreDocument(projectId: string, path: string, bearer: string): Promise<JsonMap | null> {
  const url = "https://firestore.googleapis.com/v1/projects/" + encodeURIComponent(projectId)
    + "/databases/(default)/documents/" + path.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(url, { headers: { Authorization: "Bearer " + bearer } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Firestore read failed (" + response.status + ").");
  const document = await response.json() as JsonMap;
  return decodeFirestoreFields(document.fields || {});
}

async function getGoogleAccessToken(serviceAccount: JsonMap): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  }));
  const unsigned = header + "." + claims;
  const pem = String(serviceAccount.private_key || "")
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\\n/g, "")
    .replace(/\s/g, "");
  if (!pem || !serviceAccount.client_email) throw new Error("FCM service account JSON is incomplete.");
  const binary = atob(pem);
  const keyBytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const assertion = unsigned + "." + base64Url(signature);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const result = await response.json() as JsonMap;
  if (!response.ok || !result.access_token) throw new Error("Google service-account authentication failed.");
  return result.access_token as string;
}

async function listPushSubscriptions(projectId: string, accessToken: string): Promise<{ name: string; token: string }[]> {
  const all: { name: string; token: string }[] = [];
  let pageToken = "";
  do {
    const url = new URL("https://firestore.googleapis.com/v1/projects/" + encodeURIComponent(projectId) + "/databases/(default)/documents/pushSubscriptions");
    url.searchParams.set("pageSize", "1000");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, { headers: { Authorization: "Bearer " + accessToken } });
    if (!response.ok) throw new Error("Could not read push subscribers from Firestore (" + response.status + ").");
    const result = await response.json() as JsonMap;
    for (const document of result.documents || []) {
      const fields = decodeFirestoreFields(document.fields || {});
      if (typeof fields.token === "string" && fields.token.length > 20) {
        all.push({ name: String(document.name || ""), token: fields.token });
      }
    }
    pageToken = String(result.nextPageToken || "");
  } while (pageToken);
  return all;
}

async function writeEvent(projectId: string, eventId: string, accessToken: string, data: JsonMap, create: boolean): Promise<Response> {
  const base = "https://firestore.googleapis.com/v1/projects/" + encodeURIComponent(projectId) + "/databases/(default)/documents";
  if (create) {
    return fetch(base + "/pushNotificationEvents?documentId=" + encodeURIComponent(eventId), {
      method: "POST",
      headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
      body: JSON.stringify({ fields: firestoreFields(data) })
    });
  }
  const url = new URL(base + "/pushNotificationEvents/" + encodeURIComponent(eventId));
  for (const field of Object.keys(data)) url.searchParams.append("updateMask.fieldPaths", field);
  return fetch(url, {
    method: "PATCH",
    headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: firestoreFields(data) })
  });
}

async function removeInvalidSubscription(documentName: string, accessToken: string): Promise<void> {
  if (!documentName) return;
  const response = await fetch("https://firestore.googleapis.com/v1/" + documentName, {
    method: "DELETE",
    headers: { Authorization: "Bearer " + accessToken }
  });
  if (!response.ok && response.status !== 404) {
    // A stale token can remain in the collection; it will be retried on a later send.
  }
}

export async function POST(request: NextRequest) {
  const idToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!idToken) return jsonError("Sign in is required to publish a product notification.", 401);

  const body = await request.json().catch(() => null) as JsonMap | null;
  const shopId = typeof body?.shopId === "string" ? body.shopId.trim() : "";
  const productId = typeof body?.productId === "string" ? body.productId.trim() : "";
  if (!shopId || !productId || shopId.includes("/") || productId.includes("/")) {
    return jsonError("Valid shopId and productId are required.", 400);
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const serviceAccountText = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!projectId || !serviceAccountText) {
    return jsonError("Push service is not configured yet. Add FCM service-account settings to the hosting environment.", 503);
  }

  const identity = decodeJwtPayload(idToken);
  const uid = typeof identity?.sub === "string" ? identity.sub : "";
  if (!uid) return jsonError("The sign-in session is invalid. Please sign in again.", 401);

  try {
    // These reads are performed with the caller's Firebase ID token, so Firestore Rules
    // independently confirm that this caller can read the shop and its product.
    const [shop, product] = await Promise.all([
      firestoreDocument(projectId, "shops/" + shopId, idToken),
      firestoreDocument(projectId, "shops/" + shopId + "/products/" + productId, idToken)
    ]);
    if (!shop || !product || shop.ownerUid !== uid || product.ownerUid !== uid || product.shopId !== shopId) {
      return jsonError("Only the owner of this shop can send its product notification.", 403);
    }
    if (!["live", "LIVE", "Live"].includes(String(shop.status || ""))) {
      return jsonError("Only LIVE shops can notify customers about products.", 403);
    }
    if (product.active !== true) return NextResponse.json({ sent: 0, skipped: true, message: "Inactive products are not sent to customers." });

    const serviceAccount = JSON.parse(serviceAccountText) as JsonMap;
    if (serviceAccount.project_id && serviceAccount.project_id !== projectId) {
      return jsonError("FCM service account belongs to a different Firebase project.", 503);
    }
    const accessToken = await getGoogleAccessToken(serviceAccount);
    const eventId = await sha256Hex(shopId + ":" + productId);
    const now = new Date().toISOString();
    const lock = await writeEvent(projectId, eventId, accessToken, {
      shopId, productId, state: "sending", createdAt: { timestamp: now }
    }, true);
    if (lock.status === 409) {
      return NextResponse.json({ sent: 0, duplicate: true, message: "This product notification was already processed." });
    }
    if (!lock.ok) throw new Error("Could not create the notification delivery record (" + lock.status + ").");

    const subscriptions = await listPushSubscriptions(projectId, accessToken);
    // A customer may have signed in with more than one account on the same browser.
    // Send once per FCM token, not once per Firestore record.
    const unique = new Map<string, string>();
    for (const subscription of subscriptions) if (!unique.has(subscription.token)) unique.set(subscription.token, subscription.name);

    const origin = new URL(request.url).origin;
    const productUrl = origin + "/shop/" + encodeURIComponent(shopId) + "?product=" + encodeURIComponent(productId);
    const shopName = String(shop.name || shop.shopName || "Ice Cream Shop");
    const productName = String(product.name || "New ice cream product");
    const price = typeof product.price === "number" ? " · ₹" + product.price : "";
    let sent = 0;
    let failed = 0;
    const stale: string[] = [];
    const tokens = Array.from(unique.entries());

    for (let start = 0; start < tokens.length; start += 20) {
      const batch = tokens.slice(start, start + 20);
      const results = await Promise.all(batch.map(async ([token, documentName]) => {
        const response = await fetch("https://fcm.googleapis.com/v1/projects/" + encodeURIComponent(projectId) + "/messages:send", {
          method: "POST",
          headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
          body: JSON.stringify({
            message: {
              token,
              notification: {
                title: shopName + " में नया Product!",
                body: productName + price
              },
              data: { url: productUrl, shopId, productId },
              webpush: {
                headers: { TTL: "86400" },
                notification: {
                  icon: "/my-ice-cream-app.svg",
                  badge: "/my-ice-cream-app.svg",
                  tag: "product-" + productId,
                  renotify: false
                },
                fcmOptions: { link: productUrl }
              }
            }
          })
        });
        if (response.ok) return { sent: true, stale: false, documentName };
        const error = await response.json().catch(() => ({})) as JsonMap;
        const detail = JSON.stringify(error);
        const isStale = response.status === 404 || detail.includes("UNREGISTERED") || detail.includes("registration-token-not-registered");
        return { sent: false, stale: isStale, documentName };
      }));
      for (const result of results) {
        if (result.sent) sent++;
        else {
          failed++;
          if (result.stale) stale.push(result.documentName);
        }
      }
    }

    await Promise.all(stale.map((name) => removeInvalidSubscription(name, accessToken)));
    await writeEvent(projectId, eventId, accessToken, {
      state: "sent", sentCount: sent, failedCount: failed, updatedAt: { timestamp: new Date().toISOString() }
    }, false);

    return NextResponse.json({
      sent,
      failed,
      subscribers: unique.size,
      message: sent > 0 ? "New product push notifications sent." : "No customers have registered push notifications yet."
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Push notification could not be sent.", 500);
  }
}

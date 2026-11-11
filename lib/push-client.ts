"use client";

import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { doc, serverTimestamp, setDoc } from "firebase/firestore/lite";
import { db, firebaseApp } from "@/lib/firebase";

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function registerPushSubscription(uid: string): Promise<void> {
  if (!uid || !firebaseApp || !db || typeof window === "undefined") {
    throw new Error("Customer sign-in is required before notifications can be registered.");
  }
  if (!(await isSupported())) throw new Error("This browser does not support Firebase web push notifications.");
  if (!("Notification" in window) || Notification.permission !== "granted") {
    throw new Error("Notification permission has not been granted.");
  }

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) throw new Error("Firebase Web Push VAPID public key is not configured.");

  const registration = await navigator.serviceWorker.register("/sw.js");
  const messaging = getMessaging(firebaseApp);
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
  if (!token) throw new Error("A push subscription could not be created.");

  const tokenHash = await hashToken(token);
  await setDoc(doc(db, "pushSubscriptions", uid + "_" + tokenHash), {
    uid,
    token,
    platform: navigator.platform || "web",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
}

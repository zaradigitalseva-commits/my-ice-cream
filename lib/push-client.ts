"use client";

import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { doc, serverTimestamp, setDoc } from "firebase/firestore/lite";
import { auth, db, firebaseApp } from "@/lib/firebase";
import { signInAnonymously } from "firebase/auth";

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
  // Wait until this phone's service worker is active before asking FCM for its token.
  await navigator.serviceWorker.ready;
  const activeRegistration = await navigator.serviceWorker.getRegistration("/") || registration;
  const messaging = getMessaging(firebaseApp);
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: activeRegistration });
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


/**
 * Called only from the customer's explicit notification button.
 * Keeps Google sign-in optional by creating a Firebase anonymous session
 * when this browser has no signed-in user.
 */
export async function enablePushNotifications(): Promise<void> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    throw new Error("This browser does not support notifications.");
  }
  if (!auth || !firebaseApp || !db) {
    throw new Error("Firebase setup is incomplete. Please try again later.");
  }

  // Request permission before other awaited work so browsers still recognize
  // the call as a direct response to the customer's button tap.
  const permission = Notification.permission === "granted"
    ? "granted"
    : await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(permission === "denied"
      ? "Notifications are blocked. Allow them in your browser or phone settings."
      : "Notification permission was not granted.");
  }

  let currentUser = auth.currentUser;
  if (!currentUser) {
    currentUser = (await signInAnonymously(auth)).user;
  }
  await registerPushSubscription(currentUser.uid);
}

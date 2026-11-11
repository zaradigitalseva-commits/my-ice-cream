"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { registerPushSubscription } from "@/lib/push-client";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function PwaInstallButton() {
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const isStandalone = () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    // Chrome may open the website in a normal tab from Google Search even when
    // the PWA is already installed. Remember installation across browser tabs.
    const installMarker = "my-ice-cream-pwa-installed";
    let wasInstalled = false;
    try {
      wasInstalled = window.localStorage.getItem(installMarker) === "yes";
    } catch {
      // Storage can be unavailable in restricted browsing modes.
    }

    const standalone = isStandalone();
    if (standalone) {
      wasInstalled = true;
      try {
        window.localStorage.setItem(installMarker, "yes");
      } catch {
        // The standalone display-mode check still hides the button in this session.
      }
      setInstalled(true);
    } else {
      if (wasInstalled) {
        setInstalled(true);
      }
    }
    setReady(true);

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      let alreadyInstalled = false;
      try {
        alreadyInstalled = window.localStorage.getItem(installMarker) === "yes";
      } catch {
        // Continue with the browser install prompt when storage is unavailable.
      }
      if (!alreadyInstalled && !isStandalone()) {
        setInstallPrompt(event as InstallPromptEvent);
      }
    };
    const onInstalled = () => {
      try {
        window.localStorage.setItem(installMarker, "yes");
      } catch {
        // The appinstalled state is still applied for the current page.
      }
      setInstalled(true);
      setShowHelp(false);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // The website remains fully usable if service-worker registration is unavailable.
      });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Ask for browser permission after Google sign-in, then register this phone silently.
  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser || typeof window === "undefined" || !("Notification" in window)) return;
      if (Notification.permission !== "granted") return;
      try {
        await registerPushSubscription(currentUser.uid);
      } catch (error) {
        console.error("MY ICE CREAM push registration failed:", error);
      }
    });
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) {
      setShowHelp((current) => !current);
      return;
    }

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setInstallPrompt(null);
    } catch {
      setShowHelp(true);
    }
  };

  if (!ready) return null;

  return (
    <div className="ice-install-root">
      {!installed && showHelp && (
        <div className="ice-install-help" role="status">
          <button
            className="ice-install-close"
            type="button"
            aria-label="Close install instructions"
            onClick={() => setShowHelp(false)}
          >
            ×
          </button>
          <strong>Install MY ICE CREAM</strong>
          <p>
            {/iPhone|iPad|iPod/i.test(typeof navigator !== "undefined" ? navigator.userAgent : "")
              ? "Safari में Share बटन दबाएँ, फिर “Add to Home Screen” चुनें।"
              : "अपने browser के menu (⋮) में “Install app” या “Add to Home screen” चुनें।"}
          </p>
        </div>
      )}

      {!installed && (
        <button
          type="button"
          className="ice-install-button"
          onClick={handleInstall}
          aria-label="Install MY ICE CREAM app"
        >
          <span className="ice-install-icon" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none">
              <path d="M8 12.5h16l-2 15H10l-2-15Z" fill="#FFF7ED" stroke="#8B3D32" strokeWidth="1.5" />
              <path d="M9 12.5c-2.5-2.2-.7-5.5 2-5.5 0-3 4.5-4.2 6-1.3 2.6-2.1 6.4-.1 5.7 3 2.9.3 3.8 3.1 1.3 3.8H9Z" fill="#FFB7C5" stroke="#8B3D32" strokeWidth="1.3" />
              <path d="m13 17 3 3 3-3M16 20v-5" stroke="#D45C69" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="ice-install-copy">
            <strong>Install App</strong>
            <small>MY ICE CREAM</small>
          </span>
          <span className="ice-install-arrow" aria-hidden="true">↓</span>
        </button>
      )}

      <style jsx>{`
        .ice-install-root {
          position: fixed; z-index: 9999;
          right: max(18px, env(safe-area-inset-right));
          bottom: max(20px, env(safe-area-inset-bottom));
          display: flex; flex-direction: column; align-items: flex-end; gap: 12px;
          font-family: Arial, Helvetica, sans-serif;
        }
        .ice-install-button {
          display:flex;align-items:center;gap:10px;min-height:64px;padding:9px 15px 10px 10px;
          border:1px solid rgba(255,255,255,.8);border-radius:19px;color:#55251f;
          background:linear-gradient(145deg,#fff8ec 0%,#ffd4dc 52%,#ffadbd 100%);
          box-shadow:0 8px 0 #c75c6c,0 12px 24px rgba(83,35,40,.28),inset 0 2px 3px rgba(255,255,255,.95);
          cursor:pointer;transform:translateY(-3px);transition:transform .18s ease,box-shadow .18s ease;
          animation:ice-float 2.8s ease-in-out infinite;
        }
        .ice-install-button:hover{transform:translateY(-6px);box-shadow:0 11px 0 #c75c6c,0 16px 28px rgba(83,35,40,.3),inset 0 2px 3px rgba(255,255,255,.95)}
        .ice-install-button:active{transform:translateY(3px);box-shadow:0 2px 0 #c75c6c,0 5px 12px rgba(83,35,40,.22)}
        .ice-install-icon{display:grid;width:43px;height:43px;place-items:center;border-radius:14px;background:linear-gradient(145deg,#fff,#ffe4e8);box-shadow:inset 0 1px 3px #fff,0 3px 7px rgba(117,47,54,.15)}
        .ice-install-icon svg{width:31px;height:31px}
        .ice-install-copy{display:flex;flex-direction:column;align-items:flex-start;gap:2px}
        .ice-install-copy strong{font-size:14px;font-weight:900;letter-spacing:.2px}
        .ice-install-copy small{font-size:9px;font-weight:800;letter-spacing:1.1px;opacity:.72}
        .ice-install-arrow{font-size:21px;font-weight:900;margin-left:2px}
        .ice-install-help,.ice-notification-card{
          position:relative;width:min(310px,calc(100vw - 36px));padding:17px 38px 15px 16px;
          border:1px solid #f4c4ca;border-radius:16px;color:#522a2a;background:#fffaf4;
          box-shadow:0 10px 30px rgba(50,20,20,.2);font-size:13px;line-height:1.5;
        }
        .ice-install-help strong,.ice-notification-card strong{display:block;margin-bottom:5px;font-size:15px}
        .ice-install-help p,.ice-notification-card p{margin:0 0 12px}
        .ice-install-close{position:absolute;top:7px;right:9px;border:0;background:transparent;color:#7a4141;font-size:23px;cursor:pointer}
        .ice-notification-emoji{display:block;font-size:24px;margin-bottom:5px}
        .ice-notification-allow{width:100%;padding:11px 14px;border:0;border-radius:11px;background:linear-gradient(110deg,#ed6b9e,#9760d3);color:#fff;font-weight:900;cursor:pointer;box-shadow:0 4px 0 #874b9e}
        .ice-notification-later{display:block;margin:10px auto 0;border:0;background:transparent;color:#805f79;font-weight:700;cursor:pointer}
        .ice-notification-status{display:flex;align-items:center;gap:10px;max-width:min(320px,calc(100vw - 36px));padding:12px 14px;border:1px solid #d8c7eb;border-radius:13px;background:#fff;color:#56366f;box-shadow:0 8px 24px #40204a25;font-size:12px}
        .ice-notification-status button{border:0;background:transparent;color:inherit;font-size:20px;cursor:pointer}
        @keyframes ice-float{0%,100%{transform:translateY(-3px)}50%{transform:translateY(-8px)}}
        @media(prefers-reduced-motion:reduce){.ice-install-button{animation:none;transition:none}}
      `}</style>
    </div>
  );
}

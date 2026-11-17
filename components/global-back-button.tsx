"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

function getFallbackPath(pathname: string): string {
  if (pathname.startsWith("/admin")) return "/admin";
  if (pathname === "/shop/register" || pathname.startsWith("/shop/register/")) return "/";
  if (pathname.startsWith("/shop")) return "/shop";
  if (pathname.startsWith("/customer")) return "/customer";
  return "/";
}

export default function GlobalBackButton() {
  const pathname = usePathname();
  const router = useRouter();
  const visitedPaths = useRef<string[]>([]);

  useEffect(() => {
    if (!pathname) return;
    const history = visitedPaths.current;
    if (history[history.length - 1] !== pathname) {
      history.push(pathname);
      if (history.length > 30) history.shift();
    }
  }, [pathname]);

  if (pathname === "/") return null;

  function goBack() {
    const history = visitedPaths.current;
    const currentPath = pathname || "/";
    if (history.length > 1 && history[history.length - 1] === currentPath) {
      history.pop();
      const previousPath = history[history.length - 1];
      if (previousPath && previousPath !== currentPath) {
        router.push(previousPath);
        return;
      }
    }
    router.push(getFallbackPath(currentPath));
  }

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="पिछले पेज पर वापस जाएँ"
      className="global-back-button"
    >
      <span aria-hidden="true">←</span> वापस जाएँ
      <style jsx>{`
        .global-back-button {
          position: fixed;
          left: max(12px, env(safe-area-inset-left));
          bottom: max(16px, env(safe-area-inset-bottom));
          z-index: 2400;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          min-height: 42px;
          padding: 9px 15px;
          border: 1px solid #ead5c5;
          border-radius: 999px;
          background: linear-gradient(135deg, #fffdf8, #ffefd9);
          color: #57351f;
          font-size: 13px;
          font-weight: 800;
          box-shadow: 0 3px 0 #dfc4ad, 0 7px 18px #58351f20;
          cursor: pointer;
        }
        .global-back-button span { font-size: 19px; line-height: 1; }
        .global-back-button:active { transform: translateY(2px); box-shadow: 0 1px 0 #dfc4ad; }
        @media (prefers-reduced-motion: reduce) {
          .global-back-button { transition: none; }
        }
      `}</style>
    </button>
  );
}

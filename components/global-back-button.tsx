"use client";

import { usePathname, useRouter } from "next/navigation";

function fallbackFor(pathname: string) {
  if (pathname.startsWith("/admin/payments")) return "/admin";
  if (pathname.startsWith("/shop/orders") || pathname.startsWith("/shop/register")) return "/shop";
  if (pathname.startsWith("/admin") || pathname.startsWith("/shop") || pathname.startsWith("/customer")) return "/";
  return "/";
}

export default function GlobalBackButton() {
  const pathname = usePathname();
  const router = useRouter();

  function goBack() {
    // Use the in-app browser history when available. On a direct page visit,
    // stay inside MY ICE CREAM and return to that section's sensible parent.
    const historyIndex = window.history.state?.idx;
    if (typeof historyIndex === "number" && historyIndex > 0) {
      router.back();
      return;
    }

    const fallback = fallbackFor(pathname || "/");
    if (fallback !== pathname) router.push(fallback);
  }

  return (
    <button
      type="button"
      className="global-back-button"
      onClick={goBack}
      aria-label="Go back to the previous page"
    >
      <span aria-hidden="true">←</span> वापस जाएँ
    </button>
  );
}

"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { isAdminEmail } from "@/lib/admin";

export default function CustomerPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      if (!nextUser) router.replace("/");
      else if (isAdminEmail(nextUser.email) && nextUser.emailVerified) router.replace("/admin");
    });
  }, [router]);
  return <main className="admin-wrap">
    <header className="admin-header"><Link href="/" className="admin-brand">🍦 MY ICE CREAM <span>CUSTOMER</span></Link><button className="admin-secondary" onClick={() => auth && signOut(auth)}>Sign out</button></header>
    <section className="admin-panel"><p className="admin-kicker">CUSTOMER ACCOUNT</p><h1>Welcome{user?.displayName ? ", " + user.displayName : ""}!</h1><p>You are using MY ICE CREAM as a customer. Browse all LIVE shops without needing to sign in.</p><Link href="/" className="admin-primary role-link">Explore all shops</Link><p className="admin-muted">Your orders, favourites and bills will appear here as those features are added.</p></section>
  </main>;
}

"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { isAdminEmail } from "@/lib/admin";
type Shop = { id: string; name?: string; shopName?: string; status?: string; city?: string };
export default function ShopPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!auth) { setLoading(false); return; }
    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) { router.replace("/"); return; }
      if (isAdminEmail(nextUser.email) && nextUser.emailVerified) { router.replace("/admin"); return; }
      if (!db) { setLoading(false); return; }
      try {
        const result = await getDocs(query(collection(db, "shops"), where("ownerUid", "==", nextUser.uid)));
        const owned = result.docs[0];
        if (owned) setShop({ id: owned.id, ...owned.data() } as Shop);
      } catch (e) { setError(e instanceof Error ? e.message : "Could not load your shop."); }
      finally { setLoading(false); }
    });
  }, [router]);
  const status = (shop?.status || "pending").toLowerCase();
  return <main className="admin-wrap">
    <header className="admin-header"><Link href="/" className="admin-brand">🍦 MY ICE CREAM <span>SHOP</span></Link><button className="admin-secondary" onClick={() => auth && signOut(auth)}>Sign out</button></header>
    <section className="admin-panel"><p className="admin-kicker">SHOPKEEPER AREA</p>
      {loading ? <h1>Checking shop registration…</h1> : error ? <p className="admin-error">{error}</p> : !shop ?
        <><h1>Register your shop</h1><p>Shopkeeper access starts with a separate shop registration. Admin approval is required before your shop goes LIVE.</p><Link href="/shop/register" className="admin-primary role-link">Register Shop</Link></> :
        <><h1>{shop.name || shop.shopName || "My Shop"}</h1><p>{shop.city || ""}</p><p>Your registration status: <span className={"admin-status " + status}>{status}</span></p>
          {status === "live" ? <p>Your shop is approved and LIVE. Product and order management will be added to this dashboard next.</p> : <p>Your shop is not public yet. Admin must approve it before customers can see it.</p>}
        </>}
      {user && <p className="admin-muted">Signed in as {user.email}</p>}
    </section>
  </main>;
}

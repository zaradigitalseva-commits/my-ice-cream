"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { collection, getDocs, orderBy, query, updateDoc, doc, Timestamp } from "firebase/firestore/lite";
import { auth, db, googleProvider } from "@/lib/firebase";
import { isAdminEmail } from "@/lib/admin";

type Shop = { id: string; name?: string; shopName?: string; ownerEmail?: string; ownerUid?: string; status?: string; city?: string; createdAt?: Timestamp | Date | string };

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!auth) { setAuthReady(true); setError("Firebase configuration is missing."); return; }
    return onAuthStateChanged(auth, (nextUser) => { setUser(nextUser); setAuthReady(true); });
  }, []);

  async function loadShops() {
    if (!db || !user || !isAdminEmail(user.email) || !user.emailVerified) return;
    setLoading(true); setError(""); setNotice("");
    try {
      const result = await getDocs(query(collection(db, "shops"), orderBy("createdAt", "desc")));
      setShops(result.docs.map((item) => ({ id: item.id, ...item.data() } as Shop)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load shops. Check Firestore rules and database setup.");
    } finally { setLoading(false); }
  }

  useEffect(() => { if (user && isAdminEmail(user.email) && user.emailVerified) void loadShops(); }, [user]);

  async function setShopStatus(shop: Shop, status: "live" | "inactive" | "pending" | "rejected") {
    if (!db) return;
    setNotice(""); setError("");
    try {
      await updateDoc(doc(db, "shops", shop.id), { status, updatedAt: new Date() });
      setShops((current) => current.map((item) => item.id === shop.id ? { ...item, status } : item));
      setNotice(`${shop.name || shop.shopName || "Shop"} status changed to ${status.toUpperCase()}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update shop status.");
    }
  }

  if (!authReady) return <main className="admin-wrap"><p>Checking admin access…</p></main>;
  if (!user) return <main className="admin-wrap"><Link href="/" className="admin-back">← Back to home</Link><section className="admin-panel"><h1>Admin sign in</h1><p>Sign in with an authorized admin Google account to continue.</p><button className="admin-primary" onClick={() => auth && signInWithPopup(auth, googleProvider).catch((err) => setError(err.message))}>Continue with Google</button>{error && <p className="admin-error">{error}</p>}</section></main>;
  if (!isAdminEmail(user.email) || !user.emailVerified) return <main className="admin-wrap"><Link href="/" className="admin-back">← Back to home</Link><section className="admin-panel"><h1>Access not allowed</h1><p>This Google account is not on the verified admin allowlist.</p><p className="admin-muted">{user.email}</p><button className="admin-secondary" onClick={() => auth && signOut(auth)}>Sign out</button></section></main>;

  const pending = shops.filter((shop) => (shop.status || "pending").toLowerCase() === "pending").length;
  const live = shops.filter((shop) => (shop.status || "").toLowerCase() === "live").length;
  const inactive = shops.filter((shop) => (shop.status || "").toLowerCase() === "inactive").length;

  return <main className="admin-wrap">
    <header className="admin-header"><Link href="/" className="admin-brand">🍦 MY ICE CREAM <span>ADMIN</span></Link><div className="admin-user"><span>{user.displayName || user.email}</span><button className="admin-secondary" onClick={() => auth && signOut(auth)}>Sign out</button></div></header>
    <div className="admin-heading"><div><p className="admin-kicker">PLATFORM CONTROL</p><h1>Admin dashboard</h1><p>Review shop registrations and control which shops are visible to customers.</p></div><button className="admin-secondary" onClick={() => void loadShops()} disabled={loading}>↻ Refresh</button></div>
    <div className="admin-actions"><Link href="/admin/payments" className="admin-primary">Subscription payments</Link></div><section className="admin-stats"><article><span>Total shops</span><strong>{shops.length}</strong></article><article><span>Awaiting review</span><strong>{pending}</strong></article><article><span>Live shops</span><strong>{live}</strong></article><article><span>Inactive shops</span><strong>{inactive}</strong></article></section>
    {error && <p className="admin-error" role="alert">{error}</p>}{notice && <p className="admin-success" role="status">{notice}</p>}
    <section className="admin-panel"><div className="admin-panel-head"><div><h2>Shop registrations</h2><p>New shops should be reviewed before being made public.</p></div><span className="admin-count">{shops.length} shops</span></div>
      {loading ? <p className="admin-muted">Loading shops…</p> : shops.length === 0 ? <div className="admin-empty"><span>🏪</span><h3>No shop registrations yet</h3><p>When a shop registration is saved to the Firestore <code>shops</code> collection, it will appear here for review.</p></div> :
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Shop</th><th>Owner</th><th>Location</th><th>Status</th><th>Actions</th></tr></thead><tbody>{shops.map((shop) => { const status = (shop.status || "pending").toLowerCase(); return <tr key={shop.id}><td><strong>{shop.name || shop.shopName || "Unnamed shop"}</strong><small>{shop.id}</small></td><td>{shop.ownerEmail || shop.ownerUid || "Not provided"}</td><td>{shop.city || "—"}</td><td><span className={`admin-status ${status}`}>{status}</span></td><td className="admin-actions">{status !== "live" && <button className="admin-primary small" onClick={() => void setShopStatus(shop, "live")}>Approve / LIVE</button>}{status !== "inactive" && <button className="admin-secondary small" onClick={() => void setShopStatus(shop, "inactive")}>Set inactive</button>}{status === "pending" && <button className="admin-secondary small" onClick={() => void setShopStatus(shop, "rejected")}>Reject</button>}</td></tr>; })}</tbody></table></div>}
    </section>
    <p className="admin-footnote">Signed in as verified admin · Shop status changes are protected by Firestore security rules.</p>
  </main>;
}

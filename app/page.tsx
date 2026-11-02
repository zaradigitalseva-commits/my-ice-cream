"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase";
import { isAdminEmail } from "@/lib/admin";

type Shop = { id: string; name?: string; shopName?: string; city?: string; address?: string; description?: string; logoUrl?: string; bannerUrl?: string; category?: string };
const categories = ["All treats", "Ice cream", "Kulfi", "Cones", "Family packs", "Party orders"];

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loadingShops, setLoadingShops] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    let active = true;
    async function loadLiveShops() {
      if (!db) { setLoadingShops(false); return; }
      try {
        const result = await getDocs(query(collection(db, "shops"), where("status", "==", "live")));
        if (active) setShops(result.docs.map((item) => ({ id: item.id, ...item.data() } as Shop)));
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "Shops could not be loaded.");
      } finally {
        if (active) setLoadingShops(false);
      }
    }
    void loadLiveShops();
    return () => { active = false; };
  }, []);

  async function handleAuth() {
    if (!auth) { setMessage("Firebase setup is pending. Please try again later."); return; }
    setBusy(true); setMessage("");
    try { if (user) await signOut(auth); else await signInWithPopup(auth, googleProvider); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Sign-in could not be completed."); }
    finally { setBusy(false); }
  }

  const adminAccount = isAdminEmail(user?.email);
  return <main className="site-shell">
    <header className="topbar">
      <Link className="brand" href="/" aria-label="MY ICE CREAM home"><span className="brand-mark">🍦</span><span>MY ICE CREAM</span></Link>
      <nav className="navlinks" aria-label="Main navigation"><a href="#discover">Discover</a><a href="#shops">For shops</a><a href="#about">About</a></nav>
      <div className="top-actions">
        {user && (adminAccount ? <Link className="account-link" href="/admin">Admin Dashboard</Link> : <Link className="account-link" href="/customer">My Account</Link>)}
        <button className="login-button" onClick={handleAuth} disabled={busy}>{busy ? "Please wait…" : user ? "Sign out" : "Google sign in"}</button>
      </div>
    </header>
    <section className="hero">
      <div><span className="eyebrow">A little happiness, near you</span>
        <h1>Your next<br/>favourite scoop<br/>is waiting.</h1>
        <p className="hero-copy">Discover neighbourhood ice-cream shops, explore delicious treats and find something sweet for every celebration.</p>
        <div className="pills"><span className="pill active">🍨 Discover treats</span><span className="pill">🎉 Party & bulk orders</span><span className="pill">🏪 Local ice-cream shops</span></div>
        <button className="primary-button" onClick={() => document.getElementById("discover")?.scrollIntoView({behavior:"smooth"})}>Explore the marketplace</button>
        <div className="status" aria-live="polite">{user ? <>Signed in as {user.displayName || user.email}{adminAccount ? " · Admin account recognized" : " · Customer account"}</> : message}</div>
      </div>
      <div className="hero-art" aria-label="Ice cream illustration"><div className="icecream-emoji">🍦</div><div className="art-note">Made for every sweet moment ✨</div></div>
    </section>
    <section id="discover">
      <div className="section-head"><div><h2>Find your kind of sweet</h2><p>Browse all approved LIVE shops freely. Login is needed only for account features.</p></div></div>
      <div className="pills">{categories.map((category,index)=><span className={index===0?"pill active":"pill"} key={category}>{category}</span>)}</div>
      <div id="shops" className="shop-list-heading"><h2>LIVE Ice Cream Shops</h2><span>{shops.length} shops</span></div>
      {loadingShops ? <div className="empty-panel"><p>Loading live shops…</p></div> : shops.length === 0 ? <div className="empty-panel"><div className="empty-icon">🏪</div><h3>No LIVE shops yet</h3><p>Approved shops will appear here automatically. You can browse this website without signing in.</p></div> :
        <div className="shop-grid">{shops.map((shop) => <Link href={"/shop/" + shop.id} className="shop-card" key={shop.id}>
          {shop.bannerUrl ? <img className="shop-banner" src={shop.bannerUrl} alt="" /> : <div className="shop-banner shop-banner-placeholder">🍦</div>}
          <div className="shop-card-body"><div className="shop-card-title">{shop.logoUrl ? <img src={shop.logoUrl} alt="" /> : <span>🏪</span>}<h3>{shop.name || shop.shopName || "Ice Cream Shop"}</h3></div>
            <p>{[shop.city, shop.address].filter(Boolean).join(" · ") || "Location not added"}</p>
            {shop.description && <p className="shop-description">{shop.description}</p>}
            {shop.category && <span className="pill">{shop.category}</span>}
          </div>
        </Link>)}</div>}
    </section>
    <section id="for-shops" className="shop-onboarding"><div><p className="eyebrow">For ice cream businesses</p><h2>Bring your shop to MY ICE CREAM</h2><p>Register your shop for free review. Your shop becomes public only after Admin approval.</p></div><Link href="/shop/register" className="primary-button">Register your shop</Link></section>
    <footer className="footer" id="about"><span>© {new Date().getFullYear()} MY ICE CREAM</span><span>Unlimited shops · Sweet moments · Easy ordering</span></footer>
  </main>;
}

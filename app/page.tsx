"use client";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
const categories = ["All treats", "Ice cream", "Kulfi", "Cones", "Family packs", "Party orders"];
export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { if (!auth) return; return onAuthStateChanged(auth, setUser); }, []);
  async function handleAuth() {
    if (!auth) { setMessage("Firebase setup is pending. Add local environment values to connect Google sign-in."); return; }
    setBusy(true); setMessage("");
    try { if (user) await signOut(auth); else await signInWithPopup(auth, googleProvider); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Sign-in could not be completed."); }
    finally { setBusy(false); }
  }
  return <main className="site-shell">
    <header className="topbar">
      <a className="brand" href="/" aria-label="MY ICE CREAM home"><span className="brand-mark">🍦</span><span>MY ICE CREAM</span></a>
      <nav className="navlinks" aria-label="Main navigation"><a href="#discover">Discover</a><a href="#shops">For shops</a><a href="#about">About</a></nav>
      <button className="login-button" onClick={handleAuth} disabled={busy}>{busy ? "Please wait…" : user ? "Sign out" : "Google sign in"}</button>
    </header>
    <section className="hero">
      <div><span className="eyebrow">A little happiness, near you</span>
        <h1>Your next<br/>favourite scoop<br/>is waiting.</h1>
        <p className="hero-copy">Discover neighbourhood ice-cream shops, explore delicious treats and find something sweet for every celebration.</p>
        <div className="pills"><span className="pill active">🍨 Discover treats</span><span className="pill">🎉 Party & bulk orders</span><span className="pill">🏪 Local ice-cream shops</span></div>
        <button className="primary-button" onClick={() => document.getElementById("discover")?.scrollIntoView({behavior:"smooth"})}>Explore the marketplace</button>
        <div className="status" aria-live="polite">{user ? "Signed in as " + (user.displayName || user.email) : message}</div>
      </div>
      <div className="hero-art" aria-label="Ice cream illustration"><div className="icecream-emoji">🍦</div><div className="art-note">Made for every sweet moment ✨</div></div>
    </section>
    <section id="discover"><div className="section-head"><div><h2>Find your kind of sweet</h2><p>Browse freely. Sign in only when you need an account feature.</p></div></div>
      <div className="pills">{categories.map((category,index)=><span className={index===0?"pill active":"pill"} key={category}>{category}</span>)}</div>
      <div className="empty-panel" id="shops"><div className="empty-icon">🏪</div><h3>Your local shops will appear here</h3>
        <p>The marketplace is ready for its next step. Once shop profiles and public product catalogues are connected to the database, customers will be able to discover real shops and their menus here.</p>
        <span className="pill">Shop onboarding coming next</span>
      </div>
    </section>
    <footer className="footer" id="about"><span>© {new Date().getFullYear()} MY ICE CREAM</span><span>Local shops · Sweet moments · Easy ordering</span></footer>
  </main>;
}

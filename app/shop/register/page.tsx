"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, type User } from "firebase/auth";
import { collection, doc, getDocs, query, serverTimestamp, where, writeBatch } from "firebase/firestore/lite";
import { auth, db, googleProvider } from "@/lib/firebase";

export default function ShopRegisterPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { if (!auth) return; return onAuthStateChanged(auth, setUser); }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !db) return;
    setBusy(true); setMessage("");
    try {
      const existing = await getDocs(query(collection(db, "shops"), where("ownerUid", "==", user.uid)));
      if (!existing.empty) { setMessage("A shop registration already exists for this Google account. Open Shop Dashboard to check its status."); return; }
      const shopRef = doc(collection(db, "shops"));
      const lockRef = doc(db, "shopOwnerLocks", user.uid);
      const batch = writeBatch(db);
      batch.set(shopRef, {
        name: name.trim(), shopName: name.trim(), ownerUid: user.uid,
        ownerName: user.displayName || "", ownerEmail: user.email || "",
        phone: phone.trim(), city: city.trim(), address: address.trim(),
        description: description.trim(), status: "pending", createdAt: serverTimestamp()
      });
      batch.set(lockRef, { ownerUid: user.uid, shopId: shopRef.id, createdAt: serverTimestamp() });
      await batch.commit();
      router.replace("/shop?payment=1");
      return;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Registration could not be submitted.");
    } finally { setBusy(false); }
  }

  return <main className="register-page">
    <div className="register-topbar">
      <Link href="/" className="register-back">← Back to marketplace</Link>
      <span className="register-brand"><span>🍦</span> MY ICE CREAM</span>
      <span className="register-top-tag">PARTNER WITH US</span>
    </div>
    <section className="register-hero">
      <div className="register-hero-copy">
        <span className="register-badge">🍨 SHOP PARTNER PROGRAM</span>
        <h1>Apni ice cream shop ko <em>online</em> laayein!</h1>
        <p>Apni shop register karein aur aas-paas ke customers tak pahunch banayein. Details submit karne ke baad Admin approval zaroori hai.</p>
        <div className="register-benefits"><span>✨ First listing ₹599 (first month included)</span><span>📍 Local customers</span><span>💛 Easy order access</span></div>
      </div>
      <div className="register-hero-art" aria-hidden="true"><span className="register-spark spark-one">✦</span><span className="register-spark spark-two">✧</span><div className="register-scoop">🍦</div><div className="register-art-caption">Your shop, more visible!</div></div>
    </section>
    <section className="register-card">
      <div className="register-card-heading"><div><span className="register-step">01 / SHOP DETAILS</span><h2>Register your ice cream shop</h2><p>Bas kuch details bhariye — baaki hum sambhal lenge!</p></div><span className="register-card-icon">🏪</span></div>
      {!user ? <div className="register-signin"><p>Registration shuru karne ke liye apne Google account se sign in karein.</p><button className="register-submit" onClick={() => auth && signInWithPopup(auth, googleProvider).catch((e) => setMessage(e.message))}> <span>G</span> Continue with Google</button></div> :
      <form className="register-form register-form-color" onSubmit={submit}>
        <div className="register-signed-in"> <span>✓</span><div><small>Signed in as</small><strong>{user.email}</strong></div></div>
        <div className="register-fields">
          <label><span>🏷️ Shop name</span><input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sweet Scoops Ice Cream" /></label>
          <label><span>📱 Mobile number</span><input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Your shop contact number" /></label>
          <label><span>📍 City</span><input required value={city} onChange={(e) => setCity(e.target.value)} placeholder="Your city" /></label>
          <label className="register-field-wide"><span>🗺️ Full address</span><input required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Shop number, area, landmark..." /></label>
          <label className="register-field-wide"><span>💬 About your shop <small>(optional)</small></span><textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tell customers what makes your ice cream special..." rows={3} /></label>
        </div>
        <button className="register-submit" disabled={busy}>{busy ? "Submitting…" : "Continue to ₹599 payment  →"}</button>
        <p className="register-approval-note">🔒 पहली बार ₹599 में listing, Admin approval और पहला महीना शामिल है। इसके बाद renewal ₹299/month होगा। Shop payment verification के बाद ही LIVE होगी।</p>
      </form>}
      {message && <p className="admin-success register-message" role="status">{message}</p>}
    </section>
    <footer className="register-footer">Made with <span>♥</span> for ice cream lovers <b>🍦</b></footer>
  </main>;
}

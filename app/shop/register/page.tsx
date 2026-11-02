"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, type User } from "firebase/auth";
import { collection, doc, getDocs, query, serverTimestamp, where, writeBatch } from "firebase/firestore/lite";
import { auth, db, googleProvider } from "@/lib/firebase";

export default function ShopRegisterPage() {
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
      setMessage("Registration submitted. Your shop is PENDING until Admin reviews and approves it.");
      setName(""); setPhone(""); setCity(""); setAddress(""); setDescription("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Registration could not be submitted.");
    } finally { setBusy(false); }
  }

  return <main className="admin-wrap">
    <Link href="/" className="admin-back">← Back to marketplace</Link>
    <section className="admin-panel register-panel">
      <p className="admin-kicker">SHOP ONBOARDING</p><h1>Register your ice cream shop</h1>
      <p>Sign in with Google and submit your shop details. Your shop will become visible to customers only after Admin approval.</p>
      {!user ? <button className="admin-primary" onClick={() => auth && signInWithPopup(auth, googleProvider).catch((e) => setMessage(e.message))}>Continue with Google</button> :
      <form className="register-form" onSubmit={submit}>
        <p className="admin-muted">Signed in as {user.email}</p>
        <label>Shop name<input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your shop name" /></label>
        <label>Mobile number<input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Shop contact number" /></label>
        <label>City<input required value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" /></label>
        <label>Full address<input required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Shop address" /></label>
        <label>About your shop<textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description (optional)" rows={3} /></label>
        <button className="admin-primary" disabled={busy}>{busy ? "Submitting…" : "Submit for Admin Approval"}</button>
      </form>}
      {message && <p className="admin-success" role="status">{message}</p>}
    </section>
  </main>;
}

"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, type User } from "firebase/auth";
import { collection, doc, getDocs, query, serverTimestamp, where, writeBatch } from "firebase/firestore/lite";
import { auth, db, googleProvider } from "@/lib/firebase";

async function compressImage(file: File, maxWidth: number, maxHeight: number, maxBytes: number): Promise<string> {
  const source = await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image could not be opened.")); };
    image.src = url;
  });
  const scale = Math.min(1, maxWidth / source.width, maxHeight / source.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image compression is not supported in this browser.");
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  let quality = 0.82;
  let result = canvas.toDataURL("image/webp", quality);
  while (result.length * 0.75 > maxBytes && quality > 0.35) {
    quality -= 0.08;
    result = canvas.toDataURL("image/webp", quality);
  }
  if (result.length * 0.75 > maxBytes) throw new Error("Image is too large. Please choose a smaller image.");
  return result;
}

export default function ShopRegisterPage() {
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [imageBusy, setImageBusy] = useState<"logo" | "banner" | "">("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { if (!auth) return; return onAuthStateChanged(auth, setUser); }, []);

  async function chooseImage(file: File | undefined, kind: "logo" | "banner") {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setMessage("कृपया PNG, JPG या WebP image चुनें।"); return; }
    setImageBusy(kind); setMessage("");
    try {
      const data = await compressImage(file, kind === "logo" ? 500 : 1200, kind === "logo" ? 500 : 650, kind === "logo" ? 90 * 1024 : 220 * 1024);
      if (kind === "logo") setLogoUrl(data); else setBannerUrl(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Image upload could not be completed.");
    } finally { setImageBusy(""); }
  }

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
        description: description.trim(), logoUrl, bannerUrl,
        status: "pending", createdAt: serverTimestamp()
      });
      batch.set(lockRef, { ownerUid: user.uid, shopId: shopRef.id, createdAt: serverTimestamp() });
      await batch.commit();
      setMessage("Registration submitted. Your shop is PENDING until Admin reviews and approves it.");
      setName(""); setPhone(""); setCity(""); setAddress(""); setDescription(""); setLogoUrl(""); setBannerUrl("");
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
        <div className="register-benefits"><span>✨ Free shop listing</span><span>📍 Local customers</span><span>💛 Easy order access</span></div>
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
          <div className="register-field-wide register-image-fields">
            <label><span>🖼️ Shop logo <small>(optional)</small></span><input type="file" accept="image/png,image/jpeg,image/webp" disabled={!!imageBusy || busy} onChange={(e) => void chooseImage(e.target.files?.[0], "logo")} />{imageBusy === "logo" && <small>Logo compress ho raha hai…</small>}{logoUrl && <img className="register-image-preview" src={logoUrl} alt="Shop logo preview" />} {logoUrl && <button type="button" className="admin-secondary small" onClick={() => setLogoUrl("")}>Logo remove</button>}</label>
            <label><span>🌄 Shop banner <small>(optional)</small></span><input type="file" accept="image/png,image/jpeg,image/webp" disabled={!!imageBusy || busy} onChange={(e) => void chooseImage(e.target.files?.[0], "banner")} />{imageBusy === "banner" && <small>Banner compress ho raha hai…</small>}{bannerUrl && <img className="register-image-preview register-banner-preview" src={bannerUrl} alt="Shop banner preview" />} {bannerUrl && <button type="button" className="admin-secondary small" onClick={() => setBannerUrl("")}>Banner remove</button>}</label>
            <small>Images automatically WebP mein compress hongi. Logo max 90 KB aur banner max 220 KB. Firebase Storage ki zaroorat nahi.</small>
          </div>
        </div>
        <button className="register-submit" disabled={busy || !!imageBusy}>{busy ? "Submitting…" : "Submit for Admin Approval  →"}</button>
        <p className="register-approval-note">🔒 Your shop will be visible to customers only after Admin approval.</p>
      </form>}
      {message && <p className="admin-success register-message" role="status">{message}</p>}
    </section>
    <footer className="register-footer">Made with <span>♥</span> for ice cream lovers <b>🍦</b></footer>
  </main>;
}

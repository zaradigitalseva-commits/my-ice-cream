"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, type User } from "firebase/auth";
import { collection, doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore/lite";
import { auth, db, googleProvider } from "@/lib/firebase";
import { compressImageToWebP } from "@/lib/image-compression";

export default function ShopRegisterPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [existingShop, setExistingShop] = useState<{ id: string; name?: string; shopName?: string; status?: string; city?: string } | null>(null);
  const [checkingRegistration, setCheckingRegistration] = useState(true);
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
  useEffect(() => { if (!auth) { setCheckingRegistration(false); return; } return onAuthStateChanged(auth, setUser); }, []);

  useEffect(() => {
    let cancelled = false;
    async function checkExistingRegistration() {
      if (!user || !db) { setExistingShop(null); setCheckingRegistration(false); return; }
      setCheckingRegistration(true);
      try {
        const lock = await getDoc(doc(db, "shopOwnerLocks", user.uid));
        if (cancelled) return;
        const shopId = lock.exists() ? String(lock.data().shopId || "") : "";
        const found = shopId ? await getDoc(doc(db, "shops", shopId)) : null;
        if (found?.exists()) {
          const data = { id: found.id, ...found.data() } as { id: string; name?: string; shopName?: string; status?: string; city?: string };
          const status = (data.status || "pending").toLowerCase();
          if (status === "live") { router.replace("/shop"); return; }
          setExistingShop(data);
        } else setExistingShop(null);
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Registration status could not be checked.");
      } finally {
        if (!cancelled) setCheckingRegistration(false);
      }
    }
    void checkExistingRegistration();
    return () => { cancelled = true; };
  }, [user, router]);

  async function chooseImage(file: File | undefined, kind: "logo" | "banner") {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setMessage("कृपया PNG, JPG या WebP image चुनें।"); return; }
    setImageBusy(kind); setMessage("");
    try {
      const data = await compressImageToWebP(file, { maxDimension: kind === "logo" ? 500 : 1200, maxBytes: kind === "logo" ? 90 * 1024 : 220 * 1024, initialQuality: 0.84 });
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
      const existingLock = await getDoc(doc(db, "shopOwnerLocks", user.uid));
      const existingShopId = existingLock.exists() ? String(existingLock.data().shopId || "") : "";
      const found = existingShopId ? await getDoc(doc(db, "shops", existingShopId)) : null;
      if (found?.exists()) {
        const data = { id: found.id, ...found.data() } as { id: string; name?: string; shopName?: string; status?: string; city?: string };
        if ((data.status || "pending").toLowerCase() === "live") { router.replace("/shop"); return; }
        setExistingShop(data);
        setMessage("Aapki purani registration mil gayi. Neeche status dekhein ya details edit karein.");
        return;
      }
      const shopRef = doc(collection(db, "shops"));
      const lockRef = doc(db, "shopOwnerLocks", user.uid);
      const batch = writeBatch(db);
      batch.set(shopRef, {
        name: name.trim(), shopName: name.trim(),
        phone: phone.trim(), city: city.trim(), address: address.trim(),
        description: description.trim(), logoUrl, bannerUrl,
        status: "pending", createdAt: serverTimestamp()
      });
      batch.set(doc(db, "shopPrivate", shopRef.id), {
        shopId: shopRef.id, ownerUid: user.uid,
        ownerName: user.displayName || "", ownerEmail: user.email || "",
        createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
      batch.set(lockRef, { ownerUid: user.uid, shopId: shopRef.id, createdAt: serverTimestamp() });
      await batch.commit();
      router.replace("/shop?payment=1");
      return;
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
        <p>Apni shop register karein aur aas-paas ke customers tak pahunch banayein. पहली listing ₹599 (पहला महीना शामिल) है। उसके बाद renewal ₹299 प्रति माह है। UPI UTR जमा करें; Admin payment verify करने के बाद दुकान LIVE होगी।</p>
        <div className="register-benefits"><span>✨ पहली listing ₹599</span><span>📍 पहला महीना शामिल</span><span>💛 Renewal ₹299/माह</span></div>
      </div>
      <div className="register-hero-art" aria-hidden="true"><span className="register-spark spark-one">✦</span><span className="register-spark spark-two">✧</span><div className="register-scoop">🍦</div><div className="register-art-caption">Your shop, more visible!</div></div>
    </section>
    <section className="register-card">
      <div className="register-card-heading"><div><span className="register-step">01 / SHOP DETAILS</span><h2>Register your ice cream shop</h2><p>Bas kuch details bhariye — baaki hum sambhal lenge!</p></div><span className="register-card-icon">🏪</span></div>
      {!user ? <div className="register-signin"><p>Registration shuru karne ke liye apne Google account se sign in karein.</p><button className="register-submit" onClick={() => auth && signInWithPopup(auth, googleProvider).catch((e) => setMessage(e.message))}> <span>G</span> Continue with Google</button></div> :
      checkingRegistration ? <div className="register-signin"><p>Aapki purani shop registration check ho rahi hai…</p></div> :
      existingShop ? <div className="register-signin register-existing-status">
        <div className="register-signed-in"><span>✓</span><div><small>Existing registration</small><strong>{existingShop.name || existingShop.shopName || "Your shop"}</strong></div></div>
        <h3>Registration status</h3>
        <p><strong className={"admin-status " + ((existingShop.status || "pending").toLowerCase())}>{(existingShop.status || "pending").toUpperCase()}</strong></p>
        <p>{(existingShop.status || "pending").toLowerCase() === "rejected"
          ? "Aapki registration reject hui hai. Zaroori details sudharne ke liye edit karein ya Admin se sampark karein."
          : (existingShop.status || "pending").toLowerCase() === "inactive"
            ? "Aapki shop filhaal inactive hai. Admin se sampark karein."
            : "Aapki shop registration save hai. Pehle ₹599 listing payment karein aur UTR submit karein; Admin payment verify karke final shop approval ke baad shop LIVE karega."}</p>
        <div className="register-status-actions">
          <Link href="/shop#shop-profile" className="admin-primary role-link">✏️ Edit registration details</Link>
          <Link href="/shop?payment=1" className="admin-secondary role-link">Open payment & registration status →</Link>
        </div>
      </div> :
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
        <button className="register-submit" disabled={busy || !!imageBusy}>{busy ? "Submitting…" : "Register & Continue to Payment  →"}</button>
        <p className="register-approval-note">🔒 Registration के बाद ₹599 payment करें। UTR submit और Admin verification के बाद shop approval होगा; तभी दुकान LIVE होगी.</p>
      </form>}
      {message && <p className="admin-success register-message" role="status">{message}</p>}
    </section>
    <footer className="register-footer">Made with <span>♥</span> for ice cream lovers <b>🍦</b></footer>
  </main>;
}

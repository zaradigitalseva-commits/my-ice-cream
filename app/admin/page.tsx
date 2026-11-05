"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { collection, getDocs, orderBy, query, updateDoc, doc, Timestamp, getDoc, setDoc } from "firebase/firestore/lite";
import { auth, db, googleProvider } from "@/lib/firebase";
import { isAdminEmail } from "@/lib/admin";

type Shop = { id: string; name?: string; shopName?: string; ownerName?: string; ownerEmail?: string; ownerUid?: string; status?: string; phone?: string; mobile?: string; mobileNumber?: string; city?: string; address?: string; fullAddress?: string; shopAddress?: string; location?: string; landmark?: string; description?: string; about?: string; subscriptionStatus?: string; subscriptionExpiresAt?: Timestamp; adminActivated?: boolean; createdAt?: Timestamp | Date | string };

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [shops, setShops] = useState<Shop[]>([]);
  const [customers, setCustomers] = useState<{id:string;name?:string;phone?:string;email?:string;uid?:string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [customerError, setCustomerError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [siteLogo, setSiteLogo] = useState("");
  const [logoBusy, setLogoBusy] = useState(false);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);

  useEffect(() => {
    if (!auth) { setAuthReady(true); setError("Firebase configuration is missing."); return; }
    return onAuthStateChanged(auth, (nextUser) => { setUser(nextUser); setAuthReady(true); });
  }, []);

  async function loadShops() {
    if (!db || !user || !isAdminEmail(user.email) || !user.emailVerified) return;
    setLoading(true); setError(""); setCustomerError(""); setNotice("");
    try {
      await user.getIdToken(true);
      const result = await getDocs(query(collection(db, "shops"), orderBy("createdAt", "desc")));
      setShops(result.docs.map((item) => ({ id: item.id, ...item.data() } as Shop)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "दुकानों की सूची लोड नहीं हो सकी।");
      setLoading(false);
      return;
    }
    try {
      const customerResult = await getDocs(collection(db, "customers"));
      setCustomers(customerResult.docs.map((item) => ({ id: item.id, ...item.data() } as {id:string;name?:string;phone?:string;email?:string;uid?:string})));
      setCustomerError("");
    } catch (err) {
      setCustomers([]);
      setCustomerError(err instanceof Error ? err.message : "ग्राहकों की सूची पढ़ने की अनुमति नहीं है।");
    } finally { setLoading(false); }
  }

  useEffect(() => { if (user && isAdminEmail(user.email) && user.emailVerified) void loadShops(); }, [user]);

  useEffect(() => {
    if (!db || !user || !isAdminEmail(user.email) || !user.emailVerified) return;
    getDoc(doc(db, "siteSettings", "branding")).then((snapshot) => {
      if (snapshot.exists()) setSiteLogo(String(snapshot.data().logoDataUrl || ""));
    }).catch((err) => setError(err instanceof Error ? err.message : "Logo load failed."));
  }, [user]);

  async function saveSiteLogo(file?: File) {
    if (!db) return;
    setLogoBusy(true); setError(""); setNotice("");
    try {
      let logoDataUrl = "";
      if (file) {
        if (!file.type.startsWith("image/")) throw new Error("कृपया image file चुनें।");
        const source = await createImageBitmap(file);
        const scale = Math.min(1, 900 / source.width, 900 / source.height);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(source.width * scale));
        canvas.height = Math.max(1, Math.round(source.height * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Image process नहीं हो पाई।");
        context.drawImage(source, 0, 0, canvas.width, canvas.height);
        logoDataUrl = canvas.toDataURL("image/webp", 0.78);
        if (logoDataUrl.length > 850000) throw new Error("Logo बहुत बड़ा है। छोटी image चुनें।");
      }
      await setDoc(doc(db, "siteSettings", "branding"), { logoDataUrl, updatedAt: new Date() }, { merge: true });
      setSiteLogo(logoDataUrl);
      setNotice(file ? "वेबसाइट का लोगो सेव हो गया।" : "वेबसाइट का लोगो हटा दिया गया।");
    } catch (err) { setError(err instanceof Error ? err.message : "Logo save नहीं हो पाया।"); }
    finally { setLogoBusy(false); }
  }

  async function setShopStatus(shop: Shop, status: "live" | "inactive" | "pending" | "rejected") {
    if (!db) return;
    setNotice(""); setError("");
    try {
      // Platform admins may publish any shop without a customer payment.
      // The explicit flag is also checked by Firestore rules for public visibility.
      await updateDoc(doc(db, "shops", shop.id), {
        status,
        ...(status === "live" ? { adminActivated: true, adminActivatedBy: user?.email || "", adminActivatedAt: new Date() } : {}),
        updatedAt: new Date()
      });
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
  const rejected = shops.filter((shop) => (shop.status || "").toLowerCase() === "rejected").length;
  const visibleShops = shops.filter((shop) => {
    const status = (shop.status || "pending").toLowerCase();
    const term = search.trim().toLowerCase();
    const matchesStatus = statusFilter === "all" || status === statusFilter;
    const matchesSearch = !term || [shop.name, shop.shopName, shop.ownerName, shop.ownerEmail, shop.phone, shop.mobile, shop.mobileNumber, shop.city, shop.address, shop.fullAddress, shop.shopAddress, shop.location, shop.landmark, shop.id].some((value) => String(value || "").toLowerCase().includes(term));
    return matchesStatus && matchesSearch;
  });

  return <main className="admin-wrap">
    <header className="admin-header"><Link href="/" className="admin-brand">🍦 MY ICE CREAM <span>ADMIN</span></Link><div className="admin-user"><span>{user.displayName || user.email}</span><button className="admin-secondary" onClick={() => auth && signOut(auth)}>Sign out</button></div></header>
    <div className="admin-heading"><div><p className="admin-kicker">PLATFORM CONTROL</p><h1>Admin dashboard</h1><p>Review shop registrations and control which shops are visible to customers.</p></div><button className="admin-secondary" onClick={() => void loadShops()} disabled={loading}>↻ Refresh</button></div>
    <div className="admin-actions"><Link href="/admin/payments" className="admin-primary">Subscription payments</Link></div>
    <section className="admin-panel site-logo-settings"><div className="admin-panel-head"><div><h2>Website logo</h2><p>यह लोगो वेबसाइट के नाम की जगह सभी ग्राहकों को दिखेगा।</p></div></div>
      <div className="site-logo-editor">{siteLogo ? <img src={siteLogo} alt="Current website logo" /> : <div className="site-logo-empty">🍦 MY ICE CREAM</div>}
        <label className="admin-primary small">{pendingLogoFile ? "दूसरा लोगो चुनें" : "नया लोगो चुनें"}<input type="file" accept="image/*" disabled={logoBusy} hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) { setPendingLogoFile(file); setNotice(""); setError(""); } event.currentTarget.value = ""; }} /></label>
        {pendingLogoFile && <button className="admin-primary small" disabled={logoBusy} onClick={() => { void saveSiteLogo(pendingLogoFile).then(() => setPendingLogoFile(null)); }}>{logoBusy ? "सेव हो रहा है…" : "लोगो सेव करें"}</button>}
        {pendingLogoFile && <button className="admin-secondary small" disabled={logoBusy} onClick={() => setPendingLogoFile(null)}>रद्द करें</button>}
        {siteLogo && <button className="admin-secondary small" disabled={logoBusy} onClick={() => { void saveSiteLogo().then(() => setPendingLogoFile(null)); }}>लोगो हटाएँ</button>}
      </div><small className="admin-muted">PNG, JPG या WebP image चुनें, फिर “लोगो सेव करें” दबाएँ। लोगो अपने-आप छोटा करके सेव होगा।</small>
    </section><section className="admin-stats"><article><span>Total shops</span><strong>{shops.length}</strong></article><article><span>Awaiting review</span><strong>{pending}</strong></article><article><span>Live shops</span><strong>{live}</strong></article><article><span>Inactive shops</span><strong>{inactive}</strong></article><article><span>Rejected shops</span><strong>{rejected}</strong></article></section>
    {error && <p className="admin-error" role="alert">{error}</p>}{notice && <p className="admin-success" role="status">{notice}</p>}
    <section className="admin-panel"><div className="admin-panel-head"><div><h2>Registered customers</h2><p>सभी ग्राहक रिकॉर्ड — ऐप से जुड़े और दुकानदार द्वारा बनाए गए।</p></div><span className="admin-count">{customers.length} customers</span></div>
      {customerError && <p className="admin-error" role="alert">ग्राहक सूची लोड नहीं हुई: {customerError} · Firebase Console में सही Firestore Rules प्रकाशित हैं या नहीं जाँचें। दुकानें और बाकी Admin dashboard इससे अलग काम करते रहेंगे।</p>}<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>नाम</th><th>मोबाइल</th><th>ईमेल</th><th>स्थिति</th></tr></thead><tbody>{customers.map((customer)=><tr key={customer.id}><td>{customer.name||"—"}</td><td>{customer.phone||customer.id}</td><td>{customer.email||"—"}</td><td>{customer.uid?"App account linked":"Shop-created record"}</td></tr>)}</tbody></table></div></section>
    <section className="admin-panel"><div className="admin-panel-head"><div><h2>Shop registrations</h2><p>New shops should be reviewed before being made public.</p></div><span className="admin-count">{visibleShops.length} / {shops.length} shops</span></div>
      <div className="admin-filters"><label>Search shops<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Shop, owner, mobile, city or ID…" /></label><label>Filter by status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="live">Live</option><option value="inactive">Inactive</option><option value="rejected">Rejected</option></select></label></div>
      {loading ? <p className="admin-muted">Loading shops…</p> : shops.length === 0 ? <div className="admin-empty"><span>🏪</span><h3>No shop registrations yet</h3><p>When a shop registration is saved to the Firestore <code>shops</code> collection, it will appear here for review.</p></div> :
      visibleShops.length === 0 ? <div className="admin-empty"><span>🔎</span><h3>No matching shops</h3><p>Search ya status filter badal kar dobara dekhein.</p><button className="admin-secondary" onClick={() => { setSearch(""); setStatusFilter("all"); }}>Clear filters</button></div> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Shop details</th><th>Owner details</th><th>Contact & address</th><th>Status</th><th>Actions</th></tr></thead><tbody>{visibleShops.map((shop) => { const status = (shop.status || "pending").toLowerCase(); return <tr key={shop.id}><td><strong>{shop.name || shop.shopName || "Unnamed shop"}</strong><small>ID: {shop.id}</small><small>{shop.description || shop.about || "Shop description not provided"}</small></td><td><strong>{shop.ownerName || "Name not provided"}</strong><small>{shop.ownerEmail || "Email not provided"}</small><small>UID: {shop.ownerUid || "—"}</small></td><td className="admin-contact-cell"><strong>📱 {shop.phone || shop.mobile || shop.mobileNumber || "Mobile not provided"}</strong><div className="admin-address"><b>📍 Shop address</b><span>{[shop.address, shop.fullAddress, shop.shopAddress, shop.location].find((value) => value?.trim()) || "Full address not provided by shop owner"}</span><small>City: {shop.city || "Not provided"}{shop.landmark ? ` · Landmark: ${shop.landmark}` : ""}</small></div></td><td><span className={"admin-status " + status}>{status}</span><small>Subscription: {shop.subscriptionStatus || "not active"}</small>{shop.subscriptionExpiresAt && <small>Expires: {shop.subscriptionExpiresAt.toDate().toLocaleDateString("en-IN")}</small>}</td><td className="admin-actions">{status !== "live" && <button className="admin-primary small" onClick={() => void setShopStatus(shop, "live")}>Activate without payment</button>}{status !== "inactive" && <button className="admin-secondary small" onClick={() => void setShopStatus(shop, "inactive")}>Pause shop</button>}{status === "pending" && <button className="admin-secondary small" onClick={() => void setShopStatus(shop, "rejected")}>Reject</button>}</td></tr>; })}</tbody></table></div>}
    </section>
    <p className="admin-footnote">Signed in as verified admin · Admins can activate any shop without payment; this is recorded as an admin override. Status changes are protected by Firestore security rules.</p>
  </main>;
}

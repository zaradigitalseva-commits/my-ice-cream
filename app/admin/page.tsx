"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { collection, collectionGroup, getDocs, orderBy, query, updateDoc, doc, Timestamp, getDoc, setDoc, where, writeBatch, deleteDoc, limit } from "firebase/firestore/lite";
import { auth, db, googleProvider } from "@/lib/firebase";
import { isAdminEmail } from "@/lib/admin";
import { compressImageToWebP } from "@/lib/image-compression";

type Shop = { id: string; name?: string; shopName?: string; ownerName?: string; ownerEmail?: string; ownerUid?: string; status?: string; subscriptionStatus?: string; subscriptionExpiresAt?: Timestamp | Date | string; phone?: string; mobile?: string; mobileNumber?: string; city?: string; address?: string; fullAddress?: string; shopAddress?: string; location?: string; landmark?: string; description?: string; about?: string; createdAt?: Timestamp | Date | string };
type AdminProduct = { id: string; shopId: string; shopName: string; name?: string; price?: number; category?: string; active?: boolean };
type AdminAnnouncement = { id: string; title?: string; body?: string; type?: string; createdAt?: Timestamp };
type ShopDashboardNotice = { id: string; shopId: string; title?: string; body?: string; createdAt?: Timestamp };

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopPayments, setShopPayments] = useState<Record<string, { utr?: string; amount?: number; status?: string; paymentType?: string }>>({});
  const [shopProducts, setShopProducts] = useState<AdminProduct[]>([]);
  const [productError, setProductError] = useState("");
  const [customers, setCustomers] = useState<{id:string;name?:string;phone?:string;email?:string;uid?:string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [customerError, setCustomerError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [siteLogo, setSiteLogo] = useState("");
  const [logoError, setLogoError] = useState("");
  const [logoBusy, setLogoBusy] = useState(false);
  const [deletingShopId, setDeletingShopId] = useState("");
  const [deletingProductId, setDeletingProductId] = useState("");
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [siteQr, setSiteQr] = useState("");
  const [pendingQrFile, setPendingQrFile] = useState<File | null>(null);
  const [qrBusy, setQrBusy] = useState(false);
  const [activeAdminSection, setActiveAdminSection] = useState<"overview" | "settings" | "paymentQr" | "customers" | "products" | "registrations" | "announcements" | "shopNotices">("registrations");
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [announcementBusy, setAnnouncementBusy] = useState(false);
  const [adminAnnouncements, setAdminAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [deletingAnnouncementId, setDeletingAnnouncementId] = useState("");
  const [shopNoticeTitle, setShopNoticeTitle] = useState("");
  const [shopNoticeBody, setShopNoticeBody] = useState("");
  const [shopNoticeBusy, setShopNoticeBusy] = useState(false);
  const [shopDashboardNotices, setShopDashboardNotices] = useState<ShopDashboardNotice[]>([]);
  const [deletingShopNoticeId, setDeletingShopNoticeId] = useState("");

  useEffect(() => {
    if (!auth) { setAuthReady(true); setError("Firebase configuration is missing."); return; }
    return onAuthStateChanged(auth, (nextUser) => { setUser(nextUser); setAuthReady(true); if (nextUser && isAdminEmail(nextUser.email) && nextUser.emailVerified) { void loadAdminAnnouncements(); void loadShopDashboardNotices(); } });
  }, []);

  async function loadAdminAnnouncements() {
    if (!db) return;
    try {
      // Avoid a composite Firestore index requirement for the Admin post list.
      const result = await getDocs(query(collection(db, "notifications"), where("type", "==", "admin")));
      const rows = result.docs.map((item) => ({ id: item.id, ...item.data() } as AdminAnnouncement));
      rows.sort((a, b) => (b.createdAt?.toDate?.().getTime() || 0) - (a.createdAt?.toDate?.().getTime() || 0));
      setAdminAnnouncements(rows.slice(0, 30));
    } catch (err) {
      setError(err instanceof Error ? "पोस्ट सूची लोड नहीं हुई: " + err.message : "पोस्ट सूची लोड नहीं हुई।");
    }
  }

  async function deleteAdminAnnouncement(item: AdminAnnouncement) {
    if (!db || !item.id || !window.confirm("क्या आप यह पोस्ट वेबसाइट और पोस्ट सूची से हटाना चाहते हैं? पहले भेजी गई फोन notification वापस नहीं ली जा सकती।")) return;
    setDeletingAnnouncementId(item.id); setError(""); setNotice("");
    try {
      await deleteDoc(doc(db, "notifications", item.id));
      setAdminAnnouncements((current) => current.filter((post) => post.id !== item.id));
      setNotice("पोस्ट वेबसाइट से हटा दी गई। पहले भेजी गई फोन notification वापस नहीं ली जा सकती।");
    } catch (err) {
      setError(err instanceof Error ? "पोस्ट हट नहीं पाई: " + err.message : "पोस्ट हट नहीं पाई। Firebase Firestore Rules प्रकाशित हैं या नहीं जाँचें।");
    } finally { setDeletingAnnouncementId(""); }
  }

  async function loadShops() {
    if (!db || !user || !isAdminEmail(user.email) || !user.emailVerified) return;
    const firestore = db;
    setLoading(true); setError(""); setNotice("");
    try {
      // Refresh the Firebase ID token so Firestore Rules receive current
      // email_verified claims after a user verifies their Google account.
      const token = await user.getIdTokenResult(true);
      if (token.claims.email_verified !== true) {
        throw new Error("Firebase token is not marked email-verified. Sign out and sign in again, then retry.");
      }
      const result = await getDocs(query(collection(firestore, "shops"), orderBy("createdAt", "desc")));
      const loadedShops = result.docs.map((item) => ({ id: item.id, ...item.data() } as Shop));
      setShops(loadedShops);
      // Load payment records and UTR reservations for the main registrations table.
      // Keep this separate so a payment-read issue does not hide shop registrations.
      try {
        const [paymentResult, reservationResult] = await Promise.all([
          getDocs(collection(firestore, "subscriptionPayments")),
          getDocs(collection(firestore, "utrReservations")),
        ]);
        const paymentMap: Record<string, { utr?: string; amount?: number; status?: string; paymentType?: string }> = {};
        for (const paymentDoc of paymentResult.docs) {
          const payment = paymentDoc.data();
          if (typeof payment.shopId !== "string") continue;
          paymentMap[payment.shopId] = {
            utr: typeof payment.utr === "string" ? payment.utr : undefined,
            amount: typeof payment.amount === "number" ? payment.amount : undefined,
            status: typeof payment.status === "string" ? payment.status : "pending",
            paymentType: typeof payment.paymentType === "string" ? payment.paymentType : undefined,
          };
        }
        for (const reservationDoc of reservationResult.docs) {
          const reservation = reservationDoc.data();
          if (typeof reservation.shopId !== "string") continue;
          const previous = paymentMap[reservation.shopId] || {};
          paymentMap[reservation.shopId] = {
            ...previous,
            utr: previous.utr || reservationDoc.id,
            status: previous.status || "UTR reserved · payment record missing",
          };
        }
        setShopPayments(paymentMap);
      } catch (paymentLoadErr) {
        setShopPayments({});
        setProductError(paymentLoadErr instanceof Error ? "Payment / UTR records could not be loaded: " + paymentLoadErr.message : "Payment / UTR records could not be loaded.");
      }
      // Admin can inspect every shop's product records, including inactive products.
      // A product-read issue is isolated so shop registration management still works.
      try {
        const productGroups = await Promise.all(loadedShops.map(async (shop) => {
          const productsResult = await getDocs(collection(firestore, "shops", shop.id, "products"));
          return productsResult.docs.map((item) => ({
            id: item.id,
            shopId: shop.id,
            shopName: shop.name || shop.shopName || shop.id,
            ...item.data(),
          } as AdminProduct));
        }));
        setShopProducts(productGroups.flat());
        setProductError("");
      } catch (productLoadErr) {
        setShopProducts([]);
        setProductError(productLoadErr instanceof Error ? productLoadErr.message : "Product records could not be loaded.");
      }
    } catch (err) {
      setError(err instanceof Error ? `Shops load failed: ${err.message}` : "Could not load shops. Check Firestore rules and database setup.");
      setLoading(false);
      return;
    }
    // Customer records are optional for the shop-review workflow. A customer
    // permission problem must not make the entire admin dashboard look broken.
    try {
      const customerResult = await getDocs(collection(db, "customers"));
      setCustomers(customerResult.docs.map((item) => ({ id: item.id, ...item.data() } as {id:string;name?:string;phone?:string;email?:string;uid?:string})));
      setCustomerError("");
    } catch (err) {
      setCustomers([]);
      setCustomerError(err instanceof Error ? err.message : "Customer records could not be loaded.");
    } finally { setLoading(false); }
  }

  useEffect(() => { if (user && isAdminEmail(user.email) && user.emailVerified) void loadShops(); }, [user]);

  useEffect(() => {
    if (!db || !user || !isAdminEmail(user.email) || !user.emailVerified) return;
    getDoc(doc(db, "siteSettings", "branding")).then((snapshot) => {
      if (snapshot.exists()) { setSiteLogo(String(snapshot.data().logoDataUrl || "")); setSiteQr(String(snapshot.data().upiQrDataUrl || "")); }
    }).catch((err) => setLogoError(err instanceof Error ? err.message : "Logo load failed."));
  }, [user]);

  async function saveSiteLogo(file?: File) {
    if (!db) return;
    setLogoBusy(true); setError(""); setNotice("");
    try {
      let logoDataUrl = "";
      if (file) {
        logoDataUrl = await compressImageToWebP(file, { maxDimension: 900, maxBytes: 180 * 1024, initialQuality: 0.84 });
      }
      await setDoc(doc(db, "siteSettings", "branding"), { logoDataUrl, updatedAt: new Date() }, { merge: true });
      setSiteLogo(logoDataUrl);
      setNotice(file ? "वेबसाइट का लोगो सेव हो गया।" : "वेबसाइट का लोगो हटा दिया गया।");
    } catch (err) { setError(err instanceof Error ? err.message : "Logo save नहीं हो पाया।"); }
    finally { setLogoBusy(false); }
  }

  async function saveUpiQr(file?: File) {
    if (!db || !user || !isAdminEmail(user.email) || !user.emailVerified) {
      setError("केवल verified Admin UPI QR बदल सकता है।");
      return;
    }
    if (!file && siteQr && !window.confirm("क्या आप मौजूदा UPI QR हटाना चाहते हैं?")) return;
    setQrBusy(true); setError(""); setNotice("");
    try {
      let upiQrDataUrl = "";
      if (file) {
        upiQrDataUrl = await compressImageToWebP(file, { maxDimension: 700, maxBytes: 120 * 1024, initialQuality: 0.86 });
      }
      await setDoc(doc(db, "siteSettings", "branding"), { upiQrDataUrl, upiQrUpdatedAt: new Date(), updatedAt: new Date() }, { merge: true });
      setSiteQr(upiQrDataUrl);
      setNotice(file ? "Admin UPI QR Code सेव हो गया।" : "UPI QR Code हटा दिया गया।");
    } catch (err) { setError(err instanceof Error ? err.message : "UPI QR Code सेव नहीं हो पाया।"); }
    finally { setQrBusy(false); }
  }

  function hasValidSubscription(shop: Shop) {
    const value = shop.subscriptionExpiresAt;
    const expiry = value instanceof Timestamp ? value.toDate() : value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
    return shop.subscriptionStatus === "active" && Boolean(expiry && !Number.isNaN(expiry.getTime()) && expiry.getTime() > Date.now());
  }

  async function setShopStatus(shop: Shop, status: "live" | "inactive" | "pending" | "rejected") {
    if (!db) return;
    setNotice(""); setError("");
    try {
      if (status === "live") {
        const expiryValue = shop.subscriptionExpiresAt;
        const expiry = expiryValue instanceof Timestamp ? expiryValue.toDate() : expiryValue instanceof Date ? expiryValue : typeof expiryValue === "string" ? new Date(expiryValue) : null;
        if (shop.subscriptionStatus !== "active" || !expiry || Number.isNaN(expiry.getTime()) || expiry.getTime() <= Date.now()) {
          throw new Error("इस दुकान की subscription active नहीं है या expire हो चुकी है। पहले Subscription payment verify/renew करें।");
        }
      }
      const changes = { status, updatedAt: new Date() };
      await updateDoc(doc(db, "shops", shop.id), changes);
      setShops((current) => current.map((item) => item.id === shop.id ? { ...item, status } : item));
      setNotice(`${shop.name || shop.shopName || "Shop"} status changed to ${status.toUpperCase()}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update shop status.");
    }
  }

  async function toggleProductVisibility(product: AdminProduct) {
    if (!db) return;
    const nextActive = product.active !== true;
    setError(""); setNotice("");
    try {
      await updateDoc(doc(db, "shops", product.shopId, "products", product.id), { active: nextActive, updatedAt: new Date() });
      setShopProducts((current) => current.map((item) => item.id === product.id && item.shopId === product.shopId ? { ...item, active: nextActive } : item));
      setNotice(`${product.name || "Product"} ${nextActive ? "अब ग्राहकों को दिखाई देगा" : "अब ग्राहकों से छिपा दिया गया"}।`);
    } catch (err) { setError(err instanceof Error ? err.message : "Product visibility update नहीं हो पाया।"); }
  }

  async function deleteShopProduct(product: AdminProduct) {
    if (!db || !user || !isAdminEmail(user.email) || !user.emailVerified) return;
    const productName = product.name || "Unnamed product";
    if (!window.confirm(`क्या आप "${productName}" को "${product.shopName}" से हमेशा के लिए delete करना चाहते हैं? यह product ग्राहकों और shopkeeper की product list से हट जाएगा। यह वापस नहीं आएगा।`)) return;
    const key = product.shopId + "-" + product.id;
    setDeletingProductId(key); setError(""); setNotice("");
    try {
      await deleteDoc(doc(db, "shops", product.shopId, "products", product.id));
      setShopProducts((current) => current.filter((item) => !(item.shopId === product.shopId && item.id === product.id)));
      setNotice(`${productName} product permanently delete हो गया।`);
    } catch (err) {
      setError(err instanceof Error ? "Product delete नहीं हो पाया: " + err.message : "Product delete नहीं हो पाया। Firebase Firestore Rules जाँचें।");
    } finally {
      setDeletingProductId("");
    }
  }

  async function deleteShopCompletely(shop: Shop) {
    if (!db || !user || !isAdminEmail(user.email) || !user.emailVerified) return;
    const shopName = shop.name || shop.shopName || "this shop";
    if (!window.confirm(`PERMANENT DELETE: ${shopName}? This will delete its products, orders, sales, subscription payments, UTR reservations, shop-created unlinked customer records, owner lock, and shop record from Firebase. This cannot be undone.`)) return;
    if (!window.confirm(`Confirm permanent deletion of "${shopName}" (ID: ${shop.id})?`)) return;
    setDeletingShopId(shop.id); setError(""); setNotice("");
    try {
      const firestore = db;
      const deleteInChunks = async (refs: ReturnType<typeof doc>[]) => {
        for (let i = 0; i < refs.length; i += 450) {
          const batch = writeBatch(firestore);
          refs.slice(i, i + 450).forEach((ref) => batch.delete(ref));
          await batch.commit();
        }
      };
      const productSnap = await getDocs(collection(firestore, "shops", shop.id, "products"));
      await deleteInChunks(productSnap.docs.map((item) => item.ref));

      const relatedCollections = ["orders", "sales", "subscriptionPayments", "utrReservations"] as const;
      for (const collectionName of relatedCollections) {
        const related = await getDocs(query(collection(firestore, collectionName), where("shopId", "==", shop.id)));
        await deleteInChunks(related.docs.map((item) => item.ref));
      }

      const customerSnap = await getDocs(query(collection(firestore, "customers"), where("createdByShopId", "==", shop.id)));
      const orphanedCustomers = customerSnap.docs.filter((item) => !item.data().uid);
      await deleteInChunks(orphanedCustomers.map((item) => item.ref));

      if (shop.ownerUid) {
        const lockRef = doc(firestore, "shopOwnerLocks", shop.ownerUid);
        const lockSnap = await getDoc(lockRef);
        if (lockSnap.exists() && lockSnap.data().shopId === shop.id) {
          const batch = writeBatch(firestore); batch.delete(lockRef); await batch.commit();
        }
      }

      const finalBatch = writeBatch(firestore);
      finalBatch.delete(doc(firestore, "shops", shop.id));
      await finalBatch.commit();
      setShops((current) => current.filter((item) => item.id !== shop.id));
      setNotice(`${shopName} and its related Firebase records have been permanently deleted.`);
    } catch (err) {
      setError(err instanceof Error ? `Delete incomplete: ${err.message}. Some records may already have been removed; refresh and retry after checking Firestore Rules.` : "Shop deletion failed. Some records may already have been removed.");
    } finally { setDeletingShopId(""); }
  }

  async function loadShopDashboardNotices() {
    if (!db) return;
    try {
      const result = await getDocs(query(collectionGroup(db, "adminNotices"), orderBy("createdAt", "desc"), limit(200)));
      setShopDashboardNotices(Array.from(new Map(result.docs.map((item) => [item.id, { id: item.id, shopId: item.ref.parent.parent?.id || "", ...item.data() } as ShopDashboardNotice])).values()));
    } catch (err) {
      setError(err instanceof Error ? "Shopkeeper सूचना सूची लोड नहीं हुई: " + (err instanceof Error ? err.message : "") : "Shopkeeper सूचना सूची लोड नहीं हुई।");
    }
  }

  async function publishShopDashboardNotice() {
    if (!db || !shopNoticeTitle.trim() || !shopNoticeBody.trim()) { setError("सूचना का Title और Message दोनों लिखें।"); return; }
    if (!shops.length) { setError("दुकानों की सूची उपलब्ध नहीं है। Refresh करके फिर कोशिश करें।"); return; }
    setShopNoticeBusy(true); setError(""); setNotice("");
    try {
      const firestore = db;
      const shopNoticeDocumentId = doc(collection(firestore, "shopNoticeIds")).id;
      const noticeCreatedAt = Timestamp.now();
      for (let start = 0; start < shops.length; start += 400) {
        const batch = writeBatch(firestore);
        const noticeId = shopNoticeDocumentId;
        for (const shop of shops.slice(start, start + 400)) {
          const ref = doc(firestore, "shops", shop.id, "adminNotices", noticeId);
          batch.set(ref, { title: shopNoticeTitle.trim(), body: shopNoticeBody.trim(), createdAt: noticeCreatedAt });
        }
        await batch.commit();
      }
      setShopNoticeTitle(""); setShopNoticeBody("");
      await loadShopDashboardNotices();
      setNotice("सूचना Shop Dashboards में प्रकाशित हो गई। यह Homepage या Customers को नहीं दिखाई जाएगी और कोई Push Notification नहीं भेजा गया।");
    } catch (err) {
      setError(err instanceof Error ? "सूचना प्रकाशित नहीं हो पाई: " + err.message : "सूचना प्रकाशित नहीं हो पाई।");
    } finally { setShopNoticeBusy(false); }
  }

  async function deleteShopDashboardNotice(item: ShopDashboardNotice) {
    if (!db || !item.shopId || !item.id || !window.confirm("क्या यह सूचना Shop Dashboard से हटानी है?")) return;
    setDeletingShopNoticeId(item.id); setError(""); setNotice("");
    try {
      for (let start = 0; start < shops.length; start += 400) {
        const batch = writeBatch(db);
        for (const shop of shops.slice(start, start + 400)) batch.delete(doc(db, "shops", shop.id, "adminNotices", item.id));
        await batch.commit();
      }
      setShopDashboardNotices((current) => current.filter((entry) => entry.id !== item.id));
      setNotice("Shop Dashboard की सूचना हटा दी गई।");
    } catch (err) {
      setError(err instanceof Error ? "सूचना हट नहीं पाई: " + err.message : "सूचना हट नहीं पाई।");
    } finally { setDeletingShopNoticeId(""); }
  }

  async function publishAnnouncement() {
    if (!user || !announcementTitle.trim() || !announcementBody.trim()) { setError("पोस्ट का Title और Message दोनों लिखें।"); return; }
    setAnnouncementBusy(true); setError(""); setNotice("");
    try {
      const idToken = await user.getIdToken(true);
      const response = await fetch("/api/push/admin-announcement", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + idToken }, body: JSON.stringify({ title: announcementTitle.trim(), body: announcementBody.trim() }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "पोस्ट भेजी नहीं जा सकी।");
      setNotice("पोस्ट वेबसाइट पर प्रकाशित हो गई। " + Number(result.sent || 0) + " फोन पर Push Notification भेजा गया।" + (Number(result.failed || 0) ? " " + Number(result.failed) + " डिवाइस पर समस्या आई।" : ""));
      setAnnouncementTitle(""); setAnnouncementBody("");
      await loadAdminAnnouncements();
    } catch (err) { setError(err instanceof Error ? err.message : "पोस्ट प्रकाशित नहीं हो पाई।"); }
    finally { setAnnouncementBusy(false); }
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
    <header className="admin-header"><Link href="/" className="admin-brand">🍦 MY ICE CREAM <span>ADMIN</span></Link><div className="admin-user"><span>{user.email}</span><Link href="/" className="admin-secondary role-link">Home page</Link><button className="admin-secondary" onClick={() => auth && signOut(auth)}>Sign out</button></div></header>
    <div className="admin-heading"><div><p className="admin-kicker">PLATFORM CONTROL</p><h1>Admin dashboard</h1><p>Review shop registrations and control which shops are visible to customers.</p></div><button className="admin-secondary" onClick={() => void loadShops()} disabled={loading}>↻ Refresh</button></div>
    <nav className="admin-panel" aria-label="Admin sections" style={{display:"flex",gap:10,flexWrap:"wrap"}}>
      <button type="button" className={activeAdminSection === "overview" ? "admin-primary" : "admin-secondary"} onClick={() => setActiveAdminSection("overview")}>Overview</button>
      <button type="button" className={activeAdminSection === "registrations" ? "admin-primary" : "admin-secondary"} onClick={() => setActiveAdminSection("registrations")}>Shop registrations</button>
      <button type="button" className={activeAdminSection === "products" ? "admin-primary" : "admin-secondary"} onClick={() => setActiveAdminSection("products")}>Shop products</button>
      <button type="button" className={activeAdminSection === "announcements" ? "admin-primary" : "admin-secondary"} onClick={() => setActiveAdminSection("announcements")}>📢 पोस्ट और नोटिफिकेशन</button>
      <button type="button" className={activeAdminSection === "shopNotices" ? "admin-primary" : "admin-secondary"} onClick={() => setActiveAdminSection("shopNotices")}>🏪 Shopkeeper सूचना</button>
      <button type="button" className={activeAdminSection === "customers" ? "admin-primary" : "admin-secondary"} onClick={() => setActiveAdminSection("customers")}>Customers</button>
      <button type="button" className={activeAdminSection === "settings" ? "admin-primary" : "admin-secondary"} onClick={() => setActiveAdminSection("settings")}>Settings</button>
      <button type="button" className={activeAdminSection === "paymentQr" ? "admin-primary" : "admin-secondary"} onClick={() => setActiveAdminSection("paymentQr")}>💳 Payment QR</button>
      <Link href="/admin/payments" className="admin-secondary role-link">Subscription payments</Link>
    </nav>
    {activeAdminSection === "settings" && <><section className="admin-panel site-logo-settings"><div className="admin-panel-head"><div><h2>Website logo</h2><p>यह लोगो वेबसाइट के नाम की जगह सभी ग्राहकों को दिखेगा।</p></div></div>{logoError && <p className="admin-error" role="alert">Logo settings load नहीं हो पाईं: {logoError}</p>}
      <div className="site-logo-editor">{siteLogo ? <img src={siteLogo} alt="Current website logo" /> : <div className="site-logo-empty">🍦 MY ICE CREAM</div>}
        <label className="admin-primary small">{pendingLogoFile ? "दूसरा लोगो चुनें" : "नया लोगो चुनें"}<input type="file" accept="image/*" disabled={logoBusy} hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) { setPendingLogoFile(file); setNotice(""); setError(""); } event.currentTarget.value = ""; }} /></label>
        {pendingLogoFile && <button className="admin-primary small" disabled={logoBusy} onClick={() => { void saveSiteLogo(pendingLogoFile).then(() => setPendingLogoFile(null)); }}>{logoBusy ? "सेव हो रहा है…" : "लोगो सेव करें"}</button>}
        {pendingLogoFile && <button className="admin-secondary small" disabled={logoBusy} onClick={() => setPendingLogoFile(null)}>रद्द करें</button>}
        {siteLogo && <button className="admin-secondary small" disabled={logoBusy} onClick={() => { void saveSiteLogo().then(() => setPendingLogoFile(null)); }}>लोगो हटाएँ</button>}
      </div><small className="admin-muted">PNG, JPG या WebP image चुनें, फिर “लोगो सेव करें” दबाएँ। लोगो अपने-आप छोटा करके सेव होगा।</small>
    </section>
    {activeAdminSection === "paymentQr" && <section className="admin-panel site-logo-settings"><div className="admin-panel-head"><div><h2>Subscription UPI QR Code</h2><p>पहली listing ₹599 (पहला महीना शामिल) और उसके बाद renewal ₹299 प्रति माह के भुगतान के लिए यही QR दिखेगा।</p></div></div>
      <div className="site-logo-editor">{siteQr ? <img src={siteQr} alt="Admin UPI payment QR code" /> : <div className="site-logo-empty">UPI QR अभी सेट नहीं है</div>}
        <label className="admin-primary small">{pendingQrFile ? "दूसरा QR चुनें" : "UPI QR फोटो चुनें"}<input type="file" accept="image/*" hidden disabled={qrBusy} onChange={(event) => { const file = event.target.files?.[0]; if (file) { setPendingQrFile(file); setNotice(""); setError(""); } event.currentTarget.value = ""; }} /></label>
        {pendingQrFile && <button className="admin-primary small" disabled={qrBusy} onClick={() => { void saveUpiQr(pendingQrFile).then(() => setPendingQrFile(null)); }}>{qrBusy ? "सेव हो रहा है…" : "QR Code सेव करें"}</button>}
        {pendingQrFile && <button className="admin-secondary small" disabled={qrBusy} onClick={() => setPendingQrFile(null)}>रद्द करें</button>}
        {siteQr && <button className="admin-secondary small" disabled={qrBusy} onClick={() => { void saveUpiQr().then(() => setPendingQrFile(null)); }}>QR हटाएँ</button>}
      </div><small className="admin-muted">साफ़ QR फोटो चुनें। फोटो अपने-आप WebP में छोटा करके सेव होगी। नया QR लगाने पर पुराना बदल जाएगा। QR upload/save/delete केवल verified Admin कर सकता है।</small>
    </section>}
    </>}
    {activeAdminSection === "overview" && <section className="admin-stats"><article><span>Total shops</span><strong>{shops.length}</strong></article><article><span>Awaiting review</span><strong>{pending}</strong></article><article><span>Live shops</span><strong>{live}</strong></article><article><span>Inactive shops</span><strong>{inactive}</strong></article><article><span>Rejected shops</span><strong>{rejected}</strong></article></section>}
    {error && <p className="admin-error" role="alert">{error}</p>}{notice && <p className="admin-success" role="status">{notice}</p>}
    {activeAdminSection === "announcements" && <section className="admin-panel"><div className="admin-panel-head"><div><h2>📢 Official post और Push Notification</h2><p>यह पोस्ट वेबसाइट के Customer Updates में दिखेगी और जिन डिवाइसों ने Push चालू किया है, उन पर भेजी जाएगी।</p></div></div><label>पोस्ट का Title<input value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} maxLength={120} placeholder="जैसे: नया ऑफर या जरूरी सूचना" /></label><label>Message<textarea value={announcementBody} onChange={(event) => setAnnouncementBody(event.target.value)} maxLength={300} rows={4} placeholder="अपनी सूचना यहाँ लिखें…" /></label><div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",alignItems:"center"}}><small className="admin-muted">{announcementTitle.length}/120 · {announcementBody.length}/300 अक्षर</small><button className="admin-primary" disabled={announcementBusy || !announcementTitle.trim() || !announcementBody.trim()} onClick={() => void publishAnnouncement()}>{announcementBusy ? "भेजा जा रहा है…" : "📢 पोस्ट प्रकाशित करें और Notification भेजें"}</button></div><p className="admin-muted">जिन फोन में अनुमति और Push Registration चालू है, उन्हीं पर Notification पहुँचेगा। पोस्ट वेबसाइट के Search box के ठीक ऊपर रंगीन scrolling banner में भी दिखेगी।</p><div className="admin-announcement-list"><div className="admin-panel-head"><div><h3>आपकी प्रकाशित पोस्ट</h3><p>यहाँ से पोस्ट हटाने पर वेबसाइट के ticker और Customer Updates से हट जाएगी।</p></div><button type="button" className="admin-secondary small" onClick={() => void loadAdminAnnouncements()}>Refresh</button></div>{adminAnnouncements.length === 0 ? <p className="admin-muted">अभी कोई official post नहीं है।</p> : adminAnnouncements.map((item) => <article className="admin-announcement-row" key={item.id}><div><strong>{item.title || "Official update"}</strong><p>{item.body || ""}</p><small className="admin-muted">{item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString("hi-IN") : "Published post"}</small></div><button type="button" className="admin-danger small" disabled={deletingAnnouncementId === item.id} onClick={() => void deleteAdminAnnouncement(item)}>{deletingAnnouncementId === item.id ? "हटा रहे हैं…" : "🗑 Delete"}</button></article>)}</div></section>}
    {activeAdminSection === "shopNotices" && <section className="admin-panel"><div className="admin-panel-head"><div><h2>🏪 Shopkeeper के लिए निजी सूचना</h2><p>यह सूचना हर दुकान के अपने Shop Dashboard में ही दिखेगी। Homepage, Customer Updates और Push Notification में नहीं जाएगी।</p></div></div><label>सूचना का Title<input value={shopNoticeTitle} onChange={(event) => setShopNoticeTitle(event.target.value)} maxLength={120} placeholder="जैसे: जरूरी जानकारी" /></label><label>सूचना<textarea value={shopNoticeBody} onChange={(event) => setShopNoticeBody(event.target.value)} maxLength={1000} rows={4} placeholder="सभी दुकानदारों के लिए सूचना लिखें…" /></label><div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",alignItems:"center"}}><small className="admin-muted">{shopNoticeTitle.length}/120 · {shopNoticeBody.length}/1000 अक्षर · {shops.length} दुकानें</small><button type="button" className="admin-primary" disabled={shopNoticeBusy || !shopNoticeTitle.trim() || !shopNoticeBody.trim() || shops.length === 0} onClick={() => void publishShopDashboardNotice()}>{shopNoticeBusy ? "प्रकाशित हो रही है…" : "🏪 सिर्फ Shop Dashboard में प्रकाशित करें"}</button></div><div className="admin-announcement-list"><div className="admin-panel-head"><div><h3>पहले भेजी गई Shopkeeper सूचनाएँ</h3><p>Delete करने पर यह सूचना सभी Shop Dashboards से हट जाएगी।</p></div><button type="button" className="admin-secondary small" onClick={() => void loadShopDashboardNotices()}>Refresh</button></div>{shopDashboardNotices.length === 0 ? <p className="admin-muted">अभी कोई Shopkeeper सूचना नहीं है।</p> : shopDashboardNotices.map((item) => <article className="admin-announcement-row" key={item.shopId + "-" + item.id}><div><strong>{item.title || "सूचना"}</strong><p>{item.body || ""}</p><small className="admin-muted">सभी दुकानों के Dashboard में प्रकाशित{item.createdAt?.toDate ? " · " + item.createdAt.toDate().toLocaleString("hi-IN") : ""}</small></div><button type="button" className="admin-danger small" disabled={deletingShopNoticeId === item.id} onClick={() => void deleteShopDashboardNotice(item)}>{deletingShopNoticeId === item.id ? "हटा रहे हैं…" : "🗑 Delete"}</button></article>)}</div></section>}
    {activeAdminSection === "customers" && <section className="admin-panel"><div className="admin-panel-head"><div><h2>Registered customers</h2><p>Firestore में सेव ग्राहक रिकॉर्ड। यह Firebase Authentication की पूरी user-list नहीं है।</p></div><span className="admin-count">{customerError ? "Unavailable" : `${customers.length} customers`}</span></div>{customerError && <p className="admin-error" role="alert">Customer records load नहीं हो पाए: {customerError}. Shop management अभी भी इस्तेमाल कर सकते हैं।</p>}<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>नाम</th><th>मोबाइल</th><th>ईमेल</th><th>स्थिति</th></tr></thead><tbody>{customers.map((customer)=><tr key={customer.id}><td>{customer.name||"—"}</td><td>{customer.phone||customer.id}</td><td>{customer.email||"—"}</td><td>{customer.uid?"App account linked":"Shop-created record"}</td></tr>)}</tbody></table></div></section>}
    {activeAdminSection === "products" && <section className="admin-panel"><div className="admin-panel-head"><div><h2>Shop products</h2><p>सभी दुकानों के प्रोडक्ट यहाँ दिखेंगे, चाहे वे active हों या inactive।</p></div><span className="admin-count">{shopProducts.length} products</span></div>{productError && <p className="admin-error" role="alert">Products load नहीं हुए: {productError}</p>}{!productError && shopProducts.length === 0 ? <p className="admin-muted">अभी किसी दुकान में प्रोडक्ट सेव नहीं हैं।</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Product</th><th>Shop</th><th>Price</th><th>Visibility</th><th>Product ID</th><th>Action</th></tr></thead><tbody>{shopProducts.map((product) => <tr key={product.shopId + "-" + product.id}><td><strong>{product.name || "Unnamed product"}</strong><small>{product.category || "Category not set"}</small></td><td>{product.shopName}<small>{product.shopId}</small></td><td>₹{Number(product.price || 0).toFixed(2)}</td><td><span className={`admin-status ${product.active === true ? "live" : "inactive"}`}>{product.active === true ? "Active · Public" : "Inactive · Hidden"}</span><button className="admin-secondary small" onClick={() => void toggleProductVisibility(product)}>{product.active === true ? "Hide product" : "Show product"}</button></td><td><small>{product.id}</small></td><td><button className="admin-danger small" disabled={deletingProductId === product.shopId + "-" + product.id} onClick={() => void deleteShopProduct(product)}>{deletingProductId === product.shopId + "-" + product.id ? "Deleting…" : "🗑 Delete"}</button></td></tr>)}</tbody></table></div>}</section>}
    {activeAdminSection === "registrations" && <section className="admin-panel"><div className="admin-panel-head"><div><h2>Shop registrations</h2><p>New shops should be reviewed before being made public.</p></div><span className="admin-count">{visibleShops.length} / {shops.length} shops</span></div>
      <div className="admin-filters"><label>Search shops<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Shop, owner, mobile, city or ID…" /></label><label>Filter by status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="live">Live</option><option value="inactive">Inactive</option><option value="rejected">Rejected</option></select></label></div>
      {loading ? <p className="admin-muted">Loading shops…</p> : shops.length === 0 ? <div className="admin-empty"><span>🏪</span><h3>No shop registrations yet</h3><p>When a shop registration is saved to the Firestore <code>shops</code> collection, it will appear here for review.</p></div> :
      visibleShops.length === 0 ? <div className="admin-empty"><span>🔎</span><h3>No matching shops</h3><p>Search ya status filter badal kar dobara dekhein.</p><button className="admin-secondary" onClick={() => { setSearch(""); setStatusFilter("all"); }}>Clear filters</button></div> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Shop details</th><th>Owner details</th><th>Contact & address</th><th>UTR / Payment</th><th>Status</th><th>Actions</th></tr></thead><tbody>{visibleShops.map((shop) => { const status = (shop.status || "pending").toLowerCase(); return <tr key={shop.id}><td><strong>{shop.name || shop.shopName || "Unnamed shop"}</strong><small>ID: {shop.id}</small><small>{shop.description || shop.about || "Shop description not provided"}</small></td><td><strong>{shop.ownerName || "Name not provided"}</strong><small>{shop.ownerEmail || "Email not provided"}</small><small>UID: {shop.ownerUid || "—"}</small></td><td className="admin-contact-cell"><strong>📱 {shop.phone || shop.mobile || shop.mobileNumber || "Mobile not provided"}</strong><div className="admin-address"><b>📍 Shop address</b><span>{[shop.address, shop.fullAddress, shop.shopAddress, shop.location].find((value) => value?.trim()) || "Full address not provided by shop owner"}</span><small>City: {shop.city || "Not provided"}{shop.landmark ? ` · Landmark: ${shop.landmark}` : ""}</small></div></td><td>{(() => { const payment = shopPayments[shop.id]; return <><strong>{payment?.utr || "UTR not submitted"}</strong><small>{payment?.amount ? `₹${payment.amount}` : "Amount —"} · {payment?.status || "No payment record"}</small></>; })()}</td><td><span className={`admin-status ${status}`}>{status === "live" ? "APPROVED" : status.toUpperCase()}</span></td><td className="admin-actions">{status === "pending" && hasValidSubscription(shop) && <button className="admin-primary small" onClick={() => void setShopStatus(shop, "live")}>Approve shop & make LIVE</button>}{status === "inactive" && hasValidSubscription(shop) && <button className="admin-primary small" onClick={() => void setShopStatus(shop, "live")}>Resume shop</button>}{status === "rejected" && <button className="admin-primary small" onClick={() => void setShopStatus(shop, "pending")}>Reopen registration</button>}{status !== "live" && status !== "rejected" && !(status === "inactive" && hasValidSubscription(shop)) && !(status === "pending" && hasValidSubscription(shop)) && <Link href="/admin/payments" className="admin-primary small">Verify / renew payment</Link>}{status === "live" && <button className="admin-secondary small" onClick={() => void setShopStatus(shop, "inactive")}>Pause shop</button>}{<button className="admin-secondary small" style={{color:"#b42318",borderColor:"#b42318"}} disabled={deletingShopId===shop.id} onClick={() => void deleteShopCompletely(shop)}>{deletingShopId===shop.id ? "Deleting…" : "Delete permanently"}</button>}{status === "pending" && <button className="admin-secondary small" onClick={() => void setShopStatus(shop, "rejected")}>Reject</button>}</td></tr>; })}</tbody></table></div>}
    </section>}
    <p className="admin-footnote">Signed in as verified admin · Approving a shop makes it eligible to appear to customers. Status changes are protected by Firestore security rules.</p>
  </main>;
}

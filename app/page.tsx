"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { collection, getDocs, query, where, doc, getDoc, orderBy, limit } from "firebase/firestore/lite";
import { auth, db, googleProvider } from "@/lib/firebase";
import { isAdminEmail } from "@/lib/admin";
import { registerPushSubscription } from "@/lib/push-client";

type Shop = { id: string; name?: string; shopName?: string; city?: string; address?: string; description?: string; logoUrl?: string; bannerUrl?: string; category?: string; offerTitle?: string; offerDescription?: string; offerExpiresAt?: string };
type MarketplaceProduct = { id: string; shopId: string; shopName: string; city?: string; name?: string; description?: string; price?: number; originalPrice?: number; category?: string; imageUrl?: string; createdAt?: { toDate?: () => Date } | Date | string | number };
type CustomerNotice = { id: string; type?: string; shopId?: string; shopName?: string; productId?: string; title?: string; body?: string; createdAt?: { toDate?: () => Date } };
const categories = ["All treats", "Ice cream", "Kulfi", "Cones", "Family packs", "Party orders"];

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [shopOwner, setShopOwner] = useState(false);
  const [shops, setShops] = useState<Shop[]>([]);
  const [marketProducts, setMarketProducts] = useState<MarketplaceProduct[]>([]);
  const [customerNotices, setCustomerNotices] = useState<CustomerNotice[]>([]);
  const [tickerNotices, setTickerNotices] = useState<CustomerNotice[]>([]);
  const [showCustomerUpdates, setShowCustomerUpdates] = useState(false);
  const [hiddenCustomerNoticeIds, setHiddenCustomerNoticeIds] = useState<string[]>([]);
  const [productLoadError, setProductLoadError] = useState("");
  const [loadingShops, setLoadingShops] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [searchText, setSearchText] = useState("");
  const [shopSearchText, setShopSearchText] = useState("");
  const [showLiveShops, setShowLiveShops] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All treats");
  const [siteLogo, setSiteLogo] = useState("");
  const [showShareSite, setShowShareSite] = useState(false);
  const [sharePhone, setSharePhone] = useState("");
  const [shareError, setShareError] = useState("");
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const updateScrollButton = () => setShowScrollTop(window.scrollY > 240);
    updateScrollButton();
    window.addEventListener("scroll", updateScrollButton, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollButton);
  }, []);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setShopOwner(false);
      if (!nextUser) return;
      // Keep admins on the public marketplace when they visit "/".
      // Their control panel remains available through the Admin Dashboard link.
      if (!db) return;
      try {
        const owned = await getDocs(query(collection(db, "shops"), where("ownerUid", "==", nextUser.uid)));
        if (!owned.empty) {
          // Keep shop owners on the public customer homepage when they visit "/".
          // Their dashboard remains available through the Shop Dashboard link.
          setShopOwner(true);
        }
      } catch {
        setShopOwner(false);
      }
    });
  }, [router]);

  useEffect(() => {
    let active = true;
    if (db) getDoc(doc(db, "siteSettings", "branding")).then((snapshot) => { if (active && snapshot.exists()) setSiteLogo(String(snapshot.data().logoDataUrl || "")); }).catch(() => {});
    async function loadLiveShops() {
      if (!db) { setLoadingShops(false); return; }
      const firestore = db;
      try {
        // Admin-approved LIVE shops include legacy records without subscription metadata.
        const liveResult = await getDocs(query(collection(firestore, "shops"), where("status", "in", ["live", "LIVE", "Live"])));
        if (active) {
          const liveShops = liveResult.docs.map((item) => ({ id: item.id, ...item.data() } as Shop));
          setShops(liveShops);
          const groups = await Promise.all(liveShops.map(async (shop) => {
            try {
              const snapshot = await getDocs(query(collection(firestore, "shops", shop.id, "products"), where("active", "==", true)));
              return { products: snapshot.docs.map((item) => ({ id: item.id, shopId: shop.id, shopName: shop.name || shop.shopName || "Ice Cream Shop", city: shop.city, ...item.data() } as MarketplaceProduct)), error: "" };
            } catch (productError) {
              return { products: [], error: shop.name || shop.shopName || shop.id };
            }
          }));
          if (active) {
            const newestFirst = groups.flatMap((group) => group.products).sort((a, b) => {
              const getTime = (value: MarketplaceProduct["createdAt"]): number => {
                if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") return value.toDate().getTime();
                if (value instanceof Date) return value.getTime();
                if (typeof value === "number") return value;
                if (typeof value === "string") { const parsed = new Date(value).getTime(); return Number.isNaN(parsed) ? 0 : parsed; }
                return 0;
              };
              return getTime(b.createdAt) - getTime(a.createdAt);
            });
            setMarketProducts(newestFirst);
            const failedShops = groups.filter((group) => group.error).map((group) => group.error);
            setProductLoadError(failedShops.length ? "Product read permission issue for: " + failedShops.join(", ") + ". Firebase Console mein firebase/firestore.rules publish karein." : "");
          }
        }
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "Shops could not be loaded.");
      } finally {
        if (active) setLoadingShops(false);
      }
    }
    void loadLiveShops();
    if (db) {
      getDocs(query(collection(db, "notifications"), orderBy("createdAt", "desc"), limit(20)))
        .then((snapshot) => {
          if (active) setCustomerNotices(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as CustomerNotice)));
        })
        .catch(() => { if (active) setCustomerNotices([]); });
      getDocs(query(collection(db, "notifications"), orderBy("createdAt", "desc"), limit(100)))
        .then((snapshot) => {
          if (active) setTickerNotices(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as CustomerNotice)).filter((item) => item.type === "admin" || item.type === "shopkeeper"));
        })
        .catch(() => { if (active) setTickerNotices([]); });
    }
    return () => { active = false; };
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("my-ice-cream-hidden-notices");
      if (saved) setHiddenCustomerNoticeIds(JSON.parse(saved) as string[]);
    } catch { /* Ignore unavailable or invalid local notification preferences. */ }
  }, []);

  function hideCustomerNotice(noticeId: string) {
    setHiddenCustomerNoticeIds((current) => {
      const next = current.includes(noticeId) ? current : [...current, noticeId];
      try { window.localStorage.setItem("my-ice-cream-hidden-notices", JSON.stringify(next)); } catch { /* Keep the current screen usable if storage is unavailable. */ }
      return next;
    });
  }

  function clearVisibleCustomerNotices() {
    setHiddenCustomerNoticeIds((current) => {
      const next = [...new Set([...current, ...customerNotices.map((notice) => notice.id)])];
      try { window.localStorage.setItem("my-ice-cream-hidden-notices", JSON.stringify(next)); } catch { /* Keep the current screen usable if storage is unavailable. */ }
      return next;
    });
  }

  function shareSiteOnWhatsApp() {
    const digits = sharePhone.replace(/\D/g, "");
    const normalized = digits.length === 10 ? "91" + digits : digits.length === 12 && digits.startsWith("91") ? digits : "";
    if (!normalized) { setShareError("10 अंकों का मोबाइल नंबर डालें।"); return; }
    const siteUrl = window.location.origin;
    const message = "Please install MY ICE CREAM app 🍦\n\nMY ICE CREAM website link: " + siteUrl + "\n\nPlease open this link on your mobile and install the MY ICE CREAM app. Thank you!";
    window.open("https://wa.me/" + normalized + "?text=" + encodeURIComponent(message), "_blank", "noopener,noreferrer");
    setShowShareSite(false);
    setShareError("");
    setSharePhone("");
  }

  async function handleAuth() {
    if (!auth) { setMessage("Firebase setup is pending. Please try again later."); return; }
    setBusy(true); setMessage("");
    try {
      if (user) {
        await signOut(auth);
      } else {
        const credential = await signInWithPopup(auth, googleProvider);
        // Request the native browser permission from the Google sign-in action.
        if ("Notification" in window && Notification.permission === "default") {
          try { await Notification.requestPermission(); } catch { /* User may enable it in browser settings. */ }
        }
        if ("Notification" in window && Notification.permission === "granted") {
          try { await registerPushSubscription(credential.user.uid); } catch { /* Retry on a later signed-in visit. */ }
        }
      }
    }
    catch (error) { setMessage(error instanceof Error ? error.message : "Sign-in could not be completed."); }
    finally { setBusy(false); }
  }

  const adminAccount = isAdminEmail(user?.email);
  const visibleShops = shops.filter((shop) => {
    const haystack = [shop.name, shop.shopName, shop.city, shop.address, shop.description, shop.category].filter(Boolean).join(" ").toLowerCase();
    const matchesSearch = haystack.includes(searchText.trim().toLowerCase());
    const matchesCategory = activeCategory === "All treats" || (shop.category || "").toLowerCase().includes(activeCategory.toLowerCase());
    return matchesSearch && matchesCategory;
  });
  const filteredBottomShops = shops.filter((shop) => [shop.name, shop.shopName, shop.city, shop.address, shop.description, shop.category].filter(Boolean).join(" ").toLowerCase().includes(shopSearchText.trim().toLowerCase()));
  return <main className="site-shell marketplace-3d">
    <header className="topbar">
      <Link className="brand brand-3d-logo" href="/" aria-label="MY ICE CREAM home"><img className="brand-logo-image" src={siteLogo || "/my-ice-cream-logo.svg"} alt="MY ICE CREAM" /></Link>
      <button type="button" className="header-share-site" onClick={() => { setShowShareSite(true); setShareError(""); }} aria-label="Share MY ICE CREAM website">↗ <span>SHARE SITE</span></button>
      <details className="header-menu-dropdown">
        <summary aria-label="Open website menu"><span className="header-menu-icon">☰</span><span>Menu</span></summary>
        <div className="header-menu-panel">
          <a href="#discover" onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}>Discover</a>
          <a href="#shops" onClick={(event) => { setShowLiveShops(true); event.currentTarget.closest("details")?.removeAttribute("open"); }}>All Shops</a>
          <a href="#for-shops" onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}>For shops</a>
          <a href="#about" onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}>About</a>
          <Link href="/shop/register" onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}>Register your shop</Link>
          {user && (adminAccount ? <Link href="/admin" onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}>Admin Dashboard</Link> : shopOwner ? <Link href="/shop" onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}>Shop Dashboard</Link> : <Link href="/customer" onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}>My Account</Link>)}
          <button onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); handleAuth(); }} disabled={busy}>{busy ? "Please wait…" : user ? "Sign out" : "Google sign in"}</button>
        </div>
      </details>
    <section className="customer-notifications" aria-label="Customer notifications">
      <div className="customer-notification-launcher">
        <button type="button" className="customer-notification-icon" aria-label="नए प्रोडक्ट और ऑफर की सूचनाएँ खोलें" aria-expanded={showCustomerUpdates} onClick={() => setShowCustomerUpdates((open) => !open)}>
          <span aria-hidden="true">🔔</span>
          {customerNotices.filter((notice) => !hiddenCustomerNoticeIds.includes(notice.id)).length > 0 && <span className="customer-notification-count">{customerNotices.filter((notice) => !hiddenCustomerNoticeIds.includes(notice.id)).length}</span>}
        </button>
      </div>
      {showCustomerUpdates && <div className="customer-notification-drawer">
        <div className="customer-notification-heading">
          <div><p className="eyebrow" style={{marginBottom:4}}>CUSTOMER UPDATES</p><h2 style={{margin:0}}>नए प्रोडक्ट और ऑफर</h2></div>
          <div className="customer-notification-actions">
            {customerNotices.some((notice) => !hiddenCustomerNoticeIds.includes(notice.id)) && <button type="button" onClick={clearVisibleCustomerNotices}>सभी हटाएँ</button>}
            <button type="button" aria-label="सूचनाएँ बंद करें" onClick={() => setShowCustomerUpdates(false)}>✕</button>
          </div>
        </div>
        {customerNotices.filter((notice) => !hiddenCustomerNoticeIds.includes(notice.id)).length === 0 ? <p className="admin-muted">अभी कोई नई सूचना नहीं है।</p> : <div className="customer-notification-list">
          {customerNotices.filter((notice) => !hiddenCustomerNoticeIds.includes(notice.id)).map((notice) => <article key={notice.id} className="customer-notification-item">
            <div className="customer-notification-item-top">
              <strong>{notice.type === "admin" ? "📢 " : notice.type === "offer" ? "🎉 " : "🍦 "}{notice.title || "दुकान की नई सूचना"}</strong>
              <button type="button" className="customer-notification-delete" aria-label="यह सूचना हटाएँ" title="यह सूचना हटाएँ" onClick={() => hideCustomerNotice(notice.id)}>×</button>
            </div>
            <p>{notice.body || ""}</p>
            <div className="customer-notification-meta">
              <small className="admin-muted">{notice.type === "admin" ? "MY ICE CREAM · Official Update" : notice.shopName || "MY ICE CREAM Shop"}{notice.createdAt?.toDate ? " · " + notice.createdAt.toDate().toLocaleString("hi-IN") : ""}</small>
              {notice.shopId && <Link className="account-link" href={notice.productId ? "/shop/" + notice.shopId + "?product=" + encodeURIComponent(notice.productId) : "/shop/" + notice.shopId}>देखें</Link>}
            </div>
          </article>)}
        </div>}
      </div>}
    </section>
    </header>
      {tickerNotices.length > 0 && <div className="official-post-ticker" aria-label="Official and shopkeeper announcements"><div className="official-post-ticker-label">📢 SHOP UPDATES</div><div className="official-post-ticker-window"><div className="official-post-ticker-track" style={{ animationDuration: Math.max(4.5, 12 / Math.sqrt(tickerNotices.length)) + "s" }}>{[...tickerNotices, ...tickerNotices].map((notice, index) => <span className="official-post-ticker-item" key={notice.id + "-" + index}><strong>{notice.type === "admin" ? "MY ICE CREAM" : "🏪 " + (notice.shopName || "Shop")}: {notice.title}</strong>{notice.body ? " — " + notice.body : ""}<b>✦</b></span>)}</div></div></div>}

      <div className="marketplace-tools"><label className="marketplace-search"><input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search ice cream, kulfi, cones…" /></label></div>

      {productLoadError && <p className="admin-error" role="alert">{productLoadError}</p>}{loadingShops ? <div className="empty-panel"><p>Loading delicious treats…</p></div> : marketProducts.filter((product) => {
        const haystack = [product.name, product.description, product.category, product.shopName, product.city].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(searchText.trim().toLowerCase()) && (activeCategory === "All treats" || (product.category || "").toLowerCase().includes(activeCategory.toLowerCase()));
      }).length === 0 ? <div className="empty-panel"><h3>अभी कोई प्रोडक्ट उपलब्ध नहीं है</h3><p>LIVE दुकानों के उपलब्ध प्रोडक्ट यहाँ दिखाई देंगे।</p></div> :
      <div className="shop-grid marketplace-product-grid">{marketProducts.filter((product) => {
        const haystack = [product.name, product.description, product.category, product.shopName, product.city].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(searchText.trim().toLowerCase()) && (activeCategory === "All treats" || (product.category || "").toLowerCase().includes(activeCategory.toLowerCase()));
      }).map((product) => <article className="shop-card customer-product-card" key={product.shopId + "-" + product.id}>
        <Link href={"/shop/" + product.shopId + "?product=" + encodeURIComponent(product.id)} className="marketplace-product-open" aria-label={"Open " + (product.name || "product") + " in its shop"}>
          {product.imageUrl ? <img className="shop-banner" src={product.imageUrl} alt={product.name || "Ice cream"} /> : <div className="shop-banner shop-banner-placeholder">🍦</div>}
          <div className="shop-card-body marketplace-product-summary"><h3>{product.name || "Ice cream treat"}</h3><strong>₹{Number(product.price || 0).toFixed(2)}</strong><span className="admin-muted">{product.shopName}</span></div>
        </Link>
        <div className="shop-card-body" style={{paddingTop:0}}>
          <Link href={"/shop/" + product.shopId + "?product=" + encodeURIComponent(product.id)} className="admin-primary customer-add-button">＋ Add to cart</Link>
        </div>
      </article>)}</div>}
    </section>

    <section id="shops" className="bottom-live-shops">
      {showLiveShops && <>
        <label className="marketplace-search"><span>Search all shops</span><input value={shopSearchText} onChange={(e) => setShopSearchText(e.target.value)} placeholder="Enter shop name, city or address" /></label>
        <div className="shop-list-heading"><h2>Browse LIVE Shops</h2><span>{filteredBottomShops.length} shops</span></div>
        {loadingShops ? <div className="empty-panel"><p>Loading live shops…</p></div> : shops.length === 0 ? <div className="empty-panel"><div className="empty-icon">🏪</div><h3>No LIVE shops yet</h3><p>Approved shops will appear here automatically. You can browse this website without signing in.</p></div> : filteredBottomShops.length === 0 ? <div className="empty-panel"><h3>No matching shops</h3><p>Try a different shop name, city or address.</p><button className="admin-secondary" onClick={() => setShopSearchText("")}>Clear search</button></div> :
          <div className="shop-grid">{filteredBottomShops.map((shop) => <Link href={"/shop/" + shop.id} className="shop-card" key={shop.id}>
            {shop.bannerUrl ? <img className="shop-banner" src={shop.bannerUrl} alt="" /> : <div className="shop-banner shop-banner-placeholder">🍦</div>}
            <div className="shop-card-body"><div className="shop-card-title">{shop.logoUrl ? <img src={shop.logoUrl} alt="" /> : <span>🏪</span>}<h3>{shop.name || shop.shopName || "Ice Cream Shop"}</h3></div>
              <p>{[shop.city, shop.address].filter(Boolean).join(" · ") || "Location not added"}</p>
              {shop.description && <p className="shop-description">{shop.description}</p>}
              {shop.category && <span className="pill">{shop.category}</span>}{shop.offerTitle && (!shop.offerExpiresAt || new Date(shop.offerExpiresAt + "T23:59:59").getTime() >= Date.now()) && <div className="shop-offer"><strong>🎉 {shop.offerTitle}</strong>{shop.offerDescription && <p>{shop.offerDescription}</p>}{shop.offerExpiresAt && <small>Offer valid until {shop.offerExpiresAt}</small>}</div>}
            </div>
          </Link>)}</div>}
      </>}
    </section>
    <section id="for-shops" className="shop-onboarding"><div><p className="eyebrow">For ice cream businesses</p><h2>Bring your shop to MY ICE CREAM</h2><p>First listing ₹599 includes the first 30 days. Submit your UPI UTR; Admin verifies payment before the shop goes LIVE. Renewal is ₹299 per month.</p></div><Link href="/shop/register" className="primary-button">Register your shop</Link></section>
    <footer className="footer marketplace-footer" id="about"><div className="footer-main"><div><strong>🍦 MY ICE CREAM</strong><p>Discover local ice-cream shops, flavours and offers.</p></div><div className="footer-links" aria-label="Website information"><Link href="/about">About Us</Link><Link href="/contact">Contact Us</Link><Link href="/privacy-policy">Privacy Policy</Link><Link href="/terms">Terms &amp; Conditions</Link><Link href="/disclaimer">Disclaimer</Link><Link href="/cookie-policy">Cookie Policy</Link></div><div className="footer-contact"><strong>Contact Us</strong><a href="mailto:ngogrant454@gmail.com">Email: ngogrant454@gmail.com</a><a href="tel:+917517260192">Call: +91 7517260192</a><a href="https://wa.me/917517260192" target="_blank" rel="noopener noreferrer">WhatsApp: +91 7517260192</a></div></div><div className="footer-copy"><span>© {new Date().getFullYear()} MY ICE CREAM. All rights reserved.</span><span>Local shops · Sweet moments · Easy discovery</span></div></footer>
    {showShareSite && <div className="share-site-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowShareSite(false); }}>
      <form className="share-site-dialog" role="dialog" aria-modal="true" aria-labelledby="share-site-title" onSubmit={(event) => { event.preventDefault(); shareSiteOnWhatsApp(); }}>
        <button type="button" className="share-site-close" aria-label="बंद करें" onClick={() => setShowShareSite(false)}>×</button>
        <div className="share-site-whatsapp" aria-hidden="true">WA</div>
        <h2 id="share-site-title">WhatsApp पर SHARE SITE</h2>
        <p>जिस व्यक्ति को MY ICE CREAM वेबसाइट भेजनी है, उसका WhatsApp मोबाइल नंबर डालें।</p>
        <label htmlFor="share-site-phone">WhatsApp मोबाइल नंबर</label>
        <input id="share-site-phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={15} value={sharePhone} onChange={(event) => { setSharePhone(event.target.value.replace(/[^0-9+\\s-]/g, "").slice(0, 15)); setShareError(""); }} placeholder="10 अंकों का मोबाइल नंबर" />
        <small>भारत का नंबर डालें। +91 लिखना जरूरी नहीं है।</small>
        {shareError && <p className="share-site-error" role="alert">{shareError}</p>}
        <button type="submit" className="share-site-send">WhatsApp पर भेजें <span aria-hidden="true">➜</span></button>
      </form>
    </div>}
    {showScrollTop && <button type="button" className="marketplace-scroll-top" aria-label="ऊपर जाएँ" title="ऊपर जाएँ" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>↑</button>}
  </main>;
}

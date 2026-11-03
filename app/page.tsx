"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore/lite";
import { auth, db, googleProvider } from "@/lib/firebase";
import { isAdminEmail } from "@/lib/admin";

type Shop = { id: string; name?: string; shopName?: string; city?: string; address?: string; description?: string; logoUrl?: string; bannerUrl?: string; category?: string; offerTitle?: string; offerDescription?: string; offerExpiresAt?: string };
type MarketplaceProduct = { id: string; shopId: string; shopName: string; city?: string; name?: string; description?: string; price?: number; originalPrice?: number; category?: string; stock?: number; imageUrl?: string };
const categories = ["All treats", "Ice cream", "Kulfi", "Cones", "Family packs", "Party orders"];

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [shopOwner, setShopOwner] = useState(false);
  const [shops, setShops] = useState<Shop[]>([]);
  const [marketProducts, setMarketProducts] = useState<MarketplaceProduct[]>([]);
  const [loadingShops, setLoadingShops] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [searchText, setSearchText] = useState("");
  const [activeCategory, setActiveCategory] = useState("All treats");

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setShopOwner(false);
      if (!nextUser) return;
      if (isAdminEmail(nextUser.email) && nextUser.emailVerified) {
        router.replace("/admin");
        return;
      }
      if (!db) return;
      try {
        const owned = await getDocs(query(collection(db, "shops"), where("ownerUid", "==", nextUser.uid)));
        if (!owned.empty) {
          setShopOwner(true);
          router.replace("/shop");
        }
      } catch {
        setShopOwner(false);
      }
    });
  }, [router]);

  useEffect(() => {
    let active = true;
    async function loadLiveShops() {
      if (!db) { setLoadingShops(false); return; }
      const firestore = db;
      try {
        const result = await getDocs(query(collection(firestore, "shops"), where("status", "==", "live")));
        if (active) {
          const liveShops = result.docs.map((item) => ({ id: item.id, ...item.data() } as Shop));
          setShops(liveShops);
          const groups = await Promise.all(liveShops.map(async (shop) => {
            const snapshot = await getDocs(query(collection(firestore, "shops", shop.id, "products"), where("active", "==", true)));
            return snapshot.docs.map((item) => ({ id: item.id, shopId: shop.id, shopName: shop.name || shop.shopName || "Ice Cream Shop", city: shop.city, ...item.data() } as MarketplaceProduct));
          }));
          if (active) setMarketProducts(groups.flat().filter((product) => Number(product.stock || 0) > 0));
        }
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
  const visibleShops = shops.filter((shop) => {
    const haystack = [shop.name, shop.shopName, shop.city, shop.address, shop.description, shop.category].filter(Boolean).join(" ").toLowerCase();
    const matchesSearch = haystack.includes(searchText.trim().toLowerCase());
    const matchesCategory = activeCategory === "All treats" || (shop.category || "").toLowerCase().includes(activeCategory.toLowerCase());
    return matchesSearch && matchesCategory;
  });
  return <main className="site-shell">
    <header className="topbar">
      <Link className="brand" href="/" aria-label="MY ICE CREAM home"><span className="brand-mark">🍦</span><span>MY ICE CREAM</span></Link>
      <nav className="navlinks" aria-label="Main navigation"><a href="#discover">Discover</a><a href="#shops">For shops</a><a href="#about">About</a></nav>
      <div className="top-actions">
        {user && (adminAccount ? <Link className="account-link" href="/admin">Admin Dashboard</Link> : shopOwner ? <Link className="account-link" href="/shop">Shop Dashboard</Link> : <Link className="account-link" href="/customer">My Account</Link>)}
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
      <div className="marketplace-tools"><label className="marketplace-search"><span>Search shops</span><input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Shop name, city or category" /></label><div className="pills" aria-label="Shop categories">{categories.map((category)=><button type="button" className={activeCategory===category?"pill active":"pill"} key={category} aria-pressed={activeCategory===category} onClick={()=>setActiveCategory(category)}>{category}</button>)}</div></div>

      <div className="shop-list-heading"><h2>All Products</h2><span>{marketProducts.filter((product) => {
        const haystack = [product.name, product.description, product.category, product.shopName, product.city].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(searchText.trim().toLowerCase()) && (activeCategory === "All treats" || (product.category || "").toLowerCase().includes(activeCategory.toLowerCase()));
      }).length} products</span></div>
      {loadingShops ? <div className="empty-panel"><p>Loading delicious treats…</p></div> : marketProducts.filter((product) => {
        const haystack = [product.name, product.description, product.category, product.shopName, product.city].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(searchText.trim().toLowerCase()) && (activeCategory === "All treats" || (product.category || "").toLowerCase().includes(activeCategory.toLowerCase()));
      }).length === 0 ? <div className="empty-panel"><h3>अभी कोई प्रोडक्ट उपलब्ध नहीं है</h3><p>LIVE दुकानों के उपलब्ध प्रोडक्ट यहाँ दिखाई देंगे।</p></div> :
      <div className="shop-grid">{marketProducts.filter((product) => {
        const haystack = [product.name, product.description, product.category, product.shopName, product.city].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(searchText.trim().toLowerCase()) && (activeCategory === "All treats" || (product.category || "").toLowerCase().includes(activeCategory.toLowerCase()));
      }).map((product) => <Link href={"/shop/" + product.shopId + "?product=" + product.id} className="shop-card customer-product-card" key={product.shopId + "-" + product.id}>
        {product.imageUrl ? <img className="shop-banner" src={product.imageUrl} alt={product.name || "Ice cream"} /> : <div className="shop-banner shop-banner-placeholder">🍦</div>}
        <div className="shop-card-body"><span className="pill">{product.category || "Ice cream"}</span><h3>{product.name || "Ice cream treat"}</h3>
          {product.description && <p>{product.description}</p>}<strong>₹{Number(product.price || 0).toFixed(2)}</strong>
          {product.originalPrice && product.originalPrice > Number(product.price || 0) && <del className="admin-muted"> ₹{Number(product.originalPrice).toFixed(2)}</del>}
          <p>🏪 {product.shopName} · {product.city || "Local shop"}</p><span className="admin-secondary">इस दुकान के सभी प्रोडक्ट देखें →</span>
        </div></Link>)}</div>}
      <div id="shops" className="shop-list-heading"><h2>LIVE Ice Cream Shops</h2><span>{visibleShops.length} shops</span></div>
      {loadingShops ? <div className="empty-panel"><p>Loading live shops…</p></div> : shops.length === 0 ? <div className="empty-panel"><div className="empty-icon">🏪</div><h3>No LIVE shops yet</h3><p>Approved shops will appear here automatically. You can browse this website without signing in.</p></div> :
        <div className="shop-grid">{visibleShops.map((shop) => <Link href={"/shop/" + shop.id} className="shop-card" key={shop.id}>
          {shop.bannerUrl ? <img className="shop-banner" src={shop.bannerUrl} alt="" /> : <div className="shop-banner shop-banner-placeholder">🍦</div>}
          <div className="shop-card-body"><div className="shop-card-title">{shop.logoUrl ? <img src={shop.logoUrl} alt="" /> : <span>🏪</span>}<h3>{shop.name || shop.shopName || "Ice Cream Shop"}</h3></div>
            <p>{[shop.city, shop.address].filter(Boolean).join(" · ") || "Location not added"}</p>
            {shop.description && <p className="shop-description">{shop.description}</p>}
            {shop.category && <span className="pill">{shop.category}</span>}{shop.offerTitle && (!shop.offerExpiresAt || new Date(shop.offerExpiresAt + "T23:59:59").getTime() >= Date.now()) && <div className="shop-offer"><strong>🎉 {shop.offerTitle}</strong>{shop.offerDescription && <p>{shop.offerDescription}</p>}{shop.offerExpiresAt && <small>Offer valid until {shop.offerExpiresAt}</small>}</div>}
          </div>
        </Link>)}</div>}
      {!loadingShops && shops.length > 0 && visibleShops.length === 0 && <div className="empty-panel"><h3>No matching shops</h3><p>Try another search or choose All treats.</p><button className="admin-secondary" onClick={() => {setSearchText("");setActiveCategory("All treats");}}>Clear filters</button></div>}
    </section>
    <section id="for-shops" className="shop-onboarding"><div><p className="eyebrow">For ice cream businesses</p><h2>Bring your shop to MY ICE CREAM</h2><p>Register your shop for free review. Your shop becomes public only after Admin approval.</p></div><Link href="/shop/register" className="primary-button">Register your shop</Link></section>
    <footer className="footer" id="about"><span>© {new Date().getFullYear()} MY ICE CREAM</span><span>Unlimited shops · Sweet moments · Easy ordering</span></footer>
  </main>;
}

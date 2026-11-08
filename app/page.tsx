"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore/lite";
import { auth, db, googleProvider } from "@/lib/firebase";
import { isAdminEmail } from "@/lib/admin";

type Shop = { id: string; name?: string; shopName?: string; city?: string; address?: string; description?: string; logoUrl?: string; bannerUrl?: string; category?: string; offerTitle?: string; offerDescription?: string; offerExpiresAt?: string };
type MarketplaceProduct = { id: string; shopId: string; shopName: string; city?: string; name?: string; description?: string; price?: number; originalPrice?: number; category?: string; imageUrl?: string };
const categories = ["All treats", "Ice cream", "Kulfi", "Cones", "Family packs", "Party orders"];

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [shopOwner, setShopOwner] = useState(false);
  const [shops, setShops] = useState<Shop[]>([]);
  const [marketProducts, setMarketProducts] = useState<MarketplaceProduct[]>([]);
  const [productLoadError, setProductLoadError] = useState("");
  const [loadingShops, setLoadingShops] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [searchText, setSearchText] = useState("");
  const [shopSearchText, setShopSearchText] = useState("");
  const [activeCategory, setActiveCategory] = useState("All treats");
  const [siteLogo, setSiteLogo] = useState("");

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
            setMarketProducts(groups.flatMap((group) => group.products));
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
  const filteredBottomShops = shops.filter((shop) => [shop.name, shop.shopName, shop.city, shop.address, shop.description, shop.category].filter(Boolean).join(" ").toLowerCase().includes(shopSearchText.trim().toLowerCase()));
  return <main className="site-shell marketplace-3d">
    <header className="topbar">
      <Link className="brand brand-3d-logo" href="/" aria-label="MY ICE CREAM home"><img className="brand-logo-image" src={siteLogo || "/my-ice-cream-logo.svg"} alt="MY ICE CREAM" /></Link>
      <nav className="navlinks" aria-label="Main navigation"><a href="#discover">Discover</a><a href="#shops">For shops</a><a href="#about">About</a></nav>
      <div className="top-actions">
        {user && (adminAccount ? <Link className="account-link" href="/admin">Admin Dashboard</Link> : shopOwner ? <Link className="account-link" href="/shop">Shop Dashboard</Link> : <Link className="account-link" href="/customer">My Account</Link>)}
        <button className="login-button" onClick={handleAuth} disabled={busy}>{busy ? "Please wait…" : user ? "Sign out" : "Google sign in"}</button>
      </div>
    </header>
    <section id="discover">
      <div className="marketplace-tools"><label className="marketplace-search"><span>Search products</span><input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search ice cream, kulfi, cones…" /></label></div>

      <div className="shop-list-heading"><h2>All Products</h2><span>{marketProducts.filter((product) => {
        const haystack = [product.name, product.description, product.category].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(searchText.trim().toLowerCase());
      }).length} products</span></div>
      {productLoadError && <p className="admin-error" role="alert">{productLoadError}</p>}{loadingShops ? <div className="empty-panel"><p>Loading delicious treats…</p></div> : marketProducts.filter((product) => {
        const haystack = [product.name, product.description, product.category, product.shopName, product.city].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(searchText.trim().toLowerCase()) && (activeCategory === "All treats" || (product.category || "").toLowerCase().includes(activeCategory.toLowerCase()));
      }).length === 0 ? <div className="empty-panel"><h3>अभी कोई प्रोडक्ट उपलब्ध नहीं है</h3><p>LIVE दुकानों के उपलब्ध प्रोडक्ट यहाँ दिखाई देंगे।</p></div> :
      <div className="shop-grid marketplace-product-grid">{marketProducts.filter((product) => {
        const haystack = [product.name, product.description, product.category, product.shopName, product.city].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(searchText.trim().toLowerCase()) && (activeCategory === "All treats" || (product.category || "").toLowerCase().includes(activeCategory.toLowerCase()));
      }).map((product) => <Link href={"/shop/" + product.shopId} className="shop-card customer-product-card" key={product.shopId + "-" + product.id}>
        {product.imageUrl ? <img className="shop-banner" src={product.imageUrl} alt={product.name || "Ice cream"} /> : <div className="shop-banner shop-banner-placeholder">🍦</div>}
        <div className="shop-card-body marketplace-product-summary"><h3>{product.name || "Ice cream treat"}</h3><strong>₹{Number(product.price || 0).toFixed(2)}</strong></div></Link>)}</div>}
    </section>
    <section id="shops" className="bottom-live-shops">
      
      <label className="marketplace-search"><span>Search all shops</span><input value={shopSearchText} onChange={(e) => setShopSearchText(e.target.value)} placeholder="Enter shop name, city or address" /></label>
      <div className="shop-list-heading"><h2>LIVE Ice Cream Shops</h2><span>{filteredBottomShops.length} shops</span></div>
      {loadingShops ? <div className="empty-panel"><p>Loading live shops…</p></div> : shops.length === 0 ? <div className="empty-panel"><div className="empty-icon">🏪</div><h3>No LIVE shops yet</h3><p>Approved shops will appear here automatically. You can browse this website without signing in.</p></div> : filteredBottomShops.length === 0 ? <div className="empty-panel"><h3>No matching shops</h3><p>Try a different shop name, city or address.</p><button className="admin-secondary" onClick={() => setShopSearchText("")}>Clear search</button></div> :
        <div className="shop-grid">{filteredBottomShops.map((shop) => <Link href={"/shop/" + shop.id} className="shop-card" key={shop.id}>
          {shop.bannerUrl ? <img className="shop-banner" src={shop.bannerUrl} alt="" /> : <div className="shop-banner shop-banner-placeholder">🍦</div>}
          <div className="shop-card-body"><div className="shop-card-title">{shop.logoUrl ? <img src={shop.logoUrl} alt="" /> : <span>🏪</span>}<h3>{shop.name || shop.shopName || "Ice Cream Shop"}</h3></div>
            <p>{[shop.city, shop.address].filter(Boolean).join(" · ") || "Location not added"}</p>
            {shop.description && <p className="shop-description">{shop.description}</p>}
            {shop.category && <span className="pill">{shop.category}</span>}{shop.offerTitle && (!shop.offerExpiresAt || new Date(shop.offerExpiresAt + "T23:59:59").getTime() >= Date.now()) && <div className="shop-offer"><strong>🎉 {shop.offerTitle}</strong>{shop.offerDescription && <p>{shop.offerDescription}</p>}{shop.offerExpiresAt && <small>Offer valid until {shop.offerExpiresAt}</small>}</div>}
          </div>
        </Link>)}</div>}
    </section>
    <section id="for-shops" className="shop-onboarding"><div><p className="eyebrow">For ice cream businesses</p><h2>Bring your shop to MY ICE CREAM</h2><p>First listing ₹599 includes the first 30 days. Submit your UPI UTR; Admin verifies payment before the shop goes LIVE. Renewal is ₹299 per month.</p></div><Link href="/shop/register" className="primary-button">Register your shop</Link></section>
    <footer className="footer" id="about"><span>© {new Date().getFullYear()} MY ICE CREAM</span><span>Unlimited shops · Sweet moments · Easy ordering</span></footer>
  </main>;
}

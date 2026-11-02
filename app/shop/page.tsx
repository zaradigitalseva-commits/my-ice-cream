"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { isAdminEmail } from "@/lib/admin";

type Shop = { id: string; name?: string; shopName?: string; status?: string; city?: string; address?: string; phone?: string; description?: string; ownerUid?: string; logoUrl?: string; bannerUrl?: string; pickupAvailable?: boolean; deliveryAvailable?: boolean };
type Product = { id: string; name?: string; description?: string; price?: number; stock?: number; imageUrl?: string; active?: boolean };

export default function ShopPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [pickupAvailable, setPickupAvailable] = useState(true);
  const [deliveryAvailable, setDeliveryAvailable] = useState(false);
  const [productId, setProductId] = useState("");
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageBusy, setImageBusy] = useState(false);
  const [utr, setUtr] = useState("");
  const [paymentNotice, setPaymentNotice] = useState("");

  async function loadProducts(shopId: string) {
    if (!db) return;
    const result = await getDocs(query(collection(db, "shops", shopId, "products")));
    setProducts(result.docs.map((item) => ({ id: item.id, ...item.data() } as Product)));
  }

  useEffect(() => {
    if (!auth) { setLoading(false); return; }
    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) { router.replace("/"); return; }
      if (isAdminEmail(nextUser.email) && nextUser.emailVerified) { router.replace("/admin"); return; }
      if (!db) { setLoading(false); return; }
      try {
        const result = await getDocs(query(collection(db, "shops"), where("ownerUid", "==", nextUser.uid)));
        const owned = result.docs[0];
        if (owned) {
          const data = { id: owned.id, ...owned.data() } as Shop;
          setShop(data); setName(data.name || data.shopName || ""); setPhone(data.phone || "");
          setCity(data.city || ""); setAddress(data.address || ""); setDescription(data.description || ""); setLogoUrl(data.logoUrl || ""); setBannerUrl(data.bannerUrl || ""); setPickupAvailable(data.pickupAvailable !== false); setDeliveryAvailable(data.deliveryAvailable === true);
          if ((data.status || "").toLowerCase() === "live") await loadProducts(data.id);
        }
      } catch (e) { setError(e instanceof Error ? e.message : "Could not load your shop."); }
      finally { setLoading(false); }
    });
  }, [router]);

  async function submitSubscription(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db || !shop || !user) return;
    setBusy(true); setError(""); setPaymentNotice("");
    try {
      await addDoc(collection(db, "subscriptionPayments"), { ownerUid: user.uid, shopId: shop.id, shopName: shop.name || shop.shopName || "", amount: 299, utr: utr.trim(), status: "pending", createdAt: serverTimestamp() });
      setPaymentNotice("₹299 payment details submitted. Admin verification is pending.");
      setUtr("");
    } catch (e) { setError(e instanceof Error ? e.message : "Payment details could not be submitted."); }
    finally { setBusy(false); }
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db || !shop) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await updateDoc(doc(db, "shops", shop.id), { name: name.trim(), shopName: name.trim(), phone: phone.trim(), city: city.trim(), address: address.trim(), description: description.trim(), logoUrl, bannerUrl, pickupAvailable, deliveryAvailable, updatedAt: serverTimestamp() });
      setShop({ ...shop, name: name.trim(), shopName: name.trim(), phone, city, address, description, logoUrl, bannerUrl, pickupAvailable, deliveryAvailable });
      setNotice("Shop profile updated.");
    } catch (e) { setError(e instanceof Error ? e.message : "Profile update failed."); }
    finally { setBusy(false); }
  }

  async function compressProductImage(file: File) {
    if (!file.type.startsWith("image/")) { setError("Please choose an image file."); return; }
    setImageBusy(true); setError("");
    try {
      const source = URL.createObjectURL(file);
      const image = new Image();
      image.src = source;
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("Image could not be opened.")); });
      const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image compression is not supported in this browser.");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(source);
      let quality = 0.82;
      let result = canvas.toDataURL("image/webp", quality);
      while (result.length > 300000 && quality > 0.35) { quality -= 0.1; result = canvas.toDataURL("image/webp", quality); }
      if (result.length > 300000) throw new Error("Image is too large after compression. Choose a smaller photo.");
      setImageUrl(result); setNotice("Image compressed to WebP and ready to save.");
    } catch (e) { setError(e instanceof Error ? e.message : "Image compression failed."); }
    finally { setImageBusy(false); }
  }

  async function compressProfileImage(file: File, target: "logo" | "banner") {
    if (!file.type.startsWith("image/")) { setError("Please choose an image file."); return; }
    setImageBusy(true); setError("");
    const source = URL.createObjectURL(file);
    try {
      const image = new Image(); image.src = source;
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("Image could not be opened.")); });
      const max = target === "logo" ? 600 : 1400;
      const scale = Math.min(1, max / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d"); if (!context) throw new Error("Image compression is not supported in this browser.");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      let quality = 0.8; let result = canvas.toDataURL("image/webp", quality);
      while (result.length > 300000 && quality > 0.35) { quality -= 0.1; result = canvas.toDataURL("image/webp", quality); }
      if (result.length > 300000) throw new Error("Image is too large after compression. Choose a smaller photo.");
      if (target === "logo") setLogoUrl(result); else setBannerUrl(result);
      setNotice((target === "logo" ? "Logo" : "Banner") + " compressed to WebP. Save shop profile to apply it.");
    } catch (e) { setError(e instanceof Error ? e.message : "Image compression failed."); }
    finally { URL.revokeObjectURL(source); setImageBusy(false); }
  }

  function resetProduct() { setProductId(""); setProductName(""); setProductDescription(""); setPrice(""); setStock(""); setImageUrl(""); }

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db || !shop || !user || shop.status !== "live") return;
    setBusy(true); setError(""); setNotice("");
    const data = { shopId: shop.id, ownerUid: user.uid, name: productName.trim(), description: productDescription.trim(), price: Number(price), stock: Number(stock), imageUrl: imageUrl.trim(), active: true, updatedAt: serverTimestamp() };
    try {
      if (productId) await updateDoc(doc(db, "shops", shop.id, "products", productId), data);
      else await addDoc(collection(db, "shops", shop.id, "products"), { ...data, createdAt: serverTimestamp() });
      await loadProducts(shop.id); resetProduct(); setNotice(productId ? "Product updated." : "Product added.");
    } catch (e) { setError(e instanceof Error ? e.message : "Product could not be saved."); }
    finally { setBusy(false); }
  }

  async function removeProduct(id: string) {
    if (!db || !shop || !confirm("Delete this product?")) return;
    try { await deleteDoc(doc(db, "shops", shop.id, "products", id)); await loadProducts(shop.id); setNotice("Product deleted."); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not delete product."); }
  }

  const live = (shop?.status || "").toLowerCase() === "live";
  return <main className="admin-wrap">
    <header className="admin-header"><Link href="/" className="admin-brand">🍦 MY ICE CREAM <span>SHOP</span></Link><button className="admin-secondary" onClick={() => auth && signOut(auth)}>Sign out</button></header>
    {loading ? <section className="admin-panel"><h1>Loading your shop…</h1></section> : !shop ?
      <section className="admin-panel"><h1>Register your shop</h1><p>Shopkeeper access starts with a separate shop registration. Admin approval is required before your shop is LIVE.</p><Link href="/shop/register" className="admin-primary role-link">Register Shop</Link></section> :
      <>
        <section className="admin-heading"><div><p className="admin-kicker">SHOPKEEPER AREA</p><h1>{shop.name || shop.shopName || "My Shop"}</h1><p>{shop.city || ""} · Status: <span className={"admin-status " + (shop.status || "pending")}>{shop.status || "pending"}</span></p></div></section>
        {error && <p className="admin-error" role="alert">{error}</p>}{notice && <p className="admin-success" role="status">{notice}</p>}
        <section className="admin-panel"><h2>Orders & customers</h2><p>View orders from customers who purchased from your shop.</p><Link href="/shop/orders" className="admin-primary role-link">Open orders</Link></section><section className="admin-panel"><h2>Shop profile</h2><form className="register-form" onSubmit={saveProfile}>
          <label>Shop name<input required value={name} onChange={e=>setName(e.target.value)} /></label>
          <label>Mobile number<input required value={phone} onChange={e=>setPhone(e.target.value)} /></label>
          <label>City<input required value={city} onChange={e=>setCity(e.target.value)} /></label>
          <label>Full address<input required value={address} onChange={e=>setAddress(e.target.value)} /></label>
          <label>About your shop<textarea rows={3} value={description} onChange={e=>setDescription(e.target.value)} /></label>
          <label><input type="checkbox" checked={pickupAvailable} onChange={e=>setPickupAvailable(e.target.checked)} /> Shop pickup available</label>
          <label><input type="checkbox" checked={deliveryAvailable} onChange={e=>setDeliveryAvailable(e.target.checked)} /> Home delivery available</label>
          <label>Shop logo (WebP compressed, max 300 KB)<input type="file" accept="image/*" onChange={e=>{const file=e.target.files?.[0];if(file)void compressProfileImage(file,"logo");}} /></label>{logoUrl&&<img src={logoUrl} alt="Shop logo preview" style={{width:80,height:80,objectFit:"cover",borderRadius:14}}/>}
          <label>Shop banner (WebP compressed, max 300 KB)<input type="file" accept="image/*" onChange={e=>{const file=e.target.files?.[0];if(file)void compressProfileImage(file,"banner");}} /></label>{bannerUrl&&<img src={bannerUrl} alt="Shop banner preview" style={{width:"100%",maxHeight:140,objectFit:"cover",borderRadius:14}}/>}
          <button className="admin-primary" disabled={busy||imageBusy}>Save shop profile</button>
        </form></section>
        <section className="admin-panel"><h2>Monthly subscription</h2><p>Plan amount: ₹299 per month. Pay by UPI and submit the UTR number for Admin verification. Your subscription activates only after Admin confirms payment.</p><form className="register-form" onSubmit={submitSubscription}><label>UPI transaction UTR<input required value={utr} onChange={e=>setUtr(e.target.value)} placeholder="Enter UTR / transaction reference" /></label><button className="admin-primary" disabled={busy||!utr.trim()}>Submit ₹299 payment for verification</button></form>{paymentNotice&&<p className="admin-success">{paymentNotice}</p>}</section>
        {live ? <section className="admin-panel"><h2>Products & stock</h2><p>Add products with price and available stock. Only active LIVE shops are visible to customers.</p>
          <form className="register-form" onSubmit={saveProduct}>
            <label>Product name<input required value={productName} onChange={e=>setProductName(e.target.value)} placeholder="e.g. Chocolate Sundae" /></label>
            <label>Description<input value={productDescription} onChange={e=>setProductDescription(e.target.value)} /></label>
            <label>Price (₹)<input required type="number" min="0" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} /></label>
            <label>Stock quantity<input required type="number" min="0" step="1" value={stock} onChange={e=>setStock(e.target.value)} /></label>
            <label>Product photo (auto-compressed to WebP)<input type="file" accept="image/*" onChange={e=>{const file=e.target.files?.[0];if(file)void compressProductImage(file);}} /></label>{imageUrl && <div><img src={imageUrl} alt="Product preview" style={{maxWidth:140,maxHeight:100,borderRadius:12}}/><button type="button" className="admin-secondary small" onClick={()=>setImageUrl("")}>Remove photo</button></div>}{imageBusy && <p className="admin-muted">Compressing image…</p>}
            <div><button className="admin-primary" disabled={busy||imageBusy}>{productId ? "Update product" : "Add product"}</button>{productId && <button type="button" className="admin-secondary" onClick={resetProduct}>Cancel edit</button>}</div>
          </form>
          <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Actions</th></tr></thead><tbody>
            {products.map(p=><tr key={p.id}><td><strong>{p.name}</strong><small>{p.description || ""}</small></td><td>₹{Number(p.price || 0).toFixed(2)}</td><td>{p.stock ?? 0}</td><td className="admin-actions"><button className="admin-secondary small" onClick={()=>{setProductId(p.id);setProductName(p.name||"");setProductDescription(p.description||"");setPrice(String(p.price??""));setStock(String(p.stock??""));setImageUrl(p.imageUrl||"");}}>Edit</button><button className="admin-secondary small" onClick={()=>void removeProduct(p.id)}>Delete</button></td></tr>)}
            {products.length===0 && <tr><td colSpan={4}>No products added yet.</td></tr>}
          </tbody></table></div>
        </section> : <section className="admin-panel"><h2>Approval pending</h2><p>Your shop profile can be updated, but product management unlocks after Admin approves your shop and changes its status to LIVE.</p></section>}
      </>
    }
    {user && <p className="admin-muted">Signed in as {user.email}</p>}
  </main>;
}

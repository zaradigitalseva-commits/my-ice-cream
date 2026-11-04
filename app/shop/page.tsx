"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore/lite";
import { auth, db } from "@/lib/firebase";
import { isAdminEmail } from "@/lib/admin";

type Shop = { id: string; name?: string; shopName?: string; status?: string; city?: string; address?: string; phone?: string; description?: string; ownerUid?: string; logoUrl?: string; bannerUrl?: string; pickupAvailable?: boolean; deliveryAvailable?: boolean; offerTitle?: string; offerDescription?: string; offerExpiresAt?: string; openingTime?: string; closingTime?: string; closedDays?: string[]; manualClosed?: boolean; deliveryFee?: number; minimumOrder?: number };
type Order = { id: string; total?: number; status?: string; paymentStatus?: string; createdAt?: { toDate?: () => Date } };
type Customer = { id: string; phone: string; uid: string; name?: string; createdAt?: { toDate?: () => Date }; registered?: boolean };
type CustomerOrder = { id: string; customerName?: string; customerEmail?: string; customerPhone?: string; deliveryAddress?: string; total?: number; status?: string; paymentStatus?: "paid" | "unpaid" | string; createdAt?: { toDate?: () => Date }; items?: { name: string; quantity: number }[] };
type Product = { id: string; name?: string; description?: string; price?: number; originalPrice?: number; category?: string; stock?: number; imageUrl?: string; active?: boolean };

export default function ShopPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
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
  const [openingTime, setOpeningTime] = useState("10:00");
  const [closingTime, setClosingTime] = useState("22:00");
  const [closedDays, setClosedDays] = useState<string[]>([]);
  const [manualClosed, setManualClosed] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState("0");
  const [minimumOrder, setMinimumOrder] = useState("0");
  const [offerTitle, setOfferTitle] = useState("");
  const [offerDescription, setOfferDescription] = useState("");
  const [offerExpiresAt, setOfferExpiresAt] = useState("");
  const [productId, setProductId] = useState("");
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [productActive, setProductActive] = useState(true);
  const [productCategory, setProductCategory] = useState("Ice cream");
  const [originalPrice, setOriginalPrice] = useState("");
  const [imageBusy, setImageBusy] = useState(false);
  const [utr, setUtr] = useState("");
  const [paymentNotice, setPaymentNotice] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerBusy, setCustomerBusy] = useState(false);
  const [customerMessage, setCustomerMessage] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>([]);
  const [customerFound, setCustomerFound] = useState(false);
  const [saleQty, setSaleQty] = useState<Record<string, number>>({});
  const [discountValue, setDiscountValue] = useState("0");
  const [discountType, setDiscountType] = useState<"amount" | "percent">("amount");
  const [salePayment, setSalePayment] = useState<"paid" | "unpaid">("paid");
  const [showShopDashboard, setShowShopDashboard] = useState(false);
  const [whatsAppUrl, setWhatsAppUrl] = useState("");

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
          setCity(data.city || ""); setAddress(data.address || ""); setDescription(data.description || ""); setLogoUrl(data.logoUrl || ""); setBannerUrl(data.bannerUrl || ""); setPickupAvailable(data.pickupAvailable !== false); setDeliveryAvailable(data.deliveryAvailable === true); setOpeningTime(data.openingTime || "10:00"); setClosingTime(data.closingTime || "22:00"); setClosedDays(data.closedDays || []); setManualClosed(data.manualClosed === true); setDeliveryFee(String(data.deliveryFee ?? 0)); setMinimumOrder(String(data.minimumOrder ?? 0)); setOfferTitle(data.offerTitle || ""); setOfferDescription(data.offerDescription || ""); setOfferExpiresAt(data.offerExpiresAt || "");
          if ((data.status || "").toLowerCase() === "live") { await loadProducts(data.id); const orderResult = await getDocs(query(collection(db, "orders"), where("shopId", "==", data.id))); setOrders(orderResult.docs.map(item => ({ id: item.id, ...item.data() } as Order))); }
        }
      } catch (e) { setError(e instanceof Error ? e.message : "Could not load your shop."); }
      finally { setLoading(false); }
    });
  }, [router]);

  async function searchCustomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db || !shop) return;
    const digits = customerPhone.replace(/\D/g, "");
    if (!/^\d{10}$/.test(digits)) { setCustomerMessage("कृपया 10 अंकों का मोबाइल नंबर दर्ज करें।"); return; }
    setCustomerLoading(true); setCustomerMessage(""); setCustomer(null); setCustomerOrders([]); setCustomerFound(false); setSaleQty({}); setWhatsAppUrl("");
    try {
      const customerSnap = await getDoc(doc(db, "customers", digits));
      if (!customerSnap.exists()) { setCustomerMessage("इस नंबर का रिकॉर्ड नहीं मिला। नीचे नाम भरकर नया ग्राहक जोड़ सकते हैं।"); return; }
      const data = customerSnap.data();
      setCustomer({ id: customerSnap.id, phone: digits, uid: String(data.uid || ""), name: String(data.name || ""), registered: Boolean(data.uid) });
      setCustomerFound(true);
      const salesResult = await getDocs(query(collection(db, "sales"), where("shopId", "==", shop.id), where("ownerUid", "==", user?.uid || ""), where("customerPhone", "==", digits)));
      setCustomerOrders(salesResult.docs.map(d => ({ id:d.id, ...d.data() } as CustomerOrder)).sort((x,y)=>(y.createdAt?.toDate?.().getTime()||0)-(x.createdAt?.toDate?.().getTime()||0)));
      setCustomerMessage("ग्राहक मिल गया। अब बिल बना सकते हैं।");
    } catch (e) { setCustomerMessage(e instanceof Error ? e.message : "ग्राहक की जानकारी नहीं मिल सकी।"); }
    finally { setCustomerLoading(false); }
  }

  async function createCustomerRecord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db || !shop || !user) return;
    const digits = customerPhone.replace(/\D/g, "");
    if (!/^\d{10}$/.test(digits) || !newCustomerName.trim()) {
      setCustomerMessage("ग्राहक का नाम और 10 अंकों का मोबाइल नंबर भरें।");
      return;
    }
    setCustomerLoading(true); setCustomerMessage("");
    try {
      const ref = doc(db, "customers", digits);
      const existing = await getDoc(ref);
      if (existing.exists()) throw new Error("यह मोबाइल नंबर पहले से दर्ज है। ग्राहक खोजें।");
      await setDoc(ref, { phone: digits, name: newCustomerName.trim(), uid: "", registered: false, createdByShopId: shop.id, createdByShopName: shop.name || shop.shopName || "", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      setCustomer({ id: digits, phone: digits, uid: "", name: newCustomerName.trim(), registered: false });
      setCustomerFound(true);
      setCustomerMessage("ग्राहक रिकॉर्ड बन गया। ग्राहक को ऐप install करना जरूरी नहीं है।");
    } catch (e) { setCustomerMessage(e instanceof Error ? e.message : "ग्राहक रिकॉर्ड नहीं बन सका।"); }
    finally { setCustomerLoading(false); }
  }

  function sendOfferOnWhatsApp() {
    if (!customer || !shop) return;
    if (!offerTitle.trim() && !offerDescription.trim()) {
      setCustomerMessage("पहले दुकान के डैशबोर्ड में Offer title या Offer description सेव करें।");
      return;
    }
    const message = "🎉 SPECIAL OFFER – " + (shop.name || shop.shopName || "My Ice Cream") +
      "\nनमस्ते " + (customer.name || "जी") + "!" +
      "\n" + offerTitle.trim() +
      (offerDescription.trim() ? "\n" + offerDescription.trim() : "") +
      (offerExpiresAt ? "\nValid till: " + offerExpiresAt : "") +
      "\nदुकान पर आइए और इस ऑफर का लाभ उठाइए!";
    const url = "https://wa.me/91" + customer.phone + "?text=" + encodeURIComponent(message);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function createWalkInSale() {
    if (!db || !shop || !user || !customer) return;
    const items = products.filter(p => Number(saleQty[p.id] || 0) > 0).map(p => ({ productId:p.id, name:p.name || "Product", quantity:Number(saleQty[p.id]), price:Number(p.price || 0) }));
    if (!items.length) { setCustomerMessage("बिल में कम-से-कम एक प्रोडक्ट जोड़ें।"); return; }
    const subtotal = items.reduce((sum,item)=>sum+item.price*item.quantity,0);
    const rawDiscount = Math.max(0,Number(discountValue)||0);
    const discount = Math.min(subtotal, discountType === "percent" ? subtotal*Math.min(rawDiscount,100)/100 : rawDiscount);
    const total = Math.max(0,subtotal-discount);
    setCustomerBusy(true); setCustomerMessage("");
    try {
      const saleRef = await addDoc(collection(db,"sales"),{shopId:shop.id,shopName:shop.name||shop.shopName||"",ownerUid:user.uid,customerUid:customer.uid,customerPhone:customer.phone,customerName:customer.name||"",items,subtotal,discount,discountType,total,paymentStatus:salePayment,createdAt:serverTimestamp()});
      const lines = items.map(i=>i.name+" x "+i.quantity+" = ₹"+(i.price*i.quantity).toFixed(2)).join("\n");
      const message = "MY ICE CREAM BILL\n"+(shop.name||shop.shopName||"Shop")+"\nCustomer: "+(customer.name||customer.phone)+"\n"+lines+"\nSubtotal: ₹"+subtotal.toFixed(2)+"\nDiscount: ₹"+discount.toFixed(2)+"\nTotal: ₹"+total.toFixed(2)+"\nPayment: "+salePayment+"\nBill: "+saleRef.id;
      const billWhatsAppUrl = "https://wa.me/91"+customer.phone+"?text="+encodeURIComponent(message);
      setWhatsAppUrl(billWhatsAppUrl);
      window.open(billWhatsAppUrl,"_blank","noopener,noreferrer");
      setCustomerMessage("बिल सेव हो गया। WhatsApp share window खुल गई है।");
      setCustomerOrders(current=>[{id:saleRef.id,customerName:customer.name,customerPhone:customer.phone,total,items,paymentStatus:salePayment},...current]);
      setSaleQty({});setDiscountValue("0");
    } catch(e) { setCustomerMessage(e instanceof Error?e.message:"बिल सेव नहीं हो सका।"); }
    finally { setCustomerBusy(false); }
  }

  async function submitSubscription(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db || !shop || !user) return;
    setBusy(true); setError(""); setPaymentNotice("");
    try {
      const normalizedUtr = utr.trim().toUpperCase().replace(/\s+/g, "");
      if (!/^[A-Z0-9]{6,40}$/.test(normalizedUtr)) {
        throw new Error("Please enter a valid UTR (6–40 letters or numbers).");
      }
      const paymentRef = doc(collection(db, "subscriptionPayments"));
      const reservationRef = doc(db, "utrReservations", normalizedUtr);
      await runTransaction(db, async (transaction) => {
        const reservation = await transaction.get(reservationRef);
        if (reservation.exists()) {
          throw new Error("This UTR has already been submitted. Please check the number or contact admin.");
        }
        transaction.set(reservationRef, {
          ownerUid: user.uid,
          shopId: shop.id,
          paymentId: paymentRef.id,
          createdAt: serverTimestamp()
        });
        transaction.set(paymentRef, {
          ownerUid: user.uid,
          shopId: shop.id,
          shopName: shop.name || shop.shopName || "",
          amount: 299,
          utr: normalizedUtr,
          status: "pending",
          createdAt: serverTimestamp()
        });
      });
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
      await updateDoc(doc(db, "shops", shop.id), { name: name.trim(), shopName: name.trim(), phone: phone.trim(), city: city.trim(), address: address.trim(), description: description.trim(), logoUrl, bannerUrl, pickupAvailable, deliveryAvailable, openingTime, closingTime, closedDays, manualClosed, deliveryFee: Math.max(0, Number(deliveryFee) || 0), minimumOrder: Math.max(0, Number(minimumOrder) || 0), offerTitle: offerTitle.trim(), offerDescription: offerDescription.trim(), offerExpiresAt, updatedAt: serverTimestamp() });
      setShop({ ...shop, name: name.trim(), shopName: name.trim(), phone, city, address, description, logoUrl, bannerUrl, pickupAvailable, deliveryAvailable, openingTime, closingTime, closedDays, manualClosed, deliveryFee: Math.max(0, Number(deliveryFee) || 0), minimumOrder: Math.max(0, Number(minimumOrder) || 0), offerTitle: offerTitle.trim(), offerDescription: offerDescription.trim(), offerExpiresAt });
      setNotice("सेव हो गया। दुकान की जानकारी सफलतापूर्वक अपडेट हो गई है।");
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

  function resetProduct() { setProductId(""); setProductName(""); setProductDescription(""); setPrice(""); setStock(""); setImageUrl(""); setProductActive(true); setProductCategory("Ice cream"); setOriginalPrice(""); }

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db || !shop || !user || shop.status !== "live") return;
    setBusy(true); setError(""); setNotice("");
    const data = { shopId: shop.id, ownerUid: user.uid, name: productName.trim(), description: productDescription.trim(), price: Number(price), originalPrice: originalPrice.trim() ? Number(originalPrice) : null, category: productCategory, stock: Number(stock), imageUrl: imageUrl.trim(), active: productActive, updatedAt: serverTimestamp() };
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
        <section className="admin-panel">
          <p className="admin-kicker">CUSTOMER DESK</p><h2>ग्राहक खोजें और बिल बनाएँ</h2>
          <p>ग्राहक का मोबाइल नंबर खोजें। रिकॉर्ड न मिले तो यहीं नया ग्राहक बना सकते हैं—ऐप जरूरी नहीं।</p>
          <form className="register-form" onSubmit={searchCustomer}>
            <label>ग्राहक मोबाइल नंबर<input required inputMode="numeric" autoComplete="tel" maxLength={10} value={customerPhone} onChange={e=>setCustomerPhone(e.target.value.replace(/\D/g,"").slice(0,10))} placeholder="10 अंकों का मोबाइल नंबर" /></label>
            <button className="admin-primary" disabled={customerLoading || customerPhone.length!==10}>{customerLoading?"खोज रहे हैं…":"ग्राहक खोजें"}</button>
          </form>
          {customerMessage && <p className={customerFound?"admin-success":"admin-muted"} role="status">{customerMessage}</p>}
          {!customerFound && customerPhone.length===10 && customerMessage.includes("नया ग्राहक जोड़") && <form className="register-form" onSubmit={createCustomerRecord}><label>ग्राहक का नाम<input required value={newCustomerName} onChange={e=>setNewCustomerName(e.target.value)} placeholder="ग्राहक का नाम" /></label><button className="admin-primary" disabled={customerLoading}>{customerLoading?"सेव हो रहा है…":"नया ग्राहक सेव करें"}</button></form>}\n          {customerFound && customer && <>
            <h3>{customer.name || "ग्राहक"} · {customer.phone}</h3>{!customer.registered && <p className="admin-muted">यह रिकॉर्ड दुकानदार ने बनाया है। ग्राहक ने अभी ऐप से अकाउंट link नहीं किया है।</p>}\n            <button type="button" className="admin-primary" onClick={sendOfferOnWhatsApp}>WhatsApp पर ऑफर भेजें</button>
            <h3>इस दुकान की पुरानी खरीदारी</h3>
            {customerOrders.length===0?<p className="admin-muted">इस दुकान से अभी कोई खरीदारी नहीं हुई।</p>:customerOrders.map(o=><p key={o.id}>{(o.items||[]).map(i=>i.name+" × "+i.quantity).join(", ")} · ₹{Number(o.total||0).toFixed(2)} · {o.paymentStatus||"unpaid"}</p>)}
            <h3>नया बिल</h3>
            <div className="register-form">
              {products.filter(p=>p.active!==false).map(p=><label key={p.id}>{p.name} · ₹{Number(p.price||0).toFixed(2)} (Stock: {p.stock??0})<input type="number" min="0" max={Number(p.stock||0)} step="1" value={saleQty[p.id]||0} onChange={e=>setSaleQty(v=>({...v,[p.id]:Math.min(Number(p.stock||0),Math.max(0,Number(e.target.value)||0))}))}/></label>)}
              <label>Discount type<select value={discountType} onChange={e=>setDiscountType(e.target.value as "amount"|"percent")}><option value="amount">₹ Amount</option><option value="percent">Percent (%)</option></select></label>
              <label>Discount<input type="number" min="0" step="0.01" value={discountValue} onChange={e=>setDiscountValue(e.target.value)}/></label>
              <label>Payment status<select value={salePayment} onChange={e=>setSalePayment(e.target.value as "paid"|"unpaid")}><option value="paid">Paid</option><option value="unpaid">Unpaid</option></select></label>
              <button type="button" className="admin-primary" disabled={customerBusy||products.length===0} onClick={()=>void createWalkInSale()}>{customerBusy?"बिल सेव हो रहा है…":"बिल सेव करें"}</button>
              {whatsAppUrl && <a className="admin-primary role-link" href={whatsAppUrl} target="_blank" rel="noopener noreferrer">WhatsApp पर बिल भेजें</a>}
            </div>
          </>}
        </section>
        <div className="admin-panel" style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,flexWrap:"wrap"}}><div><p className="admin-kicker">SHOP MANAGEMENT</p><h2 style={{margin:0}}>दुकान का डैशबोर्ड</h2><p style={{margin:"6px 0 0"}}>प्रोडक्ट, ऑर्डर, दुकान की जानकारी और पेमेंट मैनेज करें।</p></div><button type="button" className="admin-primary" onClick={()=>setShowShopDashboard(v=>!v)}>{showShopDashboard?"डैशबोर्ड बंद करें":"दुकान का डैशबोर्ड खोलें"}</button></div>
        {showShopDashboard && <>
        <section className="admin-panel"><h2>Business overview</h2><div className="admin-stats"><div><strong>{orders.length}</strong><span>Total orders</span></div><div><strong>₹{orders.filter(o=>o.paymentStatus==="paid").reduce((s,o)=>s+Number(o.total||0),0).toFixed(0)}</strong><span>Paid sales</span></div><div><strong>{orders.filter(o=>["placed","accepted","preparing","ready"].includes(o.status||"")).length}</strong><span>Open orders</span></div><div><strong>{products.filter(p=>Number(p.stock||0)<=5).length}</strong><span>Low stock</span></div></div></section><section className="admin-panel"><h2>Orders & customers</h2><p>View orders from customers who purchased from your shop.</p><Link href="/shop/orders" className="admin-primary role-link">Open orders</Link></section><section className="admin-panel"><h2>Shop profile</h2><form className="register-form" onSubmit={saveProfile}>
          <label>Shop name<input required value={name} onChange={e=>setName(e.target.value)} /></label>
          <label>Mobile number<input required value={phone} onChange={e=>setPhone(e.target.value)} /></label>
          <label>City<input required value={city} onChange={e=>setCity(e.target.value)} /></label>
          <label>Full address<input required value={address} onChange={e=>setAddress(e.target.value)} /></label>
          <label>About your shop<textarea rows={3} value={description} onChange={e=>setDescription(e.target.value)} /></label>
          <label><input type="checkbox" checked={pickupAvailable} onChange={e=>setPickupAvailable(e.target.checked)} /> Shop pickup available</label>
          <label><input type="checkbox" checked={deliveryAvailable} onChange={e=>setDeliveryAvailable(e.target.checked)} /> Home delivery available</label>
          <h3>Shop hours & availability</h3>
          <label>Opening time<input type="time" value={openingTime} onChange={e=>setOpeningTime(e.target.value)} /></label>
          <label>Closing time<input type="time" value={closingTime} onChange={e=>setClosingTime(e.target.value)} /></label>
          <label>Weekly closed day<select value={closedDays[0]||""} onChange={e=>setClosedDays(e.target.value?[e.target.value]:[])}><option value="">No weekly holiday</option>{["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map(day=><option key={day}>{day}</option>)}</select></label>
          <label><input type="checkbox" checked={manualClosed} onChange={e=>setManualClosed(e.target.checked)} /> Temporarily mark shop as closed</label>
          <h3>Delivery settings</h3>
          <label>Delivery charge (₹)<input type="number" min="0" step="1" value={deliveryFee} onChange={e=>setDeliveryFee(e.target.value)} /></label>
          <label>Minimum order (₹)<input type="number" min="0" step="1" value={minimumOrder} onChange={e=>setMinimumOrder(e.target.value)} /></label>
          <h3>Customer offer / promotion</h3>
          <label>Offer title<input maxLength={60} value={offerTitle} onChange={e=>setOfferTitle(e.target.value)} placeholder="e.g. Buy 2 get 1 free" /></label>
          <label>Offer details<textarea rows={2} maxLength={240} value={offerDescription} onChange={e=>setOfferDescription(e.target.value)} placeholder="Add offer terms or eligible products" /></label>
          <label>Offer valid until<input type="date" value={offerExpiresAt} onChange={e=>setOfferExpiresAt(e.target.value)} /></label>
          <label>Shop logo (WebP compressed, max 300 KB)<input type="file" accept="image/*" onChange={e=>{const file=e.target.files?.[0];if(file)void compressProfileImage(file,"logo");}} /></label>{logoUrl&&<img src={logoUrl} alt="Shop logo preview" style={{width:80,height:80,objectFit:"cover",borderRadius:14}}/>}
          <label>Shop banner (WebP compressed, max 300 KB)<input type="file" accept="image/*" onChange={e=>{const file=e.target.files?.[0];if(file)void compressProfileImage(file,"banner");}} /></label>{bannerUrl&&<img src={bannerUrl} alt="Shop banner preview" style={{width:"100%",maxHeight:140,objectFit:"cover",borderRadius:14}}/>}
          <button className="admin-primary" disabled={busy||imageBusy}>{busy ? "सेव हो रहा है…" : "दुकान की जानकारी सेव करें"}</button>
        </form></section>
        <section className="admin-panel"><h2>Monthly subscription</h2><p>Plan amount: ₹299 per month. Pay by UPI and submit the UTR number for Admin verification. Your subscription activates only after Admin confirms payment.</p><form className="register-form" onSubmit={submitSubscription}><label>UPI transaction UTR<input required value={utr} onChange={e=>setUtr(e.target.value)} placeholder="Enter UTR / transaction reference" /></label><button className="admin-primary" disabled={busy||!utr.trim()}>Submit ₹299 payment for verification</button></form>{paymentNotice&&<p className="admin-success">{paymentNotice}</p>}</section>
        {live ? <section className="admin-panel"><h2>Products & stock</h2><p>Add products with price and available stock. Only active LIVE shops are visible to customers.</p>
          <form className="register-form" onSubmit={saveProduct}>
            <label>Product name<input required value={productName} onChange={e=>setProductName(e.target.value)} placeholder="e.g. Chocolate Sundae" /></label>
            <label>Description<input value={productDescription} onChange={e=>setProductDescription(e.target.value)} /></label>
            <label>Category<select value={productCategory} onChange={e=>setProductCategory(e.target.value)}><option>Ice cream</option><option>Kulfi</option><option>Cones</option><option>Family packs</option><option>Shakes</option><option>Other</option></select></label>
            <label>Selling price (₹)<input required type="number" min="0" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} /></label>
            <label>Original price (₹, optional)<input type="number" min="0" step="0.01" value={originalPrice} onChange={e=>setOriginalPrice(e.target.value)} /></label>
            <label>Stock quantity<input required type="number" min="0" step="1" value={stock} onChange={e=>setStock(e.target.value)} /></label>
            <label><input type="checkbox" checked={productActive} onChange={e=>setProductActive(e.target.checked)} /> Show this product to customers</label>
            <label>Product photo (auto-compressed to WebP)<input type="file" accept="image/*" onChange={e=>{const file=e.target.files?.[0];if(file)void compressProductImage(file);}} /></label>{imageUrl && <div><img src={imageUrl} alt="Product preview" style={{maxWidth:140,maxHeight:100,borderRadius:12}}/><button type="button" className="admin-secondary small" onClick={()=>setImageUrl("")}>Remove photo</button></div>}{imageBusy && <p className="admin-muted">Compressing image…</p>}
            <div><button className="admin-primary" disabled={busy||imageBusy}>{productId ? "Update product" : "Add product"}</button>{productId && <button type="button" className="admin-secondary" onClick={resetProduct}>Cancel edit</button>}</div>
          </form>
          <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Visibility</th><th>Actions</th></tr></thead><tbody>
            {products.map(p=><tr key={p.id}><td><strong>{p.name}</strong><small>{p.description || ""}</small></td><td>₹{Number(p.price || 0).toFixed(2)}{p.originalPrice && p.originalPrice>Number(p.price||0) ? <small><s>₹{Number(p.originalPrice).toFixed(2)}</s></small> : null}</td><td>{p.stock ?? 0}</td><td><span className={"admin-status "+(p.active===false?"inactive":"live")}>{p.active===false?"Hidden":"Visible"}</span></td><td className="admin-actions"><button className="admin-secondary small" onClick={()=>{setProductId(p.id);setProductName(p.name||"");setProductDescription(p.description||"");setPrice(String(p.price??""));setOriginalPrice(String(p.originalPrice??""));setProductCategory(p.category||"Ice cream");setStock(String(p.stock??""));setImageUrl(p.imageUrl||"");setProductActive(p.active!==false);}}>Edit</button><button className="admin-secondary small" onClick={()=>void removeProduct(p.id)}>Delete</button></td></tr>)}
            {products.length===0 && <tr><td colSpan={5}>No products added yet.</td></tr>}
          </tbody></table></div>
        </section> : <section className="admin-panel"><h2>Approval pending</h2><p>Your shop profile can be updated, but product management unlocks after Admin approves your shop and changes its status to LIVE.</p></section>}
        </>}
      </>
    }
    {user && <p className="admin-muted">Signed in as {user.email}</p>}
  </main>;
}

"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, updateDoc, where, orderBy, limit } from "firebase/firestore/lite";
import { auth, db } from "@/lib/firebase";
import { isAdminEmail } from "@/lib/admin";
import { compressImageToWebP } from "@/lib/image-compression";

type Shop = { id: string; name?: string; shopName?: string; status?: string; city?: string; address?: string; phone?: string; description?: string; ownerUid?: string; logoUrl?: string; bannerUrl?: string; pickupAvailable?: boolean; deliveryAvailable?: boolean; offerTitle?: string; offerDescription?: string; offerExpiresAt?: string; scrollingText?: string; openingTime?: string; closingTime?: string; closedDays?: string[]; manualClosed?: boolean; deliveryFee?: number; minimumOrder?: number; initialPaymentVerified?: boolean; subscriptionStatus?: string; subscriptionExpiresAt?: { toDate?: () => Date } | Date | null };
type Order = { id: string; total?: number; status?: string; paymentStatus?: string; createdAt?: { toDate?: () => Date } };
type Customer = { id: string; phone: string; uid: string; name?: string; createdAt?: { toDate?: () => Date }; registered?: boolean };
type CustomerOrder = { id: string; customerName?: string; customerEmail?: string; customerPhone?: string; deliveryAddress?: string; total?: number; status?: string; paymentStatus?: "paid" | "unpaid" | string; createdAt?: { toDate?: () => Date }; items?: { name: string; quantity: number }[] };
type Product = { id: string; name?: string; description?: string; price?: number; originalPrice?: number; category?: string; imageUrl?: string; active?: boolean };
type SubscriptionPayment = { id: string; amount?: number; paymentType?: string; utr?: string; status?: string; createdAt?: { toDate?: () => Date } };
type ShopAdminNotice = { id: string; title?: string; body?: string; createdAt?: { toDate?: () => Date } };

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
  const [scrollingText, setScrollingText] = useState("");
  const [productId, setProductId] = useState("");
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [productActive, setProductActive] = useState(true);
  const [productCategory, setProductCategory] = useState("Ice cream");
  const [originalPrice, setOriginalPrice] = useState("");
  const [imageBusy, setImageBusy] = useState(false);
  const [utr, setUtr] = useState("");
  const [paymentNotice, setPaymentNotice] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [adminUpiQr, setAdminUpiQr] = useState("");
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
  const [activeShopSection, setActiveShopSection] = useState<"profile" | "payments" | "products" | "myProducts" | "promotion" | "">("");
  const [paymentHistory, setPaymentHistory] = useState<SubscriptionPayment[]>([]);
  const [paymentHistoryLoading, setPaymentHistoryLoading] = useState(false);
  const [whatsAppUrl, setWhatsAppUrl] = useState("");
  const [pendingPayment, setPendingPayment] = useState(false);
  const [productsRefreshing, setProductsRefreshing] = useState(false);
  const [productRefreshMessage, setProductRefreshMessage] = useState("");
  const [adminNotices, setAdminNotices] = useState<ShopAdminNotice[]>([]);

  useEffect(() => {
    if (!activeShopSection) return;
    const sectionIds: Record<string, string> = {
      profile: "shop-profile",
      payments: "shop-payments",
      products: "shop-add-product",
      myProducts: "shop-my-products",
      promotion: "shop-promotion",
    };
    const timer = window.setTimeout(() => {
      document.getElementById(sectionIds[activeShopSection])?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [activeShopSection]);

  async function loadShopAdminNotices(shopId: string) {
    if (!db) return;
    try {
      const result = await getDocs(query(collection(db, "shops", shopId, "adminNotices"), orderBy("createdAt", "desc"), limit(20)));
      setAdminNotices(result.docs.map((item) => ({ id: item.id, ...item.data() } as ShopAdminNotice)));
    } catch (err) {
      setError(err instanceof Error ? "Admin की सूचना लोड नहीं हुई: " + (err instanceof Error ? err.message : "") : "Admin की सूचना लोड नहीं हुई।");
    }
  }

  async function loadProducts(shopId: string) {
    if (!db) return;
    const result = await getDocs(query(collection(db, "shops", shopId, "products")));
    setProducts(result.docs.map((item) => ({ id: item.id, ...item.data() } as Product)));
  }

  async function refreshProducts() {
    if (!shop || productsRefreshing) return;
    setProductsRefreshing(true);
    setProductRefreshMessage("");
    try {
      await loadProducts(shop.id);
      setProductRefreshMessage("Product list successfully refresh ho gayi.");
    } catch (refreshError) {
      setProductRefreshMessage(refreshError instanceof Error ? refreshError.message : "Product list refresh nahi ho saki. Dobara try karein.");
    } finally {
      setProductsRefreshing(false);
    }
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
          const isLiveShop = ["live", "LIVE", "Live"].includes(String(data.status || ""));
          setShop(data);
          await loadShopAdminNotices(data.id);
          if (window.location.hash === "#shop-profile") setActiveShopSection("profile");
          const lock = await getDoc(doc(db, "paymentPendingLocks", data.id));
          setPendingPayment(lock.exists() && !isLiveShop); setName(data.name || data.shopName || ""); setPhone(data.phone || "");
          setCity(data.city || ""); setAddress(data.address || ""); setDescription(data.description || ""); setLogoUrl(data.logoUrl || ""); setBannerUrl(data.bannerUrl || ""); setPickupAvailable(data.pickupAvailable !== false); setDeliveryAvailable(data.deliveryAvailable === true); setOpeningTime(data.openingTime || "10:00"); setClosingTime(data.closingTime || "22:00"); setClosedDays(data.closedDays || []); setManualClosed(data.manualClosed === true); setDeliveryFee(String(data.deliveryFee ?? 0)); setMinimumOrder(String(data.minimumOrder ?? 0)); setOfferTitle(data.offerTitle || ""); setOfferDescription(data.offerDescription || ""); setOfferExpiresAt(data.offerExpiresAt || ""); setScrollingText(data.scrollingText || "");
          if (isLiveShop) {
            await loadProducts(data.id);
            const orderResult = await getDocs(query(collection(db, "orders"), where("shopId", "==", data.id)));
            setOrders(orderResult.docs.map(item => ({ id: item.id, ...item.data() } as Order)));
          }
        }
      } catch (e) { setError(e instanceof Error ? e.message : "Could not load your shop."); }
      finally { setLoading(false); }
    });
  }, [router]);

  // Refresh approval/payment state while the shopkeeper page is open.
  // Admin changes are made from a separate session, so a one-time page load can otherwise stay stale.
  useEffect(() => {
    if (!db || !user || !shop) return;
    const firestore = db;
    const ownerUid = user.uid;
    let active = true;
    const refreshApprovalState = async () => {
      try {
        const result = await getDocs(query(collection(firestore, "shops"), where("ownerUid", "==", ownerUid)));
        const owned = result.docs[0];
        if (!owned || !active) return;
        const latest = { id: owned.id, ...owned.data() } as Shop;
        setShop(latest);
        await loadShopAdminNotices(latest.id);
        const lock = await getDoc(doc(firestore, "paymentPendingLocks", latest.id));
        if (!active) return;
        const isLive = ["live", "LIVE", "Live"].includes(String(latest.status || ""));
        setPendingPayment(lock.exists() && !isLive);
        if (isLive) {
          await loadProducts(latest.id);
          const orderResult = await getDocs(query(collection(firestore, "orders"), where("shopId", "==", latest.id)));
          if (active) setOrders(orderResult.docs.map(item => ({ id: item.id, ...item.data() } as Order)));
          // Keep sections closed until the shopkeeper selects one.
        }
      } catch (refreshError) {
        if (active) setError(refreshError instanceof Error ? refreshError.message : "Shop status refresh नहीं हो पाया।");
      }
    };
    const onFocus = () => { void refreshApprovalState(); };
    window.addEventListener("focus", onFocus);
    const interval = window.setInterval(() => { void refreshApprovalState(); }, 15000);
    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
      window.clearInterval(interval);
    };
  }, [user?.uid, shop?.id]);

  useEffect(() => {
    if (!db || !shop) return;
    getDoc(doc(db, "siteSettings", "branding"))
      .then((snapshot) => setAdminUpiQr(snapshot.exists() ? String(snapshot.data().upiQrDataUrl || "") : ""))
      .catch(() => setAdminUpiQr(""));
  }, [shop?.id]);

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
    const firestore = db;
    const items = products.filter(p => Number(saleQty[p.id] || 0) > 0).map(p => ({ productId:p.id, name:p.name || "Product", quantity:Number(saleQty[p.id]), price:Number(p.price || 0) }));
    if (!items.length) { setCustomerMessage("बिल में कम-से-कम एक प्रोडक्ट जोड़ें।"); return; }
    const subtotal = items.reduce((sum,item)=>sum+item.price*item.quantity,0);
    const rawDiscount = Math.max(0,Number(discountValue)||0);
    const discount = Math.min(subtotal, discountType === "percent" ? subtotal*Math.min(rawDiscount,100)/100 : rawDiscount);
    const total = Math.max(0,subtotal-discount);
    setCustomerBusy(true); setCustomerMessage("");
    try {
      const saleRef = doc(collection(firestore, "sales"));
      const productRefs = items.map((item) => ({
        item,
        ref: doc(firestore, "shops", shop.id, "products", item.productId),
      }));

      await runTransaction(firestore, async (transaction) => {
        const snapshots = await Promise.all(productRefs.map(({ ref }) => transaction.get(ref)));
        snapshots.forEach((snapshot, index) => {
          if (!snapshot.exists()) {
            throw new Error(`प्रोडक्ट "${items[index].name}" अब उपलब्ध नहीं है।`);
          }
        });

        transaction.set(saleRef, {
          shopId: shop.id,
          shopName: shop.name || shop.shopName || "",
          ownerUid: user.uid,
          customerUid: customer.uid,
          customerPhone: customer.phone,
          customerName: customer.name || "",
          items,
          subtotal,
          discount,
          discountType,
          total,
          paymentStatus: salePayment,
          createdAt: serverTimestamp(),
        });
      });

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

  const alreadyLiveShop = Boolean(shop && ["live", "LIVE", "Live"].includes(String(shop.status || "")));
  const firstListingPayment = Boolean(shop && !alreadyLiveShop && shop.initialPaymentVerified !== true && !shop.subscriptionExpiresAt);
  const subscriptionAmount = firstListingPayment ? 599 : 299;
  const subscriptionExpiry = shop?.subscriptionExpiresAt && typeof (shop.subscriptionExpiresAt as { toDate?: () => Date }).toDate === "function" ? (shop.subscriptionExpiresAt as { toDate: () => Date }).toDate() : shop?.subscriptionExpiresAt instanceof Date ? shop.subscriptionExpiresAt : null;
  const subscriptionPaymentDue = firstListingPayment || Boolean(subscriptionExpiry && subscriptionExpiry.getTime() <= Date.now());
  const subscriptionDaysRemaining = subscriptionExpiry
    ? Math.ceil((new Date(subscriptionExpiry.getFullYear(), subscriptionExpiry.getMonth(), subscriptionExpiry.getDate()).getTime() - new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime()) / 86400000)
    : null;
  const subscriptionExpiryLabel = subscriptionExpiry
    ? subscriptionExpiry.toLocaleDateString("hi-IN", { day: "numeric", month: "long", year: "numeric" })
    : "";

  async function submitSubscription(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db || !shop || !user) {
      setPaymentError("आपका लॉगिन या दुकान की जानकारी उपलब्ध नहीं है। कृपया पेज रीफ्रेश करके दोबारा लॉगिन करें।");
      return;
    }
    const normalizedUtr = utr.trim().toUpperCase().replace(/\s+/g, "");
    if (!normalizedUtr) {
      setPaymentError("पहले payment करें और payment के बाद मिला UTR नंबर यहाँ डालें।");
      return;
    }
    setBusy(true); setError(""); setPaymentError(""); setPaymentNotice("");
    try {
      if (!/^[A-Z0-9]{6,40}$/.test(normalizedUtr)) {
        throw new Error("Please enter a valid UTR (6–40 letters or numbers).");
      }
      const paymentRef = doc(collection(db, "subscriptionPayments"));
      const reservationRef = doc(db, "utrReservations", normalizedUtr);
      const pendingLockRef = doc(db, "paymentPendingLocks", shop.id);
      await runTransaction(db, async (transaction) => {
        const reservation = await transaction.get(reservationRef);
        const pendingLock = await transaction.get(pendingLockRef);
        if (pendingLock.exists()) throw new Error("आपकी एक payment पहले से verification के लिए pending है। Admin के निर्णय तक दूसरी payment जमा न करें।");
        if (reservation.exists()) {
          throw new Error("This UTR has already been submitted. Please check the number or contact admin.");
        }
        transaction.set(reservationRef, {
          ownerUid: user.uid,
          shopId: shop.id,
          paymentId: paymentRef.id,
          createdAt: serverTimestamp()
        });
        transaction.set(pendingLockRef, { ownerUid: user.uid, shopId: shop.id, paymentId: paymentRef.id, createdAt: serverTimestamp() });
        transaction.set(paymentRef, {
          ownerUid: user.uid,
          shopId: shop.id,
          amount: subscriptionAmount,
          paymentType: firstListingPayment ? "initial_listing" : "monthly_renewal",
          utr: normalizedUtr,
          status: "pending",
          createdAt: serverTimestamp()
        });
      });
      setPaymentNotice(`₹${subscriptionAmount} ${firstListingPayment ? "first listing" : "monthly renewal"} payment details submitted. Admin verification is pending.`);
      setPendingPayment(true);
      setUtr("");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Payment details could not be submitted.";
      setPaymentError(message.toLowerCase().includes("permission")
        ? "UTR जमा नहीं हुआ: Firebase permission की समस्या है। कृपया अभी दोबारा भुगतान न करें और Admin से संपर्क करें।"
        : `UTR जमा नहीं हुआ: ${message}`);
    }
    finally { setBusy(false); }
  }

  async function openPaymentHistory() {
    setActiveShopSection("payments");
    if (!db || !shop || !user) return;
    setPaymentHistoryLoading(true);
    try {
      const result = await getDocs(query(collection(db, "subscriptionPayments"), where("shopId", "==", shop.id), where("ownerUid", "==", user.uid)));
      const rows = result.docs.map(item => ({ id: item.id, ...item.data() } as SubscriptionPayment));
      rows.sort((a, b) => (b.createdAt?.toDate?.().getTime() || 0) - (a.createdAt?.toDate?.().getTime() || 0));
      setPaymentHistory(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment history load नहीं हो सकी।");
    } finally {
      setPaymentHistoryLoading(false);
    }
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db || !shop) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await updateDoc(doc(db, "shops", shop.id), { name: name.trim(), shopName: name.trim(), phone: phone.trim(), city: city.trim(), address: address.trim(), description: description.trim(), logoUrl, bannerUrl, pickupAvailable, deliveryAvailable, openingTime, closingTime, closedDays, manualClosed, deliveryFee: Math.max(0, Number(deliveryFee) || 0), minimumOrder: Math.max(0, Number(minimumOrder) || 0), updatedAt: serverTimestamp() });
      setShop({ ...shop, name: name.trim(), shopName: name.trim(), phone, city, address, description, logoUrl, bannerUrl, pickupAvailable, deliveryAvailable, openingTime, closingTime, closedDays, manualClosed, deliveryFee: Math.max(0, Number(deliveryFee) || 0), minimumOrder: Math.max(0, Number(minimumOrder) || 0), offerTitle: offerTitle.trim(), offerDescription: offerDescription.trim(), offerExpiresAt, scrollingText: scrollingText.trim() });
      setNotice("सेव हो गया। दुकान की जानकारी सफलतापूर्वक अपडेट हो गई है।");
    } catch (e) { setError(e instanceof Error ? e.message : "Profile update failed."); }
    finally { setBusy(false); }
  }

  async function saveScrollingText() {
    if (!db || !shop) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const value = scrollingText.trim();
      await updateDoc(doc(db, "shops", shop.id), { scrollingText: value, updatedAt: serverTimestamp() });
      setShop({ ...shop, scrollingText: value });
      setNotice(value ? "Scrolling message सेव हो गया।" : "Scrolling message हटा दिया गया।");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scrolling message सेव नहीं हो सका।");
    } finally { setBusy(false); }
  }

  async function saveOffer() {
    if (!db || !shop) return;
    if (!offerTitle.trim() && !offerDescription.trim()) {
      setError("Offer title ya details likhein. Offer hatane ke liye नीचे हटाएँ बटन दबाएँ।");
      return;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      const isFirstPublication = !(shop.offerTitle?.trim() || shop.offerDescription?.trim()) && Boolean(offerTitle.trim() || offerDescription.trim());
      const offer = { offerTitle: offerTitle.trim(), offerDescription: offerDescription.trim(), offerExpiresAt, updatedAt: serverTimestamp() };
      await updateDoc(doc(db, "shops", shop.id), offer);
      setShop({ ...shop, offerTitle: offer.offerTitle, offerDescription: offer.offerDescription, offerExpiresAt });
      if (isFirstPublication) {
        try {
          await setDoc(doc(db, "notifications", shop.id + "_offer_" + Date.now()), {
            type: "offer", shopId: shop.id, shopName: shop.name || shop.shopName || "Ice Cream Shop",
            title: offer.offerTitle || "New shop offer",
            body: offer.offerDescription || "इस दुकान पर नया ऑफर आया है।",
            createdAt: serverTimestamp()
          });
        } catch { /* Notification failure must not undo a saved offer. */ }
      }
      setNotice(isFirstPublication ? "नया Offer सेव हो गया। ग्राहकों को सूचना दिखाई देगी।" : "Offer customer page पर अपडेट हो गया।");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Offer save नहीं हो सका।");
    } finally { setBusy(false); }
  }

  async function deleteOffer() {
    if (!db || !shop) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await updateDoc(doc(db, "shops", shop.id), { offerTitle: "", offerDescription: "", offerExpiresAt: "", updatedAt: serverTimestamp() });
      setOfferTitle(""); setOfferDescription(""); setOfferExpiresAt("");
      setShop({ ...shop, offerTitle: "", offerDescription: "", offerExpiresAt: "" });
      setNotice("Offer हटा दिया गया। अब customers को नहीं दिखेगा।");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Offer हटाया नहीं जा सका।");
    } finally { setBusy(false); }
  }

  async function compressProductImage(file: File) {
    setImageBusy(true); setError("");
    try {
      const result = await compressImageToWebP(file, { targetWidth: 800, targetHeight: 450, fit: "contain", maxBytes: 100 * 1024, initialQuality: 0.84 });
      setImageUrl(result); setNotice("Product photo 800 × 450 px WebP mein compress ho gayi (100 KB se kam). Ab save kar sakte hain.");
    } catch (e) { setError(e instanceof Error ? e.message : "Image compression failed."); }
    finally { setImageBusy(false); }
  }

  async function compressProfileImage(file: File, target: "logo" | "banner") {
    setImageBusy(true); setError("");
    try {
      const result = await compressImageToWebP(file, {
        maxDimension: target === "logo" ? 600 : 1400,
        maxBytes: target === "logo" ? 100 * 1024 : 220 * 1024,
        initialQuality: 0.84,
      });
      if (target === "logo") setLogoUrl(result); else setBannerUrl(result);
      setNotice((target === "logo" ? "Logo" : "Banner") + " automatically compressed to WebP. Save shop profile to apply it.");
    } catch (e) { setError(e instanceof Error ? e.message : "Image compression failed."); }
    finally { setImageBusy(false); }
  }

  function resetProduct() { setProductId(""); setProductName(""); setProductDescription(""); setPrice(""); setImageUrl(""); setProductActive(true); setProductCategory("Ice cream"); setOriginalPrice(""); }

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setNotice("");
    if (!db || !shop || !user) {
      setError("Shop login/session nahi mila. Please sign in karke dobara try karein.");
      return;
    }
    if ((shop.status || "").toLowerCase() !== "live") {
      setError("Product add karne ke liye shop ka status LIVE hona zaroori hai.");
      return;
    }
    const cleanName = productName.trim();
    const sellingPrice = Number(price);
    const comparePrice = originalPrice.trim() ? Number(originalPrice) : null;
    if (!cleanName || !price.trim() || !Number.isFinite(sellingPrice) || sellingPrice < 0) {
      setError("Product name aur valid selling price zaroor bharein.");
      return;
    }
    if (comparePrice !== null && (!Number.isFinite(comparePrice) || comparePrice < sellingPrice)) {
      setError("Original price, selling price ke barabar ya usse zyada hona chahiye.");
      return;
    }
    setBusy(true);
    setNotice("Product save ho raha hai…");
    const data = { shopId: shop.id, ownerUid: user.uid, name: cleanName, description: productDescription.trim(), price: sellingPrice, originalPrice: comparePrice, category: productCategory, imageUrl: imageUrl.trim(), active: productActive, updatedAt: serverTimestamp() };
    try {
      if (productId) {
        await updateDoc(doc(db, "shops", shop.id, "products", productId), data);
      } else {
        const createdProduct = await addDoc(collection(db, "shops", shop.id, "products"), { ...data, createdAt: serverTimestamp() });
        if (productActive) {
          let homepageNoticeSaved = false;
          let pushStatus = "";
          try {
            await setDoc(doc(db, "notifications", "product_" + shop.id + "_" + createdProduct.id), { type: "product", shopId: shop.id, shopName: shop.name || shop.shopName || "Ice Cream Shop", productId: createdProduct.id, title: "नया प्रोडक्ट: " + cleanName, body: (shop.name || shop.shopName || "दुकान") + " में नया प्रोडक्ट जुड़ा है। कीमत ₹" + sellingPrice, createdAt: serverTimestamp() });
            homepageNoticeSaved = true;
          } catch (noticeError) {
            homepageNoticeSaved = false;
            pushStatus = "Homepage notice save नहीं हुआ: " + (noticeError instanceof Error ? noticeError.message : "Firestore error");
          }
          try {
            const idToken = await user.getIdToken();
            const response = await fetch("/api/push/new-product", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + idToken }, body: JSON.stringify({ shopId: shop.id, productId: createdProduct.id }) });
            const result = await response.json().catch(() => ({})) as { sent?: number; failed?: number; subscribers?: number; message?: string; error?: string; failures?: { code?: string; message?: string }[] };
            if (!response.ok) {
              pushStatus = "Device push नहीं भेजा गया: " + (result.error || "HTTP " + response.status);
            } else if ((result.sent || 0) > 0) {
              pushStatus = "Push notification " + result.sent + " device(s) पर भेजा गया।";
            } else if ((result.subscribers || 0) === 0) {
              pushStatus = "कोई customer device notification के लिए registered नहीं है।";
            } else {
              const reason = result.failures?.[0]?.code || result.message || "FCM delivery failed";
              pushStatus = "FCM ने " + (result.failed || 0) + " device(s) को स्वीकार नहीं किया: " + reason;
            }
          } catch (pushError) {
            pushStatus = "Device push नहीं भेजा जा सका: " + (pushError instanceof Error ? pushError.message : "Network error");
          }
          if (!pushStatus) pushStatus = "Product notice और device push की प्रक्रिया पूरी हुई।";
          if (!homepageNoticeSaved) pushStatus = "Homepage notice भी save नहीं हुआ। " + pushStatus;
          else pushStatus = "Homepage notice save हो गया। " + pushStatus;
          // Keep this result after the product list refresh; don't overwrite a delivery failure with a success message.
          await loadProducts(shop.id); resetProduct(); setNotice("Product successfully added. " + pushStatus);
          return;
        }
      }
      await loadProducts(shop.id); resetProduct(); setNotice(productId ? "Product updated." : "Product added successfully.");
    } catch (e) {
      const detail = e instanceof Error ? e.message : "Unknown error";
      setError(detail.includes("permission") || detail.includes("Permission")
        ? "Firebase permission denied. Shop LIVE/subscription status aur published Firestore Rules check karni hongi."
        : "Product save nahi hua: " + detail);
      setNotice("");
    } finally { setBusy(false); }
  }

  async function removeProduct(id: string) {
    if (!db || !shop || !confirm("Delete this product?")) return;
    try { await deleteDoc(doc(db, "shops", shop.id, "products", id)); await loadProducts(shop.id); setNotice("Product deleted."); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not delete product."); }
  }

  // Admin-approved LIVE status is the source of truth for shop access.
  // Do not hide products or dashboard features because older LIVE records lack subscription metadata.
  const live = ["live", "LIVE", "Live"].includes(String(shop?.status || ""));
  return <main className="admin-wrap">
    <header className="admin-header"><Link href="/" className="admin-brand">🍦 MY ICE CREAM <span>SHOP</span></Link><div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}><Link href="/" className="admin-secondary role-link">Home page</Link><button className="admin-secondary" onClick={() => auth && signOut(auth)}>Sign out</button></div></header>
    {loading ? <section className="admin-panel"><h1>Loading your shop…</h1></section> : !shop ?
      <section className="admin-panel"><h1>Register your shop</h1><p>Shopkeeper access starts with a separate shop registration. Admin approval is required before your shop is LIVE.</p><Link href="/shop/register" className="admin-primary role-link">Register Shop</Link></section> :
      <>
        <section className="admin-heading"><div><p className="admin-kicker">SHOPKEEPER AREA</p><h1>{shop.name || shop.shopName || "My Shop"}</h1><p>{shop.city || ""} · Status: <span className={"admin-status " + (shop.status || "pending")}>{(shop.status || "pending").toLowerCase() === "live" ? "APPROVED" : (shop.status || "pending").toUpperCase()}</span></p></div></section>
        {adminNotices.length > 0 && <section className="admin-panel" aria-label="Admin की निजी Shopkeeper सूचना" style={{border:"2px solid #f0b64d",background:"linear-gradient(135deg,#fff9e8,#fff1f2)"}}><p className="admin-kicker">🔔 ADMIN NOTICE · केवल SHOPKEEPER के लिए</p><h2 style={{marginTop:0}}>दुकान के लिए जरूरी सूचना</h2>{adminNotices.map((item) => <article key={item.id} style={{padding:"12px 0",borderTop:"1px solid #f2d9a6"}}><h3 style={{margin:"0 0 6px"}}>{item.title || "Admin सूचना"}</h3><p style={{whiteSpace:"pre-wrap",margin:"0 0 6px"}}>{item.body || ""}</p><small className="admin-muted">{item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString("hi-IN") : ""}</small></article>)}</section>}

        <section className="admin-panel" aria-live="polite">
          <p className="admin-kicker">REGISTRATION TRACKING</p>
          <h2>आपकी दुकान की स्थिति</h2>
          <p><strong className={"admin-status " + String(shop.status || "pending").toLowerCase()}>{String(shop.status || "pending").toLowerCase() === "live" ? "APPROVED · दुकान LIVE है" : String(shop.status || "pending").toUpperCase()}</strong></p>
          {String(shop.status || "pending").toLowerCase() === "pending" && <p>{pendingPayment ? "आपका UTR मिल गया है। Admin payment verify कर रहा है। कृपया दोबारा भुगतान या UTR submit न करें।" : shop.initialPaymentVerified === true && subscriptionExpiry && subscriptionExpiry.getTime() > Date.now() ? "आपका payment verify हो चुका है। अब Admin आपकी दुकान की अंतिम जाँच करके LIVE करेगा।" : "आपकी registration सेव है। पहले UPI से payment करें और payment के बाद मिला UTR यहाँ submit करें। Admin verification और shop approval के बाद दुकान LIVE होगी।"}</p>}
          {String(shop.status || "").toLowerCase() === "rejected" && <p>Registration reject हुई है। कृपया Admin से संपर्क करें और सही जानकारी अपडेट करें।</p>}
          {String(shop.status || "").toLowerCase() === "inactive" && <p>आपकी दुकान फिलहाल inactive है। दोबारा चालू करने के लिए Admin से संपर्क करें।</p>}
          {pendingPayment && <p><strong>Payment status: PENDING VERIFICATION</strong> · Admin आपके UTR की जाँच कर रहा है। कृपया दोबारा भुगतान न करें।</p>}
          {String(shop.status || "").toLowerCase() === "live" && <>
            <p>आपकी दुकान Approved है और customers को दिखाई दे रही है।</p>
            {subscriptionDaysRemaining === null ? <p className="admin-muted">अगली recharge तारीख अभी Admin ने सेट नहीं की है।</p> :
              <div style={{marginTop:12,padding:14,borderRadius:12,border:"1px solid #f0c36d",background:subscriptionDaysRemaining <= 7 ? "#fff7e6" : "#f0faf3"}}>
                <h3 style={{margin:"0 0 8px"}}>Subscription / Recharge</h3>
                <p style={{margin:"4px 0"}}><strong>अगली recharge तारीख:</strong> {subscriptionExpiryLabel}</p>
                {subscriptionDaysRemaining > 7
                  ? <p style={{margin:"4px 0"}}>Recharge में <strong>{subscriptionDaysRemaining} दिन बाकी</strong> हैं।</p>
                  : subscriptionDaysRemaining > 1
                    ? <p style={{margin:"4px 0",color:"#9a5700"}}><strong>Reminder:</strong> आपकी recharge में केवल {subscriptionDaysRemaining} दिन बाकी हैं। समय रहते ₹299 recharge कर दें।</p>
                    : subscriptionDaysRemaining === 1
                      ? <p style={{margin:"4px 0",color:"#9a5700"}}><strong>Recharge reminder:</strong> कल आपकी subscription समाप्त हो रही है। आज ही ₹299 recharge करें।</p>
                      : subscriptionDaysRemaining === 0
                        ? <p style={{margin:"4px 0",color:"#b45309"}}><strong>आज recharge की आखिरी तारीख है!</strong> सेवा जारी रखने के लिए ₹299 recharge करें।</p>
                        : <p style={{margin:"4px 0",color:"#b91c1c"}}><strong>Subscription समाप्त हो गई है।</strong> {Math.abs(subscriptionDaysRemaining)} दिन पहले expiry हो चुकी है। तुरंत ₹299 recharge करें।</p>}
                {subscriptionPaymentDue && !pendingPayment && <button type="button" className="admin-primary" onClick={()=>document.getElementById("subscription-payment")?.scrollIntoView({behavior:"smooth",block:"start"})}>अभी Recharge करें</button>}
              </div>}
          </>}
        </section>
        {subscriptionPaymentDue && !pendingPayment && String(shop.status || "").toLowerCase() !== "rejected" && <section className="admin-panel" id="subscription-payment" style={{border:"2px solid #f0a43a",scrollMarginTop:24}}>
          <p className="admin-kicker">PAYMENT REQUIRED · UPI</p>
          <h2>{firstListingPayment ? "पहली दुकान लिस्टिंग फीस · ₹599" : "मासिक रिन्यूअल · ₹299"}</h2>
          <p>{firstListingPayment ? "दुकान की पहली listing के लिए ₹599 जमा करें। UTR submit होने के बाद Admin payment verify करेगा; approval के बाद दुकान LIVE होगी।" : "आपकी अगली 30 दिन की subscription फीस ₹299 है।"}</p>
          {adminUpiQr ? <div style={{textAlign:"center",margin:"12px auto",maxWidth:300}}><img src={adminUpiQr} alt="Admin UPI QR Code" style={{width:"100%",maxWidth:240,objectFit:"contain",borderRadius:12,border:"1px solid #ddd",padding:8,background:"#fff"}}/><p className="admin-muted">UPI QR · ₹{subscriptionAmount}</p></div> : <p className="admin-error">Admin ने अभी UPI QR सेट नहीं किया है। Admin से संपर्क करें।</p>}
          {adminUpiQr ? <form className="register-form" onSubmit={submitSubscription}><label>UPI transaction UTR<input required value={utr} onChange={e=>{setUtr(e.target.value.toUpperCase().replace(/\s+/g,""));setPaymentError("");}} placeholder="पहले payment करें, फिर UTR नंबर डालें" /></label>{utr.trim() && <button type="submit" className="admin-primary" disabled={busy||pendingPayment}>{busy?"UTR जमा हो रहा है…":`Submit ₹${subscriptionAmount} payment`}</button>}{!utr.trim() && <p className="admin-muted">पहले ऊपर दिए गए UPI QR से payment करें। Payment के बाद मिला UTR नंबर डालने पर ही Submit button दिखाई देगा।</p>}</form> : <p className="admin-error">Payment अभी उपलब्ध नहीं है। Admin ने UPI QR सेट नहीं किया है। QR सेट होने तक भुगतान न करें।</p>}
          {paymentError&&<p className="admin-error" role="alert" style={{marginTop:12}}>{paymentError}</p>}{paymentNotice&&<p className="admin-success" role="status">{paymentNotice}</p>}{pendingPayment&&<p className="admin-muted">Payment verification pending — कृपया दोबारा भुगतान न करें।</p>}
        </section>}
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
              {products.filter(p=>p.active!==false).map(p=><label key={p.id}>{p.name} · ₹{Number(p.price||0).toFixed(2)}<input type="number" min="0" step="1" value={saleQty[p.id]||0} onChange={e=>setSaleQty(v=>({...v,[p.id]:Math.max(0,Number(e.target.value)||0)}))}/></label>)}
              <label>Discount type<select value={discountType} onChange={e=>setDiscountType(e.target.value as "amount"|"percent")}><option value="amount">₹ Amount</option><option value="percent">Percent (%)</option></select></label>
              <label>Discount<input type="number" min="0" step="0.01" value={discountValue} onChange={e=>setDiscountValue(e.target.value)}/></label>
              <label>Payment status<select value={salePayment} onChange={e=>setSalePayment(e.target.value as "paid"|"unpaid")}><option value="paid">Paid</option><option value="unpaid">Unpaid</option></select></label>
              <button type="button" className="admin-primary" disabled={customerBusy||products.length===0} onClick={()=>void createWalkInSale()}>{customerBusy?"बिल सेव हो रहा है…":"बिल सेव करें"}</button>
              {whatsAppUrl && <a className="admin-primary role-link" href={whatsAppUrl} target="_blank" rel="noopener noreferrer">WhatsApp पर बिल भेजें</a>}
            </div>
          </>}
        </section>
        <section className="admin-panel">
          <p className="admin-kicker">SHOP MANAGEMENT</p><h2>Shopkeeper menu</h2>
          <p>Har option par click karke uski details alag se kholen.</p>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            <button type="button" className={activeShopSection === "profile" ? "admin-primary" : "admin-secondary"} onClick={()=>setActiveShopSection(activeShopSection === "profile" ? "" : "profile")}>Shop Reg. Details</button>
            <button type="button" className={activeShopSection === "payments" ? "admin-primary" : "admin-secondary"} onClick={()=>{if(activeShopSection === "payments")setActiveShopSection("");else void openPaymentHistory();}}>Payment History</button>
            <button type="button" className={activeShopSection === "products" ? "admin-primary" : "admin-secondary"} onClick={()=>{resetProduct();setActiveShopSection(activeShopSection === "products" ? "" : "products");}}>Add Product</button>
            <button type="button" className={activeShopSection === "myProducts" ? "admin-primary" : "admin-secondary"} onClick={()=>setActiveShopSection(activeShopSection === "myProducts" ? "" : "myProducts")}>My Products</button>
            <button type="button" className={activeShopSection === "promotion" ? "admin-primary" : "admin-secondary"} onClick={()=>setActiveShopSection(activeShopSection === "promotion" ? "" : "promotion")}>Scrolling Message / Offer</button>
          </div>
        </section>
        {activeShopSection === "promotion" && <section className="admin-panel" id="shop-promotion" style={{scrollMarginTop:20}}>
          <p className="admin-kicker">SHOP PROMOTION</p><h2>Scrolling Message / Offer</h2>
          <h3>दुकान का Scrolling Message</h3>
          <form className="register-form" onSubmit={e=>{e.preventDefault();void saveScrollingText();}}>
            <label>ग्राहकों को दिखने वाला संदेश<textarea rows={2} maxLength={180} value={scrollingText} onChange={e=>setScrollingText(e.target.value)} placeholder="जैसे: आज सभी कुल्फी पर 10% छूट!" /></label>
            <p className="admin-muted">यह संदेश आपकी दुकान के पेज पर चलता हुआ दिखेगा। खाली करके सेव करने पर हट जाएगा।</p>
            <button className="admin-primary" disabled={busy}>{busy ? "सेव हो रहा है…" : "Scrolling Message सेव करें"}</button>
          </form>
          <hr />
          <h3>Customer Offer / Promotion</h3>
          <div className="register-form">
            <label>Offer title<input maxLength={60} value={offerTitle} onChange={e=>setOfferTitle(e.target.value)} placeholder="जैसे: Buy 2 Get 1 Free" /></label>
            <label>Offer details<textarea rows={2} maxLength={240} value={offerDescription} onChange={e=>setOfferDescription(e.target.value)} placeholder="ऑफर की जानकारी लिखें" /></label>
            <label>Offer valid until<input type="date" value={offerExpiresAt} onChange={e=>setOfferExpiresAt(e.target.value)} /></label>
            <div className="admin-actions" style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              <button type="button" className="admin-primary" disabled={busy} onClick={()=>void saveOffer()}>{busy ? "सेव हो रहा है…" : "Offer सेव करें"}</button>
              <button type="button" className="admin-secondary" disabled={busy||(!offerTitle&&!offerDescription&&!offerExpiresAt)} onClick={()=>void deleteOffer()}>Offer हटाएँ</button>
            </div>
            <p className="admin-muted">Offer सेव करने पर ग्राहक आपकी दुकान के पेज पर देख सकेंगे।</p>
          </div>
        </section>}
        {activeShopSection === "payments" && <section className="admin-panel" id="shop-payments" style={{scrollMarginTop:20}}><h2>Payment History</h2><p>आपकी दुकान की subscription payments और verification status.</p>
          {paymentHistoryLoading ? <p className="admin-muted">Payment history लोड हो रही है…</p> : paymentHistory.length === 0 ? <p className="admin-muted">अभी कोई payment record नहीं मिला।</p> :
            <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Date</th><th>Amount</th><th>Payment</th><th>UTR</th><th>Status</th></tr></thead><tbody>
              {paymentHistory.map(p=><tr key={p.id}><td>{p.createdAt?.toDate ? p.createdAt.toDate().toLocaleString("en-IN") : "—"}</td><td>₹{Number(p.amount||0).toFixed(2)}</td><td>{p.paymentType === "initial_listing" ? "First listing" : p.paymentType === "monthly_renewal" ? "Renewal" : p.paymentType || "Subscription"}</td><td>{p.utr || "—"}</td><td><span className={"admin-status " + String(p.status||"pending").toLowerCase()}>{String(p.status||"pending").toUpperCase()}</span></td></tr>)}
            </tbody></table></div>}
          <button type="button" className="admin-secondary" onClick={()=>void openPaymentHistory()}>Refresh history</button>
        </section>}
        {activeShopSection === "profile" && <section className="admin-panel" id="shop-profile" style={{scrollMarginTop:20}}><h2>Shop profile / Registration details</h2><p>Apni registration ki details yahan update karein. Changes save karne ke baad Admin ko updated details dikhengi.</p><form className="register-form" onSubmit={saveProfile}>
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
          <label>Shop logo (WebP compressed, max 300 KB)<input type="file" accept="image/*" onChange={e=>{const file=e.target.files?.[0];if(file)void compressProfileImage(file,"logo");}} /></label>{logoUrl&&<img src={logoUrl} alt="Shop logo preview" style={{width:80,height:80,objectFit:"cover",borderRadius:14}}/>}
          <label>Shop banner (WebP compressed, max 300 KB)<input type="file" accept="image/*" onChange={e=>{const file=e.target.files?.[0];if(file)void compressProfileImage(file,"banner");}} /></label>{bannerUrl&&<img src={bannerUrl} alt="Shop banner preview" style={{width:"100%",maxHeight:140,objectFit:"cover",borderRadius:14}}/>}
          <button className="admin-primary" disabled={busy||imageBusy}>{busy ? "सेव हो रहा है…" : "दुकान की जानकारी सेव करें"}</button>
        </form></section>}
        
        {activeShopSection === "products" && (live ? <section className="admin-panel" id="shop-add-product" style={{scrollMarginTop:20}}><h2>Add Product</h2><p>Add your products with price and photo. Only active LIVE shops are visible to customers.</p>
          <form className="register-form" onSubmit={saveProduct}>
            <label>Product name<input required value={productName} onChange={e=>setProductName(e.target.value)} placeholder="e.g. Chocolate Sundae" /></label>
            <label>Description<input value={productDescription} onChange={e=>setProductDescription(e.target.value)} /></label>
            <label>Category<select value={productCategory} onChange={e=>setProductCategory(e.target.value)}><option>Ice cream</option><option>Kulfi</option><option>Cones</option><option>Family packs</option><option>Shakes</option><option>Other</option></select></label>
            <label>Selling price (₹)<input required type="number" min="0" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} /></label>
            <label>Original price (₹, optional)<input type="number" min="0" step="0.01" value={originalPrice} onChange={e=>setOriginalPrice(e.target.value)} /></label>
            <label><input type="checkbox" checked={productActive} onChange={e=>setProductActive(e.target.checked)} /> Show this product to customers</label>
            <label>Product photo (800 × 450 px · WebP · 100 KB se kam)<input type="file" accept="image/*" onChange={e=>{const file=e.target.files?.[0];if(file)void compressProductImage(file);}} /></label>{imageUrl && <div><img src={imageUrl} alt="Product preview" style={{maxWidth:140,maxHeight:100,borderRadius:12}}/><button type="button" className="admin-secondary small" onClick={()=>setImageUrl("")}>Remove photo</button></div>}{imageBusy && <p className="admin-muted">Compressing image…</p>}
            <div><button type="submit" className="admin-primary" disabled={busy||imageBusy}>{busy ? "Saving product…" : productId ? "Update product" : "Add product"}</button>{productId && <button type="button" className="admin-secondary" onClick={resetProduct}>Cancel edit</button>}</div>
          </form>
        </section> : <section className="admin-panel"><h2>Approval pending</h2><p>Product management unlocks after Admin approves your shop and changes its status to LIVE.</p></section>)}
        {activeShopSection === "myProducts" && (live ? <section className="admin-panel" id="shop-my-products" style={{scrollMarginTop:20}}><p className="admin-kicker">PRODUCT INVENTORY</p><h2>My Products · आपके सभी प्रोडक्ट</h2><p>यहाँ आपकी दुकान में जोड़े गए सभी प्रोडक्ट दिखेंगे। आप किसी भी प्रोडक्ट को Edit या Delete कर सकते हैं।</p>
          <p><strong>Total products: {products.length}</strong> · Visible: {products.filter(p=>p.active!==false).length} · Hidden: {products.filter(p=>p.active===false).length}</p>
          {products.length===0 ? <p className="admin-muted">अभी कोई प्रोडक्ट नहीं जोड़ा गया है। Add Product बटन से पहला प्रोडक्ट जोड़ें।</p> :
            <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Photo</th><th>Product details</th><th>Price</th><th>Visibility</th><th>Actions</th></tr></thead><tbody>
              {products.map(p=><tr key={p.id}>
                <td>{p.imageUrl ? <img src={p.imageUrl} alt={p.name || "Product"} style={{width:64,height:64,objectFit:"cover",borderRadius:10}}/> : "—"}</td>
                <td><strong>{p.name || "Unnamed product"}</strong><small>{p.category || "Other"}{p.description ? " · "+p.description : ""}</small></td>
                <td>₹{Number(p.price||0).toFixed(2)}{p.originalPrice && p.originalPrice>Number(p.price||0) ? <small><s>₹{Number(p.originalPrice).toFixed(2)}</s></small> : null}</td>
                <td><span className={"admin-status "+(p.active===false?"inactive":"live")}>{p.active===false?"Hidden":"Visible"}</span></td>
                <td className="admin-actions"><button type="button" className="admin-secondary small" onClick={()=>{setProductId(p.id);setProductName(p.name||"");setProductDescription(p.description||"");setPrice(String(p.price??""));setOriginalPrice(String(p.originalPrice??""));setProductCategory(p.category||"Ice cream");setImageUrl(p.imageUrl||"");setProductActive(p.active!==false);setActiveShopSection("products");}}>Edit</button><button type="button" className="admin-secondary small" onClick={()=>void removeProduct(p.id)}>Delete</button></td>
              </tr>)}
            </tbody></table></div>}
          <button type="button" className="admin-secondary" disabled={productsRefreshing} onClick={()=>void refreshProducts()}>{productsRefreshing ? "Refreshing…" : "Refresh list"}</button>
          {productRefreshMessage && <p className="admin-muted" role="status">{productRefreshMessage}</p>}
        </section> : <section className="admin-panel"><h2>Approval pending</h2><p>My Products देखने और manage करने के लिए Admin approval के बाद दुकान LIVE होना जरूरी है।</p></section>)}
      </>
    }
    {user && <p className="admin-muted">Signed in as {user.email}</p>}
  </main>;
}

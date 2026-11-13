"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, doc, getDocs, runTransaction } from "firebase/firestore/lite";
import { auth, db } from "@/lib/firebase";
import { isAdminEmail } from "@/lib/admin";

type ShopDetails = { id: string; name?: string; shopName?: string; ownerName?: string; ownerEmail?: string; ownerUid?: string; phone?: string; city?: string; address?: string; description?: string; status?: string; createdAt?: { toDate?: () => Date }; utr?: string; paymentId?: string };
type Payment = { id: string; ownerUid?: string; shopId?: string; shopName?: string; amount?: number; paymentType?: "initial_listing" | "monthly_renewal"; utr?: string; status?: string; createdAt?: { toDate?: () => Date }; shopDetails?: ShopDetails };

export default function AdminPaymentsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<Payment[]>([]);
  const [shopsWithoutPayment, setShopsWithoutPayment] = useState<ShopDetails[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");

  async function loadPayments() {
    if (!db) return;
    const firestore = db;
    const [result, shopsResult, reservationsResult] = await Promise.all([
      getDocs(collection(firestore, "subscriptionPayments")),
      getDocs(collection(firestore, "shops")),
      getDocs(collection(firestore, "utrReservations")),
    ]);
    const privateByShop = new Map<string, { ownerUid?: string; ownerName?: string; ownerEmail?: string }>();
    try {
      const privateShopsResult = await getDocs(collection(firestore, "shopPrivate"));
      for (const item of privateShopsResult.docs) privateByShop.set(item.id, item.data());
    } catch {
      // Preserve the legacy payment list until the private-record rules are published.
    }
    const allShops = shopsResult.docs.map((item) => {
      const publicData = item.data();
      const privateData = privateByShop.get(item.id) || {};
      return {
        id: item.id, ...publicData,
        ownerUid: privateData.ownerUid || publicData.ownerUid,
        ownerName: privateData.ownerName || publicData.ownerName,
        ownerEmail: privateData.ownerEmail || publicData.ownerEmail,
      } as ShopDetails;
    });
    const reservations = reservationsResult.docs.map((item) => ({ id: item.id, ...item.data() } as { id: string; shopId?: string; paymentId?: string }));
    const payments = await Promise.all(result.docs.map(async (item) => {
      const payment = { id: item.id, ...item.data() } as Payment;
      if (!payment.shopId) return payment;
      const shopDetails = allShops.find((shop) => shop.id === payment.shopId);
      return { ...payment, shopDetails };
    }));
    const paymentShopIds = new Set(payments.map((payment) => payment.shopId).filter(Boolean));
    setShopsWithoutPayment(allShops.filter((shop) => !paymentShopIds.has(shop.id) && ["pending", "rejected"].includes(String(shop.status || "pending").toLowerCase())).map((shop) => {
      const reservation = reservations.find((item) => item.shopId === shop.id);
      return { ...shop, utr: reservation?.id, paymentId: reservation?.paymentId };
    }));
    setItems(payments);
  }

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) { router.replace("/admin"); return; }
      if (!isAdminEmail(nextUser.email) || !nextUser.emailVerified) { router.replace("/"); return; }
      if (!db) return;
      try { await loadPayments(); }
      catch (e) { setError(e instanceof Error ? e.message : "Payments could not be loaded."); }
      finally { setLoading(false); }
    });
  }, [router]);

  async function verify(payment: Payment) {
    if (!db || !payment.shopId || !user) return;
    const firestore = db;
    setBusyId(payment.id); setError("");
    try {
      await runTransaction(firestore, async (tx) => {
        const paymentRef = doc(firestore, "subscriptionPayments", payment.id);
        const shopRef = doc(firestore, "shops", payment.shopId!);
        const lockRef = doc(firestore, "paymentPendingLocks", payment.shopId!);
        const privateShopRef = doc(firestore, "shopPrivate", payment.shopId!);
        const paymentSnap = await tx.get(paymentRef);
        const shopSnap = await tx.get(shopRef);
        const privateShopSnap = await tx.get(privateShopRef);
        const lockSnap = await tx.get(lockRef);
        if (!paymentSnap.exists() || paymentSnap.data().status !== "pending") throw new Error("This payment is no longer pending.");
        if (!shopSnap.exists()) throw new Error("Shop record was not found.");
        if (!privateShopSnap.exists()) throw new Error("Private shop owner record is missing. Run the Admin privacy migration before approving this payment.");
        if (!lockSnap.exists() || lockSnap.data().paymentId !== payment.id) throw new Error("Pending payment lock does not match. Do not approve; inspect the records.");
        const data = paymentSnap.data();
        const shop = shopSnap.data();
        const privateShop = privateShopSnap.data();
        if (!privateShop || typeof privateShop.ownerUid !== "string") throw new Error("Private shop owner UID is missing. Run the Admin privacy migration before approving this payment.");
        const initial = data.paymentType === "initial_listing";
        if (!initial && data.paymentType !== "monthly_renewal") throw new Error("Unknown payment type. Do not approve this payment.");
        const expected = initial ? 599 : 299;
        if (data.amount !== expected) throw new Error(`Payment amount does not match ₹${expected}.`);
        if (typeof data.utr !== "string" || !/^[A-Z0-9]{6,40}$/.test(data.utr)) throw new Error("UTR is missing or invalid.");
        if (data.ownerUid !== privateShop.ownerUid || data.shopId !== payment.shopId) throw new Error("Payment owner or shop reference does not match.");
        if (initial && (shop.initialPaymentVerified === true || shop.subscriptionExpiresAt)) throw new Error("This shop already has an initial payment or subscription. Do not approve as first listing.");
        if (!initial && shop.initialPaymentVerified !== true && !shop.subscriptionExpiresAt) throw new Error("The first ₹599 listing payment has not been verified yet.");
        const current = shop.subscriptionExpiresAt?.toDate?.() as Date | undefined;
        const base = current && current.getTime() > Date.now() ? current : new Date();
        const expiry = new Date(base);
        expiry.setDate(expiry.getDate() + 30);
        tx.update(paymentRef, { status: "verified", verifiedAt: new Date(), verifiedBy: user.email });
        tx.update(shopRef, { ...(initial ? { initialPaymentVerified: true } : {}), subscriptionStatus: "active", subscriptionExpiresAt: expiry, status: shop.status === "live" ? "live" : "pending", updatedAt: new Date() });
        tx.delete(lockRef);
      });
      setItems((current) => current.map((item) => item.id === payment.id ? { ...item, status: "verified" } : item));
    } catch (e) { setError(e instanceof Error ? e.message : "Could not verify payment."); }
    finally { setBusyId(""); }
  }

  async function reject(payment: Payment) {
    if (!db || !payment.shopId) return;
    const firestore = db;
    setBusyId(payment.id); setError("");
    try {
      await runTransaction(firestore, async (tx) => {
        const paymentRef = doc(firestore, "subscriptionPayments", payment.id);
        const lockRef = doc(firestore, "paymentPendingLocks", payment.shopId!);
        const snapshot = await tx.get(paymentRef);
        const lock = await tx.get(lockRef);
        if (!snapshot.exists() || snapshot.data().status !== "pending") throw new Error("This payment is no longer pending.");
        if (lock.exists() && lock.data().paymentId === payment.id) tx.delete(lockRef);
        tx.update(paymentRef, { status: "rejected", verifiedAt: new Date(), verifiedBy: user?.email || "" });
      });
      setItems((current) => current.map((item) => item.id === payment.id ? { ...item, status: "rejected" } : item));
    } catch (e) { setError(e instanceof Error ? e.message : "Could not reject payment."); }
    finally { setBusyId(""); }
  }

  const visibleItems = items.filter((item) => statusFilter === "all" || (item.status || "pending") === statusFilter).sort((a, b) => {
    const at = a.createdAt?.toDate?.().getTime() || 0; const bt = b.createdAt?.toDate?.().getTime() || 0; return bt - at;
  });

  return <main className="admin-wrap">
    <header className="admin-header"><Link href="/admin" className="admin-brand">🍦 MY ICE CREAM <span>ADMIN</span></Link><Link href="/admin" className="admin-secondary">Dashboard</Link></header>
    <section className="admin-panel"><h1>Subscription payments</h1>
      <p>पहली दुकान listing ₹599 (पहले 30 दिन शामिल), उसके बाद हर 30 दिन में ₹299 renewal। यहाँ दुकान की पूरी जानकारी और UTR देखकर ही payment verify करें।</p>
      <div className="admin-filters"><label>Payment status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="pending">Pending</option><option value="verified">Verified</option><option value="rejected">Rejected</option><option value="all">All payments</option></select></label><button className="admin-secondary" onClick={() => { setLoading(true); setError(""); loadPayments().catch((e) => setError(e instanceof Error ? e.message : "Payments could not be loaded.")).finally(() => setLoading(false)); }}>↻ Refresh history</button></div>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {loading ? <p>Loading…</p> : visibleItems.length === 0 && !((statusFilter === "pending" || statusFilter === "all") && shopsWithoutPayment.length > 0) ? <p className="admin-muted">अभी कोई payment या pending shop registration नहीं मिली।</p> : <>
      {visibleItems.map((payment) => {
        const initial = payment.paymentType === "initial_listing";
        return <article className="admin-panel" key={payment.id}>
          <h2>{payment.shopDetails?.name || payment.shopDetails?.shopName || payment.shopName || payment.shopId || "Shop payment"}</h2>
          <p><strong>{initial ? "First-time listing + first 30 days" : "Monthly renewal"}</strong> · Amount: ₹{payment.amount}</p>
          <div className="admin-payment-details">
            <p><b>UTR / Transaction ID:</b> <strong>{payment.utr || "Not provided"}</strong></p>
            <p><b>Shop ID:</b> {payment.shopId || "—"}</p>
            <p><b>Shop owner:</b> {payment.shopDetails?.ownerName || "—"}</p>
            <p><b>Owner email:</b> {payment.shopDetails?.ownerEmail || "—"}</p>
            <p><b>Mobile:</b> {payment.shopDetails?.phone || "—"}</p>
            <p><b>City:</b> {payment.shopDetails?.city || "—"}</p>
            <p><b>Full address:</b> {payment.shopDetails?.address || "—"}</p>
            <p><b>Shop description:</b> {payment.shopDetails?.description || "—"}</p>
            <p><b>Owner UID:</b> {payment.ownerUid || "—"}</p>
            <p><b>Shop status:</b> {(payment.shopDetails?.status || "unknown").toUpperCase()}</p>
            <p><b>Payment status:</b> <strong>{(payment.status || "pending").toUpperCase()}</strong></p>
            <p><b>Submitted:</b> {payment.createdAt?.toDate ? payment.createdAt.toDate().toLocaleString("en-IN") : "Date unavailable"}</p>
          </div>
          {payment.status === "pending" && <div className="admin-actions">
            <button className="admin-primary small" disabled={busyId===payment.id} onClick={() => void verify(payment)}>{busyId===payment.id ? "Please wait…" : initial ? "Verify ₹599 & activate first 30 days" : "Verify ₹299 & extend 30 days"}</button>
            <button className="admin-secondary small" disabled={busyId===payment.id} onClick={() => void reject(payment)}>Reject</button>
          </div>}
        </article>;
      })}
      {(statusFilter === "pending" || statusFilter === "all") && shopsWithoutPayment.length > 0 && <section className="admin-panel">
        <h2>Shop registrations — payment record needs checking</h2>
        <p>इन दुकानों की registration मौजूद है, लेकिन subscription payment का record नहीं मिला। UTR reservation अलग से जाँची गई है। यदि UTR मौजूद है तो उसे नीचे देखें; payment document के बिना Verify न करें।</p>
        {shopsWithoutPayment.map((shop) => <article className="admin-panel" key={shop.id}>
          <h3>{shop.name || shop.shopName || "Unnamed shop"}</h3>
          <div className="admin-payment-details">
            <p><b>Shop ID:</b> {shop.id}</p>
            <p><b>Owner:</b> {shop.ownerName || "—"}</p>
            <p><b>Email:</b> {shop.ownerEmail || "—"}</p>
            <p><b>Mobile:</b> {shop.phone || "—"}</p>
            <p><b>City:</b> {shop.city || "—"}</p>
            <p><b>Address:</b> {shop.address || "—"}</p>
            <p><b>Description:</b> {shop.description || "—"}</p>
            <p><b>Registration status:</b> {(shop.status || "pending").toUpperCase()}</p>
            <p><b>Submitted UTR:</b> <strong>{shop.utr || "No UTR reservation found"}</strong></p>
            <p><b>Payment record ID:</b> {shop.paymentId || "Not found"}</p>
            <p><b>Payment:</b> {shop.utr ? "UTR reservation found — payment record missing; admin investigation required" : "UTR not found — waiting for shop owner submission"}</p>
          </div>
        </article>)}
      </section>}
      </>}
    </section>
  </main>;
}

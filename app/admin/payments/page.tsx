"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, doc, getDocs, query, runTransaction, where } from "firebase/firestore/lite";
import { auth, db } from "@/lib/firebase";
import { isAdminEmail } from "@/lib/admin";

type Payment = { id: string; ownerUid?: string; shopId?: string; shopName?: string; amount?: number; paymentType?: "initial_listing" | "monthly_renewal"; utr?: string; status?: string; createdAt?: { toDate?: () => Date } };

export default function AdminPaymentsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<Payment[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) { router.replace("/admin"); return; }
      if (!isAdminEmail(nextUser.email) || !nextUser.emailVerified) { router.replace("/"); return; }
      if (!db) return;
      try {
        const result = await getDocs(collection(db, "subscriptionPayments"));
        setItems(result.docs.map((item) => ({ id: item.id, ...item.data() } as Payment)));
      } catch (e) { setError(e instanceof Error ? e.message : "Payments could not be loaded."); }
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
        const paymentSnap = await tx.get(paymentRef);
        const shopSnap = await tx.get(shopRef);
        const lockSnap = await tx.get(lockRef);
        if (!paymentSnap.exists() || paymentSnap.data().status !== "pending") throw new Error("This payment is no longer pending.");
        if (!shopSnap.exists()) throw new Error("Shop record was not found.");
        if (!lockSnap.exists() || lockSnap.data().paymentId !== payment.id) throw new Error("Pending payment lock does not match. Do not approve; inspect the records.");
        const data = paymentSnap.data();
        const shop = shopSnap.data();
        const initial = data.paymentType === "initial_listing";
        if (!initial && data.paymentType !== "monthly_renewal") throw new Error("Unknown payment type. Do not approve this payment.");
        const expected = initial ? 599 : 299;
        if (data.amount !== expected) throw new Error(`Payment amount does not match ₹${expected}.`);
        if (typeof data.utr !== "string" || !/^[A-Z0-9]{6,40}$/.test(data.utr)) throw new Error("UTR is missing or invalid.");
        if (data.ownerUid !== shop.ownerUid || data.shopId !== payment.shopId) throw new Error("Payment owner or shop reference does not match.");
        if (initial && (shop.initialPaymentVerified === true || shop.subscriptionExpiresAt)) throw new Error("This shop already has an initial payment or subscription. Do not approve as first listing.");
        if (!initial && shop.initialPaymentVerified !== true && !shop.subscriptionExpiresAt) throw new Error("The first ₹599 listing payment has not been verified yet.");
        const current = shop.subscriptionExpiresAt?.toDate?.() as Date | undefined;
        const base = current && current.getTime() > Date.now() ? current : new Date();
        const expiry = new Date(base);
        expiry.setDate(expiry.getDate() + 30);
        tx.update(paymentRef, { status: "verified", verifiedAt: new Date(), verifiedBy: user.email });
        tx.update(shopRef, { ...(initial ? { initialPaymentVerified: true } : {}), subscriptionStatus: "active", subscriptionExpiresAt: expiry, status: "live", updatedAt: new Date() });
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
      <p>पहली दुकान listing ₹599 (पहले 30 दिन शामिल), उसके बाद हर 30 दिन में ₹299 renewal। UTR और shop details जाँचकर ही payment verify करें।</p>
      <div className="admin-filters"><label>Payment status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="pending">Pending</option><option value="verified">Verified</option><option value="rejected">Rejected</option><option value="all">All payments</option></select></label><button className="admin-secondary" onClick={() => { setLoading(true); setError(""); if (!db) { setLoading(false); return; } getDocs(collection(db, "subscriptionPayments")).then((result) => setItems(result.docs.map((item) => ({ id: item.id, ...item.data() } as Payment)))).catch((e) => setError(e instanceof Error ? e.message : "Payments could not be loaded.")).finally(() => setLoading(false)); }}>↻ Refresh history</button></div>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {loading ? <p>Loading…</p> : visibleItems.length === 0 ? <p className="admin-muted">इस filter में कोई payment record नहीं मिला।</p> : visibleItems.map((payment) => {
        const initial = payment.paymentType === "initial_listing";
        return <article className="admin-panel" key={payment.id}>
          <h2>{payment.shopName || payment.shopId}</h2>
          <p><strong>{initial ? "First-time listing + first 30 days" : "Monthly renewal"}</strong> · Amount: ₹{payment.amount}</p>
          <p>UTR: <b>{payment.utr}</b></p><p>Shop ID: {payment.shopId}</p><p>Owner UID: {payment.ownerUid}</p><p>Status: <strong>{(payment.status || "pending").toUpperCase()}</strong></p>
          {payment.createdAt?.toDate && <p>Submitted: {payment.createdAt.toDate().toLocaleString("en-IN")}</p>}
          {payment.status === "pending" && <div className="admin-actions">
            <button className="admin-primary small" disabled={busyId===payment.id} onClick={() => void verify(payment)}>{busyId===payment.id ? "Please wait…" : initial ? "Verify ₹599 & activate first 30 days" : "Verify ₹299 & extend 30 days"}</button>
            <button className="admin-secondary small" disabled={busyId===payment.id} onClick={() => void reject(payment)}>Reject</button>
          </div>}
        </article>;
      })}
    </section>
  </main>;
}

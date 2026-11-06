"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, doc, getDocs, query, runTransaction, where } from "firebase/firestore/lite";
import { auth, db } from "@/lib/firebase";
import { isAdminEmail } from "@/lib/admin";

type Payment = { id: string; ownerUid?: string; shopId?: string; shopName?: string; amount?: number; paymentType?: "initial_listing" | "monthly_renewal"; utr?: string; status?: string };

export default function AdminPaymentsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<Payment[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) { router.replace("/admin"); return; }
      if (!isAdminEmail(nextUser.email) || !nextUser.emailVerified) { router.replace("/"); return; }
      if (!db) return;
      try {
        const result = await getDocs(query(collection(db, "subscriptionPayments"), where("status", "==", "pending")));
        setItems(result.docs.map((item) => ({ id: item.id, ...item.data() } as Payment)));
      } catch (e) { setError(e instanceof Error ? e.message : "Payments could not be loaded."); }
      finally { setLoading(false); }
    });
  }, [router]);

  async function verify(payment: Payment) {
    if (!db || !payment.shopId || !user) return;
    const firestore = db;
    try {
      await runTransaction(firestore, async (transaction) => {
        const paymentRef = doc(firestore, "subscriptionPayments", payment.id);
        const shopRef = doc(firestore, "shops", payment.shopId!);
        const paymentSnapshot = await transaction.get(paymentRef);
        const shopSnapshot = await transaction.get(shopRef);
        if (!paymentSnapshot.exists() || paymentSnapshot.data().status !== "pending") throw new Error("This payment is no longer pending.");
        if (!shopSnapshot.exists()) throw new Error("Shop record was not found.");
        const paymentData = paymentSnapshot.data();
        const shopData = shopSnapshot.data();
        const initial = paymentData.paymentType === "initial_listing";
        if (!initial && paymentData.paymentType !== "monthly_renewal") throw new Error("Unknown payment type. Do not approve it; ask the shop owner to resubmit.");
        const expectedAmount = initial ? 599 : 299;
        if (paymentData.amount !== expectedAmount) throw new Error(`Payment amount does not match the ₹${expectedAmount} fee.`);
        if (typeof paymentData.utr !== "string" || !/^[A-Z0-9]{6,40}$/.test(paymentData.utr)) throw new Error("UTR is missing or invalid. Reject this submission and ask the shop to resubmit.");
        if (paymentData.ownerUid !== shopData.ownerUid || paymentData.shopId !== payment.shopId) throw new Error("Payment owner or shop reference does not match.");
        if (initial && (shopData.initialPaymentVerified === true || shopData.subscriptionExpiresAt)) throw new Error("This shop already has an initial listing payment. Treat this as a renewal instead.");
        if (!initial && shopData.initialPaymentVerified !== true && !shopData.subscriptionExpiresAt) throw new Error("The first ₹599 listing payment has not been verified yet.");
        const currentExpiry = shopData.subscriptionExpiresAt?.toDate?.() as Date | undefined;
        const base = currentExpiry && currentExpiry.getTime() > Date.now() ? currentExpiry : new Date();
        const expiry = new Date(base);
        expiry.setDate(expiry.getDate() + 30);
        transaction.update(paymentRef, { status: "verified", verifiedAt: new Date(), verifiedBy: user.email });
        transaction.update(shopRef, { ...(initial ? { initialPaymentVerified: true } : {}), subscriptionStatus: "active", subscriptionExpiresAt: expiry, status: "live", updatedAt: new Date() });
      });
      setItems((current) => current.filter((item) => item.id !== payment.id));
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not verify payment."); }
  }

  async function reject(payment: Payment) {
    if (!db) return;
    const firestore = db;
    try {
      await runTransaction(firestore, async (transaction) => {
        const paymentRef = doc(firestore, "subscriptionPayments", payment.id);
        const snapshot = await transaction.get(paymentRef);
        if (!snapshot.exists() || snapshot.data().status !== "pending") throw new Error("This payment is no longer pending.");
        transaction.update(paymentRef, { status: "rejected", verifiedAt: new Date(), verifiedBy: user?.email });
      });
      setItems((current) => current.filter((item) => item.id !== payment.id));
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not reject payment."); }
  }

  return <main className="admin-wrap">
    <header className="admin-header"><Link href="/admin" className="admin-brand">🍦 MY ICE CREAM <span>ADMIN</span></Link><Link href="/admin" className="admin-secondary">Dashboard</Link></header>
    <section className="admin-panel"><h1>Subscription payments</h1>
      <p>पहली listing ₹599 (पहला महीना शामिल) और उसके बाद renewal ₹299 है। UTR जाँचकर ही payment verify करें।</p>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {loading ? <p>Loading…</p> : items.length === 0 ? <p className="admin-muted">No pending payments.</p> : items.map((payment) => {
        const initial = payment.paymentType === "initial_listing";
        return <article className="admin-panel" key={payment.id}>
          <h2>{payment.shopName || payment.shopId}</h2>
          <p><strong>{initial ? "First-time listing + first month" : "Monthly renewal"}</strong> · Amount: ₹{payment.amount}</p>
          <p>UTR: <b>{payment.utr}</b></p><p>Shop ID: {payment.shopId}</p>
          <div className="admin-actions">
            <button className="admin-primary small" onClick={() => void verify(payment)}>{initial ? "Verify ₹599 & activate first 30 days" : "Verify ₹299 & extend 30 days"}</button>
            <button className="admin-secondary small" onClick={() => void reject(payment)}>Reject</button>
          </div>
        </article>;
      })}
    </section>
  </main>;
}

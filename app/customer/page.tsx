"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { collection, doc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore/lite";
import { auth, db } from "@/lib/firebase";
import { isAdminEmail } from "@/lib/admin";

type Item = { name: string; quantity: number; price?: number };
type FirestoreDate = { toDate?: () => Date };
type Sale = { id: string; shopName?: string; items?: Item[]; subtotal?: number; discount?: number; discountType?: string; total?: number; paymentStatus?: string; createdAt?: FirestoreDate };
type OnlineOrder = { id: string; shopName?: string; items?: Item[]; subtotal?: number; deliveryFee?: number; total?: number; status?: string; paymentStatus?: string; createdAt?: FirestoreDate };
type Purchase = { id: string; kind: "Online Order" | "Shop Bill"; shopName: string; items: Item[]; subtotal: number; discount: number; deliveryFee: number; total: number; status: string; paymentStatus: string; createdAt?: FirestoreDate };

function dateValue(value?: FirestoreDate) {
  try { return value?.toDate?.() || null; } catch { return null; }
}
function money(value: number) {
  return "₹" + Number(value || 0).toFixed(2);
}

export default function CustomerPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [onlineOrders, setOnlineOrders] = useState<OnlineOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (!auth) { setLoading(false); return; }
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) { router.replace("/"); return; }
      if (isAdminEmail(u.email) && u.emailVerified) { router.replace("/admin"); return; }
      if (!db) { setLoading(false); return; }
      try {
        const existing = await getDocs(query(collection(db, "customers"), where("uid", "==", u.uid)));
        if (!existing.empty) {
          const profile = existing.docs[0].data();
          setName(String(profile.name || u.displayName || ""));
          setPhone(String(profile.phone || ""));
        }
        const [salesResult, ordersResult] = await Promise.all([
          getDocs(query(collection(db, "sales"), where("customerUid", "==", u.uid))),
          getDocs(query(collection(db, "orders"), where("customerUid", "==", u.uid))),
        ]);
        setSales(salesResult.docs.map((d) => ({ id: d.id, ...d.data() } as Sale)));
        setOnlineOrders(ordersResult.docs.map((d) => ({ id: d.id, ...d.data() } as OnlineOrder)));
      } catch (e) {
        setError(e instanceof Error ? e.message : "जानकारी लोड नहीं हो सकी।");
      } finally {
        setLoading(false);
      }
    });
  }, [router]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!db || !user) return;
    const digits = phone.replace(/\D/g, "");
    if (!name.trim() || !/^\d{10}$/.test(digits)) {
      setError("नाम और 10 अंकों का मोबाइल नंबर सही भरें।");
      return;
    }
    setSaving(true); setError(""); setNotice("");
    try {
      const ref = doc(db, "customers", digits);
      const existing = await getDoc(ref);
      if (existing.exists() && existing.data().uid !== user.uid) {
        throw new Error("यह मोबाइल नंबर पहले से दुकान के ग्राहक रिकॉर्ड में दर्ज है। सुरक्षा के लिए इसे अपने खाते से जोड़ने हेतु दुकान या Admin से संपर्क करें।");
      }
      await setDoc(ref, {
        uid: user.uid, name: name.trim(), phone: digits, email: user.email || "",
        registered: true, updatedAt: serverTimestamp(),
      }, { merge: true });
      setPhone(digits);
      setNotice("आपकी जानकारी सेव हो गई।");
    } catch (e) {
      setError(e instanceof Error ? e.message : "जानकारी सेव नहीं हो सकी।");
    } finally {
      setSaving(false);
    }
  }

  const purchases: Purchase[] = [
    ...onlineOrders.map((o) => ({
      id: o.id, kind: "Online Order" as const, shopName: o.shopName || "दुकान",
      items: o.items || [], subtotal: Number(o.subtotal || 0), discount: 0,
      deliveryFee: Number(o.deliveryFee || 0), total: Number(o.total || 0),
      status: o.status || "placed", paymentStatus: o.paymentStatus || "unpaid",
      createdAt: o.createdAt,
    })),
    ...sales.map((s) => ({
      id: s.id, kind: "Shop Bill" as const, shopName: s.shopName || "दुकान",
      items: s.items || [], subtotal: Number(s.subtotal || 0),
      discount: Number(s.discount || 0), deliveryFee: 0, total: Number(s.total || 0),
      status: "बिल", paymentStatus: s.paymentStatus || "unpaid", createdAt: s.createdAt,
    })),
  ].sort((a, b) => (dateValue(b.createdAt)?.getTime() || 0) - (dateValue(a.createdAt)?.getTime() || 0));

  return (
    <main className="admin-wrap">
      <header className="admin-header">
        <Link href="/" className="admin-brand">🍦 MY ICE CREAM <span>CUSTOMER</span></Link>
        <button className="admin-secondary" onClick={() => auth && signOut(auth)}>Sign out</button>
      </header>
      <section className="admin-panel">
        <p className="admin-kicker">CUSTOMER ACCOUNT</p>
        <h1>Welcome{name ? ", " + name : user?.displayName ? ", " + user.displayName : ""}!</h1>
        <p>अपना नाम और मोबाइल नंबर सेव करें। आपकी सभी दुकानों की खरीदारी नीचे एक ही जगह दिखेगी।</p>
        <form className="register-form" onSubmit={saveProfile}>
          <label>आपका नाम<input required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label>10 अंकों का मोबाइल नंबर<input required inputMode="numeric" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} /></label>
          <button className="admin-primary" disabled={saving}>{saving ? "सेव हो रहा है…" : "जानकारी सेव करें"}</button>
        </form>
        {error && <p className="admin-error">{error}</p>}
        {notice && <p className="admin-success">{notice}</p>}
        <Link href="/" className="admin-primary role-link">Explore all shops</Link>
      </section>
      <section className="admin-panel">
        <div className="admin-panel-head">
          <div><p className="admin-kicker">PURCHASE HISTORY</p><h2>मेरी खरीदारी</h2></div>
          <strong>{purchases.length} रिकॉर्ड</strong>
        </div>
        <p className="admin-muted">Online Orders और दुकान पर बने Bills — सभी दुकानों की खरीदारी नई से पुरानी तारीख के क्रम में।</p>
        {loading ? <p className="admin-muted">खरीदारी लोड हो रही है…</p> :
          purchases.length === 0 ? <p className="admin-muted">अभी कोई खरीदारी दर्ज नहीं है। खरीदारी करने के बाद उसका रिकॉर्ड यहाँ दिखेगा।</p> :
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>दुकान / सामान</th><th>प्रकार</th><th>कुल</th><th>स्थिति</th><th>पेमेंट</th><th>तारीख और समय</th></tr></thead>
              <tbody>
                {purchases.map((purchase) => {
                  const date = dateValue(purchase.createdAt);
                  return <tr key={purchase.kind + "-" + purchase.id}>
                    <td>
                      <strong>{purchase.shopName}</strong>
                      <small>{purchase.items.map((item) => item.name + " × " + item.quantity).join(", ") || "सामान का विवरण उपलब्ध नहीं"}</small>
                      {purchase.items.some((item) => Number.isFinite(item.price)) && <small>{purchase.items.map((item) => item.name + ": " + money(Number(item.price || 0)) + " × " + item.quantity).join(" · ")}</small>}
                      <small>ID: {purchase.id}</small>
                    </td>
                    <td>{purchase.kind === "Online Order" ? "ऑनलाइन ऑर्डर" : "दुकान का बिल"}</td>
                    <td><strong>{money(purchase.total)}</strong>{purchase.deliveryFee > 0 && <small>Delivery: {money(purchase.deliveryFee)}</small>}{purchase.discount > 0 && <small>छूट: {money(purchase.discount)}{purchase.kind === "Shop Bill" && purchase.subtotal > 0 ? " · " + (sales.find((s) => s.id === purchase.id)?.discountType === "percent" ? "%" : "") : ""}</small>}</td>
                    <td>{purchase.status}</td>
                    <td>{purchase.paymentStatus === "paid" ? "Paid" : "Unpaid"}</td>
                    <td>{date ? date.toLocaleString("en-IN") : "तारीख उपलब्ध नहीं"}</td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        }
      </section>
    </main>
  );
}

"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { collection, doc, getDoc, getFirestore, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { auth, db, firebaseApp, googleProvider } from "@/lib/firebase";
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
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const realtimeDb = firebaseApp ? getFirestore(firebaseApp) : null;

  useEffect(() => {
    if (!auth) { setLoading(false); return; }
    let unsubscribeProfile: (() => void) | undefined;
    let unsubscribeSales: (() => void) | undefined;
    let unsubscribeOrders: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      unsubscribeProfile?.(); unsubscribeProfile = undefined;
      unsubscribeSales?.(); unsubscribeSales = undefined;
      unsubscribeOrders?.(); unsubscribeOrders = undefined;
      setUser(u?.isAnonymous ? null : u);
      setSales([]);
      setOnlineOrders([]);
      setError("");
      if (!u || u.isAnonymous) { setLoading(false); return; }
      if (isAdminEmail(u.email) && u.emailVerified) { router.replace("/admin"); return; }
      if (!realtimeDb) { setLoading(false); return; }

      setLoading(true);
      const profileQuery = query(collection(realtimeDb, "customers"), where("uid", "==", u.uid));
      unsubscribeProfile = onSnapshot(profileQuery, (snapshot) => {
        if (!snapshot.empty) {
          const profile = snapshot.docs[0].data();
          setName(String(profile.name || u.displayName || ""));
          setPhone(String(profile.phone || ""));
        } else {
          setName(String(u.displayName || ""));
          setPhone("");
        }
      }, (e) => setError(e instanceof Error ? e.message : "ग्राहक जानकारी लोड नहीं हो सकी।"));

      unsubscribeSales = onSnapshot(
        query(collection(realtimeDb, "sales"), where("customerUid", "==", u.uid)),
        (snapshot) => { setSales(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Sale))); setLoading(false); },
        (e) => { setError(e instanceof Error ? e.message : "खरीदारी लोड नहीं हो सकी।"); setLoading(false); }
      );
      unsubscribeOrders = onSnapshot(
        query(collection(realtimeDb, "orders"), where("customerUid", "==", u.uid)),
        (snapshot) => { setOnlineOrders(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as OnlineOrder))); setLoading(false); },
        (e) => { setError(e instanceof Error ? e.message : "ऑर्डर लोड नहीं हो सके।"); setLoading(false); }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeProfile?.();
      unsubscribeSales?.();
      unsubscribeOrders?.();
    };
  }, [router, realtimeDb]);

  async function handleGoogleSignIn() {
    if (!auth) { setError("अभी Google Login उपलब्ध नहीं है। कृपया बाद में प्रयास करें।"); return; }
    setSigningIn(true); setError("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google Login पूरा नहीं हो सका।");
    } finally {
      setSigningIn(false);
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!realtimeDb || !user) return;
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
      setNotice("आपकी जानकारी सेव हो गई। नई खरीदारी और ऑर्डर अब अपने-आप यहाँ अपडेट होंगे।");
    } catch (e) {
      const detail = e instanceof Error ? e.message : "";
      setError(detail.toLowerCase().includes("permission")
        ? "यह मोबाइल नंबर पहले से किसी दुकान के ग्राहक रिकॉर्ड में हो सकता है। सुरक्षा के लिए इसे अपने खाते से जोड़ने हेतु दुकान या Admin से संपर्क करें।"
        : detail || "जानकारी सेव नहीं हो सकी।");
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

  if (!loading && !user) {
    return (
      <main className="admin-wrap">
        <header className="admin-header"><Link href="/" className="admin-brand">🍦 MY ICE CREAM <span>CUSTOMER</span></Link></header>
        <section className="admin-panel">
          <p className="admin-kicker">CUSTOMER ACCOUNT</p>
          <h1>Customer Dashboard</h1>
          <p>अपनी खरीदारी और ग्राहक जानकारी देखने के लिए Google से Login करें।</p>
          {error && <p className="admin-error">{error}</p>}
          <button className="admin-primary" onClick={handleGoogleSignIn} disabled={signingIn}>{signingIn ? "Login हो रहा है…" : "Google से Login करें"}</button>
          <Link href="/" className="admin-secondary role-link">वापस Home पर जाएँ</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-wrap">
      <header className="admin-header">
        <Link href="/" className="admin-secondary" aria-label="होम पेज पर वापस जाएँ">← Back to Home</Link>
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
          purchases.length === 0 ? <p className="admin-muted">अभी कोई खरीदारी दर्ज नहीं है। मोबाइल नंबर सेव करने के बाद बनने वाले बिल यहाँ दिखेंगे। पुराने बिना अकाउंट वाले बिल अपने-आप नहीं जुड़ेंगे।</p> :
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

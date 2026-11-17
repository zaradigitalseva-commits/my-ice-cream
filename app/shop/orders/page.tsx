"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {onAuthStateChanged,signOut} from "firebase/auth";
import {collection,doc,getDoc,getDocs,limit,onSnapshot,query,serverTimestamp,updateDoc,where} from "firebase/firestore";
import {auth,db} from "@/lib/firebase";
import {isAdminEmail} from "@/lib/admin";
type Order={id:string;shopName?:string;customerName?:string;customerEmail?:string;customerPhone?:string;deliveryAddress?:string;fulfillmentType?:"pickup"|"delivery";items?:{productId?:string;name:string;quantity:number;price:number}[];subtotal?:number;deliveryFee?:number;total?:number;status?:string;paymentStatus?:string;paymentUtr?:string;shopId?:string;createdAt?:{toDate?:()=>Date}};
export default function ShopOrdersPage(){
 const router=useRouter();const[orders,setOrders]=useState<Order[]>([]);const[error,setError]=useState("");const[loading,setLoading]=useState(true);const[search,setSearch]=useState("");
 useEffect(()=>{
  if(!auth)return;
  let stopOrders:(()=>void)|undefined;
  const stopAuth=onAuthStateChanged(auth,async u=>{
   stopOrders?.();stopOrders=undefined;
   if(!u||u.isAnonymous){router.replace("/");return;}
   if(isAdminEmail(u.email)&&u.emailVerified){router.replace("/admin");return;}
   const firestore=db;if(!firestore)return;
   setLoading(true);setError("");
   try{
    const lock=await getDoc(doc(firestore,"shopOwnerLocks",u.uid));
    let shopId=lock.exists()?String(lock.data().shopId||""):"";
    if(!shopId){const legacy=await getDocs(query(collection(firestore,"shops"),where("ownerUid","==",u.uid),limit(1)));shopId=legacy.empty?"":legacy.docs[0].id;}
    if(!shopId){router.replace("/shop");return;}
    stopOrders=onSnapshot(query(collection(firestore,"orders"),where("shopId","==",shopId)),snap=>{
     const next=snap.docs.map(d=>({id:d.id,...d.data()} as Order));
     next.sort((a,b)=>(b.createdAt?.toDate?.().getTime()||0)-(a.createdAt?.toDate?.().getTime()||0));
     setOrders(next);setLoading(false);
    },err=>{setError(err.message||"Orders could not be loaded.");setLoading(false);});
   }catch(e){setError(e instanceof Error?e.message:"Orders could not be loaded.");setLoading(false);}
  });
  return()=>{stopAuth();stopOrders?.();};
 },[router]);
 async function markPaid(id:string){if(!db)return;const current=orders.find(o=>o.id===id);if(!current||current.paymentStatus!=="unpaid"){setError("Only unpaid orders can be marked as paid.");return;}try{await updateDoc(doc(db,"orders",id),{paymentStatus:"paid",updatedAt:serverTimestamp()});setOrders(v=>v.map(o=>o.id===id?{...o,paymentStatus:"paid"}:o));setError("");}catch(e){setError(e instanceof Error?e.message:"Payment status update failed.");}}
 async function update(id:string,status:string){if(!db)return;const current=orders.find(o=>o.id===id);const allowed:Record<string,string>={placed:"accepted",accepted:"preparing",preparing:"ready",ready:"completed"};if(!current||allowed[current.status||""]!==status){setError("This order status change is not allowed.");return;}try{await updateDoc(doc(db,"orders",id),{status,updatedAt:serverTimestamp()});setOrders(v=>v.map(o=>o.id===id?{...o,status}:o));setError("");}catch(e){setError(e instanceof Error?e.message:"Update failed.");}}
 const visibleOrders=orders.filter(o=>[o.customerName,o.customerPhone,o.id].filter(Boolean).join(" ").toLowerCase().includes(search.trim().toLowerCase()));
 const nextStatus=(status?:string)=>status==="placed"?"accepted":status==="accepted"?"preparing":status==="preparing"?"ready":status==="ready"?"completed":null;
 const nextLabel=(status?:string)=>status==="placed"?"स्वीकार करें":status==="accepted"?"तैयार करना शुरू करें":status==="preparing"?"तैयार है":status==="ready"?"पूरा करें":"";
 const whatsappNumber=(phone?:string)=>{const digits=(phone||"").replace(/\D/g,"");if(!digits)return "";return digits.length===10?"91"+digits:digits.length>=11?digits:"";};
 const billMessage=(o:Order)=>{const lines=(o.items||[]).map(i=>`• ${i.name} × ${i.quantity} = ₹${(Number(i.price||0)*Number(i.quantity||0)).toFixed(2)}`);return [
 "🍦 "+(o.shopName||"MY ICE CREAM")+" — ऑर्डर बिल","नमस्ते "+(o.customerName||"ग्राहक")+" जी,","आपके ऑर्डर का विवरण:",
 "ऑर्डर ID: "+o.id,"तारीख: "+(o.createdAt?.toDate?o.createdAt.toDate().toLocaleString("hi-IN"):"उपलब्ध नहीं"),
 "सामान:",...(lines.length?lines:["• सामान का विवरण उपलब्ध नहीं"]),
 "Subtotal: ₹"+Number(o.subtotal??o.total??0).toFixed(2),
 "Delivery charge: ₹"+Number(o.deliveryFee||0).toFixed(2),
 "कुल बिल: ₹"+Number(o.total||0).toFixed(2),
 "भुगतान: "+(o.paymentStatus==="paid"?"Paid":"Unpaid"),
 "UTR नंबर: "+(o.paymentUtr||"उपलब्ध नहीं"),"ऑर्डर स्थिति: "+(o.status||"placed"),"धन्यवाद! 🍨"
 ].join("\n");};
 const sendBill=(o:Order)=>{const number=whatsappNumber(o.customerPhone);if(!number){setError("इस ग्राहक का सही WhatsApp मोबाइल नंबर उपलब्ध नहीं है।");return;}window.open("https://wa.me/"+number+"?text="+encodeURIComponent(billMessage(o)),"_blank","noopener,noreferrer");};

 return <main className="admin-wrap"><header className="admin-header"><Link href="/shop" className="admin-brand">🍦 MY ICE CREAM <span>ONLINE ORDERS</span></Link><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><Link href="/shop#shop-management" className="admin-secondary role-link">⚙️ SHOP MANAGEMENT</Link><button className="admin-secondary" onClick={()=>auth&&signOut(auth)}>Sign out</button></div></header><section className="admin-panel"><p className="admin-kicker">ONLINE ORDERS</p><h1>ऑनलाइन ऑर्डर</h1><p>ग्राहकों के वेबसाइट ऑर्डर यहाँ देखें, UTR नंबर जाँचें और ऑर्डर की स्थिति अपडेट करें।</p><strong>{orders.length} ऑर्डर</strong><label className="marketplace-search">Search customer / mobile / order ID<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ग्राहक का नाम, मोबाइल या Order ID"/></label>{loading?<p>Loading…</p>:error?<p className="admin-error">{error}</p>:orders.length===0?<p className="admin-muted">अभी कोई ऑनलाइन ऑर्डर नहीं आया है।</p>:visibleOrders.length===0?<p className="admin-muted">कोई matching ऑर्डर नहीं मिला।</p>:<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>ऑर्डर / ग्राहक</th><th>सामान</th><th>कुल</th><th>UTR नंबर</th><th>स्थिति</th><th>अगला कदम</th></tr></thead><tbody>{visibleOrders.map(o=>{const next=nextStatus(o.status);return <tr key={o.id} className="order-row"><td><strong>{o.customerName||"ग्राहक"}</strong><small>{o.customerPhone||"मोबाइल उपलब्ध नहीं"}</small><small>ID: {o.id}</small><small>{o.fulfillmentType==="delivery"?"Home delivery":"Shop pickup"}{o.deliveryAddress?" · "+o.deliveryAddress:""}</small><small>{o.createdAt?.toDate?o.createdAt.toDate().toLocaleString("hi-IN"):""}</small><button type="button" className="whatsapp-bill-button" onClick={()=>sendBill(o)}>📲 WhatsApp पर बिल भेजें</button></td><td>{(o.items||[]).map(i=>i.name+" × "+i.quantity).join(", ")||"विवरण उपलब्ध नहीं"}</td><td><strong>₹{Number(o.total||0).toFixed(2)}</strong><small><span className={`payment-badge ${o.paymentStatus==="paid"?"payment-paid":"payment-unpaid"}`}>{o.paymentStatus==="paid"?"✓ Paid":"● Unpaid"}</span></small>{o.paymentStatus==="unpaid"&&o.status!=="cancelled"&&<button className="admin-primary small" onClick={()=>void markPaid(o.id)}>Payment मिल गया</button>}</td><td><strong className="utr-value" style={{wordBreak:"break-all"}}>{o.paymentUtr||"पुराना ऑर्डर — UTR नहीं"}</strong></td><td><span className={`order-status status-${o.status||"placed"}`}>{o.status||"placed"}</span></td><td>{next?<button type="button" className="admin-primary small" onClick={()=>void update(o.id,next)}>{nextLabel(o.status)}</button>:<span className="admin-muted">{o.status==="completed"?"पूरा हुआ":o.status==="cancelled"?"रद्द":"—"}</span>}</td></tr>})}</tbody></table></div>}<button type="button" className="admin-secondary" onClick={()=>window.location.reload()}>ऑर्डर Refresh करें</button></section><style jsx>{`.admin-panel{border-top:5px solid #6c63ff;background:linear-gradient(145deg,#fff 0%,#f5f7ff 100%)}.admin-kicker{color:#6c45c7!important;font-weight:800;letter-spacing:1.5px}.admin-table thead th{background:#253b80;color:#fff}.order-row:nth-child(odd){background:#f0f7ff}.order-row:nth-child(even){background:#fff8ee}.order-row td{border-bottom:1px solid #dce4f2}.whatsapp-bill-button{display:inline-flex;align-items:center;justify-content:center;gap:6px;margin-top:8px;padding:9px 12px;border:0;border-radius:9px;background:#16a34a;color:#fff;font-weight:800;box-shadow:0 3px 0 #087536;cursor:pointer}.whatsapp-bill-button:hover{background:#12843e;transform:translateY(-1px)}.payment-badge,.order-status{display:inline-block;padding:5px 9px;border-radius:999px;font-size:12px;font-weight:800;white-space:nowrap}.payment-paid{background:#dcfce7;color:#166534}.payment-unpaid{background:#fff1c2;color:#92400e}.utr-value{display:inline-block;padding:6px 8px;border-radius:7px;background:#e9e7ff;color:#4338a8}.status-placed{background:#ffedd5;color:#9a3412}.status-accepted{background:#ede9fe;color:#6d28d9}.status-preparing{background:#dbeafe;color:#1d4ed8}.status-ready{background:#cffafe;color:#155e75}.status-completed{background:#dcfce7;color:#166534}.status-cancelled{background:#fee2e2;color:#991b1b}@media(max-width:700px){.whatsapp-bill-button{width:100%;font-size:12px}.admin-table td{vertical-align:top}}`}</style></main>;
}
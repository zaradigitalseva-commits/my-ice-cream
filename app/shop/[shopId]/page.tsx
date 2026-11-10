"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { onAuthStateChanged, signInWithPopup, type User } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, where } from "firebase/firestore/lite";
import { auth, db, googleProvider } from "@/lib/firebase";

type Shop={id:string;name?:string;shopName?:string;city?:string;address?:string;phone?:string;description?:string;offerTitle?:string;offerDescription?:string;offerExpiresAt?:string;bannerUrl?:string;logoUrl?:string;status?:string;pickupAvailable?:boolean;deliveryAvailable?:boolean;openingTime?:string;closingTime?:string;closedDays?:string[];manualClosed?:boolean;deliveryFee?:number;minimumOrder?:number};
type Product={id:string;name?:string;description?:string;price?:number;originalPrice?:number;category?:string;imageUrl?:string;active?:boolean};
export default function ShopDetailsPage(){
 const params=useParams<{shopId:string}>(); const searchParams=useSearchParams(); const selectedProductId=searchParams.get("product"); const shopId=params.shopId;
 const [shop,setShop]=useState<Shop|null>(null); const [products,setProducts]=useState<Product[]>([]);
 const [user,setUser]=useState<User|null>(null); const [cart,setCart]=useState<Record<string,number>>({});
 const [phone,setPhone]=useState(""); const [customerName,setCustomerName]=useState(""); const [address,setAddress]=useState(""); const [fulfillmentType,setFulfillmentType]=useState<"pickup"|"delivery">("pickup"); const [busy,setBusy]=useState(false); const [message,setMessage]=useState("");
 useEffect(()=>{if(!auth)return;return onAuthStateChanged(auth,setUser)},[]);
 useEffect(()=>{let active=true; async function load(){if(!db)return;try{const s=await getDoc(doc(db,"shops",shopId));if(!s.exists()||!["live","LIVE","Live"].includes(String(s.data().status||""))){setMessage("This shop is not available.");return;}const p=await getDocs(query(collection(db,"shops",shopId,"products"),where("active","==",true)));if(active){setShop({id:s.id,...s.data()} as Shop);setProducts(p.docs.map(x=>({id:x.id,...x.data()} as Product)));}}catch(e){setMessage(e instanceof Error?e.message:"Could not load shop.");}}void load();return()=>{active=false}},[shopId]);
 const visibleProducts=products; // Product links may carry a selected product ID, but customers must always see the full shop catalogue.
 const subtotal=useMemo(()=>products.reduce((sum,p)=>sum+(cart[p.id]||0)*Number(p.price||0),0),[products,cart]);
 const deliveryFee=fulfillmentType==="delivery"?Number(shop?.deliveryFee||0):0;
 const total=subtotal+deliveryFee;
 const todayName=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date().getDay()];
 const now=new Date(); const currentMinutes=now.getHours()*60+now.getMinutes(); const opening=shop?.openingTime||"00:00"; const closing=shop?.closingTime||"23:59"; const toMinutes=(v:string)=>Number(v.slice(0,2))*60+Number(v.slice(3,5));
 const withinHours=toMinutes(closing)>=toMinutes(opening)?currentMinutes>=toMinutes(opening)&&currentMinutes<=toMinutes(closing):currentMinutes>=toMinutes(opening)||currentMinutes<=toMinutes(closing);
 const shopOpen=!shop?.manualClosed&&!(shop?.closedDays||[]).includes(todayName)&&withinHours;
 const hasActiveOffer=Boolean(shop?.offerTitle?.trim()||shop?.offerDescription?.trim())&&(!shop?.offerExpiresAt||new Date(shop.offerExpiresAt+"T23:59:59").getTime()>=Date.now());
 function add(id:string){setCart(c=>({...c,[id]:(c[id]||0)+1}))}
 function placeOrder(){
  if(!shop)return;
  const items=products.filter(p=>(cart[p.id]||0)>0).map(p=>({name:p.name||"Product",price:Number(p.price||0),quantity:cart[p.id]}));
  if(!items.length){setMessage("पहले cart में products जोड़ें।");return;}
  if(subtotal<20){setMessage("Minimum order ₹20 है। कृपया cart में ₹"+(20-subtotal).toFixed(2)+" और जोड़ें।");return;}
  if(items.length>20){setMessage("एक ऑर्डर में अधिकतम 20 अलग-अलग products चुनें।");return;}
  const cleanPhone=phone.replace(/\D/g,"");
  if(!/^\d{10}$/.test(cleanPhone)){setMessage("अपना 10 अंकों का मोबाइल नंबर दर्ज करें।");return;}
  const cleanCustomerName=customerName.trim();
  if(!cleanCustomerName){setMessage("ऑर्डर के लिए अपना नाम दर्ज करें।");return;}
  if(!shopOpen){setMessage("दुकान अभी बंद है। कृपया खुलने के समय ऑर्डर करें।");return;}
  if(fulfillmentType==="delivery"&&(!shop.deliveryAvailable||!address.trim())){setMessage("डिलीवरी के लिए पूरा पता दर्ज करें।");return;}
  if(fulfillmentType==="pickup"&&shop.pickupAvailable===false){setMessage("Shop pickup उपलब्ध नहीं है।");return;}
  const registeredNumber=String(shop.phone||"").replace(/\D/g,"");
  const whatsappNumber=registeredNumber.length===10?"91"+registeredNumber:registeredNumber.length===12&&registeredNumber.startsWith("91")?registeredNumber:"";
  if(!whatsappNumber){setMessage("दुकान का WhatsApp नंबर सही तरीके से सेट नहीं है। कृपया दुकान से संपर्क करें।");return;}
  const orderLines=items.map((item,index)=>String(index+1)+". "+item.name+" × "+item.quantity+" = ₹"+(item.price*item.quantity).toFixed(2));
  const orderMessage=[
    "🍦 *New Order - MY ICE CREAM*",
    "Shop: "+(shop.name||shop.shopName||"Ice Cream Shop"),
    "",
    "*Customer details*",
    "Name: "+cleanCustomerName,
    "Mobile: "+cleanPhone,
    "Order method: "+(fulfillmentType==="pickup"?"Shop pickup":"Home delivery"),
    ...(fulfillmentType==="delivery"?["Delivery address: "+address.trim()]:[]),
    "",
    "*Order items*",
    ...orderLines,
    "",
    "Items subtotal: ₹"+subtotal.toFixed(2),
    "Delivery charge: ₹"+deliveryFee.toFixed(2),
    "*Total: ₹"+total.toFixed(2)+"*",
    "",
    "Payment: Unpaid - payment will be coordinated directly with the shop.",
    "Please confirm this order."
  ].join("\n");
  const whatsappUrl="https://wa.me/"+whatsappNumber+"?text="+encodeURIComponent(orderMessage);
  setMessage("WhatsApp खुल रहा है। वहाँ Send दबाकर अपना ऑर्डर दुकान को भेजें।");
  window.location.href=whatsappUrl;
 }
 return <main className="admin-wrap customer-store"><header className="admin-header customer-store-header"><Link href="/" className="admin-brand">🍦 MY ICE CREAM</Link><Link href="/" className="admin-secondary">← Back to shops</Link></header>
 {!shop?<section className="admin-panel"><h1>Shop details</h1><p>{message||"Loading shop…"}</p></section>:<>
 <section className={`admin-panel customer-store-hero${shop.bannerUrl ? " has-shop-banner" : ""}`}>{shop.bannerUrl ? <img className="customer-store-banner-image" src={shop.bannerUrl} alt={`${shop.name||shop.shopName||"Shop"} banner`} /> : <div className="customer-store-orbit">🍦</div>}<p className="admin-kicker">✨ LIVE ICE CREAM SHOP</p><h1>{shop.name||shop.shopName}</h1><p>{[shop.city,shop.address].filter(Boolean).join(" · ")}</p><p>{shop.description}</p><p><strong>{shopOpen?"🟢 Open now":"🔴 Currently closed"}</strong> · Hours: {shop.openingTime||"10:00"}–{shop.closingTime||"22:00"}</p><p>Delivery charge: ₹{Number(shop.deliveryFee||0).toFixed(2)} · Minimum order: ₹20</p></section>
 {hasActiveOffer&&<section className="admin-panel" style={{border:"2px solid #f59e0b",background:"#fff8e7"}}><p className="admin-kicker">🎉 SPECIAL OFFER</p>{shop.offerTitle&&<h2>{shop.offerTitle}</h2>}{shop.offerDescription&&<p style={{whiteSpace:"pre-wrap"}}>{shop.offerDescription}</p>}{shop.offerExpiresAt&&<p><strong>Valid until:</strong> {shop.offerExpiresAt}</p>}</section>}
 <section className="admin-panel customer-store-menu"><div className="customer-section-title"><span>🍨</span><div><h2>Menu & prices</h2><p>अपनी पसंदीदा आइसक्रीम चुनें</p></div></div>{visibleProducts.length===0?<p className="admin-muted">This shop has not added any products yet.</p>:<><div className="shop-grid">{visibleProducts.map(p=><article className="shop-card customer-product-card" key={p.id}>{p.imageUrl&&<img className="shop-banner" src={p.imageUrl} alt={p.name||"Product"}/>}<div className="shop-card-body"><h3>{p.name}</h3><p>{p.category||"Ice cream"}</p><p>{p.description}</p><strong>₹{Number(p.price||0).toFixed(2)}</strong>{p.originalPrice&&p.originalPrice>Number(p.price||0)?<del className="admin-muted"> ₹{Number(p.originalPrice).toFixed(2)}</del>:null}<button className="admin-primary customer-add-button" onClick={()=>add(p.id)}>＋ Add to cart</button>{(cart[p.id]||0)>0&&<span className="admin-muted"> In cart: {cart[p.id]}</span>}</div></article>)}</div>{selectedProductId&&<p><Link className="admin-secondary" href={"/shop/"+shopId}>All Products</Link></p>}</>}</section>
 <section className="admin-panel customer-cart"><div className="customer-section-title"><span>🛒</span><div><h2>Your cart</h2><p>आपका स्वादिष्ट ऑर्डर</p></div></div>{products.filter(p=>(cart[p.id]||0)>0).length===0?<p className="admin-muted">आपका cart खाली है। Menu से products जोड़ें।</p>:products.filter(p=>(cart[p.id]||0)>0).map(p=><div className="cart-item-row" key={p.id}><span>{p.name} × {cart[p.id]} — ₹{(Number(p.price||0)*cart[p.id]).toFixed(2)}</span><div className="cart-item-actions"><button type="button" className="admin-secondary small" aria-label={p.name+" की मात्रा कम करें"} onClick={()=>setCart(c=>({...c,[p.id]:Math.max(0,(c[p.id]||0)-1)}))}>− कम करें</button><button type="button" className="admin-secondary small" aria-label={p.name+" की मात्रा बढ़ाएँ"} onClick={()=>add(p.id)}>＋ बढ़ाएँ</button><button type="button" className="admin-secondary small cart-remove-button" onClick={()=>setCart(c=>({...c,[p.id]:0}))}>हटाएँ</button></div></div>)}<p>Items: ₹{subtotal.toFixed(2)} · Delivery: ₹{deliveryFee.toFixed(2)}</p><h2>Total: ₹{total.toFixed(2)}</h2><div className="register-form"><label>Your name<input required maxLength={120} value={customerName} onChange={e=>setCustomerName(e.target.value)} placeholder="Enter your full name"/></label><label>Mobile number<input required inputMode="numeric" maxLength={10} value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,"").slice(0,10))} placeholder="10 digit mobile number"/></label><label>Order method<select value={fulfillmentType} onChange={e=>setFulfillmentType(e.target.value as "pickup"|"delivery")}><option value="pickup" disabled={shop.pickupAvailable===false}>Shop pickup</option><option value="delivery" disabled={!shop.deliveryAvailable}>Home delivery</option></select></label>{fulfillmentType==="delivery"&&<label>Delivery address<input required value={address} onChange={e=>setAddress(e.target.value)} placeholder="Your complete delivery address"/></label>}{shop.pickupAvailable===false&&!shop.deliveryAvailable&&<p className="admin-error">This shop has not enabled pickup or delivery yet.</p>}<button className="admin-primary customer-checkout-button" disabled={subtotal<20||!shopOpen||(!shop.pickupAvailable&&!shop.deliveryAvailable)} onClick={()=>void placeOrder()}>✨ Buy / WhatsApp पर ऑर्डर करें</button></div>{message&&<p className="admin-success" role="status">{message}</p>}<p className="admin-muted">ऑर्डर भेजने पर WhatsApp में पूरा cart खुलेगा। Send दबाते ही ऑर्डर दुकान के रजिस्ट्रेशन वाले WhatsApp नंबर पर जाएगा। भुगतान दुकान से सीधे तय करें।</p></section>
 </>}
 </main>
}
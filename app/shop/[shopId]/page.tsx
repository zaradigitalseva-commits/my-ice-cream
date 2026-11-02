"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { onAuthStateChanged, signInWithPopup, type User } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, where } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase";

type Shop={id:string;name?:string;shopName?:string;city?:string;address?:string;phone?:string;description?:string;status?:string};
type Product={id:string;name?:string;description?:string;price?:number;stock?:number;imageUrl?:string;active?:boolean};
export default function ShopDetailsPage(){
 const params=useParams<{shopId:string}>(); const shopId=params.shopId;
 const [shop,setShop]=useState<Shop|null>(null); const [products,setProducts]=useState<Product[]>([]);
 const [user,setUser]=useState<User|null>(null); const [cart,setCart]=useState<Record<string,number>>({});
 const [phone,setPhone]=useState(""); const [address,setAddress]=useState(""); const [busy,setBusy]=useState(false); const [message,setMessage]=useState("");
 useEffect(()=>{if(!auth)return;return onAuthStateChanged(auth,setUser)},[]);
 useEffect(()=>{let active=true; async function load(){if(!db)return;try{const s=await getDoc(doc(db,"shops",shopId));if(!s.exists()||s.data().status!=="live"){setMessage("This shop is not available.");return;}const p=await getDocs(query(collection(db,"shops",shopId,"products"),where("active","==",true)));if(active){setShop({id:s.id,...s.data()} as Shop);setProducts(p.docs.map(x=>({id:x.id,...x.data()} as Product)));}}catch(e){setMessage(e instanceof Error?e.message:"Could not load shop.");}}void load();return()=>{active=false}},[shopId]);
 const total=useMemo(()=>products.reduce((sum,p)=>sum+(cart[p.id]||0)*Number(p.price||0),0),[products,cart]);
 function add(id:string,stock:number){setCart(c=>({...c,[id]:Math.min(stock,(c[id]||0)+1)}))}
 async function placeOrder(){
  if(!user){if(auth)await signInWithPopup(auth,googleProvider);return;}
  if(!db||!shop)return;
  const items=products.filter(p=>(cart[p.id]||0)>0).map(p=>({productId:p.id,name:p.name||"Product",price:Number(p.price||0),quantity:cart[p.id]}));
  if(!items.length){setMessage("Cart is empty.");return;}
  if(phone.trim().length<10||!address.trim()){setMessage("Enter your mobile number and delivery/pickup address.");return;}
  setBusy(true);setMessage("");
  const firestore=db;
  try{const orderRef=doc(collection(firestore,"orders"));const changes=items.reduce<Record<string,number>>((acc,item)=>{acc[item.productId]=item.quantity;return acc;},{});await runTransaction(firestore,async tx=>{const refs=items.map(item=>({item,ref:doc(firestore,"shops",shopId,"products",item.productId)}));const snapshots=[];for(const entry of refs)snapshots.push(await tx.get(entry.ref));for(let i=0;i<refs.length;i++){const {item,ref}=refs[i];const snap=snapshots[i];if(!snap.exists())throw new Error(item.name+" is no longer available.");const current=snap.data();const available=Number(current.stock||0);if(available<item.quantity)throw new Error("Insufficient stock for "+item.name+". Available: "+available);if(Number(current.price||0)!==item.price)throw new Error("Price changed for "+item.name+". Please refresh and try again.");}for(let i=0;i<refs.length;i++){const {item,ref}=refs[i];tx.update(ref,{stock:Number(snapshots[i]!.data().stock||0)-item.quantity,lastOrderId:orderRef.id,updatedAt:serverTimestamp()});}tx.set(orderRef,{shopId,shopName:shop.name||shop.shopName||"Shop",customerUid:user.uid,customerName:user.displayName||"",customerEmail:user.email||"",customerPhone:phone.trim(),deliveryAddress:address.trim(),items,total,stockChanges:changes,status:"placed",paymentStatus:"unpaid",createdAt:serverTimestamp()});});setCart({});setProducts(current=>current.map(p=>changes[p.id]?{...p,stock:Math.max(0,Number(p.stock||0)-changes[p.id])}:p));setMessage("Order placed successfully. Order ID: "+orderRef.id);}
  catch(e){setMessage(e instanceof Error?e.message:"Order could not be placed.");}
  finally{setBusy(false)}
 }
 return <main className="admin-wrap"><header className="admin-header"><Link href="/" className="admin-brand">🍦 MY ICE CREAM</Link><Link href="/" className="admin-secondary">Back to shops</Link></header>
 {!shop?<section className="admin-panel"><h1>Shop details</h1><p>{message||"Loading shop…"}</p></section>:<>
 <section className="admin-panel"><p className="admin-kicker">LIVE ICE CREAM SHOP</p><h1>{shop.name||shop.shopName}</h1><p>{[shop.city,shop.address].filter(Boolean).join(" · ")}</p><p>{shop.description}</p></section>
 <section className="admin-panel"><h2>Menu & prices</h2>{products.length===0?<p className="admin-muted">This shop has not added any products yet.</p>:<div className="shop-grid">{products.map(p=><article className="shop-card" key={p.id}>{p.imageUrl&&<img className="shop-banner" src={p.imageUrl} alt={p.name||"Product"}/>}<div className="shop-card-body"><h3>{p.name}</h3><p>{p.description}</p><strong>₹{Number(p.price||0).toFixed(2)}</strong><p>Available: {p.stock??0}</p><button className="admin-primary" disabled={!p.stock||((cart[p.id]||0)>=Number(p.stock))} onClick={()=>add(p.id,Number(p.stock||0))}>Add to cart</button>{(cart[p.id]||0)>0&&<span className="admin-muted"> In cart: {cart[p.id]}</span>}</div></article>)}</div>}</section>
 <section className="admin-panel"><h2>Your cart</h2>{products.filter(p=>(cart[p.id]||0)>0).map(p=><p key={p.id}>{p.name} × {cart[p.id]} — ₹{(Number(p.price||0)*cart[p.id]).toFixed(2)} <button className="admin-secondary small" onClick={()=>setCart(c=>({...c,[p.id]:Math.max(0,(c[p.id]||0)-1)}))}>−</button></p>)}<h2>Total: ₹{total.toFixed(2)}</h2><div className="register-form"><label>Mobile number<input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="10 digit mobile number"/></label><label>Pickup/delivery address<input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Address or pickup note"/></label><button className="admin-primary" disabled={busy||total<=0} onClick={()=>void placeOrder()}>{busy?"Placing order…":user?"Place order":"Sign in to place order"}</button></div>{message&&<p className="admin-success" role="status">{message}</p>}<p className="admin-muted">Online payment is not enabled yet. Orders are placed as unpaid; coordinate payment directly with the shop.</p></section>
 </>}
 </main>
}
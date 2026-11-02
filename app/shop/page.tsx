"use client";
import Link from "next/link";
import { useEffect,useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged,signOut,type User } from "firebase/auth";
import { doc,getDoc } from "firebase/firestore";
import { auth,db } from "@/lib/firebase";
export default function ShopPage(){
 const router=useRouter(); const [user,setUser]=useState<User|null>(null);
 useEffect(()=>{if(!auth)return;return onAuthStateChanged(auth,async u=>{setUser(u);if(!u){router.replace("/");return;}if(db){const p=await getDoc(doc(db,"users",u.uid));if(!p.exists()||p.data().role!=="shop")router.replace("/account/setup");}});},[router]);
 return <main className="admin-wrap"><header className="admin-header"><Link href="/" className="admin-brand">🍦 MY ICE CREAM <span>SHOP</span></Link><button className="admin-secondary" onClick={()=>auth&&signOut(auth)}>Sign out</button></header><section className="admin-panel"><p className="admin-kicker">SHOPKEEPER ACCOUNT</p><h1>Welcome{user?.displayName?", "+user.displayName:""}!</h1><p>This is your shop-only dashboard. Your shop profile, products and orders will be managed here.</p><p className="admin-muted">Shop registration tools are the next step.</p></section></main>;
}
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { isAdminEmail } from "@/lib/admin";
export default function AccountSetupPage() {
 const router = useRouter();
 const [user,setUser] = useState<User|null>(null);
 const [busy,setBusy] = useState(false);
 const [error,setError] = useState("");
 useEffect(()=>{ if(!auth)return; return onAuthStateChanged(auth, async u=>{ setUser(u); if(!u){router.replace("/");return;} if(isAdminEmail(u.email)&&u.emailVerified){router.replace("/admin");return;} if(db){const p=await getDoc(doc(db,"users",u.uid)); if(p.exists()){if(p.data().role==="shop")router.replace("/shop");else if(p.data().role==="customer")router.replace("/customer");}} }); },[router]);
 async function choose(role:"customer"|"shop") { if(!user||!db)return; setBusy(true);setError("");try{await setDoc(doc(db,"users",user.uid),{role,displayName:user.displayName||"",email:user.email||"",createdAt:serverTimestamp()});router.replace(role==="shop"?"/shop":"/customer");}catch(e){setError(e instanceof Error?e.message:"Could not save account type.");}finally{setBusy(false);} }
 return <main className="admin-wrap"><Link href="/" className="admin-back">← Home</Link><section className="admin-panel"><p className="admin-kicker">MY ICE CREAM ACCOUNT</p><h1>How will you use MY ICE CREAM?</h1><p>Choose your account type. You will see only the dashboard for your account.</p><div className="role-choice"><button className="admin-primary" disabled={busy||!user} onClick={()=>void choose("customer")}>🛍️ I am a Customer</button><button className="admin-primary" disabled={busy||!user} onClick={()=>void choose("shop")}>🏪 I own an Ice Cream Shop</button></div>{error&&<p className="admin-error">{error}</p>}</section></main>;
}

import type { Metadata } from "next";
import { LegalPage } from "../legal-pages";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "Read the terms for using the MY ICE CREAM local ice cream shop discovery and listing marketplace.",
  alternates: { canonical: "/terms" }
};

export default function TermsPage(){return <LegalPage title="Terms & Conditions" intro="By accessing MY ICE CREAM, you agree to use the website responsibly and in accordance with these terms." sections={[
{heading:"Marketplace role",paragraphs:["MY ICE CREAM provides an online discovery and listing platform for participating ice-cream shops. Unless a page expressly says otherwise, the platform is not the seller of products listed by independent shops. Orders, fulfilment, product quality, pricing, availability, refunds and delivery are handled by the relevant shop."]},
{heading:"Website use",paragraphs:[],bullets:["Use the website only for lawful purposes.","Do not attempt to disrupt, damage, probe or gain unauthorized access to the website or its data.","Do not submit misleading, unlawful, infringing or harmful content.","Provide accurate information when submitting an account, enquiry or shop registration."]},
{heading:"Shop listings and content",paragraphs:["Shop owners are responsible for ensuring that their business details, product descriptions, prices, images, offers and other submitted information are accurate and that they have permission to publish it. We may review, refuse, edit or remove listings that appear inaccurate, unsafe or inconsistent with these terms."]},
{heading:"Availability and changes",paragraphs:["We aim to keep the website available and information current, but do not guarantee uninterrupted access or that every listing is always accurate or available. We may update the website or these terms from time to time."]},
{heading:"Limitation and contact",paragraphs:["To the extent permitted by applicable law, MY ICE CREAM is not responsible for disputes or transactions between customers and independent shops. Nothing in these terms excludes rights that cannot legally be excluded.","Questions about these terms: ngogrant454@gmail.com or +91 7517260192."]}
]}/>}

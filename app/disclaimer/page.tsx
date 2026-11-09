import type { Metadata } from "next";
import { LegalPage } from "../legal-pages";

export const metadata: Metadata = {
  title: "Disclaimer",
  description: "Important information about independent shop listings, product details, prices, offers, orders and third-party links on MY ICE CREAM.",
  alternates: { canonical: "/disclaimer" }
};

export default function DisclaimerPage(){return <LegalPage title="Disclaimer" intro="Please read this information before relying on marketplace listings." sections={[
{heading:"Third-party shop information",paragraphs:["Shop profiles, product details, photographs, prices, offers and availability may be supplied or updated by independent shop owners. We make reasonable efforts to present listing information clearly, but we do not guarantee that every detail is complete, current or error-free."]},
{heading:"Orders and transactions",paragraphs:["MY ICE CREAM is a discovery and listing platform. Unless expressly stated otherwise, products are offered by the individual shop, not by the platform. Confirm ingredients, allergens, prices, stock, delivery, payment, refunds and other terms directly with the shop before ordering."]},
{heading:"External links and advertising",paragraphs:["The website may contain links to third-party websites or advertisements. We do not control or endorse all third-party content, products or services. Any interaction or transaction with a third party is between you and that third party."]},
{heading:"Contact",paragraphs:["To report a listing concern, contact ngogrant454@gmail.com or +91 7517260192."]}
]}/>}

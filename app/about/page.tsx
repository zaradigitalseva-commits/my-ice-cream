import type { Metadata } from "next";
import { LegalPage } from "../legal-pages";

export const metadata: Metadata = {
  title: "About MY ICE CREAM",
  description: "Learn how MY ICE CREAM helps customers discover local ice cream shops, products and offers and helps independent shops get listed.",
  alternates: { canonical: "/about" }
};
export default function AboutPage(){return <LegalPage title="About Us" intro="Discover local ice-cream shops, products and offers in one convenient place." sections={[
{heading:"Who we are",paragraphs:["MY ICE CREAM is an online marketplace designed to help customers discover participating local ice-cream shops and explore the products and offers those shops publish.","Our aim is to make it easier for customers to find local treats and for independent shops to present their business online."]},
{heading:"How the marketplace works",paragraphs:["Customers can browse publicly available shop and product listings. Shop owners may apply to list their businesses; listings are reviewed before being made LIVE. Product availability, prices, fulfilment and shop-specific terms are provided by the relevant shop."]},
{heading:"Our commitment",paragraphs:["We aim to keep information useful and the experience straightforward. If you notice an inaccurate listing or have a question, please contact us using the details on our Contact page."]},
{heading:"Contact",paragraphs:["Email: ngogrant454@gmail.com","Phone: +91 7517260192"],bullets:["Marketplace discovery","Local shop listings","Product and offer information"]}
]}/>}

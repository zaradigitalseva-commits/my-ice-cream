import type { Metadata } from "next";
import { LegalPage } from "../legal-pages";

export const metadata: Metadata = {
  title: "Contact MY ICE CREAM",
  description: "Contact MY ICE CREAM for shop listing support, website feedback, privacy questions and marketplace enquiries.",
  alternates: { canonical: "/contact" }
};
export default function ContactPage(){return <LegalPage title="Contact Us" intro="Questions, feedback or help with a shop listing? Get in touch." sections={[
{heading:"Contact details",paragraphs:["MY ICE CREAM Support","Email: ngogrant454@gmail.com","Phone: +91 7517260192"],bullets:["Email us: ngogrant454@gmail.com","Call us: +91 7517260192"]},
{heading:"What you can contact us about",paragraphs:["Please contact us for website feedback, privacy questions, incorrect public listings, shop registration support or technical issues. For an order, product availability, price or delivery question, please contact the shop shown on that listing first."]},
{heading:"Response information",paragraphs:["We will make reasonable efforts to review genuine enquiries. Please do not send passwords, payment card details or other sensitive information by email or phone."]}
]}/>}

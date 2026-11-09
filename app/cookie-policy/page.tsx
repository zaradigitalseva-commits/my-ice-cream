import type { Metadata } from "next";
import { LegalPage } from "../legal-pages";

export const metadata: Metadata = {
  title: "Cookie Policy | MY ICE CREAM",
  description: "Learn how MY ICE CREAM and its service providers may use essential cookies, analytics and advertising technologies.",
  alternates: { canonical: "/cookie-policy" }
};

export default function CookiePolicyPage(){return <LegalPage title="Cookie Policy" intro="This page describes cookies and similar technologies that may be used on MY ICE CREAM." sections={[
{heading:"What cookies are",paragraphs:["Cookies are small text files stored by your browser. Similar technologies may store or read information on your device to support website functions, security, measurement or advertising."]},
{heading:"How they may be used",paragraphs:[],bullets:["Essential functions such as security, navigation and remembering preferences.","Analytics, if enabled, to understand how visitors use the website.","Advertising, if enabled, to measure ad performance, limit repeated ads or personalize ads where permitted."]},
{heading:"Third-party cookies and Google advertising",paragraphs:["Third-party providers, including Google if Google advertising services are enabled, may use cookies or similar technologies to serve and measure ads. Learn more at https://policies.google.com/technologies/ads and manage ad personalization at https://myadcenter.google.com/."]},
{heading:"Your choices",paragraphs:["You can manage or delete cookies through your browser settings and may be able to block third-party cookies. Some website features may not work as intended if essential cookies are blocked. Where required by law, consent choices should be presented before non-essential cookies or advertising technologies are used."]},
{heading:"Contact",paragraphs:["For questions about cookies, email ngogrant454@gmail.com or call +91 7517260192."]}
]}/>}

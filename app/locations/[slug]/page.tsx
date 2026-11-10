import type { Metadata } from "next";
import Link from "next/link";

const locations = {
  nalasopara: {
    name: "Nalasopara",
    title: "Ice Cream Shops in Nalasopara",
    description: "Explore participating ice cream shops and kulfi listings in Nalasopara. Search shop names, check the location details shared by each business, and browse products when listings are available.",
    intro: "Looking for an ice cream shop in Nalasopara? MY ICE CREAM helps you discover participating local shops and the products they publish. Browse available listings and check each shop's details before visiting or placing an order.",
    tips: ["Search by shop name or Nalasopara location on the marketplace.", "Check the shop's own listing for its address, products and current offers.", "Shop owners can apply to register and submit their business for review."]
  },
  "vasai-virar": {
    name: "Vasai–Virar",
    title: "Ice Cream Shops in Vasai–Virar",
    description: "Find participating ice cream shop listings across the Vasai–Virar area. Explore local kulfi and ice cream products when businesses publish their listings on MY ICE CREAM.",
    intro: "Searching for an ice cream shop in Vasai or Virar? Use MY ICE CREAM to explore participating local shop listings, see the information shared by each shop, and browse listed treats when available.",
    tips: ["Try searching Vasai, Virar or a specific neighbourhood.", "Review shop-published location and product information before ordering.", "Local ice cream businesses can submit a shop registration for review."]
  },
  mumbai: {
    name: "Mumbai",
    title: "Ice Cream Shops in Mumbai",
    description: "Discover participating Mumbai ice cream shops and browse their published products, kulfi, cones and offers on MY ICE CREAM.",
    intro: "Looking for an ice cream shop in Mumbai? MY ICE CREAM is a marketplace for discovering participating local businesses and the treats they choose to list. Search by shop name or area and check each listing for current details.",
    tips: ["Search using a Mumbai neighbourhood or shop name.", "Product prices, availability and offers are provided by each participating shop.", "Mumbai shop owners can apply to list their business on MY ICE CREAM."]
  },
  maharashtra: {
    name: "Maharashtra",
    title: "Ice Cream Shops in Maharashtra",
    description: "Explore participating local ice cream shops across Maharashtra. Search by city, town or shop name and browse available ice cream and kulfi listings.",
    intro: "Want to discover a local ice cream shop in Maharashtra? MY ICE CREAM helps customers explore participating businesses and the products those shops publish. Search by city, town or shop name to check the listings currently available.",
    tips: ["Search by your city, town or neighbourhood.", "Only participating shops with published listings appear in the marketplace.", "Ice cream businesses across Maharashtra can submit a registration for review."]
  }
} as const;

type LocationSlug = keyof typeof locations;

export function generateStaticParams() {
  return Object.keys(locations).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const location = locations[slug as LocationSlug];
  if (!location) return { title: "Local Ice Cream Shops" };
  return {
    title: location.title,
    description: location.description,
    alternates: { canonical: `/locations/${slug}` },
    openGraph: { title: location.title, description: location.description, type: "website" }
  };
}

export default async function LocationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const location = locations[slug as LocationSlug];
  if (!location) return <main style={{ maxWidth: 820, margin: "60px auto", padding: 24 }}><h1>Location not found</h1><Link href="/">Browse MY ICE CREAM</Link></main>;

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "28px 22px 64px", color: "#2d211b" }}>
      <nav aria-label="Breadcrumb" style={{ fontSize: 13, marginBottom: 28 }}><Link href="/">MY ICE CREAM</Link> / <span>{location.name}</span></nav>
      <p style={{ color: "#a65324", fontWeight: 800, letterSpacing: 1, fontSize: 12 }}>LOCAL ICE CREAM MARKETPLACE</p>
      <h1 style={{ fontSize: "clamp(34px, 6vw, 54px)", lineHeight: 1.08, margin: "12px 0" }}>{location.title}</h1>
      <p style={{ fontSize: 17, lineHeight: 1.75, color: "#76675f" }}>{location.intro}</p>
      <section style={{ background: "#fff0e3", borderRadius: 20, padding: 24, margin: "28px 0" }}>
        <h2 style={{ marginTop: 0 }}>Explore local listings</h2>
        <p style={{ lineHeight: 1.7 }}>Open the marketplace to search participating shops and browse their published ice cream, kulfi, cones and other products. Listings and availability depend on the shops that have joined.</p>
        <Link href="/" style={{ display: "inline-block", background: "#2d211b", color: "white", padding: "12px 18px", borderRadius: 999, fontWeight: 700 }}>Browse shops and products</Link>
      </section>
      <section>
        <h2>Helpful tips for finding a local shop</h2>
        <ul style={{ paddingLeft: 22, lineHeight: 1.9, color: "#5f5149" }}>{location.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
      </section>
      <section style={{ borderTop: "1px solid #f0e5da", marginTop: 34, paddingTop: 24 }}>
        <h2>Own an ice cream shop?</h2>
        <p style={{ lineHeight: 1.7, color: "#76675f" }}>Submit your business details to request a listing on MY ICE CREAM. Shop listings are reviewed before they go LIVE.</p>
        <Link href="/shop/register" style={{ color: "#a65324", fontWeight: 800, textDecoration: "underline" }}>Register your shop</Link>
      </section>
    </main>
  );
}

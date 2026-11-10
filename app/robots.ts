import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/customer", "/shop$", "/shop/register", "/shop/orders"]
    },
    sitemap: "https://my-ice-cream-alpha.vercel.app/sitemap.xml",
    host: "https://my-ice-cream-alpha.vercel.app"
  };
}

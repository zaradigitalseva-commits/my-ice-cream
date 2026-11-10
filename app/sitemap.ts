import type { MetadataRoute } from "next";

const siteUrl = "https://my-ice-cream-alpha.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/about`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/contact`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/privacy-policy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/disclaimer`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/cookie-policy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/locations/nalasopara`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/locations/vasai-virar`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/locations/mumbai`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${siteUrl}/locations/maharashtra`, changeFrequency: "weekly", priority: 0.7 }
  ];
}

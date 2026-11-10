import type { Metadata, Viewport } from "next";
import PwaInstallButton from "../components/pwa-install-button";
import "./globals.css";

const siteUrl = "https://my-ice-cream-alpha.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "MY ICE CREAM | Discover Local Ice Cream Shops, Kulfi & Treats",
    template: "%s | MY ICE CREAM"
  },
  description: "Discover local ice cream shops, browse ice cream, kulfi, cones and family packs, explore shop offers, and connect with participating shops on MY ICE CREAM.",
  applicationName: "MY ICE CREAM",
  keywords: [
    "MY ICE CREAM",
    "local ice cream shops",
    "ice cream shops",
    "ice cream",
    "kulfi",
    "ice cream cones",
    "family ice cream packs",
    "ice cream offers",
    "ice cream shop online",
    "register ice cream shop"
  ],
  alternates: {
    canonical: siteUrl
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MY ICE CREAM"
  },
  icons: {
    icon: "/my-ice-cream-app.svg",
    apple: "/my-ice-cream-app.svg"
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: "MY ICE CREAM",
    title: "MY ICE CREAM | Discover Local Ice Cream Shops, Kulfi & Treats",
    description: "Find local ice cream shops, browse delicious treats and discover shop offers on MY ICE CREAM."
  },
  twitter: {
    card: "summary",
    title: "MY ICE CREAM | Discover Local Ice Cream Shops",
    description: "Find local ice cream shops, kulfi, cones, family packs and offers."
  },
  verification: {
    google: "Isof27UWPVj_BNN0jVE_U6wP6ywM_ojnYi43v3uhKlI"
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    }
  }
};

export const viewport: Viewport = {
  themeColor: "#fff7ed",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <PwaInstallButton />
      </body>
    </html>
  );
}

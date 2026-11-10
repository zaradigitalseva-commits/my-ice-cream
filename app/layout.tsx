import type { Metadata, Viewport } from "next";
import PwaInstallButton from "../components/pwa-install-button";
import "./globals.css";

export const metadata: Metadata = {
  title: "MY ICE CREAM",
  description: "Discover local ice-cream shops, flavours and offers.",
  applicationName: "MY ICE CREAM",
  verification: {
    google: "Isof27UWPVj_BNN0jVE_U6wP6ywM_ojnYi43v3uhKlI"
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

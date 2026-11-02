import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "MY ICE CREAM",
  description: "Discover local ice-cream shops, flavours and offers.",
  applicationName: "MY ICE CREAM"
};
export const viewport: Viewport = { themeColor: "#fff7ed", width: "device-width", initialScale: 1 };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

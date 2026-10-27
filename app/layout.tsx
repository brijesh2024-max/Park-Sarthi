import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
 title: "ParkSarthi — A little space. A lot less stress.",
 description: "Find local parking for your car or bike, add a car wash, or earn from your spare parking space. Built for Indian cities.",
 icons: {icon: "/favicon.svg", shortcut: "/favicon.svg"},
};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) { return <html lang="en"><body>{children}</body></html>; }


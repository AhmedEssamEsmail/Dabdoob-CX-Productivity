import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import SiteChrome from "@/components/layout/SiteChrome";
import BootSplash from "@/components/shell/BootSplash";

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-ibm-plex-arabic",
  subsets: ["arabic"],
  weight: ["400", "600", "700"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CX Helm Productivity",
  description: "CX Helm Productivity System",
};

/**
 * index.html line 14 verbatim — stored appearance must hold before app JS
 * runs — plus the legacy `data-entry="first"` the bundle set at eval time.
 */
const APPEARANCE_BOOT = `try{var a=JSON.parse(localStorage.getItem('cx.appearance')||'{}'),h=document.documentElement;if(a.still)h.setAttribute('data-reduce-motion','');if(a.lang==='ar'){h.lang='ar';h.dir='rtl'}}catch(e){}document.documentElement.dataset.entry='first'`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      dir="ltr"
      suppressHydrationWarning
      className={`${ibmPlexSans.variable} ${ibmPlexArabic.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_BOOT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <div id="app">
          <SiteChrome>{children}</SiteChrome>
        </div>
        <BootSplash />
      </body>
    </html>
  );
}

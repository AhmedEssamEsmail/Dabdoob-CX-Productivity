import type { Metadata } from "next";
import "./globals.css";
import SiteChrome from "@/features/shared/components/layout/SiteChrome";
import BootSplash from "@/features/shared/components/shell/BootSplash";

export const metadata: Metadata = {
  title: "CX Helm",
  description: "CX Helm — the CX command center",
};

/**
 * index.html line 14 verbatim — stored appearance must hold before app JS
 * runs — plus the legacy `data-entry="first"` the bundle set at eval time.
 */
const APPEARANCE_BOOT = `try{var a=JSON.parse(localStorage.getItem('cx.appearance')||'{}'),h=document.documentElement;if(a.still)h.setAttribute('data-reduce-motion','');if(a.lang==='ar'){h.lang='ar';h.dir='rtl'}}catch(e){}document.documentElement.dataset.entry='first'`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        {/* index.html lines 7-10 verbatim: preconnects + the exact font set the
            legacy bundle loaded — IBM Plex Sans 400/500/600/700, IBM Plex Sans
            Arabic 400/600/700, IBM Plex Mono 400/500. Kept non-render-blocking
            via media="print" so the boot splash paints before font CSS arrives. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
          media="print"
          suppressHydrationWarning
        />
        {/* Equivalent of the legacy inline onload="this.media='all'" — React
            drops string event handlers, so a tiny script flips media to 'all'. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `document.querySelectorAll('link[media="print"]').forEach(function(l){l.onload=function(){l.media='all'}})`,
          }}
        />
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_BOOT }} />
      </head>
      <body>
        <div id="app">
          <SiteChrome>{children}</SiteChrome>
        </div>
        <BootSplash />
      </body>
    </html>
  );
}

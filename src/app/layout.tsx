import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic, IBM_Plex_Mono } from "next/font/google";
import "./theme.css";
import "./cx-kit.css";
import "./refresh.css";
import SiteChrome from "@/features/shared/components/layout/SiteChrome";
import BootSplash from "@/features/shared/components/shell/BootSplash";
import { getAppBootstrap } from "@/features/shared/platform/bootstrap";
import { qaBootFlags } from "@/features/cx-quality/lib/server";

export const metadata: Metadata = {
  title: "Dabdoob CX",
  description: "Dabdoob CX — the CX command center",
};

// Root layout awaits getAppBootstrap (per-request cookies()) below; opt the
// whole app out of blocking-prerender/static-shell validation.
export const instant = false;

/* index.html lines 7-10 verbatim font set — IBM Plex Sans (variable, covers
   400-700), IBM Plex Sans Arabic 400/600/700, IBM Plex Mono 400/500 — now
   self-hosted via next/font (no render-blocking request, display:swap). */
const plexSans = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-ibm-plex-sans",
});
const plexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin", "latin-ext"],
  weight: ["400", "600", "700"],
  variable: "--font-ibm-plex-sans-arabic",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
});

/**
 * index.html line 14 verbatim — stored appearance must hold before app JS
 * runs — plus the legacy `data-entry="first"` the bundle set at eval time.
 */
const APPEARANCE_BOOT = `try{var a=JSON.parse(localStorage.getItem('cx.appearance')||'{}'),h=document.documentElement;if(a.lang==='ar'){h.lang='ar';h.dir='rtl'}}catch(e){}document.documentElement.dataset.entry='first'`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  /* Per-request bootstrap: __CC_BOOT__ wins over /api/bootstrap in
     loadBootstrap(); null on any error keeps the fetch fallback identical. */
  const payload = await getAppBootstrap(qaBootFlags).catch(() => null);
  const boot =
    payload === null
      ? "null"
      : JSON.stringify(payload).replace(/</g, "\\u003c");
  return (
    <html
      lang="en"
      dir="ltr"
      suppressHydrationWarning
      className={`${plexSans.variable} ${plexSansArabic.variable} ${plexMono.variable}`}
    >
      <head>
        {/* Rebind the theme.css type tokens (literal family names can't match
            next/font's generated family) to the self-hosted vars. `html:root`
            (0,1,1) beats theme.css `:root` (0,1,0) regardless of sheet order. */}
        <style>{`html:root{--font:var(--font-ibm-plex-sans),var(--font-ibm-plex-sans-arabic),"IBM Plex Sans","IBM Plex Sans Arabic",system-ui,-apple-system,"Segoe UI","Noto Sans Arabic",Tahoma,sans-serif;--font-mono:var(--font-ibm-plex-mono),"IBM Plex Mono",ui-monospace,"SF Mono",Menlo,Consolas,monospace;--cx-font-ar:var(--font-ibm-plex-sans-arabic),var(--font)}`}</style>
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_BOOT }} />
      </head>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__CC_BOOT__=${boot};`,
          }}
        />
        <div id="app">
          <SiteChrome>{children}</SiteChrome>
        </div>
        <BootSplash />
      </body>
    </html>
  );
}

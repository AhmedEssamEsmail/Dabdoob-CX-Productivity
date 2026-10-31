/**
 * The boot splash from original index.html (lines 15-52), verbatim CSS and
 * markup. Rendered as a sibling after <div id="app"> in <body>; it paints
 * before any JS and hides itself via `#app:not(:empty) + .boot-splash` once
 * the shell renders. The three bear PNGs are decoded to /assets/boot/.
 */

const SPLASH_CSS = `
.boot-splash{position:fixed;inset:0;z-index:50;display:grid;place-content:center;justify-items:center;gap:14px;background:radial-gradient(900px 500px at 8% -10%,#cfe4ff 0,transparent 60%),radial-gradient(800px 500px at 100% 0,#fbd9e8 0,transparent 55%),#f2f5f4;color:#4d5d63;font:500 0.875rem/1.3 'IBM Plex Sans',system-ui,sans-serif}
#app:not(:empty)+.boot-splash{display:none}
.bl-mix{position:relative;display:grid;width:260px;height:190px}
.bl-scene{grid-area:1/1;display:grid;place-items:center;align-content:center;opacity:0;animation:bl-cycle 9s infinite}
.bl-scene:first-child{opacity:1}.bl-scene:nth-child(2){animation-delay:3s}.bl-scene:nth-child(3){animation-delay:6s}
@keyframes bl-cycle{0%{opacity:0}4%,30%{opacity:1}34%,100%{opacity:0}}
.bl-hopbox{position:relative;display:grid;justify-items:center;padding-top:24px}
.bl-hop{transform-origin:50% 100%;animation:bl-hop 1s cubic-bezier(.3,0,.4,1) infinite}
@keyframes bl-hop{0%,100%{transform:translateY(0) scale(1.06,.92)}45%{transform:translateY(-22px) scale(.97,1.05)}}
.bl-shadow{position:absolute;bottom:-6px;width:90px;height:8px;border-radius:50%;background:rgb(0 0 0/.2);animation:bl-shadow 1s cubic-bezier(.3,0,.4,1) infinite}
@keyframes bl-shadow{0%,100%{transform:scale(1);opacity:.5}45%{transform:scale(.6);opacity:.25}}
.bl-sway{transform-origin:50% 100%;animation:bl-sway 2.2s ease-in-out infinite}
@keyframes bl-sway{0%,100%{transform:rotate(-7deg) translateX(-4px)}50%{transform:rotate(7deg) translateX(4px)}}
.bl-peekbox{position:relative;overflow:hidden;width:100%;height:150px}
.bl-peek{position:absolute;bottom:-6px;left:50%;margin-left:-37px;transform-origin:50% 100%;animation:bl-peek 2.6s ease-in-out infinite}
@keyframes bl-peek{0%,100%{transform:translateY(80%)}25%,70%{transform:translateY(8%) rotate(-5deg)}47%{transform:translateY(8%) rotate(6deg)}}
.bl-peekskel{position:absolute;inset:auto 0 0;display:grid;gap:8px;padding:0 8px}
.bl-peekskel i{display:block;height:12px;border-radius:6px;background:#e3e9f2}.bl-peekskel i:nth-child(2){width:70%}.bl-peekskel i:nth-child(3){width:45%}
html[data-reduce-motion] .boot-splash *{animation:none!important}
@media (prefers-color-scheme:dark){.boot-splash{background:radial-gradient(900px 500px at 8% -10%,#10305c 0,transparent 60%),radial-gradient(800px 500px at 100% 0,#4a1535 0,transparent 55%),#131b1d;color:#a9b8b5}.bl-peekskel i{background:#22324d}}
@media (prefers-reduced-motion:reduce){.boot-splash *{animation:none!important}}`

export default function BootSplash() {
  return (
    <div className="boot-splash" role="status">
      {/* stays inside .boot-splash so `#app:not(:empty)+.boot-splash` matches */}
      <style dangerouslySetInnerHTML={{ __html: SPLASH_CSS }} />
      <div className="bl-mix" aria-hidden="true">
          <div className="bl-scene">
            <div className="bl-hopbox">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="bl-hop" src="/assets/boot/splash-1.png" alt="" width="150" height="87" />
              <span className="bl-shadow" />
            </div>
          </div>
          <div className="bl-scene">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="bl-sway" src="/assets/boot/splash-2.png" alt="" width="110" height="126" />
          </div>
          <div className="bl-scene">
            <div className="bl-peekbox">
              <div className="bl-peekskel">
                <i />
                <i />
                <i />
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="bl-peek" src="/assets/boot/splash-3.png" alt="" width="74" height="85" />
            </div>
          </div>
        </div>
      <span id="boot-text" suppressHydrationWarning>
        Loading CX Helm Productivity…
      </span>
      <script
        dangerouslySetInnerHTML={{
          __html: `if(document.documentElement.lang==='ar')document.getElementById('boot-text').textContent='جارٍ تحميل CX Helm Productivity…'`,
        }}
      />
    </div>
  )
}

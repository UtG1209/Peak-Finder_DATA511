#!/usr/bin/env python3
"""Text-only patch of the three finished legacy pages for back and checkpoint times.

This intentionally does not invoke any trail-kit tile steps or rebuild routes.
"""
from __future__ import annotations

import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "app" / "public" / "data" / "hikes.json"
MANIFEST = ROOT / "walks" / "manifest.json"

CSS = r"""
#backToHike{position:absolute;z-index:5;top:calc(env(safe-area-inset-top,0px) + 64px);left:max(16px,env(safe-area-inset-left,0px));min-height:44px;display:inline-flex;align-items:center;padding:0 14px;border:1px solid var(--line);border-radius:12px;background:var(--panel);color:var(--text);font:600 14px var(--body);text-decoration:none;backdrop-filter:blur(6px)}
#backToHike:hover{border-color:var(--sand)}#backToHike:focus-visible{outline:2px solid var(--text);outline-offset:2px}
#timeMarkers line{stroke:rgba(242,239,233,.86);stroke-width:1;vector-effect:non-scaling-stroke}#timeMarkers circle{fill:var(--sand);stroke:var(--text);stroke-width:1;vector-effect:non-scaling-stroke}#timeMarkers text{fill:var(--text);stroke:rgba(16,20,24,.8);stroke-width:2px;paint-order:stroke;font:700 10px var(--body);text-anchor:middle}
#backTransition{position:fixed;z-index:20;inset:0;display:none;overflow:hidden;pointer-events:none;background:linear-gradient(180deg,#3a82d4 0%,#78b0ea 52%,#cfe5fa 100%)}#backTransition.active{display:block}#backTransition>div{position:absolute;inset:-10%;opacity:0;background-repeat:repeat-x;background-position:center;will-change:transform,opacity}#backFar{background-image:url(clouds/wisps.webp);background-size:auto 110%}#backMid{background-image:url(clouds/cumulus.webp);background-size:auto 125%}#backNear{background-image:url(clouds/mass.webp);background-size:auto 150%}#backVeil{inset:0!important;background:#edf4fb}#backTitle{inset:0!important;display:flex;justify-content:center;align-items:center;color:#15222d;font:800 clamp(24px,4vw,48px) var(--display);text-align:center}
#backTransition.active #backFar{opacity:.68;transform:scale(1.5);transition:transform 1.7s ease,opacity 1.7s ease}#backTransition.active #backMid{opacity:.86;transform:scale(2);transition:transform 1.5s ease .12s,opacity 1.5s ease .12s}#backTransition.active #backNear{opacity:1;transform:scale(3.2);transition:transform 1.3s ease .24s,opacity 1.3s ease .24s}#backTransition.active #backVeil{opacity:.9;transition:opacity .5s ease .8s}#backTransition.active #backTitle{opacity:1;transition:opacity .4s ease .8s}
@media(max-width:640px){#backToHike{top:calc(env(safe-area-inset-top,0px) + 12px)}}@media(prefers-reduced-motion:reduce){#backTransition *,#backTransition.active *{transition-duration:.01ms!important}}
"""

SCRIPT = r"""
(function(){
 const qs=new URLSearchParams(location.search), requested=qs.get('back'), root=new URL('../../',location.href);
 let backUrl=root.href; if(requested){try{backUrl=requested.startsWith('#/')?root.href+requested:new URL(requested,location.href).href}catch(_){}}
 const button=document.getElementById('backToHike'), overlay=document.getElementById('backTransition'); button.href=backUrl;
 const markers=document.getElementById('timeMarkers');
 try{const rows=JSON.parse(qs.get('times')||'[]'); if(Array.isArray(rows)&&window.__prof){const {X}=window.__prof, ns='http://www.w3.org/2000/svg'; rows.filter(x=>Number.isFinite(+x.dist_m)&&Number.isFinite(+x.time)&&(x.dir==='up'||x.dir==='down')).forEach(m=>{const x=X(Math.max(0,Math.min(TOTAL,+m.dist_m))), y=m.dir==='up'?18:53, line=document.createElementNS(ns,'line'), dot=document.createElementNS(ns,'circle'), label=document.createElementNS(ns,'text'), n=((Math.round(+m.time)%1440)+1440)%1440; line.setAttribute('x1',x);line.setAttribute('x2',x);line.setAttribute('y1',y+4);line.setAttribute('y2',m.dir==='up'?37:49);dot.setAttribute('cx',x);dot.setAttribute('cy',y);dot.setAttribute('r',3);label.setAttribute('x',x);label.setAttribute('y',m.dir==='up'?11:68);label.textContent=Math.floor(n/60)+':'+String(n%60).padStart(2,'0')+(m.dir==='up'?' ↑':' ↓');markers.append(line,dot,label)})}}catch(_){/* malformed optional times are ignored */}
 let leaving=false; button.addEventListener('click',e=>{e.preventDefault();if(leaving)return;leaving=true;overlay.classList.add('active');const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;setTimeout(()=>{let appRef=false;try{const ref=new URL(document.referrer);appRef=ref.origin===location.origin&&ref.pathname===root.pathname}catch(_){}if(appRef&&history.length>1)history.back();else location.assign(backUrl)},reduced?100:2200)})
})();
"""


def main() -> None:
    hikes = {h["id"]: h for h in json.loads(DATA.read_text(encoding="utf-8"))}
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    for walk_id, meta in manifest["walks"].items():
        if not meta.get("legacy"):
            continue
        hike = hikes[meta["hike_id"]]
        path = ROOT / "walks" / walk_id / "index.html"
        text = path.read_text(encoding="utf-8")
        if "<!-- lane2 walk navigation -->" in text:
            print(f"[skip] {walk_id}: already patched")
            continue
        text = text.replace("</style>", CSS + "</style>", 1)
        name = html.escape(hike["name"], quote=False)
        brand = re.search(r'(<div id="brand">.*?</div>)', text, flags=re.S)
        if not brand:
            raise ValueError(f"{path}: brand element not found")
        text = text[:brand.end()] + f'\n  <a id="backToHike" href="../../">← Back to <span>{name}</span></a>' + text[brand.end():]
        svg = re.search(r'(<svg id="profSvg".*?</svg>)', text, flags=re.S)
        if not svg:
            raise ValueError(f"{path}: profile SVG not found")
        text = text[:svg.end() - len("</svg>")] + '<g id="timeMarkers" aria-hidden="true"></g>' + text[svg.end() - len("</svg>"):]
        stage = re.search(r'(</div>\s*</div>\s*<div id="track">)', text)
        if not stage:
            # Current template ends the stage and then starts its scroll track.
            raise ValueError(f"{path}: stage/track boundary not found")
        overlay = '<div id="backTransition" aria-hidden="true"><div id="backFar"></div><div id="backMid"></div><div id="backNear"></div><div id="backVeil"></div><div id="backTitle">Returning to Peak Finder</div></div>\n'
        text = text[:stage.start()] + text[stage.start():stage.end()].replace('<div id="track">', overlay + '<div id="track">', 1) + text[stage.end():]
        text += '\n<!-- lane2 walk navigation -->\n<script>\n' + SCRIPT + '\n</script>\n'
        path.write_text(text, encoding="utf-8")
        print(f"[patched] {walk_id}: back link and optional checkpoint times")


if __name__ == "__main__":
    main()

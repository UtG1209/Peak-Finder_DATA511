// Fallback downloader for restricted networks: run in a normal browser's DevTools console.
//
// When Python can't reach the data hosts (blocked by a network or sandbox) but a browser can,
// paste this whole file into the console of any page (e.g. https://commons.wikimedia.org),
// edit TRAIL below to match trails/<id>.json, and press Enter. All four hosts send CORS
// headers, so fetch() works from any origin. It saves three files to your Downloads folder:
//   <id>_dem.json, <id>_img.json  ({"z/x/y": base64})  and  <id>_osm.json
// Then run:  python pipeline/import_browser_bundle.py <id> ~/Downloads
//
// If the browser blocks automatic downloads, it shows links instead: click each one.

const TRAIL = {
  id: 'angels_landing',
  osm_bbox: [-112.965, 37.25, -112.935, 37.275],          // [west, south, east, north]
  wide: [-113.15, 37.10, -112.75, 37.45],
  mid:  [-113.03, 37.20, -112.87, 37.33],
  core: [-112.975, 37.245, -112.925, 37.285],
};

(async () => {
  const lon2x = (lon, z) => Math.floor((lon + 180) / 360 * 2 ** z);
  const lat2y = (lat, z) => { const r = lat * Math.PI / 180; return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z); };
  const tiles = (b, z) => { const o = []; for (let x = lon2x(b[0], z); x <= lon2x(b[2], z); x++) for (let y = lat2y(b[3], z); y <= lat2y(b[1], z); y++) o.push([z, x, y]); return o; };
  const DEM = (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
  const IMG = (z, x, y) => `https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/${z}/${y}/${x}`;

  const demList = [10, 11, 12].flatMap(z => tiles(TRAIL.wide, z)).concat(tiles(TRAIL.mid, 13), tiles(TRAIL.core, 14));
  const imgList = tiles(TRAIL.wide, 12).concat([13, 14].flatMap(z => tiles(TRAIL.mid, z)), [15, 16].flatMap(z => tiles(TRAIL.core, z)));

  const toB64 = blob => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
  async function grab(list, url) {
    const out = {}; let i = 0, done = 0;
    async function worker() {
      while (i < list.length) {
        const [z, x, y] = list[i++];
        try { const r = await fetch(url(z, x, y)); if (r.ok) out[`${z}/${x}/${y}`] = await toB64(await r.blob()); } catch (e) { /* missing tile: filled later */ }
        if (++done % 25 === 0) console.log(`${done}/${list.length}`);
      }
    }
    await Promise.all(Array.from({ length: 8 }, worker));   // 8 downloads at a time
    return out;
  }

  console.log(`elevation: ${demList.length} tiles`); const dem = await grab(demList, DEM);
  console.log(`imagery: ${imgList.length} tiles`); const img = await grab(imgList, IMG);

  const [w, s, e, n] = TRAIL.osm_bbox, bb = `${s},${w},${n},${e}`;
  const q = `[out:json][timeout:60];(way["highway"~"path|footway"](${bb});node["tourism"="viewpoint"](${bb});node["natural"~"peak|saddle"](${bb});node["highway"="bus_stop"](${bb}););out geom;`;
  const ctl = new AbortController(); setTimeout(() => ctl.abort(), 90000);   // Overpass can hang; GET + timeout is reliable
  const osm = await (await fetch('https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(q), { signal: ctl.signal })).json();

  const files = { [`${TRAIL.id}_dem.json`]: dem, [`${TRAIL.id}_img.json`]: img, [`${TRAIL.id}_osm.json`]: osm };
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;z-index:99999;top:10px;left:10px;background:#fff;padding:12px;border:2px solid #000;font:16px sans-serif;display:flex;flex-direction:column;gap:14px';
  for (const [name, obj] of Object.entries(files)) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(obj)], { type: 'application/json' }));
    a.download = name; a.textContent = 'Save ' + name; box.appendChild(a);
  }
  document.body.appendChild(box);
  console.log('Done. Click each "Save" link at the top left of the page.');
})();

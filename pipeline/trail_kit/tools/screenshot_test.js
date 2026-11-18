// Visual test: opens the built page in headless Chromium, scrolls to several points on the
// trail, and saves a screenshot of each so you can check the camera never ends up inside a
// canyon wall and the cards and photos show up.
//
// Setup once:  npm install playwright@1.63.0 && npx playwright install chromium   (tested with 1.63.0)
// Run:         node tools/screenshot_test.js angels_landing
// Output:      output/<trail>/_shots/shot_<progress>.png   (delete the folder before publishing)
//
// Headless Chromium has no GPU; the SwiftShader flags give it software WebGL so MapLibre can draw.
// If loading times out, the Google Fonts link may be blocked: the page still works without it.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const id = process.argv[2] || 'angels_landing';
const root = path.join(__dirname, '..', 'output', id);
const types = { '.html': 'text/html', '.png': 'image/png', '.jpg': 'image/jpeg', '.js': 'text/javascript' };

const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(f, (err, buf) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); res.end(buf);
  });
}).listen(8765);

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  page.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') console.log('[page]', m.text()); });
  page.setDefaultTimeout(120000);
  // Software rendering is far too slow for the camera's easing to settle (a long trail never got there
  // within 2 minutes). Reduced motion makes the page jump straight to the scroll position, which is all a
  // screenshot needs. Set REAL_EASING=1 to test the easing itself.
  if (!process.env.REAL_EASING) await page.emulateMedia({ reducedMotion: 'reduce' });
  // Offline-friendly: skip web fonts; optionally serve MapLibre from a local copy
  // (MAPLIBRE_JS=/path/to/maplibre-gl.js node tools/screenshot_test.js <id>)
  await page.route('**/fonts.googleapis.com/**', r => r.abort());
  if (process.env.MAPLIBRE_JS) {
    await page.route('**/maplibre-gl@*/dist/maplibre-gl.js', r =>
      r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(process.env.MAPLIBRE_JS) }));
  }
  const season = process.env.SEASON;   // optional: spring|summer|autumn|winter (page needs the season toggle)
  await page.goto('http://localhost:8765/' + (season ? '?season=' + season : ''), { waitUntil: 'load' });
  fs.mkdirSync(path.join(root, '_shots'), { recursive: true });
  for (const p of (process.env.SHOTS ? process.env.SHOTS.split(",").map(Number) : [0, 0.3, 0.62, 0.8, 0.9, 1])) {
    await page.evaluate(p => {
      const t = document.getElementById('track');
      scrollTo(0, t.offsetTop + (t.offsetHeight - innerHeight) * p);
    }, p);
    await page.waitForTimeout(3000);   // let the camera ease in
    await page.waitForFunction(() => typeof current !== 'undefined' && Math.abs(current - target) < 1e-3, null, { timeout: 300000, polling: 500 });   // slow software rendering: wait until the camera has reached the scroll target
    await page.waitForFunction(() => typeof map !== 'undefined' && map.areTilesLoaded(), null, { timeout: 90000, polling: 500 });
    await page.waitForTimeout(1500);   // one more frame after the last tile arrives
    const out = path.join(root, '_shots', `shot_${season ? season + '_' : ''}${p}.png`);
    await page.screenshot({ path: out });
    console.log('saved', out);
  }
  await browser.close(); server.close();
})();

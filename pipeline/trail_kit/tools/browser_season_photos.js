// Browser snippets for finding and packing SEASON photos from Wikimedia Commons.
// Use them in a browser tab on any page of an allowed host (the built-in browser pane worked), in the
// console / javascript tool. They are the ones used for North Cascades (see docs/BUILD_LOG.md).
// Commons dates ("date taken") are NOT reliable for the season (many are upload or scan dates):
// decide the season by LOOKING at a contact sheet.
//
// 1. Search: collect many candidates near the trail (geosearch + title searches), keep image files only.
//    const API = 'https://commons.wikimedia.org/w/api.php?origin=*&format=json&';
//    const geo = await (await fetch(API + 'action=query&list=geosearch&gscoord=LAT|LON&gsradius=10000&gsnamespace=6&gslimit=500')).json();
//    // plus title searches: list=search&srsearch=<place name>&srnamespace=6&srlimit=50 (one per landmark name)
//    Then for the page ids: prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=240 -> rows {title, thumb, lic, date, w, h}
//    Keep rows with lic starting "Public domain", "CC0", "CC BY", "CC BY-SA" (what s4 accepts); drop tiny images (w < 900).
//
// 2. Contact sheet (rows = array of those objects). Look at the screenshot, then write down index -> season.
window.__grid = async (rows, ids) => {
  document.body.innerHTML = '';
  const w = document.createElement('div');
  w.style.cssText = 'display:grid;grid-template-columns:repeat(4,180px);gap:4px;background:#111;color:#fff;font:11px sans-serif';
  document.body.appendChild(w);
  for (const i of ids) {
    const r = rows[i], d = document.createElement('div');
    d.innerHTML = `<img src="${r.thumb}" style="width:100%;height:120px;object-fit:cover"><div>${i} ${r.title.replace('File:', '').slice(0, 24)} ${String(r.date || '').slice(0, 10)}</div>`;
    w.appendChild(d);
  }
  await new Promise(s => setTimeout(s, 4000));
  return ids.length;
};
//
// 3. Pack the chosen ones: picks = {'<stop key>_<season>': rowIndex}. Output = parts of about 1.3 MB.
window.__pack = async (rows, picks) => {
  const strip = s => (s || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').trim();
  const entries = Object.entries(picks), info = {}, out = {};
  const titles = entries.map(([k, i]) => rows[i].title);
  for (let b = 0; b < titles.length; b += 10) {
    const u = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1280&titles=' + encodeURIComponent(titles.slice(b, b + 10).join('|'));
    const j = await (await fetch(u)).json();
    for (const p of Object.values(j.query.pages)) info[p.title] = p.imageinfo && p.imageinfo[0];
  }
  for (const [k, i] of entries) {
    const ii = info[rows[i].title], em = ii.extmetadata || {};
    const bmp = await createImageBitmap(await (await fetch(ii.thumburl || ii.url)).blob());
    const sc = Math.min(1, 900 / bmp.width), c = document.createElement('canvas');
    c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    out[k] = { data: c.toDataURL('image/jpeg', 0.8), credit: { artist: strip(em.Artist && em.Artist.value) || 'Unknown (see file page)', license: strip(em.LicenseShortName && em.LicenseShortName.value), license_url: strip(em.LicenseUrl && em.LicenseUrl.value), page: ii.descriptionurl } };
  }
  return out;   // then split into parts <= 1.3 MB, save as nc_season_NN.json by clicking <a download> links, stage with device_stage_files, and run
                //   python pipeline/import_browser_photos.py <id> "<folder>/*_season_*.json"
};
// The Commons file names must also go into the config (season_photo_files) so s4 can fetch them on an open network.

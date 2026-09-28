/* The hub's look, shared (Daria, 27.09): Hub (the editor), Newton's chat (the event's cards on any page) and the
   previews draw with the same palettes, fonts, grounds, cards, buttons and icons — so a card in the chat is the
   card on the hub. Raw colours here are the customer's game theme, not the dashboard (like the hub page).
   Needs app.js (AG) and hub-icons.js before it. */
AG.skin = (() => {
  /* ---------- the skin of the hub (Daria, 27.09): a look is a whole style world, not a pattern ----------
     A world (the way Fortnite, a match-3, Diablo or Minecraft look) sets the ground (a sky, rays, embers, pixel hills…),
     the art technique (3D, sticker, ink, pixel, neon, metal, flat vector), the type, the buttons and the cards.
     Inside a world the dice varies the palette, the font, the ground and the icons. Styles pick the world by tags.
     Raw colours here are the customer's game, not the dashboard. Newton names every look (the palette's name). */
  const PALETTES = [
    { name: 'Midnight arcade', primary: '#F2B33D', accent: '#8F7CF0', bg: '#1B1531', surface: '#2A2150', fg: '#FFFFFF', on: '#17181C' },
    { name: 'Deep jungle', primary: '#4FD1A5', accent: '#F26B5B', bg: '#10202A', surface: '#1A3340', fg: '#FFFFFF', on: '#0E1A20' },
    { name: 'Ember market', primary: '#FF8A3D', accent: '#B3A6FF', bg: '#20131F', surface: '#33202F', fg: '#FFFFFF', on: '#1A0F0A' },
    { name: 'Ice vault', primary: '#7CC4FF', accent: '#F2B33D', bg: '#141A2E', surface: '#212A45', fg: '#FFFFFF', on: '#0E1424' },
    { name: 'Neon alley', primary: '#FF4FA3', accent: '#4FE0FF', bg: '#12101F', surface: '#221B3A', fg: '#FFFFFF', on: '#12101F' },
    { name: 'Bone and gold', primary: '#E8C978', accent: '#7FB37A', bg: '#171613', surface: '#262420', fg: '#F5EEDC', on: '#1A1812' },
    { name: 'Candy pop', primary: '#FF4F8B', accent: '#7B61FF', bg: '#FFF0F5', surface: '#FFFFFF', fg: '#2B1633', on: '#FFFFFF', light: true },
    { name: 'Paper forest', primary: '#2E8B57', accent: '#E07A3C', bg: '#F2EEE3', surface: '#FFFCF5', fg: '#1F2A1C', on: '#FFFFFF', light: true },
    { name: 'Blood moon', primary: '#E5484D', accent: '#F2B33D', bg: '#130A0D', surface: '#24131A', fg: '#FFFFFF', on: '#FFFFFF' },
    { name: 'Clean slate', primary: '#2563EB', accent: '#0EA5E9', bg: '#F3F5F9', surface: '#FFFFFF', fg: '#0F172A', on: '#FFFFFF', light: true },
    { name: 'Storm blue', primary: '#FFE03A', accent: '#3AC8FF', bg: '#0F1C52', surface: '#1B2F86', fg: '#FFFFFF', on: '#1A1400' },
    { name: 'Victory royale', primary: '#FFE03A', accent: '#FF4FD8', bg: '#240B57', surface: '#3A1790', fg: '#FFFFFF', on: '#1A1400' },
    { name: 'Sugar sky', primary: '#FF5FA2', accent: '#FFB02E', bg: '#D9F1FF', surface: '#FFFFFF', fg: '#35214A', on: '#FFFFFF', light: true },
    { name: 'Mint candy', primary: '#2FBF71', accent: '#9B6BFF', bg: '#FFEAF4', surface: '#FFFFFF', fg: '#3B2346', on: '#FFFFFF', light: true },
    { name: 'Sanctuary', primary: '#C8102E', accent: '#C9A15B', bg: '#0B0909', surface: '#171212', fg: '#E9DFCF', on: '#FFFFFF' },
    { name: 'Hellforge', primary: '#D08A2E', accent: '#A3201C', bg: '#0F0B08', surface: '#1D1711', fg: '#EFE3CE', on: '#140C04' },
    { name: 'Overworld', primary: '#5DAE3B', accent: '#9B6A3C', bg: '#262626', surface: '#373737', fg: '#FFFFFF', on: '#FFFFFF' },
    { name: 'Daylight', primary: '#3C8527', accent: '#7A4E2A', bg: '#EDEDED', surface: '#FFFFFF', fg: '#1E1E1E', on: '#FFFFFF', light: true }
  ];
  /* type: the headline font with its weight, case and spacing — the body stays Inter, readable */
  const FONTS = [
    { name: 'Unbounded', css: "'Unbounded', sans-serif", w: 600 },
    { name: 'Rubik', css: "'Rubik', sans-serif", w: 700 },
    { name: 'Space Grotesk', css: "'Space Grotesk', sans-serif", w: 700, ls: '-.01em' },
    { name: 'Cinzel', css: "'Cinzel', serif", w: 700, up: true, ls: '.04em' },
    { name: 'Orbitron', css: "'Orbitron', sans-serif", w: 700, up: true, ls: '.05em' },
    { name: 'Pixelify Sans', css: "'Pixelify Sans', sans-serif", w: 600 },
    { name: 'Fredoka', css: "'Fredoka', sans-serif", w: 600 },
    { name: 'Russo One', css: "'Russo One', sans-serif", w: 400, up: true, ls: '.02em' },
    { name: 'Bungee', css: "'Bungee', sans-serif", w: 400, up: true },
    { name: 'Luckiest Guy', css: "'Luckiest Guy', sans-serif", w: 400, up: true, ls: '.02em' },
    { name: 'Baloo 2', css: "'Baloo 2', sans-serif", w: 800 },
    { name: 'Grenze Gotisch', css: "'Grenze Gotisch', serif", w: 700, ls: '.01em' },
    { name: 'Silkscreen', css: "'Silkscreen', sans-serif", w: 700, up: true },
    { name: 'Caveat Brush', css: "'Caveat Brush', cursive", w: 400 }
  ];
  /* the art technique the icons are drawn in; the ground behind the page and the banner; the card surface */
  const ARTS = ['flat vector', '3D', 'ink', 'pixel', 'neon', 'metal', 'sticker'];
  const BGS = ['plain', 'glow', 'sky', 'burst', 'embers', 'pixel hills', 'grid', 'paper'];
  const DECOS = ['clean', 'dots', 'stripes', 'sparkles', 'grid', 'waves', 'pixels', 'rays'];
  const SURFS = ['solid', 'glass', 'outline', 'gradient', 'framed', 'candy', 'bevel', 'bold'];
  /* Tags draw the hub (Daria, 27.09): each style tag brings its traits — the art technique, the ground, the headline
     font, the cards, the buttons, the corners, the headline's effect, the banner's art and the palettes it suits.
     Several tags mix: the traits are dealt out between them (see dealt below) — so every tag on the list shows,
     and Dark + Pixel art reads as pixel sprites in dark frames. The dice doesn't touch any of it. */
  const BTNS = ['clean', 'bold', 'candy', 'gothic', 'block', 'neon', 'ink'];
  const HFX = [() => '', () => 'text-shadow:0 5px 0 rgba(0,0,0,.3)', (c) => `text-shadow:0 3px 0 ${hexA(c.primary, .3)}`, (c) => `text-shadow:0 0 22px ${hexA(c.primary, .45)}`,
    () => 'text-shadow:3px 3px 0 rgba(0,0,0,.3)', (c) => `text-shadow:0 0 14px ${hexA(c.primary, .75)}`];   // none, lifted, candy, ember glow, hard pixel, neon
  const HERO_ART = [['cut-diamond', 'gems', 'two-coins'], ['trophy', 'star-medal', 'two-coins'], ['present', 'heart-bottle', 'two-coins'], ['dragon-head', 'crown', 'broadsword'],
    ['locked-chest', 'cut-diamond', 'broadsword'], ['power-lightning', 'crystal-cluster', 'two-coins'], ['castle', 'potion-ball', 'scroll-unfurled'], ['checked-shield', 'broadsword', 'crested-helmet']];
  //                  art (ARTS) bg (BGS) font surf (SURFS) btn (BTNS) rad hfx heroArt deco  palettes
  const TAG_TRAITS = {
    'Pixel art':     { art: 3, bg: 5, font: 5,  surf: 6, btn: 4, rad: 0,  hfx: 4, heroArt: 4, deco: 0, pals: [16, 0, 17] },
    'Retro arcade':  { art: 3, bg: 6, font: 12, surf: 6, btn: 4, rad: 0,  hfx: 5, heroArt: 4, deco: 6, pals: [0, 4, 11] },
    'Fantasy':       { art: 1, bg: 1, font: 3,  surf: 3, btn: 0, rad: 12, hfx: 3, heroArt: 3, deco: 3, pals: [0, 1, 3] },
    'Bold and loud': { art: 1, bg: 3, font: 9,  surf: 7, btn: 1, rad: 14, hfx: 1, heroArt: 1, deco: 0, pals: [10, 11] },
    'Hand-drawn':    { art: 2, bg: 7, font: 13, surf: 2, btn: 6, rad: 12, hfx: 0, heroArt: 6, deco: 5, pals: [7, 2] },
    'Cartoon':       { art: 6, bg: 2, font: 10, surf: 5, btn: 2, rad: 20, hfx: 2, heroArt: 2, deco: 1, pals: [12, 6, 10] },
    'Anime':         { art: 6, bg: 1, font: 6,  surf: 5, btn: 2, rad: 18, hfx: 2, heroArt: 2, deco: 3, pals: [6, 4, 12] },
    'Dark':          { art: 5, bg: 4, font: 11, surf: 4, btn: 3, rad: 2,  hfx: 3, heroArt: 3, deco: 0, pals: [14, 8, 5] },
    'Neon':          { art: 4, bg: 6, font: 4,  surf: 1, btn: 5, rad: 10, hfx: 5, heroArt: 5, deco: 0, pals: [4, 3] },
    'Medieval':      { art: 5, bg: 4, font: 3,  surf: 4, btn: 3, rad: 2,  hfx: 3, heroArt: 3, deco: 0, pals: [15, 5, 2] },
    'Cozy':          { art: 6, bg: 1, font: 6,  surf: 5, btn: 2, rad: 18, hfx: 2, heroArt: 6, deco: 1, pals: [2, 7, 13] },
    'Minimal':       { art: 0, bg: 0, font: 2,  surf: 0, btn: 0, rad: 10, hfx: 0, heroArt: 0, deco: 0, pals: [9, 0] },
    'Low poly':      { art: 0, bg: 1, font: 0,  surf: 3, btn: 0, rad: 6,  hfx: 0, heroArt: 0, deco: 4, pals: [1, 3, 9] },
    'Premium gold':  { art: 5, bg: 1, font: 3,  surf: 4, btn: 3, rad: 4,  hfx: 3, heroArt: 3, deco: 3, pals: [5, 15, 0] },
    '3D render':     { art: 1, bg: 1, font: 0,  surf: 1, btn: 0, rad: 16, hfx: 0, heroArt: 0, deco: 0, pals: [3, 9, 10] },
    'Cel-shaded':    { art: 6, bg: 3, font: 1,  surf: 7, btn: 1, rad: 12, hfx: 1, heroArt: 1, deco: 0, pals: [11, 10, 6] },
    'Sci-fi':        { art: 4, bg: 6, font: 4,  surf: 1, btn: 5, rad: 8,  hfx: 5, heroArt: 5, deco: 0, pals: [3, 4] },
    'Cyberpunk':     { art: 4, bg: 6, font: 4,  surf: 2, btn: 5, rad: 4,  hfx: 5, heroArt: 5, deco: 2, pals: [4, 11] },
    'Military':      { art: 0, bg: 0, font: 7,  surf: 4, btn: 0, rad: 4,  hfx: 1, heroArt: 7, deco: 2, pals: [5, 1, 16] },
    'Space':         { art: 1, bg: 1, font: 0,  surf: 1, btn: 5, rad: 12, hfx: 5, heroArt: 5, deco: 3, pals: [3, 10] },
    'Horror':        { art: 2, bg: 4, font: 11, surf: 4, btn: 3, rad: 2,  hfx: 3, heroArt: 3, deco: 0, pals: [8, 14] },
    'Steampunk':     { art: 5, bg: 7, font: 3,  surf: 4, btn: 3, rad: 6,  hfx: 0, heroArt: 6, deco: 0, pals: [2, 15] },
    'Pastel':        { art: 6, bg: 2, font: 10, surf: 5, btn: 2, rad: 22, hfx: 2, heroArt: 2, deco: 0, pals: [12, 13, 6] }
  };
  const typeCss = (t) => `font-family:${t.css};font-weight:${t.w};${t.up ? 'text-transform:uppercase;' : ''}letter-spacing:${t.ls || 'normal'}`;
  /* ---- drawing the look ---- */
  const hexA = (h, a) => { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  const shade = (h, k = .35) => `color-mix(in srgb, ${h} ${Math.round((1 - k) * 100)}%, #000)`;
  const tint = (h, k = .35) => `color-mix(in srgb, ${h} ${Math.round((1 - k) * 100)}%, #FFF)`;
  const svgUrl = (s) => `url('data:image/svg+xml,${encodeURIComponent(s).replace(/'/g, '%27')}')`;   // single quotes: it goes inside style="…"
  /* a small pattern over a ground: dots, stripes, sparkles, a tech grid, waves, pixels, rays — or nothing */
  function decoBg(deco, color, a, scale = 1) {
    const x = hexA(color, a), u = (n) => Math.round(n * scale);
    switch (deco) {
      case 1: return `radial-gradient(${x} ${1.6 * scale}px, transparent ${2 * scale}px) 0 0 / ${u(20)}px ${u(20)}px`;
      case 2: return `repeating-linear-gradient(135deg, ${x} 0 ${u(2)}px, transparent ${u(2)}px ${u(16)}px)`;
      case 3: return `${svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><g fill='${color}' fill-opacity='${a * 1.6}'>${[[22, 26, 8], [98, 40, 5], [62, 98, 10], [120, 114, 5], [30, 118, 4], [78, 14, 3]].map(([cx, cy, r]) => `<path d='M${cx} ${cy - r}Q${cx} ${cy} ${cx + r} ${cy}Q${cx} ${cy} ${cx} ${cy + r}Q${cx} ${cy} ${cx - r} ${cy}Q${cx} ${cy} ${cx} ${cy - r}Z'/>`).join('')}</g></svg>`)} 0 0 / ${u(140)}px ${u(140)}px`;
      case 4: return `linear-gradient(${x} 1px, transparent 1px) 0 0 / ${u(32)}px ${u(32)}px, linear-gradient(90deg, ${x} 1px, transparent 1px) 0 0 / ${u(32)}px ${u(32)}px`;
      case 5: return `${svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='160' height='44'><g fill='none' stroke='${color}' stroke-opacity='${a * 1.5}' stroke-width='1.6'><path d='M0 12 Q20 2 40 12 T80 12 T120 12 T160 12'/><path d='M0 34 Q20 24 40 34 T80 34 T120 34 T160 34'/></g></svg>`)} 0 0 / ${u(160)}px ${u(44)}px`;
      case 6: return `${svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'><g fill='${color}' fill-opacity='${a * 1.6}'>${[[8, 8], [40, 16], [72, 8], [24, 40], [64, 48], [8, 72], [48, 80], [80, 72], [16, 56]].map(([px, py], i) => `<rect x='${px}' y='${py}' width='${i % 3 ? 6 : 10}' height='${i % 3 ? 6 : 10}'/>`).join('')}</g></svg>`)} 0 0 / ${u(96)}px ${u(96)}px`;
      case 7: return `repeating-conic-gradient(from 0deg at 82% 45%, ${x} 0deg 5deg, transparent 5deg 17deg)`;
      default: return '';
    }
  }
  const withDeco = (sk, color, a, base, scale) => { const d = decoBg(sk.deco, color, a, scale); return d ? `${d}, ${base}` : base; };
  const GRAIN = (o) => `${svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0'/></filter><rect width='220' height='220' filter='url(#n)' opacity='${o}'/></svg>`)} 0 0 / 220px 220px`;
  const CLOUDS = (op) => svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='900' height='260' viewBox='0 0 900 260'><g fill='#FFFFFF' fill-opacity='${op}'><g transform='translate(90 70)'><ellipse cx='60' cy='40' rx='60' ry='30'/><ellipse cx='110' cy='26' rx='48' ry='36'/><ellipse cx='160' cy='44' rx='56' ry='26'/></g><g transform='translate(560 30) scale(.8)'><ellipse cx='60' cy='40' rx='60' ry='30'/><ellipse cx='110' cy='26' rx='48' ry='36'/><ellipse cx='160' cy='44' rx='56' ry='26'/></g><g transform='translate(360 170) scale(.6)'><ellipse cx='60' cy='40' rx='60' ry='30'/><ellipse cx='110' cy='26' rx='48' ry='36'/><ellipse cx='160' cy='44' rx='56' ry='26'/></g></g></svg>`);
  /* blocky hills across the whole width: grass on top of dirt, the way a block world's horizon looks */
  const HILL_STEPS = [[14, 22], [12, 18], [10, 24], [16, 16], [12, 20], [14, 14], [10, 22], [16, 18], [12, 24], [14, 12], [10, 18], [20, 21]];
  const HILLS = (grass, dirt) => svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 40' preserveAspectRatio='none' shape-rendering='crispEdges'>${(() => {
    let x = 0; return HILL_STEPS.map(([w, y]) => { const r = `<rect x='${x}' y='${y}' width='${w}' height='${40 - y}' fill='${dirt}'/><rect x='${x}' y='${y}' width='${w}' height='4' fill='${grass}'/>`; x += w; return r; }).join('');
  })()}</svg>`);
  /* the ground: behind the whole page quietly, behind the banner at full strength */
  function bgCss(sk, strong) {
    const { c } = sk, k = strong ? 1 : .45;
    const deco = decoBg(sk.deco, c.fg, (c.light ? .05 : .04) * (strong ? 1.6 : 1), strong ? 1.5 : 1);
    const on = (base) => (deco ? `${deco}, ${base}` : base);
    switch (sk.bg) {
      case 1: return on(`radial-gradient(circle at 78% 30%, ${hexA(c.accent, .45 * k)}, transparent 55%), radial-gradient(circle at 8% 100%, ${hexA(c.primary, .3 * k)}, transparent 50%), ${strong ? `linear-gradient(120deg, ${c.surface}, ${c.bg})` : c.bg}`);
      case 2: return c.light   // a day sky for a light palette, a night sky for a dark one — the text keeps its contrast
        ? on(`${strong ? `${CLOUDS(.85)} center / cover no-repeat, ` : `${CLOUDS(.5)} top center / 1400px auto no-repeat, `}linear-gradient(180deg, ${tint(c.bg, strong ? .1 : 0)}, ${strong ? tint(c.accent, .75) : c.bg})`)
        : on(`${strong ? `${CLOUDS(.16)} center / cover no-repeat, ` : `${CLOUDS(.06)} top center / 1400px auto no-repeat, `}linear-gradient(180deg, ${c.bg}, ${strong ? `color-mix(in srgb, ${c.accent} 35%, ${c.bg})` : c.bg})`);
      case 3: return on(`radial-gradient(circle at 70% 45%, ${hexA('#FFFFFF', .28 * k)}, transparent 45%), repeating-conic-gradient(from 0deg at 70% 45%, ${hexA('#FFFFFF', (strong ? .09 : .025))} 0deg 7deg, transparent 7deg 18deg), linear-gradient(160deg, ${strong ? c.accent : c.surface}, ${c.bg} ${strong ? 70 : 60}%)`);
      case 4: return on(`${GRAIN(strong ? .22 : .14)}, radial-gradient(ellipse at 50% 115%, ${hexA(c.primary, .55 * k)}, transparent 60%), radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,${.7 * k}) 100%), ${c.bg}`);
      case 5: return on(`${strong ? `${HILLS(c.primary, c.accent)} bottom / 100% 34% no-repeat, linear-gradient(180deg, #3F8FD2, #8CCBF2)` : c.bg}`);
      case 6: return on(`linear-gradient(${hexA(c.primary, .14 * k)} 1px, transparent 1px) 0 0 / 40px 40px, linear-gradient(90deg, ${hexA(c.primary, .14 * k)} 1px, transparent 1px) 0 0 / 40px 40px, radial-gradient(ellipse at 50% 100%, ${hexA(c.accent, .35 * k)}, transparent 60%), ${c.bg}`);
      case 7: return on(`${GRAIN(c.light ? .07 : .12)}, ${strong ? tint(c.bg, .2) : c.bg}`);
      default: return on(strong ? c.surface : c.bg);
    }
  }
  /* a card's surface — the world decides: solid, glass, a line, a gradient, a dark frame, candy, a block bevel, bold */
  function surf(sk, rad) {
    const { c } = sk, r = `border-radius:${rad}px;`;
    switch (sk.surf) {
      case 1: return `${r}background:${hexA(c.fg, c.light ? .04 : .07)};box-shadow:inset 0 0 0 1px ${hexA(c.fg, .13)}`;
      case 2: return `${r}background:transparent;box-shadow:inset 0 0 0 1.5px ${hexA(c.primary, .5)}`;
      case 3: return `${r}background:linear-gradient(165deg, ${hexA(c.accent, c.light ? .16 : .26)}, ${c.surface} 62%)`;
      case 4: return `${r}background:linear-gradient(180deg, ${c.surface}, ${shade(c.surface, .35)});box-shadow:inset 0 0 0 1px ${hexA(c.accent, .45)}, inset 0 0 26px rgba(0,0,0,.55)`;
      case 5: return `${r}background:${c.surface};box-shadow:0 5px 0 ${hexA(c.primary, .16)}, 0 12px 26px -10px ${hexA(c.fg, .22)}`;
      case 6: return `border-radius:0;background:${c.surface};box-shadow:inset 3px 3px 0 rgba(255,255,255,.14), inset -3px -3px 0 rgba(0,0,0,.35), 0 0 0 2px rgba(0,0,0,.45)`;
      case 7: return `${r}background:linear-gradient(160deg, ${hexA(c.accent, .4)}, ${c.surface} 58%);box-shadow:inset 0 0 0 2px rgba(255,255,255,.16), 0 7px 0 rgba(0,0,0,.25)`;
      default: return `${r}background:${c.surface}${c.light ? `;box-shadow:0 1px 2px ${hexA(c.fg, .06)}, 0 0 0 1px ${hexA(c.fg, .07)}` : ''}`;
    }
  }
  /* a button in the world's manner; line: the outlined one (a card style) */
  function hbtn(sk, label, rad, extra = '', line) {
    const { c, w } = sk, br = Math.max(0, rad - 4), f = typeCss(sk.t);
    if (line) return `<span class="hbtn${extra}" style="background:transparent;color:${c.primary};box-shadow:inset 0 0 0 2px ${c.primary};border-radius:${br}px">${label}</span>`;
    const st = {
      bold: `background:${c.primary};color:${c.on};border-radius:10px;box-shadow:0 5px 0 ${shade(c.primary, .4)};${f};font-size:1.05em`,
      candy: `background:linear-gradient(180deg, ${tint(c.primary, .25)}, ${c.primary});color:${c.on};border-radius:999px;box-shadow:inset 0 2px 0 rgba(255,255,255,.45), 0 4px 0 ${shade(c.primary, .3)};${f}`,
      gothic: `background:linear-gradient(180deg, ${c.primary}, ${shade(c.primary, .45)});color:#FFFFFF;border-radius:2px;box-shadow:inset 0 0 0 1px ${hexA(c.accent, .8)}, 0 0 22px -6px ${hexA(c.primary, .9)};text-transform:uppercase;letter-spacing:.12em`,
      block: `background:${c.primary};color:${c.on};border-radius:0;box-shadow:inset 0 3px 0 rgba(255,255,255,.3), inset 0 -4px 0 ${shade(c.primary, .35)}, 0 0 0 2px rgba(0,0,0,.55);${f}`,
      neon: `background:${hexA(c.primary, .08)};color:${c.primary};border-radius:8px;box-shadow:inset 0 0 0 2px ${c.primary}, 0 0 18px ${hexA(c.primary, .55)};text-transform:uppercase;letter-spacing:.08em`,
      ink: `background:${c.primary};color:${c.on};border-radius:12px 9px 14px 8px;box-shadow:3px 3px 0 ${c.fg}`,
      clean: `background:${c.primary};color:${c.on};border-radius:${br}px`
    }[w.btn] || '';
    return `<span class="hbtn${extra}" style="${st}">${label}</span>`;
  }
  /* ---- icons: game-icons.net silhouettes (app/hub-icons.js), drawn in the world's technique ----
     one shape, seven ways: flat vector, 3D (lit gradient + bevel), ink (hatched, wobbly outline), pixel (sampled
     into blocks), neon (glowing outline), metal (bronze, dark edge), sticker (white outline, lifted) */
  const ICONS = AG.HUB_ICONS || {};
  const KIND = { Gems: 'gem', Heroes: 'hero', Chests: 'chest', Energy: 'energy' };
  const KIND_ICON = { gem: ['cut-diamond', 'gems'], hero: ['visored-helm', 'crested-helmet'], chest: ['locked-chest', 'chest'], energy: ['power-lightning', 'potion-ball'] };
  /* things keep the colours players know (a diamond is blue, gold is gold, steel is grey); "one colour" paints them all in the world's */
  const GOLD = '#F5B83D', STEEL = '#B9C4D4';
  const KIND_COL = { gem: '#45D4F0', gems: '#45D4F0', 'cut-diamond': '#45D4F0', 'crystal-cluster': '#B38CFF', hero: STEEL, 'visored-helm': STEEL, 'crested-helmet': STEEL, broadsword: STEEL,
    chest: GOLD, 'locked-chest': GOLD, crown: GOLD, trophy: GOLD, 'two-coins': GOLD, 'star-medal': GOLD, energy: '#3DD68C', 'power-lightning': '#FFD23F', 'potion-ball': '#9B7BFF',
    'heart-bottle': '#FF5C7A', present: 'primary', 'dragon-head': 'primary', castle: 'accent', 'scroll-unfurled': '#E8D3A2', 'checked-shield': STEEL };
  /* the filters are the same for every colour: one set in the page */
  document.body.insertAdjacentHTML('beforeend', `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <filter id="hf-3d" x="-20%" y="-20%" width="140%" height="150%"><feGaussianBlur in="SourceAlpha" stdDeviation="12" result="b"/>
      <feSpecularLighting in="b" surfaceScale="7" specularConstant="1" specularExponent="18" lighting-color="#FFFFFF" result="s"><fePointLight x="140" y="-60" z="300"/></feSpecularLighting>
      <feComposite in="s" in2="SourceAlpha" operator="in" result="sp"/><feComposite in="SourceGraphic" in2="sp" operator="arithmetic" k2="1" k3=".75" result="lit"/>
      <feDropShadow in="lit" dx="0" dy="16" stdDeviation="12" flood-color="#000" flood-opacity=".35"/></filter>
    <filter id="hf-metal" x="-20%" y="-20%" width="140%" height="150%"><feGaussianBlur in="SourceAlpha" stdDeviation="6" result="b"/>
      <feSpecularLighting in="b" surfaceScale="4" specularConstant=".8" specularExponent="30" lighting-color="#FFE8C0" result="s"><fePointLight x="100" y="-100" z="240"/></feSpecularLighting>
      <feComposite in="s" in2="SourceAlpha" operator="in" result="sp"/><feComposite in="SourceGraphic" in2="sp" operator="arithmetic" k2="1" k3=".6" result="lit"/>
      <feDropShadow in="lit" dx="0" dy="8" stdDeviation="8" flood-color="#000" flood-opacity=".7"/></filter>
    <filter id="hf-ink" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".03" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="10"/></filter>
  </defs></svg>`);
  let artSeq = 0;
  const PIX = {}, pixCtx = document.createElement('canvas').getContext('2d');
  function pixGrid(name) {
    if (PIX[name]) return PIX[name];
    const path = new Path2D(ICONS[name] || ICONS['cut-diamond']), N = 18, st = 512 / N;
    PIX[name] = Array.from({ length: N }, (_, y) => Array.from({ length: N }, (_, x) => {
      let hit = 0;   // a cell is filled when most of its four sample points are inside the shape
      [[.3, .3], [.7, .3], [.3, .7], [.7, .7]].forEach(([a, b]) => { if (pixCtx.isPointInPath(path, (x + a) * st, (y + b) * st)) hit++; });
      return hit >= 2;
    }));
    return PIX[name];
  }
  function artSvg(kind, sk, cls = '') {
    const { c } = sk, name = (KIND_ICON[kind] || [kind])[KIND_ICON[kind] ? sk.set : 0], d = ICONS[name] || ICONS['cut-diamond'];
    const ck = KIND_COL[name] || KIND_COL[kind] || 'primary';
    const k = sk.mono ? c.primary : ck === 'accent' ? c.accent : ck === 'primary' ? c.primary : ck;
    const id = `hi${++artSeq}`, box = `class="${cls}" viewBox="0 0 512 512" aria-hidden="true"`;
    switch (sk.art) {
      case 1: return `<svg ${box}><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${tint(k, .45)}"/><stop offset=".55" stop-color="${k}"/><stop offset="1" stop-color="${shade(k, .35)}"/></linearGradient></defs><path d="${d}" fill="url(#${id})" filter="url(#hf-3d)"/></svg>`;
      case 2: return `<svg ${box}><defs><pattern id="${id}" patternUnits="userSpaceOnUse" width="26" height="26" patternTransform="rotate(38)"><rect width="26" height="26" fill="${k}"/><rect width="7" height="26" fill="${c.light ? c.fg : '#000'}" fill-opacity=".22"/></pattern></defs>
        <g filter="url(#hf-ink)"><path d="${d}" fill="url(#${id})" stroke="${c.light ? c.fg : '#1A1410'}" stroke-width="9" stroke-linejoin="round"/></g></svg>`;
      case 3: {
        /* pixel: the silhouette sampled into an 18×18 grid, lit from the top, a dark edge round it — an item sprite */
        const g = pixGrid(name), N = g.length, on = (x, y) => y >= 0 && y < N && x >= 0 && x < N && g[y][x];
        let px = '';
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
          if (on(x, y)) px += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${y < N * .35 ? tint(k, .3) : y > N * .7 ? shade(k, .25) : k}"/>`;
          else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) px += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="#000" fill-opacity=".55"/>`;
        }
        return `<svg class="${cls}" viewBox="-.5 -.5 ${N + 1} ${N + 1}" shape-rendering="crispEdges" aria-hidden="true">${px}</svg>`;
      }
      case 4: return `<svg ${box} style="filter:drop-shadow(0 0 6px ${hexA(k === c.primary ? c.primary : k, .9)}) drop-shadow(0 0 18px ${hexA(k === c.primary ? c.primary : k, .6)})"><path d="${d}" fill="none" stroke="${k}" stroke-width="10" stroke-linejoin="round"/></svg>`;
      case 5: return `<svg ${box} style="filter:drop-shadow(0 0 14px ${hexA(c.primary, .55)})"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F3D9A0"/><stop offset=".45" stop-color="${c.accent}"/><stop offset="1" stop-color="#4A2E14"/></linearGradient></defs><path d="${d}" fill="url(#${id})" stroke="#140A06" stroke-width="6" filter="url(#hf-metal)"/></svg>`;
      case 6: return `<svg ${box} style="filter:drop-shadow(0 0 0 #FFF) drop-shadow(5px 0 0 #FFF) drop-shadow(-5px 0 0 #FFF) drop-shadow(0 5px 0 #FFF) drop-shadow(0 -5px 0 #FFF) drop-shadow(0 8px 6px ${hexA(c.fg, .25)})"><path d="${d}" fill="${k}"/></svg>`;
      default: return `<svg ${box}><path d="${d}" fill="${k}"/></svg>`;
    }
  }
  const rewardKind = (r) => (/gem/i.test(r) ? 'gems' : /energy/i.test(r) ? 'energy' : /legend/i.test(r) ? 'crown' : 'hero');

  /* ---- the look from the style tags (Hub → Styles, onboarding) ----
     the traits are dealt out between the tags, the most visible first: the art to the tag picked last, the palette to
     the one before it, the ground to the last again… One tag: all of its traits. */
  const tagTraitsOf = (tags) => (tags || []).map((t) => TAG_TRAITS[t]).filter(Boolean);
  const DEAL = ['art', 'pal', 'bg', 'font', 'surf', 'btn', 'heroArt', 'hfx', 'rad', 'deco'];
  function dealt(tags) {
    const tr = tagTraitsOf(tags).reverse(), out = {};   // the latest first
    if (!tr.length) return out;
    DEAL.forEach((k, i) => { const t = tr[i % tr.length]; out[k] = k === 'pal' ? t.pals[0] : t[k]; });
    /* "Dark" means dark (Daria, 28.09: picking it could hand the palette to another tag and turn the hub light) */
    if ((tags || []).includes('Dark') && PALETTES[out.pal] && PALETTES[out.pal].light) out.pal = TAG_TRAITS.Dark.pals[0];
    return out;
  }
  /* the palettes the tags suit, the most asked for first — the dice picks among them */
  function tagPals(tags) {
    const n = new Map();
    tagTraitsOf(tags).forEach((tr, i) => tr.pals.forEach((p, j) => { const x = n.get(p) || { v: 0, last: -1 }; n.set(p, { v: x.v + 3 - j, last: i }); }));
    return [...n.entries()].sort((a, b) => b[1].v - a[1].v || b[1].last - a[1].last).map(([p]) => p);
  }
  /* a look (the saved one's fields) → what drawing needs */
  function skinFrom(L) {
    const w = { rad: L.rad, btn: BTNS[(L.btn || 0) % BTNS.length], head: HFX[(L.hfx || 0) % HFX.length], hero: HERO_ART[(L.heroArt || 0) % HERO_ART.length] };
    return { w, c: PALETTES[(L.pal || 0) % PALETTES.length], t: FONTS[(L.font || 0) % FONTS.length], art: (L.art || 0) % ARTS.length, bg: (L.bg || 0) % BGS.length,
      deco: (L.deco || 0) % DECOS.length, surf: (L.surf || 0) % SURFS.length, mono: (L.mono || 0) % 2, set: (L.set || 0) % 2 };
  }
  /* the hub's look right now: as saved in Hub, or — before Hub was ever opened — drawn from the style tags */
  function current() {
    const saved = AG.state.hub && AG.state.hub.look;
    return skinFrom(saved && saved.btn != null ? saved : Object.assign({ mono: 0, set: 0 }, dealt(AG.style().tags)));
  }
  /* a seasonal look inside the hub's style (the Halloween event): the same art, ground, type, cards and buttons,
     in the season's colours */
  const SEASON = { halloween: { name: 'Halloween', primary: '#FF8A2A', accent: '#9B5CFF', bg: '#170C1C', surface: '#2A1432', fg: '#FFFFFF', on: '#1A0E05' } };
  const seasonal = (sk, key = 'halloween') => Object.assign({}, sk, { c: SEASON[key] });
  /* which icon draws a thing: by its name first (a chest, a hoard, a bag…), then by what's inside */
  function iconFor(name, contents) {
    const n = name || '', c = contents || '';
    if (/chest/i.test(n)) return 'locked-chest';
    if (/hoard|vault|crown|legend/i.test(n)) return 'crown';
    if (/bag|gift|candy|treat|present/i.test(n)) return 'present';
    if (/kit|raider|hunter|sword/i.test(n)) return 'broadsword';
    if (/shield|guard/i.test(n)) return 'checked-shield';
    if (/potion|elixir/i.test(n)) return 'potion-ball';
    if (/energy|refill|power|booster|xp/i.test(n)) return 'power-lightning';
    if (/shard|hero/i.test(n)) return 'crested-helmet';
    if (/gem|stash|diamond/i.test(n)) return 'gems';
    return /legendary/i.test(c) ? 'crown' : /shard|hero/i.test(c) ? 'crested-helmet' : /energy|xp/i.test(c) ? 'power-lightning' : /chest/i.test(c) ? 'locked-chest' : 'gems';
  }
  /* a thing's picture in a dashboard table: the hub's icon on the hub's card colour */
  const thumb = (name, contents) => { const sk = current(); return `<span class="thumb" style="background:${sk.c.surface}">${artSvg(iconFor(name, contents), sk)}</span>`; };
  const fontCss = (sk) => { const h = sk.w.head(sk.c); return `${typeCss(sk.t)}${h ? ';' + h : ''}`; };
  return { PALETTES, FONTS, ARTS, BGS, DECOS, SURFS, BTNS, HFX, HERO_ART, TAG_TRAITS, DEAL, typeCss, fontCss, hexA, shade, tint, svgUrl, decoBg, withDeco,
    bgCss, surf, hbtn, KIND, KIND_ICON, KIND_COL, artSvg, rewardKind, iconFor, thumb, dealt, tagPals, skinFrom, current, seasonal, SEASON };
})();

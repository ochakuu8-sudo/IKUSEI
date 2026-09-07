// Clean, editable stationery drawn to the heroine's ink / lace / rose palette.
// Run with `node scripts/draw-stationery.mjs`; no raster textures or fonts.
import { mkdir, writeFile } from 'node:fs/promises';
const out = new URL('../public/art/ui/portrait/', import.meta.url);
await mkdir(out, { recursive: true });
const ink = '#39333e', edge = '#241f2b', gold = '#c3ae89';
const defs = `<defs>
  <linearGradient id="cover" x2="0" y2="1"><stop stop-color="#453b46"/><stop offset="1" stop-color="#36323d"/></linearGradient>
  <linearGradient id="paper" x2="0.7" y2="1"><stop stop-color="#fff8ed"/><stop offset="1" stop-color="#f4e9d9"/></linearGradient>
  <linearGradient id="gutter"><stop stop-color="#b8a597" stop-opacity="0"/><stop offset=".5" stop-color="#a59485" stop-opacity=".4"/><stop offset="1" stop-color="#b8a597" stop-opacity="0"/></linearGradient>
</defs>`;
const rose = (x, y, size, color = gold) => `<g transform="translate(${x} ${y}) scale(${size / 64})" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M32 14c5-4 10 0 10 5 7-1 10 5 6 10 6 5 3 12-4 13-1 7-9 9-13 4-6 4-12 0-12-6-7-2-8-10-2-14-3-6 2-12 8-10 1-4 5-5 7-2Z"/><path d="M32 22c8-2 14 6 10 12-2 6-10 9-15 4-6-2-7-11-1-14 5-3 12 1 10 6-1 5-7 5-9 1m4 10-1 10m-1-4c-5 0-8-3-8-6 5 0 8 2 8 6m2-1c5-1 8-4 8-7-5 1-7 3-8 7"/></g>`;
const save = async (name, w, h, body) => writeFile(new URL(`${name}.svg`, out), `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" fill="none">${defs}${body}</svg>\n`);

// Narrow shaped bindings; the extra silhouette is intentional, never a bevel.
await save('header', 850, 92, `
 <path d="M23 5H827Q836 5 836 15Q848 27 848 46Q848 65 836 77Q836 87 827 87H23Q14 87 14 77Q2 65 2 46Q2 27 14 15Q14 5 23 5Z" fill="${edge}"/>
 <path d="M24 3H826Q835 3 835 13Q847 25 847 44Q847 63 835 75Q835 85 826 85H24Q15 85 15 75Q3 63 3 44Q3 25 15 13Q15 3 24 3Z" fill="url(#cover)" stroke="${gold}" stroke-width="1.5"/>
 <path d="M25 8H825Q830 8 830 17Q841 29 841 44Q841 59 830 71Q830 80 825 80H25Q20 80 20 71Q9 59 9 44Q9 29 20 17Q20 8 25 8Z" stroke="#766673" stroke-width=".65"/>
 <path d="M34 10H816" stroke="#dbc3a3" stroke-opacity=".18"/>`);
await save('button', 240, 52, `
 <path d="M24 4H216Q224 4 227 16L238 27L227 38Q224 50 216 50H24Q16 50 13 38L2 27L13 16Q16 4 24 4Z" fill="${edge}"/>
 <path d="M24 2H216Q224 2 227 14L238 25L227 36Q224 48 216 48H24Q16 48 13 36L2 25L13 14Q16 2 24 2Z" fill="url(#cover)" stroke="${gold}" stroke-width="1.4"/>
 <path d="M26 6H214Q220 6 223 16L232 25L223 34Q220 44 214 44H26Q20 44 17 34L8 25L17 16Q20 6 26 6Z" stroke="#8c7583" stroke-width=".7"/>`);
await save('writing-mat', 864, 334, `
 <rect x="2" y="4" width="860" height="328" rx="15" fill="${edge}"/>
 <rect x="2" y="1" width="860" height="328" rx="15" fill="url(#cover)" stroke="#24202a" stroke-width="1.5"/>
 <path d="M27 8H837Q837 16 852 16V314Q838 314 837 322H27Q26 314 12 314V16Q27 16 27 8Z" stroke="${gold}" stroke-width=".8"/>
 <path d="M30 11H833M15 21V307" stroke="#ead6b7" stroke-opacity=".15"/>
 ${[20, 844].map(x=>`<circle cx="${x}" cy="16" r="2" fill="${ink}" stroke="${gold}" stroke-width=".8"/>`).join('')}`);
await save('status-notebook', 326, 184, `
 <rect x="14" y="8" width="308" height="174" rx="10" fill="#28232e"/>
 <path d="M21 9H317V172Q317 178 311 178H21Z" fill="#d4c5ae" stroke="#796c62"/>
 <rect x="12" y="2" width="309" height="173" rx="9" fill="url(#cover)" stroke="${edge}" stroke-width="2"/>
 <rect x="16" y="5" width="301" height="166" rx="6" stroke="${gold}" stroke-width="1.1"/>
 <path d="M23 9H311M20 11V165" stroke="#d5c1a1" stroke-opacity=".18"/>
 ${[24, 47, 70, 93, 116, 139, 162].map(y=>`<circle cx="21" cy="${y}" r="3.1" fill="${edge}" stroke="#8b7662" stroke-width=".65"/><path d="M21 ${y-2}H7C0 ${y-2} 0 ${y+3} 7 ${y+3}H18" stroke="#29232a" stroke-width="3.6" stroke-linecap="round"/><path d="M21 ${y-2}H7C0 ${y-2} 0 ${y+3} 7 ${y+3}H18" stroke="${gold}" stroke-width="1.7" stroke-linecap="round"/>`).join('')}`);
await save('letter', 258, 282, `
 <path d="M8 6H249Q254 6 254 12V273Q254 279 248 279H8Q3 279 3 273V12Q3 6 8 6Z" fill="#d0beaa" stroke="#66554f" stroke-width=".75"/>
 <path d="M8 2H247Q252 2 252 8V247L229 275H8Q3 275 3 269V8Q3 2 8 2Z" fill="url(#paper)" stroke="#61514c" stroke-width=".8"/>
 <path d="M8 4H246M5 10V268" stroke="#fffdf7" stroke-width="1.1"/>
 <path d="M130 3L251 109" stroke="#cab9a6" stroke-width=".45" opacity=".58"/>
 <path d="M4 154H251" stroke="#cfbfae" stroke-width=".65" opacity=".32"/>
 <path d="M227 275Q239 264 252 247L231 257Z" fill="#dfd0bd"/>
 <path d="M229 275Q234 265 231 254Q240 255 252 247" fill="#fffaf0" stroke="#ae9a86" stroke-width=".7"/>
 <path d="M231 260L239 265L229 272Z" fill="#a76e88"/>`);
await save('bookmark', 40, 58, `
 <path d="M3 3H37V56L20 48L3 56Z" fill="#342736" opacity=".2"/>
 <path d="M2 1H36V53L19 46L2 53Z" fill="#9b647a" stroke="#694655" stroke-width=".8"/>
 <path d="M5 3H33V48L19 42L5 48Z" stroke="#edc4c3" stroke-width=".7" opacity=".65"/>
 <path d="M5 2H33" stroke="#ffe9d4" stroke-opacity=".5"/>`);
await save('closed-book', 128, 84, `
 <path d="M14 9L119 17L110 81L4 72Z" fill="${edge}" stroke="#1f1b22" stroke-width="1.5"/>
 <path d="M16 12L122 20L113 75L7 67Z" fill="#e4d7c1" stroke="#7b665d" stroke-width="1"/>
 <path d="M10 64L113 72M11 61L114 69M13 58L115 66" stroke="#b7a391" stroke-width=".75"/>
 <path d="M14 3L120 11L110 68L4 60Z" fill="url(#cover)" stroke="${edge}" stroke-width="1.4"/>
 <path d="M20 7L113 14Q110 18 114 21L106 58Q101 57 103 64L11 57Q15 53 10 49L16 14Q22 15 20 7Z" stroke="${gold}" stroke-width="1"/>
 <path d="M16 7L8 57" stroke="#a39076" stroke-width="1.2"/>
 <path d="M29 64L39 65L37 79L33 75L27 78Z" fill="#9e6477" stroke="#573949" stroke-width=".6"/>
 ${rose(21, 21, 30)}`);
await save('open-book', 1100, 410, `
 <path d="M8 25Q253-3 550 18Q846-3 1092 25L1090 394Q825 378 550 403Q275 378 10 394Z" fill="${ink}" stroke="${edge}" stroke-width="2"/>
 <path d="M18 18Q258-5 550 17Q842-5 1082 18V385Q820 369 550 396Q280 369 18 385Z" fill="#dfcfb6" stroke="#b3a087" stroke-width="1.5"/>
 <path d="M25 13Q260-6 550 19Q840-6 1075 13V378Q820 359 550 389Q280 359 25 378Z" fill="#eee2cc" stroke="#c7b59c"/>
 <path d="M33 7Q287-10 550 21Q813-10 1067 7V368Q823 346 550 382Q277 346 33 368Z" fill="url(#paper)" stroke="#b8a590" stroke-width=".9"/>
 <path d="M34 10Q275-5 536 24M565 24Q825-5 1065 10" stroke="#fffdf7" stroke-width="1.3"/>
 <path d="M520 21H579V378L550 382L520 378Z" fill="url(#gutter)"/>
 <path d="M550 24V377" stroke="#9f8c79" stroke-opacity=".35" stroke-width=".75"/>
 <path d="M556 381L571 379L574 407L565 401L559 408Z" fill="#99647a" stroke="#694856" stroke-width=".7"/>
 ${rose(998, 313, 38, '#bea68a')}`);
await save('wax', 48, 48, `
 <path d="M22 3C27 0 32 5 36 6C42 7 42 15 45 20C48 26 43 30 41 35C40 41 33 42 28 45C22 47 18 43 13 42C7 41 7 35 3 30C0 25 4 20 5 15C6 9 13 8 16 5Z" fill="#793746" stroke="#502c3d" stroke-width="1"/>
 <path d="M22 5C27 2 32 7 36 8C40 9 40 16 43 21C44 26 40 29 39 34C38 38 32 40 27 43C22 44 18 40 13 40C9 39 9 33 5 29C3 24 7 21 7 16C8 11 14 10 17 7Z" fill="#b85b68"/>
 <circle cx="24" cy="24" r="15" fill="#a54758" stroke="#662d41" stroke-width="1.2"/>
 <path d="M11 21A13 13 0 0 1 35 17M8 14Q10 10 16 9" stroke="#ec9c9c" stroke-width="1.2" stroke-linecap="round"/>
 <path d="M15 35A14 14 0 0 0 38 22" stroke="#6b3041" stroke-width="1.1"/>`);
// Three folded sheets on the desk and one opened sheet share the same paper.
await save('folded-letter', 210, 180, `
 <path d="M4 6H206V177H4Z" fill="#cbb6a5" stroke="#706064" stroke-width=".8"/>
 <path d="M3 3H207V173H3Z" fill="url(#paper)" stroke="#8d7873" stroke-width=".8"/>
 <path d="M4 4L105 44L206 4" fill="#ede0d1" stroke="#b6a092" stroke-width=".8"/>
 <path d="M5 5L105 41L205 5" fill="#fff7ec"/>
 <path d="M4 171L29 149M206 171L181 149" stroke="#c8b6a7" stroke-width=".7"/>
 <path d="M5 175H205M6 7V169" stroke="#fffaf0" stroke-width=".8"/>
 ${rose(180, 147, 22, '#c2a1a6')}`);
await save('unfolded-letter', 600, 376, `
 <path d="M7 6L591 4L596 371L5 373Z" fill="#cfbaa8" stroke="#786467" stroke-width=".8"/>
 <path d="M4 3H594L597 368L3 370Z" fill="url(#paper)" stroke="#9e8880" stroke-width=".8"/>
 <path d="M6 6H592M6 8V366" stroke="#fffdf7"/>
 <path d="M5 128H594M5 252H595" stroke="#bea795" stroke-opacity=".35" stroke-width=".7"/>
 <path d="M5 130H594M5 254H595" stroke="#fffdf8" stroke-opacity=".9" stroke-width="1"/>
 ${rose(550, 13, 30, '#bea0a5')}`);
console.log('Drew 11 stationery assets.');

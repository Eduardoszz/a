/* Baía dos Corsários — tiro tático em terceira pessoa (three.js).
   Organização do arquivo:
   1. Configuração (armas, mapa)      4. Bomba e rodadas
   2. Mundo 3D e colisão              5. Jogador, câmera e bots
   3. Personagens e tiros             6. HUD e laço principal            */
(() => {
'use strict';
const T = THREE;
const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------- 1. Configuração
const BX = 56, BZ = 42;                 // metade do tamanho jogável da ilha
const ATK = 0, DEF = 1;
const TEAM = ['Piratas', 'Armada'], TCLS = ['ta', 'td'];
const WIN_ROUNDS = 8, FREEZE = 4, ROUND_TIME = 105, BOMB_TIME = 35, PLANT_T = 3, DEFUSE_T = 6, BUY_TIME = 24;

const WEAPONS = {
  pistol:  { name: 'Garrucha',  dmg: 28,  rate: .28,  mag: 12, reload: 1.5, spread: .012, auto: false, price: 0,    len: .35 },
  shotgun: { name: 'Bacamarte', dmg: 13,  rate: .9,   mag: 6,  reload: 2.3, spread: .065, auto: false, price: 1200, len: .7, pellets: 8 },
  smg:     { name: 'Tormenta',  dmg: 20,  rate: .085, mag: 30, reload: 2.0, spread: .024, auto: true,  price: 1500, len: .55 },
  rifle:   { name: 'Corsário',  dmg: 32,  rate: .1,   mag: 30, reload: 2.4, spread: .012, auto: true,  price: 2700, len: .8 },
  sniper:  { name: 'Luneta',    dmg: 120, rate: 1.4,  mag: 5,  reload: 3.0, spread: .001, auto: false, price: 4500, len: 1.05, scope: true },
};
const SHOP = ['shotgun', 'smg', 'rifle', 'sniper', 'armor'];
const ARMOR_PRICE = 650;

// Caixas sólidas do mapa: [x, z, largura(x), profundidade(z), altura, tipo]
const MAP = [
  // vila oeste
  [-22, -14, 14, 12, 7, 'house'], [-22, 14, 14, 12, 7, 'house'], [-24, -37, 12, 8, 6, 'house'], [-24, 37, 12, 8, 6, 'house'],
  [-22, 0, 3, 3, 2.2, 'well'],
  // fileira central
  [4, -30, 12, 14, 8, 'house'], [4, -8, 12, 12, 7, 'house'], [4, 10, 12, 10, 7, 'house'], [4, 31, 12, 14, 8, 'house'],
  // entre os pontos
  [30, 0, 12, 16, 7, 'house'],
  // ponto A (mercado)
  [26, -28, 2.2, 2.2, 2, 'crate'], [31, -23, 3, 2, 1.5, 'crate'], [23, -21, 2, 2, 1.4, 'crate'], [33, -31, 2, 2, 1.5, 'barrel'],
  // ponto B (forte): muros com três portões
  [16, 20, 1.5, 8, 4, 'wall'], [16, 34, 1.5, 8, 4, 'wall'], [22.5, 16, 14.5, 1.5, 4, 'wall'], [27, 38, 23.5, 1.5, 4, 'wall'],
  [38, 17.5, 1.5, 4.5, 4, 'wall'], [38, 32.5, 1.5, 12.5, 4, 'wall'],
  [27, 27, 2.4, 2.4, 2, 'crate'], [22, 33, 2, 3, 1.5, 'crate'], [33, 22, 2, 2, 1.4, 'barrel'],
  // cobertura espalhada
  [-36, -6, 2, 2, 1.6, 'crate'], [-38, 8, 3, 2, 1.6, 'crate'], [-10, -26, 2, 2, 1.5, 'barrel'], [-10, 26, 2, 2, 1.5, 'crate'],
  [-9, 2, 2, 2, 1.5, 'barrel'], [15, 1, 2, 2, 1.5, 'crate'], [16, -20, 2, 2, 1.5, 'crate'], [42, -12, 2, 2, 1.5, 'crate'],
  [42, 10, 2, 2, 1.5, 'barrel'], [-44, -20, 3, 3, 2, 'crate'], [-44, 22, 3, 3, 2, 'crate'], [14, -38, 2, 2, 1.5, 'barrel'],
  // palmeiras (só o tronco colide)
  [-48, -32, .8, .8, 6, 'palm'], [-46, 34, .8, .8, 6, 'palm'], [-34, -24, .8, .8, 6, 'palm'], [-8, -17, .8, .8, 6, 'palm'],
  [46, -34, .8, .8, 6, 'palm'], [47, 34, .8, .8, 6, 'palm'], [-8, 18, .8, .8, 6, 'palm'], [19, 9, .8, .8, 6, 'palm'],
  [48, 20, .8, .8, 6, 'palm'], [-34, 26, .8, .8, 6, 'palm'], [40, -24, .8, .8, 6, 'palm'], [-52, 12, .8, .8, 6, 'palm'],
];
const SITES = [
  { name: 'A', x: 28, z: -26, hx: 7, hz: 6, color: 0xff6a4d },
  { name: 'B', x: 27, z: 27, hx: 9, hz: 9, color: 0x5fb4ff },
];
const LANES = [[{ x: -12, z: -26 }, { x: -12, z: 0 }], [{ x: -12, z: 26 }, { x: -12, z: 0 }]]; // rotas de ataque por ponto
const POSTS = [[{ x: 30, z: -30 }, { x: 34, z: -22 }, { x: 21, z: -31 }], [{ x: 32, z: 32 }, { x: 21, z: 22 }, { x: 34, z: 29 }]];
const WATCH = [{ x: -12, z: -26 }, { x: -12, z: 0 }, { x: -12, z: 26 }, { x: 16, z: -18 }, { x: 13, z: 20 }, { x: 40, z: 0 }, { x: 17, z: 2 }];
const NAMES = [['Barba-Ruiva', 'Maré', 'Gancho', 'Tubarão', 'Caolho'], ['Cap. Aço', 'Sgt. Brisa', 'Âncora', 'Farol', 'Ten. Cruz']];

// ---------------------------------------------------------------- 2. Mundo 3D e colisão
const root = $('game');
const renderer = new T.WebGLRenderer({ antialias: true });
renderer.domElement.className = 'view';
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
root.prepend(renderer.domElement);
const scene = new T.Scene();
scene.background = new T.Color(0x6ccbf4);
scene.fog = new T.Fog(0xa5e0f7, 90, 330);
const camera = new T.PerspectiveCamera(70, 1, .1, 600);
function resize() {
  const w = root.clientWidth || innerWidth, h = root.clientHeight || innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

scene.add(new T.HemisphereLight(0xdff4ff, 0xe2c28a, 1.5));
const sun = new T.DirectionalLight(0xfff2d0, 2.2);
sun.position.set(-50, 90, 40); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -75, right: 75, top: 75, bottom: -75, near: 10, far: 220 });
sun.shadow.bias = -.0005;
scene.add(sun);

const mat = c => new T.MeshLambertMaterial({ color: c });
const boxGeo = new T.BoxGeometry(1, 1, 1);
function mesh(geo, color, x, y, z, parent = scene, shadow = true) {
  const m = new T.Mesh(geo, color instanceof T.Material ? color : mat(color));
  m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
}
function block(color, x, y, z, w, h, d, parent = scene, shadow = true) {
  const m = mesh(boxGeo, color, x, y, z, parent, shadow); m.scale.set(w, h, d); return m;
}

// chão, praia e mar
block(0xf2d48f, 0, -1, 0, BX * 2 + 6, 2, BZ * 2 + 6, scene, false);
block(0xd9b871, 0, -1.25, 0, BX * 2 + 16, 2, BZ * 2 + 16, scene, false);
const sea = mesh(new T.PlaneGeometry(1400, 1400), new T.MeshLambertMaterial({ color: 0x1fa3d6 }), 0, -.7, 0, scene, false);
sea.rotation.x = -Math.PI / 2;
for (const [x, z, r] of [[-22, 0, 9], [15, -14, 7], [14, 20, 6], [44, 0, 9], [-44, 0, 8], [27, -26, 9], [-6, -34, 6], [-6, 34, 6]]) {
  const g = mesh(new T.CircleGeometry(r, 20), 0x8fcf5a, x, .02, z, scene, false); g.rotation.x = -Math.PI / 2;
}

const boxes = [];   // colisão: {x0,x1,z0,z1,h}
const HOUSE_COLORS = [0xfff1d6, 0xffd9a0, 0xa8e0d4, 0xffc2b0, 0xf7e28b, 0xd6e6ff];
const ROOF_COLORS = [0xd9482f, 0x2f7fb8, 0xe07a2a, 0x3a9c7a];
const roofGeo = new T.ConeGeometry(.7071, 1, 4); roofGeo.rotateY(Math.PI / 4);
const cylGeo = new T.CylinderGeometry(.5, .5, 1, 12);
MAP.forEach(([x, z, w, d, h, type], i) => {
  boxes.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, h });
  if (type === 'house') {
    block(HOUSE_COLORS[i % HOUSE_COLORS.length], x, h / 2, z, w, h, d);
    const r = mesh(roofGeo, ROOF_COLORS[i % ROOF_COLORS.length], x, h + 1.6, z); r.scale.set(w + 1.4, 3.2, d + 1.4);
    for (const s of [-1, 1]) {                       // janelas e portas pintadas
      for (let k = -1; k <= 1; k++) {
        block(0x35607a, x + k * w * .3, h * .62, z + s * (d / 2 + .02), 1.2, 1.4, .1, scene, false);
        block(0x35607a, x + s * (w / 2 + .02), h * .62, z + k * d * .3, .1, 1.4, 1.2, scene, false);
      }
      block(0x7a4a22, x, 1.1, z + s * (d / 2 + .03), 1.4, 2.2, .1, scene, false);
    }
  } else if (type === 'wall') {
    block(0xb9b3a4, x, h / 2, z, w, h, d);
    const along = w > d, n = Math.floor(Math.max(w, d) / 1.6);
    for (let k = 0; k < n; k += 2) {                 // ameias
      const o = -Math.max(w, d) / 2 + .8 + k * 1.6;
      block(0xa39d8e, x + (along ? o : 0), h + .3, z + (along ? 0 : o), along ? .9 : w, .6, along ? d : .9);
    }
  } else if (type === 'crate') {
    block(0xb07a3c, x, h / 2, z, w, h, d);
    block(0x8a5a26, x, h - .06, z, w + .06, .12, d + .06, scene, false);
    block(0x8a5a26, x, .06, z, w + .06, .12, d + .06, scene, false);
  } else if (type === 'barrel') {
    const b = mesh(cylGeo, 0x9a5b2c, x, h / 2, z); b.scale.set(w, h, d);
    for (const yy of [.25, .75]) { const r = mesh(cylGeo, 0x4a4a4a, x, h * yy, z, scene, false); r.scale.set(w + .08, .1, d + .08); }
  } else if (type === 'well') {
    const b = mesh(cylGeo, 0xb9b3a4, x, .6, z); b.scale.set(w, 1.2, d);
    block(0x7a4a22, x - 1.2, 1.6, z, .2, 2, .2); block(0x7a4a22, x + 1.2, 1.6, z, .2, 2, .2);
    const r = mesh(roofGeo, 0xd9482f, x, 3, z); r.scale.set(3.6, 1.2, 3.6);
  } else if (type === 'palm') {
    const g = new T.Group(); g.position.set(x, 0, z); g.rotation.z = rand(-.12, .12); g.rotation.x = rand(-.12, .12); scene.add(g);
    const t = mesh(cylGeo, 0x9b7443, 0, h / 2, 0, g); t.scale.set(.55, h, .55);
    for (let k = 0; k < 7; k++) {
      const leaf = mesh(boxGeo, 0x2fa84f, 0, 0, 0, g); leaf.scale.set(.9, .08, 3.6);
      const a = k / 7 * Math.PI * 2; leaf.rotation.order = 'YXZ'; leaf.rotation.y = a; leaf.rotation.x = .45;
      leaf.position.set(Math.sin(a) * 1.6, h - .35, Math.cos(a) * 1.6);
    }
  }
});

// marcação dos pontos A e B
function letterTex(ch, color) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.strokeStyle = g.fillStyle = color; g.lineWidth = 14; g.strokeRect(10, 10, 236, 236);
  g.font = 'bold 170px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 128, 138);
  return new T.CanvasTexture(c);
}
SITES.forEach(s => {
  const css = '#' + s.color.toString(16).padStart(6, '0');
  const p = mesh(new T.PlaneGeometry(s.hx * 2, s.hz * 2), new T.MeshBasicMaterial({ map: letterTex(s.name, css), transparent: true, opacity: .6, depthWrite: false }), s.x, .04, s.z, scene, false);
  p.rotation.x = -Math.PI / 2; p.receiveShadow = false;
  const sp = new T.Sprite(new T.SpriteMaterial({ map: letterTex(s.name, css), transparent: true, opacity: .85, depthTest: false }));
  sp.position.set(s.x, 12, s.z); sp.scale.set(4, 4, 1); scene.add(sp);
});

// cenário fora da área jogável: navio, píer, farol, ilhas e nuvens
(function decor() {
  block(0x9b7443, -58, .1, 0, 12, .3, 5, scene, false);
  const ship = new T.Group(); ship.position.set(-72, 0, 0); scene.add(ship);
  block(0x6b3f1f, 0, 1.6, 0, 9, 5, 26, ship);
  block(0xc99a55, 0, 4.15, 0, 8.4, .2, 25.4, ship);
  block(0x6b3f1f, 0, 5.4, -10, 9, 2.6, 6, ship);
  const bow = mesh(new T.ConeGeometry(4.5, 9, 4), 0x6b3f1f, 0, 1.6, 17.3, ship); bow.rotation.x = Math.PI / 2; bow.rotation.y = Math.PI / 4; bow.scale.z = .56;
  block(0xd9482f, 0, 3.7, 0, 9.2, .5, 26.2, ship, false);
  [[-6, 17], [4, 22], [12, 15]].forEach(([z, hh]) => {
    const m = mesh(cylGeo, 0x7a4a22, 0, 4 + hh / 2, z, ship); m.scale.set(.5, hh, .5);
    block(0xfdf3d8, 0, 4 + hh * .62, z + .3, 9, hh * .5, .15, ship);
    block(0xd9482f, 0, 4 + hh * .62, z + .4, 9, 1, .1, ship, false);
  });
  block(0x1c1c22, 0, 27.2, 4.9, .1, 1.4, 2.2, ship, false);
  // farol
  const rock = mesh(new T.ConeGeometry(14, 12, 7), 0x8d8a80, 70, 3, -62); rock.scale.y = 1;
  const lh = mesh(new T.CylinderGeometry(2.2, 3, 22, 12), 0xfdf3d8, 70, 19, -62);
  mesh(new T.CylinderGeometry(2.4, 2.7, 4, 12), 0xd9482f, 70, 19, -62);
  mesh(new T.CylinderGeometry(1.8, 1.8, 3, 8), 0xffe98a, 70, 31.5, -62); mesh(new T.ConeGeometry(2.8, 3, 8), 0xd9482f, 70, 34.5, -62);
  void rock; void lh;
  for (const [x, z, r, h, c] of [[-160, -200, 60, 70, 0x57b96b], [170, -230, 80, 110, 0x4aa863], [240, 120, 50, 60, 0x57b96b], [-230, 150, 70, 50, 0x6cc47a], [40, 260, 60, 45, 0x57b96b]]) {
    mesh(new T.ConeGeometry(r, h, 9), c, x, h / 2 - 2, z, scene, false);
  }
  const cloudMat = new T.MeshBasicMaterial({ color: 0xffffff, fog: false });
  const sph = new T.SphereGeometry(1, 10, 8);
  for (let i = 0; i < 16; i++) {
    const a = rand(0, Math.PI * 2), r = rand(120, 300), g = new T.Group(); g.position.set(Math.cos(a) * r, rand(60, 110), Math.sin(a) * r); scene.add(g);
    for (let k = 0; k < 5; k++) { const s = mesh(sph, cloudMat, (k - 2) * 9, rand(-2, 3), rand(-4, 4), g, false); const q = rand(8, 14); s.scale.set(q, q * .7, q); s.receiveShadow = false; }
  }
  const sunBall = mesh(sph, new T.MeshBasicMaterial({ color: 0xfff3b0, fog: false }), -150, 260, 120, scene, false); sunBall.scale.setScalar(22);
})();

// --- raios e colisão
// Distância até a primeira caixa/chão atingida pelo raio (ou maxT se nada for atingido).
function rayWorld(ox, oy, oz, dx, dy, dz, maxT) {
  let best = maxT;
  for (const b of boxes) {
    let t0 = 0, t1 = best, a, c;
    if (Math.abs(dx) < 1e-9) { if (ox < b.x0 || ox > b.x1) continue; }
    else { a = (b.x0 - ox) / dx; c = (b.x1 - ox) / dx; if (a > c) [a, c] = [c, a]; if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) continue; }
    if (Math.abs(dz) < 1e-9) { if (oz < b.z0 || oz > b.z1) continue; }
    else { a = (b.z0 - oz) / dz; c = (b.z1 - oz) / dz; if (a > c) [a, c] = [c, a]; if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) continue; }
    if (Math.abs(dy) < 1e-9) { if (oy < 0 || oy > b.h) continue; }
    else { a = -oy / dy; c = (b.h - oy) / dy; if (a > c) [a, c] = [c, a]; if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) continue; }
    best = t0;
  }
  if (dy < 0) { const t = -oy / dy; if (t < best) best = t; }
  return best;
}
// Raio contra um personagem: corpo (caixa) e cabeça (esfera). Retorna {t, head} ou null.
function rayChar(c, ox, oy, oz, dx, dy, dz, maxT) {
  const px = c.pos.x, py = c.pos.y, pz = c.pos.z;
  let hit = null;
  const cx = px - ox, cy = py + 1.66 - oy, cz = pz - oz, tc = cx * dx + cy * dy + cz * dz;
  if (tc > 0) {
    const d2 = cx * cx + cy * cy + cz * cz - tc * tc, r2 = .27 * .27;
    if (d2 < r2) { const t = tc - Math.sqrt(r2 - d2); if (t > 0 && t < maxT) hit = { t, head: true }; }
  }
  let t0 = 0, t1 = hit ? hit.t : maxT, ok = true;
  for (const [o, d, lo, hi] of [[ox, dx, px - .38, px + .38], [oy, dy, py, py + 1.45], [oz, dz, pz - .38, pz + .38]]) {
    if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) { ok = false; break; } continue; }
    let a = (lo - o) / d, b = (hi - o) / d; if (a > b) [a, b] = [b, a];
    if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 > t1) { ok = false; break; }
  }
  if (ok) hit = { t: t0, head: false };
  return hit;
}
// Empurra um círculo (personagem) para fora das caixas e mantém dentro da ilha.
function collide(p, r) {
  for (const b of boxes) {
    const nx = clamp(p.x, b.x0, b.x1), nz = clamp(p.z, b.z0, b.z1);
    let dx = p.x - nx, dz = p.z - nz; const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) { const d = Math.sqrt(d2); p.x = nx + dx / d * r; p.z = nz + dz / d * r; }
    else {
      const l = p.x - b.x0, rr = b.x1 - p.x, n = p.z - b.z0, f = b.z1 - p.z, m = Math.min(l, rr, n, f);
      if (m === l) p.x = b.x0 - r; else if (m === rr) p.x = b.x1 + r; else if (m === n) p.z = b.z0 - r; else p.z = b.z1 + r;
    }
  }
  p.x = clamp(p.x, -BX + r, BX - r); p.z = clamp(p.z, -BZ + r, BZ - r);
}

// --- grade de navegação e A* para os bots
const GW = BX * 2, GH = BZ * 2, blocked = new Uint8Array(GW * GH);
for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
  const x = -BX + i + .5, z = -BZ + j + .5;
  if (boxes.some(b => x > b.x0 - .65 && x < b.x1 + .65 && z > b.z0 - .65 && z < b.z1 + .65)) blocked[j * GW + i] = 1;
}
const isBlocked = (x, z) => { const i = Math.floor(x + BX), j = Math.floor(z + BZ); return i < 0 || j < 0 || i >= GW || j >= GH || blocked[j * GW + i] === 1; };
function freeCell(x, z) {
  const ci = clamp(Math.floor(x + BX), 0, GW - 1), cj = clamp(Math.floor(z + BZ), 0, GH - 1);
  for (let r = 0; r < 12; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
    const i = ci + di, j = cj + dj;
    if (i >= 0 && j >= 0 && i < GW && j < GH && !blocked[j * GW + i]) return j * GW + i;
  }
  return -1;
}
function walkLine(a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, n = Math.ceil(Math.hypot(dx, dz) / .4);
  for (let k = 1; k < n; k++) if (isBlocked(a.x + dx * k / n, a.z + dz * k / n)) return false;
  return true;
}
function findPath(sx, sz, tx, tz) {
  const s = freeCell(sx, sz), t = freeCell(tx, tz);
  if (s < 0 || t < 0) return [];
  const N = GW * GH, g = new Float32Array(N).fill(1e9), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const heap = [], ti = t % GW, tj = (t / GW) | 0;
  const hfn = n => Math.hypot(n % GW - ti, ((n / GW) | 0) - tj);
  const push = (f, n) => { heap.push([f, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) { heap[0] = last; let i = 0; for (;;) { let m = i; const l = 2 * i + 1, r = l + 1; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } }
    return top[1];
  };
  g[s] = 0; push(hfn(s), s);
  while (heap.length) {
    const n = pop(); if (closed[n]) continue; closed[n] = 1; if (n === t) break;
    const i = n % GW, j = (n / GW) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= GW || b >= GH) continue;
      const m = b * GW + a; if (blocked[m] || closed[m]) continue;
      if (di && dj && (blocked[j * GW + a] || blocked[b * GW + i])) continue;
      const ng = g[n] + (di && dj ? 1.414 : 1);
      if (ng < g[m]) { g[m] = ng; from[m] = n; push(ng + hfn(m), m); }
    }
  }
  if (from[t] < 0 && s !== t) return [];
  const pts = []; for (let n = t; n >= 0; n = from[n]) pts.push({ x: -BX + n % GW + .5, z: -BZ + ((n / GW) | 0) + .5 });
  pts.reverse();
  const out = []; let i = 0;                         // suaviza: pula pontos com linha livre
  while (i < pts.length - 1) { let j = pts.length - 1; while (j > i + 1 && !walkLine(pts[i], pts[j])) j--; out.push(pts[j]); i = j; }
  return out;
}

// ---------------------------------------------------------------- som (sintetizado, sem arquivos)
let ac = null, noise = null;
function audioOn() {
  if (ac) return; try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    noise = ac.createBuffer(1, ac.sampleRate * .4, ac.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { ac = null; }
}
function sShot(vol, tone, dur = .16) {
  if (!ac || vol < .01) return;
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noise;
  f.type = 'lowpass'; f.frequency.value = tone; g.gain.setValueAtTime(vol, ac.currentTime); g.gain.exponentialRampToValueAtTime(.001, ac.currentTime + dur);
  s.connect(f); f.connect(g); g.connect(ac.destination); s.start(); s.stop(ac.currentTime + dur);
}
function sBeep(freq, dur, vol) {
  if (!ac) return;
  const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = freq; o.type = 'square';
  g.gain.setValueAtTime(vol, ac.currentTime); g.gain.exponentialRampToValueAtTime(.001, ac.currentTime + dur);
  o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + dur);
}

// ---------------------------------------------------------------- 3. Personagens e tiros
const chars = [];
let player = null;
const SKIN = [0xf2c9a0, 0xc98d5e, 0x8a5a3a, 0xe8b88a, 0xa8714a];
const SHIRT = [0x2aa7a0, 0xd9482f, 0x7a4fb0, 0xf2f2f2, 0x2f2f38];

function makeChar(team, idx, isPlayer) {
  const g = new T.Group(); g.rotation.order = 'YXZ'; scene.add(g);
  const skin = SKIN[(idx + team * 2) % SKIN.length];
  const shirt = team === ATK ? SHIRT[idx % SHIRT.length] : 0xf4f6fa;
  const pants = team === ATK ? 0x3b4a6b : 0x2456a6;
  block(shirt, 0, 1.08, 0, .7, .72, .36, g);
  block(team === ATK ? 0xffc83d : 0x2456a6, 0, .76, 0, .72, .1, .38, g, false);       // faixa / cinto
  block(skin, 0, 1.66, 0, .42, .42, .42, g);
  if (team === ATK) { block(isPlayer ? 0x1c1c22 : 0xc9302a, 0, 1.84, .02, .46, .16, .48, g); block(isPlayer ? 0x1c1c22 : 0xc9302a, .2, 1.72, .28, .1, .22, .1, g, false); }
  else { block(0xf4f6fa, 0, 1.9, 0, .46, .14, .46, g); block(0x2456a6, 0, 1.84, -.16, .48, .05, .62, g, false); }
  const legs = [-1, 1].map(s => { const p = new T.Group(); p.position.set(s * .19, .72, 0); g.add(p); block(pants, 0, -.36, 0, .28, .72, .3, p); return p; });
  const armL = new T.Group(); armL.position.set(-.46, 1.36, 0); g.add(armL); block(shirt, 0, -.28, 0, .2, .62, .22, armL);
  const armR = new T.Group(); armR.position.set(.46, 1.36, 0); armR.rotation.x = 1.35; g.add(armR); block(shirt, 0, -.28, 0, .2, .62, .22, armR);
  const gun = block(0x2b2b30, .44, 1.3, -.75, .09, .14, .5, g);
  let tag = null;
  if (!isPlayer) { tag = mesh(new T.ConeGeometry(.16, .3, 4), new T.MeshBasicMaterial({ color: 0x7dff8a }), 0, 2.4, 0, g, false); tag.rotation.x = Math.PI; tag.receiveShadow = false; }
  return {
    team, isPlayer, name: isPlayer ? 'Você' : NAMES[team][idx], mesh: g, legs, armL, gun, tag,
    pos: new T.Vector3(), yaw: 0, pitch: 0, vy: 0, hp: 100, armor: 0, alive: true, money: 800, kills: 0, deaths: 0,
    primary: null, cur: 'pistol', ammo: {}, cool: 0, reloadT: 0, heat: 0, moving: false, walkPh: 0, deadT: 0,
    // estado de bot
    path: [], dest: null, target: null, aimY: 1.2, seeT: 0, reaction: .5, thinkT: rand(0, .3), strafe: 0, strafeT: 0, burst: 0, pause: 0,
    alertT: 0, action: null, actT: 0, post: null, postT: 0, via: null, watch: null, watchT: 0, site: 0,
  };
}
const weaponOf = c => WEAPONS[c.cur === 'primary' && c.primary ? c.primary : 'pistol'];
const weaponId = c => (c.cur === 'primary' && c.primary ? c.primary : 'pistol');
const alive = team => chars.filter(c => c.team === team && c.alive);

function setupTeams(playerTeam) {
  for (const team of [ATK, DEF]) for (let i = 0; i < 5; i++) {
    const isP = team === playerTeam && i === 0, c = makeChar(team, i, isP);
    chars.push(c); if (isP) player = c;
  }
  for (const c of chars) if (c.tag) c.tag.visible = c.team === playerTeam;
}

// efeitos: rastros de bala e faíscas reaproveitados
const tracers = [], sparks = [];
for (let i = 0; i < 40; i++) {
  const l = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]), new T.LineBasicMaterial({ color: 0xfff3a0, transparent: true }));
  l.visible = false; l.frustumCulled = false; scene.add(l); tracers.push({ l, t: 0 });
  const s = mesh(boxGeo, new T.MeshBasicMaterial({ color: 0xffe9a0 }), 0, 0, 0, scene, false); s.scale.setScalar(.14); s.visible = false; s.receiveShadow = false; sparks.push({ s, t: 0 });
}
let trI = 0, spI = 0;
function tracer(ax, ay, az, bx, by, bz, blood) {
  const tr = tracers[trI = (trI + 1) % tracers.length], p = tr.l.geometry.attributes.position;
  p.setXYZ(0, ax, ay, az); p.setXYZ(1, bx, by, bz); p.needsUpdate = true; tr.l.visible = true; tr.t = .07;
  const sp = sparks[spI = (spI + 1) % sparks.length]; sp.s.position.set(bx, by, bz); sp.s.material.color.set(blood ? 0xff5040 : 0xffe9a0); sp.s.visible = true; sp.t = .12;
}

const feed = [];
function addFeed(html) { feed.push({ html, t: 6 }); if (feed.length > 5) feed.shift(); drawFeed(); }
function drawFeed() { $('feed').innerHTML = feed.map(f => `<div>${f.html}</div>`).join(''); }

function damage(v, dmg, from, head) {
  if (!v.alive || state === 'over' || state === 'end') return;
  if (head) dmg *= 3;
  if (v.armor > 0) { const abs = Math.min(v.armor, dmg * .4); v.armor -= abs; dmg -= abs; }
  v.hp -= dmg; v.alertT = 2.5;
  if (v.isPlayer) { hurtA = Math.min(1, hurtA + dmg / 50); }
  if (from.isPlayer) { hitT = .15; }
  if (v.hp <= 0) {
    v.hp = 0; v.alive = false; v.deaths++; v.deadT = 0; v.action = null; from.kills++; from.money = Math.min(12000, from.money + 300);
    addFeed(`<span class="${TCLS[from.team]}">${from.name}</span> ${WEAPONS[weaponId(from)].name}${head ? ' ☠' : ''} → <span class="${TCLS[v.team]}">${v.name}</span>`);
    if (bomb.state === 'carried' && bomb.carrier === v) dropBomb(v.pos.x, v.pos.z);
    if (v.isPlayer) { scoped = false; $('buy').hidden = true; }
  }
}

// Dispara a arma atual de c na direção do ponto (tx,ty,tz). extraSpread em radianos.
function fire(c, tx, ty, tz, extraSpread) {
  const w = weaponOf(c), id = weaponId(c);
  if (c.cool > 0 || c.reloadT > 0) return false;
  if (c.ammo[id] <= 0) { startReload(c); return false; }
  c.ammo[id]--; c.cool = w.rate;
  const ox = c.pos.x, oy = c.pos.y + 1.5, oz = c.pos.z;
  let dx = tx - ox, dy = ty - oy, dz = tz - oz; const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
  const sp = w.spread + extraSpread;
  const mx = ox + Math.cos(c.yaw) * .4 + dx * .8, my = oy - .15, mz = oz - Math.sin(c.yaw) * .4 + dz * .8;
  for (let k = 0; k < (w.pellets || 1); k++) {
    let ax = dx + (Math.random() + Math.random() - 1) * sp, ay = dy + (Math.random() + Math.random() - 1) * sp, az = dz + (Math.random() + Math.random() - 1) * sp;
    const n = Math.hypot(ax, ay, az); ax /= n; ay /= n; az /= n;
    let best = rayWorld(ox, oy, oz, ax, ay, az, 250), victim = null, head = false;
    for (const e of chars) {
      if (e.team === c.team || !e.alive) continue;
      const h = rayChar(e, ox, oy, oz, ax, ay, az, best);
      if (h) { best = h.t; victim = e; head = h.head; }
    }
    tracer(mx, my, mz, ox + ax * best, oy + ay * best, oz + az * best, !!victim);
    if (victim) damage(victim, w.dmg * (best > 40 && !w.scope ? .8 : 1), c, head);
  }
  const d = player ? c.pos.distanceTo(player.pos) : 0, vol = c.isPlayer ? .35 : .3 * Math.pow(clamp(1 - d / 110, 0, 1), 2);
  sShot(vol, id === 'sniper' ? 900 : id === 'shotgun' ? 1100 : id === 'pistol' ? 2600 : 2000, id === 'sniper' ? .4 : .16);
  if (c.ammo[id] <= 0) startReload(c);
  return true;
}
function startReload(c) { const id = weaponId(c), w = WEAPONS[id]; if (c.reloadT > 0 || c.ammo[id] >= w.mag) return; c.reloadT = w.reload; if (c.isPlayer) scoped = false; }

// Linha de visão do olho de a até b; guarda em a.aimY a altura visível (peito ou cabeça).
function canSee(a, b) {
  const ox = a.pos.x, oy = 1.55, oz = a.pos.z;
  for (const y of [1.15, 1.68]) {
    let dx = b.pos.x - ox, dy = b.pos.y + y - oy, dz = b.pos.z - oz; const l = Math.hypot(dx, dy, dz);
    if (rayWorld(ox, oy, oz, dx / l, dy / l, dz / l, l) >= l - .02) { a.aimY = y; return true; }
  }
  return false;
}

// ---------------------------------------------------------------- 4. Bomba e rodadas
const bomb = { state: 'none', carrier: null, x: 0, z: 0, t: 0, beepT: 0, defuser: null, defT: 0, plantT: 0, mesh: null, light: null };
{
  const g = new T.Group(); scene.add(g); bomb.mesh = g; g.visible = false;
  const b = mesh(cylGeo, 0x7a2f1f, 0, .35, 0, g); b.scale.set(.6, .7, .6);
  for (const y of [.15, .55]) { const r = mesh(cylGeo, 0x2b2b30, 0, y, 0, g, false); r.scale.set(.64, .07, .64); }
  bomb.light = mesh(new T.SphereGeometry(.1, 8, 6), new T.MeshBasicMaterial({ color: 0xff3020 }), 0, .8, 0, g, false);
}
const blast = mesh(new T.SphereGeometry(1, 16, 12), new T.MeshBasicMaterial({ color: 0xffa030, transparent: true, fog: false }), 0, 0, 0, scene, false);
blast.visible = false; let blastT = 0;

let state = 'menu', stateT = 0, roundT = 0, buyT = 0, round = 0, teamSite = 0, msgT = 0;
const score = [0, 0], lossStreak = [0, 0];
let hurtA = 0, hitT = 0, scoped = false, buyOpen = false;

function say(text, t = 3) { $('msg').textContent = text; msgT = t; }
const inSite = (x, z) => SITES.findIndex(s => Math.abs(x - s.x) < s.hx && Math.abs(z - s.z) < s.hz);
function dropBomb(x, z) { bomb.state = 'dropped'; bomb.carrier = null; bomb.x = x; bomb.z = z; bomb.mesh.visible = true; bomb.mesh.position.set(x, 0, z); bomb.light.visible = false; }
function plantBomb(c) {
  bomb.state = 'planted'; bomb.carrier = null; bomb.x = c.pos.x; bomb.z = c.pos.z; bomb.t = BOMB_TIME; bomb.beepT = 0; bomb.defT = 0;
  bomb.mesh.visible = true; bomb.mesh.position.set(bomb.x, 0, bomb.z); bomb.light.visible = true;
  state = 'planted'; say('Barril plantado no ponto ' + SITES[Math.max(0, inSite(bomb.x, bomb.z))].name + '!');
  c.money = Math.min(12000, c.money + 300); sBeep(660, .3, .2);
}

function startRound() {
  round++; state = 'freeze'; stateT = FREEZE; roundT = ROUND_TIME; buyT = BUY_TIME;
  teamSite = Math.random() < .5 ? 0 : 1;
  bomb.state = 'carried'; bomb.mesh.visible = false; bomb.defT = 0; blast.visible = false;
  let di = 0;
  for (const team of [ATK, DEF]) chars.filter(c => c.team === team).forEach((c, i) => {
    if (!c.alive) { c.primary = null; c.armor = 0; }
    c.alive = true; c.hp = 100; c.pos.set(team === ATK ? -50 + (i % 2) * 2 : 50 - (i % 2) * 2, 0, (i - 2) * 3); c.vy = 0;
    c.yaw = team === ATK ? -Math.PI / 2 : Math.PI / 2; c.pitch = 0;
    c.mesh.rotation.set(0, c.yaw, 0); c.mesh.position.copy(c.pos); c.mesh.visible = true;
    c.path = []; c.dest = null; c.target = null; c.action = null; c.actT = 0; c.reloadT = 0; c.cool = 0; c.heat = 0; c.alertT = 0; c.seeT = 0;
    if (!c.isPlayer) {                                // compras e planos dos bots
      if (!c.primary) {
        if (c.money >= 2700) { c.primary = 'rifle'; c.money -= 2700; }
        else if (c.money >= 1500) { c.primary = 'smg'; c.money -= 1500; }
        else if (c.money >= 1200 && Math.random() < .5) { c.primary = 'shotgun'; c.money -= 1200; }
      }
      if (c.armor < 50 && c.money >= ARMOR_PRICE) { c.armor = 100; c.money -= ARMOR_PRICE; }
      c.reaction = rand(.4, .75);
      if (team === ATK) { c.via = pick(LANES[teamSite]); c.site = teamSite; }
      else { c.site = di < 2 ? 0 : di < 4 ? 1 : (Math.random() < .5 ? 0 : 1); c.post = POSTS[c.site][di % 3]; c.postT = rand(8, 14); di++; }
    }
    c.cur = c.primary ? 'primary' : 'pistol';
    c.ammo = { pistol: WEAPONS.pistol.mag }; if (c.primary) c.ammo[c.primary] = WEAPONS[c.primary].mag;
    c.gun.scale.z = weaponOf(c).len; c.gun.position.z = -.5 - weaponOf(c).len / 2;
  });
  const atk = chars.filter(c => c.team === ATK);
  bomb.carrier = player.team === ATK ? player : pick(atk.filter(c => !c.isPlayer));
  scoped = false; hurtA = 0;
  say(player.team === ATK ? `Rodada ${round} — seu bando ataca o ponto ${SITES[teamSite].name}. Você leva o barril.` : `Rodada ${round} — defenda os pontos A e B`, 4);
  if (round === 1) { buyOpen = false; }
}
function endRound(winner, why) {
  if (state === 'over' || state === 'end') return;
  score[winner]++; state = 'over'; stateT = 5;
  lossStreak[winner] = 0; const bonus = 1700 + 500 * Math.min(3, lossStreak[1 - winner]++);   // quem perde seguido ganha mais ouro
  for (const c of chars) c.money = Math.min(12000, c.money + (c.team === winner ? 3000 : bonus));
  say(`${TEAM[winner]} vencem a rodada — ${why}`, 5);
  buyOpen = false; $('buy').hidden = true; scoped = false;
}
function updateRound(dt) {
  if (state === 'freeze') { stateT -= dt; buyT -= dt; if (stateT <= 0) state = 'live'; return; }
  if (state === 'over') {
    stateT -= dt;
    if (stateT <= 0) {
      if (score[ATK] >= WIN_ROUNDS || score[DEF] >= WIN_ROUNDS) {
        state = 'end'; const w = score[ATK] >= WIN_ROUNDS ? ATK : DEF;
        $('endT').textContent = w === player.team ? 'Vitória!' : 'Derrota';
        $('endP').textContent = `${TEAM[ATK]} ${score[ATK]} × ${score[DEF]} ${TEAM[DEF]} — você fez ${player.kills} abates.`;
        $('end').hidden = false; document.exitPointerLock && document.exitPointerLock();
      } else startRound();
    }
    return;
  }
  if (state !== 'live' && state !== 'planted') return;
  buyT -= dt;
  const na = alive(ATK).length, nd = alive(DEF).length;
  if (nd === 0) return endRound(ATK, 'Armada eliminada');
  if (state === 'live') {
    roundT -= dt;
    if (na === 0) return endRound(DEF, 'Piratas eliminados');
    if (roundT <= 0) return endRound(DEF, 'tempo esgotado');
    if (bomb.state === 'dropped') for (const c of alive(ATK)) if (Math.hypot(c.pos.x - bomb.x, c.pos.z - bomb.z) < 1.2) { bomb.state = 'carried'; bomb.carrier = c; bomb.mesh.visible = false; if (c.isPlayer) say('Você pegou o barril', 2); break; }
  } else {
    bomb.t -= dt; bomb.beepT -= dt;
    if (bomb.beepT <= 0) { bomb.beepT = clamp(bomb.t / 30, .12, 1); sBeep(1100, .06, .12 * clamp(1 - Math.hypot(player.pos.x - bomb.x, player.pos.z - bomb.z) / 80, .15, 1)); bomb.light.visible = !bomb.light.visible; }
    if (bomb.t <= 0) {
      blast.visible = true; blast.position.set(bomb.x, 1, bomb.z); blastT = 0; bomb.mesh.visible = false; sShot(.6, 500, 1.2);
      const near = chars.filter(c => c.alive && Math.hypot(c.pos.x - bomb.x, c.pos.z - bomb.z) < 11);
      endRound(ATK, 'o barril explodiu');
      for (const c of near) { c.alive = false; c.hp = 0; c.deadT = 0; }
    }
  }
}

// ---------------------------------------------------------------- 5. Jogador, câmera e bots
const keys = {}; let mouseL = false, mouseR = false, firedOnce = false, locked = false, freeLook = false;
const turnTo = (a, b, max) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + clamp(d, -max, max); };
const angDiff = (a, b) => Math.abs(((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI);
const canBuy = () => player.alive && buyT > 0 && (state === 'freeze' || state === 'live');

function updatePlayer(dt) {
  const p = player; if (!p.alive) return;
  const frozen = state === 'freeze';
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
  let mx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), mz = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  const busy = p.action !== null;
  if (frozen || busy || buyOpen) mx = mz = 0;
  const l = Math.hypot(mx, mz); p.moving = l > 0;
  if (l) {
    const sp = (keys.ShiftLeft || scoped ? 2.6 : 5.6) / l;
    p.pos.x += (fx * mz + rx * mx) * sp * dt; p.pos.z += (fz * mz + rz * mx) * sp * dt;
  }
  if (keys.Space && p.pos.y === 0 && !frozen && !busy) p.vy = 6.2;
  p.pos.y += p.vy * dt; p.vy -= 19 * dt; if (p.pos.y <= 0) { p.pos.y = 0; p.vy = 0; }
  collide(p.pos, .45);

  // plantar / desarmar com E
  p.action = null; let hint = '';
  if (state === 'live' && bomb.state === 'carried' && bomb.carrier === p) {
    if (inSite(p.pos.x, p.pos.z) >= 0) { hint = 'Segure E para plantar o barril'; if (keys.KeyE && p.pos.y === 0) p.action = 'plant'; }
  } else if (state === 'planted' && p.team === DEF && Math.hypot(p.pos.x - bomb.x, p.pos.z - bomb.z) < 1.8) {
    hint = 'Segure E para desarmar'; if (keys.KeyE) p.action = 'defuse';
  }
  if (p.action === 'plant') { p.actT += dt; if (p.actT >= PLANT_T) { plantBomb(p); p.action = null; p.actT = 0; } }
  else if (p.action === 'defuse') { bomb.defT += dt; if (bomb.defT >= DEFUSE_T) { p.money = Math.min(12000, p.money + 300); endRound(DEF, 'barril desarmado'); } }
  else { p.actT = 0; if (p.team === DEF && !chars.some(c => c.action === 'defuse')) bomb.defT = 0; }
  if (!hint && canBuy() && !buyOpen) hint = 'B abre o arsenal';
  $('hint').hidden = !hint; $('hint').textContent = hint;
  const prog = p.action === 'plant' ? p.actT / PLANT_T : p.action === 'defuse' ? bomb.defT / DEFUSE_T : -1;
  $('bar').hidden = prog < 0; if (prog >= 0) $('bar').firstElementChild.style.width = (prog * 100) + '%';

  // tiro
  const w = weaponOf(p);
  scoped = mouseR && p.reloadT <= 0 && !buyOpen;
  if (mouseL && !frozen && !busy && !buyOpen && (w.auto || !firedOnce) && (state === 'live' || state === 'planted')) {
    const a = aimPoint();
    let extra = p.heat * .012 + (p.moving ? (keys.ShiftLeft ? .008 : .03) : 0) + (p.pos.y > 0 ? .06 : 0);
    if (w.scope && !scoped) extra += .07;
    if (fire(p, a.x, a.y, a.z, extra)) { firedOnce = true; p.heat = Math.min(6, p.heat + 1); p.pitch = Math.min(1.3, p.pitch + (w.scope ? .03 : .004 + p.heat * .0008)); }
  }
  if (!mouseL) firedOnce = false;
  p.heat = Math.max(0, p.heat - dt * 7);
}
// Ponto do mundo sob a mira no centro da tela.
const camF = new T.Vector3();
function aimPoint() {
  camera.getWorldDirection(camF);
  const skip = camera.position.distanceTo(player.pos) + .3;
  const ox = camera.position.x + camF.x * skip, oy = camera.position.y + camF.y * skip, oz = camera.position.z + camF.z * skip;
  let t = rayWorld(ox, oy, oz, camF.x, camF.y, camF.z, 250);
  for (const e of chars) if (e.team !== player.team && e.alive) { const h = rayChar(e, ox, oy, oz, camF.x, camF.y, camF.z, t); if (h) t = h.t; }
  return { x: ox + camF.x * t, y: oy + camF.y * t, z: oz + camF.z * t };
}
function updateCamera(dt) {
  const p = player, w = weaponOf(p);
  const cp = Math.cos(p.pitch), fx = -Math.sin(p.yaw) * cp, fy = Math.sin(p.pitch), fz = -Math.cos(p.yaw) * cp;
  const rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
  const side = scoped ? .45 : .75, px = p.pos.x + rx * side, py = p.pos.y + 1.7, pz = p.pos.z + rz * side;
  let dist = scoped ? 1.3 : 3.8;
  const t = rayWorld(px, py, pz, -fx, -fy, -fz, dist + .3); if (t < dist + .3) dist = Math.max(.2, t - .3);
  camera.position.set(px - fx * dist, Math.max(.3, py - fy * dist), pz - fz * dist);
  camera.lookAt(camera.position.x + fx, camera.position.y + fy, camera.position.z + fz);
  const fov = scoped ? (w.scope ? 16 : 48) : 70;
  if (Math.abs(camera.fov - fov) > .1) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 14); camera.updateProjectionMatrix(); }
  $('scope').hidden = !(scoped && w.scope && camera.fov < 30);
}

function goTo(b, x, z) {
  if (b.dest && Math.hypot(b.dest.x - x, b.dest.z - z) < 1.5 && (b.path.length || Math.hypot(b.pos.x - x, b.pos.z - z) < 1.5)) return;
  b.dest = { x, z }; b.path = findPath(b.pos.x, b.pos.z, x, z);
}
function randomNear(x, z, r) {
  for (let k = 0; k < 12; k++) { const a = rand(0, 6.283), d = rand(1.5, r), px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d; if (!isBlocked(px, pz)) return { x: px, z: pz }; }
  return { x, z };
}
// Decisão do bot (roda ~6x por segundo): escolhe alvo e objetivo.
function botThink(b) {
  let best = null, bd = 85;
  const fx = -Math.sin(b.yaw), fz = -Math.cos(b.yaw);
  for (const e of chars) {
    if (e.team === b.team || !e.alive) continue;
    const dx = e.pos.x - b.pos.x, dz = e.pos.z - b.pos.z, d = Math.hypot(dx, dz);
    if (d >= bd) continue;
    if (d > 6 && b.alertT <= 0 && e !== b.target && (dx * fx + dz * fz) / d < -.25) continue;   // fora do campo de visão
    if (canSee(b, e)) { best = e; bd = d; }
  }
  if (best !== b.target) { b.seeT = 0; b.burst = 0; }
  b.target = best;
  if (best) { canSee(b, best); for (const m of chars) if (m.team === b.team && m.alive && m !== b && m.pos.distanceTo(b.pos) < 25) m.alertT = Math.max(m.alertT, 1.5); }

  b.action = null;
  if (b.team === ATK) {
    if (bomb.state === 'planted') { b.postT -= .2; if (!b.post || b.postT <= 0 || !b.dest) { b.post = randomNear(bomb.x, bomb.z, 8); b.postT = rand(5, 10); } goTo(b, b.post.x, b.post.z); return; }
    if (bomb.state === 'dropped') {
      const bots = alive(ATK).filter(c => !c.isPlayer).sort((a, c) => Math.hypot(a.pos.x - bomb.x, a.pos.z - bomb.z) - Math.hypot(c.pos.x - bomb.x, c.pos.z - bomb.z));
      if (bots[0] === b) { goTo(b, bomb.x, bomb.z); return; }
    }
    const s = SITES[b.site];
    if (bomb.carrier === b && inSite(b.pos.x, b.pos.z) === b.site && Math.hypot(b.pos.x - s.x, b.pos.z - s.z) < 5) { if (!b.target) b.action = 'plant'; return; }
    if (b.via) { if (Math.hypot(b.pos.x - b.via.x, b.pos.z - b.via.z) < 4) b.via = null; else { goTo(b, b.via.x, b.via.z); return; } }
    if (bomb.carrier === b) { goTo(b, s.x + 2, s.z + 2); return; }
    b.postT -= .2; if (!b.post || b.postT <= 0 || inSite(b.post.x, b.post.z) !== b.site) { b.post = randomNear(s.x, s.z, 6); b.postT = rand(6, 12); }
    goTo(b, b.post.x, b.post.z);
  } else {
    if (bomb.state === 'planted') {
      const d = Math.hypot(b.pos.x - bomb.x, b.pos.z - bomb.z);
      const taken = chars.some(c => c !== b && c.alive && c.action === 'defuse');
      if (d < 1.7 && !taken && !(b.target && b.target.pos.distanceTo(b.pos) < 14)) { b.action = 'defuse'; return; }
      if (taken && d < 7) { if (!b.post || Math.hypot(b.post.x - bomb.x, b.post.z - bomb.z) > 8) b.post = randomNear(bomb.x, bomb.z, 6); goTo(b, b.post.x, b.post.z); }
      else goTo(b, bomb.x + .9, bomb.z + .6);
      return;
    }
    b.postT -= .2; if (b.postT <= 0) { b.post = Math.random() < .7 ? pick(POSTS[b.site]) : randomNear(SITES[b.site].x, SITES[b.site].z, 7); b.postT = rand(8, 15); }
    goTo(b, b.post.x, b.post.z);
  }
}
function updateBot(b, dt) {
  if (!b.alive) return;
  if (state === 'freeze' || state === 'over' || state === 'end') { b.moving = false; return; }
  b.alertT -= dt; b.thinkT -= dt;
  if (b.thinkT <= 0) { b.thinkT = rand(.14, .22); botThink(b); }
  b.moving = false;
  const tg = b.target;
  if (tg && tg.alive) {
    const dx = tg.pos.x - b.pos.x, dz = tg.pos.z - b.pos.z, d = Math.hypot(dx, dz), want = Math.atan2(-dx, -dz);
    b.yaw = turnTo(b.yaw, want, 8 * dt); b.seeT += dt;
    b.strafeT -= dt; if (b.strafeT <= 0) { b.strafe = pick([-1, 0, 0, 1]); b.strafeT = rand(.4, 1); }
    if (b.strafe && b.action === null) { b.pos.x += Math.cos(b.yaw) * b.strafe * 2.4 * dt; b.pos.z -= Math.sin(b.yaw) * b.strafe * 2.4 * dt; b.moving = true; collide(b.pos, .45); }
    b.pause -= dt;
    if (b.seeT > b.reaction && b.pause <= 0 && angDiff(b.yaw, want) < .2) {
      const w = weaponOf(b), err = (.05 + (tg.moving ? .02 : 0) + Math.max(0, .06 - b.seeT * .04)) * d;
      if (fire(b, tg.pos.x + rand(-err, err), tg.pos.y + b.aimY + rand(-err, err) * .6, tg.pos.z + rand(-err, err), b.moving ? .015 : 0)) {
        if (++b.burst >= (w.auto ? 4 + Math.floor(Math.random() * 4) : 1)) { b.burst = 0; b.pause = w.auto ? rand(.25, .6) : rand(.1, .35); }
      }
    }
    return;
  }
  if (weaponOf(b).mag > b.ammo[weaponId(b)] + 8 && b.reloadT <= 0) startReload(b);
  if (b.action === 'plant') { b.actT += dt; if (b.actT >= PLANT_T + .3) { plantBomb(b); b.action = null; b.actT = 0; } return; }
  if (b.action === 'defuse') { bomb.defT += dt; if (bomb.defT >= DEFUSE_T) endRound(DEF, 'barril desarmado'); return; }
  b.actT = 0;
  if (b.path.length) {
    const n = b.path[0], dx = n.x - b.pos.x, dz = n.z - b.pos.z, d = Math.hypot(dx, dz);
    if (d < .5) { b.path.shift(); return; }
    const sp = 5 * dt; b.pos.x += dx / d * Math.min(sp, d); b.pos.z += dz / d * Math.min(sp, d); b.moving = true;
    b.yaw = turnTo(b.yaw, Math.atan2(-dx, -dz), 7 * dt); collide(b.pos, .45);
  } else {                                           // parado: vigia um ponto de passagem
    b.watchT -= dt; if (b.watchT <= 0 || !b.watch) { b.watch = b.team === DEF ? pick(WATCH) : (bomb.state === 'planted' ? { x: 50, z: 0 } : pick(WATCH)); b.watchT = rand(2, 4); }
    b.yaw = turnTo(b.yaw, Math.atan2(-(b.watch.x - b.pos.x), -(b.watch.z - b.pos.z)), 3 * dt);
  }
}

function updateChars(dt) {
  for (const c of chars) {
    c.cool -= dt;
    if (c.reloadT > 0 && c.alive) { c.reloadT -= dt; if (c.reloadT <= 0) c.ammo[weaponId(c)] = weaponOf(c).mag; }
    if (c.action === 'defuse' && !c.alive) c.action = null;
  }
  if (!chars.some(c => c.alive && c.action === 'defuse') && state === 'planted') bomb.defT = 0;
  for (let i = 0; i < chars.length; i++) for (let j = i + 1; j < chars.length; j++) {   // não deixar um entrar no outro
    const a = chars[i], b = chars[j]; if (!a.alive || !b.alive) continue;
    const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz);
    if (d < .85 && d > .001) { const k = (.85 - d) / 2 / d; a.pos.x -= dx * k; a.pos.z -= dz * k; b.pos.x += dx * k; b.pos.z += dz * k; }
  }
  for (const c of chars) {
    const m = c.mesh;
    if (c.alive) {
      m.position.copy(c.pos); m.rotation.set(0, c.yaw, 0);
      c.walkPh += dt * (c.moving ? 11 : 0); const sw = c.moving ? Math.sin(c.walkPh) * .7 : 0;
      c.legs[0].rotation.x = sw; c.legs[1].rotation.x = -sw; c.armL.rotation.x = c.action ? 1.2 : -sw * .6;
      c.gun.visible = !c.action;
    } else if (c.deadT < 1) {
      c.deadT = Math.min(1, c.deadT + dt * 3); m.rotation.x = -c.deadT * Math.PI / 2; m.position.y = c.pos.y * (1 - c.deadT) + .2 * c.deadT; c.gun.visible = false;
    }
  }
}

// ---------------------------------------------------------------- 6. HUD, entrada e laço principal
function buy(n) {
  const p = player, item = SHOP[n]; if (!item || !canBuy()) return;
  if (item === 'armor') { if (p.money >= ARMOR_PRICE && p.armor < 100) { p.money -= ARMOR_PRICE; p.armor = 100; sBeep(520, .08, .1); } }
  else { const w = WEAPONS[item]; if (p.money >= w.price && p.primary !== item) { p.money -= w.price; p.primary = item; p.ammo[item] = w.mag; setWeapon('primary'); sBeep(520, .08, .1); } }
  drawBuy();
}
function setWeapon(slot) {
  const p = player; if (slot === 'primary' && !p.primary) return;
  p.cur = slot; p.reloadT = 0; p.cool = Math.max(p.cool, .3); const w = weaponOf(p); p.gun.scale.z = w.len; p.gun.position.z = -.5 - w.len / 2;
}
function drawBuy() {
  const p = player;
  $('buyT').innerHTML = '<tr><th>Tecla</th><th>Item</th><th class="n">Dano</th><th class="n">Preço</th></tr>' + SHOP.map((id, i) => {
    const w = WEAPONS[id], price = w ? w.price : ARMOR_PRICE, own = w ? p.primary === id : p.armor >= 100;
    return `<tr class="${p.money < price || own ? 'no' : ''}"><td><kbd>${i + 1}</kbd></td><td>${w ? w.name : 'Colete'}${own ? ' (equipado)' : ''}</td><td class="n">${w ? (w.pellets ? w.pellets + '×' : '') + w.dmg : '—'}</td><td class="n">$${price}</td></tr>`;
  }).join('');
}
function drawBoard() {
  let h = '';
  for (const team of [ATK, DEF]) {
    h += `<tr><th class="${TCLS[team]}">${TEAM[team]} — ${score[team]}</th><th class="n">Abates</th><th class="n">Mortes</th><th class="n">Ouro</th></tr>`;
    for (const c of chars.filter(c => c.team === team).sort((a, b) => b.kills - a.kills))
      h += `<tr class="${c.isPlayer ? 'me' : ''} ${c.alive ? '' : 'dead'}"><td>${c.name}</td><td class="n">${c.kills}</td><td class="n">${c.deaths}</td><td class="n">${c.team === player.team ? '$' + c.money : ''}</td></tr>`;
  }
  $('boardT').innerHTML = h;
}
const mini = $('mini').getContext('2d');
function drawMini() {
  const S = 1.5, X = x => (x + BX) * S, Z = z => (z + BZ) * S, g = mini;
  g.clearRect(0, 0, 168, 126); g.fillStyle = 'rgba(242,212,143,.35)'; g.fillRect(0, 0, 168, 126);
  for (const s of SITES) { g.fillStyle = s.name === 'A' ? 'rgba(255,106,77,.45)' : 'rgba(95,180,255,.45)'; g.fillRect(X(s.x - s.hx), Z(s.z - s.hz), s.hx * 2 * S, s.hz * 2 * S); g.fillStyle = '#fff'; g.font = 'bold 12px sans-serif'; g.fillText(s.name, X(s.x) - 4, Z(s.z) + 4); }
  g.fillStyle = '#10202e'; for (const b of boxes) g.fillRect(X(b.x0), Z(b.z0), Math.max(1.5, (b.x1 - b.x0) * S), Math.max(1.5, (b.z1 - b.z0) * S));
  if (bomb.state === 'dropped' || bomb.state === 'planted') { g.fillStyle = '#ffc83d'; g.fillRect(X(bomb.x) - 3, Z(bomb.z) - 3, 6, 6); }
  for (const c of chars) {
    if (!c.alive || c.isPlayer) continue;
    if (c.team !== player.team && !(player.alive && canSee(player, c))) continue;
    g.fillStyle = c.team === ATK ? '#ff6a4d' : '#5fb4ff'; g.beginPath(); g.arc(X(c.pos.x), Z(c.pos.z), 3, 0, 6.3); g.fill();
    if (bomb.carrier === c && c.team === player.team) { g.strokeStyle = '#ffc83d'; g.lineWidth = 1.5; g.stroke(); }
  }
  g.save(); g.translate(X(player.pos.x), Z(player.pos.z)); g.rotate(-player.yaw); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, -6); g.lineTo(4, 4); g.lineTo(-4, 4); g.fill(); g.restore();
}
function drawHud(dt) {
  const p = player, id = weaponId(p);
  $('hp').textContent = Math.ceil(p.hp); $('ar').textContent = Math.ceil(p.armor); $('money').textContent = '$' + p.money;
  $('wname').textContent = WEAPONS[id].name + (p.reloadT > 0 ? ' — recarregando' : '');
  $('am').textContent = p.ammo[id] + ' / ' + WEAPONS[id].mag;
  $('sa').textContent = score[ATK]; $('sd').textContent = score[DEF];
  const t = state === 'planted' ? bomb.t : state === 'freeze' ? stateT : roundT, tt = Math.max(0, Math.ceil(t));
  $('timer').textContent = Math.floor(tt / 60) + ':' + String(tt % 60).padStart(2, '0'); $('timer').className = state === 'planted' ? 'bomb' : '';
  if (msgT > 0) { msgT -= dt; if (msgT <= 0) $('msg').textContent = ''; }
  hurtA = Math.max(0, hurtA - dt * 1.5); $('hurt').style.opacity = p.alive ? hurtA : .5;
  hitT -= dt; $('cross').className = 'hud' + (hitT > 0 ? ' hit' : ''); $('cross').hidden = !p.alive || !$('scope').hidden;
  if (feed.length) { let ch = false; for (const f of feed) f.t -= dt; while (feed.length && feed[0].t <= 0) { feed.shift(); ch = true; } if (ch) drawFeed(); }
  if (!$('board').hidden) drawBoard();
  if (buyOpen && !canBuy()) { buyOpen = false; $('buy').hidden = true; }
  drawMini();
}

addEventListener('keydown', e => {
  if (state === 'menu' || state === 'end') return;
  if (['Tab', 'Space', 'KeyB'].includes(e.code) || (buyOpen && e.code.startsWith('Digit'))) e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  if (e.code === 'Tab') { $('board').hidden = false; drawBoard(); }
  if (e.code === 'KeyB') { buyOpen = !buyOpen && canBuy(); $('buy').hidden = !buyOpen; if (buyOpen) drawBuy(); }
  if (e.code.startsWith('Digit')) {
    const n = +e.code.slice(5);
    if (buyOpen) buy(n - 1); else if (n === 1) setWeapon('primary'); else if (n === 2) setWeapon('pistol');
  }
  if (e.code === 'KeyR' && player.alive) startReload(player);
});
addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'Tab') $('board').hidden = true; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseL = mouseR = false; });
const cv = renderer.domElement;
function lock() {
  audioOn(); if (locked) return;
  try { const r = cv.requestPointerLock(); if (r && r.catch) r.catch(() => { freeLook = true; }); } catch (e) { freeLook = true; }
}
document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === cv; });
document.addEventListener('pointerlockerror', () => { freeLook = true; });
root.addEventListener('mousedown', e => {
  if (state === 'menu' || state === 'end') return;
  if (!locked) lock();
  if (e.button === 0) mouseL = true; if (e.button === 2) mouseR = true;
});
addEventListener('mouseup', e => { if (e.button === 0) mouseL = false; if (e.button === 2) mouseR = false; });
root.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mousemove', e => {
  if (!player || !(locked || freeLook) || state === 'menu' || state === 'end') return;
  const s = .0022 * camera.fov / 70;
  player.yaw -= e.movementX * s; player.pitch = clamp(player.pitch - e.movementY * s, -1.3, 1.3);
});

function start(team) {
  audioOn(); $('menu').hidden = true; setupTeams(team); startRound(); lock();
}
$('pickA').onclick = () => start(ATK);
$('pickD').onclick = () => start(DEF);
$('again').onclick = () => location.reload();

// vista aérea para o menu
camera.position.set(-78, 42, 62); camera.lookAt(5, 0, 0);
let last = performance.now(), time = 0;
function sim(dt) {                                   // um passo da simulação (sem desenhar)
  if (state === 'menu' || state === 'end') return;
  updateRound(dt); updatePlayer(dt);
  for (const c of chars) if (!c.isPlayer) updateBot(c, dt);
  updateChars(dt);
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - last) / 1000); last = now; time += dt;
  sea.position.y = -.7 + Math.sin(time * .8) * .08;
  if (state !== 'menu') {
    sim(dt); updateCamera(dt); drawHud(dt);
  } else { const a = time * .05 + 1.1; camera.position.set(-Math.cos(a) * 95, 46, Math.sin(a) * 82); camera.lookAt(5, 0, 0); }
  for (const tr of tracers) if (tr.t > 0) { tr.t -= dt; tr.l.material.opacity = tr.t / .07; if (tr.t <= 0) tr.l.visible = false; }
  for (const sp of sparks) if (sp.t > 0) { sp.t -= dt; if (sp.t <= 0) sp.s.visible = false; }
  if (blast.visible) { blastT += dt; blast.scale.setScalar(1 + blastT * 22); blast.material.opacity = Math.max(0, 1 - blastT / 1.2); if (blastT > 1.2) blast.visible = false; }
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// ganchos para testes automatizados
window.__game = { chars, bomb, score, get state() { return state; }, get player() { return player; }, findPath, start, sim, keys, get bombT() { return bomb.t; } };
})();

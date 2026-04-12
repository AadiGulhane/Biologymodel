"use strict";
/* BioSolarLab · script.js · Final
   Main 3D sim: Three.js, orbit controls, Fresnel+Beer-Lambert physics
   Micro sim:   Canvas 2D, front view, thick bright rays, no depth issues
*/
document.addEventListener('DOMContentLoaded', function () {

/* ═══════════════════════════════════════════════════════════════
   §1  MAIN RENDERER + SCENE
═══════════════════════════════════════════════════════════════ */
const container = document.getElementById('threeContainer');
function sz() { return { w: container.clientWidth || 800, h: container.clientHeight || 500 }; }
let { w: W, h: H } = sz();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(W, H);
renderer.setClearColor(0x020408, 1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
// Mild fog — does NOT affect rays (depthTest:false bypasses fog clipping)
scene.fog = new THREE.FogExp2(0x030610, 0.006);

const camera = new THREE.PerspectiveCamera(50, W / H, 0.001, 500);

// Scene lighting — balanced, not overexposed
scene.add(new THREE.HemisphereLight(0x0f1d40, 0x040608, 0.40));
scene.add(new THREE.AmbientLight(0x0a1020, 0.28));

const keyLight = new THREE.DirectionalLight(0x4070cc, 0.52);
keyLight.position.set(-6, 16, 5);
keyLight.castShadow = true;
keyLight.shadow.camera.left   = -22; keyLight.shadow.camera.right = 22;
keyLight.shadow.camera.bottom = -22; keyLight.shadow.camera.top   = 22;
keyLight.shadow.mapSize.set(1024, 1024);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x002040, 0.25);
rimLight.position.set(14, 3, -6);
scene.add(rimLight);

/* ═══════════════════════════════════════════════════════════════
   §2  ORBIT CONTROLS
═══════════════════════════════════════════════════════════════ */
let oT = 0.05, oP = 1.06, oR = 32;
const OC = new THREE.Vector3(0, 1.0, 0);
const P_LO = 0.05, P_HI = 1.55, R_LO = 0.8, R_HI = 80;

function camUpdate() {
  camera.position.set(
    OC.x + oR * Math.sin(oP) * Math.sin(oT),
    OC.y + oR * Math.cos(oP),
    OC.z + oR * Math.sin(oP) * Math.cos(oT)
  );
  camera.lookAt(OC);
}
camUpdate();

function panTarget(dx, dy) {
  const spd = oR * 0.0012;
  const right = new THREE.Vector3();
  right.crossVectors(new THREE.Vector3(0,1,0), camera.position.clone().sub(OC).normalize()).normalize();
  const fwd = OC.clone().sub(camera.position).normalize();
  const up  = new THREE.Vector3().crossVectors(right, fwd).normalize();
  OC.addScaledVector(right, -dx * spd);
  OC.addScaledVector(up,     dy * spd);
  camUpdate();
}

let dragMode = 'none', lmx = 0, lmy = 0;
container.addEventListener('mousedown', e => {
  e.preventDefault(); lmx = e.clientX; lmy = e.clientY;
  dragMode = (e.button === 2 || e.button === 1) ? 'pan' : 'orbit';
});
container.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('mousemove', e => {
  if (dragMode === 'none') return;
  const dx = e.clientX - lmx, dy = e.clientY - lmy;
  if (dragMode === 'orbit') {
    oT -= dx * 0.006;
    oP  = Math.max(P_LO, Math.min(P_HI, oP + dy * 0.006));
    camUpdate();
  } else { panTarget(dx, dy); }
  lmx = e.clientX; lmy = e.clientY;
});
window.addEventListener('mouseup', () => { dragMode = 'none'; });
container.addEventListener('wheel', e => {
  e.preventDefault();
  oR = Math.max(R_LO, Math.min(R_HI, oR + e.deltaY * 0.018));
  camUpdate();
}, { passive: false });

let td = 0, tpx = 0, tpy = 0;
container.addEventListener('touchstart', e => {
  if (e.touches.length === 1) { dragMode = 'orbit'; lmx = e.touches[0].clientX; lmy = e.touches[0].clientY; }
  if (e.touches.length === 2) {
    dragMode = 'pan';
    td  = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
    tpx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    tpy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
  }
}, { passive: true });
container.addEventListener('touchmove', e => {
  if (e.touches.length === 1 && dragMode === 'orbit') {
    oT -= (e.touches[0].clientX - lmx) * 0.006;
    oP  = Math.max(P_LO, Math.min(P_HI, oP + (e.touches[0].clientY - lmy) * 0.006));
    lmx = e.touches[0].clientX; lmy = e.touches[0].clientY; camUpdate();
  }
  if (e.touches.length === 2) {
    const d  = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
    const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    oR = Math.max(R_LO, Math.min(R_HI, oR - (d - td) * 0.04));
    panTarget(mx - tpx, my - tpy);
    td = d; tpx = mx; tpy = my; camUpdate();
  }
}, { passive: true });
container.addEventListener('touchend', () => { dragMode = 'none'; }, { passive: true });
container.addEventListener('dblclick', () => {
  oT = 0.05; oP = 1.06; oR = 32; OC.set(0, 1.0, 0); camUpdate();
  microMode = false;
  const b = document.getElementById('btnMicro');
  if (b) { b.classList.remove('active'); b.textContent = 'Micro View'; }
});

/* ═══════════════════════════════════════════════════════════════
   §3  BACKGROUND
═══════════════════════════════════════════════════════════════ */
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(160, 160),
  new THREE.MeshStandardMaterial({ color: 0x03050c, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2; ground.position.y = -2.0;
ground.receiveShadow = true; scene.add(ground);

const grid = new THREE.GridHelper(80, 48, 0x060a20, 0x040714);
grid.position.y = -1.98; scene.add(grid);

// Stars
(function () {
  const N = 400, pos = new Float32Array(N * 3);
  let s = 0xC0FFEE;
  const lcg = () => { s = (s * 1664525 + 1013904223) & 0xFFFFFFFF; return (s >>> 0) / 0x100000000; };
  for (let i = 0; i < N; i++) { pos[i*3] = lcg()*140-70; pos[i*3+1] = lcg()*55+10; pos[i*3+2] = -(lcg()*70+25); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.06, transparent: true, opacity: 0.55 })));
}());

/* ═══════════════════════════════════════════════════════════════
   §4  SUN
═══════════════════════════════════════════════════════════════ */
function makeSunTex(sz, stops) {
  const cv = document.createElement('canvas'); cv.width = cv.height = sz;
  const ctx = cv.getContext('2d'), cx = sz / 2;
  const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
  stops.forEach(([t, c]) => g.addColorStop(t, c));
  ctx.fillStyle = g; ctx.fillRect(0, 0, sz, sz);
  return new THREE.CanvasTexture(cv);
}

const sunGroup = new THREE.Group(); scene.add(sunGroup);

const coronaSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: makeSunTex(512, [[0,'rgba(255,255,230,0)'],[0.15,'rgba(255,220,50,.15)'],[0.4,'rgba(255,150,20,.20)'],[0.65,'rgba(255,90,5,.12)'],[0.85,'rgba(200,50,0,.05)'],[1,'rgba(0,0,0,0)']]),
  blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true
}));
coronaSprite.scale.set(40, 40, 1); sunGroup.add(coronaSprite);

const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: makeSunTex(256, [[0,'rgba(255,255,240,1)'],[0.1,'rgba(255,255,200,.95)'],[0.25,'rgba(255,230,80,.8)'],[0.45,'rgba(255,180,20,.5)'],[0.65,'rgba(255,110,10,.22)'],[0.85,'rgba(200,50,0,.07)'],[1,'rgba(0,0,0,0)']]),
  blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true
}));
glowSprite.scale.set(18, 18, 1); sunGroup.add(glowSprite);

const coreSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: makeSunTex(128, [[0,'rgba(255,255,255,1)'],[0.2,'rgba(255,255,220,1)'],[0.5,'rgba(255,240,120,.85)'],[0.75,'rgba(255,200,40,.4)'],[1,'rgba(0,0,0,0)']]),
  blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true
}));
coreSprite.scale.set(6, 6, 1); sunGroup.add(coreSprite);

const spkMat = new THREE.LineBasicMaterial({ color: 0xffdd44, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
let spikeAngle = 0;
for (let si = 0; si < 12; si++) {
  const ang = (si / 12) * Math.PI * 2;
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(Math.cos(ang) * 2.5, Math.sin(ang) * 2.5, 0),
    new THREE.Vector3(Math.cos(ang) * 6.0, Math.sin(ang) * 6.0, 0),
  ]);
  sunGroup.add(new THREE.Line(geo, spkMat));
}

const sunPL = new THREE.PointLight(0xfff0cc, 2.2, 120, 1.2);
sunGroup.add(sunPL);

function moveSun(deg) {
  const rad = deg * Math.PI / 180, D = 28;
  sunGroup.position.set(-Math.sin(rad) * D * 0.85, Math.cos(rad) * D * 0.5 + 7.0, -16);
}

/* ═══════════════════════════════════════════════════════════════
   §5  PANELS
═══════════════════════════════════════════════════════════════ */
const PW = 9.0, PD = 5.5, SEP = 7.0;
const FLAT_CX = -(PW / 2 + SEP / 2);
const BFLY_CX =  (PW / 2 + SEP / 2);

function makeLabel(text, hexCol) {
  const cw = 800, ch = 80, cv = document.createElement('canvas');
  cv.width = cw; cv.height = ch;
  const ctx = cv.getContext('2d');
  const hx = '#' + hexCol.toString(16).padStart(6, '0');
  ctx.fillStyle = 'rgba(3,5,14,0.82)';
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(4, 4, cw-8, ch-8, 10); ctx.fill(); }
  else { ctx.fillRect(4, 4, cw-8, ch-8); }
  ctx.strokeStyle = hx; ctx.lineWidth = 3;
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(4, 4, cw-8, ch-8, 10); ctx.stroke(); }
  else { ctx.strokeRect(4, 4, cw-8, ch-8); }
  ctx.fillStyle = hx; ctx.font = 'bold 46px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,.95)'; ctx.shadowBlur = 8;
  ctx.fillText(text, cw / 2, ch / 2);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
  spr.scale.set(9.0, 1.0, 1);
  return spr;
}

function makePedestal(w, d, color) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.55, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.45, emissive: color, emissiveIntensity: 0.04 })
  );
  m.castShadow = m.receiveShadow = true;
  return m;
}

/* FLAT PANEL */
const flatGroup = new THREE.Group();
flatGroup.position.set(FLAT_CX, 0, 0);
scene.add(flatGroup);

const fPed = makePedestal(PW + 1.0, PD + 1.0, 0x0a1828);
fPed.position.y = -0.575; flatGroup.add(fPed);

const flatBody = new THREE.Mesh(
  new THREE.BoxGeometry(PW, 0.30, PD),
  new THREE.MeshStandardMaterial({ color: 0x0b2240, roughness: 0.30, metalness: 0.85, emissive: 0x001e36, emissiveIntensity: 0.28, transparent: true, opacity: 0.92, depthWrite: false })
);
flatBody.position.y = -0.15; flatBody.castShadow = true; flatGroup.add(flatBody);

const flatSurf = new THREE.Mesh(
  new THREE.PlaneGeometry(PW, PD),
  new THREE.MeshStandardMaterial({ color: 0x00ccff, emissive: 0x009fcc, emissiveIntensity: 0.32, roughness: 0.03, metalness: 0.96, transparent: true, opacity: 0.90, depthWrite: false })
);
flatSurf.rotation.x = -Math.PI / 2; flatSurf.position.y = 0.002; flatSurf.renderOrder = 1; flatGroup.add(flatSurf);

(function buildCells() {
  const cols = 8, rows = 5, cw = PW / cols, cd = PD / rows;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const lv = ((c * 7 + r * 13) % 17) / 17, blue = 0.04 + lv * 0.09;
      const cell = new THREE.Mesh(
        new THREE.PlaneGeometry(cw - 0.06, cd - 0.05),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(0.01, 0.10 + blue, 0.20 + blue * 1.4),
          roughness: 0.08, metalness: 0.92,
          emissive: new THREE.Color(0, blue * 0.22, blue * 0.38), emissiveIntensity: 0.55,
          transparent: true, opacity: 0.88, depthWrite: false
        })
      );
      cell.rotation.x = -Math.PI / 2;
      cell.position.set(-PW/2 + (c+0.5)*cw, 0.004, -PD/2 + (r+0.5)*cd);
      cell.renderOrder = 2; flatGroup.add(cell);
    }
  }
  const bm = new THREE.MeshBasicMaterial({ color: 0xc8d4e8, depthWrite: false });
  [0.22, 0.50, 0.78].forEach(t => {
    const bus = new THREE.Mesh(new THREE.BoxGeometry(PW - 0.1, 0.004, 0.06), bm);
    bus.position.set(0, 0.006, -PD/2 + t*PD); bus.renderOrder = 3; flatGroup.add(bus);
  });
  const fm = new THREE.MeshBasicMaterial({ color: 0x6088a8, transparent: true, opacity: 0.45, depthWrite: false });
  for (let c = 1; c < cols; c++) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.003, PD - 0.1), fm);
    f.position.set(-PW/2 + c*cw, 0.005, 0); f.renderOrder = 3; flatGroup.add(f);
  }
}());

const fEdge = new THREE.Mesh(new THREE.BoxGeometry(PW, 0.048, 0.06), new THREE.MeshBasicMaterial({ color: 0x00d4ff }));
fEdge.position.set(0, 0.004, PD / 2); flatGroup.add(fEdge);

const flatLabel = makeLabel('FLAT SOLAR PANEL', 0x00d4ff);
flatLabel.position.set(0, 3.4, 0); flatGroup.add(flatLabel);

/* BUTTERFLY PANEL */
const bflyGroup = new THREE.Group();
bflyGroup.position.set(BFLY_CX, 0, 0);
scene.add(bflyGroup);

const bPed = makePedestal(PW + 1.0, PD + 1.0, 0x140330);
bPed.position.y = -0.575; bflyGroup.add(bPed);

let bflyMeshes = [];
let bflyGeom   = { RH: 0.60, RS: 1.10, RW: 0.792, WALL: 0.154, nanoGroup: null };

function buildButterflyPanel(ridgeH_um, ridgeS_um) {
  bflyMeshes.forEach(m => bflyGroup.remove(m));
  bflyMeshes = [];

  const RH   = Math.max(0.28, Math.min(ridgeH_um * 0.08, 1.4));
  const RS   = Math.max(0.42, Math.min(ridgeS_um * 0.11, 1.7));
  const RW   = RS * 0.72;
  const WALL = (RS - RW) * 0.5;
  const CNT  = Math.floor(PW / RS);
  bflyGeom   = { RH, RS, RW, WALL, CNT, nanoGroup: null };

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(PW, 0.20, PD),
    new THREE.MeshStandardMaterial({ color: 0x0e0228, roughness: 0.42, metalness: 0.70, emissive: 0x080118, emissiveIntensity: 0.28, transparent: true, opacity: 0.88, depthWrite: false })
  );
  base.position.y = -0.10; base.castShadow = true;
  bflyGroup.add(base); bflyMeshes.push(base);

  const fl = new THREE.Mesh(
    new THREE.PlaneGeometry(PW, PD),
    new THREE.MeshStandardMaterial({ color: 0xb040ff, emissive: 0xb040ff, emissiveIntensity: 0.14, transparent: true, opacity: 0.22, depthWrite: false })
  );
  fl.rotation.x = -Math.PI / 2; fl.position.y = 0.003; fl.renderOrder = 1;
  bflyGroup.add(fl); bflyMeshes.push(fl);

  let seed = 0xA7B3C9;
  const lcg = () => { seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF; return (seed >>> 0) / 0x100000000; };

  const SPINE_W  = Math.max(0.07, WALL * 0.80);
  const N_SPINE  = CNT + 1;
  const N_LEVELS = 9;
  const N_ZSEG   = 5;
  const RIB_H    = 0.030;
  const RIB_DZ   = 0.036;

  const spineMat = new THREE.MeshStandardMaterial({ color: 0x1e0440, roughness: 0.10, metalness: 0.96, emissive: 0x160330, emissiveIntensity: 0.44, transparent: true, opacity: 0.88, depthWrite: false });
  const ribMat   = new THREE.MeshStandardMaterial({ color: 0x2e0660, roughness: 0.14, metalness: 0.92, emissive: 0x1e0448, emissiveIntensity: 0.38, transparent: true, opacity: 0.80, depthWrite: false });
  const capMat   = new THREE.MeshBasicMaterial({ color: 0xcc55ff, transparent: true, opacity: 0.90, blending: THREE.AdditiveBlending, depthWrite: false });

  for (let si = 0; si < N_SPINE; si++) {
    const sx = -PW / 2 + si * RS;
    if (Math.abs(sx) > PW / 2 + 0.1) continue;
    const spine = new THREE.Mesh(new THREE.BoxGeometry(SPINE_W, RH, PD), spineMat);
    spine.position.set(sx, RH / 2, 0); spine.castShadow = true;
    bflyGroup.add(spine); bflyMeshes.push(spine);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(SPINE_W + 0.05, 0.06, PD), capMat);
    cap.position.set(sx, RH + 0.03, 0); cap.renderOrder = 5;
    bflyGroup.add(cap); bflyMeshes.push(cap);
  }

  for (let si = 0; si < N_SPINE - 1; si++) {
    const x1 = -PW / 2 + si * RS;
    const x2 = x1 + RS;
    if (Math.abs((x1 + x2) / 2) > PW / 2 + 0.15) continue;
    const gapW  = RS - SPINE_W;
    const ribLen = gapW - 0.03;
    if (ribLen < 0.04) continue;
    const cx    = (x1 + x2) / 2;
    const zStep = PD / N_ZSEG;

    for (let zi = 0; zi < N_ZSEG; zi++) {
      const zCen = -PD / 2 + (zi + 0.5) * zStep;
      for (let l = 0; l < N_LEVELS; l++) {
        const baseY = (l + 0.5) / N_LEVELS * RH;
        const jit   = (lcg() - 0.5) * RH * 0.10;
        const ry    = Math.max(0.04, Math.min(RH - 0.04, baseY + jit));
        const xRib  = new THREE.Mesh(new THREE.BoxGeometry(ribLen, RIB_H, RIB_DZ), ribMat);
        xRib.position.set(cx, ry, zCen); xRib.renderOrder = 4;
        bflyGroup.add(xRib); bflyMeshes.push(xRib);
      }
      if (zi < N_ZSEG - 1) {
        const zB = -PD / 2 + (zi + 1) * zStep;
        for (let k = 0; k < 3; k++) {
          const xOff = (k / 2 - 0.5) * gapW * 0.60;
          const zry  = RH * (0.15 + lcg() * 0.70);
          const zRib = new THREE.Mesh(new THREE.BoxGeometry(RIB_DZ, RIB_H, zStep), ribMat);
          zRib.position.set(cx + xOff, zry, zB - zStep / 2); zRib.renderOrder = 4;
          bflyGroup.add(zRib); bflyMeshes.push(zRib);
        }
      }
    }
  }

  const be = new THREE.Mesh(new THREE.BoxGeometry(PW, 0.048, 0.06), new THREE.MeshBasicMaterial({ color: 0xb44fff }));
  be.position.set(0, 0.004, PD / 2);
  bflyGroup.add(be); bflyMeshes.push(be);

  const nanoGroup = new THREE.Group();
  nanoGroup.visible = false;
  bflyGroup.add(nanoGroup); bflyMeshes.push(nanoGroup);
  const nMat = new THREE.MeshBasicMaterial({ color: 0xaa44ee, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let si = 0; si < N_SPINE - 1; si++) {
    const x1 = -PW / 2 + si * RS, x2 = x1 + RS;
    if (Math.abs((x1+x2)/2) > PW/2 + 0.15) continue;
    const cx2 = (x1+x2)/2, gW = RS - SPINE_W;
    for (let s = 0; s < 6; s++) {
      const nr = new THREE.Mesh(new THREE.BoxGeometry(gW * 0.82, 0.011, PD * 0.92), nMat);
      nr.position.set(cx2, (s + 0.5) / 6 * RH, 0); nr.renderOrder = 8; nanoGroup.add(nr);
    }
  }
  bflyGeom.nanoGroup = nanoGroup;
}
buildButterflyPanel(5, 10);

const bflyLabel = makeLabel('BUTTERFLY WING PANEL', 0xb44fff);
bflyLabel.position.set(0, 3.4, 0); bflyGroup.add(bflyLabel);

// Zoom labels
function makeZoomLabel(text, col) {
  const cw = 640, ch = 56, cv = document.createElement('canvas');
  cv.width = cw; cv.height = ch;
  const ctx = cv.getContext('2d');
  const hx = '#' + col.toString(16).padStart(6, '0');
  ctx.fillStyle = 'rgba(2,4,12,.82)'; ctx.fillRect(0, 0, cw, ch);
  ctx.strokeStyle = hx; ctx.lineWidth = 2; ctx.strokeRect(2, 2, cw-4, ch-4);
  ctx.fillStyle = hx; ctx.font = 'bold 26px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, cw/2, ch/2);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, opacity: 0.9 }));
  spr.scale.set(6, 0.60, 1); return spr;
}
const zoomLabelFlat = makeZoomLabel('Micro-Scale: Flat Silicon Surface', 0x00d4ff);
zoomLabelFlat.position.set(0, 2.5, 0); zoomLabelFlat.visible = false; flatGroup.add(zoomLabelFlat);
const zoomLabelBfly = makeZoomLabel('Micro-Scale: Morpho Lattice', 0xb44fff);
zoomLabelBfly.position.set(0, 2.5, 0); zoomLabelBfly.visible = false; bflyGroup.add(zoomLabelBfly);

/* Surface mode toggle */
let surfaceMode = 'morpho';

const flatBflyOverlay = new THREE.Mesh(
  new THREE.BoxGeometry(PW, 0.030, PD),
  new THREE.MeshStandardMaterial({ color: 0x00aacc, emissive: 0x006688, emissiveIntensity: 0.40, roughness: 0.04, metalness: 0.97, transparent: true, opacity: 0.94, depthWrite: false })
);
flatBflyOverlay.position.set(0, 0.015, 0); flatBflyOverlay.renderOrder = 2;
flatBflyOverlay.visible = false; bflyGroup.add(flatBflyOverlay);

function applySurfaceMode() {
  const isMorpho = surfaceMode === 'morpho';
  bflyMeshes.forEach(m => { m.visible = isMorpho; });
  flatBflyOverlay.visible = !isMorpho;
  const btn = document.getElementById('surfaceModeBtn');
  if (btn) { btn.textContent = isMorpho ? 'Switch to Flat Panel' : 'Switch to Morpho'; btn.classList.toggle('active', !isMorpho); }
  const desc = document.getElementById('surfaceModeDesc');
  if (desc) desc.innerHTML = isMorpho
    ? 'Currently showing the <strong>Morpho butterfly nanostructure</strong> — multi-bounce light trapping enabled.'
    : 'Currently showing a <strong>flat silicon panel</strong> on the right — no nanostructure, single-bounce only.';
  const pname = document.getElementById('bflyPanelName');
  if (pname) pname.textContent = isMorpho ? 'Butterfly Wing Panel' : 'Flat Panel (No Structure)';
  const rl = document.getElementById('bflyResLabel');
  if (rl) rl.textContent = isMorpho ? 'Butterfly Panel' : 'Flat Panel (Right)';
}

/* ═══════════════════════════════════════════════════════════════
   §6  PHYSICS
═══════════════════════════════════════════════════════════════ */
const N_AIR = 1.000, N_SI = 3.500, ALPHA_BASE = 5.0, D_FLAT = 0.30;
const SOLAR_SPREAD = 0.5, RAY_START_Y = 9.5, MARGIN = 0.30, MAX_BFLY_B = 10;

function fresnelR(cosI, n1, n2) {
  const si2 = Math.max(0, 1 - cosI * cosI), st2 = (n1/n2)*(n1/n2)*si2;
  if (st2 >= 1) return 1.0;
  const ct = Math.sqrt(1 - st2);
  const Rs = ((n1*cosI - n2*ct) / (n1*cosI + n2*ct)) ** 2;
  const Rp = ((n2*cosI - n1*ct) / (n2*cosI + n1*ct)) ** 2;
  return (Rs + Rp) * 0.5;
}

function murmur01(a, b) {
  let h = ((a * 0x9e3779b9) ^ (b * 0x6c62272e)) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16; return (h >>> 0) / 0x100000000;
}

function traceFlatRay(ix, nRays, sunDeg, intensity, panelCX) {
  const pcx  = panelCX !== undefined ? panelCX : FLAT_CX;
  const frac = nRays > 1 ? ix / (nRays - 1) : 0.5;
  const rad  = (sunDeg + SOLAR_SPREAD * (frac - 0.5)) * Math.PI / 180;
  const rdx  = Math.sin(rad), cosI = Math.max(0.001, Math.cos(rad));
  const hitX = pcx - PW/2 + MARGIN + frac * (PW - 2*MARGIN);
  const entX = hitX - rdx * (RAY_START_Y / cosI);
  const entZ = -PD/2 + 0.35 + frac * (PD - 0.70);
  const R    = fresnelR(cosI, N_AIR, N_SI);
  const sinT2 = (N_AIR/N_SI)**2 * (1 - cosI*cosI);
  const cosT  = Math.sqrt(Math.max(0, 1 - sinT2));
  const rdxSi = (N_AIR/N_SI) * rdx;
  const alpha  = ALPHA_BASE * Math.max(0.2, intensity);
  const pathLen = D_FLAT / Math.max(0.001, cosT);
  const P_abs   = 1 - Math.exp(-alpha * pathLen);
  const ticket  = (ix + 0.5) / nRays;

  const v = (x, y) => new THREE.Vector3(x, y, entZ);
  if (ticket < R)
    return { path: [v(entX,RAY_START_Y), v(hitX,0.01), v(hitX+rdx*6, cosI*6)], outcome: 'reflected' };
  if (ticket < R + (1-R)*P_abs) {
    const u = Math.max(1e-9, (ticket - R) / Math.max(1e-9, (1-R)*P_abs));
    const depth = Math.min(-Math.log(1 - u * P_abs) / alpha, pathLen);
    return { path: [v(entX,RAY_START_Y), v(hitX,0.01), v(hitX+rdxSi*depth, -cosT*depth)], outcome: 'absorbed' };
  }
  const bx = hitX + rdxSi * pathLen;
  return { path: [v(entX,RAY_START_Y), v(hitX,0.01), v(bx,-D_FLAT), v(bx+rdx*1.6,-D_FLAT-1.4)], outcome: 'transmitted' };
}

function traceButterflyRay(ix, nRays, sunDeg, intensity) {
  const { RH, RS, RW } = bflyGeom;
  const frac  = nRays > 1 ? ix / (nRays - 1) : 0.5;
  const rad   = (sunDeg + SOLAR_SPREAD * (frac - 0.5)) * Math.PI / 180;
  const rdx0  = Math.sin(rad), cosI0 = Math.max(0.001, Math.cos(rad)), rdy0 = -cosI0;
  const hitX  = BFLY_CX - PW/2 + MARGIN + frac * (PW - 2*MARGIN);
  const entX  = hitX - rdx0 * ((RAY_START_Y - RH) / cosI0);
  const entZ  = -PD/2 + 0.35 + frac * (PD - 0.70);
  const v = (x, y) => new THREE.Vector3(x, y, entZ);
  const path = [v(entX, RAY_START_Y), v(hitX, RH)];
  const pL   = BFLY_CX - PW / 2;
  const vi   = Math.floor((hitX - pL) / RS);
  const vCen = pL + (vi + 0.5) * RS;
  const vL   = vCen - RW / 2, vR = vCen + RW / 2;
  let cx = hitX, cy = RH, dx = rdx0, dy = rdy0, avL = vL, avR = vR;

  if (hitX < vL || hitX > vR) {
    const lVC = pL + (vi + 0.5) * RS, rVC = pL + (vi + 1 + 0.5) * RS;
    const rC  = (lVC + RW/2 + rVC - RW/2) * 0.5;
    const onL = hitX < rC;
    const nX  = onL ? 0.70711 : -0.70711, nY = 0.70711;
    const cIs = Math.max(0.001, Math.abs(rdx0 * nX + rdy0 * nY));
    path.push(v(cx, cy));
    if (murmur01(ix, 0) < fresnelR(cIs, N_AIR, N_SI)) {
      const dN = rdx0 * nX + rdy0 * nY;
      dx = rdx0 - 2*dN*nX; dy = rdy0 - 2*dN*nY;
      if (dy > 0.05) { path.push(v(cx+dx*3, cy+Math.abs(dy)*3)); return { path, outcome: 'reflected', bounces: 0 }; }
      avL = (onL ? lVC : rVC) - RW/2; avR = (onL ? lVC : rVC) + RW/2;
      cx  = Math.max(avL + 1e-5, Math.min(avR - 1e-5, cx));
    } else { return { path, outcome: 'absorbed', bounces: 0 }; }
  }

  for (let b = 0; b < MAX_BFLY_B; b++) {
    const tL  = (dx < 0 && cx > avL + 1e-8) ? (avL - cx) / dx : Infinity;
    const tR  = (dx > 0 && cx < avR - 1e-8) ? (avR - cx) / dx : Infinity;
    const tF  = (dy < 0 && cy > 1e-8) ? -cy / dy : Infinity;
    const tT  = (dy > 0 && cy < RH - 1e-8) ? (RH - cy) / dy : Infinity;
    const tMn = Math.min(tL, tR, tF, tT);
    if (!isFinite(tMn) || tMn < 1e-9) break;
    cx += dx * tMn; cy = Math.max(0, Math.min(RH, cy + dy * tMn));
    path.push(v(cx, cy));
    if (Math.abs(tMn - tF) < 1e-7) {
      if (murmur01(ix, b+50) >= fresnelR(Math.max(0.001, Math.abs(dy)), N_AIR, N_SI))
        return { path, outcome: 'absorbed', bounces: b };
      dy = -dy;
    } else if (Math.abs(tMn - tT) < 1e-7 && dy > 0) {
      path.push(v(cx+dx*3.5, cy+cosI0*3.5)); return { path, outcome: 'reflected', bounces: b };
    } else {
      if (murmur01(ix, b+1) >= fresnelR(Math.max(0.001, Math.abs(dx)), N_AIR, N_SI))
        return { path, outcome: 'absorbed', bounces: b+1 };
      dx = -dx;
    }
  }
  return { path, outcome: 'absorbed', bounces: MAX_BFLY_B };
}

function runPhysics(p) {
  const { sunAngle: sa, numRays: n, ridgeHeight: rh, ridgeSpacing: rs, intensity: it } = p;
  buildButterflyPanel(rh, rs);
  let fAbs=0,fRefl=0,fTrans=0, bAbs=0,bRefl=0,bTrans=0;
  const flatRays=[], bflyRays=[];
  for (let i = 0; i < n; i++) {
    const fr = traceFlatRay(i, n, sa, it); flatRays.push(fr);
    if (fr.outcome==='absorbed') fAbs++; else if (fr.outcome==='reflected') fRefl++; else fTrans++;
    const br = (surfaceMode === 'flat') ? traceFlatRay(i, n, sa, it, BFLY_CX) : traceButterflyRay(i, n, sa, it);
    bflyRays.push(br);
    if (br.outcome==='absorbed') bAbs++; else if (br.outcome==='reflected') bRefl++; else bTrans++;
  }
  // Publish shared stats for microsim
  window.rayStats = { flatAbs:fAbs/n, flatRefl:fRefl/n, flatTrans:fTrans/n, bflyAbs:bAbs/n, bflyRefl:bRefl/n, bflyTrans:bTrans/n };
  return { flatRays, bflyRays, fAbs, fRefl, fTrans, bAbs, bRefl, bTrans,
    flatEff: fAbs/n, bflyEff: bAbs/n, gain: (bAbs-fAbs)/n,
    flatAbsorbed:fAbs, flatReflected:fRefl, flatTransmitted:fTrans,
    bflyAbsorbed:bAbs, bflyReflected:bRefl, bflyTransmitted:bTrans };
}

/* ═══════════════════════════════════════════════════════════════
   §7  RAY VISUALIZATION — depthTest:false everywhere
═══════════════════════════════════════════════════════════════ */
const rayGroup = new THREE.Group(); scene.add(rayGroup);
let animRays = [];

function segColor(outcome, segIdx, N) {
  if (segIdx === 0) return 0xffffcc;
  if (segIdx === 1) return 0xffee00;
  if (segIdx < N - 1) return 0xff8800;
  if (outcome === 'absorbed')    return 0x00ff88;
  if (outcome === 'transmitted') return 0x00ccff;
  return 0xff3322;
}

function makeRayMat(col, glow) {
  if (glow) return new THREE.LineBasicMaterial({ color: col, depthTest: false, depthWrite: false, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending });
  return new THREE.LineBasicMaterial({ color: col, depthTest: false, depthWrite: false, transparent: true, opacity: 1.0 });
}

function buildRayLines(data) {
  for (let k = animRays.length - 1; k >= 0; k--) {
    const o = animRays[k];
    if (o.segs) o.segs.forEach(s => { s.geo.dispose(); s.mat.dispose(); s.gMat.dispose(); rayGroup.remove(s.line); rayGroup.remove(s.gLine); });
    if (o.photon) { o.photon.geometry.dispose(); o.photon.material.dispose(); rayGroup.remove(o.photon); }
    if (o.dots)   o.dots.forEach(d => { if(d){d.geometry.dispose();d.material.dispose();rayGroup.remove(d);} });
    if (o.burst)  { o.burst.geometry.dispose(); o.burst.material.dispose(); rayGroup.remove(o.burst); }
  }
  animRays = [];

  const allRays = data.flatRays.concat(data.bflyRays);
  const nPer    = data.flatRays.length;
  const STAGGER = 0.18;

  for (let ri = 0; ri < allRays.length; ri++) {
    const ray = allRays[ri];
    const pts = ray.path.map(p => new THREE.Vector3(p.x, Math.max(p.y, -(D_FLAT + 0.1)), p.z));
    const N   = pts.length;
    if (N < 2) continue;

    const segs = [];
    for (let si = 0; si < N - 1; si++) {
      const col = segColor(ray.outcome, si, N);
      const buf  = new Float32Array([pts[si].x, pts[si].y, pts[si].z, pts[si].x, pts[si].y, pts[si].z]);
      const attr = new THREE.BufferAttribute(buf, 3); attr.setUsage(THREE.DynamicDrawUsage);
      const geo  = new THREE.BufferGeometry(); geo.setAttribute('position', attr);
      const mat  = makeRayMat(col, false);
      const gMat = makeRayMat(col, true);
      const line  = new THREE.Line(geo, mat);  line.visible  = false; line.renderOrder  = 999; rayGroup.add(line);
      const gLine = new THREE.Line(geo, gMat); gLine.visible = false; gLine.renderOrder = 998; rayGroup.add(gLine);
      segs.push({ geo, attr, buf, mat, gMat, line, gLine, p0: pts[si].clone(), p1: pts[si+1].clone() });
    }

    const photon = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false })
    );
    photon.visible = false; photon.renderOrder = 1001; rayGroup.add(photon);

    const dots = [];
    for (let pi = 1; pi < N; pi++) {
      const isEnd = pi === N - 1;
      const dcol  = isEnd ? (ray.outcome==='absorbed'?0x00ff88:ray.outcome==='transmitted'?0x00ccff:0xff3322) : (pi===1?0xffd700:0xff8800);
      const dr    = isEnd ? 0.14 : (pi===1 ? 0.10 : 0.08);
      const dot   = new THREE.Mesh(
        new THREE.SphereGeometry(dr, 7, 7),
        new THREE.MeshBasicMaterial({ color: dcol, transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      dot.position.copy(pts[pi]); dot.renderOrder = 997;
      dot.userData.pi = pi; rayGroup.add(dot); dots.push(dot);
    }

    let burst = null;
    if (ray.outcome === 'absorbed' || ray.outcome === 'transmitted') {
      const bc = ray.outcome === 'absorbed' ? 0x00ff88 : 0x00ccff;
      burst = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 10, 10),
        new THREE.MeshBasicMaterial({ color: bc, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false })
      );
      burst.position.copy(pts[N-1]); burst.renderOrder = 996; rayGroup.add(burst);
    }

    const localIdx = ri % nPer;
    const tStart   = (localIdx / Math.max(nPer - 1, 1)) * STAGGER;
    animRays.push({ segs, pts, photon, dots, burst, N, tStart, tEnd: tStart + (1 - STAGGER), outcome: ray.outcome, bounces: ray.bounces || 0 });
  }
}

function tickRay(ar, t) {
  const p = (t - ar.tStart) / Math.max(ar.tEnd - ar.tStart, 0.001);
  if (p <= 0) { ar.segs.forEach(s => { s.line.visible = s.gLine.visible = false; }); ar.photon.visible = false; return; }
  const prog = Math.min(1, p);

  if (prog >= 1.0) {
    ar.segs.forEach(s => {
      s.buf[3] = s.p1.x; s.buf[4] = s.p1.y; s.buf[5] = s.p1.z;
      s.attr.needsUpdate = true; s.line.visible = s.gLine.visible = true;
    });
    ar.photon.visible = false;
    if (ar.burst) { ar.burst.material.opacity = 0.65; ar.burst.scale.setScalar(2.5); }
    if (ar.dots) ar.dots.forEach(d => { d.material.opacity = 0.90; });
    return;
  }

  const headR = Math.max(0.05, Math.min(0.24, oR * 0.0035 + 0.07));
  if (ar.photon.geometry.parameters && ar.photon.geometry.parameters.radius !== headR) {
    ar.photon.geometry.dispose();
    ar.photon.geometry = new THREE.SphereGeometry(headR, 8, 8);
  }

  const nSegs = ar.segs.length;
  const draw  = prog * nSegs;
  const curSeg = Math.floor(draw);
  const segFrac = draw - curSeg;

  ar.segs.forEach((s, si) => {
    if (si < curSeg) {
      s.buf[3] = s.p1.x; s.buf[4] = s.p1.y; s.buf[5] = s.p1.z;
      s.attr.needsUpdate = true; s.line.visible = s.gLine.visible = true;
    } else if (si === curSeg && si < nSegs) {
      const tx = s.p0.x + (s.p1.x - s.p0.x) * segFrac;
      const ty = s.p0.y + (s.p1.y - s.p0.y) * segFrac;
      const tz = s.p0.z + (s.p1.z - s.p0.z) * segFrac;
      s.buf[3] = tx; s.buf[4] = ty; s.buf[5] = tz;
      s.attr.needsUpdate = true; s.line.visible = s.gLine.visible = true;
      ar.photon.visible = true; ar.photon.position.set(tx, ty, tz);
    } else { s.line.visible = s.gLine.visible = false; }
  });

  if (ar.dots) ar.dots.forEach(d => {
    const pi = d.userData.pi;
    d.material.opacity = Math.max(0, Math.min(1, (prog - (pi-1)/nSegs) / 0.08)) * 0.92;
  });
  if (ar.burst) {
    const bt = Math.max(0, Math.min(1, (t - ar.tEnd + 0.03) / 0.14));
    ar.burst.material.opacity = bt * 0.94; ar.burst.scale.setScalar(1 + bt * 2.8);
  }
}

function showAllRaysPersisted() {
  animRays.forEach(ar => {
    ar.segs.forEach(s => {
      s.buf[3] = s.p1.x; s.buf[4] = s.p1.y; s.buf[5] = s.p1.z;
      s.attr.needsUpdate = true; s.line.visible = s.gLine.visible = true;
    });
    ar.photon.visible = false;
    if (ar.burst) { ar.burst.material.opacity = 0.65; ar.burst.scale.setScalar(2.5); }
    if (ar.dots) ar.dots.forEach(d => { d.material.opacity = 0.90; });
  });
}

function hideAllRays() {
  animRays.forEach(ar => {
    ar.segs.forEach(s => { s.line.visible = s.gLine.visible = false; });
    ar.photon.visible = false;
    if (ar.burst) { ar.burst.material.opacity = 0; ar.burst.scale.setScalar(1); }
    if (ar.dots)  ar.dots.forEach(d => { d.material.opacity = 0; });
  });
}

function tickAllRays(t) { animRays.forEach(ar => tickRay(ar, t)); }

/* ═══════════════════════════════════════════════════════════════
   §8  MICRO-VIEW CAMERA ANIMATION
═══════════════════════════════════════════════════════════════ */
let microMode = false;
const MACRO = { oT: 0.05, oP: 1.06, oR: 32, ocx: 0.0, ocy: 1.0, ocz: 0.0 };
const MICRO  = { oT: 0.05, oP: 1.12, oR: 3.2, ocx: BFLY_CX, ocy: 0.45, ocz: 0.0 };

function lerpCam(target) {
  const L = 0.06;
  oT += (target.oT  - oT)  * L; oP += (target.oP  - oP)  * L; oR += (target.oR  - oR)  * L;
  OC.x += (target.ocx - OC.x) * L; OC.y += (target.ocy - OC.y) * L; OC.z += (target.ocz - OC.z) * L;
  camUpdate();
}

/* ═══════════════════════════════════════════════════════════════
   §9  RENDER LOOP
═══════════════════════════════════════════════════════════════ */
let animState = 'idle', animT = 0, prevTS = 0, pulseClock = 0;
const ANIM_DUR = 4800;

function getSpeed() { const el = document.getElementById('animSpeed'); return el ? Math.max(0.1, parseFloat(el.value)) : 1.0; }
function $el(id) { return document.getElementById(id); }

function renderLoop(ts) {
  requestAnimationFrame(renderLoop);
  const dt = Math.min(ts - prevTS, 100); prevTS = ts; pulseClock += dt * 0.0008;

  // Sun pulse
  coronaSprite.material.opacity = 0.82 + Math.sin(pulseClock * 0.7) * 0.10;
  glowSprite.material.opacity   = 0.88 + Math.sin(pulseClock) * 0.10;
  coreSprite.scale.setScalar(6  + Math.sin(pulseClock * 1.2) * 0.3);
  sunPL.intensity = 2.2 + Math.sin(pulseClock) * 0.30;
  spikeAngle += dt * 0.00025;
  sunGroup.children.forEach((c, i) => { if (i >= 3 && i <= 14) c.rotation.z = spikeAngle; });

  if (microMode) {
    const diff = Math.abs(oR - MICRO.oR) + Math.abs(OC.x - MICRO.ocx) + Math.abs(OC.y - MICRO.ocy);
    if (diff > 0.03) lerpCam(MICRO);
  }

  if (animState === 'running') {
    animT = Math.min(1, animT + dt / (ANIM_DUR / getSpeed()));
    tickAllRays(animT);
    if (animT >= 1) {
      animState = 'done';
      $el('simStatus').classList.add('hidden');
      showAllRaysPersisted();
    }
  }

  // LOD + labels
  const simActive = animState === 'running' || animState === 'done';
  const inClose   = microMode || oR < 7;
  if (bflyGeom.nanoGroup) bflyGeom.nanoGroup.visible = (microMode || oR < 6) && simActive && surfaceMode === 'morpho';
  zoomLabelFlat.visible = inClose && simActive;
  zoomLabelBfly.visible = inClose && simActive;

  // Dynamic glow intensity based on zoom distance
  if (simActive) {
    const glowOp = Math.min(0.72, 0.42 + (32 - oR) * 0.012);
    animRays.forEach(ar => { ar.segs.forEach(s => { if (s.gLine.visible) s.gMat.opacity = glowOp; }); });
  }

  const bc = $el('bounceCounter');
  if (bc && simActive) {
    let best = 0, bestD = Infinity;
    const half = animRays.length >> 1;
    for (let k = half; k < animRays.length; k++) {
      if (!animRays[k].segs[0] || !animRays[k].segs[0].line.visible) continue;
      const dx = animRays[k].pts[0].x - OC.x, dy = animRays[k].pts[0].y - OC.y;
      const d = dx*dx + dy*dy;
      if (d < bestD) { bestD = d; best = animRays[k].bounces || 0; }
    }
    bc.textContent = inClose ? 'Bounces: ' + best : '';
  } else if (bc) { bc.textContent = ''; }

  const mvl = $el('microViewLabel');
  if (mvl) mvl.textContent = microMode ? 'Micro-Scale View  ·  Morpho Lattice' : '';

  renderer.render(scene, camera);
}
requestAnimationFrame(renderLoop);

/* ═══════════════════════════════════════════════════════════════
   §10  UI EVENT HANDLERS
═══════════════════════════════════════════════════════════════ */
const SLMAP = {
  sunAngle:       ['val-sun',      v => v + '°'],
  numRays:        ['val-rays',     v => v],
  ridgeHeight:    ['val-ridge-h',  v => v + ' μm'],
  ridgeSpacing:   ['val-ridge-s',  v => v + ' μm'],
  lightIntensity: ['val-intensity',v => parseFloat(v).toFixed(1) + '×'],
  animSpeed:      ['val-speed',    v => parseFloat(v).toFixed(2) + '×'],
};
Object.entries(SLMAP).forEach(([id, [vid, fmt]]) => {
  const sl = document.getElementById(id), vl = document.getElementById(vid);
  if (sl && vl) sl.addEventListener('input', () => { vl.textContent = fmt(sl.value); });
});

function getParams() {
  return {
    sunAngle:     parseFloat(document.getElementById('sunAngle').value),
    numRays:      parseInt(document.getElementById('numRays').value),
    ridgeHeight:  parseFloat(document.getElementById('ridgeHeight').value),
    ridgeSpacing: parseFloat(document.getElementById('ridgeSpacing').value),
    intensity:    parseFloat(document.getElementById('lightIntensity').value),
  };
}
function pct(v) { return (v * 100).toFixed(1) + '%'; }

function updateUI(d) {
  $el('flatEff').textContent       = pct(d.flatEff);
  $el('flatEffTag').textContent    = pct(d.flatEff);
  $el('flatAbsorbed').textContent  = String(d.fAbs);
  $el('flatReflected').textContent = String(d.fRefl);
  $el('flatTransmitted').textContent = String(d.fTrans);
  $el('bflyEff').textContent       = pct(d.bflyEff);
  $el('bflyEffTag').textContent    = pct(d.bflyEff);
  $el('bflyAbsorbed').textContent  = String(d.bAbs);
  $el('bflyReflected').textContent = String(d.bRefl);
  $el('bflyTransmitted').textContent = String(d.bTrans);
  const g = d.gain; $el('gainValue').textContent = (g >= 0 ? '+' : '') + pct(g);
  ['flatBar','bflyBar','gainBar'].forEach(id => { const b=$el(id); if(b) b.style.width='0%'; });
  setTimeout(() => {
    [['flatBar','flatBarVal',d.flatEff,''],['bflyBar','bflyBarVal',d.bflyEff,''],
     ['gainBar','gainBarVal',Math.max(0,d.gain),g>=0?'+':'']].forEach(([bId,vId,val,pre]) => {
      const bar=$el(bId), lbl=$el(vId);
      if(bar) bar.style.width = Math.min(100, val*100) + '%';
      if(lbl) lbl.textContent = pre + pct(val);
    });
  }, 80);
  if (typeof window._updateGraphs === 'function') window._updateGraphs(d);
}

$el('btnStart').addEventListener('click', () => {
  const p = getParams(); moveSun(p.sunAngle);
  const data = runPhysics(p); buildRayLines(data); updateUI(data);
  hideAllRays(); animT = 0; animState = 'running';
  $el('simStatus').classList.add('hidden');
  $el('btnPause').disabled = false; $el('btnReset').disabled = false;
  if ($el('btnClear')) $el('btnClear').disabled = false;
  $el('btnPause').textContent = 'Pause'; $el('engineDot').classList.add('on');
  if (typeof window._microSimStart === 'function') window._microSimStart(window.rayStats);
});
$el('btnPause').addEventListener('click', () => {
  if      (animState==='running') { animState='paused';  $el('btnPause').textContent='Resume'; }
  else if (animState==='paused')  { animState='running'; $el('btnPause').textContent='Pause'; }
});
$el('btnReset').addEventListener('click', () => {
  hideAllRays(); animT=0; animState='idle';
  const s=$el('simStatus'); s.textContent='Press Start to run again'; s.classList.remove('hidden');
  $el('btnPause').disabled=true; $el('btnPause').textContent='Pause';
});
if ($el('btnClear')) $el('btnClear').addEventListener('click', () => {
  hideAllRays(); animT=0; animState='idle';
  const s=$el('simStatus'); s.textContent='Ray paths cleared. Press Start to run again.'; s.classList.remove('hidden');
  $el('btnPause').disabled=true; $el('btnPause').textContent='Pause';
  $el('engineDot').classList.remove('on');
});
$el('btnFullscreen').addEventListener('click', () => {
  const wrap=$el('vpOuter');
  if (!document.fullscreenElement) (wrap.requestFullscreen || wrap.webkitRequestFullscreen || (()=>{})).call(wrap);
  else (document.exitFullscreen || document.webkitExitFullscreen || (()=>{})).call(document);
});
$el('btnMicro').addEventListener('click', () => {
  microMode = !microMode;
  const btn = $el('btnMicro');
  if (microMode) {
    btn.classList.add('active'); btn.textContent = 'Macroscopic View';
    MACRO.oT=oT; MACRO.oP=oP; MACRO.oR=oR; MACRO.ocx=OC.x; MACRO.ocy=OC.y; MACRO.ocz=OC.z;
  } else {
    btn.classList.remove('active'); btn.textContent = 'Micro View';
    oT=MACRO.oT; oP=MACRO.oP; oR=MACRO.oR; OC.set(MACRO.ocx,MACRO.ocy,MACRO.ocz); camUpdate();
  }
});

const surfaceModeBtn = $el('surfaceModeBtn');
if (surfaceModeBtn) {
  surfaceModeBtn.addEventListener('click', () => {
    surfaceMode = (surfaceMode === 'morpho') ? 'flat' : 'morpho';
    applySurfaceMode();
    if (animState === 'done' || animState === 'running' || animState === 'paused') {
      const p = getParams(); moveSun(p.sunAngle);
      const data = runPhysics(p); buildRayLines(data); updateUI(data);
      hideAllRays(); animT = 0; animState = 'running';
      if (typeof window._microSimStart === 'function') window._microSimStart(window.rayStats);
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   §11  RESIZE + NAV
═══════════════════════════════════════════════════════════════ */
function onResize() {
  const { w, h } = sz(); if (w < 2 || h < 2) return;
  W = w; H = h; renderer.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
document.addEventListener('fullscreenchange',       () => setTimeout(onResize, 80));
document.addEventListener('webkitfullscreenchange', () => setTimeout(onResize, 80));
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(onResize).observe(container);

const ioObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const a = document.querySelector('.nav-link[href="#' + e.target.id + '"]');
    if (a) a.classList.add('active');
  });
}, { threshold: 0.25 });
document.querySelectorAll('section[id]').forEach(s => ioObs.observe(s));

moveSun(45); setTimeout(onResize, 60);

/* ═══════════════════════════════════════════════════════════════
   §12  MICROSCOPIC SIMULATION — Canvas 2D, front view
   Clean, thick, bright rays on a 2D cross-section diagram.
   No Three.js depth issues. Always perfectly visible.
═══════════════════════════════════════════════════════════════ */
requestAnimationFrame(() => requestAnimationFrame(() => {
(function initMicroSim() {

  const mc = document.getElementById('microCanvas');
  if (!mc) return;
  const ctx = mc.getContext('2d');
  if (!ctx) return;

  /* ── World constants (in world units) ────────────────────── */
  const FX = -4.8, BX = 4.8, PW_M = 6.8;
  const MH = 2.8;           // Morpho ridge height
  const SL = 0.65;          // flat slab depth below surface
  const RT = 8.0;           // ray source height
  const N_SP = 8, SP_W = 0.10;
  const STP  = PW_M / (N_SP - 1);
  const N_RIB = 10, RIB_H = 0.045;
  const spineXs = Array.from({ length: N_SP },  (_, i) => BX - PW_M/2 + i * STP);
  const ribYs   = Array.from({ length: N_RIB }, (_, l) => (l + 0.5) / N_RIB * MH);

  /* ── DPR-aware canvas resize ─────────────────────────────── */
  let cW = 900, cH = 520;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cW = Math.max(mc.offsetWidth || (mc.parentElement ? mc.parentElement.offsetWidth : 900), 400);
    cH = mc.offsetHeight || 520;
    mc.width  = Math.round(cW * dpr);
    mc.height = Math.round(cH * dpr);
    ctx.scale(dpr, dpr);
  }
  resize();

  /* ── View transform ──────────────────────────────────────── */
  let vpZoom = 1.0, vpPanX = 0, vpPanY = 0;

  // Unit size in pixels — fits world ±13 X into canvas with padding
  function upx() { return Math.min(cW / 28, cH / 16) * vpZoom; }
  // World → screen
  function sx(wx) { return cW * 0.5  + (wx * upx()) + vpPanX; }
  function sy(wy) { return cH * 0.70 - (wy * upx()) + vpPanY; }

  /* ── Interaction ─────────────────────────────────────────── */
  let dragging = false, dLX = 0, dLY = 0, mTD = 0;
  mc.addEventListener('mousedown', e => { dragging = true; dLX = e.clientX; dLY = e.clientY; });
  window.addEventListener('mouseup', () => { dragging = false; });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    vpPanX += e.clientX - dLX; vpPanY += e.clientY - dLY;
    dLX = e.clientX; dLY = e.clientY;
  });
  mc.addEventListener('wheel', e => {
    e.preventDefault();
    vpZoom = Math.max(0.35, Math.min(7.0, vpZoom * (e.deltaY < 0 ? 1.10 : 0.91)));
  }, { passive: false });
  mc.addEventListener('dblclick', () => { vpZoom = 1.0; vpPanX = 0; vpPanY = 0; });
  mc.addEventListener('touchstart', e => {
    if (e.touches.length===1) { dragging=true; dLX=e.touches[0].clientX; dLY=e.touches[0].clientY; }
    if (e.touches.length===2) { dragging=false; mTD=Math.hypot(e.touches[1].clientX-e.touches[0].clientX,e.touches[1].clientY-e.touches[0].clientY); }
  }, { passive: true });
  mc.addEventListener('touchmove', e => {
    if (e.touches.length===1 && dragging) {
      vpPanX += e.touches[0].clientX-dLX; vpPanY += e.touches[0].clientY-dLY;
      dLX=e.touches[0].clientX; dLY=e.touches[0].clientY;
    }
    if (e.touches.length===2) {
      const d=Math.hypot(e.touches[1].clientX-e.touches[0].clientX,e.touches[1].clientY-e.touches[0].clientY);
      vpZoom=Math.max(0.35,Math.min(7.0,vpZoom*(d/Math.max(mTD,1)))); mTD=d;
    }
  }, { passive: true });
  mc.addEventListener('touchend', () => { dragging=false; }, { passive: true });

  /* ── Draw the cross-section structure ───────────────────── */
  function drawStructure() {
    const u = upx();

    /* Background */
    ctx.fillStyle = '#010208';
    ctx.fillRect(0, 0, cW, cH);

    /* Divider line */
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = 'rgba(40,65,105,0.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(sx(0), sy(-SL-0.5)); ctx.lineTo(sx(0), sy(RT+0.3)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    /* ── LEFT: FLAT SILICON ────────────────────────────────── */
    const fL = sx(FX-PW_M/2), fR = sx(FX+PW_M/2), fW = fR-fL;
    const fTop = sy(0), fBot = sy(-SL), fH = fBot-fTop;

    // Slab body
    const slabGrad = ctx.createLinearGradient(fL, fTop, fL, fBot);
    slabGrad.addColorStop(0, '#0d2040');
    slabGrad.addColorStop(1, '#081428');
    ctx.fillStyle = slabGrad;
    ctx.fillRect(fL, fTop, fW, fH);

    // Cell finger lines inside slab
    ctx.strokeStyle = 'rgba(0,80,120,0.22)';
    ctx.lineWidth = 0.8;
    for (let ci = 1; ci < 8; ci++) {
      const gx = fL + ci * fW/8;
      ctx.beginPath(); ctx.moveTo(gx, fTop); ctx.lineTo(gx, fBot); ctx.stroke();
    }

    // Slab border
    ctx.strokeStyle = 'rgba(20,60,100,0.60)';
    ctx.lineWidth = 1;
    ctx.strokeRect(fL, fTop, fW, fH);

    // ARC surface layer — glowing teal strip at y=0
    const arcH = Math.max(3, u * 0.07);
    const arcG = ctx.createLinearGradient(0, fTop-arcH, 0, fTop+arcH*0.5);
    arcG.addColorStop(0, 'rgba(0,220,240,0.95)');
    arcG.addColorStop(0.5,'rgba(0,170,200,0.70)');
    arcG.addColorStop(1, 'rgba(0,100,140,0)');
    ctx.fillStyle = arcG;
    ctx.fillRect(fL, fTop-arcH, fW, arcH*1.8);

    /* ── RIGHT: MORPHO NANOSTRUCTURE ───────────────────────── */
    const bL = sx(BX-PW_M/2), bR = sx(BX+PW_M/2), bW = bR-bL;
    const bTop = sy(0), bBot = sy(-0.5), bH = bBot-bTop;

    // Dark substrate
    const baseG = ctx.createLinearGradient(bL, bTop, bL, bTop+bH);
    baseG.addColorStop(0, '#0c0222');
    baseG.addColorStop(1, '#070014');
    ctx.fillStyle = baseG;
    ctx.fillRect(bL, bTop, bW, bH);
    ctx.strokeStyle = 'rgba(80,15,140,0.38)';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(bL, bTop, bW, bH);

    // Valley floor glow
    const vG = ctx.createLinearGradient(bL, 0, bR, 0);
    vG.addColorStop(0, 'transparent');
    vG.addColorStop(0.5,'rgba(130,25,220,0.28)');
    vG.addColorStop(1, 'transparent');
    ctx.fillStyle = vG;
    const gh = Math.max(3, u*0.10);
    ctx.fillRect(bL, bTop-gh*0.5, bW, gh);

    // Lamellae (drawn before spines so spines appear on top)
    for (let si = 0; si < N_SP-1; si++) {
      const cmx = (spineXs[si] + spineXs[si+1]) / 2;
      const maxW = STP - SP_W;
      for (let l = 0; l < N_RIB; l++) {
        const frac = l / (N_RIB-1);
        const ribW = maxW * (1.0 - frac * 0.70);
        const ry = ribYs[l];
        const rl = sx(cmx-ribW/2), rr = sx(cmx+ribW/2);
        const rTop = sy(ry+RIB_H/2), rBot = sy(ry-RIB_H/2);
        const rH = rBot-rTop;
        if (rH < 0.6) continue;
        const brt = 0.55 + frac*0.30;
        ctx.fillStyle = `rgba(${Math.round(30*brt)},${Math.round(8*brt)},${Math.round(90*brt)},0.95)`;
        ctx.fillRect(rl, rTop, rr-rl, rH);
        ctx.strokeStyle = 'rgba(100,35,200,0.35)';
        ctx.lineWidth = 0.6;
        ctx.strokeRect(rl, rTop, rr-rl, rH);
      }
    }

    // Vertical spine columns
    for (let si = 0; si < N_SP; si++) {
      const spL = sx(spineXs[si]-SP_W/2), spR = sx(spineXs[si]+SP_W/2);
      const spTop = sy(MH), spBot = sy(0);
      const spW = spR-spL, spH = spBot-spTop;

      const spG = ctx.createLinearGradient(spL, 0, spR, 0);
      spG.addColorStop(0,   '#120230');
      spG.addColorStop(0.35,'#260560');
      spG.addColorStop(0.65,'#260560');
      spG.addColorStop(1,   '#120230');
      ctx.fillStyle = spG;
      ctx.fillRect(spL, spTop, spW, spH);
      ctx.strokeStyle = 'rgba(100,30,190,0.48)';
      ctx.lineWidth = 0.7;
      ctx.strokeRect(spL, spTop, spW, spH);

      // Glowing cap
      const capH = Math.max(2.5, u*0.10);
      ctx.fillStyle = 'rgba(200,80,255,0.92)';
      ctx.shadowColor = 'rgba(180,55,255,0.80)';
      ctx.shadowBlur  = 8;
      ctx.fillRect(spL-u*0.05, spTop-capH, spW+u*0.10, capH);
      ctx.shadowBlur = 0;
    }
  }

  /* ── Draw labels ─────────────────────────────────────────── */
  function drawLabels() {
    const fs = Math.max(11, Math.min(18, upx() * 0.44));
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${fs}px Rajdhani, Arial, sans-serif`;

    ctx.fillStyle = '#00d4ff';
    ctx.shadowColor = 'rgba(0,200,255,0.65)'; ctx.shadowBlur = 10;
    ctx.fillText('FLAT SILICON — Single Interaction', sx(FX), sy(RT+0.5));

    ctx.fillStyle = '#cc55ff';
    ctx.shadowColor = 'rgba(180,60,255,0.65)';
    ctx.fillText('MORPHO LATTICE — Multi-Bounce Trapping', sx(BX), sy(RT+0.5));

    ctx.shadowBlur = 0; ctx.restore();
  }

  /* ── Ray rendering helpers ───────────────────────────────── */
  function rayLine(x0, y0, x1, y1, col, alpha, lw) {
    ctx.save();
    // Core line
    ctx.strokeStyle = col;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.lineWidth   = Math.max(1.5, lw * upx() * 0.12);
    ctx.lineCap     = 'round';
    ctx.beginPath(); ctx.moveTo(sx(x0),sy(y0)); ctx.lineTo(sx(x1),sy(y1)); ctx.stroke();
    // Glow
    ctx.globalAlpha = Math.min(1, alpha * 0.38);
    ctx.lineWidth   = Math.max(3, lw * upx() * 0.28);
    ctx.shadowColor = col; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.moveTo(sx(x0),sy(y0)); ctx.lineTo(sx(x1),sy(y1)); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function rayDot(x, y, col, alpha, r) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.fillStyle   = col;
    ctx.shadowColor = col; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(sx(x), sy(y), Math.max(2, r * upx() * 0.13), 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0; ctx.restore();
  }

  function arrowHead(x, y, dx, dy, col, alpha) {
    const angle = Math.atan2(-(sy(y+dy*0.001)-sy(y)), sx(x+dx*0.001)-sx(x));
    const sz2 = Math.max(6, upx() * 0.18);
    ctx.save();
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.fillStyle   = col;
    ctx.shadowColor = col; ctx.shadowBlur = 8;
    ctx.translate(sx(x), sy(y));
    ctx.rotate(angle);
    ctx.beginPath(); ctx.moveTo(sz2,0); ctx.lineTo(-sz2*0.55, sz2*0.45); ctx.lineTo(-sz2*0.55,-sz2*0.45); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; ctx.restore();
  }

  /* ── Build ray segment arrays ────────────────────────────── */
  // Each ray = array of {x0,y0,x1,y1,col,lw} + outcome label
  // Flat outcomes: 2 reflected, 3 absorbed, 1 transmitted
  const FLAT_OUT = ['reflected','reflected','absorbed','absorbed','absorbed','transmitted'];
  const BFLY_OUT = ['absorbed','absorbed','reflected','absorbed','absorbed','transmitted','absorbed','absorbed'];

  let lastStats = null; // updated by _microSimStart

  function buildAllRays(stats) {
    const fa = stats ? stats.flatAbs  : 0.50;
    const fr = stats ? stats.flatRefl : 0.32;
    const ba = stats ? stats.bflyAbs  : 0.75;
    const br = stats ? stats.bflyRefl : 0.13;

    // Choose outcomes from stats (flat: 6 rays, bfly: 8 rays)
    const nFR = Math.round(6 * fr);
    const nFA = Math.min(6-nFR, Math.round(6*fa));
    const flatOuts = Array.from({length:6},(_,i)=> i<nFR?'reflected': i<nFR+nFA?'absorbed':'transmitted');

    const nBR = Math.round(8 * br);
    const nBA = Math.min(8-nBR, Math.round(8*ba));
    const bflyOuts = Array.from({length:8},(_,i)=> i<nBR?'reflected': i<nBR+nBA?'absorbed':'transmitted');

    const fRays = [], bRays = [];

    /* FLAT rays */
    for (let ri = 0; ri < 6; ri++) {
      const f   = ri / 5;
      const ang = (26 + f * 22) * Math.PI / 180;
      const rdx = Math.sin(ang), cosA = Math.cos(ang);
      const hx  = FX - PW_M*0.43 + f * PW_M*0.86;
      const ex  = hx - rdx * (RT / cosA);
      const out = flatOuts[ri];
      const segs = [];

      // Incoming
      segs.push({x0:ex,y0:RT, x1:hx,y1:0, col:'#ffee33',lw:1.8});

      if (out==='reflected') {
        segs.push({x0:hx,y0:0, x1:hx+rdx*3.6,y1:cosA*3.6, col:'#ff3322',lw:1.5});
      } else if (out==='absorbed') {
        const depth = 0.14 + (ri-nFR)*0.14;
        segs.push({x0:hx,y0:0, x1:hx+rdx*0.10,y1:-Math.min(depth,SL*0.92), col:'#00ff88',lw:1.5});
      } else {
        segs.push({x0:hx,y0:0, x1:hx+rdx*0.22,y1:-SL, col:'#00ccff',lw:1.5});
      }
      fRays.push({segs, outcome:out, hx, hy:0, rdx, cosA});
    }

    /* BUTTERFLY rays */
    for (let ri = 0; ri < 8; ri++) {
      const f   = ri / 7;
      const ang = (22 + f * 28) * Math.PI / 180;
      let dx = Math.sin(ang), dy = -Math.cos(ang);
      const out = bflyOuts[ri];
      const vi  = ri % (N_SP-1);
      const lx  = spineXs[vi]   + SP_W*0.5 + 0.022;
      const rx  = spineXs[vi+1] - SP_W*0.5 - 0.022;
      const hx  = (lx+rx)*0.5 + (f-0.5)*(rx-lx)*0.46;
      const ex  = hx - dx * ((RT-MH)/Math.abs(dy));
      const segs = [];

      // Incoming
      segs.push({x0:ex,y0:RT, x1:hx,y1:MH, col:'#ffee33',lw:1.8});

      let cx=hx, cy=MH;
      const MAXB = out==='reflected'?2: out==='transmitted'?3: (5+ri%3);

      for (let b=0; b<MAXB; b++) {
        let tMin=Infinity, hitW='';
        if (dx<0 && cx>lx+1e-5) { const t=(lx-cx)/dx; if(t>1e-5&&t<tMin){tMin=t;hitW='L';} }
        if (dx>0 && cx<rx-1e-5) { const t=(rx-cx)/dx; if(t>1e-5&&t<tMin){tMin=t;hitW='R';} }
        for (const ry of ribYs) {
          if (dy<0 && cy>ry+RIB_H*0.5+1e-5) { const t=(ry+RIB_H*0.5-cy)/dy; if(t>1e-5&&t<tMin){tMin=t;hitW='rib';} }
          else if (dy>0 && cy<ry-RIB_H*0.5-1e-5) { const t=(ry-RIB_H*0.5-cy)/dy; if(t>1e-5&&t<tMin){tMin=t;hitW='rib';} }
        }
        if (dy<0 && cy>1e-5)     { const t=-cy/dy;     if(t>1e-5&&t<tMin){tMin=t;hitW='floor';} }
        if (dy>0 && cy<MH-1e-5)  { const t=(MH-cy)/dy; if(t>1e-5&&t<tMin){tMin=t;hitW='top';} }
        if (!isFinite(tMin)||tMin<1e-6) break;

        const nx=Math.max(lx,Math.min(rx,cx+dx*tMin));
        const ny=Math.max(0,Math.min(MH,cy+dy*tMin));
        const bright=Math.max(0.30,1.0-b*0.14);
        const rr=Math.round(255*bright), gg=Math.round(0x66*bright);
        const bounceCol = `rgb(${rr},${gg},0)`;

        if (hitW==='floor') {
          if (out==='transmitted') {
            segs.push({x0:cx,y0:cy, x1:nx,y1:0, col:'#00ccff',lw:1.5});
          } else {
            segs.push({x0:cx,y0:cy, x1:nx,y1:ny, col:'#00ff88',lw:1.5});
          }
          cx=nx; cy=ny; break;
        } else if (hitW==='top') {
          if (out==='reflected') {
            segs.push({x0:cx,y0:cy, x1:nx,y1:MH+3.2, col:'#ff3322',lw:1.5});
            cx=nx; cy=ny; break;
          } else {
            segs.push({x0:cx,y0:cy, x1:nx,y1:ny, col:bounceCol,lw:1.4});
            dy=-dy;
          }
        } else {
          segs.push({x0:cx,y0:cy, x1:nx,y1:ny, col:bounceCol,lw:1.4});
          if (hitW==='L'||hitW==='R') dx=-dx; else dy=-dy;
        }
        cx=nx; cy=ny;
        if (b===MAXB-1) {
          segs.push({x0:cx,y0:cy, x1:cx,y1:cy+0.001, col:'#00ff88',lw:1.5});
        }
      }
      bRays.push({segs, outcome:out, hx, hy:MH, dx:Math.sin(ang), dy:-Math.cos(ang)});
    }

    return {fRays, bRays};
  }

  /* ── Animation ───────────────────────────────────────────── */
  let mAnimState='idle', mT=0, mPrev=0, rayData=null;
  const M_DUR = 6.0; // animation cycle seconds

  function drawRaysAtProgress(g) {
    if (!rayData) return;
    const {fRays, bRays} = rayData;
    const allRays = [...fRays, ...bRays];
    // total segments for timing
    const totalSegs = allRays.reduce((acc,r)=>acc+r.segs.length,0);
    let sOff = 0;

    allRays.forEach((ray,ri) => {
      ray.segs.forEach((seg, si) => {
        const globalSi = sOff + si;
        const t0 = (globalSi / totalSegs) * 0.88;
        const t1 = t0 + 0.10;
        const p  = Math.max(0, Math.min(1, (g - t0) / Math.max(t1-t0, 0.001)));
        if (p <= 0) return;

        // Animate: tip moves from (x0,y0) to lerp end
        const tx = seg.x0 + (seg.x1-seg.x0)*p;
        const ty = seg.y0 + (seg.y1-seg.y0)*p;
        rayLine(seg.x0, seg.y0, tx, ty, seg.col, p, seg.lw || 1.6);

        // Photon head at tip while animating
        if (p > 0.02 && p < 0.98) {
          rayDot(tx, ty, seg.col, p * 0.95, 0.8);
        }
        // Hit dot at start of segment (except first segment)
        if (si > 0 && g > t0 + 0.05) {
          rayDot(seg.x0, seg.y0, seg.col, Math.min(1,(g-t0-0.05)/0.08)*0.90, 0.65);
        }
      });
      sOff += ray.segs.length;
    });
  }

  function drawRaysFull() {
    if (!rayData) return;
    const {fRays, bRays} = rayData;
    [...fRays,...bRays].forEach(ray => {
      ray.segs.forEach((seg, si) => {
        rayLine(seg.x0, seg.y0, seg.x1, seg.y1, seg.col, 1.0, seg.lw || 1.6);
        if (si > 0) rayDot(seg.x0, seg.y0, seg.col, 0.88, 0.65);
      });
      // Terminal dot
      const last = ray.segs[ray.segs.length-1];
      if (last) rayDot(last.x1, last.y1, last.col, 0.95, 0.90);
      // Arrow on incoming segment
      const first = ray.segs[0];
      if (first) {
        const mx = (first.x0+first.x1)*0.5, my = (first.y0+first.y1)*0.5;
        arrowHead(mx, my, first.x1-first.x0, first.y1-first.y0, first.col, 0.88);
      }
    });
  }

  /* ── Main draw loop ──────────────────────────────────────── */
  function mLoop(ts) {
    requestAnimationFrame(mLoop);
    const dt = Math.min(ts-mPrev, 80)/1000; mPrev=ts;

    // Resize check
    const nW = mc.offsetWidth || 900, nH = mc.offsetHeight || 520;
    if (Math.abs(nW-cW)>2 || Math.abs(nH-cH)>2) { cW=nW; cH=nH; resize(); }

    // Clear
    ctx.clearRect(0, 0, cW, cH);
    ctx.save();

    // Draw structure
    drawStructure();
    drawLabels();

    // Draw rays
    if (mAnimState==='running') {
      mT += dt;
      const g = Math.min(1.0, mT/M_DUR);
      drawRaysAtProgress(g);
      if (g>=1.0) {
        mAnimState='done';
        const btn=document.getElementById('btnMicroRun');
        if (btn) btn.textContent='Run';
      }
    } else if (mAnimState==='done') {
      drawRaysFull();
    } else if (mAnimState==='paused' && rayData) {
      const g = Math.min(1.0, mT/M_DUR);
      drawRaysAtProgress(g);
    }

    ctx.restore();
  }
  requestAnimationFrame(mLoop);

  /* ── Buttons ─────────────────────────────────────────────── */
  const btnRun   = document.getElementById('btnMicroRun');
  const btnPause = document.getElementById('btnMicroPause');
  const btnClear = document.getElementById('btnMicroClear');

  function mHideAll() { mT=0; mAnimState='idle'; }

  if (btnRun) btnRun.addEventListener('click', () => {
    if (mAnimState==='idle'||mAnimState==='done') {
      if (!rayData) rayData=buildAllRays(lastStats);
      mT=0; mAnimState='running'; btnRun.textContent='Running...';
    } else if (mAnimState==='paused') {
      mAnimState='running'; btnRun.textContent='Running...';
    }
  });
  if (btnPause) btnPause.addEventListener('click', () => {
    if (mAnimState==='running') { mAnimState='paused'; if(btnRun) btnRun.textContent='Resume'; }
  });
  if (btnClear) btnClear.addEventListener('click', () => {
    mHideAll(); if(btnRun) btnRun.textContent='Run';
  });

  /* ── Stats bar update ────────────────────────────────────── */
  function updateStatsBar(s) {
    const el = document.getElementById('microStatsBar');
    if (!el) return;
    const fmt = v => (v*100).toFixed(0)+'%';
    el.innerHTML = `<span style="color:#00ff88">▌ Morpho: ${fmt(s.bflyAbs)} absorbed · ${fmt(s.bflyRefl)} reflected · ${fmt(s.bflyTrans)} transmitted</span>` +
      `<span style="color:#7880a8;margin-left:24px">Flat Si: ${fmt(s.flatAbs)} absorbed · ${fmt(s.flatRefl)} reflected · ${fmt(s.flatTrans)} transmitted</span>`;
  }

  /* ── Public API ──────────────────────────────────────────── */
  window._microSimStart = function(stats) {
    lastStats = stats;
    rayData = buildAllRays(stats);
    mT=0; mAnimState='running';
    if (btnRun) btnRun.textContent='Running...';
    if (stats) updateStatsBar(stats);
  };
  window._microSimStop = function() {
    mHideAll(); if(btnRun) btnRun.textContent='Run';
  };

}()); // end initMicroSim
})); // end double-rAF guard

/* ═══════════════════════════════════════════════════════════════
   §13  GRAPHS
═══════════════════════════════════════════════════════════════ */
(function initGraphs() {
  var NS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs, parent) {
    var el = document.createElementNS(NS, tag);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }

  var PAD_L=55, PAD_R=15, PAD_T=12, PAD_B=40;
  var VW=520, VH=300;
  var GPW=VW-PAD_L-PAD_R, GPH=VH-PAD_T-PAD_B;

  function xMap(v,mn,mx){ return PAD_L+((v-mn)/(mx-mn))*GPW; }
  function yMap(v,mn,mx){ return PAD_T+GPH-((v-mn)/(mx-mn))*GPH; }

  function drawGrid(svg,xMin,xMax,xStep,yMin,yMax,yStep,xLabel,yLabel) {
    for (var y=yMin;y<=yMax+1e-9;y+=yStep) {
      var py=yMap(y,yMin,yMax);
      svgEl('line',{x1:PAD_L,y1:py,x2:VW-PAD_R,y2:py,stroke:'rgba(255,255,255,0.07)','stroke-width':1},svg);
      svgEl('text',{x:PAD_L-6,y:py+4,fill:'#7880a8','font-size':'10','font-family':'JetBrains Mono','text-anchor':'end'},svg).textContent=y.toFixed(1);
    }
    for (var x=xMin;x<=xMax+1e-9;x+=xStep) {
      var px=xMap(x,xMin,xMax);
      svgEl('line',{x1:px,y1:PAD_T,x2:px,y2:VH-PAD_B,stroke:'rgba(255,255,255,0.07)','stroke-width':1},svg);
      svgEl('text',{x:px,y:VH-PAD_B+16,fill:'#7880a8','font-size':'10','font-family':'JetBrains Mono','text-anchor':'middle'},svg).textContent=x;
    }
    svgEl('line',{x1:PAD_L,y1:PAD_T,x2:PAD_L,y2:VH-PAD_B,stroke:'#3a4066','stroke-width':1.5},svg);
    svgEl('line',{x1:PAD_L,y1:VH-PAD_B,x2:VW-PAD_R,y2:VH-PAD_B,stroke:'#3a4066','stroke-width':1.5},svg);
    svgEl('text',{x:PAD_L+GPW/2,y:VH-2,fill:'#7880a8','font-size':'11','font-family':'Rajdhani','text-anchor':'middle'},svg).textContent=xLabel;
    var yl=svgEl('text',{x:14,y:PAD_T+GPH/2,fill:'#7880a8','font-size':'11','font-family':'Rajdhani','text-anchor':'middle',transform:'rotate(-90 14 '+(PAD_T+GPH/2)+')'},svg);
    yl.textContent=yLabel;
  }

  function drawLine(svg,xs,ys,xMin,xMax,yMin,yMax,color) {
    var pts=xs.map(function(x,i){return xMap(x,xMin,xMax)+','+yMap(ys[i],yMin,yMax);}).join(' ');
    svgEl('polyline',{points:pts,fill:'none',stroke:color,'stroke-width':2.4,'stroke-linejoin':'round'},svg);
    xs.forEach(function(x,i){svgEl('circle',{cx:xMap(x,xMin,xMax),cy:yMap(ys[i],yMin,yMax),r:3,fill:color},svg);});
  }

  /* Absorption vs Wavelength — Morpho rhetenor */
  var wl      = [300,350,400,450,500,550,600,650,700,750,800,850,900,950,1000,1050,1100];
  var flatAbs = [0.38,0.52,0.63,0.70,0.72,0.70,0.67,0.63,0.59,0.54,0.48,0.41,0.33,0.25,0.17,0.09,0.03];
  var morphAbs= [0.75,0.80,0.82,0.22,0.64,0.90,0.92,0.90,0.87,0.83,0.76,0.66,0.54,0.40,0.25,0.12,0.04];
  var svgA=document.getElementById('svgAbsorption');
  if (svgA) {
    drawGrid(svgA,300,1100,200,0,1,0.2,'Wavelength (nm)','Absorptance');
    drawLine(svgA,wl,flatAbs,300,1100,0,1,'#00d4ff');
    drawLine(svgA,wl,morphAbs,300,1100,0,1,'#b44fff');
    svgEl('rect',{x:PAD_L+8,y:PAD_T+5,width:14,height:3,fill:'#00d4ff',rx:1},svgA);
    svgEl('text',{x:PAD_L+28,y:PAD_T+11,fill:'#dde2f5','font-size':'10','font-family':'Rajdhani'},svgA).textContent='Flat Si + ARC';
    svgEl('rect',{x:PAD_L+110,y:PAD_T+5,width:14,height:3,fill:'#b44fff',rx:1},svgA);
    svgEl('text',{x:PAD_L+130,y:PAD_T+11,fill:'#dde2f5','font-size':'10','font-family':'Rajdhani'},svgA).textContent='Morpho rhetenor';
    var dipX=xMap(450,300,1100), dipY=yMap(0.22,0,1);
    svgEl('line',{x1:dipX,y1:dipY-5,x2:dipX,y2:dipY-24,stroke:'#cc88ff','stroke-width':'1.2'},svgA);
    svgEl('text',{x:dipX+5,y:dipY-26,fill:'#cc88ff','font-size':'9','font-family':'Rajdhani'},svgA).textContent='450 nm blue peak';
  }

  /* Reflection vs Incident Angle */
  var ang   = [0,5,10,15,20,25,30,35,40,45,50,55,60,65,70,75,80,85];
  var flatR = [0.31,0.31,0.31,0.31,0.32,0.32,0.33,0.34,0.36,0.39,0.43,0.49,0.57,0.67,0.78,0.88,0.95,0.99];
  var morphR= [0.03,0.03,0.03,0.03,0.04,0.04,0.05,0.05,0.06,0.08,0.10,0.14,0.20,0.30,0.44,0.62,0.80,0.95];
  var svgB=document.getElementById('svgReflection');
  if (svgB) {
    drawGrid(svgB,0,85,10,0,1,0.2,'Incident Angle (°)','Reflectance');
    drawLine(svgB,ang,flatR,0,85,0,1,'#00d4ff');
    drawLine(svgB,ang,morphR,0,85,0,1,'#b44fff');
    svgEl('rect',{x:PAD_L+8,y:PAD_T+5,width:14,height:3,fill:'#00d4ff',rx:1},svgB);
    svgEl('text',{x:PAD_L+28,y:PAD_T+11,fill:'#dde2f5','font-size':'10','font-family':'Rajdhani'},svgB).textContent='Flat Si';
    svgEl('rect',{x:PAD_L+88,y:PAD_T+5,width:14,height:3,fill:'#b44fff',rx:1},svgB);
    svgEl('text',{x:PAD_L+108,y:PAD_T+11,fill:'#dde2f5','font-size':'10','font-family':'Rajdhani'},svgB).textContent='Morpho';
  }

  /* Efficiency bars */
  setTimeout(function(){
    var ef=document.getElementById('effFlat');
    var eb=document.getElementById('effBfly');
    var es=document.getElementById('effSQ');
    if(ef) ef.style.width=(18.7/35*100).toFixed(1)+'%';
    if(eb) eb.style.width=(25.2/35*100).toFixed(1)+'%';
    if(es) es.style.width=(29.4/35*100).toFixed(1)+'%';
  },600);

  window._updateGraphs = function(){};
}());

}); // end DOMContentLoaded

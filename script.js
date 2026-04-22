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

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(W, H);
renderer.setClearColor(0x020408, 1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
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
  map: makeSunTex(512, [[0,'rgba(255,255,230,0)'],[0.12,'rgba(255,220,50,.30)'],[0.35,'rgba(255,150,20,.38)'],[0.60,'rgba(255,90,5,.22)'],[0.82,'rgba(200,50,0,.10)'],[1,'rgba(0,0,0,0)']]),
  blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true
}));
coronaSprite.scale.set(44, 44, 1); sunGroup.add(coronaSprite);

const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: makeSunTex(256, [[0,'rgba(255,255,240,1)'],[0.1,'rgba(255,255,200,1)'],[0.22,'rgba(255,230,80,.95)'],[0.42,'rgba(255,180,20,.72)'],[0.62,'rgba(255,110,10,.38)'],[0.82,'rgba(200,50,0,.14)'],[1,'rgba(0,0,0,0)']]),
  blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true
}));
glowSprite.scale.set(20, 20, 1); sunGroup.add(glowSprite);

const coreSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: makeSunTex(128, [[0,'rgba(255,255,255,1)'],[0.18,'rgba(255,255,220,1)'],[0.45,'rgba(255,240,120,.92)'],[0.72,'rgba(255,200,40,.55)'],[1,'rgba(0,0,0,0)']]),
  blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true
}));
coreSprite.scale.set(7, 7, 1); sunGroup.add(coreSprite);

/* Solid guaranteed-visible sun disc — always renders regardless of tone mapping */
const sunCoreMesh = new THREE.Mesh(
  new THREE.SphereGeometry(1.1, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0xfffbe0, depthWrite: false, transparent: true, opacity: 0.96, blending: THREE.AdditiveBlending })
);
sunCoreMesh.renderOrder = 1002; sunGroup.add(sunCoreMesh);

/* Outer glow ring halo */
const sunHaloMesh = new THREE.Mesh(
  new THREE.SphereGeometry(2.2, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0xffdd44, depthWrite: false, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending })
);
sunHaloMesh.renderOrder = 1001; sunGroup.add(sunHaloMesh);

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
  const rad = deg * Math.PI / 180, D = 30;
  // Pure arc: x = D·sinθ, y = D·cosθ — sun orbits structure at constant radius
  sunGroup.position.set(Math.sin(rad) * D, Math.cos(rad) * D * 0.75 + 1.5, -14);
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
    new THREE.MeshStandardMaterial({ color: 0x0e0228, roughness: 0.55, metalness: 0.15, emissive: 0x080118, emissiveIntensity: 0.18 })
  );
  base.position.y = -0.10; base.castShadow = true;
  bflyGroup.add(base); bflyMeshes.push(base);

  const fl = new THREE.Mesh(
    new THREE.PlaneGeometry(PW, PD),
    new THREE.MeshStandardMaterial({ color: 0x0a0118, roughness: 0.65, metalness: 0.10, emissive: 0x050010, emissiveIntensity: 0.15 })
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

  const spineMat = new THREE.MeshStandardMaterial({ color: 0x1e0440, roughness: 0.45, metalness: 0.15, emissive: 0x160330, emissiveIntensity: 0.40 });
  const ribMat   = new THREE.MeshStandardMaterial({ color: 0x2e0660, roughness: 0.50, metalness: 0.12, emissive: 0x1e0448, emissiveIntensity: 0.35 });
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

/* View mode — camera-only toggle: "overall" | "microscopic"
   ❌ GEOMETRY IS NEVER SWAPPED — only camera + lighting change */
let bflyFlatMeshes = []; // legacy — kept for compat, not used

/* Safely dispose a list of meshes, freeing geometry + materials from GPU */
function _disposeBflyMeshList(list) {
  const uniqueMats = new Set();
  list.forEach(m => {
    bflyGroup.remove(m);
    if (m.geometry) m.geometry.dispose();
    if (m.material) {
      if (Array.isArray(m.material)) m.material.forEach(mt => uniqueMats.add(mt));
      else uniqueMats.add(m.material);
    }
  });
  uniqueMats.forEach(mt => mt.dispose());
}

/* Build a real flat solar-panel on bflyGroup (mirrors flatGroup geometry) */
function buildFlatGeomOnBfly() {
  const meshes = [];

  // Silicon substrate body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(PW, 0.30, PD),
    new THREE.MeshStandardMaterial({ color: 0x0b2240, roughness: 0.50, metalness: 0.15, emissive: 0x001e36, emissiveIntensity: 0.22 })
  );
  body.position.y = -0.15; body.castShadow = true;
  bflyGroup.add(body); meshes.push(body);

  // ARC anti-reflection coating surface
  const surf = new THREE.Mesh(
    new THREE.PlaneGeometry(PW, PD),
    new THREE.MeshStandardMaterial({ color: 0x00ccff, emissive: 0x009fcc, emissiveIntensity: 0.35, roughness: 0.20, metalness: 0.10 })
  );
  surf.rotation.x = -Math.PI / 2; surf.position.y = 0.002; surf.renderOrder = 1;
  bflyGroup.add(surf); meshes.push(surf);

  // Solar cell grid
  const cols = 8, rows = 5, cw = PW / cols, cd = PD / rows;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const lv = ((c * 7 + r * 13) % 17) / 17, blue = 0.04 + lv * 0.09;
      const cell = new THREE.Mesh(
        new THREE.PlaneGeometry(cw - 0.06, cd - 0.05),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(0.01, 0.10 + blue, 0.20 + blue * 1.4),
          roughness: 0.40, metalness: 0.10,
          emissive: new THREE.Color(0, blue * 0.22, blue * 0.38), emissiveIntensity: 0.55,
        })
      );
      cell.rotation.x = -Math.PI / 2;
      cell.position.set(-PW/2 + (c+0.5)*cw, 0.004, -PD/2 + (r+0.5)*cd);
      cell.renderOrder = 2; bflyGroup.add(cell); meshes.push(cell);
    }
  }

  // Busbars
  const busM = new THREE.MeshStandardMaterial({ color: 0xc8d4e8, roughness: 0.40, metalness: 0.10 });
  [0.22, 0.50, 0.78].forEach(t => {
    const bus = new THREE.Mesh(new THREE.BoxGeometry(PW - 0.1, 0.004, 0.06), busM);
    bus.position.set(0, 0.006, -PD/2 + t*PD); bus.renderOrder = 3;
    bflyGroup.add(bus); meshes.push(bus);
  });

  // Finger contact lines
  const fingM = new THREE.MeshStandardMaterial({ color: 0x6088a8, roughness: 0.50, metalness: 0.15 });
  for (let c = 1; c < cols; c++) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.003, PD - 0.1), fingM);
    f.position.set(-PW/2 + c*cw, 0.005, 0); f.renderOrder = 3;
    bflyGroup.add(f); meshes.push(f);
  }

  // Front edge indicator strip
  const edge = new THREE.Mesh(new THREE.BoxGeometry(PW, 0.048, 0.06), new THREE.MeshBasicMaterial({ color: 0x00d4ff }));
  edge.position.set(0, 0.004, PD / 2);
  bflyGroup.add(edge); meshes.push(edge);

  return meshes;
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
  // Rebuild morpho geometry with current slider params (geometry NEVER changes on mode switch)
  buildButterflyPanel(rh, rs);
  let fAbs=0,fRefl=0,fTrans=0, bAbs=0,bRefl=0,bTrans=0;
  const flatRays=[], bflyRays=[];
  let totalBflyBounces = 0; // for Trapping Index
  for (let i = 0; i < n; i++) {
    const fr = traceFlatRay(i, n, sa, it); flatRays.push(fr);
    if (fr.outcome==='absorbed') fAbs++; else if (fr.outcome==='reflected') fRefl++; else fTrans++;
    // ❌ NEVER use surfaceMode to decide which trace — geometry is always morpho
    const br = traceButterflyRay(i, n, sa, it);
    bflyRays.push(br);
    if (br.outcome==='absorbed') bAbs++; else if (br.outcome==='reflected') bRefl++; else bTrans++;
    totalBflyBounces += (br.bounces || 0); // accumulate internal interactions
  }
  // Internal Photon / Ray Trapping Index = total internal interactions / total rays
  const trappingIndex = totalBflyBounces / Math.max(1, n);
  // Publish shared stats + full outcome arrays for micro sim 1:1 correspondence
  window.rayStats = { flatAbs:fAbs/n, flatRefl:fRefl/n, flatTrans:fTrans/n, bflyAbs:bAbs/n, bflyRefl:bRefl/n, bflyTrans:bTrans/n,
    flatOutcomes: flatRays.map(r => r.outcome),
    bflyOutcomes: bflyRays.map(r => r.outcome) };
  return { flatRays, bflyRays, fAbs, fRefl, fTrans, bAbs, bRefl, bTrans,
    flatEff: fAbs/n, bflyEff: bAbs/n, gain: (bAbs-fAbs)/n,
    flatAbsorbed:fAbs, flatReflected:fRefl, flatTransmitted:fTrans,
    bflyAbsorbed:bAbs, bflyReflected:bRefl, bflyTransmitted:bTrans,
    trappingIndex };
}

/* ═══════════════════════════════════════════════════════════════
   §7  RAY VISUALIZATION — depthTest:false everywhere
═══════════════════════════════════════════════════════════════ */
const rayGroup = new THREE.Group(); scene.add(rayGroup);
let animRays = [];

function segColor(outcome, segIdx, N) {
  if (segIdx === 0) return 0xffdd00;  // yellow — incoming ray
  if (segIdx === 1) return 0xffcc00;  // gold — surface approach
  if (segIdx < N - 1) return 0xff8800; // orange — internal bounce
  if (outcome === 'absorbed')    return 0xff4422;  // red-orange → absorbed at base
  if (outcome === 'transmitted') return 0x44ff99;  // green → exits through bottom
  return 0x4488ff;                                  // blue → reflected outward
}

function makeRayMat(col, glow) {
  if (glow) return new THREE.LineBasicMaterial({ color: col, depthTest: false, depthWrite: false, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending });
  return new THREE.LineBasicMaterial({ color: col, depthTest: false, depthWrite: false, transparent: true, opacity: 1.0 });
}

/* ── Arrow: placed at segment midpoint, points along travel direction ── */
function makeArrowCone(p0, p1, col, sz) {
  sz = sz || 0.11;
  const dir = new THREE.Vector3().subVectors(p1, p0).normalize();
  if (dir.lengthSq() < 0.001) return null;
  // Place at 70% along segment — shows flow direction without cluttering endpoints
  const pos = new THREE.Vector3().lerpVectors(p0, p1, 0.70);
  const geo = new THREE.ConeGeometry(sz * 0.40, sz * 1.1, 5);
  const mat = new THREE.MeshBasicMaterial({ color: col, depthTest: false, depthWrite: false,
    transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending });
  const cone = new THREE.Mesh(geo, mat);
  cone.position.copy(pos);
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  cone.frustumCulled = false; cone.renderOrder = 1003; cone.visible = false;
  return cone;
}

function buildRayLines(data) {
  for (let k = animRays.length - 1; k >= 0; k--) {
    const o = animRays[k];
    if (o.segs) o.segs.forEach(s => { s.geo.dispose(); s.mat.dispose(); s.gMat.dispose(); rayGroup.remove(s.line); rayGroup.remove(s.gLine); });
    if (o.photon) { o.photon.geometry.dispose(); o.photon.material.dispose(); rayGroup.remove(o.photon); }
    if (o.dots)   o.dots.forEach(d => { if(d){d.geometry.dispose();d.material.dispose();rayGroup.remove(d);} });
    if (o.burst)  { o.burst.geometry.dispose(); o.burst.material.dispose(); rayGroup.remove(o.burst); }
    if (o.arrows) o.arrows.forEach(a => { a.geometry.dispose(); a.material.dispose(); rayGroup.remove(a); });
    if (o.impactRing) { o.impactRing.geometry.dispose(); o.impactRing.material.dispose(); rayGroup.remove(o.impactRing); }
    if (o.impactGlow) { o.impactGlow.geometry.dispose(); o.impactGlow.material.dispose(); rayGroup.remove(o.impactGlow); }
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
      const line  = new THREE.Line(geo, mat);  line.frustumCulled  = false; line.visible  = false; line.renderOrder  = 999; rayGroup.add(line);
      const gLine = new THREE.Line(geo, gMat); gLine.frustumCulled = false; gLine.visible = false; gLine.renderOrder = 998; rayGroup.add(gLine);
      segs.push({ geo, attr, buf, mat, gMat, line, gLine, p0: pts[si].clone(), p1: pts[si+1].clone() });
    }

    const photon = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false })
    );
    photon.frustumCulled = false; photon.visible = false; photon.renderOrder = 1001; rayGroup.add(photon);

    const dots = [];
    for (let pi = 1; pi < N; pi++) {
      const isEnd = pi === N - 1;
      const dcol  = isEnd ? (ray.outcome==='absorbed'?0xff4422:ray.outcome==='transmitted'?0x44ff99:0x4488ff) : (pi===1?0xffdd00:0xff8800);
      const dr    = isEnd ? 0.14 : (pi===1 ? 0.10 : 0.08);
      const dot   = new THREE.Mesh(
        new THREE.SphereGeometry(dr, 7, 7),
        new THREE.MeshBasicMaterial({ color: dcol, transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      dot.position.copy(pts[pi]); dot.renderOrder = 997; dot.frustumCulled = false;
      dot.userData.pi = pi; rayGroup.add(dot); dots.push(dot);
    }

    let burst = null;
    if (ray.outcome === 'absorbed' || ray.outcome === 'transmitted') {
      const bc = ray.outcome === 'absorbed' ? 0xff4422 : 0x44ff99;
      burst = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 10, 10),
        new THREE.MeshBasicMaterial({ color: bc, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false })
      );
      burst.position.copy(pts[N-1]); burst.frustumCulled = false; burst.renderOrder = 996; rayGroup.add(burst);
    }

    /* ── Impact marker ring at surface hit point (pts[1]) ── */
    const impactPos = pts[1];
    const impactRingGeo = new THREE.TorusGeometry(0.28, 0.04, 6, 20);
    const impactRingMat = new THREE.MeshBasicMaterial({
      color: 0xffd700, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false
    });
    const impactRing = new THREE.Mesh(impactRingGeo, impactRingMat);
    impactRing.rotation.x = Math.PI / 2; // lay flat on surface
    impactRing.position.copy(impactPos);
    impactRing.position.y += 0.01; // sit just above surface
    impactRing.frustumCulled = false; impactRing.renderOrder = 995;
    rayGroup.add(impactRing);

    /* Outer glow ring */
    const impactGlowGeo = new THREE.TorusGeometry(0.50, 0.06, 6, 20);
    const impactGlowMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false
    });
    const impactGlow = new THREE.Mesh(impactGlowGeo, impactGlowMat);
    impactGlow.rotation.x = Math.PI / 2;
    impactGlow.position.copy(impactPos);
    impactGlow.position.y += 0.01;
    impactGlow.frustumCulled = false; impactGlow.renderOrder = 994;
    rayGroup.add(impactGlow);

    /* ── Directional arrows — one per segment at midpoint ── */
    const arrowCol = ray.outcome==='absorbed' ? 0xff4422 : ray.outcome==='transmitted' ? 0x44ff99 : 0x4488ff;
    const arrows = [];
    for (let si = 0; si < N - 1; si++) {
      const a = makeArrowCone(pts[si], pts[si+1], arrowCol, 0.13);
      if (a) { rayGroup.add(a); arrows.push(a); }
    }

    const localIdx = ri % nPer;
    const tStart   = (localIdx / Math.max(nPer - 1, 1)) * STAGGER;
    animRays.push({ segs, pts, photon, dots, burst, arrows, impactRing, impactGlow, N, tStart, tEnd: tStart + (1 - STAGGER), outcome: ray.outcome, bounces: ray.bounces || 0 });
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
    if (ar.arrows) ar.arrows.forEach(a => { a.visible = true; a.material.opacity = 0.88; });
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
  // Arrows: reveal each segment's arrow as that segment finishes drawing
  if (ar.arrows && ar.arrows.length) {
    const nSegs2 = ar.segs.length;
    ar.arrows.forEach((a, si) => {
      const segDone = prog * nSegs2 > si + 0.9;
      a.visible = segDone;
      a.material.opacity = segDone ? 0.88 : 0;
    });
  }
  /* Impact marker: flash on when ray first touches surface (prog > 1/nSegs) then hold */
  if (ar.impactRing || ar.impactGlow) {
    const hitT = Math.max(0, Math.min(1, (prog * nSegs - 0.85) / 0.5));
    const holdT = prog >= 1 ? 1 : hitT;
    if (ar.impactRing) ar.impactRing.material.opacity = holdT * 0.90;
    if (ar.impactGlow) ar.impactGlow.material.opacity = holdT * 0.40;
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
    if (ar.arrows) ar.arrows.forEach(a => { a.visible = true; a.material.opacity = 0.88; });
    if (ar.impactRing) ar.impactRing.material.opacity = 0.90;
    if (ar.impactGlow) ar.impactGlow.material.opacity = 0.40;
  });
}

function hideAllRays() {
  animRays.forEach(ar => {
    ar.segs.forEach(s => { s.line.visible = s.gLine.visible = false; });
    ar.photon.visible = false;
    if (ar.burst) { ar.burst.material.opacity = 0; ar.burst.scale.setScalar(1); }
    if (ar.dots)  ar.dots.forEach(d => { d.material.opacity = 0; });
    if (ar.arrows) ar.arrows.forEach(a => { a.visible = false; });
    if (ar.impactRing) ar.impactRing.material.opacity = 0;
    if (ar.impactGlow) ar.impactGlow.material.opacity = 0;
  });
}

function tickAllRays(t) { animRays.forEach(ar => tickRay(ar, t)); }

/* ═══════════════════════════════════════════════════════════════
   §8  MICRO-VIEW CAMERA ANIMATION
═══════════════════════════════════════════════════════════════ */
let microMode = false;
const MACRO = { oT: 0.05, oP: 1.06, oR: 32, ocx: 0.0, ocy: 1.0, ocz: 0.0 };
const MICRO  = { oT: 0.05, oP: 1.12, oR: 3.2, ocx: BFLY_CX, ocy: 0.45, ocz: 0.0 };

/* ── Mode-switch camera targets (camera-ONLY, no geometry) ─────── */

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
  coronaSprite.material.opacity = 0.92 + Math.sin(pulseClock * 0.7) * 0.08;
  glowSprite.material.opacity   = 0.95 + Math.sin(pulseClock) * 0.05;
  coreSprite.scale.setScalar(7  + Math.sin(pulseClock * 1.2) * 0.4);
  sunCoreMesh.material.opacity  = 0.90 + Math.sin(pulseClock * 1.5) * 0.06;
  sunHaloMesh.material.opacity  = 0.16 + Math.sin(pulseClock * 0.8) * 0.08;
  sunPL.intensity = 2.6 + Math.sin(pulseClock) * 0.35;
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
  if (bflyGeom.nanoGroup) bflyGeom.nanoGroup.visible = (microMode || oR < 6) && simActive;
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

  /* ── Trapping Index live display ── */
  const ti = d.trappingIndex || 0;
  if ($el('trapIndex')) $el('trapIndex').textContent = ti.toFixed(2) + ' interactions/ray';
  const pctMeter = Math.min(100, (ti / 8) * 100); // 8 bounces = full bar
  if ($el('trapMeterFill')) $el('trapMeterFill').style.width = pctMeter.toFixed(1) + '%';
  if ($el('trapMeterHint')) {
    let hint = ti < 1.0 ? '⚠ Low Optical Confinement — rays exit quickly' : ti < 2.0 ? '◈ Moderate Light Trapping' : ti < 4.5 ? '✦ High Photon Confinement' : '⚡ Excellent Photon Confinement';
    $el('trapMeterHint').textContent = hint;
  }
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
  if (typeof window._microSimStart === 'function') window._microSimStart(window.rayStats, p.sunAngle, p.numRays);
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
   §12b  INFO MODAL SYSTEM
═══════════════════════════════════════════════════════════════ */
(function initInfoModal() {
  const overlay  = document.getElementById('infoOverlay');
  const btnOpen  = document.getElementById('btnInfoGlobal');
  const btnClose = document.getElementById('infoClose');
  if (!overlay || !btnOpen || !btnClose) return;

  function openModal(sectionId) {
    overlay.classList.add('open');
    btnOpen.classList.add('active');
    document.body.style.overflow = 'hidden';
    if (sectionId) {
      setTimeout(() => {
        const sec = document.getElementById(sectionId);
        if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 200);
    }
  }
  function closeModal() {
    overlay.classList.remove('open');
    btnOpen.classList.remove('active');
    document.body.style.overflow = '';
  }

  btnOpen.addEventListener('click', () => {
    if (overlay.classList.contains('open')) closeModal();
    else openModal(null);
  });
  btnClose.addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && overlay.classList.contains('open')) closeModal(); });

  // Superscript ℹ buttons
  const tooltip = document.getElementById('supTooltip');
  const TIP_CONTENT = {
    'pti':               '<strong>Photon Trapping Index (PTI)</strong> — measures how many times light interacts inside the structure per ray. A <em>rate</em>, not a %. Values &gt;1 are normal and desirable. Click for full explanation.',
    'structural-color':  '<strong>Structural Color</strong> — Morpho blue comes from nano-scale interference between thin-film lamellae, not pigment.',
    'abs-refl-trans':    '<strong>Absorption · Reflection · Transmission</strong> — what happens to each incoming photon. Only absorbed photons contribute to electrical energy.',
    'why-blue':          '<strong>Why Blue?</strong> — lamella spacing (~70–100 nm) constructively reflects wavelengths of 400–500 nm, producing vivid iridescent blue.',
    'optical-confinement': '<strong>Optical Confinement</strong> — the degree to which photons are kept inside the structure long enough to be absorbed, rather than escaping. Higher confinement = more absorption opportunities per photon.',
    'flat-baseline':     '<strong>Flat Silicon Baseline</strong> — a smooth silicon surface with no nanostructure. Photons reflect or absorb after a single surface interaction. PTI ≈ 0 because there is no multi-bounce trapping.',
    'simulation-iterations': '<strong>Simulation Iterations (Time Steps)</strong> — each iteration represents one full run of the ray-tracing physics engine. The PTI graph plots how the trapping index evolves across successive runs.',
    'internal-interactions': '<strong>Internal Photon Interactions</strong> — each time a ray bounces off a wall, spine, or floor inside the Morpho nanostructure cell before exiting or being absorbed. Counted per ray and averaged across all rays.',
  };

  document.querySelectorAll('.info-sup').forEach(sup => {
    sup.addEventListener('click', e => {
      e.stopPropagation();
      const section = sup.dataset.section || null;
      openModal(section);
    });
    sup.addEventListener('mouseenter', e => {
      const tip = TIP_CONTENT[sup.dataset.tip] || '';
      if (!tip) return;
      tooltip.innerHTML = tip;
      tooltip.classList.add('visible');
      const r = sup.getBoundingClientRect();
      const left = Math.min(r.left, window.innerWidth - 280);
      tooltip.style.left = left + 'px';
      tooltip.style.top  = (r.bottom + 6) + 'px';
    });
    sup.addEventListener('mouseleave', () => { tooltip.classList.remove('visible'); });
  });
}());

/* ═══════════════════════════════════════════════════════════════
   §12c  SECURE PDF PRESENTATION VIEWER
   - PDF.js canvas rendering (no direct file URL)
   - Right-click / text-selection disabled inside viewer
   - Page navigation, fullscreen, change PDF
═══════════════════════════════════════════════════════════════ */
(function initPDFViewer() {
  var fileInput    = document.getElementById('pdfFileInput');
  var uploadArea   = document.getElementById('pdfUploadArea');
  var viewerEl     = document.getElementById('pdfViewer');
  var canvas       = document.getElementById('pdfCanvas');
  var loading      = document.getElementById('pdfLoading');
  var pageInfoEl   = document.getElementById('pdfPageInfo');
  var filenameEl   = document.getElementById('pdfFilename');
  var btnPrev      = document.getElementById('btnPdfPrev');
  var btnNext      = document.getElementById('btnPdfNext');
  var btnFs        = document.getElementById('btnPdfFs');
  var canvasArea   = document.getElementById('pdfCanvasArea');
  if (!fileInput || !canvas) return;

  // Configure PDF.js worker
  if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  var pdfDoc    = null;
  var curPage   = 1;
  var totalPages = 0;
  var rendering = false;

  // ── Security: disable right-click & text-selection inside viewer ──
  if (viewerEl) {
    viewerEl.addEventListener('contextmenu', function(e) { e.preventDefault(); return false; });
    viewerEl.addEventListener('selectstart',  function(e) { e.preventDefault(); return false; });
    viewerEl.addEventListener('copy',         function(e) { e.preventDefault(); return false; });
    viewerEl.addEventListener('dragstart',    function(e) { e.preventDefault(); return false; });
  }

  function renderPage(num) {
    if (!pdfDoc || rendering) return;
    rendering = true;
    if (loading) loading.style.display = 'flex';

    pdfDoc.getPage(num).then(function(page) {
      // Scale to fill the canvas area width
      var areaW = canvasArea ? canvasArea.clientWidth - 40 : 900;
      var vp0   = page.getViewport({ scale: 1 });
      var scale = Math.min(areaW / vp0.width, 2.0);
      var vp    = page.getViewport({ scale: scale });

      canvas.width  = vp.width;
      canvas.height = vp.height;
      var ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      page.render({ canvasContext: ctx, viewport: vp }).promise.then(function() {
        rendering = false;
        if (loading) loading.style.display = 'none';
        updateNavState();
      });
    }).catch(function() {
      rendering = false;
      if (loading) loading.style.display = 'none';
    });

    if (pageInfoEl) pageInfoEl.textContent = 'Page ' + num + ' of ' + totalPages;
  }

  function updateNavState() {
    if (btnPrev) btnPrev.disabled = (curPage <= 1);
    if (btnNext) btnNext.disabled = (curPage >= totalPages);
  }

  function loadPDF(file) {
    if (!file || file.type !== 'application/pdf') {
      alert('Please select a valid PDF file.');
      return;
    }
    if (typeof pdfjsLib === 'undefined') {
      alert('PDF.js is not loaded. Please check your connection and reload.');
      return;
    }

    var reader = new FileReader();
    reader.onload = function(e) {
      // Use ArrayBuffer — never expose a file URL
      var typedArr = new Uint8Array(e.target.result);
      pdfjsLib.getDocument({ data: typedArr }).promise.then(function(pdf) {
        pdfDoc     = pdf;
        totalPages = pdf.numPages;
        curPage    = 1;

        // Switch view
        if (uploadArea) uploadArea.style.display = 'none';
        if (viewerEl)   viewerEl.style.display   = 'flex';
        if (filenameEl) filenameEl.textContent    = file.name.length > 32
          ? file.name.slice(0, 30) + '…' : file.name;

        renderPage(curPage);
      }).catch(function(err) {
        alert('Could not load PDF: ' + (err.message || 'Unknown error'));
      });
    };
    reader.readAsArrayBuffer(file);  // ArrayBuffer — no Blob URL created
  }

  if (fileInput) {
    fileInput.addEventListener('change', function(e) {
      var f = e.target.files && e.target.files[0];
      if (f) { loadPDF(f); fileInput.value = ''; }
    });
  }

  if (btnPrev) btnPrev.addEventListener('click', function() {
    if (curPage > 1) { curPage--; renderPage(curPage); }
  });
  if (btnNext) btnNext.addEventListener('click', function() {
    if (curPage < totalPages) { curPage++; renderPage(curPage); }
  });

  // Keyboard navigation
  document.addEventListener('keydown', function(e) {
    if (!pdfDoc) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      if (curPage < totalPages) { curPage++; renderPage(curPage); }
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      if (curPage > 1) { curPage--; renderPage(curPage); }
    }
  });

  if (btnFs) btnFs.addEventListener('click', function() {
    var el = viewerEl;
    if (!document.fullscreenElement) {
      (el.requestFullscreen || el.webkitRequestFullscreen || (function(){})).call(el);
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen || (function(){})).call(document);
    }
  });

  // Re-render on fullscreen change (canvas dimensions change)
  document.addEventListener('fullscreenchange', function() {
    if (pdfDoc) setTimeout(function(){ renderPage(curPage); }, 120);
  });

}());

/* ═══════════════════════════════════════════════════════════════
   §12  MICROSCOPIC SIMULATION — Three.js 3D scene
   True geometry: ridges (spines) + lamellae (horizontal shelves).
   Rays computed via slab/wall intersection math, rendered as 3D Lines.
   Orbit: left-drag rotates, right-drag pans, scroll zooms, dbl-click resets.
═══════════════════════════════════════════════════════════════ */
requestAnimationFrame(() => requestAnimationFrame(() => {
(function initMicroSim() {

  const mc = document.getElementById('microCanvas');
  if (!mc || typeof THREE === 'undefined') return;

  /* ── Renderer ─────────────────────────────────────────────── */
  const renderer = new THREE.WebGLRenderer({ canvas: mc, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x020408, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.90; // was 1.35 — reduced to fix over-bright morpho view

  const scene = new THREE.Scene();
  // Match main sim fog — does NOT affect depthTest:false ray lines
  scene.fog = new THREE.FogExp2(0x030610, 0.006);

  /* ── Camera + orbit state ─────────────────────────────────── */
  // near=0.001 matches main sim — eliminates near-clip ray disappearance
  const camera = new THREE.PerspectiveCamera(45, 2, 0.001, 500);
  const orb = { theta: 0.18, phi: 1.08, r: 24, tx: 0, ty: 2.0, tz: 0 };

  function camSync() {
    const st = Math.sin(orb.theta), ct = Math.cos(orb.theta);
    const sp = Math.sin(orb.phi),   cp = Math.cos(orb.phi);
    camera.position.set(
      orb.tx + orb.r * sp * st,
      orb.ty + orb.r * cp,
      orb.tz + orb.r * sp * ct
    );
    camera.lookAt(orb.tx, orb.ty, orb.tz);
  }
  camSync();

  /* ── Resize ───────────────────────────────────────────────── */
  function resize() {
    const w = mc.clientWidth  || mc.offsetWidth  || 900;
    const h = mc.clientHeight || mc.offsetHeight || 520;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', () => { resize(); camSync(); });

  /* ── Orbit controls (pointer-based) ──────────────────────── */
  const ptr = { down: false, btn: 0, lx: 0, ly: 0, pinchD: 0 };

  mc.style.touchAction = 'none';
  mc.addEventListener('pointerdown', e => {
    ptr.down = true; ptr.btn = e.button;
    ptr.lx = e.clientX; ptr.ly = e.clientY;
    mc.setPointerCapture(e.pointerId);
  });
  mc.addEventListener('pointermove', e => {
    if (!ptr.down) return;
    const dx = e.clientX - ptr.lx, dy = e.clientY - ptr.ly;
    ptr.lx = e.clientX; ptr.ly = e.clientY;
    if (ptr.btn === 0) {
      // Orbit rotate
      orb.theta -= dx * 0.008;
      orb.phi = Math.max(0.08, Math.min(Math.PI * 0.90, orb.phi + dy * 0.008));
    } else {
      // Pan (right-drag or middle-drag)
      const right = new THREE.Vector3(), up = new THREE.Vector3(), fwd = new THREE.Vector3();
      camera.matrix.extractBasis(right, up, fwd);
      const scale = orb.r * 0.0016;
      orb.tx -= right.x * dx * scale;
      orb.ty += up.y    * dy * scale;
      orb.tz -= right.z * dx * scale;
    }
    camSync();
  });
  mc.addEventListener('pointerup',    () => { ptr.down = false; });
  mc.addEventListener('pointercancel',() => { ptr.down = false; });
  mc.addEventListener('wheel', e => {
    e.preventDefault();
    // min=0.8 matches main sim R_LO — no premature zoom-out clamp
    orb.r = Math.max(0.8, Math.min(60, orb.r * (e.deltaY > 0 ? 1.09 : 0.92)));
    camSync();
  }, { passive: false });
  mc.addEventListener('dblclick', () => {
    Object.assign(orb, { theta: 0.18, phi: 1.08, r: 24, tx: 0, ty: 2.0, tz: 0 });
    camSync();
  });

  /* ── Lighting — matches main sim balance ─────────────────── */
  scene.add(new THREE.HemisphereLight(0x0f1d40, 0x040608, 0.40));
  scene.add(new THREE.AmbientLight(0x0a1020, 0.28));

  const keyLight = new THREE.DirectionalLight(0x4070cc, 0.52);
  keyLight.position.set(-6, 16, 5); scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x002040, 0.25);
  rimLight.position.set(14, 3, -6); scene.add(rimLight);

  // Panel accent points — tuned for micro scale, kept dim to avoid over-exposure
  const morphoGlow = new THREE.PointLight(0xaa44ff, 0.85, 18); // was 2.2 — reduced for visual clarity
  morphoGlow.position.set(5.5, 2.0, 0); scene.add(morphoGlow);
  const flatGlow = new THREE.PointLight(0x00aacc, 0.75, 18); // was 1.6 — matched reduction
  flatGlow.position.set(-5.5, 1.0, 0); scene.add(flatGlow);

  /* ── Scene constants ──────────────────────────────────────── */
  const FLAT_CX = -5.5;   // flat silicon panel centre X
  const MORPH_CX =  5.5;  // morpho panel centre X
  const PW      =  7.0;   // panel X-width
  const PD      =  4.2;   // panel Z-depth (±PD/2)
  const SLAB_BOT = -0.65; // bottom of flat slab
  const MH      =  2.8;   // morpho ridge height
  const N_SP    =  7;     // number of spines
  const SP_W    =  0.15;  // spine X-width
  const SP_D    =  PD * 0.78; // spine Z-depth
  const SP_STEP =  PW / (N_SP - 1);
  const N_RIB   =  9;     // lamellae per inter-spine gap
  const RIB_H   =  0.075; // lamella Y-height
  const RT      =  8.8;   // ray source Y-height

  const spineXs = Array.from({ length: N_SP },  (_, i) => MORPH_CX - PW / 2 + i * SP_STEP);
  const ribYs   = Array.from({ length: N_RIB },  (_, l) => (l + 0.5) / N_RIB * MH);

  /* ── Materials — fully solid, physically-based (no transparency) ─── */
  const matSlab    = new THREE.MeshStandardMaterial({ color: 0x0b2240, roughness: 0.50, metalness: 0.15, emissive: 0x001e36, emissiveIntensity: 0.22 });
  const matARC     = new THREE.MeshStandardMaterial({ color: 0x00ccff, emissive: 0x009fcc, emissiveIntensity: 0.35, roughness: 0.20, metalness: 0.10 });
  const matFingers = new THREE.MeshStandardMaterial({ color: 0x6088a8, roughness: 0.50, metalness: 0.15 });
  const matBase    = new THREE.MeshStandardMaterial({ color: 0x0e0228, roughness: 0.55, metalness: 0.15, emissive: 0x080118, emissiveIntensity: 0.18 });
  const matSpine   = new THREE.MeshStandardMaterial({ color: 0x1e0440, roughness: 0.45, metalness: 0.15, emissive: 0x160330, emissiveIntensity: 0.40 });
  const matCap     = new THREE.MeshBasicMaterial({ color: 0xcc55ff, transparent: true, opacity: 0.90, blending: THREE.AdditiveBlending, depthWrite: false });
  const matLam     = new THREE.MeshStandardMaterial({ color: 0x2e0660, roughness: 0.50, metalness: 0.12, emissive: 0x1e0448, emissiveIntensity: 0.35 });
  const matDiv     = new THREE.MeshBasicMaterial({ color: 0x1e3060, transparent: true, opacity: 0.30, side: THREE.DoubleSide });

  /* ── Build flat silicon slab ─────────────────────────────── */
  (function buildFlat() {
    const g = new THREE.Group();

    // Main slab body
    const slabM = new THREE.Mesh(new THREE.BoxGeometry(PW, 0.65, PD), matSlab);
    slabM.position.set(FLAT_CX, SLAB_BOT + 0.325, 0);
    slabM.renderOrder = 1;
    g.add(slabM);

    // ARC anti-reflection coating layer (thin teal strip at y=0)
    const arcM = new THREE.Mesh(new THREE.BoxGeometry(PW, 0.045, PD), matARC);
    arcM.position.set(FLAT_CX, 0.022, 0);
    arcM.renderOrder = 2;
    g.add(arcM);

    // Finger contact lines (thin vertical ribs inside slab)
    for (let i = 1; i < 6; i++) {
      const fx = FLAT_CX - PW / 2 + i * PW / 6;
      const fm = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.67, PD), matFingers);
      fm.position.set(fx, SLAB_BOT + 0.33, 0);
      fm.renderOrder = 2;
      g.add(fm);
    }

    scene.add(g);
  }());

  /* ── Build morpho butterfly lattice — SEM-accurate Christmas-tree ridges ─── */
  (function buildMorpho() {
    const g = new THREE.Group();

    // ── Continuous flat base layer (light-absorbing substrate at Y = 0) ──────
    const baseM = new THREE.Mesh(new THREE.BoxGeometry(PW, 0.55, PD), matBase);
    baseM.position.set(MORPH_CX, -0.275, 0);
    baseM.renderOrder = 1;
    g.add(baseM);

    // Thin glowing interface at Y=0 — marks the absorbing surface
    const baseIface = new THREE.Mesh(
      new THREE.BoxGeometry(PW, 0.048, PD),
      new THREE.MeshStandardMaterial({
        color: 0x1e0550, roughness: 0.38, metalness: 0.20,
        emissive: 0x100330, emissiveIntensity: 0.32
      })
    );
    baseIface.position.set(MORPH_CX, 0.024, 0);
    baseIface.renderOrder = 2;
    g.add(baseIface);

    // ── Precompute gap geometry (used by both geometry and ray tracing) ──────
    const GAP_W = SP_STEP - SP_W; // open width between adjacent spine centres

    // Branch half-width at height y: wide at bottom (Christmas-tree taper), narrow at top
    // Matches the brHW() used in buildMorphoRays — must stay in sync.
    function bHW(y) {
      const frac = Math.max(0, Math.min(1, y / MH)); // 0 = floor, 1 = top
      return GAP_W * (0.29 * (1.0 - frac) + 0.11 * frac);
    }

    const SPINE_VIS_W = SP_W * 0.72; // visually thinner spine (more realistic)

    for (let si = 0; si < N_SP; si++) {
      const sx = spineXs[si];

      // ── Central spine pillar (full ridge height, narrower than old solid block) ──
      const spineM = new THREE.Mesh(
        new THREE.BoxGeometry(SPINE_VIS_W, MH, SP_D * 0.90), matSpine
      );
      spineM.position.set(sx, MH / 2, 0);
      spineM.renderOrder = 2;
      g.add(spineM);

      // Glowing tip cap — tapers to a sharp crown
      const capM = new THREE.Mesh(
        new THREE.BoxGeometry(SPINE_VIS_W + 0.06, 0.09, SP_D * 0.90 + 0.05), matCap
      );
      capM.position.set(sx, MH + 0.045, 0);
      capM.renderOrder = 5;
      g.add(capM);

      // ── Branches (lamellae) attached to BOTH sides of each spine ─────────────
      // Like a real Morpho SEM cross-section: each ridge has horizontal shelves
      // extending left and right, widest at the base, narrowing toward the tip.
      for (let l = 0; l < N_RIB; l++) {
        const ry   = ribYs[l];
        const hw   = bHW(ry);                              // half-width at this level
        const ribD = SP_D * (0.90 - (l / (N_RIB - 1)) * 0.18); // shorter toward top

        // Left branch — skip on leftmost spine (no gap to its left)
        if (si > 0) {
          const maxLW = (spineXs[si] - spineXs[si - 1]) * 0.48;
          const lbW   = Math.min(hw, maxLW);
          const lb    = new THREE.Mesh(new THREE.BoxGeometry(lbW, RIB_H, ribD), matLam);
          lb.position.set(sx - SPINE_VIS_W * 0.5 - lbW * 0.5, ry, 0);
          lb.renderOrder = 4;
          g.add(lb);
        }

        // Right branch — skip on rightmost spine (no gap to its right)
        if (si < N_SP - 1) {
          const maxRW = (spineXs[si + 1] - spineXs[si]) * 0.48;
          const rbW   = Math.min(hw, maxRW);
          const rb    = new THREE.Mesh(new THREE.BoxGeometry(rbW, RIB_H, ribD), matLam);
          rb.position.set(sx + SPINE_VIS_W * 0.5 + rbW * 0.5, ry, 0);
          rb.renderOrder = 4;
          g.add(rb);
        }
      }
    }

    scene.add(g);
  }());

  /* ── Divider plane between the two panels ─────────────────── */
  (function buildDivider() {
    const dm = new THREE.Mesh(new THREE.PlaneGeometry(0.018, MH + 3.0), matDiv);
    dm.position.set(0, MH / 2, 0);
    scene.add(dm);
  }());

  /* ── Ground grid + starfield — match main sim atmosphere ─── */
  (function buildBackground() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 160),
      new THREE.MeshStandardMaterial({ color: 0x03050c, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2; ground.position.y = -1.2;
    ground.receiveShadow = true; scene.add(ground);

    const grid = new THREE.GridHelper(80, 48, 0x060a20, 0x040714);
    grid.position.y = -1.18; scene.add(grid);

    // Stars
    const N = 320, pos = new Float32Array(N * 3);
    let s = 0xDEADBEEF;
    const lcg = () => { s = (s * 1664525 + 1013904223) & 0xFFFFFFFF; return (s >>> 0) / 0x100000000; };
    for (let i = 0; i < N; i++) { pos[i*3]=lcg()*140-70; pos[i*3+1]=lcg()*55+12; pos[i*3+2]=-(lcg()*70+25); }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.06, transparent: true, opacity: 0.50 })));
  }());

  /* ── Micro-scene sun object ───────────────────────────────── */
  function makeSunTexMicro(sz, stops) {
    const cv = document.createElement('canvas'); cv.width = cv.height = sz;
    const ctx = cv.getContext('2d'), cx2 = sz / 2;
    const g2 = ctx.createRadialGradient(cx2, cx2, 0, cx2, cx2, cx2);
    stops.forEach(([t, c]) => g2.addColorStop(t, c));
    ctx.fillStyle = g2; ctx.fillRect(0, 0, sz, sz);
    return new THREE.CanvasTexture(cv);
  }

  const microSunGroup = new THREE.Group();
  // Corona
  microSunGroup.add(Object.assign(new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeSunTexMicro(256, [[0,'rgba(255,255,230,0)'],[0.3,'rgba(255,200,50,.28)'],[0.6,'rgba(255,110,10,.18)'],[1,'rgba(0,0,0,0)']]),
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true
  })), { renderOrder: 2 }));
  microSunGroup.children[0].scale.set(12, 12, 1);
  // Core disc
  const microSunCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xfffbe0, depthWrite: false, transparent: true, opacity: 0.96 })
  );
  microSunCore.renderOrder = 1004; microSunGroup.add(microSunCore);
  // Sun label
  const microSunLabel = (() => {
    const c2 = document.createElement('canvas'); c2.width = 256; c2.height = 48;
    const cx2 = c2.getContext('2d');
    cx2.fillStyle = 'rgba(255,240,100,0.85)'; cx2.font = 'bold 20px Arial';
    cx2.textAlign = 'center'; cx2.textBaseline = 'middle';
    cx2.fillText('☀ SUN', 128, 24);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c2), transparent: true, depthTest: false }));
    spr.scale.set(2.8, 0.55, 1); spr.renderOrder = 1005; return spr;
  })();
  microSunLabel.position.set(0, 1.0, 0); microSunGroup.add(microSunLabel);
  // Rays/spikes from micro sun
  const microSpkMat = new THREE.LineBasicMaterial({ color: 0xffdd44, transparent: true, opacity: 0.38, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let si = 0; si < 8; si++) {
    const a = (si / 8) * Math.PI * 2;
    const geo2 = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(Math.cos(a)*1.1, Math.sin(a)*1.1, 0),
      new THREE.Vector3(Math.cos(a)*2.6, Math.sin(a)*2.6, 0),
    ]);
    microSunGroup.add(new THREE.Line(geo2, microSpkMat));
  }
  const microSunPL = new THREE.PointLight(0xfff0cc, 0.9, 40, 1.5);
  microSunGroup.add(microSunPL);
  microSunGroup.visible = false;
  scene.add(microSunGroup);

  // Reference dashed line from sun to panel (angle guide)
  let microSunBeamLine = null;
  const microSunBeamMat = new THREE.LineBasicMaterial({ color: 0xffdd44, transparent: true, opacity: 0.16, depthTest: false, depthWrite: false });

  function moveMicroSun(deg) {
    const rad = deg * Math.PI / 180;
    const D = 20; // constant radius arc
    // x = D·sinθ, y = D·cosθ — exactly mirrors main sim moveSun formula
    const sx  = Math.sin(rad) * D;
    const sy  = Math.cos(rad) * D * 0.70 + MH + 1.0;
    const sz2 = -9;
    microSunGroup.position.set(sx, sy, sz2);
    microSunGroup.visible = true;

    // Guide beam from sun → centre of structure
    if (microSunBeamLine) { scene.remove(microSunBeamLine); microSunBeamLine.geometry.dispose(); }
    const beamGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(sx, sy, sz2),
      new THREE.Vector3(0, MH * 0.5, 0)
    ]);
    microSunBeamLine = new THREE.Line(beamGeo, microSunBeamMat);
    microSunBeamLine.frustumCulled = false; microSunBeamLine.renderOrder = 990;
    scene.add(microSunBeamLine);
  }

  /* ── Floating text labels — match main sim style ─────────── */
  function makeLabel(text, color) {
    const cw = 800, ch = 80, c2 = document.createElement('canvas');
    c2.width = cw; c2.height = ch;
    const cx2 = c2.getContext('2d');
    cx2.fillStyle = 'rgba(3,5,14,0.82)';
    if (cx2.roundRect) { cx2.beginPath(); cx2.roundRect(4,4,cw-8,ch-8,10); cx2.fill(); }
    else { cx2.fillRect(4,4,cw-8,ch-8); }
    cx2.strokeStyle = color; cx2.lineWidth = 3;
    if (cx2.roundRect) { cx2.beginPath(); cx2.roundRect(4,4,cw-8,ch-8,10); cx2.stroke(); }
    else { cx2.strokeRect(4,4,cw-8,ch-8); }
    cx2.fillStyle = color; cx2.font = 'bold 32px Rajdhani, Arial, sans-serif';
    cx2.textAlign = 'center'; cx2.textBaseline = 'middle';
    cx2.shadowColor = 'rgba(0,0,0,.95)'; cx2.shadowBlur = 8;
    cx2.fillText(text, cw / 2, ch / 2);
    const tex = new THREE.CanvasTexture(c2);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
    const spr = new THREE.Sprite(mat);
    spr.scale.set(9.0, 1.15, 1);
    return spr;
  }
  const lblFlat = makeLabel('FLAT SILICON — Single Interaction', '#00d4ff');
  lblFlat.position.set(FLAT_CX, RT + 0.6, 0);
  scene.add(lblFlat);
  const lblMorph = makeLabel('MORPHO LATTICE — Multi-Bounce Trapping', '#cc55ff');
  lblMorph.position.set(MORPH_CX, RT + 0.6, 0);
  scene.add(lblMorph);

  /* ── Ray colour palette ───────────────────────────────────── */
  const RCOL = {
    incoming:    0xffdd00,
    bounce0:     0xff9900,
    bounce1:     0xff7700,
    bounce2:     0xff5500,
    absorbed:    0xff4422,  // red → absorbed at base
    reflected:   0x4488ff,  // blue → exits upward
    transmitted: 0x44ff99,  // green → exits bottom
  };
  function bounceColor(b) {
    return [RCOL.bounce0, RCOL.bounce1, RCOL.bounce2][Math.min(b, 2)];
  }

  /* ── Ray object pool ──────────────────────────────────────── */
  let rayObjects = [];
  function clearRays() {
    rayObjects.forEach(o => {
      scene.remove(o);
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    rayObjects = [];
  }

  /* makeRayMat: identical API to main sim §7 ────────────────── */
  function makeRayMat(col, glow) {
    if (glow) return new THREE.LineBasicMaterial({ color: col, depthTest: false, depthWrite: false, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending });
    return      new THREE.LineBasicMaterial({ color: col, depthTest: false, depthWrite: false, transparent: true, opacity: 1.0 });
  }

  /* photon-head radial sprite texture (shared) */
  const _dotTex = (() => {
    const c2 = document.createElement('canvas'); c2.width = 64; c2.height = 64;
    const cx2 = c2.getContext('2d');
    const g2 = cx2.createRadialGradient(32,32,0,32,32,32);
    g2.addColorStop(0,'rgba(255,255,255,1)'); g2.addColorStop(1,'rgba(255,255,255,0)');
    cx2.fillStyle = g2; cx2.fillRect(0,0,64,64);
    return new THREE.CanvasTexture(c2);
  })();

  function makeDot(pos, hexColor) {
    const mat = new THREE.SpriteMaterial({ map: _dotTex, color: hexColor, transparent: true, opacity: 0.92, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending });
    const spr = new THREE.Sprite(mat);
    spr.position.set(...pos);
    spr.scale.set(0.28, 0.28, 1);
    spr.renderOrder = 997;
    scene.add(spr);
    rayObjects.push(spr);
    return spr;
  }

  /* ── Build ray segment data ───────────────────────────────── */
  let allSegments = []; // { p0:[x,y,z], p1:[x,y,z], col:hex }
  let lastStats    = null;
  let lastSunAngle = 45;
  let lastNumRays  = 8; // matches main sim default

  function buildFlatRays(flatOuts, sunAngle) {
    const segsOut = [];
    const SPREAD = 5; // ±degrees spread around sun angle
    const N_FLAT = flatOuts.length;
    for (let ri = 0; ri < N_FLAT; ri++) {
      const f    = N_FLAT > 1 ? ri / (N_FLAT - 1) : 0.5;
      // Use sun angle for ray direction — LOCKED to main sim sunAngle
      const ang  = ((sunAngle || 45) + SPREAD * (f - 0.5)) * Math.PI / 180;
      const rdx  = Math.sin(ang), cosA = Math.cos(ang);
      // Hit point spread across flat panel surface
      const hx   = FLAT_CX - PW * 0.43 + f * PW * 0.86;
      const hz   = (f - 0.5) * PD * 0.46;
      // Back-project from hit point along ray to find source position
      const ex   = hx - rdx * (RT / Math.max(cosA, 0.05));
      const ez   = hz;
      const out  = flatOuts[ri];
      const raySeg = [];

      // Incoming ray from sun source to surface
      raySeg.push({ p0: [ex, RT, ez], p1: [hx, 0, hz], col: RCOL.incoming });

      if (out === 'reflected') {
        // Reflect off surface: specular reflection, angle out = angle in
        raySeg.push({ p0: [hx, 0, hz], p1: [hx + rdx * 3.8, cosA * 3.8, hz], col: RCOL.reflected });
      } else if (out === 'absorbed') {
        // Penetrate slab, terminate at depth proportional to index
        const depth = 0.10 + (ri / N_FLAT) * 0.50;
        raySeg.push({ p0: [hx, 0, hz], p1: [hx + rdx * depth * 0.18, -Math.min(depth, SLAB_BOT * -0.95), hz], col: RCOL.absorbed });
      } else {
        // Transmitted: pass through entire slab and exit bottom
        raySeg.push({ p0: [hx, 0, hz], p1: [hx + rdx * 0.14, SLAB_BOT * 0.92, hz], col: RCOL.transmitted });
        raySeg.push({ p0: [hx + rdx * 0.14, SLAB_BOT * 0.92, hz], p1: [hx + rdx * 0.26, SLAB_BOT - 0.40, hz], col: RCOL.transmitted });
      }
      segsOut.push(...raySeg);
    }
    return segsOut;
  }

  function buildMorphoRays(bflyOuts, sunAngle) {
    const segsOut = [];
    const N      = bflyOuts.length;
    const SPREAD = 4;

    for (let ri = 0; ri < N; ri++) {
      const f    = N > 1 ? ri / (N - 1) : 0.5;
      const ang  = ((sunAngle || 45) + SPREAD * (f - 0.5)) * Math.PI / 180;
      const dx0  = Math.sin(ang);
      const dy0  = -Math.cos(ang);
      const fate = bflyOuts[ri];

      const vi   = Math.floor(f * (N_SP - 1)) % (N_SP - 1);
      const lx   = spineXs[vi]     + SP_W * 0.5;
      const rx   = spineXs[vi + 1] - SP_W * 0.5;
      const gapW = rx - lx;

      const hx   = lx + (0.15 + f * 0.70) * gapW;
      const hz   = (f - 0.5) * PD * 0.40;
      const ex   = hx - dx0 * ((RT - MH) / Math.max(Math.abs(dy0), 0.05));
      const segs = [];

      segs.push({ p0: [ex, RT, hz], p1: [hx, MH, hz], col: RCOL.incoming });

      const clampX = x => Math.max(lx + 0.04, Math.min(rx - 0.04, x));

      // ── REFLECTED: enter → 1 bounce in upper half → exit top. NEVER hits floor ──
      if (fate === 'reflected') {
        const b1y  = MH * (0.60 + f * 0.22);
        const tW   = Math.abs((dx0 >= 0 ? rx : lx) - hx) / Math.max(Math.abs(dx0), 0.05);
        const tD   = (MH - b1y) / Math.max(Math.abs(dy0), 0.05);
        const t1   = Math.min(tW, tD);
        const b1x  = clampX(hx + dx0 * t1);
        const b1yc = Math.max(MH * 0.45, Math.min(MH - 0.06, b1y));

        segs.push({ p0: [hx, MH, hz],  p1: [b1x, b1yc, hz], col: RCOL.incoming });

        const rdx1  = -dx0 * 0.55;
        const rdy1  = Math.abs(dy0) * 0.90 + 0.18;
        const norm1 = Math.sqrt(rdx1*rdx1 + rdy1*rdy1);
        const ndx1  = rdx1/norm1, ndy1 = rdy1/norm1;
        const tTop  = (MH - b1yc) / Math.max(ndy1, 0.05);
        const exitX = clampX(b1x + ndx1 * tTop);

        segs.push({ p0: [b1x, b1yc, hz], p1: [exitX, MH, hz],                             col: RCOL.bounce0   });
        segs.push({ p0: [exitX, MH, hz], p1: [exitX + ndx1*2.8, MH + ndy1*2.8, hz],       col: RCOL.reflected });
      }

      // ── TRANSMITTED: straight-through, minimal deflection, exits floor then below ──
      else if (fate === 'transmitted') {
        const midX = clampX(hx + dx0 * MH * 0.22);
        segs.push({ p0: [hx, MH, hz],              p1: [midX, 0, hz],                  col: RCOL.incoming    });
        segs.push({ p0: [midX, 0, hz],             p1: [midX + dx0*0.25, -0.38, hz],   col: RCOL.transmitted });
        segs.push({ p0: [midX + dx0*0.25, -0.38, hz], p1: [midX + dx0*0.50, -0.85, hz], col: RCOL.transmitted });
      }

      // ── ABSORBED: 2-3 wall bounces with downward bias → guaranteed floor hit ──
      else {
        const wallX1 = dx0 >= 0 ? rx : lx;
        const tW1    = Math.abs(wallX1 - hx) / Math.max(Math.abs(dx0), 0.05);
        const b1yc   = Math.max(MH*0.12, Math.min(MH*0.90, MH + dy0 * tW1));
        const b1x    = clampX(wallX1);

        segs.push({ p0: [hx, MH, hz], p1: [b1x, b1yc, hz], col: RCOL.incoming });

        const dx2  = -dx0;
        const dy2r = dy0 - 0.22;
        const n2   = Math.sqrt(dx2*dx2 + dy2r*dy2r);
        const dx2n = dx2/n2, dy2n = dy2r/n2;

        const wallX2  = dx2n > 0 ? rx : lx;
        const tW2     = Math.abs(wallX2 - b1x) / Math.max(Math.abs(dx2n), 0.05);
        const tF2     = b1yc / Math.max(Math.abs(dy2n), 0.05);

        if (tF2 <= tW2) {
          const fX = clampX(b1x + dx2n * tF2);
          segs.push({ p0: [b1x, b1yc, hz], p1: [fX, 0, hz],     col: RCOL.bounce0 });
          segs.push({ p0: [fX, 0, hz],     p1: [fX, -0.14, hz], col: RCOL.absorbed });
        } else {
          const b2x  = clampX(wallX2);
          const b2yc = Math.max(0.06, b1yc + dy2n * tW2);
          segs.push({ p0: [b1x, b1yc, hz], p1: [b2x, b2yc, hz], col: RCOL.bounce0 });

          const dx3  = -dx2n;
          const dy3r = dy2n - 0.15;
          const n3   = Math.sqrt(dx3*dx3 + dy3r*dy3r);
          const dx3n = dx3/n3, dy3n = dy3r/n3;
          const tF3  = b2yc / Math.max(Math.abs(dy3n), 0.05);
          const fX3  = clampX(b2x + dx3n * tF3);

          segs.push({ p0: [b2x, b2yc, hz], p1: [fX3, 0, hz],      col: RCOL.bounce1 });
          segs.push({ p0: [fX3, 0, hz],    p1: [fX3, -0.14, hz],  col: RCOL.absorbed });
        }
      }

      segsOut.push(...segs);
    }
    return segsOut;
  }

  function buildAllSegments(stats, sunAngle, numRays) {
    const N = Math.max(2, Math.min(numRays || 8, 16)); // cap at 16 for display clarity

    let flatOuts, bflyOuts;

    if (stats && stats.flatOutcomes && stats.flatOutcomes.length >= N) {
      // 1:1 exact correspondence — same ray index → same fate as main sim
      flatOuts = Array.from({ length: N }, (_, i) => stats.flatOutcomes[i] || 'absorbed');
      bflyOuts = Array.from({ length: N }, (_, i) => stats.bflyOutcomes[i] || 'absorbed');
    } else {
      // Fallback: deterministic allocation from fractions, R+A+T = N exactly
      const fa = stats ? stats.flatAbs   : 0.50;
      const fr = stats ? stats.flatRefl  : 0.32;
      const ft = stats ? stats.flatTrans : 0.18;
      const ba = stats ? stats.bflyAbs   : 0.75;
      const br = stats ? stats.bflyRefl  : 0.13;
      const bt = stats ? stats.bflyTrans : 0.12;

      function exactAlloc(tot, rFrac, aFrac, tFrac) {
        const sum = rFrac + aFrac + tFrac || 1;
        const nR = Math.min(tot, Math.max(0, Math.round(tot * rFrac / sum)));
        const nA = Math.min(tot - nR, Math.max(0, Math.round(tot * aFrac / sum)));
        const nT = tot - nR - nA;
        return { nR, nA, nT };
      }

      const fA = exactAlloc(N, fr, fa, ft);
      const bA = exactAlloc(N, br, ba, bt);
      flatOuts = Array.from({ length: N }, (_, i) =>
        i < fA.nR ? 'reflected' : i < fA.nR + fA.nA ? 'absorbed' : 'transmitted');
      bflyOuts = Array.from({ length: N }, (_, i) =>
        i < bA.nR ? 'reflected' : i < bA.nR + bA.nA ? 'absorbed' : 'transmitted');
    }

    const flatSegs  = buildFlatRays(flatOuts,  sunAngle);
    const morphSegs = buildMorphoRays(bflyOuts, sunAngle);

    // Tag every segment with its ray's fate (for filter overlay)
    // Flat: N rays × avg ~2 segs each. Morpho same.
    // We tag by propagating outcome across all segments of each ray.
    function tagSegs(segs, outs) {
      // Segment groups correspond to outs[] in order — detect boundaries by colour reset to RCOL.incoming
      let rayIdx = 0;
      segs.forEach((seg, si) => {
        if (si > 0 && seg.col === RCOL.incoming && segs[si-1].col !== RCOL.incoming) rayIdx++;
        seg.fate = outs[Math.min(rayIdx, outs.length - 1)];
      });
    }
    tagSegs(flatSegs,  flatOuts);
    tagSegs(morphSegs, bflyOuts);

    allSegments = [...flatSegs, ...morphSegs];
  }

  /* ── Animated Line objects — double-line like main sim ───── */
  let segLines = [];

  /* ── Micro arrowhead cone at segment terminus ─────────────── */
  function makeMicroArrow(p0arr, p1arr, col) {
    const p0 = new THREE.Vector3(...p0arr), p1 = new THREE.Vector3(...p1arr);
    const dir = new THREE.Vector3().subVectors(p1, p0).normalize();
    if (dir.lengthSq() < 0.001) return null;
    // 70% along segment — shows flow direction without cluttering endpoints
    const pos = new THREE.Vector3().lerpVectors(p0, p1, 0.70);
    const geo = new THREE.ConeGeometry(0.09, 0.32, 5);
    const mat = new THREE.MeshBasicMaterial({ color: col, depthTest: false, depthWrite: false,
      transparent: true, opacity: 0, blending: THREE.AdditiveBlending });
    const cone = new THREE.Mesh(geo, mat);
    cone.position.copy(pos);
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    cone.frustumCulled = false; cone.renderOrder = 1003; cone.visible = true;
    scene.add(cone); rayObjects.push(cone);
    return cone;
  }

  function createSegLines() {
    clearRays();
    segLines = allSegments.map(seg => {
      // Dynamic buffer so we can animate the tip
      const buf  = new Float32Array([seg.p0[0], seg.p0[1], seg.p0[2], seg.p0[0], seg.p0[1], seg.p0[2]]);
      const attr = new THREE.BufferAttribute(buf, 3); attr.setUsage(THREE.DynamicDrawUsage);
      const geo  = new THREE.BufferGeometry(); geo.setAttribute('position', attr);

      // Core line
      const mat  = makeRayMat(seg.col, false);
      const line = new THREE.Line(geo, mat);
      line.frustumCulled = false; // CRITICAL — prevents disappearance at close zoom
      line.renderOrder   = 999;
      line.visible       = false;
      scene.add(line); rayObjects.push(line);

      // Additive glow line (same geometry, rendered behind core)
      const gMat  = makeRayMat(seg.col, true);
      const gLine = new THREE.Line(geo, gMat);
      gLine.frustumCulled = false;
      gLine.renderOrder   = 998;
      gLine.visible       = false;
      scene.add(gLine); rayObjects.push(gLine);

      return { line, gLine, mat, gMat, geo, attr, buf,
               p0: new THREE.Vector3(...seg.p0),
               p1: new THREE.Vector3(...seg.p1),
               fate: seg.fate || 'absorbed',
               arrow: makeMicroArrow(seg.p0, seg.p1, seg.col),
               isFinal: seg.isFinal || false };
    });

    // Photon sphere — one per segment group, travels with the active tip
    segLines.forEach(sl => {
      const photon = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false })
      );
      photon.frustumCulled = false;
      photon.renderOrder   = 1001;
      photon.visible       = false;
      scene.add(photon); rayObjects.push(photon);
      sl.photon = photon;
    });
  }

  function updateRayProgress(g) {
    const total = segLines.length;
    const STAGGER = 0.18;
    segLines.forEach((sl, i) => {
      // Staggered start like main sim
      const tStart = (i / Math.max(total - 1, 1)) * STAGGER;
      const tEnd   = tStart + (1.0 - STAGGER);
      const p      = Math.max(0, Math.min(1, (g - tStart) / Math.max(tEnd - tStart, 0.001)));

      if (p <= 0) {
        sl.line.visible = sl.gLine.visible = sl.photon.visible = false;
        if (sl.arrow) sl.arrow.material.opacity = 0;
        return;
      }

      sl.line.visible  = true;
      sl.gLine.visible = true;

      if (p >= 1.0) {
        // Fully drawn
        sl.buf[3] = sl.p1.x; sl.buf[4] = sl.p1.y; sl.buf[5] = sl.p1.z;
        sl.attr.needsUpdate = true;
        sl.photon.visible   = false;
        sl.mat.opacity      = 1.0;
        sl.gMat.opacity     = 0.55;
        if (sl.arrow) sl.arrow.material.opacity = 0.92;
      } else {
        // Tip travelling from p0 → p1
        const tx = sl.p0.x + (sl.p1.x - sl.p0.x) * p;
        const ty = sl.p0.y + (sl.p1.y - sl.p0.y) * p;
        const tz = sl.p0.z + (sl.p1.z - sl.p0.z) * p;
        sl.buf[3] = tx; sl.buf[4] = ty; sl.buf[5] = tz;
        sl.attr.needsUpdate = true;
        sl.mat.opacity  = 1.0;
        sl.gMat.opacity = 0.55;
        sl.photon.position.set(tx, ty, tz);
        sl.photon.visible = true;
        // Arrow fades in near completion
        if (sl.arrow) sl.arrow.material.opacity = Math.max(0, (p - 0.82) / 0.18) * 0.92;
      }
    });
  }

  function showAllRays() {
    segLines.forEach(sl => {
      sl.buf[3] = sl.p1.x; sl.buf[4] = sl.p1.y; sl.buf[5] = sl.p1.z;
      sl.attr.needsUpdate  = true;
      sl.line.visible      = true;
      sl.gLine.visible     = true;
      sl.photon.visible    = false;
      sl.mat.opacity       = 1.0;
      sl.gMat.opacity      = 0.55;
      if (sl.arrow) sl.arrow.material.opacity = 0.92;
    });
    // Hit-point impact dots at every segment junction + terminals
    const seen = new Set();
    allSegments.forEach((seg, i) => {
      if (i === 0) return;
      const k = seg.p0.map(v => v.toFixed(3)).join(',');
      if (!seen.has(k)) { seen.add(k); makeDot(seg.p0, seg.col); }
    });
    allSegments.forEach(seg => {
      const k = seg.p1.map(v => v.toFixed(3)).join(',') + '_e';
      if (!seen.has(k)) { seen.add(k); makeDot(seg.p1, seg.col); }
    });
  }

  /* ── Animation ───────────────────────────────────────────── */
  let mAnimState = 'idle', mT = 0, mPrev = 0, mPulseClock = 0;
  const M_DUR = 6.0;

  function mLoop(ts) {
    requestAnimationFrame(mLoop);
    const dt = Math.min(ts - mPrev, 80) / 1000; mPrev = ts;
    mPulseClock += dt;

    // Pulse the glow lights — reduced intensities for visual clarity (morpho view was too bright)
    morphoGlow.intensity = 0.85 + Math.sin(mPulseClock * 1.1) * 0.18; // was 2.2 ± 0.55
    flatGlow.intensity   = 0.75 + Math.sin(mPulseClock * 0.7) * 0.12; // was 1.6 ± 0.30

    // Keep labels facing camera (billboard)
    lblFlat.quaternion.copy(camera.quaternion);
    lblMorph.quaternion.copy(camera.quaternion);

    if (mAnimState === 'running') {
      mT += dt;
      const g = Math.min(1.0, mT / M_DUR);
      updateRayProgress(g);
      // Dynamic glow intensity scales with zoom — match main sim §9
      if (segLines.length) {
        const glowOp = Math.min(0.72, 0.42 + (24 - orb.r) * 0.014);
        segLines.forEach(sl => { if (sl.gLine.visible) sl.gMat.opacity = Math.max(0.28, glowOp); });
      }
      if (g >= 1.0) {
        mAnimState = 'done';
        showAllRays();
        const btn = document.getElementById('btnMicroRun');
        if (btn) btn.textContent = 'Run';
      }
    } else if (mAnimState === 'paused') {
      updateRayProgress(Math.min(1.0, mT / M_DUR));
    } else if (mAnimState === 'done') {
      // Keep glow live even when fully drawn
      const glowOp = Math.min(0.72, 0.42 + (24 - orb.r) * 0.014);
      segLines.forEach(sl => { if (sl.gLine.visible) sl.gMat.opacity = Math.max(0.28, glowOp); });
    }

    renderer.render(scene, camera);
  }
  requestAnimationFrame(mLoop);

  /* ── Buttons ─────────────────────────────────────────────── */
  const btnRun   = document.getElementById('btnMicroRun');
  const btnPause = document.getElementById('btnMicroPause');
  const btnClear = document.getElementById('btnMicroClear');

  function mHideAll() {
    mT = 0; mAnimState = 'idle';
    clearRays(); segLines = [];
  }

  if (btnRun) btnRun.addEventListener('click', () => {
    if (mAnimState === 'idle' || mAnimState === 'done') {
      if (!allSegments.length) buildAllSegments(lastStats, lastSunAngle, lastNumRays);
      moveMicroSun(lastSunAngle);
      createSegLines();
      mT = 0; mAnimState = 'running'; btnRun.textContent = 'Running…';
    } else if (mAnimState === 'paused') {
      mAnimState = 'running'; btnRun.textContent = 'Running…';
    }
  });
  if (btnPause) btnPause.addEventListener('click', () => {
    if (mAnimState === 'running') { mAnimState = 'paused'; if (btnRun) btnRun.textContent = 'Resume'; }
  });
  if (btnClear) btnClear.addEventListener('click', () => {
    mHideAll(); if (btnRun) btnRun.textContent = 'Run';
  });

  /* ── Ray count validation + debug overlay ───────────────────── */
  let filterMode = 'all'; // 'all' | 'reflected' | 'absorbed' | 'transmitted'

  function applyFilter() {
    if (!segLines.length) return;
    segLines.forEach(sl => {
      const show = filterMode === 'all' || sl.fate === filterMode;
      sl.line.visible  = show && sl.line.visible  !== undefined ? show : sl.line.visible;
      sl.gLine.visible = show && sl.gLine.visible !== undefined ? show : sl.gLine.visible;
      if (sl.arrow) sl.arrow.material.opacity = show ? 0.75 : 0;
    });
  }

  function updateStatsBar(s) {
    const el = document.getElementById('microStatsBar');
    if (!el) return;
    const N  = lastNumRays;
    const fR = Math.round(N * (s.flatRefl  || 0)), fA = Math.round(N * (s.flatAbs  || 0)), fT = N - fR - fA;
    const bR = Math.round(N * (s.bflyRefl  || 0)), bA = Math.round(N * (s.bflyAbs  || 0)), bT = N - bR - bA;
    const valid = (fR + fA + fT === N) && (bR + bA + bT === N);

    el.innerHTML =
      `<span style="color:#888;font-size:10px;letter-spacing:1px">RAY COUNT N=${N} ${valid ? '✅ VALID' : '❌ MISMATCH'}</span><br>` +
      `<span style="color:#4488ff">▶ Flat  — Refl: ${fR} | Abs: ${fA} | Trans: ${fT}</span>` +
      `<span style="color:#cc55ff;margin-left:18px">▶ Morpho — Refl: ${bR} | Abs: ${bA} | Trans: ${bT}</span>` +
      `<span style="color:#666;margin-left:18px">Filter: ` +
      ['all','reflected','absorbed','transmitted'].map(m =>
        `<span style="cursor:pointer;padding:2px 6px;border-radius:3px;margin:0 2px;` +
        `background:${filterMode===m?'rgba(255,255,255,0.15)':'transparent'};` +
        `color:${m==='reflected'?'#4488ff':m==='absorbed'?'#ff4422':m==='transmitted'?'#44ff99':'#aaa'}` +
        `" onclick="window._microFilter('${m}')">${m}</span>`
      ).join('') + `</span>`;
  }

  window._microFilter = function(mode) {
    filterMode = mode;
    if (lastStats) updateStatsBar(lastStats);
    // show/hide segLines by fate tag
    segLines.forEach(sl => {
      const show = mode === 'all' || sl.fate === mode;
      if (sl.line.visible !== undefined) { sl.line.visible = show; sl.gLine.visible = show; }
      if (sl.arrow) sl.arrow.material.opacity = show ? 0.75 : 0;
    });
  };

  /* ── Public API (called by main sim) ─────────────────────── */
  window._microSimStart = function(stats, sunAngle, numRays) {
    lastStats    = stats;
    lastSunAngle = (typeof sunAngle === 'number') ? sunAngle : 45;
    lastNumRays  = (typeof numRays  === 'number' && numRays > 0) ? Math.min(numRays, 16) : 8;
    moveMicroSun(lastSunAngle);
    buildAllSegments(stats, lastSunAngle, lastNumRays);
    createSegLines();
    mT = 0; mAnimState = 'running';
    if (btnRun) btnRun.textContent = 'Running…';
    if (stats) updateStatsBar(stats);
  };
  window._microSimStop = function() {
    mHideAll(); if (btnRun) btnRun.textContent = 'Run';
  };

}()); // end initMicroSim
})); // end double-rAF guard

/* ═══════════════════════════════════════════════════════════════
   §13  GRAPHS
   Existing graphs: absorption vs wavelength, reflection vs angle,
   efficiency bars — all UNTOUCHED.
   NEW: Internal Photon / Ray Trapping Index (live, §13D)
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

  /* ── A: Absorptance vs Wavelength — physics UNTOUCHED ─────────── */
  var wl      = [300,350,400,450,500,550,600,650,700,750,800,850,900,950,1000,1050,1100];
  var flatAbs = [0.38,0.52,0.63,0.70,0.72,0.70,0.67,0.63,0.59,0.54,0.48,0.41,0.33,0.25,0.17,0.09,0.03];
  var morphAbs= [0.75,0.80,0.82,0.22,0.64,0.90,0.92,0.90,0.87,0.83,0.76,0.66,0.54,0.40,0.25,0.12,0.04];
  var svgA=document.getElementById('svgAbsorption');
  if (svgA) {
    drawGrid(svgA,300,1100,200,0,1,0.2,'Wavelength λ (nm)','Absorptance (0 = none, 1 = full)');
    // Area fills
    var flatPts  = wl.map(function(x,i){return xMap(x,300,1100)+','+yMap(flatAbs[i],0,1);}).join(' ');
    var morphPts = wl.map(function(x,i){return xMap(x,300,1100)+','+yMap(morphAbs[i],0,1);}).join(' ');
    var bY = yMap(0,0,1);
    svgEl('polygon',{points:PAD_L+','+bY+' '+flatPts+' '+xMap(1100,300,1100)+','+bY,fill:'rgba(0,212,255,0.07)',stroke:'none'},svgA);
    svgEl('polygon',{points:PAD_L+','+bY+' '+morphPts+' '+xMap(1100,300,1100)+','+bY,fill:'rgba(180,79,255,0.07)',stroke:'none'},svgA);
    drawLine(svgA,wl,flatAbs,300,1100,0,1,'#00d4ff');
    drawLine(svgA,wl,morphAbs,300,1100,0,1,'#b44fff');
    // Legend
    svgEl('rect',{x:PAD_L+8,y:PAD_T+5,width:14,height:3,fill:'#00d4ff',rx:1},svgA);
    svgEl('text',{x:PAD_L+28,y:PAD_T+11,fill:'#dde2f5','font-size':'10','font-family':'Rajdhani'},svgA).textContent='Flat Silicon Baseline¹ + ARC';
    svgEl('rect',{x:PAD_L+8,y:PAD_T+18,width:14,height:3,fill:'#b44fff',rx:1},svgA);
    svgEl('text',{x:PAD_L+28,y:PAD_T+24,fill:'#dde2f5','font-size':'10','font-family':'Rajdhani'},svgA).textContent='Morpho Structure (Morpho rhetenor)';
    // 450 nm dip annotation
    var dipX=xMap(450,300,1100), dipY=yMap(0.22,0,1);
    svgEl('line',{x1:dipX,y1:dipY-5,x2:dipX,y2:dipY-28,stroke:'#cc88ff','stroke-width':'1.2'},svgA);
    svgEl('text',{x:dipX+5,y:dipY-30,fill:'#cc88ff','font-size':'9','font-family':'Rajdhani'},svgA).textContent='Structural blue-reflection dip @ 450 nm';
    // High confinement region label
    svgEl('text',{x:xMap(600,300,1100),y:yMap(0.92,0,1)-8,fill:'rgba(180,79,255,0.65)','font-size':'9','font-family':'Rajdhani','text-anchor':'middle'},svgA).textContent='High Optical Confinement¹ region';
  }

  /* ── B: Reflectance vs Incident Angle — physics UNTOUCHED ───── */
  var ang   = [0,5,10,15,20,25,30,35,40,45,50,55,60,65,70,75,80,85];
  var flatR = [0.31,0.31,0.31,0.31,0.32,0.32,0.33,0.34,0.36,0.39,0.43,0.49,0.57,0.67,0.78,0.88,0.95,0.99];
  var morphR= [0.03,0.03,0.03,0.03,0.04,0.04,0.05,0.05,0.06,0.08,0.10,0.14,0.20,0.30,0.44,0.62,0.80,0.95];
  var svgB=document.getElementById('svgReflection');
  if (svgB) {
    // Advantage shading between flat and morpho
    var bPts = ang.map(function(x,i){return xMap(x,0,85)+','+yMap(flatR[i],0,1);}).join(' ');
    var mRevPts = ang.slice().reverse().map(function(x,i){return xMap(x,0,85)+','+yMap(morphR[ang.length-1-i],0,1);}).join(' ');
    svgEl('polygon',{points:bPts+' '+mRevPts,fill:'rgba(0,212,255,0.07)',stroke:'none'},svgB);
    drawGrid(svgB,0,85,10,0,1,0.2,'Incident Angle θ (°)','Reflectance (fraction of incident photons reflected)');
    drawLine(svgB,ang,flatR,0,85,0,1,'#00d4ff');
    drawLine(svgB,ang,morphR,0,85,0,1,'#b44fff');
    // Legend
    svgEl('rect',{x:PAD_L+8,y:PAD_T+5,width:14,height:3,fill:'#00d4ff',rx:1},svgB);
    svgEl('text',{x:PAD_L+28,y:PAD_T+11,fill:'#dde2f5','font-size':'10','font-family':'Rajdhani'},svgB).textContent='Flat Silicon Baseline¹ (Fresnel reflection)';
    svgEl('rect',{x:PAD_L+8,y:PAD_T+18,width:14,height:3,fill:'#b44fff',rx:1},svgB);
    svgEl('text',{x:PAD_L+28,y:PAD_T+24,fill:'#dde2f5','font-size':'10','font-family':'Rajdhani'},svgB).textContent='Morpho Structure (multi-bounce suppressed)';
    // Annotation for flat silicon at 0°
    var flatAt0X=xMap(0,0,85), flatAt0Y=yMap(0.31,0,1);
    svgEl('text',{x:flatAt0X+6,y:flatAt0Y-5,fill:'rgba(0,212,255,0.70)','font-size':'9','font-family':'Rajdhani'},svgB).textContent='~31% Fresnel loss at normal incidence';
  }

  /* ── C: Efficiency bars — UNTOUCHED ──────────────────────────── */
  setTimeout(function(){
    var ef=document.getElementById('effFlat');
    var eb=document.getElementById('effBfly');
    var es=document.getElementById('effSQ');
    if(ef) ef.style.width=(18.7/35*100).toFixed(1)+'%';
    if(eb) eb.style.width=(25.2/35*100).toFixed(1)+'%';
    if(es) es.style.width=(29.4/35*100).toFixed(1)+'%';
  },600);

  /* ── D: Internal Photon / Ray Trapping Index — LIVE graph ──────
     Derived ONLY from the main ray system (traceButterflyRay bounces).
     Updates on every simulation run via window._updateGraphs(d).
     Formula: TI = Σ(bfly ray bounces) / numRays
  ──────────────────────────────────────────────────────────────── */
  var svgT = document.getElementById('svgTrapping');
  var MAX_HIST = 20;
  var trapHistMorpho = [];
  var trapHistFlat   = []; // always ~0 (single interaction)

  function _drawTrapEmpty() {
    if (!svgT) return;
    while (svgT.firstChild) svgT.removeChild(svgT.firstChild);

    // Background zone stripes (subtle)
    var zoneData = [
      { yMin: 0, yMax: 1,   col: 'rgba(255,80,80,0.07)',   lbl: '🔴 Low Optical Confinement¹' },
      { yMin: 1, yMax: 2,   col: 'rgba(255,200,50,0.07)',  lbl: '🟡 Moderate Light Trapping¹' },
      { yMin: 2, yMax: 6,   col: 'rgba(100,255,150,0.07)', lbl: '🟢 High Photon Confinement¹' },
    ];
    zoneData.forEach(function(z) {
      var y1 = yMap(Math.min(z.yMax, 6), 0, 6), y2 = yMap(z.yMin, 0, 6);
      if (y2 > y1) svgEl('rect',{x:PAD_L,y:y1,width:GPW,height:y2-y1,fill:z.col},svgT);
    });

    drawGrid(svgT, 1, MAX_HIST, 5, 0, 6, 1,
      'Simulation Iterations (Time Steps)¹',
      'Avg Internal Photon Interactions per Ray (PTI)¹');

    // Zone boundary lines + labels
    [1, 2].forEach(function(v) {
      var py = yMap(v, 0, 6);
      svgEl('line',{x1:PAD_L,y1:py,x2:VW-PAD_R,y2:py,stroke:'rgba(255,255,255,0.12)','stroke-width':1,'stroke-dasharray':'5,3'},svgT);
    });
    svgEl('text',{x:VW-PAD_R-4,y:yMap(0.5,0,6)+4,fill:'rgba(255,100,100,0.65)','font-size':'9','font-family':'Rajdhani','text-anchor':'end'},svgT).textContent='Low Optical Confinement¹';
    svgEl('text',{x:VW-PAD_R-4,y:yMap(1.5,0,6)+4,fill:'rgba(255,200,50,0.65)','font-size':'9','font-family':'Rajdhani','text-anchor':'end'},svgT).textContent='Moderate Light Trapping¹';
    svgEl('text',{x:VW-PAD_R-4,y:yMap(3.5,0,6)+4,fill:'rgba(100,255,150,0.65)','font-size':'9','font-family':'Rajdhani','text-anchor':'end'},svgT).textContent='High Photon Confinement¹';

    // Flat silicon baseline
    var baseY = yMap(0, 0, 6);
    svgEl('line',{x1:PAD_L,y1:baseY,x2:VW-PAD_R,y2:baseY,stroke:'rgba(0,212,255,0.25)','stroke-width':1.2,'stroke-dasharray':'5,3'},svgT);
    svgEl('text',{x:PAD_L+6,y:baseY-5,fill:'rgba(0,212,255,0.55)','font-size':'9','font-family':'Rajdhani'},svgT).textContent='Flat Silicon Baseline¹ ≈ 0 interactions/ray';

    // Watermark
    svgEl('text',{x:PAD_L+GPW/2,y:PAD_T+GPH/2+14,fill:'rgba(120,128,168,0.18)','font-size':'13','font-family':'Rajdhani','text-anchor':'middle'},svgT).textContent='Run simulation to populate graph';
  }
  _drawTrapEmpty();

  function _calcTrend() {
    var n = trapHistMorpho.length;
    if (n < 3) return { label: 'Stable', col: '#7880a8', interp: 'Need more iterations to determine trend.' };
    var recent = trapHistMorpho.slice(-Math.min(5, n));
    var first = recent[0], last = recent[recent.length - 1];
    var delta = last - first;
    if (Math.abs(delta) < 0.08) return { label: 'Stable', col: '#7880a8', interp: 'PTI is stable — light retention is consistent across runs.' };
    if (delta > 0) return { label: '↑ Increasing', col: '#60e090', interp: 'PTI rising — light retention improving with current parameters.' };
    return { label: '↓ Decreasing', col: '#ff8040', interp: 'PTI declining — consider adjusting ridge geometry parameters.' };
  }

  function _redrawTrap() {
    if (!svgT) return;
    while (svgT.firstChild) svgT.removeChild(svgT.firstChild);

    var n   = trapHistMorpho.length;
    var top = Math.max(6, Math.ceil(Math.max.apply(null, trapHistMorpho) * 1.35));
    var xMx = Math.max(MAX_HIST, n);
    var xSt = Math.max(1, Math.floor(xMx / 5));

    // Background confinement zones
    [
      { yMin: 0, yMax: 1,   col: 'rgba(255,80,80,0.07)'   },
      { yMin: 1, yMax: 2,   col: 'rgba(255,200,50,0.07)'  },
      { yMin: 2, yMax: top, col: 'rgba(100,255,150,0.07)' },
    ].forEach(function(z) {
      var y1 = yMap(Math.min(z.yMax, top), 0, top), y2 = yMap(z.yMin, 0, top);
      if (y2 > y1) svgEl('rect',{x:PAD_L,y:y1,width:GPW,height:y2-y1,fill:z.col},svgT);
    });

    drawGrid(svgT, 1, xMx, xSt, 0, top, Math.max(1, Math.round(top/6)),
      'Simulation Iterations (Time Steps)¹',
      'Avg Internal Photon Interactions per Ray (PTI)¹');

    // Zone boundary lines at 1 and 2
    [1, 2].forEach(function(v) {
      if (v >= top) return;
      var py = yMap(v, 0, top);
      svgEl('line',{x1:PAD_L,y1:py,x2:VW-PAD_R,y2:py,stroke:'rgba(255,255,255,0.14)','stroke-width':1,'stroke-dasharray':'5,3'},svgT);
    });

    // Zone labels on right edge
    if (top > 0.5) svgEl('text',{x:VW-PAD_R-4,y:yMap(Math.min(0.5,top*0.9),0,top)+4,fill:'rgba(255,100,100,0.55)','font-size':'9','font-family':'Rajdhani','text-anchor':'end'},svgT).textContent='Low Optical Confinement¹';
    if (top > 1.5) svgEl('text',{x:VW-PAD_R-4,y:yMap(Math.min(1.5,top*0.9),0,top)+4,fill:'rgba(255,200,50,0.55)','font-size':'9','font-family':'Rajdhani','text-anchor':'end'},svgT).textContent='Moderate Light Trapping¹';
    if (top > 2.5) svgEl('text',{x:VW-PAD_R-4,y:yMap(Math.min(top*0.75,top*0.9),0,top)+4,fill:'rgba(100,255,150,0.55)','font-size':'9','font-family':'Rajdhani','text-anchor':'end'},svgT).textContent='High Photon Confinement¹';

    // Flat Silicon Baseline dashed line at y=0
    svgEl('line',{x1:PAD_L,y1:yMap(0,0,top),x2:VW-PAD_R,y2:yMap(0,0,top),stroke:'rgba(0,212,255,0.25)','stroke-width':1.2,'stroke-dasharray':'5,3'},svgT);
    svgEl('text',{x:PAD_L+6,y:yMap(0,0,top)-5,fill:'rgba(0,212,255,0.55)','font-size':'9','font-family':'Rajdhani'},svgT).textContent='Flat Silicon Baseline¹ ≈ 0';

    if (n < 1) return;
    var xs = [];
    for (var i=0;i<n;i++) xs.push(i+1);

    // Area fill under morpho line
    if (n >= 2) {
      var apts = xs.map(function(x,i){return xMap(x,1,xMx)+','+yMap(trapHistMorpho[i],0,top);}).join(' ');
      var baselineY = yMap(0, 0, top);
      var fillPts = (PAD_L+','+baselineY+' '+apts+' '+xMap(n,1,xMx)+','+baselineY);
      svgEl('polygon',{points:fillPts,fill:'rgba(180,79,255,0.10)',stroke:'none'},svgT);
    }

    // Morpho Structure Trapping Index line
    if (n >= 2) drawLine(svgT, xs, trapHistMorpho, 1, xMx, 0, top, '#b44fff');
    else {
      var cx2 = xMap(xs[0],1,xMx), cy2 = yMap(trapHistMorpho[0],0,top);
      svgEl('circle',{cx:cx2,cy:cy2,r:5,fill:'#b44fff'},svgT);
    }

    // Latest point annotation
    var cur   = trapHistMorpho[n-1];
    var latX  = xMap(n, 1, xMx);
    var latY  = yMap(cur, 0, top);
    var dotCol = cur < 1.0 ? '#ff6060' : cur < 2.0 ? '#ffc840' : '#60e090';
    svgEl('circle',{cx:latX,cy:latY,r:6,fill:dotCol,'stroke':'rgba(255,255,255,0.25)','stroke-width':1.5},svgT);

    // Annotation callout: "Current PTI = X.XX interactions/ray (zone label)"
    var zoneLabel = cur < 1.0 ? 'Low Optical Confinement' : cur < 2.0 ? 'Moderate Light Trapping' : 'High Photon Confinement';
    var annotText = 'PTI = ' + cur.toFixed(2) + ' interactions/ray — ' + zoneLabel;
    var annotX = latX + 8, annotAnchor = 'start';
    if (latX > VW - PAD_R - 180) { annotX = latX - 8; annotAnchor = 'end'; }
    var annotY = Math.max(PAD_T + 14, latY - 10);
    svgEl('text',{x:annotX,y:annotY,fill:dotCol,'font-size':'9','font-family':'JetBrains Mono','text-anchor':annotAnchor,'font-weight':'700'},svgT).textContent=annotText;

    // Legend
    svgEl('rect',{x:PAD_L+8,y:PAD_T+5,width:14,height:3,fill:'#b44fff',rx:1},svgT);
    svgEl('text',{x:PAD_L+28,y:PAD_T+11,fill:'#dde2f5','font-size':'10','font-family':'Rajdhani'},svgT).textContent='Morpho Structure Trapping Index¹';
    svgEl('line',{x1:PAD_L+8,y1:PAD_T+22,x2:PAD_L+22,y2:PAD_T+22,stroke:'rgba(0,212,255,0.45)','stroke-width':1.4,'stroke-dasharray':'4,3'},svgT);
    svgEl('text',{x:PAD_L+28,y:PAD_T+26,fill:'rgba(0,212,255,0.65)','font-size':'10','font-family':'Rajdhani'},svgT).textContent='Flat Silicon Baseline¹ (≈ 0 interactions/ray)';

    // Quality interpretation badge
    var qual    = cur < 1.0 ? '⚠ Low Optical Confinement¹' : cur < 2.0 ? '◈ Moderate Light Trapping¹' : cur < 4.5 ? '✦ High Photon Confinement¹' : '⚡ Excellent Photon Confinement¹';
    var qualCol = cur < 1.0 ? '#ff6060' : cur < 2.0 ? '#ffc840' : cur < 4.5 ? '#60e090' : '#b44fff';
    svgEl('text',{x:VW-PAD_R-4,y:VH-PAD_B-8,fill:qualCol,'font-size':'10','font-family':'Rajdhani','font-weight':'700','text-anchor':'end'},svgT).textContent=qual;

    // DOM interpretation + trend
    var interp = document.getElementById('trapInterpretation');
    if (interp) { interp.textContent = qual; interp.style.color = qualCol; }

    var trend = _calcTrend();
    var tvEl = document.getElementById('trapTrendVal');
    var tiEl = document.getElementById('trapTrendInterp');
    if (tvEl) { tvEl.textContent = trend.label; tvEl.style.color = trend.col; }
    if (tiEl) { tiEl.textContent = trend.interp; }
  }

  /* ── Public API: called by updateUI after every simulation run ── */
  window._updateGraphs = function(d) {
    if (!d || typeof d.trappingIndex === 'undefined') return;
    trapHistMorpho.push(+d.trappingIndex.toFixed(3));
    trapHistFlat.push(0);
    if (trapHistMorpho.length > MAX_HIST) { trapHistMorpho.shift(); trapHistFlat.shift(); }
    _redrawTrap();
    // Flash the LIVE badge
    var badge = document.getElementById('trapLiveBadge');
    if (badge) {
      badge.classList.add('trap-badge-flash');
      setTimeout(function(){ badge.classList.remove('trap-badge-flash'); }, 800);
    }
  };
}());

}); // end DOMContentLoaded

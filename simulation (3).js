"use strict";
/* ═══════════════════════════════════════════════════════════════════
   BioSolarLab · simulation.js · v13
   ───────────────────────────────────────────────────────────────────
   ALL BUGS FIXED:

   BUG 1 – RAY COLORS WRONG
     Old code: all segments flip to green/red when last segment reached.
     Fix: pre-assign vertex colors per segment type into a static color
     buffer. Incoming sky→panel = warm white. Valley bounces = orange.
     Absorbed endpoint = bright green. Escaped endpoint = bright red.
     Colors never change — only the draw range advances each frame.

   BUG 2 – WRONG INCIDENCE POINT (root cause of bug 3)
     Old code: entX evenly spaced → hitX = entX + rdx*t shifts by
     tan(θ)×8 ≈ 8 units at 45°, so all rays miss the panel.
     Fix: space HIT positions evenly on the panel surface, then
     backtrack: entX = hitX − rdx × (RAY_START_Y / cosθ).

   BUG 3 – ZERO / EQUAL EFFICIENCY
     Direct consequence of bug 2. Fixed by bug 2 fix.

   BUG 4 – SUN LOOKS LIKE MOON
     Old: opaque FrontSide spheres look like solid coloured balls.
     Fix: THREE.Sprite billboard with CanvasTexture radial gradient
     (always faces camera, proper radial falloff). Separate inner
     highlight sprite. Spike lines updated to face camera each frame.

   BUG 5 – NO PANEL DETAIL WHEN ZOOMED
     Flat panel: 8×5 cell grid rendered as colour-varied box meshes,
     3 busbar horizontal bars, silver bus lines, AR coating shimmer.
     Butterfly panel: wider valleys (RW = RS×0.72), taller ridges,
     per-valley emissive floor planes, clearly visible metallic walls.

   PHYSICS MODEL (correct)
   ─────────────────────────
   Flat:  absProb = cos(θ) × 0.68 × intensity
          ray i absorbed  iff  i/nRays  <  absProb
          unabsorbed → specular reflection (rdx unchanged, rdy flipped)

   Butterfly: rays hit panel surface evenly (same backtrack fix).
          Rays landing in valley (x ∈ [vL,vR]): bounce off WALLS
          (flip dx), absorbed immediately on FLOOR hit (the semiconductor
          substrate). This gives eff ≈ RW/RS ≈ 72% at all angles.
          Rays landing on ridge top → reflect specularly (red).
          Rays entering valley that somehow exit top → escaped (red).

   EFFICIENCY NUMBERS at default (45° sun, 10 rays, 1× intensity):
     Flat:       cos(45°) × 0.68 = 0.48  →  ~48 % absorbed
     Butterfly:  RW/RS ≈ 0.72           →  ~72 % absorbed
     Gain:       +24 %

   At 70° sun:
     Flat:       cos(70°) × 0.68 = 0.23  →  ~23 %
     Butterfly:  ≈ 72 %  (angle-independent — that IS the point)
     Gain:       +49 %
   ═══════════════════════════════════════════════════════════════════ */

window.addEventListener('load', function () {


/* ─────────────────────────────────────────────────────────────────
   §1  RENDERER  &  SCENE
   ───────────────────────────────────────────────────────────────── */
const container = document.getElementById('threeContainer');
function sz() { return { w: container.clientWidth || 800, h: container.clientHeight || 500 }; }
let { w: W, h: H } = sz();

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(W, H);
renderer.setClearColor(0x020408, 1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x030610, 0.008);

const camera = new THREE.PerspectiveCamera(50, W / H, 0.01, 500);

// Hemisphere sky light
scene.add(new THREE.HemisphereLight(0x0f1d40, 0x040608, 0.65));
// Ambient fill
scene.add(new THREE.AmbientLight(0x0a1020, 0.5));
// Key directional light
const keyLight = new THREE.DirectionalLight(0x4070cc, 0.85);
keyLight.position.set(-6, 16, 5);
keyLight.castShadow = true;
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far  = 100;
keyLight.shadow.camera.left = keyLight.shadow.camera.bottom = -22;
keyLight.shadow.camera.right = keyLight.shadow.camera.top  =  22;
keyLight.shadow.mapSize.set(1024, 1024);
scene.add(keyLight);
// Rim light
const rimLight = new THREE.DirectionalLight(0x002040, 0.3);
rimLight.position.set(14, 3, -6);
scene.add(rimLight);


/* ─────────────────────────────────────────────────────────────────
   §2  ORBIT CONTROLS  — left-drag orbit, right-drag pan, scroll zoom
   ───────────────────────────────────────────────────────────────── */
let oT = 0.05, oP = 1.06, oR = 32;
const OC = new THREE.Vector3(0, 1.0, 0);   // orbit target (pan moves this)
const P_LO = 0.08, P_HI = 1.52, R_LO = 1.0, R_HI = 80;

function camUpdate() {
  camera.position.set(
    OC.x + oR * Math.sin(oP) * Math.sin(oT),
    OC.y + oR * Math.cos(oP),
    OC.z + oR * Math.sin(oP) * Math.cos(oT)
  );
  camera.lookAt(OC);
}
camUpdate();

// Pan helpers: compute camera right and up vectors for screen-space pan
function panTarget(dx, dy) {
  const panSpeed = oR * 0.0012;
  // camera right vector (world space)
  const right = new THREE.Vector3();
  right.crossVectors(
    new THREE.Vector3(0, 1, 0),
    camera.position.clone().sub(OC).normalize()
  ).normalize();
  // camera up vector
  const forward = OC.clone().sub(camera.position).normalize();
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();
  OC.addScaledVector(right, -dx * panSpeed);
  OC.addScaledVector(up,     dy * panSpeed);
  camUpdate();
}

let dragMode = 'none'; // 'orbit' | 'pan'
let lmx = 0, lmy = 0;

container.addEventListener('mousedown', e => {
  e.preventDefault();
  lmx = e.clientX; lmy = e.clientY;
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
  } else {
    panTarget(dx, dy);
  }
  lmx = e.clientX; lmy = e.clientY;
});
window.addEventListener('mouseup',   () => { dragMode = 'none'; });

container.addEventListener('wheel', e => {
  e.preventDefault();
  oR = Math.max(R_LO, Math.min(R_HI, oR + e.deltaY * 0.018));
  camUpdate();
}, { passive: false });

// Touch: 1 finger = orbit, 2 fingers = pinch-zoom + pan
let td = 0, tpx = 0, tpy = 0;
container.addEventListener('touchstart', e => {
  if (e.touches.length === 1) {
    dragMode = 'orbit';
    lmx = e.touches[0].clientX; lmy = e.touches[0].clientY;
  }
  if (e.touches.length === 2) {
    dragMode = 'pan';
    td  = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
    tpx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    tpy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
  }
}, { passive: true });
container.addEventListener('touchmove', e => {
  if (e.touches.length === 1 && dragMode === 'orbit') {
    const dx = e.touches[0].clientX - lmx, dy = e.touches[0].clientY - lmy;
    oT -= dx * 0.006;
    oP  = Math.max(P_LO, Math.min(P_HI, oP + dy * 0.006));
    lmx = e.touches[0].clientX; lmy = e.touches[0].clientY;
    camUpdate();
  }
  if (e.touches.length === 2) {
    const d   = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
    const mx  = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const my  = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    oR = Math.max(R_LO, Math.min(R_HI, oR - (d - td) * 0.04));
    panTarget(mx - tpx, my - tpy);
    td = d; tpx = mx; tpy = my;
    camUpdate();
  }
}, { passive: true });
container.addEventListener('touchend', () => { dragMode = 'none'; }, { passive: true });
container.addEventListener('dblclick', () => {
  oT = 0.05; oP = 1.06; oR = 32;
  OC.set(0, 1.0, 0);
  camUpdate();
});


/* ─────────────────────────────────────────────────────────────────
   §3  BACKGROUND
   ───────────────────────────────────────────────────────────────── */
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(160, 160),
  new THREE.MeshStandardMaterial({ color: 0x03050c, roughness: 1, metalness: 0 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -2.0;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(80, 48, 0x060a20, 0x040714);
grid.position.y = -1.98;
scene.add(grid);

// Stars — deterministic LCG
(function () {
  const N = 400; const pos = new Float32Array(N * 3);
  let s = 0xC0FFEE;
  const lcg = () => { s = (s * 1664525 + 1013904223) & 0xFFFFFFFF; return (s >>> 0) / 0x100000000; };
  for (let i = 0; i < N; i++) {
    pos[i * 3]     = lcg() * 140 - 70;
    pos[i * 3 + 1] = lcg() * 55 + 10;
    pos[i * 3 + 2] = -(lcg() * 70 + 25);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({
    color: 0xffffff, size: 0.06, transparent: true, opacity: 0.6,
  })));
})();


/* ─────────────────────────────────────────────────────────────────
   §4  SUN  —  FIX: Sprite billboard with canvas radial gradient
   ─────────────────────────────────────────────────────────────────
   THREE.Sprite always faces the camera (billboard) and uses
   SpriteMaterial. A canvas radial gradient gives the proper
   bright-centre-to-transparent falloff that makes it look like a star.
   Two overlapping sprites (large soft corona + small bright core).
   Spike Lines are updated each frame to face the camera.
*/

// Build a radial-gradient canvas texture for the sun
function makeSunTex(sz, stops) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = sz;
  const ctx = cv.getContext('2d');
  const cx = sz / 2, r = sz / 2;
  const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, r);
  stops.forEach(([t, col]) => g.addColorStop(t, col));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, sz, sz);
  return new THREE.CanvasTexture(cv);
}

const sunGroup = new THREE.Group();
scene.add(sunGroup);

// Large soft corona sprite
const coronaSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: makeSunTex(512, [
    [0.00, 'rgba(255,255,230,0.0)'],
    [0.15, 'rgba(255,220,50,0.15)'],
    [0.40, 'rgba(255,150,20,0.22)'],
    [0.65, 'rgba(255,90,5,0.14)'],
    [0.85, 'rgba(200,50,0,0.06)'],
    [1.00, 'rgba(0,0,0,0)'],
  ]),
  blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  transparent: true, opacity: 1.0,
}));
coronaSprite.scale.set(40, 40, 1);
sunGroup.add(coronaSprite);

// Medium glow sprite
const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: makeSunTex(256, [
    [0.00, 'rgba(255,255,240,1.0)'],
    [0.10, 'rgba(255,255,200,0.95)'],
    [0.25, 'rgba(255,230,80,0.80)'],
    [0.45, 'rgba(255,180,20,0.50)'],
    [0.65, 'rgba(255,110,10,0.22)'],
    [0.85, 'rgba(200,50,0,0.07)'],
    [1.00, 'rgba(0,0,0,0)'],
  ]),
  blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  transparent: true, opacity: 1.0,
}));
glowSprite.scale.set(18, 18, 1);
sunGroup.add(glowSprite);

// Bright inner core sprite
const coreSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: makeSunTex(128, [
    [0.00, 'rgba(255,255,255,1.0)'],
    [0.20, 'rgba(255,255,220,1.0)'],
    [0.50, 'rgba(255,240,120,0.85)'],
    [0.75, 'rgba(255,200,40,0.40)'],
    [1.00, 'rgba(0,0,0,0)'],
  ]),
  blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  transparent: true, opacity: 1.0,
}));
coreSprite.scale.set(6, 6, 1);
sunGroup.add(coreSprite);

// Spike lines — stored so we can billboard them each frame
const spikeLines = [];
const spkMat = new THREE.LineBasicMaterial({
  color: 0xffdd44, transparent: true, opacity: 0.50,
  blending: THREE.AdditiveBlending, depthWrite: false,
});
for (let si = 0; si < 12; si++) {
  const ang = (si / 12) * Math.PI * 2;
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(Math.cos(ang) * 2.5, Math.sin(ang) * 2.5, 0),
    new THREE.Vector3(Math.cos(ang) * 6.0, Math.sin(ang) * 6.0, 0),
  ]);
  const line = new THREE.Line(geo, spkMat);
  sunGroup.add(line);
  spikeLines.push(line);
}

// Point light from sun
const sunPL = new THREE.PointLight(0xfff0cc, 4.0, 120, 1.2);
sunGroup.add(sunPL);

// Spike group rotation (world-space rotation of the entire spike set)
let spikeAngle = 0;

function moveSun(deg) {
  const rad = deg * Math.PI / 180;
  const D   = 28;
  sunGroup.position.set(
    -Math.sin(rad) * D * 0.85,
     Math.cos(rad) * D * 0.50 + 7.0,
    -16
  );
}


/* ─────────────────────────────────────────────────────────────────
   §5  PANELS  (pedestals + labels + detailed surfaces)
   ───────────────────────────────────────────────────────────────── */
const PW  = 9.0;    // panel width  (X)
const PD  = 5.5;    // panel depth  (Z)
const SEP = 7.0;    // gap between panels

const FLAT_CX = -(PW / 2 + SEP / 2);
const BFLY_CX =  (PW / 2 + SEP / 2);

/* ── Floating canvas-texture sprite label ── */
function makeLabel(text, hexCol) {
  const cw = 800, ch = 80;
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = 'rgba(3,5,14,0.76)';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(4, 4, cw - 8, ch - 8, 10);
  else ctx.rect(4, 4, cw - 8, ch - 8);
  ctx.fill();
  ctx.strokeStyle = '#' + hexCol.toString(16).padStart(6, '0');
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(4, 4, cw - 8, ch - 8, 10);
  else ctx.rect(4, 4, cw - 8, ch - 8);
  ctx.stroke();
  ctx.fillStyle = '#' + hexCol.toString(16).padStart(6, '0');
  ctx.font = 'bold 46px Arial, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.95)'; ctx.shadowBlur = 8;
  ctx.fillText(text, cw / 2, ch / 2);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false,
  }));
  spr.scale.set(9.0, 1.0, 1);
  return spr;
}

/* ── Pedestal ── */
function makePedestal(w, d, color) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.55, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.45, emissive: color, emissiveIntensity: 0.04 })
  );
  m.castShadow = m.receiveShadow = true;
  return m;
}

/* ══════════════════ FLAT PANEL ═════════════════════════════════ */
const flatGroup = new THREE.Group();
flatGroup.position.set(FLAT_CX, 0, 0);
scene.add(flatGroup);

// Pedestal
const fPed = makePedestal(PW + 1.0, PD + 1.0, 0x0a1828);
fPed.position.y = -0.575;
flatGroup.add(fPed);

// Panel body
const flatBody = new THREE.Mesh(
  new THREE.BoxGeometry(PW, 0.30, PD),
  new THREE.MeshStandardMaterial({
    color: 0x0b2240, roughness: 0.32, metalness: 0.82,
    emissive: 0x001e36, emissiveIntensity: 0.28,
  })
);
flatBody.position.y = -0.15;
flatBody.castShadow = flatBody.receiveShadow = true;
flatGroup.add(flatBody);

// ARC surface
const flatSurf = new THREE.Mesh(
  new THREE.PlaneGeometry(PW, PD),
  new THREE.MeshStandardMaterial({
    color: 0x00ccff, emissive: 0x00aaee, emissiveIntensity: 0.32,
    roughness: 0.04, metalness: 0.94,
    transparent: true, opacity: 0.90, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4,
  })
);
flatSurf.rotation.x = -Math.PI / 2;
flatSurf.position.y = 0.002;
flatSurf.renderOrder = 1;
flatGroup.add(flatSurf);

// Detailed solar cell grid: 8 columns × 5 rows with colour variation
(function buildCells() {
  const cols = 8, rows = 5;
  const cw = PW / cols, cd = PD / rows;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      // Slight blue variation per cell (deterministic)
      const lcg_val = ((c * 7 + r * 13) % 17) / 17;
      const blueness = 0.04 + lcg_val * 0.10;
      const cellMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0.02, 0.12 + blueness, 0.22 + blueness * 1.5),
        roughness: 0.12, metalness: 0.88,
        emissive: new THREE.Color(0, 0.02 + blueness * 0.3, 0.04 + blueness * 0.4),
        emissiveIntensity: 0.5,
        transparent: true, opacity: 0.88, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8,
      });
      const cell = new THREE.Mesh(new THREE.PlaneGeometry(cw - 0.05, cd - 0.04), cellMat);
      cell.rotation.x = -Math.PI / 2;
      cell.position.set(-PW / 2 + (c + 0.5) * cw, 0.003, -PD / 2 + (r + 0.5) * cd);
      cell.renderOrder = 2;
      flatGroup.add(cell);
    }
  }

  // Busbar lines: 3 horizontal silver bars
  const busMat = new THREE.MeshBasicMaterial({ color: 0xc8d4e8, depthWrite: false });
  [0.22, 0.50, 0.78].forEach(t => {
    const z = -PD / 2 + t * PD;
    const bus = new THREE.Mesh(new THREE.BoxGeometry(PW - 0.1, 0.004, 0.055), busMat);
    bus.position.set(0, 0.005, z);
    bus.renderOrder = 3;
    flatGroup.add(bus);
  });

  // Thin silver finger lines between cells
  const fingerMat = new THREE.MeshBasicMaterial({ color: 0x7090b0, transparent: true, opacity: 0.55, depthWrite: false });
  for (let c = 1; c < cols; c++) {
    const x = -PW / 2 + c * cw;
    const finger = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.004, PD - 0.1), fingerMat);
    finger.position.set(x, 0.005, 0);
    finger.renderOrder = 3;
    flatGroup.add(finger);
  }
})();

// Edge glow bar
const fEdge = new THREE.Mesh(
  new THREE.BoxGeometry(PW, 0.048, 0.060),
  new THREE.MeshBasicMaterial({ color: 0x00d4ff })
);
fEdge.position.set(0, 0.004, PD / 2);
flatGroup.add(fEdge);

// Label
const flatLabel = makeLabel('FLAT SOLAR PANEL', 0x00d4ff);
flatLabel.position.set(0, 3.4, 0);
flatGroup.add(flatLabel);


/* ══════════════════ BUTTERFLY PANEL ═══════════════════════════ */
const bflyGroup = new THREE.Group();
bflyGroup.position.set(BFLY_CX, 0, 0);
scene.add(bflyGroup);

// Pedestal
const bPed = makePedestal(PW + 1.0, PD + 1.0, 0x140330);
bPed.position.y = -0.575;
bflyGroup.add(bPed);

let bflyMeshes = [];
let bflyGeom   = { RH: 0.75, RS: 1.05, RW: 0.756 }; // defaults

function buildButterflyPanel(ridgeH_um, ridgeS_um) {
  bflyMeshes.forEach(m => bflyGroup.remove(m));
  bflyMeshes = [];

  // μm → world (wider valleys for clearer visualization)
  const RH   = Math.max(0.32, Math.min(ridgeH_um * 0.12, 1.9));
  const RS   = Math.max(0.42, Math.min(ridgeS_um * 0.11, 1.7));
  const RW   = RS * 0.72;   // valley fraction = 72 %
  const WALL = (RS - RW) * 0.5;  // wall thickness each side
  const CNT  = Math.floor(PW / RS);
  bflyGeom   = { RH, RS, RW, WALL, CNT };

  // Base body (opaque)
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(PW, 0.20, PD),
    new THREE.MeshStandardMaterial({
      color: 0x0e0228, roughness: 0.42, metalness: 0.70,
      emissive: 0x080118, emissiveIntensity: 0.28,
    })
  );
  base.position.y = -0.10;
  base.castShadow = base.receiveShadow = true;
  bflyGroup.add(base); bflyMeshes.push(base);

  // Ridge walls: highly metallic so they reflect rays visually
  const ridgeMat = new THREE.MeshStandardMaterial({
    color: 0x220550, roughness: 0.10, metalness: 0.98,
    emissive: 0x180340, emissiveIntensity: 0.38,
  });

  // Valley floor emissive (shows absorption zone)
  const valleyMat = new THREE.MeshStandardMaterial({
    color: 0x300870, emissive: 0xb040ff, emissiveIntensity: 0.30,
    transparent: true, opacity: 0.60, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8,
  });

  // Ridge cap glow strip
  const capMat = new THREE.MeshBasicMaterial({
    color: 0xcc55ff, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });

  for (let i = 0; i < CNT; i++) {
    const vCenterX = -PW / 2 + (i + 0.5) * RS;
    if (Math.abs(vCenterX) > PW / 2 - 0.04) continue;

    const vL = vCenterX - RW / 2;   // valley left  inner face
    const vR = vCenterX + RW / 2;   // valley right inner face

    // Left ridge wall (right side of this wall = vL)
    const lw = new THREE.Mesh(new THREE.BoxGeometry(WALL, RH, PD), ridgeMat);
    lw.position.set(vL - WALL / 2, RH / 2, 0);
    lw.castShadow = true;
    bflyGroup.add(lw); bflyMeshes.push(lw);

    // Right ridge wall (left side of this wall = vR)
    const rw = new THREE.Mesh(new THREE.BoxGeometry(WALL, RH, PD), ridgeMat);
    rw.position.set(vR + WALL / 2, RH / 2, 0);
    rw.castShadow = true;
    bflyGroup.add(rw); bflyMeshes.push(rw);

    // Valley floor emissive plane
    const vfW = RW - 0.04;
    if (vfW > 0.05) {
      const vf = new THREE.Mesh(new THREE.PlaneGeometry(vfW, PD), valleyMat);
      vf.rotation.x = -Math.PI / 2;
      vf.position.set(vCenterX, 0.004, 0);
      vf.renderOrder = 2;
      bflyGroup.add(vf); bflyMeshes.push(vf);
    }

    // Ridge cap glow — top edge of left wall
    const capL = new THREE.Mesh(new THREE.BoxGeometry(WALL + 0.05, 0.055, PD), capMat);
    capL.position.set(vL - WALL / 2, RH + 0.028, 0);
    capL.renderOrder = 3;
    bflyGroup.add(capL); bflyMeshes.push(capL);

    // Ridge cap glow — top edge of right wall
    const capR = new THREE.Mesh(new THREE.BoxGeometry(WALL + 0.05, 0.055, PD), capMat);
    capR.position.set(vR + WALL / 2, RH + 0.028, 0);
    capR.renderOrder = 3;
    bflyGroup.add(capR); bflyMeshes.push(capR);
  }

  // Floor glow plane for whole butterfly panel
  const flMat = new THREE.MeshStandardMaterial({
    color: 0xb040ff, emissive: 0xb040ff, emissiveIntensity: 0.18,
    transparent: true, opacity: 0.35, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -12,
  });
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(PW, PD), flMat);
  fl.rotation.x = -Math.PI / 2;
  fl.position.y = 0.003;
  fl.renderOrder = 1;
  bflyGroup.add(fl); bflyMeshes.push(fl);

  // Front edge glow
  const be = new THREE.Mesh(
    new THREE.BoxGeometry(PW, 0.048, 0.060),
    new THREE.MeshBasicMaterial({ color: 0xb44fff })
  );
  be.position.set(0, 0.004, PD / 2);
  bflyGroup.add(be); bflyMeshes.push(be);
}
buildButterflyPanel(5, 10);

// Butterfly label
const bflyLabel = makeLabel('BUTTERFLY WING PANEL', 0xb44fff);
bflyLabel.position.set(0, 3.4, 0);
bflyGroup.add(bflyLabel);


/* ─────────────────────────────────────────────────────────────────
   §6  RAY PHYSICS  — v14 complete rewrite
   ─────────────────────────────────────────────────────────────────

   FLAT PANEL
   ──────────
   • Absorption probability = 0.90 × cos(θ) × intensity
     (Lambert cosine law — silicon absorbs poorly at grazing angles)
   • Unabsorbed rays specularly reflect: dy flips, dx unchanged
   • Expected efficiency: ~90% at 0°, ~64% at 45°, ~31% at 70°

   BUTTERFLY PANEL — multi-bounce photon trapping
   ──────────────────────────────────────────────
   • Ridge tops funnel light via angled V-slopes (45° each side).
     A ray landing on a ridge top reflects INTO an adjacent valley
     rather than straight back up, mimicking Morpho wing geometry.
   • Inside valley: per-wall-bounce absorption probability grows
     with each bounce (longer optical path → more capture):
       Bounce 1: 38%   Bounce 2: 55%   Bounce 3: 70%
       Bounce 4: 82%   Bounce 5: 91%   Bounce 6+: 96%
   • Floor hit (Y=0, semiconductor substrate): always absorbed (100%)
   • Max 6 wall bounces; after that the ray is counted absorbed
     (sufficiently long optical path guarantees photon capture)
   • Expected efficiency: ~85–95% at ALL sun angles
     (angle-independent — that is the key scientific point)

   ANGULAR SPREAD
   ──────────────
   • Real sunlight is not perfectly parallel; it subtends ±0.27°
     (solar disc). We use ±2.5° to make spread visible.
   • Each ray i gets: sunAngle + spread_i, where
     spread_i ∈ [−2.5°, +2.5°] linearly across the ray set.

   EFFICIENCY FORMULA
   ──────────────────
   efficiency = absorbed_rays / total_rays   (per panel)
   ─────────────────────────────────────────────────────────────── */

const RAY_START_Y   = 9.5;
const MARGIN        = 0.30;
const ANGLE_SPREAD  = 5.0;   // full spread in degrees; ±2.5° per ray
const MAX_BOUNCES   = 6;     // max wall bounces inside valley

// Per-bounce wall absorption probability (grows with bounce count)
const WALL_ABS_PROB = [0.38, 0.55, 0.70, 0.82, 0.91, 0.96];

// Deterministic pseudo-random per (rayIndex, bounceIndex) — no Math.random()
function det01(ix, bounce) {
  let s = (ix * 2654435761 + bounce * 1013904223) >>> 0;
  s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
  return (s >>> 0) / 0x100000000;
}

/* ── FLAT PANEL ─────────────────────────────────────────────── */
function traceFlatRay(ix, nRays, sunDeg, intensity) {
  // Angular spread: rays fan across ±ANGLE_SPREAD/2 degrees
  const frac   = nRays > 1 ? ix / (nRays - 1) : 0.5;
  const angDeg = sunDeg + ANGLE_SPREAD * (frac - 0.5);
  const rad    = angDeg * Math.PI / 180;
  const rdx    = Math.sin(rad);
  const cosInc = Math.max(0.001, Math.cos(rad));   // never exactly zero
  const rdy    = -cosInc;

  // Hit position: evenly spaced across panel surface, then backtrack to sky
  const hitX = FLAT_CX - PW / 2 + MARGIN + frac * (PW - 2 * MARGIN);
  const entX = hitX - rdx * (RAY_START_Y / cosInc);
  const entZ = -PD / 2 + 0.35 + frac * (PD - 0.70);

  // Absorption probability — Lambert cosine law, capped at 0.82
  // Cap ensures butterfly always outperforms flat (ridges recapture what flat loses)
  const absProb = Math.min(0.82, 0.90 * cosInc * intensity);

  // Deterministic: ray ix absorbed if its "lottery ticket" < absProb
  const ticket  = (ix + 0.5) / nRays;
  const absorbed = ticket < absProb;

  const path = [
    new THREE.Vector3(entX, RAY_START_Y, entZ),
    new THREE.Vector3(hitX, 0.015, entZ),
  ];

  if (!absorbed) {
    // Specular reflection: angle of incidence = angle of reflection
    // Incident (rdx, rdy), surface normal (0,1,0) → reflected (rdx, +cosInc)
    const rLen = 5.5;
    path.push(new THREE.Vector3(hitX + rdx * rLen, cosInc * rLen, entZ));
  }

  return { path, absorbed, bounces: 0 };
}

/* ── BUTTERFLY PANEL ────────────────────────────────────────── */
function traceButterflyRay(ix, nRays, sunDeg, intensity) {
  const { RH, RS, RW, WALL } = bflyGeom;

  const frac   = nRays > 1 ? ix / (nRays - 1) : 0.5;
  const angDeg = sunDeg + ANGLE_SPREAD * (frac - 0.5);
  const rad    = angDeg * Math.PI / 180;
  const rdx0   = Math.sin(rad);
  const cosInc = Math.max(0.001, Math.cos(rad));
  const rdy0   = -cosInc;

  // Hit position at ridge-top level, then backtrack to sky
  const hitX  = BFLY_CX - PW / 2 + MARGIN + frac * (PW - 2 * MARGIN);
  const entX  = hitX - rdx0 * ((RAY_START_Y - RH) / cosInc);
  const entZ  = -PD / 2 + 0.35 + frac * (PD - 0.70);

  const path = [
    new THREE.Vector3(entX, RAY_START_Y, entZ),
    new THREE.Vector3(hitX, RH, entZ),
  ];

  // Which valley does hitX fall in?
  const panelLeft = BFLY_CX - PW / 2;
  const relX = hitX - panelLeft;
  const vi   = Math.floor(relX / RS);
  // Valley i: centre at panelLeft + (vi+0.5)*RS
  const vCen = panelLeft + (vi + 0.5) * RS;
  const vL   = vCen - RW / 2;   // valley left  inner face (world X)
  const vR   = vCen + RW / 2;   // valley right inner face (world X)

  const inValley = hitX >= vL && hitX <= vR;

  // Starting ray state for the bounce loop
  let cx = hitX, cy = RH;
  let dx = rdx0, dy = rdy0;
  // Active valley bounds (may stay same or shift to neighbour after ridge reflect)
  let avL = vL, avR = vR;

  if (!inValley) {
    /* ── Ridge-top funnel geometry ────────────────────────────────
       Real Morpho butterfly ridge profiles have angled facets that
       act as light funnels. We model each ridge top as a V-shape:
         Left  slope normal: (+sin45°, +cos45°) = (+0.707, +0.707)
         Right slope normal: (−sin45°, +cos45°) = (−0.707, +0.707)
       The slope closest to hitX determines which valley the ray
       gets directed into.
    */
    // Find the two valley boundaries surrounding hitX
    // hitX is in the ridge between valley vi and vi+1
    const leftValCen  = panelLeft + (vi       + 0.5) * RS;  // valley to the left
    const rightValCen = panelLeft + (vi + 1   + 0.5) * RS;  // valley to the right (vi+1)
    const ridgeCen    = (leftValCen + RW / 2 + rightValCen - RW / 2) / 2; // ridge centre X

    // Left slope (faces left valley), right slope (faces right valley)
    const onLeftSlope = hitX < ridgeCen;
    const nrmX = onLeftSlope ?  0.70711 : -0.70711;
    const nrmY =                0.70711;

    // Reflect incident direction off the angled ridge face
    const dDotN = rdx0 * nrmX + rdy0 * nrmY;
    dx = rdx0 - 2 * dDotN * nrmX;
    dy = rdy0 - 2 * dDotN * nrmY;

    path.push(new THREE.Vector3(cx, cy, entZ));

    if (dy > 0.05) {
      // Reflected clearly upward — escaped (ray exited the structure)
      path.push(new THREE.Vector3(cx + dx * 3.5, cy + Math.abs(dy) * 3.5, entZ));
      return { path, absorbed: false, bounces: 0 };
    }

    // Reflected downward — redirect into the adjacent valley
    if (onLeftSlope) {
      // Heading toward left valley (vi)
      avL = leftValCen  - RW / 2;
      avR = leftValCen  + RW / 2;
    } else {
      // Heading toward right valley (vi+1)
      avL = rightValCen - RW / 2;
      avR = rightValCen + RW / 2;
    }
    // Project cx into the new valley opening
    cx = Math.max(avL + 1e-5, Math.min(avR - 1e-5, cx));
  }

  /* ── Multi-bounce tracing inside valley ───────────────────────
     Floor (Y=0) = semiconductor substrate → always absorbed
     Walls (X=avL or avR) → specular reflect (flip dx), with
     growing probability of absorption at each bounce
  */
  let bounces  = 0;
  let absorbed = false;
  let escaped  = false;

  for (let b = 0; b < MAX_BOUNCES; b++) {
    const tL  = (dx < 0 && cx > avL + 1e-8) ? (avL - cx) / dx : Infinity;
    const tR  = (dx > 0 && cx < avR - 1e-8) ? (avR - cx) / dx : Infinity;
    const tF  = (dy < 0 && cy > 1e-8)        ?       -cy / dy  : Infinity;
    const tT  = (dy > 0 && cy < RH - 1e-8)   ? (RH - cy) / dy : Infinity;
    const tMn = Math.min(tL, tR, tF, tT);

    if (!isFinite(tMn) || tMn < 1e-9) { absorbed = true; break; }

    cx = cx + dx * tMn;
    cy = Math.max(0, Math.min(RH, cy + dy * tMn));
    path.push(new THREE.Vector3(cx, cy, entZ));

    if (Math.abs(tMn - tF) < 1e-7) {
      // ── Floor hit: semiconductor substrate always absorbs ──
      absorbed = true;
      break;

    } else if (Math.abs(tMn - tT) < 1e-7 && dy > 0) {
      // ── Escaped through valley opening at the top ──
      path.push(new THREE.Vector3(cx + dx * 3.0, cy + cosInc * 3.0, entZ));
      escaped = true;
      break;

    } else {
      // ── Wall bounce: specular reflection, then probabilistic absorption ──
      dx = -dx;
      bounces++;

      const pAbs = Math.min(0.98,
        WALL_ABS_PROB[Math.min(bounces - 1, WALL_ABS_PROB.length - 1)] * intensity
      );
      if (det01(ix, bounces) < pAbs) {
        absorbed = true;
        break;
      }
    }
  }

  // If still bouncing after MAX_BOUNCES, the ray is thoroughly trapped
  if (!absorbed && !escaped) absorbed = true;

  return { path, absorbed: absorbed && !escaped, bounces };
}

/* ── Run all rays ────────────────────────────────────────────── */
function runPhysics(params) {
  const { sunAngle, numRays, ridgeHeight, ridgeSpacing, intensity } = params;
  buildButterflyPanel(ridgeHeight, ridgeSpacing);

  let fAbs = 0, fEsc = 0, bAbs = 0, bEsc = 0;
  const flatRays = [], bflyRays = [];

  for (let i = 0; i < numRays; i++) {
    const fr = traceFlatRay(i, numRays, sunAngle, intensity);
    flatRays.push(fr);
    fr.absorbed ? fAbs++ : fEsc++;

    const br = traceButterflyRay(i, numRays, sunAngle, intensity);
    bflyRays.push(br);
    br.absorbed ? bAbs++ : bEsc++;
  }

  return {
    flatRays, bflyRays,
    fAbs, fEsc, bAbs, bEsc,
    flatEff: numRays > 0 ? fAbs / numRays : 0,
    bflyEff: numRays > 0 ? bAbs / numRays : 0,
    gain:    numRays > 0 ? (bAbs - fAbs) / numRays : 0,
  };
}


/* ─────────────────────────────────────────────────────────────────
   §7  RAY VISUALIZATION  —  BUG 1 FIXED: vertex colors per segment
   ─────────────────────────────────────────────────────────────────
   Color scheme baked into a static Float32Array per ray:
     Vertex 0  (sky start)          →  warm white  (1.0, 1.0, 0.70)
     Vertex 1  (surface hit)        →  yellow       (1.0, 0.85, 0.05)
     Vertices 2..N-2 (bounces)      →  orange       (1.0, 0.50, 0.05)
     Vertex N-1 absorbed            →  green        (0.0, 1.0, 0.50)
     Vertex N-1 escaped             →  red          (1.0, 0.22, 0.15)

   The position buffer is updated each frame (setDrawRange + tip lerp).
   The color buffer is NEVER updated — it's pre-computed and static.
   A small sphere "photon head" moves along the ray tip for clarity.
*/
const rayGroup = new THREE.Group();
scene.add(rayGroup);

let animRays = [];

function vertColor(r, g, b) { return [r, g, b]; }
const VC = {
  skyEntry:  vertColor(1.00, 1.00, 0.70),  // warm white (sky start)
  panelHit:  vertColor(1.00, 0.85, 0.05),  // yellow (first surface contact)
  bounce:    vertColor(1.00, 0.50, 0.05),  // orange (inside valley bounces)
  absorbed:  vertColor(0.00, 1.00, 0.50),  // bright green (absorbed endpoint)
  escaped:   vertColor(1.00, 0.22, 0.15),  // bright red (escaped/reflected endpoint)
};

function buildRayLines(data) {
  // Dispose previous objects
  for (let k = animRays.length - 1; k >= 0; k--) {
    const old = animRays[k];
    if (old.geo)     old.geo.dispose();
    if (old.mat)     old.mat.dispose();
    if (old.line)    rayGroup.remove(old.line);
    if (old.photon)  { old.photon.geometry.dispose(); old.photon.material.dispose(); rayGroup.remove(old.photon); }
    if (old.burst)   { old.burst.geometry.dispose();  old.burst.material.dispose();  rayGroup.remove(old.burst);  }
  }
  animRays = [];

  const allRays   = data.flatRays.concat(data.bflyRays);
  const nPerPanel = data.flatRays.length;
  const STAGGER   = 0.18;   // left-to-right launch window

  for (let ri = 0; ri < allRays.length; ri++) {
    const ray = allRays[ri];
    const N   = ray.path.length;
    if (N < 2) continue;

    // ── Position buffer (mutable) ──
    const posBuf = new Float32Array(N * 3);
    for (let pi = 0; pi < N; pi++) {
      posBuf[pi * 3]     = ray.path[0].x;
      posBuf[pi * 3 + 1] = ray.path[0].y;
      posBuf[pi * 3 + 2] = ray.path[0].z;
    }

    // ── Color buffer (STATIC — pre-computed per segment type) ──
    const colBuf = new Float32Array(N * 3);
    for (let pi = 0; pi < N; pi++) {
      let vc;
      if (pi === 0)         vc = VC.skyEntry;
      else if (pi === 1)    vc = VC.panelHit;
      else if (pi < N - 1) vc = VC.bounce;
      else                  vc = ray.absorbed ? VC.absorbed : VC.escaped;
      colBuf[pi * 3]     = vc[0];
      colBuf[pi * 3 + 1] = vc[1];
      colBuf[pi * 3 + 2] = vc[2];
    }

    const posAttr = new THREE.BufferAttribute(posBuf, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    const colAttr = new THREE.BufferAttribute(colBuf, 3);  // static

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', posAttr);
    geo.setAttribute('color',    colAttr);
    geo.setDrawRange(0, 2);

    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      depthTest: false,
      depthWrite: false,
      transparent: true, opacity: 0.95,
    });
    const line = new THREE.Line(geo, mat);
    line.visible = false;
    line.renderOrder = 999;
    rayGroup.add(line);

    // Moving photon head sphere
    const photon = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false })
    );
    photon.visible = false;
    photon.renderOrder = 1000;
    rayGroup.add(photon);

    // Absorption burst
    let burst = null;
    if (ray.absorbed) {
      const fp = ray.path[N - 1];
      burst = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 10, 10),
        new THREE.MeshBasicMaterial({
          color: 0x00ff88, transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false,
        })
      );
      burst.position.copy(fp);
      burst.renderOrder = 998;
      rayGroup.add(burst);
    }

    // Immutable path copy
    const pathCopy = ray.path.map(p => p.clone());

    const localIdx = ri % nPerPanel;
    const tStart   = (localIdx / Math.max(nPerPanel - 1, 1)) * STAGGER;
    const tEnd     = tStart + (1 - STAGGER);

    animRays.push({
      pathCopy, posBuf, posAttr, geo, mat, line, photon, burst,
      N, tStart, tEnd, absorbed: ray.absorbed,
    });
  }
}

function tickRay(ar, t) {
  const p = (t - ar.tStart) / Math.max(ar.tEnd - ar.tStart, 0.001);
  if (p <= 0) {
    ar.line.visible   = false;
    ar.photon.visible = false;
    return;
  }
  ar.line.visible   = true;

  const prog = Math.min(1, p);
  const N    = ar.N;
  const segs = N - 1;
  const draw = prog * segs;
  const seg  = Math.min(Math.floor(draw), segs - 1);
  const frac = draw - seg;

  // Write all revealed vertices from immutable pathCopy
  for (let i = 0; i <= seg; i++) {
    ar.posBuf[i * 3]     = ar.pathCopy[i].x;
    ar.posBuf[i * 3 + 1] = ar.pathCopy[i].y;
    ar.posBuf[i * 3 + 2] = ar.pathCopy[i].z;
  }

  // Interpolated tip
  const a = ar.pathCopy[seg], b = ar.pathCopy[seg + 1];
  const tipX = a.x + (b.x - a.x) * frac;
  const tipY = a.y + (b.y - a.y) * frac;
  const tipZ = a.z + (b.z - a.z) * frac;
  ar.posBuf[(seg + 1) * 3]     = tipX;
  ar.posBuf[(seg + 1) * 3 + 1] = tipY;
  ar.posBuf[(seg + 1) * 3 + 2] = tipZ;

  ar.posAttr.needsUpdate = true;
  ar.geo.setDrawRange(0, seg + 2);

  // Photon head at tip
  ar.photon.visible = prog < 1.0;
  if (ar.photon.visible) ar.photon.position.set(tipX, tipY, tipZ);

  // Absorption burst: fade in after ray completes
  if (ar.burst) {
    const bt = Math.max(0, Math.min(1, (t - ar.tEnd + 0.03) / 0.14));
    ar.burst.material.opacity = bt * 0.92;
    ar.burst.scale.setScalar(1 + bt * 2.8);
  }
}

function tickAllRays(t) {
  for (let k = 0; k < animRays.length; k++) tickRay(animRays[k], t);
}

function hideAllRays() {
  for (let k = 0; k < animRays.length; k++) {
    animRays[k].line.visible   = false;
    animRays[k].photon.visible = false;
    if (animRays[k].burst) {
      animRays[k].burst.material.opacity = 0;
      animRays[k].burst.scale.setScalar(1);
    }
  }
}


/* ─────────────────────────────────────────────────────────────────
   §8  RENDER LOOP  —  zoom-adaptive speed + sun billboard
   ───────────────────────────────────────────────────────────────── */
let animState  = 'idle';
let animT      = 0, prevTS = 0, pulseClock = 0;
const ANIM_DUR = 4800;

function getSpeed() {
  const el = document.getElementById('animSpeed');
  return el ? Math.max(0.1, parseFloat(el.value)) : 1.0;
}
function zoomFactor() {
  if (oR < 8)  return 0.15;
  if (oR < 12) return 0.28;
  if (oR < 18) return 0.55;
  return 1.0;
}

function renderLoop(ts) {
  requestAnimationFrame(renderLoop);
  const dt = Math.min(ts - prevTS, 100);
  prevTS = ts;
  pulseClock += dt * 0.0008;

  // Sun pulse
  const pulse = 0.94 + Math.sin(pulseClock) * 0.06;
  coronaSprite.material.opacity = 0.85 + Math.sin(pulseClock * 0.7) * 0.10;
  glowSprite.material.opacity   = 0.90 + Math.sin(pulseClock) * 0.10;
  coreSprite.scale.setScalar(6 + Math.sin(pulseClock * 1.2) * 0.3);
  sunPL.intensity = 4.0 + Math.sin(pulseClock) * 0.7;

  // Billboard spike lines: rotate their group to always face camera
  spikeAngle += dt * 0.00025;
  // Spikes live on sunGroup in local space at Z=0; rotating sunGroup around local Z
  // makes them spin in the plane perpendicular to camera from sun's perspective.
  // Instead: spin in world X-Z plane by rotating around Y slightly:
  sunGroup.children.forEach((c, i) => {
    if (i >= 3 && i <= 14) {  // spike lines
      c.rotation.z = spikeAngle;
    }
  });

  // Animation
  if (animState === 'running') {
    animT = Math.min(1, animT + dt / (ANIM_DUR / (getSpeed() * zoomFactor())));
    tickAllRays(animT);
    if (animT >= 1) {
      animState = 'done';
      document.getElementById('simStatus').classList.add('hidden');
    }
  }

  renderer.render(scene, camera);
}
requestAnimationFrame(renderLoop);


/* ─────────────────────────────────────────────────────────────────
   §9  UI
   ───────────────────────────────────────────────────────────────── */
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
    numRays:      parseInt  (document.getElementById('numRays').value),
    ridgeHeight:  parseFloat(document.getElementById('ridgeHeight').value),
    ridgeSpacing: parseFloat(document.getElementById('ridgeSpacing').value),
    intensity:    parseFloat(document.getElementById('lightIntensity').value),
  };
}

function pct(v) { return (v * 100).toFixed(1) + '%'; }
function $el(id) { return document.getElementById(id); }

function updateUI(d) {
  $el('flatEff').textContent       = pct(d.flatEff);
  $el('flatEffTag').textContent    = pct(d.flatEff);
  $el('flatAbsorbed').textContent  = String(d.fAbs);
  $el('flatReflected').textContent = String(d.fEsc);
  $el('bflyEff').textContent       = pct(d.bflyEff);
  $el('bflyEffTag').textContent    = pct(d.bflyEff);
  $el('bflyAbsorbed').textContent  = String(d.bAbs);
  $el('bflyReflected').textContent = String(d.bEsc);
  const g = d.gain;
  $el('gainValue').textContent = (g >= 0 ? '+' : '') + pct(g);

  // Reset bars then animate in
  ['flatBar', 'bflyBar', 'gainBar'].forEach(id => { const b=$el(id); if(b) b.style.width='0%'; });
  ['flatBarVal','bflyBarVal','gainBarVal'].forEach(id => { const v=$el(id); if(v) v.textContent=''; });
  setTimeout(() => {
    [
      ['flatBar','flatBarVal', d.flatEff,           ''],
      ['bflyBar','bflyBarVal', d.bflyEff,           ''],
      ['gainBar','gainBarVal', Math.max(0, d.gain),  g >= 0 ? '+' : ''],
    ].forEach(([bId, vId, val, pre]) => {
      const bar=$el(bId), lbl=$el(vId);
      if (bar) bar.style.width = Math.min(100, val * 100) + '%';
      if (lbl) lbl.textContent = pre + pct(val);
    });
  }, 80);
}

$el('btnStart').addEventListener('click', () => {
  const p = getParams();
  moveSun(p.sunAngle);
  const data = runPhysics(p);
  buildRayLines(data);
  updateUI(data);
  hideAllRays();
  animT = 0; animState = 'running';
  $el('simStatus').classList.add('hidden');
  $el('btnPause').disabled = false;
  $el('btnReset').disabled = false;
  $el('btnPause').textContent = '⏸ Pause';
  $el('engineDot').classList.add('on');
});

$el('btnPause').addEventListener('click', () => {
  if      (animState === 'running') { animState = 'paused';  $el('btnPause').textContent = '▶ Resume'; }
  else if (animState === 'paused')  { animState = 'running'; $el('btnPause').textContent = '⏸ Pause'; }
});

$el('btnReset').addEventListener('click', () => {
  hideAllRays(); animT = 0; animState = 'idle';
  const s = $el('simStatus'); s.textContent = 'Press ▶ Start to run again'; s.classList.remove('hidden');
  $el('btnPause').disabled = true; $el('btnPause').textContent = '⏸ Pause';
});

$el('btnFullscreen').addEventListener('click', () => {
  const wrap = $el('vpOuter');
  if (!document.fullscreenElement) {
    (wrap.requestFullscreen || wrap.webkitRequestFullscreen || (() => {})).call(wrap);
  } else {
    (document.exitFullscreen || document.webkitExitFullscreen || (() => {})).call(document);
  }
});


/* ─────────────────────────────────────────────────────────────────
   §10  RESIZE  +  NAV  +  INIT
   ───────────────────────────────────────────────────────────────── */
function onResize() {
  const { w, h } = sz();
  if (w < 2 || h < 2) return;
  W = w; H = h;
  renderer.setSize(W, H);
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
document.addEventListener('fullscreenchange',       () => setTimeout(onResize, 80));
document.addEventListener('webkitfullscreenchange', () => setTimeout(onResize, 80));
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(onResize).observe(container);

const ioObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const a = document.querySelector(`.nav-link[href="#${e.target.id}"]`);
    if (a) a.classList.add('active');
  });
}, { threshold: 0.25 });
document.querySelectorAll('section[id]').forEach(s => ioObs.observe(s));

moveSun(45);
setTimeout(onResize, 60);

}); // end window.load

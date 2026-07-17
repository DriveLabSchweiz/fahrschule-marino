/**
 * Journey environment assets — Fahrschule Antonio Marino night-city scene.
 * ========================================================================
 * Procedural low-poly Three.js. Follows the shared contract in ../palette.js:
 *   - `import * as THREE from 'three'` only, no textures/loaders.
 *   - 1 unit = 1 metre, ground at y = 0, assets centred at local origin,
 *     FRONT facing +Z (road & skyline follow their own layout logic).
 *   - MeshStandardMaterial via the shared matBody / matGlow / matGlass helpers,
 *     flatShading where crisp, emissive glow for anything a bloom pass should
 *     catch, InstancedMesh for repeated geometry, < 8k tris per factory.
 *   - Animatable meshes carry the canonical NAMES so the scene can find them.
 */

import * as THREE from 'three';
import { PALETTE, NAMES, matBody, matGlow, matGlass } from '../palette.js';

// ---------------------------------------------------------------------------
// Shared cached geometries / materials (reused across factories & instances).
// ---------------------------------------------------------------------------
const _z = new THREE.Vector3(0, 0, 1);
const _up = new THREE.Vector3(0, 1, 0);

const GEO = {
  unitBox: new THREE.BoxGeometry(1, 1, 1),
  win: new THREE.PlaneGeometry(0.7, 0.9),
};

const MAT = {
  asphalt: matBody(PALETTE.asphalt, { roughness: 0.95, metalness: 0.05, flatShading: false }),
  metal: matBody(PALETTE.metal, { roughness: 0.5, metalness: 0.75 }),
  dark: matBody(PALETTE.dark, { roughness: 0.7, metalness: 0.3 }),
  laneAmber: matGlow(PALETTE.laneMark, 2.6),
  // Centre dashes: plain light grey, NON-emissive, high roughness. The road is
  // read at night by streetlights + hemisphere fill, not by glowing paint.
  dash: matBody(0xc4c8d2, { roughness: 0.95, metalness: 0.0, flatShading: false }),
  // Kerb edge lines: faint, non-emissive (toned down from the old glow).
  edge: matBody(PALETTE.muted, { roughness: 0.9, metalness: 0.0 }),
  white: matGlow(PALETTE.white, 2.2),
  window: matGlow(PALETTE.windowGlow, 2.3, { side: THREE.DoubleSide }),
  tower: matBody(PALETTE.surface, { roughness: 0.95, metalness: 0.1 }),
};

// ===========================================================================
// 1. ROAD — flat asphalt ribbon that follows a CatmullRomCurve3.
// ===========================================================================
export function createRoad(curve, width = 7) {
  const group = new THREE.Group();
  group.name = NAMES.road; // 'road'

  const half = width / 2;
  const length = curve.getLength();
  const segments = Math.max(24, Math.floor(length / 2));
  const y = 0.01; // lift off the ground plane to dodge z-fighting

  // --- asphalt ribbon: sample the curve, extrude left/right of the tangent ---
  const pos = [];
  const idx = [];
  const side = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    const p = curve.getPointAt(u);
    const tan = curve.getTangentAt(u);
    side.crossVectors(tan, _up).normalize(); // lateral, in the XZ plane
    pos.push(
      p.x + side.x * half, y, p.z + side.z * half, // left edge
      p.x - side.x * half, y, p.z - side.z * half  // right edge
    );
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, c, b, b, c, d);
  }
  const ribbon = new THREE.BufferGeometry();
  ribbon.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  ribbon.setIndex(idx);
  ribbon.computeVertexNormals();
  const road = new THREE.Mesh(ribbon, new THREE.MeshStandardMaterial({
    color: PALETTE.asphalt, roughness: 0.95, metalness: 0.05, side: THREE.DoubleSide,
  }));
  road.receiveShadow = true;
  group.add(road);

  // --- amber centre dashes: thin emissive boxes every few metres ------------
  const dashGeo = new THREE.BoxGeometry(0.16, 0.02, 1.6);
  const dashStep = 4.5;
  const dashCount = Math.max(1, Math.floor(length / dashStep));
  const dashes = new THREE.InstancedMesh(dashGeo, MAT.dash, dashCount);
  const q = new THREE.Quaternion();
  const m = new THREE.Matrix4();
  const s = new THREE.Vector3(1, 1, 1);
  const p = new THREE.Vector3();
  for (let i = 0; i < dashCount; i++) {
    const u = (i + 0.5) / dashCount;
    p.copy(curve.getPointAt(u));
    p.y = y + 0.011;
    q.setFromUnitVectors(_z, curve.getTangentAt(u)); // align dash length to tangent
    m.compose(p, q, s);
    dashes.setMatrixAt(i, m);
  }
  dashes.instanceMatrix.needsUpdate = true;
  group.add(dashes);

  // --- faint edge lines: two narrow continuous ribbons near the kerbs -------
  for (const dir of [1, -1]) {
    const ep = [];
    const ei = [];
    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      const c = curve.getPointAt(u);
      const tan = curve.getTangentAt(u);
      side.crossVectors(tan, _up).normalize();
      const o = (half - 0.25) * dir;
      const w = 0.06;
      ep.push(
        c.x + side.x * (o + w), y + 0.005, c.z + side.z * (o + w),
        c.x + side.x * (o - w), y + 0.005, c.z + side.z * (o - w)
      );
    }
    for (let i = 0; i < segments; i++) {
      const a = i * 2, b = a + 1, cc = a + 2, d = a + 3;
      ei.push(a, cc, b, b, cc, d);
    }
    const eg = new THREE.BufferGeometry();
    eg.setAttribute('position', new THREE.Float32BufferAttribute(ep, 3));
    eg.setIndex(ei);
    eg.computeVertexNormals();
    group.add(new THREE.Mesh(eg, MAT.edge));
  }

  return group;
}

// ===========================================================================
// 2. INTERSECTION — Y/fork piece with turn arrows + a traffic light.
// ===========================================================================
function makeArrowShape() {
  // Arrow drawn in the shape's XY plane, pointing +Y (becomes +Z once flat).
  const s = new THREE.Shape();
  s.moveTo(-0.22, -0.9);
  s.lineTo(0.22, -0.9);
  s.lineTo(0.22, 0.15);
  s.lineTo(0.55, 0.15);
  s.lineTo(0, 0.95);
  s.lineTo(-0.55, 0.15);
  s.lineTo(-0.22, 0.15);
  s.closePath();
  return s;
}

function makeTrafficLight() {
  const tl = new THREE.Group();
  tl.name = NAMES.trafficLight; // 'traffic-light'

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 5.2, 8), MAT.metal);
  pole.position.y = 2.6;
  tl.add(pole);

  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.7, 0.4), MAT.dark);
  housing.position.set(0, 5.1, 0.15);
  tl.add(housing);

  const lampGeo = new THREE.SphereGeometry(0.18, 12, 10);
  const lamps = [
    ['lamp-red', PALETTE.red, 5.62, 3.0],
    ['lamp-amber', PALETTE.amber, 5.1, 0.15],
    ['lamp-green', PALETTE.green, 4.58, 0.15],
  ];
  for (const [name, color, ly, intensity] of lamps) {
    const lamp = new THREE.Mesh(lampGeo, matGlow(color, intensity));
    lamp.name = name;
    lamp.position.set(0, ly, 0.36);
    tl.add(lamp);
  }
  return tl;
}

export function createIntersection() {
  const group = new THREE.Group();
  group.name = NAMES.fork; // 'fork'

  // asphalt pad ~20 m square
  const pad = new THREE.Mesh(new THREE.BoxGeometry(20, 0.04, 20), MAT.asphalt);
  pad.position.y = 0.02;
  pad.receiveShadow = true;
  group.add(pad);

  // white stop lines (near edge + the two fork mouths)
  const stopGeo = new THREE.BoxGeometry(7, 0.02, 0.4);
  const stopY = 0.045;
  const stop = new THREE.Mesh(stopGeo, MAT.white);
  stop.position.set(0, stopY, -8.4);
  group.add(stop);

  // turn arrows — highlightable meshes 'arrow-left' / 'arrow-right'
  const arrowGeo = new THREE.ExtrudeGeometry(makeArrowShape(), { depth: 0.05, bevelEnabled: false });
  arrowGeo.rotateX(-Math.PI / 2); // lay flat, arrow points +Z

  const arrowRight = new THREE.Mesh(arrowGeo, matGlow(PALETTE.white, 2.4));
  arrowRight.name = 'arrow-right';
  arrowRight.position.set(1.7, 0.05, -3.5);
  arrowRight.rotation.y = -Math.PI / 2.4; // fan out toward the right fork
  group.add(arrowRight);

  const arrowLeft = new THREE.Mesh(arrowGeo, matGlow(PALETTE.amber, 2.4));
  arrowLeft.name = 'arrow-left';
  arrowLeft.position.set(-1.7, 0.05, -3.5);
  arrowLeft.rotation.y = Math.PI / 2.4; // fan out toward the left fork
  group.add(arrowLeft);

  // traffic light on the near-right corner
  const tl = makeTrafficLight();
  tl.position.set(4.6, 0, -7.6);
  group.add(tl);

  return group;
}

// ===========================================================================
// 3. PHONE PROP — giant quiz smartphone monument on the sidewalk.
// ===========================================================================
export function createPhoneProp() {
  const group = new THREE.Group();
  group.name = NAMES.phone; // 'phone-prop'

  // small foundation pad the phone stands on
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.05, 0.2, 16), MAT.metal);
  base.position.y = 0.1;
  group.add(base);

  // tilted-back phone assembly
  const phone = new THREE.Group();
  phone.position.y = 0.2;
  phone.rotation.x = -0.12; // lean the top away from the viewer
  group.add(phone);

  const bodyW = 1.7, bodyH = 3.0, bodyD = 0.2;
  const body = new THREE.Mesh(new THREE.BoxGeometry(bodyW, bodyH, bodyD), MAT.dark);
  body.position.y = bodyH / 2;
  phone.add(body);

  // soft amber rim glow — a slightly larger emissive plate behind the body
  const rim = new THREE.Mesh(
    new THREE.BoxGeometry(bodyW + 0.16, bodyH + 0.16, 0.04),
    matGlow(PALETTE.amber, 1.4)
  );
  rim.position.set(0, bodyH / 2, -bodyD / 2 - 0.01);
  phone.add(rim);

  // glowing screen — findable as 'phone-screen'
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(bodyW - 0.24, bodyH - 0.32),
    matGlow(PALETTE.blue, 1.6, { color: 0x0a1030 })
  );
  screen.name = NAMES.phoneScreen; // 'phone-screen'
  screen.position.set(0, bodyH / 2, bodyD / 2 + 0.011);
  phone.add(screen);

  // simplified quiz UI built from small emissive blocks (on top of the screen)
  const uiZ = bodyD / 2 + 0.02;
  const uiW = bodyW - 0.4;
  // question bar (top)
  const qbar = new THREE.Mesh(new THREE.PlaneGeometry(uiW, 0.5), matGlow(PALETTE.white, 1.8));
  qbar.position.set(0, bodyH / 2 + 0.85, uiZ);
  phone.add(qbar);
  // three answer bars, middle one green = correct
  const answers = [
    [0.35, PALETTE.muted, 1.2],
    [-0.05, PALETTE.green, 2.6],
    [-0.45, PALETTE.muted, 1.2],
  ];
  for (const [yOff, color, glow] of answers) {
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(uiW, 0.34), matGlow(color, glow));
    bar.position.set(0, bodyH / 2 + yOff, uiZ);
    phone.add(bar);
  }

  return group;
}

// ===========================================================================
// 4. STREETLIGHT — classic curved-arm lamp + one distance-limited PointLight.
// ===========================================================================
export function createStreetlight({ light = true } = {}) {
  const group = new THREE.Group();
  group.name = NAMES.streetlight; // 'streetlight'

  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.4, 10), MAT.metal);
  foot.position.y = 0.2;
  group.add(foot);

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 6, 8), MAT.metal);
  pole.position.y = 3.4;
  group.add(pole);

  // curved arm via a short bezier tube
  const armCurve = new THREE.CubicBezierCurve3(
    new THREE.Vector3(0, 6.3, 0),
    new THREE.Vector3(0, 6.9, 0),
    new THREE.Vector3(1.2, 6.9, 0),
    new THREE.Vector3(1.7, 6.5, 0)
  );
  const arm = new THREE.Mesh(new THREE.TubeGeometry(armCurve, 14, 0.08, 6, false), MAT.metal);
  group.add(arm);

  // warm lamp head
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.16, 0.34, 10), matGlow(PALETTE.amberBright, 3.0));
  head.position.set(1.7, 6.38, 0);
  head.rotation.z = 0.15;
  head.name = 'streetlight-lamp';
  group.add(head);

  // Optional distance-limited warm PointLight. Most posts ship WITHOUT one
  // (performance): the emissive lamp head + hemisphere fill carry the look, and
  // only ~4 posts near key stations keep a real light.
  if (light) {
    const pl = new THREE.PointLight(PALETTE.amber, 7, 16, 2);
    pl.position.set(1.7, 6.2, 0);
    group.add(pl);
  }

  return group;
}

// ===========================================================================
// 5. TREE — cheap stylized night tree.
// ===========================================================================
const TREE_MAT = {
  trunk: matBody(0x1a1410, { roughness: 0.9, metalness: 0.05 }),
  foliage: matBody(0x0e1c1e, { roughness: 1.0, metalness: 0.0 }), // dark desaturated green-navy
};

export function createTree() {
  const group = new THREE.Group();
  group.name = 'tree';

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.6, 6), TREE_MAT.trunk);
  trunk.position.y = 0.8;
  group.add(trunk);

  // stacked low-poly foliage — icosahedron core + cone crown
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 0), TREE_MAT.foliage);
  core.position.y = 2.3;
  core.rotation.y = 0.5;
  group.add(core);

  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.7, 6), TREE_MAT.foliage);
  crown.position.y = 3.2;
  group.add(crown);

  return group;
}

// ===========================================================================
// 6. SKYLINE — distant dark towers with sparse emissive windows (instanced).
// ===========================================================================
export function createSkyline() {
  const group = new THREE.Group();
  group.name = NAMES.skyline; // 'skyline'

  const count = 20;
  const radius = 150;
  const spread = Math.PI * 0.95; // ~200 m wide arc
  const towers = new THREE.InstancedMesh(GEO.unitBox, MAT.tower, count);
  const winMatrices = [];

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const wq = new THREE.Quaternion(); // windows face +Z
  const wScl = new THREE.Vector3(1, 1, 1);

  for (let i = 0; i < count; i++) {
    const a = -spread / 2 + (i / (count - 1)) * spread;
    const w = 8 + Math.random() * 8;
    const h = 22 + Math.random() * 48;
    const d = 8 + Math.random() * 8;
    const x = Math.sin(a) * radius + (Math.random() - 0.5) * 14;
    const z = -Math.cos(a) * radius - Math.random() * 30; // sit far behind (−Z)

    pos.set(x, h / 2, z);
    scl.set(w, h, d);
    m.compose(pos, q, scl);
    towers.setMatrixAt(i, m);

    // sparse lit windows on the face pointing back toward the origin (+Z)
    const cols = Math.max(2, Math.floor(w / 2.4));
    const rows = Math.max(3, Math.floor(h / 3.2));
    const faceZ = z + d / 2 + 0.05;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (Math.random() > 0.28) continue; // most windows dark
        const wx = x - w / 2 + (c + 0.5) * (w / cols);
        const wy = 1.5 + (r + 0.5) * (h / rows) * 0.95;
        winMatrices.push(new THREE.Matrix4().compose(new THREE.Vector3(wx, wy, faceZ), wq, wScl));
      }
    }
  }
  towers.instanceMatrix.needsUpdate = true;
  group.add(towers);

  const windows = new THREE.InstancedMesh(GEO.win, MAT.window, winMatrices.length);
  for (let i = 0; i < winMatrices.length; i++) windows.setMatrixAt(i, winMatrices[i]);
  windows.instanceMatrix.needsUpdate = true;
  group.add(windows);

  return group;
}

// ===========================================================================
// 7. BUS STOP — shelter with glass roof, glowing H/BUS panel, bench.
// ===========================================================================
export function createBusStop() {
  const group = new THREE.Group();
  group.name = NAMES.busStop; // 'bus-stop'

  const w = 3.4, d = 1.6, h = 2.4;

  // four corner posts
  const postGeo = new THREE.CylinderGeometry(0.06, 0.06, h, 6);
  for (const [px, pz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) {
    const post = new THREE.Mesh(postGeo, MAT.metal);
    post.position.set(px, h / 2, pz);
    group.add(post);
  }

  // glass roof
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.08, d + 0.3), matGlass(0x16203c, 0x0a1428));
  roof.position.set(0, h, 0);
  group.add(roof);

  // rear glass wall
  const back = new THREE.Mesh(new THREE.BoxGeometry(w, h - 0.3, 0.05), matGlass(0x16203c));
  back.position.set(0, (h - 0.3) / 2, -d / 2);
  group.add(back);

  // glowing yellow H / BUS sign panel on a small mast
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.0, 6), MAT.metal);
  mast.position.set(w / 2 + 0.5, 1.5, d / 2);
  group.add(mast);

  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.08), matGlow(PALETTE.amberBright, 1.4));
  panel.position.set(w / 2 + 0.5, 2.7, d / 2);
  panel.name = 'bus-sign';
  group.add(panel);

  // "H" bars (dark cut-out) laid over the glowing panel
  const hMat = MAT.dark;
  const hz = d / 2 + 0.05;
  const barV = new THREE.BoxGeometry(0.1, 0.44, 0.04);
  const barH = new THREE.BoxGeometry(0.24, 0.1, 0.04);
  const hLeft = new THREE.Mesh(barV, hMat); hLeft.position.set(w / 2 + 0.5 - 0.14, 2.7, hz); group.add(hLeft);
  const hRight = new THREE.Mesh(barV, hMat); hRight.position.set(w / 2 + 0.5 + 0.14, 2.7, hz); group.add(hRight);
  const hMid = new THREE.Mesh(barH, hMat); hMid.position.set(w / 2 + 0.5, 2.7, hz); group.add(hMid);

  // small bench
  const seat = new THREE.Mesh(new THREE.BoxGeometry(w - 0.6, 0.08, 0.5), MAT.metal);
  seat.position.set(0, 0.5, -d / 2 + 0.4);
  group.add(seat);
  const legGeo = new THREE.BoxGeometry(0.08, 0.5, 0.08);
  for (const lx of [-(w - 0.9) / 2, (w - 0.9) / 2]) {
    const leg = new THREE.Mesh(legGeo, MAT.metal);
    leg.position.set(lx, 0.25, -d / 2 + 0.4);
    group.add(leg);
  }

  return group;
}

// ===========================================================================
// 8. tickEnvironment — idle animation helper (traffic light + phone shimmer).
// ===========================================================================
export function tickEnvironment(group, t) {
  if (!group) return;
  // traffic-light cycle: red -> green -> amber, ~2.5 s each
  const phase = Math.floor((t / 2.5) % 3); // 0 red, 1 green, 2 amber
  group.traverse((o) => {
    if (o.name === NAMES.trafficLight) {
      o.traverse((lamp) => {
        if (!lamp.material || !lamp.name.startsWith('lamp-')) return;
        const on = (phase === 0 && lamp.name === 'lamp-red')
          || (phase === 1 && lamp.name === 'lamp-green')
          || (phase === 2 && lamp.name === 'lamp-amber');
        lamp.material.emissiveIntensity = on ? 3.0 : 0.12;
      });
    }
    if (o.name === NAMES.phoneScreen && o.material) {
      o.material.emissiveIntensity = 1.6 + Math.sin(t * 2.2) * 0.22; // subtle shimmer
    }
  });
}

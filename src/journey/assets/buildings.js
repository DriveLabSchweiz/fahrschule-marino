/**
 * Buildings for the Trafficom night-city scroll journey.
 * =====================================================
 * Three venues along the driving-licence journey:
 *   - createNothelferSchool() : Nothelferkurs (first-aid course) venue
 *   - createOptician()        : Optician for the eye test (Sehtest)
 *   - createAmt()             : Strassenverkehrsamt (road traffic office)
 * Plus tickBuildings(group, t) for idle animation.
 *
 * Follows the shared contract in ../palette.js:
 *   procedural low-poly only, MeshStandardMaterial, flatShading, emissive glow,
 *   1 unit = 1 m, sits on y=0, centered at origin, entrance facing +Z, < 8k tris.
 */

import * as THREE from 'three';
import { PALETTE, NAMES, matBody, matGlow, matGlass } from '../palette.js';

// ---------------------------------------------------------------------------
// Shared low-poly geometry (reused across every building to stay cheap).
// ---------------------------------------------------------------------------
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);   // scaled per use
const UNIT_PLANE = new THREE.PlaneGeometry(1, 1);  // scaled per use

/** Add a box volume (body material) to a group. Origin of box is its center. */
function addBox(group, mat, w, h, d, x, y, z) {
  const m = new THREE.Mesh(UNIT_BOX, mat);
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  return group.add(m), m;
}

/**
 * Build a grid of glowing windows as a single InstancedMesh on one facade.
 * Facade lies in the XY plane, facing +Z (or -Z / sides via rotation).
 * Returns the InstancedMesh (already added to group).
 */
function makeWindowGrid(group, {
  cols, rows, winW, winH, gapX, gapY,
  color = PALETTE.windowGlow, intensity = 2.2,
  cx = 0, cy = 0, cz = 0, rotY = 0, litRatio = 0.72,
}) {
  const mat = matGlow(color, intensity, { flatShading: true });
  const inst = new THREE.InstancedMesh(UNIT_PLANE, mat, cols * rows);
  const dummy = new THREE.Object3D();
  const spanX = (cols - 1) * (winW + gapX);
  const spanY = (rows - 1) * (winH + gapY);
  const dir = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
  let i = 0;
  const seed = cols * 31 + rows * 7;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lx = -spanX / 2 + c * (winW + gapX);
      const ly = -spanY / 2 + r * (winH + gapY);
      // Place on the facade plane, offset slightly outward to avoid z-fighting.
      const px = cx + lx * Math.cos(rotY) + dir.x * 0.02;
      const pz = cz - lx * Math.sin(rotY) + dir.z * 0.02;
      dummy.position.set(px, cy + ly, pz);
      dummy.rotation.set(0, rotY, 0);
      dummy.scale.set(winW, winH, 1);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      // Vary emissive per-window: some lit bright, some dim/dark.
      const pseudo = ((c * 13 + r * 29 + seed) % 100) / 100;
      const lit = pseudo < litRatio;
      const shade = lit ? (0.55 + pseudo * 0.9) : 0.06;
      inst.setColorAt(i, new THREE.Color(color).multiplyScalar(shade));
      i++;
    }
  }
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  inst.userData.baseIntensity = intensity;
  inst.userData.isWindowGrid = true;
  group.add(inst);
  return inst;
}

/** Small rooftop AC / vent box cluster for silhouette depth. */
function addRoofDetails(group, mat, topY, w, d, n = 3) {
  for (let k = 0; k < n; k++) {
    const bw = 0.5 + (k % 2) * 0.4;
    const bh = 0.4 + ((k * 3) % 5) * 0.12;
    const bd = 0.5 + ((k * 7) % 4) * 0.15;
    const x = (-w / 2 + 0.9) + (k / Math.max(1, n - 1)) * (w - 1.8);
    const z = ((k % 2) - 0.5) * (d * 0.4);
    addBox(group, mat, bw, bh, bd, x, topY + bh / 2, z);
  }
  // A slim roof antenna/mast.
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 5), matBody(PALETTE.metal));
  mast.position.set(w * 0.28, topY + 0.8, -d * 0.15);
  group.add(mast);
}

// ===========================================================================
// 1. NOTHELFERKURS — first-aid course venue (hospital / school hybrid)
// ===========================================================================
export function createNothelferSchool() {
  const group = new THREE.Group();
  group.name = NAMES.nothelfer; // 'bld-nothelfer'

  const bodyMat = matBody(PALETTE.surface);
  const body2Mat = matBody(PALETTE.surface2);
  const trimMat = matBody(PALETTE.white, { roughness: 0.7, metalness: 0.1 });
  const metalMat = matBody(PALETTE.metal);

  const W = 10, H = 9, D = 7;

  // Main block.
  addBox(group, bodyMat, W, H, D, 0, H / 2, 0);
  // Setback upper storey (depth via stepped roof).
  const upperH = 2.4;
  addBox(group, body2Mat, W * 0.72, upperH, D * 0.72, 0, H + upperH / 2, -0.4);
  // Ground-floor base band (clinic plinth).
  addBox(group, trimMat, W + 0.2, 1.1, D + 0.2, 0, 0.55, 0);

  // Warm-lit window grids (front + sides).
  makeWindowGrid(group, {
    cols: 5, rows: 3, winW: 0.85, winH: 1.0, gapX: 0.7, gapY: 0.95,
    color: PALETTE.windowGlow, intensity: 1.7,
    cx: 0, cy: 5.0, cz: D / 2 + 0.01, rotY: 0, litRatio: 0.8,
  });
  makeWindowGrid(group, {
    cols: 4, rows: 3, winW: 0.7, winH: 0.9, gapX: 0.7, gapY: 0.95,
    color: PALETTE.windowGlow, intensity: 1.6,
    cx: W / 2 + 0.01, cy: 5.0, cz: 0, rotY: Math.PI / 2, litRatio: 0.7,
  });
  makeWindowGrid(group, {
    cols: 4, rows: 3, winW: 0.7, winH: 0.9, gapX: 0.7, gapY: 0.95,
    color: PALETTE.windowGlow, intensity: 1.6,
    cx: -W / 2 - 0.01, cy: 5.0, cz: 0, rotY: -Math.PI / 2, litRatio: 0.7,
  });

  // Entrance canopy (flat slab on two posts).
  const canopyMat = matBody(PALETTE.surface2, { roughness: 0.5 });
  addBox(group, canopyMat, 4.2, 0.25, 1.8, 0, 3.1, D / 2 + 0.9);
  const postGeo = new THREE.CylinderGeometry(0.09, 0.09, 3.0, 6);
  for (const sx of [-1.8, 1.8]) {
    const post = new THREE.Mesh(postGeo, metalMat);
    post.position.set(sx, 1.5, D / 2 + 1.6);
    group.add(post);
  }
  // Glowing doorway.
  const door = new THREE.Mesh(UNIT_PLANE, matGlow(PALETTE.windowGlow, 1.6));
  door.scale.set(2.6, 2.4, 1);
  door.position.set(0, 1.3, D / 2 + 0.02);
  group.add(door);

  // ------- Medical cross (emissive, pulses) -------
  const cross = new THREE.Group();
  cross.name = NAMES.cross; // 'medical-cross'
  const crossMat = matGlow(PALETTE.redBright, 1.8, { flatShading: true });
  const armL = 2.0, armT = 0.62, armDepth = 0.28;
  const vBar = new THREE.Mesh(UNIT_BOX, crossMat);
  vBar.scale.set(armT, armL, armDepth);
  const hBar = new THREE.Mesh(UNIT_BOX, crossMat);
  hBar.scale.set(armL, armT, armDepth);
  cross.add(vBar, hBar);
  // White backing plate so the red reads as a medical cross badge.
  const plate = new THREE.Mesh(UNIT_BOX, matGlow(PALETTE.white, 1.0, { flatShading: true }));
  plate.scale.set(2.5, 2.5, 0.18);
  plate.position.z = -0.09;
  cross.add(plate);
  cross.position.set(0, H + upperH + 1.4, -0.2);
  cross.userData.pulsePhase = 0;
  group.add(cross);

  // Roof details.
  addRoofDetails(group, metalMat, H + upperH, W * 0.72, D * 0.72, 3);

  // Subtle Swiss vibe: small red-and-white banner beside the entrance.
  const banner = new THREE.Mesh(UNIT_PLANE, matGlow(PALETTE.red, 1.4));
  banner.scale.set(0.5, 1.6, 1);
  banner.position.set(2.7, 3.6, D / 2 + 0.03);
  group.add(banner);
  const bannerCrossV = new THREE.Mesh(UNIT_BOX, matGlow(PALETTE.white, 1.4));
  bannerCrossV.scale.set(0.12, 0.5, 0.05);
  bannerCrossV.position.set(2.7, 3.6, D / 2 + 0.06);
  group.add(bannerCrossV);
  const bannerCrossH = bannerCrossV.clone();
  bannerCrossH.scale.set(0.34, 0.16, 0.05);
  group.add(bannerCrossH);

  // Tiny sign point light to sell the glow (distance-limited).
  const pl = new THREE.PointLight(PALETTE.redBright, 6, 8, 2);
  pl.position.set(0, H + upperH + 1.4, 1.0);
  cross.add(pl);

  group.userData.kind = 'nothelfer';
  return group;
}

// ===========================================================================
// 2. OPTICIAN — eye-test shop (Sehtest)
// ===========================================================================
export function createOptician() {
  const group = new THREE.Group();
  group.name = NAMES.optician; // 'bld-optician'

  const bodyMat = matBody(PALETTE.surface2);
  const trimMat = matBody(PALETTE.metal);
  const frameMat = matBody(PALETTE.dark, { roughness: 0.6 });

  const W = 8, H = 7, D = 6;

  // Main block + slight parapet.
  addBox(group, bodyMat, W, H, D, 0, H / 2, 0);
  addBox(group, matBody(PALETTE.surface), W + 0.2, 0.5, D + 0.2, 0, H + 0.25, 0);

  // Upper-floor warm windows (residential above the shop).
  makeWindowGrid(group, {
    cols: 4, rows: 2, winW: 0.9, winH: 1.0, gapX: 0.7, gapY: 1.0,
    color: PALETTE.windowGlow, intensity: 1.6,
    cx: 0, cy: 5.2, cz: D / 2 + 0.01, rotY: 0, litRatio: 0.7,
  });

  // ------- Big glass storefront (ground floor) -------
  const storeH = 3.0, storeW = 6.4;
  const glass = new THREE.Mesh(UNIT_PLANE, matGlass(0x0e1830, PALETTE.cyan));
  glass.material.emissiveIntensity = 0.35;
  glass.scale.set(storeW, storeH, 1);
  glass.position.set(0, storeH / 2 + 0.3, D / 2 + 0.03);
  group.add(glass);
  // Window frame + mullions.
  const frameGeo = UNIT_BOX;
  addBox(group, frameMat, storeW + 0.3, 0.16, 0.3, 0, 0.3, D / 2 + 0.05);            // sill
  addBox(group, frameMat, storeW + 0.3, 0.16, 0.3, 0, storeH + 0.3, D / 2 + 0.05);   // lintel
  for (const mx of [-storeW / 2, -storeW / 6, storeW / 6, storeW / 2]) {
    addBox(group, frameMat, 0.12, storeH, 0.28, mx, storeH / 2 + 0.3, D / 2 + 0.05);
  }
  // Recessed entrance door within the storefront.
  const door = new THREE.Mesh(UNIT_PLANE, matGlow(PALETTE.cyan, 1.0));
  door.scale.set(1.3, 2.4, 1);
  door.position.set(storeW / 2 - 1.1, 1.5, D / 2 + 0.04);
  group.add(door);

  // ------- Eye-test chart (emissive cyan, decreasing rows) -------
  const eyeChart = new THREE.Group();
  eyeChart.name = NAMES.eyeChart; // 'eye-chart'
  // White-ish backing board.
  const board = new THREE.Mesh(UNIT_PLANE, matGlow(0xdfeefc, 0.9, { flatShading: true }));
  board.scale.set(2.2, 2.6, 1);
  eyeChart.add(board);
  const barMat = matGlow(PALETTE.cyan, 1.7, { flatShading: true });
  const rowCount = 6;
  for (let r = 0; r < rowCount; r++) {
    const scale = 1 - r * 0.13;          // letters shrink down the chart
    const bh = 0.30 * scale;
    const bw = 0.24 * scale;
    const cnt = 1 + r;                    // 1,2,3... "letters" per row
    const gap = bw * 1.6;
    const rowW = (cnt - 1) * gap;
    const y = 1.05 - r * 0.4;
    for (let c = 0; c < cnt; c++) {
      const bar = new THREE.Mesh(UNIT_BOX, barMat);
      // Slight variety so blocks read like different glyphs.
      const squish = 0.6 + ((r + c) % 3) * 0.2;
      bar.scale.set(bw, bh * squish, 0.04);
      bar.position.set(-rowW / 2 + c * gap, y, 0.02);
      eyeChart.add(bar);
    }
  }
  eyeChart.position.set(-1.2, 1.9, D / 2 - 0.6); // inside, behind the glass
  group.add(eyeChart);

  // A giant "E" style anchor block at top of the chart (classic Snellen top row).
  const bigE = new THREE.Mesh(UNIT_BOX, matGlow(PALETTE.cyan, 1.7, { flatShading: true }));
  bigE.scale.set(0.5, 0.6, 0.05);
  bigE.position.set(-1.2, 3.0, D / 2 - 0.58);
  group.add(bigE);

  // ------- Hanging neon spectacles sign -------
  const neon = new THREE.Group();
  neon.name = NAMES.sign; // 'neon-sign'
  const neonMat = matGlow(PALETTE.cyan, 1.8, { flatShading: true });
  neon.userData.neonMat = neonMat;
  neon.userData.baseIntensity = 1.8;
  // Two lens rings (torus) + bridge + temples => spectacles.
  const ringGeo = new THREE.TorusGeometry(0.42, 0.08, 6, 16);
  const lensL = new THREE.Mesh(ringGeo, neonMat);
  lensL.position.set(-0.55, 0, 0);
  const lensR = new THREE.Mesh(ringGeo, neonMat);
  lensR.position.set(0.55, 0, 0);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.09, 0.09), neonMat);
  const templeL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.08), neonMat);
  templeL.position.set(-1.1, 0.05, 0);
  templeL.rotation.z = 0.3;
  const templeR = templeL.clone();
  templeR.position.set(1.1, 0.05, 0);
  templeR.rotation.z = -0.3;
  neon.add(lensL, lensR, bridge, templeL, templeR);
  // Mounting bracket to the wall.
  const bracket = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 5), trimMat);
  bracket.rotation.z = Math.PI / 2;
  bracket.position.set(W / 2 - 0.6, 0, 0);
  neon.add(bracket);
  neon.position.set(W / 2 - 1.7, 5.0, D / 2 + 0.7);
  group.add(neon);

  // Sign point light (limited).
  const pl = new THREE.PointLight(PALETTE.cyan, 4, 6, 2);
  pl.position.set(0, 0, 0.4);
  neon.add(pl);

  addRoofDetails(group, trimMat, H + 0.5, W, D, 2);

  group.userData.kind = 'optician';
  return group;
}

// ===========================================================================
// 3. STRASSENVERKEHRSAMT — road traffic office (official, imposing)
// ===========================================================================
export function createAmt() {
  const group = new THREE.Group();
  group.name = NAMES.amt; // 'bld-amt'

  const bodyMat = matBody(PALETTE.surface);
  const stoneMat = matBody(PALETTE.surface2, { roughness: 0.7, metalness: 0.15 });
  const trimMat = matBody(PALETTE.metal);
  const whiteMat = matBody(PALETTE.white, { roughness: 0.7, metalness: 0.05 });

  const W = 14, H = 11, D = 8;

  // Symmetric main block.
  addBox(group, bodyMat, W, H, D, 0, H / 2, 0);
  // Central raised section (imposing government massing).
  addBox(group, stoneMat, 6, H + 2.2, D * 0.55, 0, (H + 2.2) / 2, -0.2);
  // Base plinth.
  addBox(group, stoneMat, W + 0.4, 1.2, D + 0.4, 0, 0.6, 0);
  // Cornice band under the roof.
  addBox(group, stoneMat, W + 0.3, 0.5, D + 0.3, 0, H - 0.2, 0);

  // Symmetric rows of cool-lit windows (front, both wings + center).
  makeWindowGrid(group, {
    cols: 8, rows: 4, winW: 0.75, winH: 0.95, gapX: 0.72, gapY: 0.85,
    color: PALETTE.cyan, intensity: 1.7,
    cx: 0, cy: 5.4, cz: D / 2 + 0.01, rotY: 0, litRatio: 0.6,
  });
  makeWindowGrid(group, {
    cols: 5, rows: 4, winW: 0.7, winH: 0.9, gapX: 0.7, gapY: 0.85,
    color: PALETTE.cyan, intensity: 1.6,
    cx: W / 2 + 0.01, cy: 5.4, cz: 0, rotY: Math.PI / 2, litRatio: 0.55,
  });
  makeWindowGrid(group, {
    cols: 5, rows: 4, winW: 0.7, winH: 0.9, gapX: 0.7, gapY: 0.85,
    color: PALETTE.cyan, intensity: 1.6,
    cx: -W / 2 - 0.01, cy: 5.4, cz: 0, rotY: -Math.PI / 2, litRatio: 0.55,
  });

  // ------- Entrance: columns + steps -------
  // Steps.
  const stepMat = stoneMat;
  for (let s = 0; s < 3; s++) {
    const sw = 6.5 - s * 0.0;
    addBox(group, stepMat, sw + s * 0.8, 0.3, 0.6, 0, 0.15 + s * 0.3, D / 2 + 1.4 - s * 0.6);
  }
  // Portico columns.
  const colGeo = new THREE.CylinderGeometry(0.28, 0.3, 4.2, 10);
  for (const cx of [-2.4, -0.8, 0.8, 2.4]) {
    const col = new THREE.Mesh(colGeo, whiteMat);
    col.position.set(cx, 2.1 + 0.9, D / 2 + 0.9);
    group.add(col);
  }
  // Portico roof slab.
  addBox(group, stoneMat, 6.4, 0.5, 2.2, 0, 5.4, D / 2 + 0.9);
  // Glowing doorway.
  const door = new THREE.Mesh(UNIT_PLANE, matGlow(PALETTE.cyan, 1.4));
  door.scale.set(3.2, 3.0, 1);
  door.position.set(0, 2.4, D / 2 + 0.03);
  group.add(door);

  // ------- Official blue signage panel -------
  const sign = new THREE.Group();
  sign.name = NAMES.sign; // 'neon-sign'
  const panel = new THREE.Mesh(UNIT_BOX, matGlow(PALETTE.blue, 1.7, { flatShading: true }));
  panel.scale.set(5.6, 0.9, 0.18);
  sign.add(panel);
  // Text-suggesting light bars across the panel (STRASSENVERKEHRSAMT).
  const barMat = matGlow(PALETTE.white, 1.8, { flatShading: true });
  const words = [1.4, 0.9, 1.2]; // grouped bar widths, evocative of words
  let bx = -2.3;
  for (const wlen of words) {
    const bar = new THREE.Mesh(UNIT_BOX, barMat);
    bar.scale.set(wlen, 0.18, 0.06);
    bar.position.set(bx + wlen / 2, 0, 0.12);
    sign.add(bar);
    bx += wlen + 0.35;
  }
  sign.position.set(0, H + 0.9, D * 0.55 / 2 + 0.15);
  sign.userData.baseIntensity = 1.7;
  sign.userData.panelMat = panel.material;
  group.add(sign);

  // Sign point light.
  const pl = new THREE.PointLight(PALETTE.blue, 5, 9, 2);
  pl.position.set(0, H + 0.9, D * 0.55 / 2 + 1.0);
  group.add(pl);

  // ------- Swiss flag on a flagpole -------
  const flag = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4.5, 6), trimMat);
  pole.position.y = 2.25;
  flag.add(pole);
  const flagRed = new THREE.Mesh(UNIT_BOX, matGlow(PALETTE.red, 1.2, { flatShading: true }));
  flagRed.scale.set(1.0, 1.0, 0.06);
  flagRed.position.set(0.55, 4.0, 0);
  flag.add(flagRed);
  // White cross on the flag.
  const crossV = new THREE.Mesh(UNIT_BOX, matGlow(PALETTE.white, 1.4));
  crossV.scale.set(0.18, 0.55, 0.04);
  crossV.position.set(0.55, 4.0, 0.05);
  flag.add(crossV);
  const crossH = new THREE.Mesh(UNIT_BOX, matGlow(PALETTE.white, 1.4));
  crossH.scale.set(0.55, 0.18, 0.04);
  crossH.position.set(0.55, 4.0, 0.05);
  flag.add(crossH);
  flag.position.set(-W / 2 + 1.0, H, D / 2 - 1.0);
  group.add(flag);

  addRoofDetails(group, H + 2.2, 6, D * 0.55, 3);
  addRoofDetails(group, H, W, D, 3);

  group.userData.kind = 'amt';
  return group;
}

// ===========================================================================
// 4. VKU — Verkehrskunde schoolhouse with clock tower + "VKU" sign.
//    Procedural fallback for vku.glb; kept simple (a friendly school block).
// ===========================================================================
export function createVku() {
  const group = new THREE.Group();
  group.name = NAMES.vku; // 'bld-vku'

  const bodyMat = matBody(PALETTE.surface);
  const body2Mat = matBody(PALETTE.surface2);
  const trimMat = matBody(PALETTE.white, { roughness: 0.7, metalness: 0.1 });
  const metalMat = matBody(PALETTE.metal);

  const W = 10, H = 8, D = 7;

  // Main schoolhouse block + base band + roof band.
  addBox(group, bodyMat, W, H, D, 0, H / 2, 0);
  addBox(group, trimMat, W + 0.2, 1.0, D + 0.2, 0, 0.5, 0);
  addBox(group, body2Mat, W + 0.3, 0.6, D + 0.3, 0, H + 0.3, 0);

  // Warm-lit classroom windows across the front.
  makeWindowGrid(group, {
    cols: 5, rows: 2, winW: 0.85, winH: 1.0, gapX: 0.7, gapY: 1.05,
    color: PALETTE.windowGlow, intensity: 1.6,
    cx: 0, cy: 4.6, cz: D / 2 + 0.01, rotY: 0, litRatio: 0.78,
  });

  // Glowing doorway.
  const door = new THREE.Mesh(UNIT_PLANE, matGlow(PALETTE.windowGlow, 1.5));
  door.scale.set(2.4, 2.6, 1);
  door.position.set(0, 1.4, D / 2 + 0.02);
  group.add(door);

  // Clock tower (~9 m) on the left corner.
  const towerW = 2.6, towerH = 9;
  const towerX = -W / 2 + 1.6, towerZ = -0.4;
  addBox(group, body2Mat, towerW, towerH, towerW, towerX, towerH / 2, towerZ);
  // pyramid cap
  const cap = new THREE.Mesh(new THREE.ConeGeometry(2.0, 1.6, 4), metalMat);
  cap.rotation.y = Math.PI / 4;
  cap.position.set(towerX, towerH + 0.8, towerZ);
  group.add(cap);
  // clock face on the tower front (+Z)
  const clock = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.14, 18), matGlow(PALETTE.white, 1.4));
  clock.rotation.x = Math.PI / 2;
  clock.position.set(towerX, towerH - 1.4, towerZ + towerW / 2 + 0.06);
  group.add(clock);

  // ------- "VKU" sign panel over the entrance -------
  const sign = new THREE.Group();
  sign.name = NAMES.sign; // 'neon-sign' (gently breathes via tickBuildings)
  const panel = new THREE.Mesh(UNIT_BOX, matGlow(PALETTE.red, 1.5, { flatShading: true }));
  panel.scale.set(3.4, 1.0, 0.16);
  sign.add(panel);
  const barMat = matGlow(PALETTE.white, 1.6, { flatShading: true });
  for (const dx of [-0.95, 0, 0.95]) {
    const b = new THREE.Mesh(UNIT_BOX, barMat);
    b.scale.set(0.5, 0.5, 0.06);
    b.position.set(dx, 0, 0.11);
    sign.add(b);
  }
  sign.position.set(0, H - 1.1, D / 2 + 0.18);
  sign.userData.baseIntensity = 1.5;
  sign.userData.panelMat = panel.material;
  group.add(sign);

  addRoofDetails(group, metalMat, H, W, D, 2);

  group.userData.kind = 'vku';
  return group;
}

// ===========================================================================
// Idle animation: cross pulse, optician neon flicker, window blink.
// ===========================================================================
export function tickBuildings(group, t) {
  if (!group) return;

  // Medical cross pulse (Nothelfer).
  const cross = group.getObjectByName(NAMES.cross);
  if (cross) {
    const pulse = 1.5 + Math.sin(t * 2.2) * 0.3 + Math.sin(t * 5.7) * 0.08;
    cross.traverse((o) => {
      if (o.isMesh && o.material && o.material.emissive &&
          o.material.color && o.material.color.getHex() !== PALETTE.white) {
        o.material.emissiveIntensity = pulse;
      }
    });
    const pl = cross.children.find((c) => c.isPointLight);
    if (pl) pl.intensity = 4 + Math.sin(t * 2.2) * 2.5;
  }

  // Optician neon flicker + Amt sign steady-ish shimmer.
  const sign = group.getObjectByName(NAMES.sign);
  if (sign && sign.userData.baseIntensity) {
    const base = sign.userData.baseIntensity;
    // Cyan spectacles flicker (nervous neon); blue Amt panel gently breathes.
    const isOptician = !!sign.userData.neonMat;
    let intensity;
    if (isOptician) {
      const flick = (Math.sin(t * 23) > 0.82 || Math.sin(t * 7.3) > 0.97) ? 0.35 : 1.0;
      intensity = base * (0.85 + 0.15 * Math.sin(t * 3)) * flick;
    } else {
      intensity = base * (0.9 + 0.1 * Math.sin(t * 1.3));
    }
    sign.traverse((o) => {
      if (o.isMesh && o.material && o.material.emissive) {
        o.material.emissiveIntensity = intensity;
      }
      if (o.isPointLight) o.intensity = intensity * 1.5;
    });
  }

  // Occasional window blink: nudge whole-grid emissive subtly.
  group.traverse((o) => {
    if (o.userData && o.userData.isWindowGrid) {
      const base = o.userData.baseIntensity || 2.0;
      const blink = (Math.sin(t * 0.7 + o.id) > 0.985) ? 0.4 : 1.0;
      o.material.emissiveIntensity = base * (0.94 + 0.06 * Math.sin(t * 0.9 + o.id)) * blink;
    }
  });
}

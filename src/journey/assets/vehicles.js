/**
 * vehicles.js — procedural low-poly night-city vehicles.
 * Part of the journey scene for Fahrschule Antonio Marino.
 * Follows the shared contract in ../palette.js:
 *  - metres as units, ground at y=0, front faces +Z, centred at local origin
 *  - MeshStandardMaterial via matBody/matGlow/matGlass helpers, flatShading
 *  - animatable parts carry NAMES.* names; wheels carry userData.isWheel
 *  - < 8k tris each, geometries/materials reused, max 2 tiny PointLights/asset
 */

import * as THREE from 'three';
import { PALETTE, NAMES, matBody, matGlow, matGlass } from '../palette.js';

// ---------------------------------------------------------------------------
// Shared low-level helpers
// ---------------------------------------------------------------------------

/**
 * A rolling wheel: dark tyre + metal rim, axle along X so it rolls toward +Z.
 * The returned Group carries userData.isWheel so the scene can spin it.
 * `tireGeo`/`rimGeo` are shared between all wheels of a vehicle to save memory.
 */
function makeWheel(tireGeo, rimGeo, tireMat, rimMat) {
  const wheel = new THREE.Group();

  const tire = new THREE.Mesh(tireGeo, tireMat);
  tire.rotation.z = Math.PI / 2; // cylinder axis Y -> X
  wheel.add(tire);

  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.rotation.z = Math.PI / 2;
  wheel.add(rim);

  wheel.userData.isWheel = true;
  wheel.name = 'wheel';
  return wheel;
}

// ---------------------------------------------------------------------------
// 1. Swiss city bus  (~12 m long, ~3 m high)
// ---------------------------------------------------------------------------

export function createBus() {
  const g = new THREE.Group();
  g.name = NAMES.bus;

  const L = 11.6, W = 2.5, H = 2.4;      // body envelope
  const wheelR = 0.5;
  const bodyBottom = wheelR + 0.25;      // skirt clears the wheels
  const bodyTop = bodyBottom + H;
  const bodyCY = (bodyBottom + bodyTop) / 2;

  // Shared materials
  const bodyMat = matBody(PALETTE.white, { metalness: 0.35, roughness: 0.5 });
  const trimMat = matBody(PALETTE.red, { roughness: 0.45 });
  const darkMat = matBody(PALETTE.dark);
  const metalMat = matBody(PALETTE.metal, { metalness: 0.7, roughness: 0.35 });
  const winMat = matGlow(PALETTE.windowGlow, 1.7);
  const glassMat = matGlass(PALETTE.bg2, PALETTE.windowGlow);
  const seatMat = matBody(PALETTE.surface2, { roughness: 0.8, metalness: 0 });
  const headMat = matGlow(PALETTE.amberBright, 2.6);
  const tailMat = matGlow(PALETTE.red, 2.4);

  // Main body
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, L), bodyMat);
  body.position.y = bodyCY;
  g.add(body);

  // Rounded roof: two inset caps stacked -> soft bevelled silhouette
  const roof1 = new THREE.Mesh(new THREE.BoxGeometry(W - 0.18, 0.28, L - 0.3), bodyMat);
  roof1.position.set(0, bodyTop + 0.12, 0);
  g.add(roof1);
  const roof2 = new THREE.Mesh(new THREE.BoxGeometry(W - 0.5, 0.22, L - 1.2), bodyMat);
  roof2.position.set(0, bodyTop + 0.32, 0);
  g.add(roof2);

  // Lower skirt / bumper band in brand red
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(W + 0.04, 0.35, L - 0.2), trimMat);
  skirt.position.set(0, bodyBottom + 0.12, 0);
  g.add(skirt);

  // Side window band (both sides) + seat silhouettes seen through the glow
  const winH = 0.85, winY = bodyBottom + H - 0.75, winZ = L - 2.6;
  const winGeo = new THREE.BoxGeometry(0.06, winH, winZ);
  const seatGeo = new THREE.BoxGeometry(0.09, 0.55, 0.12);
  for (const side of [-1, 1]) {
    const win = new THREE.Mesh(winGeo, winMat);
    win.position.set(side * (W / 2 + 0.01), winY, -0.4);
    g.add(win);
    // seat-back silhouettes: thin dark bars just outside the lit glass
    for (let i = 0; i < 7; i++) {
      const seat = new THREE.Mesh(seatGeo, seatMat);
      const z = -0.4 - winZ / 2 + 0.7 + i * (winZ - 1.2) / 6;
      seat.position.set(side * (W / 2 + 0.045), winY - 0.05, z);
      g.add(seat);
    }
  }

  // Windscreen (front) + rear glass
  const wsGeo = new THREE.BoxGeometry(W - 0.35, 1.1, 0.08);
  const ws = new THREE.Mesh(wsGeo, glassMat);
  ws.position.set(0, winY, L / 2 - 0.05);
  g.add(ws);
  const rear = new THREE.Mesh(wsGeo, glassMat);
  rear.position.set(0, winY, -L / 2 + 0.05);
  g.add(rear);

  // Glowing route/destination display above the windscreen ("L" line panel)
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.42, 0.06), matGlow(PALETTE.amber, 2.8));
  panel.name = 'bus-route';
  panel.position.set(0, bodyTop - 0.15, L / 2 + 0.02);
  g.add(panel);

  // Headlights (amber, front) & taillights (red, rear)
  const lampGeo = new THREE.BoxGeometry(0.4, 0.28, 0.12);
  for (const side of [-1, 1]) {
    const hl = new THREE.Mesh(lampGeo, headMat);
    hl.name = NAMES.headlight;
    hl.position.set(side * 0.85, bodyBottom + 0.35, L / 2 + 0.03);
    g.add(hl);
    const tl = new THREE.Mesh(lampGeo, tailMat);
    tl.name = NAMES.taillight;
    tl.position.set(side * 0.85, bodyBottom + 0.35, -L / 2 - 0.03);
    g.add(tl);
  }

  // Blinking indicators (front corners) — driven by tickVehicles
  const indGeo = new THREE.BoxGeometry(0.18, 0.18, 0.1);
  for (const side of [-1, 1]) {
    const ind = new THREE.Mesh(indGeo, matGlow(PALETTE.amberBright, 0.4));
    ind.name = 'bus-indicator';
    ind.position.set(side * (W / 2 - 0.05), bodyBottom + 0.55, L / 2 + 0.02);
    g.add(ind);
  }

  // Passenger door (right side, front) — hinged: geometry offset so the mesh
  // origin is the forward hinge edge; rotate mesh.rotation.y to open.
  const doorGeo = new THREE.BoxGeometry(0.07, 1.7, 1.1);
  doorGeo.translate(0, 0, -0.55);
  const door = new THREE.Mesh(doorGeo, glassMat);
  door.name = NAMES.busDoor;
  door.position.set(W / 2 + 0.01, bodyBottom + 0.9, 3.4);
  g.add(door);

  // Wheels: dual axles, both sides (4 wheels)
  const tireGeo = new THREE.CylinderGeometry(wheelR, wheelR, 0.35, 16);
  const rimGeo = new THREE.CylinderGeometry(wheelR * 0.5, wheelR * 0.5, 0.37, 8);
  const axleZ = [L / 2 - 2.0, -L / 2 + 2.0];
  for (const z of axleZ) {
    for (const side of [-1, 1]) {
      const w = makeWheel(tireGeo, rimGeo, darkMat, metalMat);
      w.position.set(side * (W / 2 - 0.05), wheelR, z);
      g.add(w);
    }
  }

  return g;
}

// ---------------------------------------------------------------------------
// 2. Compact driving-school car  (~4.5 m long)
// ---------------------------------------------------------------------------

export function createSchoolCar() {
  const g = new THREE.Group();
  g.name = NAMES.car;

  const L = 4.4, W = 1.8, wheelR = 0.36;
  const bodyBottom = wheelR + 0.05;

  const redMat = matBody(PALETTE.red, { metalness: 0.35, roughness: 0.45 });
  const darkMat = matBody(PALETTE.dark);
  const metalMat = matBody(PALETTE.metal, { metalness: 0.7, roughness: 0.35 });
  const glassMat = matGlass(PALETTE.bg2, PALETTE.windowGlow);
  const headMat = matGlow(PALETTE.amberBright, 2.8);
  const tailMat = matGlow(PALETTE.red, 2.4);

  // Lower body (with a slim skirt for a bevelled read)
  const lower = new THREE.Mesh(new THREE.BoxGeometry(W, 0.7, L), redMat);
  lower.position.y = bodyBottom + 0.35;
  g.add(lower);
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(W - 0.08, 0.22, L - 0.15), darkMat);
  skirt.position.y = bodyBottom + 0.11;
  g.add(skirt);

  // Cabin (narrower, set back) — greenhouse
  const cabinL = 2.2, cabinCY = bodyBottom + 0.7 + 0.32;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(W - 0.12, 0.64, cabinL), redMat);
  cabin.position.set(0, cabinCY, -0.1);
  g.add(cabin);

  // Windows: continuous glass band under the cabin roof
  const glassGeo = new THREE.BoxGeometry(W - 0.02, 0.5, cabinL - 0.25);
  const glass = new THREE.Mesh(glassGeo, glassMat);
  glass.position.set(0, cabinCY, -0.1);
  g.add(glass);
  // raked windscreen wedge to the hood
  const wsGeo = new THREE.BoxGeometry(W - 0.18, 0.5, 0.5);
  const ws = new THREE.Mesh(wsGeo, glassMat);
  ws.position.set(0, cabinCY - 0.02, cabinL / 2 - 0.1 + 0.2);
  ws.rotation.x = -0.5;
  g.add(ws);

  // Roof sign — small amber trapezoid box (Fahrschule / "L")
  const signGeo = new THREE.CylinderGeometry(0.12, 0.17, 0.22, 4);
  const sign = new THREE.Mesh(signGeo, matGlow(PALETTE.amber, 2.6));
  sign.name = NAMES.carRoofSign;
  sign.rotation.y = Math.PI / 4;      // align flats front/back
  sign.scale.set(1.9, 1, 0.7);        // wider than deep, like a taxi sign
  sign.position.set(0, cabinCY + 0.45, -0.1);
  g.add(sign);

  // Headlights: emissive lenses + a single distance-limited PointLight
  const lampGeo = new THREE.BoxGeometry(0.3, 0.2, 0.1);
  for (const side of [-1, 1]) {
    const hl = new THREE.Mesh(lampGeo, headMat);
    hl.name = NAMES.headlight;
    hl.position.set(side * (W / 2 - 0.3), bodyBottom + 0.35, L / 2 + 0.01);
    g.add(hl);
  }
  const beam = new THREE.PointLight(PALETTE.amberBright, 6, 7, 2);
  beam.position.set(0, bodyBottom + 0.4, L / 2 + 0.4);
  g.add(beam);

  // Taillights
  const tailGeo = new THREE.BoxGeometry(0.34, 0.18, 0.1);
  for (const side of [-1, 1]) {
    const tl = new THREE.Mesh(tailGeo, tailMat);
    tl.name = NAMES.taillight;
    tl.position.set(side * (W / 2 - 0.3), bodyBottom + 0.4, -L / 2 - 0.01);
    g.add(tl);
  }

  // Side mirrors (arm + housing)
  const armGeo = new THREE.BoxGeometry(0.14, 0.05, 0.05);
  const mirrGeo = new THREE.BoxGeometry(0.08, 0.16, 0.1);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(armGeo, darkMat);
    arm.position.set(side * (W / 2 + 0.07), cabinCY + 0.05, cabinL / 2 - 0.1);
    g.add(arm);
    const mirr = new THREE.Mesh(mirrGeo, redMat);
    mirr.position.set(side * (W / 2 + 0.16), cabinCY + 0.05, cabinL / 2 - 0.12);
    g.add(mirr);
  }

  // Wheels
  const tireGeo = new THREE.CylinderGeometry(wheelR, wheelR, 0.24, 16);
  const rimGeo = new THREE.CylinderGeometry(wheelR * 0.5, wheelR * 0.5, 0.26, 8);
  const axleZ = [L / 2 - 1.05, -L / 2 + 1.05];
  for (const z of axleZ) {
    for (const side of [-1, 1]) {
      const w = makeWheel(tireGeo, rimGeo, darkMat, metalMat);
      w.position.set(side * (W / 2 - 0.02), wheelR, z);
      g.add(w);
    }
  }

  return g;
}

// ---------------------------------------------------------------------------
// 3. Motorbike  (~2.2 m long) with helmeted rider
// ---------------------------------------------------------------------------

export function createMoto() {
  const g = new THREE.Group();
  g.name = NAMES.moto;

  const wheelR = 0.36;
  const frontZ = 0.85, rearZ = -0.8;
  const hubY = wheelR;

  const redMat = matBody(PALETTE.red, { metalness: 0.4, roughness: 0.4 });
  const darkMat = matBody(PALETTE.dark);
  const metalMat = matBody(PALETTE.metal, { metalness: 0.7, roughness: 0.35 });
  const amberMat = matGlow(PALETTE.amber, 2.4);
  const headMat = matGlow(PALETTE.amberBright, 3.2);
  const tailMat = matGlow(PALETTE.red, 2.4);
  const riderMat = matBody(PALETTE.surface2, { roughness: 0.8, metalness: 0.1 });
  const helmetMat = matBody(PALETTE.redBright, { roughness: 0.4 });

  // Wheels (2)
  const tireGeo = new THREE.CylinderGeometry(wheelR, wheelR, 0.18, 16);
  const rimGeo = new THREE.CylinderGeometry(wheelR * 0.45, wheelR * 0.45, 0.2, 8);
  for (const z of [frontZ, rearZ]) {
    const w = makeWheel(tireGeo, rimGeo, darkMat, metalMat);
    w.position.set(0, hubY, z);
    g.add(w);
  }

  // Frame spine (angled) + fuel tank + seat
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.5), metalMat);
  spine.position.set(0, hubY + 0.35, 0);
  spine.rotation.x = 0.12;
  g.add(spine);

  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.28, 0.6), redMat);
  tank.position.set(0, hubY + 0.5, 0.1);
  g.add(tank);
  // amber accent stripe on the tank
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 0.5), amberMat);
  stripe.position.set(0, hubY + 0.62, 0.1);
  g.add(stripe);

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.7), darkMat);
  seat.position.set(0, hubY + 0.5, -0.45);
  g.add(seat);

  // Front fork + handlebars
  const fork = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.08), metalMat);
  fork.position.set(0, hubY + 0.3, frontZ - 0.02);
  fork.rotation.x = -0.28;
  g.add(fork);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.06), darkMat);
  bar.position.set(0, hubY + 0.62, frontZ - 0.1);
  g.add(bar);

  // Single bright headlight (emissive lens + one distance-limited PointLight)
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 12), headMat);
  head.name = NAMES.headlight;
  head.rotation.x = Math.PI / 2;
  head.position.set(0, hubY + 0.5, frontZ + 0.12);
  g.add(head);
  const beam = new THREE.PointLight(PALETTE.amberBright, 5, 6, 2);
  beam.position.set(0, hubY + 0.5, frontZ + 0.35);
  g.add(beam);

  // Taillight
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.06), tailMat);
  tail.name = NAMES.taillight;
  tail.position.set(0, hubY + 0.55, rearZ - 0.25);
  g.add(tail);

  // Rear mudguard hint
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.4), darkMat);
  guard.position.set(0, hubY + 0.3, rearZ - 0.12);
  g.add(guard);

  // Helmeted rider (simple stacked figure, leaning forward)
  const rider = new THREE.Group();
  rider.name = 'moto-rider';
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.28), riderMat);
  torso.position.set(0, hubY + 0.85, -0.15);
  torso.rotation.x = 0.35;
  rider.add(torso);

  const head3 = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), helmetMat);
  head3.position.set(0, hubY + 1.18, 0.02);
  rider.add(head3);
  // helmet visor accent
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.12), matGlass(PALETTE.dark, 0));
  visor.position.set(0, hubY + 1.18, 0.16);
  rider.add(visor);

  // arms reaching to the bars
  const armGeo = new THREE.BoxGeometry(0.1, 0.1, 0.5);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(armGeo, riderMat);
    arm.position.set(side * 0.15, hubY + 0.85, 0.2);
    arm.rotation.x = 1.15;
    rider.add(arm);
  }
  // thighs
  const legGeo = new THREE.BoxGeometry(0.14, 0.14, 0.4);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(legGeo, darkMat);
    leg.position.set(side * 0.14, hubY + 0.45, -0.35);
    leg.rotation.x = -0.4;
    rider.add(leg);
  }
  g.add(rider);

  return g;
}

// ---------------------------------------------------------------------------
// Idle animation — optional, called by the scene with elapsed seconds.
// Gentle emissive pulse on driving-school roof signs; blinking bus indicators.
// ---------------------------------------------------------------------------

export function tickVehicles(group, t) {
  if (!group) return;
  const signPulse = 2.2 + Math.sin(t * 2.0) * 0.7;      // smooth, flicker-free
  const blinkOn = Math.sin(t * 5.0) > 0;                 // ~0.8 Hz indicator
  group.traverse((o) => {
    if (!o.material || !o.material.emissiveIntensity && o.material.emissiveIntensity !== 0) return;
    if (o.name === NAMES.carRoofSign) {
      o.material.emissiveIntensity = signPulse;
    } else if (o.name === 'bus-indicator') {
      o.material.emissiveIntensity = blinkOn ? 3.0 : 0.15;
    }
  });
}

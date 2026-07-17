/**
 * SHARED CONTRACT for all journey 3D asset modules.
 * ==================================================
 * Night-city scene, brand: Fahrschule Antonio Marino (red + amber/gold on deep navy).
 *
 * RULES for every asset module in src/journey/assets/:
 *  - `import * as THREE from 'three'` only. No loaders, no textures, no external files.
 *    Everything is procedural low-poly geometry (Box/Cylinder/Sphere/Cone/Extrude/Lathe/Shape).
 *  - Export named factory functions returning a THREE.Group, e.g.
 *      export function createBus() { ... return group; }
 *  - UNITS: 1 unit = 1 meter. Ground plane is y = 0. Models sit ON the ground
 *    (wheel bottoms / foundations at y = 0), centered at local origin (x=0, z=0),
 *    FRONT facing +Z (vehicles drive toward +Z by default).
 *  - Reference sizes: car ~4.5 long / 1.5 high; bus ~12 long / 3 high;
 *    motorbike ~2.2 long; buildings 8–14 wide, 6–14 high; phone prop ~3 high.
 *  - Materials: MeshStandardMaterial. Use flatShading:true where it looks crisp.
 *    Glowing parts (signs, windows, headlights, screens) use `emissive` +
 *    `emissiveIntensity` (1.5–4) — a bloom pass will pick these up.
 *  - Anything that should animate at runtime must be findable:
 *    set `mesh.name` from the NAMES table below; wheels also `userData.isWheel = true`.
 *  - Keep it cheap: aim < 8k triangles per asset, reuse geometries/materials,
 *    no lights inside assets (scene provides lighting) EXCEPT tiny PointLights
 *    are allowed for headlights/signs, max 2 per asset, distance-limited.
 *  - No animation loops inside assets. Optionally export
 *    `export function tick<Name>(group, t)` for idle animation (blinking, pulsing),
 *    called by the scene with elapsed seconds.
 */

export const PALETTE = {
  bg:          0x060810, // page background / fog
  bg2:         0x0d1020,
  surface:     0x131830, // building bodies
  surface2:    0x1a2040,
  asphalt:     0x0b0e1a,
  laneMark:    0xffb627, // amber lane markings
  text:        0xf0f4ff,
  muted:       0x8892b0,
  red:         0xe63946, // brand red — driving school, signs, accents
  redBright:   0xff4757,
  amber:       0xffb627, // brand gold — glow, windows, headlights
  amberBright: 0xffd23f,
  windowGlow:  0xffc966, // lit windows at night
  white:       0xe8ecf8,
  green:       0x2ecc71, // traffic light go / success
  blue:        0x4d7cfe, // official/Amt signage, police-ish blue
  cyan:        0x53d8e8, // optician / medical cool accent
  dark:        0x080a14, // tires, dark trim
  metal:       0x39415e, // poles, rims, trim
};

/** Canonical mesh names the scene will look up. Use these exactly. */
export const NAMES = {
  // vehicles (task: vehicles agent)
  bus: 'bus', busDoor: 'bus-door', car: 'school-car', carRoofSign: 'car-roof-sign',
  moto: 'moto', headlight: 'headlight', taillight: 'taillight',
  // buildings (task: buildings agent)
  nothelfer: 'bld-nothelfer', optician: 'bld-optician', amt: 'bld-amt',
  vku: 'bld-vku',
  sign: 'neon-sign', eyeChart: 'eye-chart', cross: 'medical-cross',
  // environment (task: environment agent)
  road: 'road', fork: 'fork', trafficLight: 'traffic-light',
  phone: 'phone-prop', phoneScreen: 'phone-screen', streetlight: 'streetlight',
  skyline: 'skyline', busStop: 'bus-stop',
};

/** Shared material helpers — import and reuse to keep the look consistent. */
import * as THREE from 'three';

export function matBody(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: 0.55, metalness: 0.25, flatShading: true, ...opts,
  });
}

export function matGlow(color, intensity = 2.5, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: intensity,
    roughness: 0.4, metalness: 0, ...opts,
  });
}

export function matGlass(color = 0x1a2340, glow = 0x0) {
  return new THREE.MeshStandardMaterial({
    color, roughness: 0.15, metalness: 0.7,
    emissive: glow, emissiveIntensity: glow ? 1.2 : 0,
  });
}

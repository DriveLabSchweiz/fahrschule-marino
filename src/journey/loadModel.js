/**
 * loadModel.js — tiny GLTFLoader wrapper for the journey scene.
 * ============================================================
 * Loads a single .glb by URL and resolves to its root THREE.Group, or `null`
 * on any failure (missing file / 404 / parse error). Never rejects, never
 * spams the console — at most one warning per failed URL. No Draco.
 *
 *   const model = await loadModel('/models/bus.glb');
 *   if (model) scene.add(model);   // otherwise keep the procedural fallback
 */

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

let _loader = null;
function loader() {
  if (!_loader) _loader = new GLTFLoader();
  return _loader;
}

/**
 * @param {string} url  absolute or base-relative path to a .glb
 * @returns {Promise<import('three').Group|null>}
 */
export function loadModel(url) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };
    try {
      loader().load(
        url,
        (gltf) => done(gltf && gltf.scene ? gltf.scene : null),
        undefined,
        () => {
          // One quiet warning; 404s for not-yet-authored models are expected.
          console.warn(`[journey] model unavailable, using procedural fallback: ${url}`);
          done(null);
        },
      );
    } catch (_e) {
      console.warn(`[journey] model load threw, using procedural fallback: ${url}`);
      done(null);
    }
  });
}

export default loadModel;

/**
 * JourneyScene.js — scroll-driven 3D night-city journey to the Führerschein.
 * ==========================================================================
 * Fahrschule Antonio Marino. The visitor "rides the bus" from station to
 * station along a curving main road, reaches a fork (Motorrad vs. Auto),
 * then follows their chosen vehicle to a glowing FÜHRERSCHEIN goal gate.
 *
 * Public API:
 *   const scene = new JourneyScene(canvas, { onReady });
 *   scene.setProgress(t01);      // 0..1 over the whole journey
 *   scene.setBranch('moto'|'car');
 *   scene.start(); scene.stop(); // rAF render loop control
 *   scene.resize();              // recompute on viewport change
 *   scene.dispose();             // free GPU resources
 *   scene.STATIONS               // [{ id, t }] beat map (for the overlay)
 *   scene.T_FORK                 // global-t where the fork sits
 *
 * Only procedural assets from ./assets/* + palette contract. No textures.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import { PALETTE, NAMES, matBody, matGlow } from './palette.js';
import {
  createBus, createSchoolCar, createMoto, tickVehicles,
} from './assets/vehicles.js';
import {
  createNothelferSchool, createOptician, createAmt, createVku, tickBuildings,
} from './assets/buildings.js';
import {
  createRoad, createIntersection, createPhoneProp, createStreetlight,
  createTree, createSkyline, createBusStop, tickEnvironment,
} from './assets/environment.js';
import { loadModel } from './loadModel.js';

// Emissive intensity cap for GLB materials (windows/signs should read ~1.5–2,
// never as a fog of bloom). Applied to every swapped-in model.
const GLB_EMISSIVE_CAP = 1.8;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;

// Global-t at which the road reaches the fork (scroll narratively pauses here).
const T_FORK = 0.60;

export class JourneyScene {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.opts = opts;
    this._t = 0;
    this._branch = opts.branch || 'car';   // default: car (scroll past works)
    this._running = false;
    this._disposed = false;
    this._raf = 0;
    this._clock = new THREE.Clock();
    this._elapsed = 0;
    this._lastHero = new THREE.Vector3();
    this._wheelSpin = 0;

    // --- asset-load tracking (feeds the boarding preloader's progress bar) ---
    // _swapInModels() (called from _buildWorld below) fires one loadModel() per
    // GLB; each resolution bumps _modelsDone and reports frac = done/expected.
    this._modelsExpected = 0;
    this._modelsDone = 0;
    this._onLoadProgress = typeof opts.onLoadProgress === 'function' ? opts.onLoadProgress : null;
    this._onAssetsReady = typeof opts.onAssetsReady === 'function' ? opts.onAssetsReady : null;

    // Cinematic-intro mode: while true the render loop does NOT run the
    // follow-camera — the boardingIntro module drives the camera each frame via
    // applyCamera(). Intro-only lights are tracked here for clean disposal.
    this._introActive = false;
    this._introLights = [];

    this._isMobile = window.matchMedia('(max-width: 767px)').matches;
    const lowCore = (navigator.hardwareConcurrency || 8) <= 4;
    this.bloomEnabled = !this._isMobile && !lowCore &&
      window.innerWidth >= 768;

    this._initRenderer();
    this._initScene();
    this._buildWorld();
    this._initComposer();

    // camera smoothing state
    this._camPos = new THREE.Vector3();
    this._camLook = new THREE.Vector3();
    this._camPosTarget = new THREE.Vector3();
    this._camLookTarget = new THREE.Vector3();
    this._tmpP = new THREE.Vector3();
    this._tmpL = new THREE.Vector3();

    // Opening frame = the standard follow pose at progress 0. The cinematic
    // boarding intro (src/journey/boardingIntro.js) takes over the camera after
    // the GLBs preload; if it is skipped we are already correctly framed.
    this.setProgress(0);
    this._camPos.copy(this._camPosTarget);
    this._camLook.copy(this._camLookTarget);
    this.camera.position.copy(this._camPos);
    this.camera.lookAt(this._camLook);

    this.setBranch(this._branch);

    if (typeof opts.onReady === 'function') opts.onReady(this);
  }

  // ---------------------------------------------------------------------
  // Renderer / scene setup
  // ---------------------------------------------------------------------
  _initRenderer() {
    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    const dprCap = this._isMobile ? 1.5 : 2;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
    renderer.setSize(this._w(), this._h(), false);
    renderer.setClearColor(PALETTE.bg, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    this.renderer = renderer;
  }

  _initScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(PALETTE.bg);
    scene.fog = new THREE.Fog(PALETTE.bg, 70, 380);
    this.scene = scene;

    this.camera = new THREE.PerspectiveCamera(
      55, this._w() / this._h(), 0.1, 1200,
    );

    // Ambient night lighting — assets carry their own emissive glow, but with
    // bloom dialed back and only ~4 street PointLights the facades + road need
    // a brighter hemisphere fill to read at night.
    scene.add(new THREE.HemisphereLight(0x3f4d7a, 0x080a14, 1.4));
    const ambient = new THREE.AmbientLight(0x1a2340, 0.8);
    scene.add(ambient);
    const moon = new THREE.DirectionalLight(0xa8b6ff, 0.55);
    moon.position.set(-40, 80, -30);
    scene.add(moon);

    // Huge dark ground plane just under the road.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(2400, 2400),
      matBody(0x05070f, { roughness: 1, metalness: 0, flatShading: false }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    scene.add(ground);
  }

  _initComposer() {
    const composer = new EffectComposer(this.renderer);
    composer.setSize(this._w(), this._h());
    composer.setPixelRatio(this.renderer.getPixelRatio());
    composer.addPass(new RenderPass(this.scene, this.camera));

    if (this.bloomEnabled) {
      const bloom = new UnrealBloomPass(
        new THREE.Vector2(this._w(), this._h()),
        0.22,   // strength — subtle neon halo, not fog
        0.4,    // radius
        1.05,   // threshold — only true highlights bloom (windows stay readable)
      );
      this.bloom = bloom;
      composer.addPass(bloom);
    }
    composer.addPass(new OutputPass());
    this.composer = composer;
  }

  // ---------------------------------------------------------------------
  // World construction
  // ---------------------------------------------------------------------
  _buildWorld() {
    const scene = this.scene;

    // --- main road curve: gentle S-curves heading toward +Z (~245 m) ------
    const mainPts = [
      [0, 0, 0], [7, 0, 42], [-7, 0, 82], [6, 0, 122],
      [-5, 0, 162], [4, 0, 200], [0, 0, 234],
    ].map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    this.mainCurve = new THREE.CatmullRomCurve3(mainPts, false, 'catmullrom', 0.5);

    // fork sits just beyond the main road end
    this.forkZ = 250;
    this.forkPos = new THREE.Vector3(0, 0, this.forkZ);

    // --- two branch curves: left = moto, right = car, reconverge at ZIEL --
    const zielZ = 410;
    const motoPts = [
      [0, 0, this.forkZ + 6], [-11, 0, 288], [-17, 0, 330],
      [-10, 0, 372], [0, 0, zielZ],
    ].map((p) => new THREE.Vector3(...p));
    const carPts = [
      [0, 0, this.forkZ + 6], [11, 0, 288], [17, 0, 330],
      [10, 0, 372], [0, 0, zielZ],
    ].map((p) => new THREE.Vector3(...p));
    this.branchCurve = {
      moto: new THREE.CatmullRomCurve3(motoPts, false, 'catmullrom', 0.5),
      car: new THREE.CatmullRomCurve3(carPts, false, 'catmullrom', 0.5),
    };
    this.zielPos = new THREE.Vector3(0, 0, zielZ);

    // --- road ribbons -----------------------------------------------------
    scene.add(createRoad(this.mainCurve, 8));
    scene.add(createRoad(this.branchCurve.moto, 5.5));
    scene.add(createRoad(this.branchCurve.car, 5.5));

    // --- skyline far back -------------------------------------------------
    const skyline = createSkyline();
    skyline.position.set(0, 0, 120); // centre the arc around the journey
    scene.add(skyline);
    // a second skyline cluster ahead, behind the goal
    const skyline2 = createSkyline();
    skyline2.position.set(0, 0, 430);
    skyline2.rotation.y = Math.PI;
    scene.add(skyline2);

    // --- intersection at the fork ----------------------------------------
    const fork = createIntersection();
    fork.position.copy(this.forkPos);
    scene.add(fork);
    this.fork = fork;
    this.trafficLight = fork.getObjectByName(NAMES.trafficLight);
    this.arrowLeft = fork.getObjectByName('arrow-left');   // moto (amber)
    this.arrowRight = fork.getObjectByName('arrow-right');  // car (white)
    if (this.arrowLeft) this._arrowLeftBase = this.arrowLeft.material.emissiveIntensity;
    if (this.arrowRight) this._arrowRightBase = this.arrowRight.material.emissiveIntensity;

    // --- station markers: shared geometry, one canvas texture per number ---
    this._markers = [];
    this._badgeTex = new Map();
    this._markerGeo = {
      // subtle ground ring (~1.8 m radius, thin tube) + a very faint thin beam
      ring: new THREE.TorusGeometry(1.8, 0.06, 8, 40).rotateX(-Math.PI / 2),
      beam: new THREE.CylinderGeometry(0.2, 0.24, 5, 12, 1, true),
    };

    // --- station buildings & props (dress each with lights + trees) ------
    // Numbers 1..N follow the overlay-card order in Journey3D.astro.
    this.buildingGroups = [];

    // Six evenly-spaced stations on the main road before the fork. Numbers
    // match the overlay cards exactly (see Journey3D.astro).

    // 1) START — bus stop with the bus waiting  (card #1: "Steig ein")
    this._station(this.mainCurve, 0.02, 'right', 7, () => createBusStop());
    this._stationMarker(this.mainCurve, 0.02, 'right', 1);

    // 2) NOTHELFERKURS — first-aid school on the left  (card #2)
    this._station(this.mainCurve, 0.18, 'left', 12, () => createNothelferSchool());
    this._stationMarker(this.mainCurve, 0.18, 'left', 2);

    // 3) SEHTEST — optician on the right  (card #3)
    this._station(this.mainCurve, 0.34, 'right', 11, () => createOptician());
    this._stationMarker(this.mainCurve, 0.34, 'right', 3);

    // 4) THEORIE LERNEN — giant quiz phone on the left kerb  (card #4)
    this._phoneStation = this._station(this.mainCurve, 0.50, 'left', 7, () => createPhoneProp());
    this._stationMarker(this.mainCurve, 0.50, 'left', 4);

    // 5) THEORIEPRÜFUNG — Strassenverkehrsamt on the right, imposing  (card #5)
    this._station(this.mainCurve, 0.66, 'right', 14, () => createAmt());
    this._stationMarker(this.mainCurve, 0.66, 'right', 5);

    // 6) VKU — Verkehrskunde schoolhouse on the left, before the fork (card #6)
    this._station(this.mainCurve, 0.82, 'left', 12, () => createVku());
    this._stationMarker(this.mainCurve, 0.82, 'left', 6);

    // branch stations after the fork — numbers continue the sequence.
    // moto: 7 Grundkurs, 8 Fahrstunden, 9 Praktische Prüfung
    this._stationMarker(this.branchCurve.moto, 0.30, 'left', 7, 'moto');
    this._stationMarker(this.branchCurve.moto, 0.55, 'left', 8, 'moto');
    this._stationMarker(this.branchCurve.moto, 0.80, 'left', 9, 'moto');
    // car: 7 Fahrstunden, 8 Praktische Prüfung
    this._stationMarker(this.branchCurve.car, 0.35, 'right', 7, 'car');
    this._stationMarker(this.branchCurve.car, 0.70, 'right', 8, 'car');

    // --- vehicles ---------------------------------------------------------
    this.bus = createBus();
    scene.add(this.bus);

    this.car = createSchoolCar();
    scene.add(this.car);
    this.moto = createMoto();
    scene.add(this.moto);
    this.vehicles = { car: this.car, moto: this.moto };

    // park branch vehicles at the mouth of their branch until chosen
    this._placeOnCurve(this.car, this.branchCurve.car, 0.02);
    this._placeOnCurve(this.moto, this.branchCurve.moto, 0.02);

    // --- roadside dressing: streetlights + trees along every curve --------
    // Posts every ~24 m, alternating sides. Their PointLights are stripped
    // (perf) — only the ~4 lit posts added below carry a real light.
    this._dressCurve(this.mainCurve, 245, 24);
    this._dressCurve(this.branchCurve.moto, 165, 26);
    this._dressCurve(this.branchCurve.car, 165, 26);

    // ~4 genuinely-lit posts near key stations (the rest rely on emissive
    // lamp heads + the brighter hemisphere fill).
    this._addLitStreetlight(this.mainCurve, 0.02, 'left');   // start / bus stop
    this._addLitStreetlight(this.mainCurve, 0.50, 'right');  // theorie
    this._addLitStreetlight(this.mainCurve, 0.82, 'right');  // VKU / pre-fork
    this._addLitStreetlight(this.branchCurve.car, 0.35, 'left'); // branch

    // --- ZIEL goal gate + confetti ---------------------------------------
    this._buildGoal();

    // --- swap in hand-modelled GLBs once loaded (procedural stays as fallback)
    this._swapInModels();

    // Calm every large glowing surface (procedural windows/glass — skyline,
    // buildings, vehicles) so nothing blooms into a blob at close range.
    // Small signal lights (head/taillights, traffic lamps) keep their punch.
    this._prepModel(this.scene);
  }

  // ---------------------------------------------------------------------
  // GLB swap-in: start procedural, replace with Blender models when ready.
  // ---------------------------------------------------------------------
  _modelUrl(file) {
    const base = (import.meta && import.meta.env && import.meta.env.BASE_URL) || '/';
    return `${base}${base.endsWith('/') ? '' : '/'}models/${file}`;
  }

  /** Clamp GLB emissive materials so windows/signs glow ~1.5–2, not more. */
  _prepModel(group) {
    group.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        if (!m || !m.emissive) return;
        // Extra-tight cap for readable text panels (rear "FÜHRERSCHEIN" route /
        // destination displays): keep them legible, never a halo of bloom.
        // Include ancestor names so unnamed procedural meshes (e.g. skyline
        // window instances) are still recognised by their group.
        let chain = '';
        for (let p = o; p && p !== this.scene; p = p.parent) chain += ` ${p.name || ''}`;
        const nm = `${m.name || ''} ${chain}`.toLowerCase();
        const isText = /display-text|route|\btext\b/.test(nm);
        // Large glowing surfaces (windows/glass/doors) get a calmer cap than
        // small signal lights — at close camera range they'd bloom into blobs.
        const isGlass = /win|glass|door|store|entry|screen/.test(nm);
        const cap = isText ? 1.1 : isGlass ? 1.25 : GLB_EMISSIVE_CAP;
        if (m.emissiveIntensity > cap) m.emissiveIntensity = cap;
      });
    });
  }

  /** True if the GLB's overall size is within 2x of the procedural fallback. */
  _modelFits(glb, proc) {
    const gs = new THREE.Box3().setFromObject(glb).getSize(new THREE.Vector3()).length();
    const ps = new THREE.Box3().setFromObject(proc).getSize(new THREE.Vector3()).length();
    if (ps < 1e-3 || gs < 1e-3) return true;
    const r = gs / ps;
    return r > 0.5 && r < 2;
  }

  /**
   * Load a GLB and, if valid, swap it in for a procedural group at the same
   * transform. `proc` is removed from the scene but its shared geometries are
   * NOT disposed (buildings share unit geometries). onSwap(newGroup) updates
   * any references the scene keeps (e.g. this.bus / buildingGroups slot).
   */
  _swapModel(file, proc, onSwap) {
    if (!proc) return;
    this._modelsExpected++;
    loadModel(this._modelUrl(file)).then((glb) => {
      try {
        if (!glb || this._disposed) return;        // 404/error → keep fallback
        if (!this._modelFits(glb, proc)) {
          console.warn(`[journey] ${file} bounding box >2x off procedural — keeping fallback`);
          return;
        }
        this._prepModel(glb);
        glb.name = proc.name;
        glb.position.copy(proc.position);
        glb.quaternion.copy(proc.quaternion);
        glb.scale.copy(proc.scale);
        if (proc.userData) Object.assign(glb.userData, proc.userData);
        this.scene.remove(proc);
        this.scene.add(glb);
        if (typeof onSwap === 'function') onSwap(glb);
      } finally {
        this._noteModelDone();
      }
    });
  }

  /** One GLB finished loading (success or fallback) — advance the preloader. */
  _noteModelDone() {
    this._modelsDone++;
    const frac = this._modelsExpected ? this._modelsDone / this._modelsExpected : 1;
    if (this._onLoadProgress) this._onLoadProgress(clamp01(frac));
    if (this._modelsDone >= this._modelsExpected && this._onAssetsReady) {
      const cb = this._onAssetsReady;
      this._onAssetsReady = null;                  // fire exactly once
      cb();
    }
  }

  _swapInModels() {
    // Hero bus — keep it the hero reference and re-place at current progress.
    this._swapModel('bus.glb', this.bus, (glb) => {
      this.bus = glb;
      // During the cinematic intro the bus pose is driven per-frame by the
      // boardingIntro timeline; only self-place when the intro isn't running.
      if (!this._introActive) this.setProgress(this._t);
    });

    // Station buildings — swap in place, keep the buildingGroups slot pointing
    // at the new group so tickBuildings keeps animating it (harmless no-op if
    // the GLB lacks the named animatable parts).
    const bldFiles = {
      [NAMES.nothelfer]: 'nothelfer.glb',
      [NAMES.optician]: 'optiker.glb',
      [NAMES.amt]: 'amt.glb',
      [NAMES.vku]: 'vku.glb',
    };
    this.buildingGroups.forEach((g, i) => {
      const file = bldFiles[g.name];
      if (!file) return;
      this._swapModel(file, g, (glb) => { this.buildingGroups[i] = glb; });
    });

    // Theorie phone monument — swap the procedural prop for phone.glb.
    if (this._phoneStation) {
      const procPhone = this._phoneStation;
      this._swapModel('phone.glb', procPhone, (glb) => {
        const i = this.buildingGroups.indexOf(procPhone);
        if (i >= 0) this.buildingGroups[i] = glb;
        this._phoneStation = glb;
      });
    }

    // Fahrschul-Auto — the hand-modelled Cupra Born replaces the procedural
    // school car (wheel groups carry isWheel extras; front faces +Z; y=0).
    this._swapModel('cupra-born-marino.glb', this.car, (glb) => {
      this.car = glb;
      this.vehicles.car = glb;
      if (!this._introActive) this.setProgress(this._t);
    });
  }

  /** Place a building/prop station beside a curve at param u, facing the road. */
  _station(curve, u, side, offset, factory) {
    const p = curve.getPointAt(u);
    const tan = curve.getTangentAt(u);
    const lateral = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 1, 0)).normalize();
    const sign = side === 'left' ? 1 : -1;
    const pos = p.clone().addScaledVector(lateral, sign * offset);
    const group = factory();
    group.position.copy(pos);
    // face the road: forward points from the building back toward the road centre
    const toRoad = p.clone().sub(pos);
    group.rotation.y = Math.atan2(toRoad.x, toRoad.z);
    this.scene.add(group);
    this.buildingGroups.push(group);
    return group;
  }

  // ---------------------------------------------------------------------
  // Station markers — amber ground ring + soft light beam + numbered badge.
  // Shared geometry; materials are per-marker so each can pulse/brighten.
  // ---------------------------------------------------------------------

  /** Canvas-texture badge: white number on a brand-red disc. One per number. */
  _badgeTexture(n) {
    if (this._badgeTex.has(n)) return this._badgeTex.get(n);
    const S = 256;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, S, S);
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = '#e63946';                 // PALETTE.red
    ctx.fill();
    ctx.lineWidth = S * 0.055;
    ctx.strokeStyle = '#ffd23f';               // amber ring
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.floor(S * 0.5)}px "Helvetica Neue", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(n), S / 2, S * 0.55);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    this._badgeTex.set(n, tex);
    return tex;
  }

  _buildMarker(number, branch) {
    const g = new THREE.Group();
    g.name = 'station-marker';

    // Subtle amber ground ring (~1.8 m), moderate emissive — never a blob.
    const ringMat = new THREE.MeshStandardMaterial({
      color: PALETTE.amber, emissive: PALETTE.amber, emissiveIntensity: 1.2,
      roughness: 0.5, metalness: 0, transparent: true, opacity: 0.8,
    });
    const ring = new THREE.Mesh(this._markerGeo.ring, ringMat);
    ring.position.y = 0.05;
    g.add(ring);

    // A very faint, thin beam — barely there (opacity ≤ 0.12, radius ≤ 0.25 m).
    const beamMat = new THREE.MeshBasicMaterial({
      color: PALETTE.amber, transparent: true, opacity: 0.05,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const beam = new THREE.Mesh(this._markerGeo.beam, beamMat);
    beam.position.y = 2.5;
    g.add(beam);

    // Small numbered badge sprite floating ~3.5 m up.
    const spMat = new THREE.SpriteMaterial({
      map: this._badgeTexture(number), transparent: true, depthWrite: false,
    });
    const sprite = new THREE.Sprite(spMat);
    sprite.scale.set(0.9, 0.9, 1);
    sprite.position.y = 3.5;
    g.add(sprite);

    g.userData = {
      ring, ringMat, beam, beamMat, sprite, spMat,
      number, branch: branch || '', baseRing: 1.2, t: 0,
    };
    return g;
  }

  /** Place a numbered marker at curve param u, on the given kerb side. */
  _stationMarker(curve, u, side, number, branch = '') {
    const p = curve.getPointAt(u);
    const tan = curve.getTangentAt(u);
    const lateral = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 1, 0)).normalize();
    const sign = side === 'left' ? 1 : -1;
    const pos = p.clone().addScaledVector(lateral, sign * 4.4); // just off the kerb
    const g = this._buildMarker(number, branch);
    g.position.copy(pos);
    // global-t at which the hero physically reaches this marker
    g.userData.t = branch
      ? T_FORK + u * (1 - T_FORK)
      : u * T_FORK;
    this.scene.add(g);
    this._markers.push(g);
    return g;
  }

  /** Per-frame pulse: brighten the current station, dim the rest. */
  _tickMarkers() {
    if (!this._markers || !this._markers.length) return;
    const prog = this._t;
    const el = this._elapsed;
    // pick the current marker among main + the active branch only
    let cur = null, best = Infinity;
    for (const m of this._markers) {
      const b = m.userData.branch;
      if (b && b !== this._branch) continue;
      const d = Math.abs(prog - m.userData.t);
      if (d < best) { best = d; cur = m; }
    }
    for (const m of this._markers) {
      const ud = m.userData;
      const inactive = ud.branch && ud.branch !== this._branch;
      const d = Math.abs(prog - ud.t);
      const near = clamp01(1 - d / 0.14);       // 1 at the station, 0 far away
      const isCur = m === cur && best < 0.16;
      const pulse = 0.5 + 0.5 * Math.sin(el * 2.4 + ud.number);

      // Gentle: emissive stays modest so the ring never blooms into a blob.
      let ringI = ud.baseRing * (0.55 + near * 0.55);   // ~0.66 .. 1.3
      let ringOp = 0.5 + near * 0.35;
      let beamOp = 0.03 + near * 0.06;                  // capped ≤ 0.12
      let sprS = 0.9 + near * 0.12;
      if (isCur) { ringI *= 1.25; ringOp = Math.min(0.95, ringOp + 0.12); beamOp += 0.02; sprS += 0.1; }
      if (inactive) { ringI *= 0.4; ringOp *= 0.4; beamOp *= 0.35; }

      ud.ringMat.emissiveIntensity = ringI * (0.92 + 0.08 * pulse);
      ud.ringMat.opacity = ringOp;
      ud.ring.scale.setScalar(1 + (isCur ? 0.06 : 0.02) * pulse * (0.4 + near));
      ud.beamMat.opacity = Math.min(0.12, beamOp) * (0.85 + 0.15 * pulse);
      ud.sprite.scale.set(sprS, sprS, 1);
      ud.spMat.opacity = inactive ? 0.4 : 1;
    }
  }

  /** Streetlights (alternating sides) + a few trees along a curve. */
  _dressCurve(curve, length, spacing) {
    const n = Math.max(2, Math.floor(length / spacing));
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const p = curve.getPointAt(u);
      const tan = curve.getTangentAt(u);
      const lateral = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 1, 0)).normalize();
      const side = i % 2 === 0 ? 1 : -1;

      const light = createStreetlight({ light: false }); // no PointLight (perf)
      light.position.copy(p.clone().addScaledVector(lateral, side * 5.4));
      // arm reaches +X locally toward the road → face road inward
      light.rotation.y = Math.atan2(-lateral.x * side, -lateral.z * side);
      this.scene.add(light);

      // a tree on the opposite kerb every other post
      if (i % 2 === 1) {
        const tree = createTree();
        const jitter = 0.6 + Math.random() * 0.8;
        tree.position.copy(p.clone().addScaledVector(lateral, -side * (6.5 + jitter)));
        tree.scale.setScalar(0.85 + Math.random() * 0.5);
        this.scene.add(tree);
      }
    }
  }

  /** A single streetlight that KEEPS its PointLight, placed near a station. */
  _addLitStreetlight(curve, u, side) {
    const p = curve.getPointAt(u);
    const tan = curve.getTangentAt(u);
    const lateral = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 1, 0)).normalize();
    const sign = side === 'left' ? 1 : -1;
    const light = createStreetlight({ light: true });
    light.position.copy(p.clone().addScaledVector(lateral, sign * 5.4));
    light.rotation.y = Math.atan2(-lateral.x * sign, -lateral.z * sign);
    this.scene.add(light);
    return light;
  }

  /** Glowing FÜHRERSCHEIN gate built from boxes + emissive confetti. */
  _buildGoal() {
    const gate = new THREE.Group();
    gate.name = 'ziel-gate';
    gate.position.copy(this.zielPos);

    const glowRed = matGlow(PALETTE.redBright, 2.6);
    const glowAmber = matGlow(PALETTE.amberBright, 3.0);
    const post = new THREE.BoxGeometry(0.8, 8, 0.8);
    const left = new THREE.Mesh(post, glowRed);
    left.position.set(-5, 4, 0);
    const right = new THREE.Mesh(post, glowRed);
    right.position.set(5, 4, 0);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(11, 1.1, 0.9), glowAmber);
    beam.position.set(0, 8.2, 0);
    gate.add(left, right, beam);

    // "FÜHRERSCHEIN" suggestion bar under the beam
    const banner = new THREE.Mesh(new THREE.BoxGeometry(8.4, 1.3, 0.2), matGlow(PALETTE.white, 2.2));
    banner.position.set(0, 6.6, 0.2);
    gate.add(banner);
    for (let i = 0; i < 6; i++) {
      const word = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.06), matGlow(PALETTE.red, 2.4));
      word.position.set(-3.4 + i * 1.35, 6.6, 0.33);
      gate.add(word);
    }

    // gate glow lights
    const pl1 = new THREE.PointLight(PALETTE.amber, 8, 30, 2);
    pl1.position.set(0, 7, 2);
    gate.add(pl1);
    const pl2 = new THREE.PointLight(PALETTE.redBright, 6, 24, 2);
    pl2.position.set(0, 3, 3);
    gate.add(pl2);

    this.scene.add(gate);
    this.goalGate = gate;

    // --- confetti-ish emissive particles above the gate ------------------
    const COUNT = 240;
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    this._confettiVel = new Float32Array(COUNT);
    this._confettiBaseY = new Float32Array(COUNT);
    const palette = [PALETTE.red, PALETTE.amber, PALETTE.amberBright, PALETTE.white, PALETTE.green]
      .map((c) => new THREE.Color(c));
    for (let i = 0; i < COUNT; i++) {
      const x = (Math.random() - 0.5) * 12;
      const y = 3 + Math.random() * 12;
      const z = (Math.random() - 0.5) * 6;
      positions[i * 3] = this.zielPos.x + x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = this.zielPos.z + z;
      this._confettiBaseY[i] = y;
      this._confettiVel[i] = 1.5 + Math.random() * 3;
      const col = palette[i % palette.length];
      colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.42, vertexColors: true, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
    });
    this.confetti = new THREE.Points(geo, mat);
    this.scene.add(this.confetti);
  }

  _placeOnCurve(obj, curve, u, lookAhead = 0.01) {
    u = clamp01(u);
    const p = curve.getPointAt(u);
    obj.position.copy(p);
    const ahead = curve.getPointAt(clamp01(u + lookAhead));
    const dir = ahead.clone().sub(p);
    if (dir.lengthSq() > 1e-6) obj.rotation.y = Math.atan2(dir.x, dir.z);
    return p;
  }

  // ---------------------------------------------------------------------
  // Public: progress mapping over the whole journey
  // ---------------------------------------------------------------------
  setProgress(t) {
    this._t = clamp01(t);
    const t01 = this._t;

    let heroPos, curve, u, hero;
    if (t01 <= T_FORK) {
      u = t01 / T_FORK;                      // 0..1 along main curve
      curve = this.mainCurve;
      hero = this.bus;
    } else {
      u = (t01 - T_FORK) / (1 - T_FORK);     // 0..1 along chosen branch
      curve = this.branchCurve[this._branch];
      hero = this.vehicles[this._branch];
    }
    u = clamp01(u);
    heroPos = this._placeOnCurve(hero, curve, u, 0.008);

    // Keep the bus parked at the fork after the fork so the world stays alive.
    if (t01 > T_FORK) {
      this._placeOnCurve(this.bus, this.mainCurve, 1, 0.004);
    }

    // --- camera: behind & above the hero, looking a little ahead ---------
    const tan = curve.getTangentAt(u);
    const ahead = curve.getPointAt(clamp01(u + 0.03));
    const back = hero === this.bus ? 15 : 9.5;
    const height = hero === this.bus ? 7.5 : 5.2;

    this._camPosTarget.copy(heroPos)
      .addScaledVector(tan, -back)
      .add(new THREE.Vector3(0, height, 0));
    this._camLookTarget.copy(ahead).add(new THREE.Vector3(0, 1.6, 0));

    // At the very end, pull back to reveal the goal gate.
    if (t01 > 0.9) {
      const k = (t01 - 0.9) / 0.1;
      this._camLookTarget.lerp(new THREE.Vector3(this.zielPos.x, 5, this.zielPos.z), k * 0.6);
    }

    // --- traffic light: red until the approach, green near the fork ------
    this._updateTrafficLight(t01);

    // --- wheel spin from travel distance ---------------------------------
    const dist = heroPos.distanceTo(this._lastHero);
    this._lastHero.copy(heroPos);
    // wheel radius ~0.4 m; convert travelled distance to rotation
    this._wheelSpin -= dist / 0.4;
    this._spinWheels(hero);
  }

  setBranch(branch) {
    if (branch !== 'moto' && branch !== 'car') return;
    this._branch = branch;
    // highlight the chosen arrow, dim the other
    if (this.arrowLeft) {
      this.arrowLeft.material.emissiveIntensity =
        branch === 'moto' ? 4.2 : (this._arrowLeftBase * 0.35);
    }
    if (this.arrowRight) {
      this.arrowRight.material.emissiveIntensity =
        branch === 'car' ? 4.2 : (this._arrowRightBase * 0.35);
    }
    // re-place hero if we're already past the fork
    if (this._t > T_FORK) this.setProgress(this._t);
  }

  getBranch() { return this._branch; }

  // ---------------------------------------------------------------------
  // Cinematic boarding intro — support API driven by ./boardingIntro.js.
  // The intro owns the timeline; the scene only exposes the primitives it
  // needs (camera control, bus pose along the entry, door, lights, the exact
  // follow pose to converge on) and a flag so the render loop yields the camera.
  // ---------------------------------------------------------------------

  /** Enter intro mode: the render loop stops driving the follow camera. */
  beginIntro() { this._introActive = true; }

  /** Leave intro mode and hand the camera back to the follow logic cleanly. */
  endIntro() {
    this._introActive = false;
    // Sync smoothing state to the live camera so follow resumes without a jump.
    this._camPos.copy(this.camera.position);
    this._camLook.copy(this._camLookTarget);
  }

  isIntroActive() { return this._introActive; }

  /** Directly set the camera (position + look target). Used every intro frame. */
  applyCamera(pos, look) {
    this.camera.position.copy(pos);
    this.camera.lookAt(look);
    this._camPos.copy(pos);
    this._camLook.copy(look);
  }

  /** Temporarily override the camera FOV (mobile side-view fit). */
  setFov(fov) {
    if (!this.camera) return;
    if (this._fovBase === undefined) this._fovBase = this.camera.fov;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }
  restoreFov() {
    if (this._fovBase !== undefined) { this.camera.fov = this._fovBase; this.camera.updateProjectionMatrix(); }
  }

  /** The exact follow-cam pose the standard scroll expects at progress 0. */
  getFollowPose(t = 0) {
    this.setProgress(t);
    return { pos: this._camPosTarget.clone(), look: this._camLookTarget.clone() };
  }

  /** Place the hero bus at an arbitrary world pose (intro drive-in). */
  setBusPose(pos, yaw, pitch = 0) {
    if (!this.bus) return;
    this.bus.position.copy(pos);
    this.bus.rotation.set(pitch, yaw, 0);
  }

  /** Roll the bus wheels by a travelled distance (metres). */
  rollBusWheels(dist) {
    this._wheelSpin -= dist / 0.4;   // wheel radius ~0.4 m
    this._spinWheels(this.bus);
  }

  /**
   * Open the passenger door to `angle` radians about its vertical hinge.
   * Works for the GLB bus and the procedural fallback (both expose 'bus-door'
   * with the panel extending rearward from the hinge, so a negative angle
   * swings it outward toward the kerb/camera). Returns the door for a11y/refs.
   */
  setDoorAngle(angle) {
    if (!this.bus) return null;
    const door = this.bus.getObjectByName(NAMES.busDoor);
    if (!door) return null;
    if (door.userData._doorBase === undefined) door.userData._doorBase = door.rotation.y;
    door.rotation.y = door.userData._doorBase + angle;
    return door;
  }

  /** World position of the passenger door (for the dolly target). */
  getDoorWorldPos(target = new THREE.Vector3()) {
    const door = this.bus && this.bus.getObjectByName(NAMES.busDoor);
    if (door) return door.getWorldPosition(target);
    return this.bus ? this.bus.getWorldPosition(target) : target.set(0, 1.5, 0);
  }

  /** Brake / tail-light flash intensity (0 = idle glow, 1 = hard on). */
  setBrakeLights(k) {
    if (!this.bus) return;
    this.bus.traverse((o) => {
      if (o.name === NAMES.taillight && o.material) {
        o.material.emissiveIntensity = 2.0 + 3.4 * clamp01(k);
      }
    });
  }

  /** A warm PointLight in front of the bus for the drive-in beam pool. */
  addHeadlampBeam() {
    if (!this.bus) return null;
    const pl = new THREE.PointLight(PALETTE.amberBright, 0, 30, 2);
    pl.position.set(0, 1.0, 7.4);          // just ahead of the front bumper
    this.bus.add(pl);
    this._introLights.push(pl);
    return pl;
  }

  /** A warm PointLight at the doorway for the "step into the light" beat. */
  addDoorwayLight() {
    if (!this.bus) return null;
    const pl = new THREE.PointLight(PALETTE.windowGlow, 0, 10, 2);
    pl.position.set(1.7, 1.5, 4.6);        // door side (+X), front
    this.bus.add(pl);
    this._introLights.push(pl);
    return pl;
  }

  /** Remove every intro-only light and free it. */
  disposeIntroLights() {
    this._introLights.forEach((l) => { if (l.parent) l.parent.remove(l); if (l.dispose) l.dispose(); });
    this._introLights = [];
  }

  _updateTrafficLight(t01) {
    if (!this.trafficLight) return;
    // approach window [0.42 .. fork]; green once close, amber just before.
    const red = this.trafficLight.getObjectByName('lamp-red');
    const amber = this.trafficLight.getObjectByName('lamp-amber');
    const green = this.trafficLight.getObjectByName('lamp-green');
    let state = 'red';
    if (t01 > 0.52) state = 'green';
    else if (t01 > 0.46) state = 'amber';
    if (red) red.material.emissiveIntensity = state === 'red' ? 3.2 : 0.1;
    if (amber) amber.material.emissiveIntensity = state === 'amber' ? 3.2 : 0.1;
    if (green) green.material.emissiveIntensity = state === 'green' ? 3.4 : 0.1;
  }

  _spinWheels(hero) {
    if (!hero) return;
    // Wheels roll about local X (procedural groups + GLB cylinders share this
    // axis). Preserve any base rotation the GLB wheel node was authored with.
    hero.traverse((o) => {
      if (o.userData && o.userData.isWheel) {
        if (o.userData._spinBase === undefined) o.userData._spinBase = o.rotation.x;
        o.rotation.x = o.userData._spinBase + this._wheelSpin;
      }
    });
  }

  // ---------------------------------------------------------------------
  // Render loop
  // ---------------------------------------------------------------------
  start() {
    if (this._running) return;
    this._running = true;
    this._clock.getDelta(); // reset
    const loop = () => {
      if (!this._running) return;
      this._raf = requestAnimationFrame(loop);
      this._render();
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    this._running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  _render() {
    const dt = Math.min(this._clock.getDelta(), 0.05);
    this._elapsed += dt;
    const t = this._elapsed;

    // idle animation on assets
    tickVehicles(this.bus, t);
    tickVehicles(this.car, t);
    tickVehicles(this.moto, t);
    this.buildingGroups.forEach((g) => tickBuildings(g, t));
    // environment tick (phone shimmer, decorative lights). We drive the fork
    // traffic light ourselves via progress, so skip auto-cycling it.
    tickEnvironment(this.scene, t);
    this._updateTrafficLight(this._t); // re-assert progress-based signal
    this._tickMarkers();               // station-marker pulse / current highlight

    // confetti burst near the goal
    if (this.confetti) {
      const near = this._t > 0.86;
      const targetOp = near ? 1 : 0;
      this.confetti.material.opacity = lerp(this.confetti.material.opacity, targetOp, 0.08);
      if (this.confetti.material.opacity > 0.02) {
        const pos = this.confetti.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          let y = pos.getY(i) - this._confettiVel[i] * dt;
          if (y < 0.4) y = this._confettiBaseY[i] + Math.random() * 3;
          pos.setY(i, y);
          const x = pos.getX(i) + Math.sin(t * 2 + i) * dt * 0.4;
          pos.setX(i, x);
        }
        pos.needsUpdate = true;
      }
    }

    // camera: while the cinematic intro is active it drives the camera itself
    // (via applyCamera each frame); otherwise smoothly chase the follow target.
    if (!this._introActive) {
      this._camPos.lerp(this._camPosTarget, 0.12);
      this._camLook.lerp(this._camLookTarget, 0.12);
      this.camera.position.copy(this._camPos);
      this.camera.lookAt(this._camLook);
    }

    if (this.bloomEnabled && this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  /** Render a single frame (for reduced-motion / static first paint). */
  renderOnce() {
    if (!this._introActive) {
      this.camera.position.copy(this._camPosTarget);
      this.camera.lookAt(this._camLookTarget);
    }
    if (this.bloomEnabled && this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  // ---------------------------------------------------------------------
  // Resize / dispose
  // ---------------------------------------------------------------------
  _w() { return this.canvas.clientWidth || window.innerWidth; }
  _h() { return this.canvas.clientHeight || window.innerHeight; }

  resize() {
    const w = this._w(), h = this._h();
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    if (this.composer) this.composer.setSize(w, h);
    if (this.bloom) this.bloom.setSize(w, h);
  }

  dispose() {
    this._disposed = true;
    this.stop();
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => m.dispose());
      }
    });
    if (this.composer) {
      this.composer.passes.forEach((p) => p.dispose && p.dispose());
      this.composer.renderTarget1 && this.composer.renderTarget1.dispose();
      this.composer.renderTarget2 && this.composer.renderTarget2.dispose();
    }
    this.renderer.dispose();
  }

  // beat map exposed to the overlay (global-t centres)
  get STATIONS() {
    return [
      { id: 'start', t: 0.02 },
      { id: 'nothelfer', t: 0.11 },
      { id: 'sehtest', t: 0.20 },
      { id: 'theorie', t: 0.30 },
      { id: 'pruefung-theorie', t: 0.40 },
      { id: 'vku', t: 0.49 },
      { id: 'fork', t: T_FORK },
      { id: 'branch-1', t: 0.74 },
      { id: 'branch-2', t: 0.86 },
      { id: 'branch-3', t: 0.92 },
      { id: 'ziel', t: 0.985 },
    ];
  }

  get T_FORK() { return T_FORK; }
}

export default JourneyScene;

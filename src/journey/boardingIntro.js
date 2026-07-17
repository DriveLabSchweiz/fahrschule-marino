/**
 * boardingIntro.js — the cinematic "board the bus" preloader sequence.
 * ====================================================================
 * Runs once, after the GLBs preload, on top of the live journey canvas. It is
 * the site's opening shot: an empty night street, the bus drives in and brakes
 * at the stop, its door swings open into warm light, the camera walks to the
 * threshold, a soft amber flash — and we resolve behind the bus at journey
 * progress 0, exactly where ScrollTrigger takes over.
 *
 *   const ctl = runBoardingIntro(scene, { mobile, onFlash, onPhase, onFinish });
 *   ctl.finish();          // fast-forward / skip (idempotent, ≤0.4 s)
 *   ctl.isFinished();
 *
 * The scene (JourneyScene) exposes the primitives — camera control, bus pose
 * along the entry, door angle, brake/doorway lights, the exact follow pose —
 * and yields the camera while `isIntroActive()`. All timing/feel lives in the
 * INTRO table below so it stays tweakable.
 */

import { gsap } from 'gsap';
import * as THREE from 'three';

// ---- TUNABLE TIMING (seconds) & CINEMATIC FEEL ----------------------------
export const INTRO = {
  ARRIVAL: 2.5,        // Phase B — bus drives in and decelerates to the stop
  DOOR: 1.6,           // Phase C — door opens, camera dollies to the doorway
  DEPART: 1.2,         // Phase D — out of the flash, settle behind the bus
  FLASH: 0.22,         // white/amber-out at the threshold (~200 ms)

  APPROACH_DIST: 34,   // metres the bus covers while driving in (desktop)
  SIDE_OFFSET: 13,     // camera stand-off from the bus, door/kerb side (desktop)
  CAM_HEIGHT: 2.4,     // raised kerb view — reads the whole bus silhouette
  FOV: 50,             // ~35 mm feel (desktop)
  FOV_MOBILE: 66,      // wider so the ~12 m bus fits on a phone
  MOBILE_SCALE: 0.7,   // ~30% shorter durations + tighter distances on mobile

  DOOR_OPEN: -1.92,    // ≈ -110°; swings the panel outward toward the kerb/camera
  BEAM_INTENSITY: 3.5, // headlamp beam pool
  DOOR_LIGHT: 4,       // doorway glow at full open (desktop)
  STOP_LIGHT: 4.5,     // warm pool over the stop during the arrival
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * @param {import('./JourneyScene.js').JourneyScene} scene
 * @param {object} opts  { mobile, onFlash(v), onPhase(name), onFinish() }
 * @returns {{ finish: (instant?:boolean)=>void, isFinished: ()=>boolean }}
 */
export function runBoardingIntro(scene, opts = {}) {
  const mobile = !!opts.mobile;
  const onFlash = typeof opts.onFlash === 'function' ? opts.onFlash : () => {};
  const onPhase = typeof opts.onPhase === 'function' ? opts.onPhase : () => {};
  const onFinish = typeof opts.onFinish === 'function' ? opts.onFinish : () => {};

  const S = mobile ? INTRO.MOBILE_SCALE : 1;
  const ARRIVAL = INTRO.ARRIVAL * S;
  const DOOR = INTRO.DOOR * S;
  const DEPART = INTRO.DEPART * S;
  const FLASH = INTRO.FLASH;

  // --- scratch vectors (reused every frame; no per-frame allocation) --------
  const _bp = new THREE.Vector3();
  const _cp = new THREE.Vector3();
  const _cl = new THREE.Vector3();
  const _dw = new THREE.Vector3();
  const _ct = new THREE.Vector3();
  const _t1 = new THREE.Vector3();

  // --- geometry of the approach --------------------------------------------
  const curve = scene.mainCurve;
  const stopU = 0.02;
  const stopPos = curve.getPointAt(stopU);
  const stopTan = curve.getTangentAt(stopU).clone().normalize();
  const yaw = Math.atan2(stopTan.x, stopTan.z);
  const up = new THREE.Vector3(0, 1, 0);
  // kerb / door side ≈ +X for a +Z-facing bus
  const sideDir = new THREE.Vector3().crossVectors(up, stopTan).normalize();

  const approach = INTRO.APPROACH_DIST * S;
  const startPos = stopPos.clone().addScaledVector(stopTan, -approach);

  // side-view anchor: at the kerb, a touch ahead of the stop
  const camAnchor = stopPos.clone()
    .addScaledVector(sideDir, INTRO.SIDE_OFFSET + (mobile ? 3.5 : 0))
    .addScaledVector(stopTan, 4.0)
    .add(new THREE.Vector3(0, INTRO.CAM_HEIGHT, 0));

  // --- animated proxies -----------------------------------------------------
  const drive = { t: 0, pitch: 0, brake: 0 };
  const cam = { dolly: 0 };
  const doorP = { open: 0 };
  const lightP = { door: 0 };
  const flash = { v: 0 };

  let mode = 'arrival';                 // 'arrival' | 'door' | 'depart'
  let finished = false;
  let tl = null;
  let followPose = null;
  const departFrom = new THREE.Vector3();
  const departLook = new THREE.Vector3();
  const prevBusPos = startPos.clone();
  const t0 = performance.now();

  // handheld sway — two detuned sines for an organic, non-repeating nod
  const sway = (seed, amp) => {
    const t = (performance.now() - t0) / 1000;
    return (Math.sin(t * 1.3 + seed) + Math.sin(t * 2.73 + seed * 1.7) * 0.5) * amp;
  };

  let beam = null;
  let doorLight = null;

  // ---- per-frame apply (timeline onUpdate) --------------------------------
  function applyFrame() {
    // bus along the entry (arrival + door hold); depart leaves it parked at u=0
    if (mode === 'arrival' || mode === 'door') {
      _bp.copy(startPos).lerp(stopPos, drive.t);
      scene.setBusPose(_bp, yaw, drive.pitch);
      scene.rollBusWheels(_bp.distanceTo(prevBusPos));
      prevBusPos.copy(_bp);
    } else if (mode === 'depart') {
      scene.rollBusWheels(0.05 * S);    // gentle creep as it "pulls away"
    }

    scene.setBrakeLights(drive.brake);
    scene.setDoorAngle(INTRO.DOOR_OPEN * doorP.open);
    if (doorLight) doorLight.intensity = lightP.door * (mobile ? 3 : INTRO.DOOR_LIGHT);

    if (mode === 'arrival') {
      // static-ish handheld camera; the look leads the incoming bus slightly
      _cp.copy(camAnchor).add(_t1.set(sway(0, 0.10), sway(1.7, 0.05), sway(4.1, 0.06)));
      _cl.copy(_bp).addScaledVector(stopTan, 3.0 * (1 - drive.t))
        .add(_t1.set(sway(3.1, 0.14), 1.6 + sway(2.2, 0.05), 0));
      scene.applyCamera(_cp, _cl);
    } else if (mode === 'door') {
      // dolly toward just outside the open door with a two-step walking bob
      const doorPos = scene.getDoorWorldPos(_dw);
      _ct.copy(doorPos).addScaledVector(sideDir, 1.9).addScaledVector(stopTan, 0.4);
      _ct.y = 1.5;
      _cp.copy(camAnchor).lerp(_ct, cam.dolly);
      _cp.y += Math.sin(cam.dolly * Math.PI * 4) * 0.085 * (1 - cam.dolly * 0.5); // bob
      _cp.x += sway(0, 0.04);
      _cl.copy(doorPos).add(_t1.set(0, 0.15, 0));
      scene.applyCamera(_cp, _cl);
    } else if (mode === 'depart' && followPose) {
      _cp.copy(departFrom).lerp(followPose.pos, cam.dolly);
      _cl.copy(departLook).lerp(followPose.look, cam.dolly);
      scene.applyCamera(_cp, _cl);
    }

    onFlash(flash.v);
  }

  // ---- kick off ------------------------------------------------------------
  scene.beginIntro();
  scene.setFov(mobile ? INTRO.FOV_MOBILE : INTRO.FOV);
  scene.setBusPose(startPos, yaw, 0);
  scene.setDoorAngle(0);
  scene.setBrakeLights(0);
  beam = scene.addHeadlampBeam();
  doorLight = scene.addDoorwayLight();
  if (beam) beam.intensity = INTRO.BEAM_INTENSITY;
  // warm pool of light over the stop so the arrival reads at night
  if (scene.scene && Array.isArray(scene._introLights)) {
    const stopGlow = new THREE.PointLight(0xffc966, INTRO.STOP_LIGHT, 22, 1.8);
    stopGlow.position.copy(stopPos).add(_t1.set(0, 6.5, 0)).addScaledVector(sideDir, 3);
    scene.scene.add(stopGlow);
    scene._introLights.push(stopGlow);
  }

  tl = gsap.timeline({ onUpdate: applyFrame, onComplete: () => finish(true) });

  // PHASE B — arrival (decelerate into the stop)
  tl.addLabel('B', 0);
  tl.to(drive, { t: 1, duration: ARRIVAL, ease: 'power3.out',
    onStart: () => { mode = 'arrival'; onPhase('arrival'); } }, 'B');
  // brake glow ramps as it slows; nose dips on the brake, then springs level
  tl.to(drive, { brake: 1, duration: ARRIVAL * 0.55, ease: 'power2.in' }, 'B+=' + (ARRIVAL * 0.45));
  tl.to(drive, { pitch: 0.055, duration: ARRIVAL * 0.30, ease: 'power2.in' }, 'B+=' + (ARRIVAL * 0.6));
  tl.to(drive, { pitch: 0.0, duration: 0.55, ease: 'elastic.out(1, 0.5)' }, 'B+=' + ARRIVAL);
  tl.to(drive, { brake: 0.35, duration: 0.45, ease: 'power2.out' }, 'B+=' + ARRIVAL);

  // PHASE C — door opens into warm light, camera walks to the threshold
  tl.addLabel('C', 'B+=' + (ARRIVAL + 0.15));
  tl.to(lightP, { door: 1, duration: DOOR * 0.5, ease: 'power2.out',
    onStart: () => onPhase('door') }, 'C');
  tl.to(doorP, { open: 1, duration: DOOR * 0.62, ease: 'back.out(1.4)' }, 'C+=0.08');
  tl.to(cam, { dolly: 1, duration: DOOR, ease: 'power2.inOut',
    onStart: () => { mode = 'door'; } }, 'C');
  // soft flash at the threshold (end of the dolly)
  tl.addLabel('flash', 'C+=' + (DOOR - FLASH * 0.35));
  tl.to(flash, { v: 1, duration: FLASH, ease: 'power2.in',
    onStart: () => onPhase('flash') }, 'flash');

  // PHASE D — hidden by the flash, snap to progress 0 and settle behind the bus
  tl.addLabel('D', 'flash+=' + FLASH);
  tl.call(() => {
    followPose = scene.getFollowPose(0);      // parks the bus at u=0, sets targets
    scene.setDoorAngle(0);
    departFrom.copy(followPose.pos).lerp(followPose.look, 0.18);
    departFrom.y -= 0.4;                       // emerge a hair lower & closer
    departLook.copy(followPose.look);
    cam.dolly = 0;
    mode = 'depart';
    onPhase('depart');
  }, null, 'D');
  tl.to(cam, { dolly: 1, duration: DEPART, ease: 'power2.out' }, 'D');
  tl.to(flash, { v: 0, duration: DEPART * 0.6, ease: 'power2.out' }, 'D');
  tl.to(drive, { brake: 0, duration: DEPART * 0.5, ease: 'power2.out' }, 'D');

  // ---- finish / skip (idempotent) -----------------------------------------
  function finalize() {
    followPose = scene.getFollowPose(0);
    scene.setDoorAngle(0);
    scene.setBrakeLights(0);
    scene.applyCamera(followPose.pos, followPose.look);
    scene.restoreFov();
    onFlash(0);
    scene.endIntro();
    scene.disposeIntroLights();
    onPhase('done');
    onFinish();
  }

  function finish(instant) {
    if (finished) return;
    finished = true;
    if (tl) { tl.kill(); tl = null; }

    if (instant) { finalize(); return; }

    // Fast-forward: a quick, smooth catch-up to the end state (≤0.4 s).
    followPose = scene.getFollowPose(0);
    const fromPos = scene.camera.position.clone();
    const dir = new THREE.Vector3();
    scene.camera.getWorldDirection(dir);
    const fromLook = fromPos.clone().addScaledVector(dir, 12);
    const startOpen = doorP.open;
    const startFlash = flash.v;
    const q = { k: 0 };
    gsap.to(q, {
      k: 1, duration: 0.36, ease: 'power2.inOut',
      onUpdate: () => {
        _cp.copy(fromPos).lerp(followPose.pos, q.k);
        _cl.copy(fromLook).lerp(followPose.look, q.k);
        scene.applyCamera(_cp, _cl);
        scene.setDoorAngle(INTRO.DOOR_OPEN * startOpen * (1 - q.k));
        onFlash(startFlash * (1 - q.k));
      },
      onComplete: finalize,
    });
  }

  return { finish, isFinished: () => finished };
}

export default runBoardingIntro;

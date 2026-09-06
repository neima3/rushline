import * as THREE from "three";
import type { Actions, BuiltTrack, CarSnap } from "./types";
import { crossedGate, nearestSample, sampleAt } from "./track";

const ACCEL = 28;
const BRAKE = 40;
const REVERSE = 16;
const MAX_SPEED = 40;
const MAX_BOOST = 56;
const MAX_REV = 14;
const DRAG = 0.26;
const COAST = 0.74;
const TURN = 2.68;
const DRIFT_TURN = 3.05;
const AIR_TURN = 1.6;
const RIDE = 0.38;
const GRAVITY = 30;
const FIXED = 1 / 60;
const LAND_LOCK = 0.14;
const STICK_SPEED = 16;
const TURBO_MINI = 0.32;
const TURBO_MID = 0.58;
const TURBO_FULL = 0.92;

const _fwd = new THREE.Vector3();
const _up = new THREE.Vector3();
const _right = new THREE.Vector3();
const _look = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _qb = new THREE.Quaternion();
const _y = new THREE.Vector3(0, 1, 0);

export class CarSim {
  s = 4;
  n = 0;
  heading = 0;
  speed = 0;
  airborne = false;
  vx = 0;
  vy = 0;
  vz = 0;
  px = 0;
  py = 1;
  pz = 0;
  qx = 0;
  qy = 0;
  qz = 0;
  qw = 1;
  yaw = 0;
  boost = 0;
  slideAmt = 0;
  driftCharge = 0;
  lastCp = -1;
  lap = 1;
  finished = false;
  wrongWay = 0;
  fx = 0;
  fy = 0;
  fz = -1;
  ux = 0;
  uy = 1;
  uz = 0;
  wallHit = 0;
  justBoost = false;
  justCp = false;
  justLap = false;
  justFinish = false;
  justTurbo = false;
  justLand = false;
  skipInterp = true;
  justRespawn = false;
  private wasSlide = false;
  private airTime = 0;
  private landLock = 0;
  private airBlend = 0;

  reset(track: BuiltTrack) {
    this.s = 6;
    this.n = 0;
    this.heading = 0;
    this.speed = 0;
    this.airborne = false;
    this.vx = this.vy = this.vz = 0;
    this.boost = 0;
    this.slideAmt = 0;
    this.driftCharge = 0;
    this.lastCp = -1;
    this.lap = 1;
    this.finished = false;
    this.wrongWay = 0;
    this.wallHit = 0;
    this.justBoost = false;
    this.justCp = false;
    this.justLap = false;
    this.justFinish = false;
    this.justTurbo = false;
    this.justLand = false;
    this.justRespawn = false;
    this.skipInterp = true;
    this.wasSlide = false;
    this.airTime = 0;
    this.landLock = 0;
    this.airBlend = 0;
    this.place(track);
  }

  respawn(track: BuiltTrack) {
    this.s = pickSafeRespawnS(track, this.lastCp);
    this.n = 0;
    this.heading = 0;
    this.speed = 9;
    this.airborne = false;
    this.vx = this.vy = this.vz = 0;
    this.boost = 0;
    this.slideAmt = 0;
    this.driftCharge = 0;
    this.wrongWay = 0;
    this.wallHit = 0;
    this.justBoost = false;
    this.justTurbo = false;
    this.justLand = false;
    this.justRespawn = true;
    this.wasSlide = false;
    this.skipInterp = true;
    this.airTime = 0;
    this.landLock = 0;
    this.airBlend = 0;
    this.place(track);
  }

  private place(track: BuiltTrack) {
    const sm = sampleAt(track, this.s);
    this.px = sm.x + sm.rx * this.n + sm.ux * RIDE;
    this.py = sm.y + sm.ry * this.n + sm.uy * RIDE;
    this.pz = sm.z + sm.rz * this.n + sm.uz * RIDE;
    this.setFrame(sm.tx, sm.ty, sm.tz, sm.ux, sm.uy, sm.uz, sm.rx, sm.ry, sm.rz);
  }

  private setFrame(tx: number, ty: number, tz: number, ux: number, uy: number, uz: number, rx: number, ry: number, rz: number) {
    const ch = Math.cos(this.heading);
    const sh = Math.sin(this.heading);
    this.fx = tx * ch - rx * sh;
    this.fy = ty * ch - ry * sh;
    this.fz = tz * ch - rz * sh;
    const fl = Math.hypot(this.fx, this.fy, this.fz) || 1;
    this.fx /= fl;
    this.fy /= fl;
    this.fz /= fl;
    this.ux = ux;
    this.uy = uy;
    this.uz = uz;
    this.yaw = Math.atan2(-this.fx, -this.fz);
    _fwd.set(this.fx, this.fy, this.fz);
    _up.set(ux, uy, uz);
    _right.crossVectors(_up, _fwd);
    if (_right.lengthSq() < 1e-8) _right.set(rx, ry, rz);
    _right.normalize();
    _up.crossVectors(_fwd, _right).normalize();
    _look.makeBasis(_right, _up, _fwd);
    _quat.setFromRotationMatrix(_look);
    this.qx = _quat.x;
    this.qy = _quat.y;
    this.qz = _quat.z;
    this.qw = _quat.w;
  }

  step(track: BuiltTrack, actions: Actions, dt: number) {
    this.justBoost = false;
    this.justCp = false;
    this.justLap = false;
    this.justFinish = false;
    this.justTurbo = false;
    this.justLand = false;
    this.justRespawn = false;
    this.wallHit = Math.max(0, this.wallHit - dt);
    this.landLock = Math.max(0, this.landLock - dt);
    const prevS = this.s;

    if (this.airborne) this.stepAir(track, actions, dt);
    else this.stepGround(track, actions, dt);

    this.detectGates(track, prevS);
    if (this.needsRecover(track)) this.respawn(track);
  }

  private needsRecover(track: BuiltTrack) {
    if (this.py < -12) return true;
    const near = nearestSample(track, this.px, this.py, this.pz, this.s);
    const dx = this.px - near.x;
    const dy = this.py - near.y;
    const dz = this.pz - near.z;
    const dist = Math.hypot(dx, dy, dz);
    const height = dx * near.ux + dy * near.uy + dz * near.uz;
    const lat = dx * near.rx + dy * near.ry + dz * near.rz;
    if (dist > 22) return true;
    if (this.airborne && this.airTime > 1.65) return true;
    if (this.airborne && height < -2.4 && this.airTime > 0.22) return true;
    if (this.airborne && Math.abs(lat) > near.width * 0.5 + 10 && this.airTime > 0.55) return true;
    if (!this.airborne && Math.abs(this.n) > near.width * 0.5 + 1.25) return true;
    if (!this.airborne && this.uy < 0.12 && near.uy > 0.55 && Math.abs(this.speed) < 14) return true;
    return false;
  }

  private releaseTurbo() {
    const boost = turboFromCharge(this.driftCharge);
    if (boost <= 0) {
      this.driftCharge = 0;
      return;
    }
    this.boost = Math.max(this.boost, boost);
    this.speed = Math.min(this.speed + 2.4 + this.driftCharge * 5.2, MAX_BOOST);
    this.justTurbo = true;
    this.driftCharge = 0;
  }

  private stepGround(track: BuiltTrack, actions: Actions, dt: number) {
    if (actions.throttle > 0) this.speed += ACCEL * actions.throttle * dt;
    if (actions.brake > 0) {
      if (this.speed > 0.4) this.speed -= BRAKE * actions.brake * dt;
      else this.speed -= REVERSE * actions.brake * dt;
    }
    const max = this.boost > 0 ? MAX_BOOST : MAX_SPEED;
    if (this.speed > max) this.speed += (max - this.speed) * Math.min(1, 7.5 * dt);
    if (this.speed < -MAX_REV) this.speed = -MAX_REV;

    const drag = actions.throttle > 0.1 ? DRAG : COAST;
    this.speed *= 1 - drag * dt;
    if (Math.abs(this.speed) < 0.12 && actions.throttle < 0.05 && actions.brake < 0.05) this.speed = 0;

    const speedAbs = Math.abs(this.speed);
    const speedNorm = Math.min(1, speedAbs / MAX_SPEED);
    const spdF = THREE.MathUtils.smoothstep(speedAbs, 0.35, 5.5);
    const speedSteer = 1 - 0.18 * speedNorm;
    const reverse = this.speed >= 0 ? 1 : -1;
    const steer = steerCurve(actions.steer);
    const steerAbs = Math.abs(steer);
    const slideHeld = actions.slide >= 0.2;
    const drifting = slideHeld && steerAbs > 0.18 && speedAbs > 8;

    if (this.wasSlide && !slideHeld) this.releaseTurbo();
    if (drifting) {
      this.driftCharge = Math.min(1, this.driftCharge + dt * (0.78 + steerAbs * 0.82));
    } else if (!slideHeld) {
      this.driftCharge *= Math.max(0, 1 - 2.4 * dt);
    }
    this.wasSlide = slideHeld;

    this.slideAmt += ((slideHeld ? 1 : 0) - this.slideAmt) * Math.min(1, 12 * dt);
    let turn = (drifting ? DRIFT_TURN : TURN) * spdF * speedSteer;
    if (slideHeld && !drifting) turn *= 1.08;
    if (actions.brake > 0.3 && this.speed > 8) turn *= 1.1;
    this.heading += steer * turn * reverse * dt;

    const align = drifting ? 0.26 : steerAbs < 0.1 ? 5.4 : 0.07;
    this.heading *= 1 - align * dt * (drifting ? 1 : 1 - steerAbs * 0.92);
    const maxYaw = drifting ? 0.76 : slideHeld ? 0.48 : 0.33;
    this.heading = clamp(this.heading, -maxYaw, maxYaw);

    this.s += this.speed * Math.cos(this.heading) * dt;
    this.n += -this.speed * Math.sin(this.heading) * dt;

    if (track.def.closed) {
      const L = track.length;
      if (this.s >= L) this.s -= L;
      if (this.s < 0) this.s += L;
    } else {
      this.s = Math.max(0, Math.min(track.length, this.s));
    }

    const sm = sampleAt(track, this.s);
    const half = sm.width * 0.5 - 0.72;
    if (this.n > half) {
      this.n = half - 0.06;
      this.heading = clamp(this.heading + 0.2, 0.08, maxYaw);
      this.speed *= 0.82;
      this.wallHit = 0.16;
    } else if (this.n < -half) {
      this.n = -half + 0.06;
      this.heading = clamp(this.heading - 0.2, -maxYaw, -0.08);
      this.speed *= 0.82;
      this.wallHit = 0.16;
    }
    this.heading = clamp(this.heading, -maxYaw, maxYaw);

    if (sm.boost && this.speed > 3) {
      if (this.boost <= 0.08) {
        this.justBoost = true;
        this.speed = Math.min(this.speed + 5, MAX_BOOST);
      }
      this.boost = Math.max(this.boost, 1.0);
    }
    if (this.boost > 0) {
      this.speed = Math.min(this.speed + 36 * dt, MAX_BOOST);
      this.boost -= dt;
    }

    const ds = this.speed * Math.cos(this.heading);
    if (ds < -6) this.wrongWay = Math.min(1, this.wrongWay + dt * 2);
    else this.wrongWay = Math.max(0, this.wrongWay - dt * 3);

    this.px = sm.x + sm.rx * this.n + sm.ux * RIDE;
    this.py = sm.y + sm.ry * this.n + sm.uy * RIDE;
    this.pz = sm.z + sm.rz * this.n + sm.uz * RIDE;
    this.setFrame(sm.tx, sm.ty, sm.tz, sm.ux, sm.uy, sm.uz, sm.rx, sm.ry, sm.rz);
    this.vx = this.fx * this.speed;
    this.vy = this.fy * this.speed;
    this.vz = this.fz * this.speed;

    if (this.landLock <= 0 && shouldLeaveTrack(this.speed, sm.uy)) {
      this.airborne = true;
      this.airTime = 0;
      this.airBlend = 0;
      this.px += sm.ux * 0.1;
      this.py += sm.uy * 0.1;
      this.pz += sm.uz * 0.1;
      if (sm.uy < 0) this.vy -= 1.6;
    }
  }

  private stepAir(track: BuiltTrack, actions: Actions, dt: number) {
    this.airTime += dt;
    const steer = steerCurve(actions.steer);
    this.heading += steer * AIR_TURN * dt;
    this.heading = clamp(this.heading, -0.7, 0.7);

    const yaw = steer * AIR_TURN * 0.55 * dt;
    if (Math.abs(yaw) > 1e-5) {
      const c = Math.cos(yaw);
      const s = Math.sin(yaw);
      const vx = this.vx * c - this.vz * s;
      const vz = this.vx * s + this.vz * c;
      this.vx = vx;
      this.vz = vz;
    }

    this.vy -= GRAVITY * dt;
    if (actions.throttle > 0) {
      this.vx += this.fx * 5 * dt;
      this.vz += this.fz * 5 * dt;
    }
    if (this.boost > 0) {
      this.vx += this.fx * 16 * dt;
      this.vz += this.fz * 16 * dt;
      this.boost -= dt;
    }
    this.px += this.vx * dt;
    this.py += this.vy * dt;
    this.pz += this.vz * dt;

    const near = nearestSample(track, this.px, this.py, this.pz, this.s);
    const relx = this.px - near.x;
    const rely = this.py - near.y;
    const relz = this.pz - near.z;
    const height = relx * near.ux + rely * near.uy + relz * near.uz;
    const lat = relx * near.rx + rely * near.ry + relz * near.rz;
    const into = this.vx * near.ux + this.vy * near.uy + this.vz * near.uz;
    const half = near.width * 0.5 + 1.35;
    const along = this.vx * near.tx + this.vy * near.ty + this.vz * near.tz;
    this.s += along * dt;
    if (track.def.closed) {
      const L = track.length;
      if (this.s >= L) this.s -= L;
      if (this.s < 0) this.s += L;
    }

    const upright = near.uy > 0.35;
    const vertical = near.uy < 0.2;
    const onFace = height < 1.15 && height > -0.35;
    const canLand =
      this.airTime > 0.055 &&
      onFace &&
      Math.abs(lat) < near.width * 0.5 + 0.85 &&
      into < 4.2 &&
      (!vertical || this.airTime < 0.55);

    if (!canLand && upright && height < 2.1 && height > -0.8 && Math.abs(lat) < half + 5.5 && this.airTime > 0.08) {
      this.airborne = false;
      this.justLand = false;
      this.landLock = LAND_LOCK;
      this.airTime = 0;
      this.airBlend = 0;
      this.s = near.s;
      this.n = clamp(lat, -near.width * 0.5 + 0.7, near.width * 0.5 - 0.7);
      const vt = this.vx * near.tx + this.vy * near.ty + this.vz * near.tz;
      this.speed = clamp(vt * 0.94, -MAX_REV, MAX_BOOST);
      this.heading = clamp(this.heading * 0.45, -0.4, 0.4);
      this.skipInterp = true;
      this.place(track);
      return;
    }

    if (canLand) {
      const impact = Math.max(0, -into);
      this.airborne = false;
      this.justLand = impact > 9;
      this.landLock = LAND_LOCK;
      this.airTime = 0;
      this.airBlend = 0;
      this.s = near.s;
      this.n = clamp(lat, -near.width * 0.5 + 0.7, near.width * 0.5 - 0.7);
      const vt = this.vx * near.tx + this.vy * near.ty + this.vz * near.tz;
      const vr = this.vx * near.rx + this.vy * near.ry + this.vz * near.rz;
      const keep = 0.988 - Math.min(0.1, impact * 0.007);
      this.speed = Math.hypot(vt, vr) * Math.sign(vt || 1) * keep;
      this.heading = Math.atan2(-vr, Math.max(0.18, Math.abs(vt)) * Math.sign(vt || 1));
      this.heading = clamp(this.heading, -0.62, 0.62);
      this.skipInterp = impact > 14;
      this.place(track);
      return;
    }

    if (this.wasSlide && actions.slide < 0.2) this.releaseTurbo();
    else if (actions.slide < 0.2) this.driftCharge *= Math.max(0, 1 - 2.4 * dt);
    this.wasSlide = actions.slide >= 0.2;

    _fwd.set(this.vx, this.vy, this.vz);
    if (_fwd.lengthSq() < 0.4) _fwd.set(this.fx, this.fy, this.fz);
    else _fwd.normalize();
    this.airBlend = Math.min(1, this.airBlend + dt * 2.6);
    const k = this.airBlend * this.airBlend;
    this.fx += (_fwd.x - this.fx) * k;
    this.fy += (_fwd.y - this.fy) * k;
    this.fz += (_fwd.z - this.fz) * k;
    const fl = Math.hypot(this.fx, this.fy, this.fz) || 1;
    this.fx /= fl;
    this.fy /= fl;
    this.fz /= fl;
    this.yaw = Math.atan2(-this.fx, -this.fz);

    _fwd.set(this.fx, this.fy, this.fz);
    _up.set(this.ux * (1 - k), this.uy * (1 - k) + k, this.uz * (1 - k));
    if (_up.lengthSq() < 1e-6) _up.copy(_y);
    _up.normalize();
    _right.crossVectors(_up, _fwd);
    if (_right.lengthSq() < 1e-8) _right.set(1, 0, 0);
    _right.normalize();
    _up.crossVectors(_fwd, _right).normalize();
    _look.makeBasis(_right, _up, _fwd);
    _quat.setFromRotationMatrix(_look);
    this.qx = _quat.x;
    this.qy = _quat.y;
    this.qz = _quat.z;
    this.qw = _quat.w;
    this.ux = _up.x;
    this.uy = _up.y;
    this.uz = _up.z;
  }

  private detectGates(track: BuiltTrack, prevS: number) {
    if (this.finished) return;
    const next = this.lastCp + 1;
    if (next < track.checkpoints.length) {
      const gate = track.checkpoints[next]!;
      if (crossedGate(prevS, this.s, gate, track.length, track.def.closed)) {
        this.lastCp = next;
        this.justCp = true;
      }
    }
    const finishS = 2.5;
    const ready = this.lastCp >= track.checkpoints.length - 1 && track.checkpoints.length > 0;
    if (ready && crossedGate(prevS, this.s, finishS, track.length, track.def.closed)) {
      if (this.lap >= track.def.laps) {
        this.finished = true;
        this.justFinish = true;
      } else {
        this.lap += 1;
        this.lastCp = -1;
        this.justLap = true;
      }
    }
  }

  snap(): CarSnap {
    return {
      s: this.s,
      n: this.n,
      heading: this.heading,
      speed: this.speed,
      airborne: this.airborne,
      px: this.px,
      py: this.py,
      pz: this.pz,
      qx: this.qx,
      qy: this.qy,
      qz: this.qz,
      qw: this.qw,
      yaw: this.yaw,
      boost: this.boost,
      slide: this.slideAmt,
      driftCharge: this.driftCharge,
      justTurbo: this.justTurbo,
      justLand: this.justLand,
      fx: this.fx,
      fy: this.fy,
      fz: this.fz,
      ux: this.ux,
      uy: this.uy,
      uz: this.uz,
    };
  }
}

export function lerpSnap(a: CarSnap, b: CarSnap, t: number): CarSnap {
  const u = clamp(t, 0, 1);
  const jump =
    (b.px - a.px) ** 2 + (b.py - a.py) ** 2 + (b.pz - a.pz) ** 2;
  if (b.airborne !== a.airborne && jump > 6) return b;
  _quat.set(a.qx, a.qy, a.qz, a.qw);
  _qb.set(b.qx, b.qy, b.qz, b.qw);
  _quat.slerp(_qb, u);
  const fx = lerp(a.fx, b.fx, u);
  const fy = lerp(a.fy, b.fy, u);
  const fz = lerp(a.fz, b.fz, u);
  const fl = Math.hypot(fx, fy, fz) || 1;
  const ux = lerp(a.ux, b.ux, u);
  const uy = lerp(a.uy, b.uy, u);
  const uz = lerp(a.uz, b.uz, u);
  const ul = Math.hypot(ux, uy, uz) || 1;
  return {
    s: lerp(a.s, b.s, u),
    n: lerp(a.n, b.n, u),
    heading: lerp(a.heading, b.heading, u),
    speed: lerp(a.speed, b.speed, u),
    airborne: b.airborne,
    px: lerp(a.px, b.px, u),
    py: lerp(a.py, b.py, u),
    pz: lerp(a.pz, b.pz, u),
    qx: _quat.x,
    qy: _quat.y,
    qz: _quat.z,
    qw: _quat.w,
    yaw: lerp(a.yaw, b.yaw, u),
    boost: lerp(a.boost, b.boost, u),
    slide: lerp(a.slide, b.slide, u),
    driftCharge: lerp(a.driftCharge, b.driftCharge, u),
    justTurbo: b.justTurbo,
    justLand: b.justLand,
    fx: fx / fl,
    fy: fy / fl,
    fz: fz / fl,
    ux: ux / ul,
    uy: uy / ul,
    uz: uz / ul,
  };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function steerCurve(x: number) {
  const s = Math.sign(x);
  const a = Math.abs(x);
  if (a < 0.04) return 0;
  return s * (a * a * 0.32 + a * 0.68);
}

export function turboFromCharge(charge: number) {
  if (charge >= TURBO_FULL) return 1.02;
  if (charge >= TURBO_MID) return 0.7;
  if (charge >= TURBO_MINI) return 0.4;
  return 0;
}

function shouldLeaveTrack(speed: number, uy: number) {
  return uy < -0.42 && speed < STICK_SPEED;
}

export function pickSafeRespawnS(track: BuiltTrack, lastCp: number) {
  const cp = lastCp >= 0 ? track.checkpoints[lastCp] : 6;
  let s = Math.max(2, (cp ?? 6) + 1.5);
  for (let i = 0; i < 48; i++) {
    const sm = sampleAt(track, s);
    if (sm.uy > 0.45) return s;
    s += 2.2;
    if (track.def.closed && s >= track.length) s -= track.length;
  }
  return Math.max(2, (cp ?? 6) + 1.5);
}

export const FIXED_DT = FIXED;
export const MAX_PHYS_STEPS = 8;

import * as THREE from "three";
import type { Actions, BuiltTrack, CarSnap } from "./types";
import { crossedGate, nearestSample, sampleAt } from "./track";

const ACCEL = 27;
const BRAKE = 38;
const REVERSE = 16;
const MAX_SPEED = 40;
const MAX_BOOST = 56;
const MAX_REV = 14;
const DRAG = 0.28;
const COAST = 0.85;
const TURN = 2.2;
const AIR_TURN = 1.35;
const RIDE = 0.38;
const STICK = 17;
const GRAVITY = 26;
const FIXED = 1 / 60;

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
  private wasSlide = false;

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
    this.skipInterp = true;
    this.wasSlide = false;
    this.place(track);
  }

  respawn(track: BuiltTrack) {
    const cp = this.lastCp >= 0 ? track.checkpoints[this.lastCp] : 6;
    this.s = Math.max(2, (cp ?? 6) + 1.5);
    this.n = 0;
    this.heading = 0;
    this.speed = 9;
    this.airborne = false;
    this.vx = this.vy = this.vz = 0;
    this.boost = 0;
    this.driftCharge = 0;
    this.justTurbo = false;
    this.justLand = false;
    this.wasSlide = false;
    this.skipInterp = true;
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
    this.wallHit = Math.max(0, this.wallHit - dt);
    const prevS = this.s;

    if (this.airborne) this.stepAir(track, actions, dt);
    else this.stepGround(track, actions, dt);

    this.detectGates(track, prevS);
    if (this.py < -40) this.respawn(track);
  }

  private stepGround(track: BuiltTrack, actions: Actions, dt: number) {
    if (actions.throttle > 0) this.speed += ACCEL * actions.throttle * dt;
    if (actions.brake > 0) {
      if (this.speed > 0.4) this.speed -= BRAKE * actions.brake * dt;
      else this.speed -= REVERSE * actions.brake * dt;
    }
    const max = this.boost > 0 ? MAX_BOOST : MAX_SPEED;
    if (this.speed > max) this.speed += (max - this.speed) * Math.min(1, 6 * dt);
    if (this.speed < -MAX_REV) this.speed = -MAX_REV;

    const drag = actions.throttle > 0.1 ? DRAG : COAST;
    this.speed *= 1 - drag * dt;
    if (Math.abs(this.speed) < 0.12 && actions.throttle < 0.05 && actions.brake < 0.05) this.speed = 0;

    const spdF = THREE.MathUtils.smoothstep(Math.abs(this.speed), 0.7, 9);
    const high = 1 - 0.5 * Math.min(1, Math.abs(this.speed) / MAX_SPEED);
    const reverse = this.speed >= 0 ? 1 : -1;
    const slideHeld = actions.slide >= 0.2;
    const drifting = slideHeld && Math.abs(actions.steer) > 0.2 && Math.abs(this.speed) > 10;

    if (this.wasSlide && !slideHeld && this.driftCharge > 0.42) {
      this.boost = Math.max(this.boost, 0.55 + this.driftCharge * 0.85);
      this.justTurbo = true;
      this.driftCharge = 0;
    }
    if (drifting) {
      this.driftCharge = Math.min(1, this.driftCharge + dt * (0.55 + Math.abs(actions.steer) * 0.7));
    } else {
      this.driftCharge *= Math.max(0, 1 - 1.8 * dt);
    }
    this.wasSlide = slideHeld;

    this.slideAmt += ((slideHeld ? 1 : 0) - this.slideAmt) * Math.min(1, 10 * dt);
    let turn = TURN * (drifting ? 1.32 : 1);
    if (actions.brake > 0.3 && this.speed > 8) turn *= 1.18;
    this.heading += actions.steer * turn * spdF * high * reverse * dt;
    const align = drifting ? 0.22 : 1.55;
    this.heading *= 1 - align * dt * (1 - Math.min(1, Math.abs(actions.steer) * 0.55));
    this.heading = Math.max(-0.95, Math.min(0.95, this.heading));

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
      this.n = half;
      this.heading += 0.18;
      this.speed *= 0.84;
      this.wallHit = 0.2;
    } else if (this.n < -half) {
      this.n = -half;
      this.heading -= 0.18;
      this.speed *= 0.84;
      this.wallHit = 0.2;
    }
    this.heading = Math.max(-0.95, Math.min(0.95, this.heading));

    if (sm.boost && this.speed > 4) {
      if (this.boost <= 0.05) this.justBoost = true;
      this.boost = Math.max(this.boost, 1.25);
    }
    if (this.boost > 0) {
      this.speed = Math.min(this.speed + 34 * dt, MAX_BOOST);
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

    if (sm.uy < -0.12 && this.speed < STICK) {
      this.airborne = true;
      this.vy -= 2;
    }
  }

  private stepAir(track: BuiltTrack, actions: Actions, dt: number) {
    this.heading += actions.steer * AIR_TURN * dt;
    this.heading = Math.max(-0.8, Math.min(0.8, this.heading));
    this.vy -= GRAVITY * dt;
    if (actions.throttle > 0) {
      this.vx += this.fx * 4 * dt;
      this.vz += this.fz * 4 * dt;
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
    const half = near.width * 0.5 + 1.6;

    if (height < 1.5 && height > -1.4 && Math.abs(lat) < half && into < 8) {
      this.airborne = false;
      if (this.vy < -7) this.justLand = true;
      this.s = near.s;
      this.n = Math.max(-near.width * 0.5 + 0.7, Math.min(near.width * 0.5 - 0.7, lat));
      const vt = this.vx * near.tx + this.vy * near.ty + this.vz * near.tz;
      const vr = this.vx * near.rx + this.vy * near.ry + this.vz * near.rz;
      this.speed = Math.hypot(vt, vr) * Math.sign(vt || 1) * 0.97;
      this.heading = Math.atan2(-vr, Math.max(0.01, vt));
      this.skipInterp = true;
      this.place(track);
      return;
    }

    if (this.wasSlide && actions.slide < 0.2 && this.driftCharge > 0.42) {
      this.boost = Math.max(this.boost, 0.55 + this.driftCharge * 0.85);
      this.justTurbo = true;
      this.driftCharge = 0;
    } else {
      this.driftCharge *= Math.max(0, 1 - 1.8 * dt);
    }
    this.wasSlide = actions.slide >= 0.2;

    _fwd.set(this.vx, this.vy, this.vz);
    if (_fwd.lengthSq() < 0.4) _fwd.set(this.fx, this.fy, this.fz);
    else _fwd.normalize();
    this.fx = _fwd.x;
    this.fy = _fwd.y;
    this.fz = _fwd.z;
    this.yaw = Math.atan2(-this.fx, -this.fz);
    _up.copy(_y);
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
    this.ux = 0;
    this.uy = 1;
    this.uz = 0;
    this.s = near.s;
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
    if (ready && crossedGate(prevS, this.s, finishS, track.length, track.def.closed) && prevS > track.length * 0.5) {
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
  if (b.airborne !== a.airborne) return b;
  _quat.set(a.qx, a.qy, a.qz, a.qw);
  _qb.set(b.qx, b.qy, b.qz, b.qw);
  _quat.slerp(_qb, t);
  return {
    s: lerp(a.s, b.s, t),
    n: lerp(a.n, b.n, t),
    heading: lerp(a.heading, b.heading, t),
    speed: lerp(a.speed, b.speed, t),
    airborne: b.airborne,
    px: lerp(a.px, b.px, t),
    py: lerp(a.py, b.py, t),
    pz: lerp(a.pz, b.pz, t),
    qx: _quat.x,
    qy: _quat.y,
    qz: _quat.z,
    qw: _quat.w,
    yaw: lerp(a.yaw, b.yaw, t),
    boost: lerp(a.boost, b.boost, t),
    slide: lerp(a.slide, b.slide, t),
    driftCharge: lerp(a.driftCharge, b.driftCharge, t),
    justTurbo: b.justTurbo,
    justLand: b.justLand,
    fx: lerp(a.fx, b.fx, t),
    fy: lerp(a.fy, b.fy, t),
    fz: lerp(a.fz, b.fz, t),
    ux: lerp(a.ux, b.ux, t),
    uy: lerp(a.uy, b.uy, t),
    uz: lerp(a.uz, b.uz, t),
  };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export const FIXED_DT = FIXED;

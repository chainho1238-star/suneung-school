// 이 파일은 캐릭터를 만들어요: 작고 단순한 "동글이" 몸, 걷는 모션, 앉는 동작, 닉네임표, 말풍선.
// 남녀 구분 없이 하나의 모양이고, 색만 바꿔요. 나중에 무료 3D 모델(GLB)로 바꿔 끼울 수 있게 따로 분리해 뒀어요.
import * as THREE from 'three';
import { floorY } from '../../shared/config.js';

const SPEED = 2.5;        // 걷는 속도 (m/초)
const TURN_SPEED = 10;    // 방향 돌리는 속도
const SIT_TIME = 0.9;     // 앉는 데 걸리는 시간(초)
const SEAT_RAISE = 0.30;  // 앉을 때 몸이 올라가는 높이
const FACE_WEST = -Math.PI / 2; // 책상 쪽(서쪽)을 바라보는 방향

function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
const ease = (t) => t * t * (3 - 2 * t);

// 글자를 그려서 머리 위에 띄우는 작은 판(스프라이트)
function makeSprite(w, h, scaleX, scaleY) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(scaleX, scaleY, 1);
  return { sprite, canvas, ctx: canvas.getContext('2d'), tex };
}

function drawNameTag(t, text, admin) {
  const { ctx, canvas, tex } = t;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = admin ? 'rgba(120,84,10,0.92)' : 'rgba(40,35,28,0.72)';
  ctx.beginPath();
  ctx.roundRect(8, 12, canvas.width - 16, canvas.height - 24, 18);
  ctx.fill();
  if (admin) {
    ctx.strokeStyle = '#ffd966';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.fillStyle = admin ? '#ffe9a6' : '#fff';
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(admin ? '👑 ' + text + ' (운영자)' : text, canvas.width / 2, canvas.height / 2 + 1);
  tex.needsUpdate = true;
}

function drawBubble(t, text, admin) {
  const { ctx, canvas, tex } = t;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const emoji = [...text].length <= 2 && !/[가-힣a-zA-Z0-9]/.test(text);
  const lines = [];
  if (emoji) lines.push(text);
  else {
    const s = text.length > 26 ? text.slice(0, 25) + '…' : text;
    for (let i = 0; i < s.length; i += 13) lines.push(s.slice(i, i + 13));
  }
  const lh = emoji ? 84 : 36;
  const bh = lines.length * lh + 28;
  const top = canvas.height - bh - 26;
  const x0 = emoji ? canvas.width / 2 - 70 : 10;
  const w = emoji ? 140 : canvas.width - 20;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.28)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = admin ? '#fff4cf' : 'rgba(255,255,255,0.97)';
  ctx.beginPath();
  ctx.roundRect(x0, top, w, bh, 26);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2 - 14, top + bh - 2);
  ctx.lineTo(canvas.width / 2, top + bh + 20);
  ctx.lineTo(canvas.width / 2 + 14, top + bh - 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 3;
  ctx.strokeStyle = admin ? '#e0b13a' : 'rgba(60,50,40,0.22)';
  ctx.beginPath();
  ctx.roundRect(x0, top, w, bh, 26);
  ctx.stroke();
  ctx.fillStyle = '#3a322a';
  ctx.font = emoji ? '64px sans-serif' : 'bold 29px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((ln, i) => ctx.fillText(ln, canvas.width / 2, top + 14 + lh / 2 + i * lh));

  tex.needsUpdate = true;
}

// 캐릭터 한 명 만들기 (내 캐릭터도, 다른 접속자도 똑같이 이걸 써요)
export function createActor(scene, nav, opts) {
  const { nickname = '', color = 0x6a8fb3, start, floor = 1 } = opts;
  const group = new THREE.Group();
  const inner = new THREE.Group(); // 걷기·앉기에 따라 위아래로 움직이는 몸 부분
  group.add(inner);

  const skin = new THREE.MeshStandardMaterial({ color: 0xf6d5b8, roughness: 0.8 });
  const shirt = new THREE.MeshStandardMaterial({ color, roughness: 0.75 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x2f2723, roughness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x241f1b, roughness: 0.9 });

  function mesh(geo, mat, x, y, z, parent = inner) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  }

  mesh(new THREE.CapsuleGeometry(0.17, 0.26, 4, 12), shirt, 0, 0.42, 0);                 // 몸
  mesh(new THREE.SphereGeometry(0.2, 20, 16), skin, 0, 0.88, 0);                        // 머리
  mesh(new THREE.SphereGeometry(0.212, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.46), hair, 0, 0.9, -0.01); // 머리카락
  mesh(new THREE.SphereGeometry(0.022, 8, 8), dark, -0.07, 0.88, 0.185);                // 눈
  mesh(new THREE.SphereGeometry(0.022, 8, 8), dark, 0.07, 0.88, 0.185);

  if (opts.cook) { // 급식 아주머니: 하얀 위생모 + 앞치마
    const white = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.8 });
    mesh(new THREE.CylinderGeometry(0.15, 0.19, 0.13, 18), white, 0, 1.05, 0);
    mesh(new THREE.BoxGeometry(0.3, 0.3, 0.02), white, 0, 0.4, 0.17);
  }

  // 식판 (급식을 받으면 손에 들어요. 먹을수록 줄어요)
  const trayG = new THREE.Group();
  trayG.position.set(0, 0.52, 0.3);
  trayG.visible = false;
  inner.add(trayG);
  const trayItems = [];
  {
    const mk = (geo, color, x, y, z) => {
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
      m.position.set(x, y, z);
      trayG.add(m);
      return m;
    };
    mk(new THREE.BoxGeometry(0.4, 0.025, 0.28), 0xb9bec4, 0, 0, 0);
    trayItems.push(mk(new THREE.CylinderGeometry(0.06, 0.05, 0.04, 14), 0xf6f1e3, -0.12, 0.03, 0.05));   // 밥
    trayItems.push(mk(new THREE.CylinderGeometry(0.06, 0.05, 0.04, 14), 0xb5572f, 0.04, 0.03, 0.06));    // 국
    trayItems.push(mk(new THREE.BoxGeometry(0.1, 0.03, 0.08), 0xc1623b, 0.13, 0.025, -0.05));            // 반찬
    mk(new THREE.BoxGeometry(0.1, 0.03, 0.08), 0xf1c84b, -0.05, 0.025, -0.07);                           // 계란말이
  }
  let trayLeft = 0;
  function setTray(n) {
    trayLeft = Math.max(0, Math.min(3, n | 0));
    trayG.visible = trayLeft > 0;
    trayItems.forEach((m, i) => { m.visible = i < trayLeft; });
  }

  // 팔 (어깨를 축으로 흔들어요)
  const armL = new THREE.Group();
  armL.position.set(-0.2, 0.6, 0);
  const armR = new THREE.Group();
  armR.position.set(0.2, 0.6, 0);
  inner.add(armL, armR);
  [armL, armR].forEach((a) => mesh(new THREE.CapsuleGeometry(0.045, 0.14, 3, 8), shirt, 0, -0.1, 0, a));

  // 발 (걸을 때 번갈아 움직여요, 앉으면 숨겨요)
  const feet = new THREE.Group();
  group.add(feet);
  const footL = mesh(new THREE.SphereGeometry(0.075, 10, 8), dark, -0.09, 0.07, 0.03, feet);
  const footR = mesh(new THREE.SphereGeometry(0.075, 10, 8), dark, 0.09, 0.07, 0.03, feet);
  footL.scale.set(1, 0.7, 1.35);
  footR.scale.set(1, 0.7, 1.35);

  // 닉네임표 + 말풍선
  const tag = makeSprite(256, 64, 0.8, 0.2);
  tag.sprite.position.set(0, 1.3, 0);
  drawNameTag(tag, nickname || ' ', opts.admin);
  group.add(tag.sprite);

  let bubble = null;
  let bubbleTimer = 0;
  function say(text) {
    if (!bubble) {
      bubble = makeSprite(512, 160, 1.7, 0.53);
      bubble.sprite.position.set(0, 1.72, 0);
      group.add(bubble.sprite);
    }
    drawBubble(bubble, text, opts.admin);
    bubble.sprite.visible = true;
    bubbleTimer = 6; // 6초 동안 보여요
  }

  // ---------- 상태 ----------
  let curFloor = floor;
  let state = 'idle'; // idle | walk | toSeat | sitting | seated
  let path = [];
  let yaw = opts.faceYaw !== undefined ? opts.faceYaw : Math.PI;
  let seat = null;
  let seatPose = 0;   // 0 = 서 있음, 1 = 앉음
  let sitT = 0;
  const sitFrom = { x: 0, z: 0 };
  let phase = 0;
  const hooks = {};   // onSitStart / onSeated / onStood

  group.position.set(start.x, floorY(curFloor), start.z);
  group.rotation.y = yaw;
  scene.add(group);

  function setFloor(f) {
    curFloor = f;
    group.position.y = floorY(f);
  }

  function moveTo(x, z) {
    if (state === 'seated' || state === 'sitting') return;
    state = 'walk';
    seat = null;
    path = nav.findPath({ x: group.position.x, z: group.position.z }, { x, z }, curFloor);
  }

  // 자리까지 걸어가서 앉아요
  function goSit(s, cb = {}) {
    Object.assign(hooks, cb);
    seat = s;
    state = 'toSeat';
    path = nav.findPath({ x: group.position.x, z: group.position.z }, { x: s.ax, z: s.az }, curFloor);
    // 이미 도착 지점이면 바로 앉기
    if (!path.length) beginSit();
  }

  // 이미 앉아 있는 상태로 바로 놓기 (나중에 들어온 사람에게 보여줄 때)
  function placeSeated(s) {
    seat = s;
    state = 'seated';
    path = [];
    seatPose = 1;
    group.position.set(s.sx, floorY(s.floor), s.sz);
    yaw = FACE_WEST;
    group.rotation.y = yaw;
    applyPose(0);
  }

  function beginSit() {
    state = 'sitting';
    sitT = 0;
    sitFrom.x = group.position.x;
    sitFrom.z = group.position.z;
    if (hooks.onSitStart) hooks.onSitStart(seat);
  }

  // 일어나서 책상 옆 통로로 나와요
  function standUp(cb = {}) {
    if (state !== 'seated' || !seat) return;
    Object.assign(hooks, cb);
    sitT = 1;
    state = 'standing';
    sitFrom.x = seat.sx;
    sitFrom.z = seat.sz;
  }

  function applyPose(moveAmt) {
    const p = ease(seatPose);
    inner.position.y = p * SEAT_RAISE + moveAmt;
    feet.visible = p < 0.5;
    const armX = -p * 1.15; // 앉으면 팔을 앞으로(책상 위)
    armL.rotation.x = armX;
    armR.rotation.x = armX;
    // 닉네임표·말풍선도 몸을 따라 올라가요
    tag.sprite.position.y = 1.3 + p * SEAT_RAISE;
    if (bubble) bubble.sprite.position.y = 1.72 + p * SEAT_RAISE;
  }

  function update(dt) {
    let moving = false;

    if ((state === 'walk' || state === 'toSeat') && path.length) {
      moving = true;
      const t = path[0];
      const dx = t.x - group.position.x;
      const dz = t.z - group.position.z;
      const dist = Math.hypot(dx, dz);
      const step = SPEED * dt;
      if (dist <= step) {
        group.position.x = t.x;
        group.position.z = t.z;
        path.shift();
      } else {
        group.position.x += (dx / dist) * step;
        group.position.z += (dz / dist) * step;
      }
      if (dist > 0.001) yaw = lerpAngle(yaw, Math.atan2(dx, dz), Math.min(1, TURN_SPEED * dt));
      if (!path.length) {
        if (state === 'toSeat') beginSit();
        else state = 'idle';
      }
    }

    if (state === 'sitting') {
      sitT = Math.min(1, sitT + dt / SIT_TIME);
      const e = ease(sitT);
      group.position.x = sitFrom.x + (seat.sx - sitFrom.x) * e;
      group.position.z = sitFrom.z + (seat.sz - sitFrom.z) * e;
      seatPose = sitT;
      yaw = lerpAngle(yaw, FACE_WEST, Math.min(1, 8 * dt));
      if (sitT >= 1) {
        state = 'seated';
        if (hooks.onSeated) hooks.onSeated(seat);
      }
    } else if (state === 'standing') {
      sitT = Math.max(0, sitT - dt / SIT_TIME);
      const e = ease(sitT);
      group.position.x = seat.ax + (seat.sx - seat.ax) * e;
      group.position.z = seat.az + (seat.sz - seat.az) * e;
      seatPose = sitT;
      if (sitT <= 0) {
        state = 'idle';
        const done = hooks.onStood;
        seat = null;
        if (done) done();
      }
    }

    // 걷는 모션
    let bob = 0;
    if (moving) {
      phase += dt * 10;
      const s = Math.sin(phase);
      bob = Math.abs(s) * 0.04;
      footL.position.z = 0.03 + s * 0.1;
      footR.position.z = 0.03 - s * 0.1;
      footL.position.y = 0.07 + Math.max(0, s) * 0.05;
      footR.position.y = 0.07 + Math.max(0, -s) * 0.05;
      if (seatPose < 0.01) {
        armL.rotation.x = -s * 0.7;
        armR.rotation.x = s * 0.7;
      }
    } else if (seatPose < 0.01) {
      const k = Math.min(1, dt * 10);
      armL.rotation.x -= armL.rotation.x * k;
      armR.rotation.x -= armR.rotation.x * k;
      footL.position.set(-0.09, 0.07, 0.03);
      footR.position.set(0.09, 0.07, 0.03);
    }
    if (trayLeft > 0 && seatPose < 0.01) { // 식판을 든 팔
      armL.rotation.x = -1.05;
      armR.rotation.x = -1.05;
    }
    if (state === 'sitting' || state === 'standing' || state === 'seated') applyPose(0);
    else {
      inner.position.y = bob;
      feet.visible = true;
    }

    group.rotation.y = yaw;

    if (bubble && bubbleTimer > 0) {
      bubbleTimer -= dt;
      if (bubbleTimer <= 0) bubble.sprite.visible = false;
    }
  }

  // 화면에서 치우고 메모리도 정리해요 (다른 사람이 나갔을 때 사용)
  function dispose() {
    scene.remove(group);
    group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (o.material.map) o.material.map.dispose();
        o.material.dispose();
      }
    });
  }

  return {
    group, update, moveTo, goSit, placeSeated, standUp, say, dispose, setFloor, setTray,
    get tray() { return trayLeft; },
    get floor() { return curFloor; },
    get state() { return state; },
    get seat() { return seat; },
    isMoving: () => path.length > 0,
    isSeated: () => state === 'seated',
    teleport(x, z) { path = []; state = 'idle'; group.position.x = x; group.position.z = z; },
  };
}

// 이 파일은 "학교 건물과 바깥 풍경"을 만들어요: 3층 × 교실 5개, 복도, 계단, 창문, 운동장·산·하늘.
// 책상·의자·사물함은 "인스턴싱"(같은 모양을 한 번에 여러 개 그리는 방법)으로 만들어서 가볍게 돌아가요.
// 지금 있는 층만 보여주고 나머지 층은 숨겨서 폰에서도 버틸 수 있게 했어요.
import * as THREE from 'three';
import {
  FLOORS, ROOMS, FLOOR_H, CORR_W, ROOM_L, ROOM_D, BW, BD, ZC, DOOR_X0, DOOR_X1,
  EXAM_DATE, roomX0, floorY,
} from '../../shared/config.js';
import { seatsOfFloor, LOUNGE, STAIR_PADS, CORRIDOR_BENCH_X, CAFE, isCafeteria } from '../../shared/layout.js';
import { SCHEDULE, virtualMinutes } from '../../shared/schedule.js';

const UNIT = new THREE.BoxGeometry(1, 1, 1); // 크기 1짜리 상자 하나를 늘려서 여러 곳에 써요

// ---------- 작은 도우미들 ----------
function canvasTex(w, h, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (draw) draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { canvas, ctx, tex };
}

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...o });

function box(g, mat, sx, sy, sz, x, y, z, { cast = false, recv = true } = {}) {
  const m = new THREE.Mesh(UNIT, mat);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = recv;
  g.add(m);
  return m;
}

function plane(g, mat, w, h, x, y, z, rotY = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z);
  m.rotation.y = rotY;
  g.add(m);
  return m;
}

// 같은 모양을 여러 위치에 한 번에 그리기
function instanced(g, geo, mat, list, { cast = true, recv = true } = {}) {
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  const d = new THREE.Object3D();
  list.forEach((it, i) => {
    d.position.set(it.x, it.y, it.z);
    d.rotation.set(0, it.ry || 0, 0);
    d.scale.set(it.sx || 1, it.sy || 1, it.sz || 1);
    d.updateMatrix();
    im.setMatrixAt(i, d.matrix);
    if (it.color !== undefined) im.setColorAt(i, new THREE.Color(it.color));
  });
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.castShadow = cast;
  im.receiveShadow = recv;
  g.add(im);
  return im;
}

// ---------- 재질(색·질감) ----------
function makeMaterials() {
  const wood = canvasTex(256, 256, (c) => {
    c.fillStyle = '#d9bb8c';
    c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 8; i++) {
      c.fillStyle = i % 2 ? 'rgba(150,110,60,0.10)' : 'rgba(255,240,200,0.10)';
      c.fillRect(i * 32, 0, 32, 256);
      c.fillStyle = 'rgba(110,80,40,0.35)';
      c.fillRect(i * 32, 0, 2, 256);
    }
    for (let j = 0; j < 4; j++) {
      c.fillStyle = 'rgba(110,80,40,0.25)';
      c.fillRect(0, j * 64 + ((j * 37) % 40), 256, 1.5);
    }
  });
  wood.tex.wrapS = wood.tex.wrapT = THREE.RepeatWrapping;
  wood.tex.repeat.set(ROOM_L / 2.4, ROOM_D / 2.4);

  const tile = canvasTex(128, 128, (c) => {
    c.fillStyle = '#e3e0d6';
    c.fillRect(0, 0, 128, 128);
    c.fillStyle = '#d6d2c6';
    c.fillRect(0, 0, 64, 64);
    c.fillRect(64, 64, 64, 64);
    c.strokeStyle = 'rgba(120,115,100,0.35)';
    c.lineWidth = 2;
    c.strokeRect(0, 0, 128, 128);
  });
  tile.tex.wrapS = tile.tex.wrapT = THREE.RepeatWrapping;
  const tileCorr = tile.tex;
  tileCorr.repeat.set(BW / 1.4, CORR_W / 1.4);
  const tileStair = tile.tex.clone();
  tileStair.needsUpdate = true;
  tileStair.repeat.set(3.2, 7);

  return {
    wall: std(0xf1ebdc),
    wallAccent: std(0xc9d8c0),
    ceiling: std(0xf8f4ea),
    light: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6e0, emissiveIntensity: 1.1 }),
    floorWood: new THREE.MeshStandardMaterial({ map: wood.tex, roughness: 0.75 }),
    floorCorr: new THREE.MeshStandardMaterial({ map: tileCorr, roughness: 0.8 }),
    floorStair: new THREE.MeshStandardMaterial({ map: tileStair, roughness: 0.8 }),
    frame: std(0xf7f7f2),
    glass: new THREE.MeshStandardMaterial({
      color: 0xbfe3ff, transparent: true, opacity: 0.16, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide,
    }),
    boardWood: std(0x9b7447),
    desk: std(0xe6cb9f),
    metal: std(0x8b9298, { metalness: 0.4, roughness: 0.5 }),
    chair: std(0x6f9c85),
    paper: std(0xffffff, { roughness: 0.95 }),
    omr: std(0xf4c9cf, { roughness: 0.95 }),
    locker: std(0xffffff),
    table: std(0xdcc7a0),
    bench: std(0x9a7b55),
    pot: std(0xb5714f),
    leaf: std(0x5c9a55),
    stair: std(0xcfc9b8),
    rail: std(0x6b6f75, { metalness: 0.3 }),
    dark: std(0x38342f),
    red: std(0xc24a3b),
    blue: std(0x6fa8d6),
    trash: std(0x7a8088),
  };
}

// 칠판 위 글씨를 다룰 때 쓰는 값
const BOARD_W = 7.0;
const BOARD_H = 1.5;
const BOARD_PX = { w: 1600, h: 343 };
const POSTIT_PX = 100;
const POSTIT_COLORS = ['#fff59d', '#ffcc80', '#f8bbd0', '#b3e5fc', '#c8e6c9'];

function wrapText(text, perLine) {
  const lines = [];
  for (let i = 0; i < text.length; i += perLine) lines.push(text.slice(i, i + perLine));
  return lines.slice(0, 6);
}

// ---------- 학교 전체 만들기 ----------
export function buildSchool(scene) {
  const M = makeMaterials();
  const root = new THREE.Group();
  scene.add(root);

  // ----- 하늘·안개·빛 -----
  scene.fog = new THREE.Fog(0xcfe4f4, 90, 560);
  scene.background = new THREE.Color(0xcfe4f4);
  buildEnvironment(root);

  const hemi = new THREE.HemisphereLight(0xffffff, 0xcfc4a8, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 70;
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);

  // ----- 모든 층이 함께 쓰는 그림판(시계·D-day·시간표) -----
  const clockTex = canvasTex(256, 256);
  const ddayTex = canvasTex(512, 320);
  drawDday(ddayTex);
  const timetableTex = canvasTex(320, 440);
  drawTimetable(timetableTex);
  const matClock = new THREE.MeshBasicMaterial({ map: clockTex.tex, transparent: true });
  const matDday = new THREE.MeshBasicMaterial({ map: ddayTex.tex });
  const matTimetable = new THREE.MeshBasicMaterial({ map: timetableTex.tex });

  const floors = [null];
  const boards = new Map();   // "2-3" -> 칠판
  const signs = [];           // 교실 문 위 표지판들
  const ctx = { M, clockTex, matClock, matDday, matTimetable, boards, signs };

  for (let f = 1; f <= FLOORS; f++) {
    const g = buildFloor(f, ctx);
    g.position.y = floorY(f);
    root.add(g);
    floors[f] = g;
  }

  function setFloor(f) {
    for (let i = 1; i <= FLOORS; i++) floors[i].visible = i === f;
  }
  setFloor(1);

  // ----- 칠판 포스트잇 다시 그리기 -----
  function drawBoard(id, postits) {
    const b = boards.get(id);
    if (!b) return;
    b.postits = postits;
    const { ctx: c, canvas } = b.tex;
    const W = canvas.width;
    const H = canvas.height;
    const grad = c.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#2f5d4d');
    grad.addColorStop(1, '#264c3f');
    c.fillStyle = grad;
    c.fillRect(0, 0, W, H);
    // 분필 가루 느낌
    c.fillStyle = 'rgba(255,255,255,0.035)';
    for (let i = 0; i < 40; i++) c.fillRect((i * 97) % W, (i * 53) % H, 160, 3);
    // 제목 줄
    c.fillStyle = '#f4f1e6';
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    c.font = 'bold 44px sans-serif';
    c.fillText(`${b.floor}층 ${b.room + 1}반 칠판`, 28, 44);
    c.textAlign = 'right';
    c.font = '26px sans-serif';
    c.fillStyle = '#d6e3d0';
    c.fillText('응원 · 공부 팁 · 일상 이야기 한 줄씩 붙여주세요 (칠판을 클릭!)', W - 28, 44);
    c.strokeStyle = 'rgba(244,241,230,0.35)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(24, 76);
    c.lineTo(W - 24, 76);
    c.stroke();

    // 포스트잇
    postits.forEach((p) => {
      const cx = p.u * W;
      const cy = p.v * H;
      const rot = ((p.id * 2654435761) % 1000) / 1000 * 0.16 - 0.08;
      c.save();
      c.translate(cx, cy);
      c.rotate(rot);
      const h = POSTIT_PX / 2;
      c.shadowColor = 'rgba(0,0,0,0.45)';
      c.shadowBlur = 10;
      c.shadowOffsetX = 3;
      c.shadowOffsetY = 5;
      const g = c.createLinearGradient(-h, -h, h, h);
      const base = POSTIT_COLORS[p.color] || POSTIT_COLORS[0];
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.12, base);
      g.addColorStop(1, base);
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(-h, -h); c.lineTo(h, -h); c.lineTo(h, h - 16); c.lineTo(h - 16, h); c.lineTo(-h, h);
      c.closePath();
      c.fill();
      c.shadowColor = 'transparent';
      c.fillStyle = 'rgba(0,0,0,0.13)'; // 접힌 모서리
      c.beginPath(); c.moveTo(h, h - 16); c.lineTo(h - 16, h); c.lineTo(h - 16, h - 16); c.closePath(); c.fill();
      c.fillStyle = '#d6453d'; // 압정
      c.beginPath(); c.arc(0, -h + 9, 6, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.7)';
      c.beginPath(); c.arc(-2, -h + 7, 2, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#3b3328';
      c.font = 'bold 15px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      const lines = wrapText(p.text, 6);
      const lh = 15;
      lines.forEach((ln, i) => c.fillText(ln, 0, (i - (lines.length - 1) / 2) * lh + 7));
      c.restore();
    });
    b.tex.tex.needsUpdate = true;
  }

  // 칠판 위 (u,v) 위치에 이미 붙은 포스트잇이 있는지 찾기
  function postitAt(id, u, v) {
    const b = boards.get(id);
    if (!b) return null;
    const W = BOARD_PX.w;
    const H = BOARD_PX.h;
    for (let i = b.postits.length - 1; i >= 0; i--) {
      const p = b.postits[i];
      if (Math.abs(u - p.u) * W < POSTIT_PX / 2 && Math.abs(v - p.v) * H < POSTIT_PX / 2) return p;
    }
    return null;
  }

  boards.forEach((b, id) => drawBoard(id, []));

  const boardMeshes = (f) => [...boards.values()].filter((b) => b.floor === f).map((b) => b.mesh);

  // ----- 매 프레임: 햇빛 따라가기, 시계, 문 위 표지판 -----
  let lastSec = -1;
  let lastSignState = '';
  function update(nowMs, ph, focus) {
    sun.target.position.set(focus.x, focus.y, focus.z);
    sun.position.set(focus.x + 7, focus.y + 15, focus.z + 9);

    const sec = Math.floor(nowMs / 1000);
    if (sec !== lastSec) {
      lastSec = sec;
      {
        const vm = virtualMinutes(ph);
        drawClock(clockTex, { getHours: () => Math.floor(vm / 60), getMinutes: () => Math.floor(vm % 60), getSeconds: () => Math.floor((vm * 60) % 60) });
      }
    }
    const state = ph.exam ? 'exam' : ph.chat ? 'break' : 'prep';
    if (state !== lastSignState) {
      lastSignState = state;
      signs.forEach((s) => drawSign(s, state));
    }
  }

  return { root, floors, setFloor, boards, boardMeshes, drawBoard, postitAt, update, BOARD_W, BOARD_H };
}

// ---------- 시계 / D-day / 시간표 그림 ----------
function drawClock(t, now) {
  const c = t.ctx;
  c.clearRect(0, 0, 256, 256);
  const cx = 128, cy = 128, R = 116;
  c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fillStyle = '#f8f4e8'; c.fill();
  c.lineWidth = 10; c.strokeStyle = '#6d6a64'; c.stroke();
  c.strokeStyle = '#4a4640'; c.lineWidth = 4;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    c.beginPath();
    c.moveTo(cx + Math.sin(a) * (R - 22), cy - Math.cos(a) * (R - 22));
    c.lineTo(cx + Math.sin(a) * (R - 10), cy - Math.cos(a) * (R - 10));
    c.stroke();
  }
  const s = now.getSeconds();
  const m = now.getMinutes() + s / 60;
  const h = (now.getHours() % 12) + m / 60;
  const hand = (frac, len, w, col) => {
    const a = frac * Math.PI * 2;
    c.lineWidth = w; c.strokeStyle = col; c.lineCap = 'round';
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.sin(a) * len, cy - Math.cos(a) * len); c.stroke();
  };
  hand(h / 12, R * 0.5, 9, '#3b3731');
  hand(m / 60, R * 0.76, 6, '#3b3731');
  hand(s / 60, R * 0.86, 3, '#b5483a');
  t.tex.needsUpdate = true;
}

function drawDday(t) {
  const c = t.ctx;
  const exam = new Date(EXAM_DATE + 'T00:00:00+09:00').getTime();
  const days = Math.ceil((exam - Date.now()) / 86400000);
  c.fillStyle = '#2f5d4d';
  c.fillRect(0, 0, 512, 320);
  c.strokeStyle = '#f4f1e6';
  c.lineWidth = 6;
  c.strokeRect(10, 10, 492, 300);
  c.fillStyle = '#f4f1e6';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = 'bold 40px sans-serif';
  c.fillText('수능까지', 256, 62);
  c.fillStyle = '#ffe27a';
  c.font = 'bold 130px sans-serif';
  c.fillText(days > 0 ? `D-${days}` : days === 0 ? 'D-DAY' : 'D+' + -days, 256, 170);
  c.fillStyle = '#d6e3d0';
  c.font = '30px sans-serif';
  c.fillText('2026.11.19 (목)  끝까지 같이 가자!', 256, 265);
  t.tex.needsUpdate = true;
}

function drawTimetable(t) {
  const c = t.ctx;
  c.fillStyle = '#fffdf3';
  c.fillRect(0, 0, 320, 440);
  c.strokeStyle = '#c24a3b';
  c.lineWidth = 6;
  c.strokeRect(5, 5, 310, 430);
  c.fillStyle = '#c24a3b';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = 'bold 32px sans-serif';
  c.fillText('오늘의 시간표', 160, 44);
  c.font = '22px sans-serif';
  c.fillStyle = '#3b3328';
  let y = 88;
  const hm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  c.font = '19px sans-serif';
  SCHEDULE.forEach((p) => {
    c.textAlign = 'left';
    c.fillStyle = p.exam ? '#b5483a' : '#3b3328';
    c.fillText(p.short, 18, y);
    c.textAlign = 'right';
    c.fillText(`${hm(p.vFrom)}~${hm(p.vTo)}`, 304, y);
    y += 37;
  });
  c.textAlign = 'center';
  c.fillStyle = '#7a6c58';
  c.font = '19px sans-serif';
  c.fillText('시험 중에는 채팅 금지!', 160, 416);
  t.tex.needsUpdate = true;
}

// 교실 문 위 표지판: 시험 중(빨강) / 쉬는 시간(초록) / 준비(주황)
function drawSign(s, state) {
  const c = s.tex.ctx;
  const bg = state === 'exam' ? '#b5483a' : state === 'break' ? '#3f8a62' : '#c58a2c';
  const label = state === 'exam' ? '시험 중 · 정숙' : state === 'break' ? '쉬는 시간' : '입실 준비';
  c.fillStyle = bg;
  c.beginPath(); c.roundRect(4, 4, 248, 120, 16); c.fill();
  c.fillStyle = '#fff';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = 'bold 44px sans-serif';
  c.fillText(s.name, 128, 44);
  c.font = '30px sans-serif';
  c.fillText(label, 128, 90);
  s.tex.tex.needsUpdate = true;
}

// ---------- 한 층 만들기 ----------
function buildFloor(f, ctx) {
  const { M } = ctx;
  const g = new THREE.Group();
  const TH = 0.24; // 벽 두께

  // 바닥: 교실마다 마룻바닥, 복도·계단실은 타일
  for (let r = 0; r < ROOMS; r++) {
    const x0 = roomX0(r);
    const fl = plane(g, M.floorWood, ROOM_L, ROOM_D, x0 + ROOM_L / 2, 0, CORR_W + ROOM_D / 2);
    fl.rotation.x = -Math.PI / 2;
    fl.receiveShadow = true;
  }
  const corr = plane(g, M.floorCorr, BW, CORR_W, BW / 2, 0, CORR_W / 2);
  corr.rotation.x = -Math.PI / 2;
  corr.receiveShadow = true;
  [2.25, BW - 2.25].forEach((x) => {
    const sp = plane(g, M.floorStair, 4.5, ROOM_D, x, 0, CORR_W + ROOM_D / 2);
    sp.rotation.x = -Math.PI / 2;
    sp.receiveShadow = true;
  });

  // 천장
  const ceil = plane(g, M.ceiling, BW, BD, BW / 2, FLOOR_H, BD / 2);
  ceil.rotation.x = Math.PI / 2;

  // ----- 벽 -----
  // 남쪽 바깥벽(교실 창문)
  const south = [];
  for (let r = 0; r < ROOMS; r++) {
    for (let k = 0; k < 4; k++) {
      const x0 = roomX0(r) + 0.56 + k * (2.3 + 0.56);
      south.push({ x0, x1: x0 + 2.3, y0: 0.9, y1: 2.5, glass: true });
    }
  }
  wallRunX(g, ctx, 0, BW, BD + TH / 2, TH, south, M.wall);

  // 북쪽 바깥벽(복도 창문)
  const north = [];
  for (let x = 1.0; x + 2.6 < BW - 1.0; x += 3.8) north.push({ x0: x, x1: x + 2.6, y0: 0.9, y1: 2.6, glass: true });
  wallRunX(g, ctx, 0, BW, -TH / 2, TH, north, M.wall);

  // 복도 쪽 벽 (교실마다 문 + 안이 들여다보이는 창)
  for (let r = 0; r < ROOMS; r++) {
    const x0 = roomX0(r);
    wallRunX(g, ctx, x0, x0 + ROOM_L, CORR_W, TH, [
      { x0: x0 + 2.0, x1: x0 + 6.8, y0: 1.0, y1: 2.3, glass: true },
      { x0: x0 + DOOR_X0, x1: x0 + DOOR_X1, y0: 0, y1: 2.1 },
    ], M.wall);
  }

  // 교실 사이 벽 + 건물 양 끝 벽
  for (let r = 0; r <= ROOMS; r++) {
    box(g, M.wall, TH, FLOOR_H, BD - CORR_W, roomX0(r), FLOOR_H / 2, (CORR_W + BD) / 2);
  }
  box(g, M.wall, TH, FLOOR_H, BD, -TH / 2, FLOOR_H / 2, BD / 2);
  box(g, M.wall, TH, FLOOR_H, BD, BW + TH / 2, FLOOR_H / 2, BD / 2);

  // ----- 천장 형광등(복도 + 교실) -----
  const lights = [];
  for (let x = 3; x < BW; x += 4.6) lights.push({ x, y: FLOOR_H - 0.03, z: CORR_W / 2, sx: 1.8, sy: 0.05, sz: 0.4 });
  for (let r = 0; r < ROOMS; r++) {
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 2; j++) {
        lights.push({ x: roomX0(r) + 2.4 + i * 4.0, y: FLOOR_H - 0.03, z: CORR_W + 3 + j * 4, sx: 1.8, sy: 0.05, sz: 0.4 });
      }
    }
  }
  instanced(g, UNIT, M.light, lights, { cast: false, recv: false });

  // ----- 책상·의자(인스턴싱) -----
  buildDesks(g, f, M);

  // ----- 교실마다 들어가는 것들 -----
  for (let r = 0; r < ROOMS; r++) {
    if (isCafeteria(f, r)) buildCafeteria(g, f, r, ctx);
    else buildClassroom(g, f, r, ctx);
  }

  // ----- 복도 -----
  buildCorridor(g, f, ctx);

  // ----- 계단실 -----
  buildStairwell(g, f, ctx, 'W');
  buildStairwell(g, f, ctx, 'E');

  return g;
}

// 벽 한 줄(x 방향)을 만들되, 창문·문 구멍은 비워 둬요
function wallRunX(g, ctx, xa, xb, z, th, openings, mat) {
  const { M } = ctx;
  const H = FLOOR_H;
  const sorted = [...openings].sort((a, b) => a.x0 - b.x0);
  const add = (x0, x1, y0, y1) => {
    if (x1 - x0 < 0.001 || y1 - y0 < 0.001) return;
    box(g, mat, x1 - x0, y1 - y0, th, (x0 + x1) / 2, (y0 + y1) / 2, z);
  };
  let cur = xa;
  for (const o of sorted) {
    add(cur, o.x0, 0, H);
    add(o.x0, o.x1, 0, o.y0);
    add(o.x0, o.x1, o.y1, H);
    cur = o.x1;
    if (o.glass) windowFrame(g, M, o, z);
  }
  add(cur, xb, 0, H);
}

// 창문: 유리 + 가는 창틀 + 가운데 살
function windowFrame(g, M, o, z) {
  const w = o.x1 - o.x0;
  const h = o.y1 - o.y0;
  const cx = (o.x0 + o.x1) / 2;
  const cy = (o.y0 + o.y1) / 2;
  const glass = plane(g, M.glass, w, h, cx, cy, z);
  glass.renderOrder = 2;
  const t = 0.05;
  box(g, M.frame, w, t, 0.1, cx, o.y0 + t / 2, z, { recv: false });
  box(g, M.frame, w, t, 0.1, cx, o.y1 - t / 2, z, { recv: false });
  box(g, M.frame, t, h, 0.1, o.x0 + t / 2, cy, z, { recv: false });
  box(g, M.frame, t, h, 0.1, o.x1 - t / 2, cy, z, { recv: false });
  box(g, M.frame, t, h, 0.08, cx, cy, z, { recv: false });
}

// 책상·의자·시험지·OMR 카드를 한 층 전체에 한 번에 배치
function buildDesks(g, f, M) {
  const seats = seatsOfFloor(f);
  const top = [], legs = [], seat = [], back = [], clegs = [], paper = [], omr = [];
  const rand = mulberry32(f * 101);
  seats.forEach((s) => {
    top.push({ x: s.cx, y: 0.74, z: s.cz });
    [[-0.25, -0.4], [0.25, -0.4], [-0.25, 0.4], [0.25, 0.4]].forEach(([dx, dz]) => legs.push({ x: s.cx + dx, y: 0.36, z: s.cz + dz }));
    seat.push({ x: s.cx + 0.62, y: 0.46, z: s.cz });
    back.push({ x: s.cx + 0.84, y: 0.68, z: s.cz });
    [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]].forEach(([dx, dz]) => clegs.push({ x: s.cx + 0.62 + dx, y: 0.22, z: s.cz + dz }));
    paper.push({ x: s.cx - 0.02, y: 0.763, z: s.cz - 0.12, ry: (rand() - 0.5) * 0.25 });
    omr.push({ x: s.cx - 0.02, y: 0.764, z: s.cz + 0.27, ry: (rand() - 0.5) * 0.25 });
  });
  const sized = (sx, sy, sz) => { const gm = new THREE.BoxGeometry(sx, sy, sz); return gm; };
  instanced(g, sized(0.6, 0.04, 0.9), M.desk, top);
  instanced(g, sized(0.04, 0.72, 0.04), M.metal, legs);
  instanced(g, sized(0.44, 0.04, 0.44), M.chair, seat);
  instanced(g, sized(0.04, 0.4, 0.44), M.chair, back);
  instanced(g, sized(0.03, 0.44, 0.03), M.metal, clegs);
  const pg = new THREE.PlaneGeometry(0.3, 0.42); pg.rotateX(-Math.PI / 2);
  const og = new THREE.PlaneGeometry(0.12, 0.32); og.rotateX(-Math.PI / 2);
  instanced(g, pg, M.paper, paper, { cast: false });
  instanced(g, og, M.omr, omr, { cast: false });
}

// 급식실: 배식대(음식 통) + 긴 식탁 3개 + 메뉴판 + 줄 서는 선 + 문 위 표지판
function buildCafeteria(g, f, r, ctx) {
  const { M } = ctx;
  const x0 = roomX0(r);
  const x1 = x0 + ROOM_L;
  const std = (color, rough = 0.6, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  const steel = std(0xb9c0c7, 0.35, 0.6);
  const topMat = std(0xe9ecee, 0.4, 0.2);
  const zc = (CAFE.counterZ0 + CAFE.counterZ1) / 2;
  const zlen = CAFE.counterZ1 - CAFE.counterZ0;

  // 배식대
  box(g, steel, 0.8, 0.9, zlen, x0 + 1.3, 0.45, zc, { cast: true });
  box(g, topMat, 0.95, 0.05, zlen + 0.1, x0 + 1.3, 0.925, zc, { cast: true });
  // 음식 통 6개 (밥·국·제육·계란말이·깍두기·샐러드)
  const foods = [0xf6f1e3, 0xb5572f, 0xc1623b, 0xf1c84b, 0xd1452f, 0x6fae5a];
  foods.forEach((c, i) => {
    const z = CAFE.counterZ0 + 0.7 + i * ((zlen - 1.4) / 5);
    box(g, steel, 0.6, 0.1, 0.9, x0 + 1.3, 0.99, z);
    box(g, std(c, 0.8), 0.52, 0.04, 0.82, x0 + 1.3, 1.04, z);
  });
  // 식판 쌓아 둔 곳
  box(g, std(0xb9bec4, 0.4, 0.5), 0.34, 0.16, 0.5, x0 + 1.55, 1.03, CAFE.counterZ1 - 0.3);
  // 투명 가림막
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(zlen - 0.2, 0.4), new THREE.MeshStandardMaterial({ color: 0xcfe8f0, transparent: true, opacity: 0.25, roughness: 0.1, side: THREE.DoubleSide }));
  glass.position.set(x0 + 1.72, 1.35, zc);
  glass.rotation.y = Math.PI / 2;
  g.add(glass);

  // 긴 식탁 3개 + 양옆 벤치
  const zt = (CAFE.tableZ0 + CAFE.tableZ1) / 2;
  const tl = CAFE.tableZ1 - CAFE.tableZ0;
  CAFE.tableX.forEach((tx) => {
    box(g, M.desk, 0.8, 0.05, tl, x0 + tx, 0.74, zt, { cast: true });
    [CAFE.tableZ0 + 0.3, zt, CAFE.tableZ1 - 0.3].forEach((z) => {
      box(g, M.metal, 0.7, 0.72, 0.05, x0 + tx, 0.36, z);
    });
    [-0.65, 0.65].forEach((dx) => {
      box(g, M.bench, 0.3, 0.05, tl, x0 + tx + dx, 0.45, zt, { cast: true });
      [CAFE.tableZ0 + 0.3, CAFE.tableZ1 - 0.3].forEach((z) => box(g, M.metal, 0.05, 0.43, 0.25, x0 + tx + dx, 0.22, z));
    });
  });

  // 줄 서는 선(노란색)
  box(g, std(0xf0c419, 0.9), 0.08, 0.01, zlen, x0 + CAFE.serveX + 0.3, 0.006, zc, { recv: false });

  // 메뉴판(서쪽 벽)
  const mt = canvasTex(768, 384);
  {
    const c = mt.ctx;
    c.fillStyle = '#fffdf3'; c.fillRect(0, 0, 768, 384);
    c.strokeStyle = '#3f8a62'; c.lineWidth = 10; c.strokeRect(8, 8, 752, 368);
    c.fillStyle = '#3f8a62'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = 'bold 54px sans-serif';
    c.fillText('🍱 오늘의 급식 (수능 응원 메뉴)', 384, 58);
    c.fillStyle = '#3b3328'; c.font = '38px sans-serif'; c.textAlign = 'left';
    ['🍚 잡곡밥    🍲 김치찌개', '🍖 제육볶음  🍳 계란말이', '🥬 깍두기    🥛 요구르트', '🍀 합격 기원 엿 1개!'].forEach((t, i) => c.fillText(t, 70, 130 + i * 58));
    c.textAlign = 'center'; c.fillStyle = '#7a6c58'; c.font = '26px sans-serif';
    c.fillText('점심시간에 줄을 서면 급식 아주머니가 식판에 담아 주세요', 384, 352);
    mt.tex.needsUpdate = true;
  }
  const menu = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.7), new THREE.MeshBasicMaterial({ map: mt.tex }));
  menu.position.set(x0 + 0.16, 2.2, zc);
  menu.rotation.y = Math.PI / 2;
  g.add(menu);

  // 문 위 표지판 + 문틀
  const st = canvasTex(256, 128);
  {
    const c = st.ctx;
    c.fillStyle = '#d9893a'; c.beginPath(); c.roundRect(4, 4, 248, 120, 16); c.fill();
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = 'bold 54px sans-serif'; c.fillText('🍱 급식실', 128, 46);
    c.font = '28px sans-serif'; c.fillText('점심시간 이용', 128, 92);
    st.tex.needsUpdate = true;
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshBasicMaterial({ map: st.tex }));
  sign.position.set(x0 + (DOOR_X0 + DOOR_X1) / 2, 2.62, CORR_W - 0.14);
  sign.rotation.y = Math.PI;
  g.add(sign);
  box(g, M.frame, 0.08, 2.1, 0.3, x0 + DOOR_X0 - 0.04, 1.05, CORR_W);
  box(g, M.frame, 0.08, 2.1, 0.3, x0 + DOOR_X1 + 0.04, 1.05, CORR_W);

  // 시계(교실과 같은 수능 시계)와 화분
  const clock = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), ctx.matClock);
  clock.position.set(x0 + 0.16, 3.05, zc);
  clock.rotation.y = Math.PI / 2;
  g.add(clock);
  [[x1 - 0.7, BD - 0.5], [x1 - 0.7, CORR_W + 0.9]].forEach(([px, pz]) => {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.4, 16), M.pot);
    pot.position.set(px, 0.2, pz);
    g.add(pot);
    const lf = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), M.leaf);
    lf.position.set(px, 0.72, pz);
    g.add(lf);
  });
  box(g, M.frame, 1.0, 0.3, 0.28, x0 + 6.0, 3.1, CORR_W + 0.26);
}

// 교실 하나: 칠판, 교탁, 시계, D-day, 시간표, 문 위 표지판, 사물함, 라운지
function buildClassroom(g, f, r, ctx) {
  const { M, boards, signs } = ctx;
  const x0 = roomX0(r);
  const x1 = x0 + ROOM_L;
  const wallX = x0 + 0.12; // 서쪽 벽(칠판 쪽)의 안쪽 면

  // ----- 칠판 (크게, 포스트잇 붙이는 판) -----
  box(g, M.boardWood, 0.06, BOARD_H + 0.14, BOARD_W + 0.14, wallX + 0.03, 1.75, ZC);
  const bt = canvasTex(BOARD_PX.w, BOARD_PX.h);
  const bm = new THREE.Mesh(new THREE.PlaneGeometry(BOARD_W, BOARD_H), new THREE.MeshBasicMaterial({ map: bt.tex }));
  bm.position.set(wallX + 0.065, 1.75, ZC);
  bm.rotation.y = Math.PI / 2; // 교실 안쪽(+x)을 바라보게
  g.add(bm);
  box(g, M.boardWood, 0.14, 0.04, BOARD_W, wallX + 0.07, 0.96, ZC);  // 분필 받침
  const id = `${f}-${r}`;
  bm.userData.boardId = id;
  boards.set(id, { id, floor: f, room: r, mesh: bm, tex: bt, postits: [] });

  // ----- 교탁 -----
  const lx = x0 + LOUNGE.lecternX;
  box(g, M.desk, 0.6, 0.95, 1.3, lx, 0.475, ZC, { cast: true });
  const slope = box(g, M.boardWood, 0.7, 0.05, 1.4, lx - 0.02, 0.98, ZC, { cast: true });
  slope.rotation.z = 0.12;
  box(g, M.dark, 0.3, 0.02, 0.2, lx - 0.02, 1.02, ZC - 0.3);           // 교탁 위 노트
  box(g, M.chair, 0.45, 0.04, 0.45, x0 + 0.65, 0.46, ZC + 1.2);       // 선생님 의자(교탁 옆)

  // ----- 칠판 위 시계, 양옆 D-day / 시간표 -----
  const clock = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), ctx.matClock);
  clock.position.set(wallX + 0.02, 3.05, ZC);
  clock.rotation.y = Math.PI / 2;
  g.add(clock);
  const dday = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.81), ctx.matDday);
  dday.position.set(wallX + 0.02, 1.9, BD - 0.75);
  dday.rotation.y = Math.PI / 2;
  g.add(dday);
  const tt = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.38), ctx.matTimetable);
  tt.position.set(wallX + 0.02, 1.8, CORR_W + 0.78);
  tt.rotation.y = Math.PI / 2;
  g.add(tt);

  // ----- 문 위 표지판(복도 쪽에서 보여요) -----
  const st = canvasTex(256, 128);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshBasicMaterial({ map: st.tex }));
  sign.position.set(x0 + (DOOR_X0 + DOOR_X1) / 2, 2.62, CORR_W - 0.14);
  sign.rotation.y = Math.PI; // 복도(북쪽)를 바라보게
  g.add(sign);
  const s = { tex: st, name: `${f}층 ${r + 1}반` };
  signs.push(s);
  drawSign(s, 'prep');

  // 문틀 + 열린 문짝
  box(g, M.frame, 0.08, 2.1, 0.3, x0 + DOOR_X0 - 0.04, 1.05, CORR_W);
  box(g, M.frame, 0.08, 2.1, 0.3, x0 + DOOR_X1 + 0.04, 1.05, CORR_W);
  const leaf = box(g, M.boardWood, 1.2, 2.05, 0.05, x0 + DOOR_X0 + 0.02, 1.03, CORR_W + 0.65);
  leaf.rotation.y = Math.PI / 2;
  leaf.position.set(x0 + DOOR_X0 + 0.02, 1.03, CORR_W + 0.64);

  // ----- 사물함(뒤쪽 벽) -----
  const lockers = [];
  const cols = [0x9fb8cc, 0xa9c4a6, 0xc9b79a, 0xb7a6c9];
  const n = 16;
  const zA = CORR_W + 0.8;
  const zB = BD - 0.2;
  const lw = (zB - zA) / n;
  for (let i = 0; i < n; i++) {
    lockers.push({ x: x1 - 0.27, y: 0.9, z: zA + lw * (i + 0.5), sx: 0.5, sy: 1.8, sz: lw - 0.03, color: cols[(i + r) % cols.length] });
  }
  instanced(g, UNIT, M.locker, lockers);

  // ----- 라운지: 둥근 탁자 + 의자 4개 + 창가 벤치 + 화분 -----
  const tx = x0 + LOUNGE.tableX;
  const tz = LOUNGE.tableZ;
  const cyl = (rt, rb, h, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 20), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  cyl(0.62, 0.62, 0.05, M.table, tx, 0.72, tz);
  cyl(0.06, 0.06, 0.7, M.metal, tx, 0.36, tz);
  cyl(0.3, 0.3, 0.03, M.metal, tx, 0.02, tz);
  const st2 = LOUNGE.stool;
  [[st2, 0], [-st2, 0], [0, st2], [0, -st2]].forEach(([dx, dz], i) => {
    cyl(0.22, 0.22, 0.05, i % 2 ? M.chair : M.blue, tx + dx, 0.45, tz + dz);
    cyl(0.04, 0.04, 0.43, M.metal, tx + dx, 0.22, tz + dz);
  });
  box(g, M.bench, LOUNGE.benchX1 - LOUNGE.benchX0, 0.07, 0.45, x0 + (LOUNGE.benchX0 + LOUNGE.benchX1) / 2, 0.45, BD - 0.3, { cast: true });
  box(g, M.metal, 0.06, 0.43, 0.4, x0 + LOUNGE.benchX0 + 0.1, 0.22, BD - 0.3);
  box(g, M.metal, 0.06, 0.43, 0.4, x0 + LOUNGE.benchX1 - 0.1, 0.22, BD - 0.3);
  [[x0 + 0.7, BD - 0.5], [x1 - 0.7, BD - 0.5]].forEach(([px, pz]) => {
    cyl(0.2, 0.15, 0.4, M.pot, px, 0.2, pz);
    const lf = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), M.leaf);
    lf.position.set(px, 0.72, pz);
    lf.castShadow = true;
    g.add(lf);
  });
  // 쓰레기통, 에어컨
  cyl(0.17, 0.14, 0.4, M.trash, x0 + 1.0, 0.2, CORR_W + 0.35);
  box(g, M.frame, 1.0, 0.3, 0.28, x0 + 5.0, 3.1, CORR_W + 0.26);
  box(g, M.frame, 1.0, 0.3, 0.28, x0 + 9.0, 3.1, BD - 0.2);
}

// 복도: 벤치, 정수기, 소화기, 응원 현수막, 반마다 응원 포스터
function buildCorridor(g, f, ctx) {
  const { M } = ctx;
  CORRIDOR_BENCH_X.forEach((x) => {
    box(g, M.bench, 1.8, 0.07, 0.45, x, 0.45, 0.48, { cast: true });
    box(g, M.metal, 0.06, 0.43, 0.4, x - 0.8, 0.22, 0.48);
    box(g, M.metal, 0.06, 0.43, 0.4, x + 0.8, 0.22, 0.48);
    box(g, M.bench, 1.8, 0.35, 0.06, x, 0.78, 0.2);
  });
  // 정수기
  box(g, M.frame, 0.5, 1.0, 0.5, 10, 0.5, 0.5, { cast: true });
  box(g, M.blue, 0.44, 0.22, 0.44, 10, 1.1, 0.5);
  // 소화기
  const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.45, 12), M.red);
  ex.position.set(22.5, 0.9, 0.2);
  g.add(ex);

  // 응원 현수막
  const banner = canvasTex(2048, 160, (c, w, h) => {
    c.fillStyle = '#c24a3b';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff';
    c.font = 'bold 84px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('수능 대박 기원  ·  끝까지 함께 가요  ·  우리 모두 합격!', w / 2, h / 2 + 4);
  });
  plane(g, new THREE.MeshBasicMaterial({ map: banner.tex }), 18, 1.4, BW / 2, 3.0, 0.14);

  // 교실마다 응원 포스터
  const slogans = ['끝까지 가자!', '너의 노력을\n믿어', '컨디션 관리\n최고!', '한 문제\n더!', '오늘의 나를\n응원해'];
  for (let r = 0; r < ROOMS; r++) {
    const p = canvasTex(256, 350, (c, w, h) => {
      c.fillStyle = ['#ffe9a8', '#cfe8ff', '#ffd0d8', '#d6f0c9', '#e6d6ff'][(r + f) % 5];
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#3b3328';
      c.font = 'bold 44px sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      const lines = slogans[(r + f) % 5].split('\n');
      lines.forEach((ln, i) => c.fillText(ln, w / 2, h / 2 + (i - (lines.length - 1) / 2) * 56));
    });
    plane(g, new THREE.MeshBasicMaterial({ map: p.tex }), 1.0, 1.37, roomX0(r) + 7.9, 1.55, CORR_W - 0.14, Math.PI);
  }
}

// 계단실: 계단 장식 + 층 표지 + 이동 표시 원
function buildStairwell(g, f, ctx, side) {
  const { M } = ctx;
  const cx = side === 'W' ? 2.25 : BW - 2.25;
  const wallX = side === 'W' ? 0.12 : BW - 0.12;
  for (let i = 0; i < 12; i++) {
    box(g, M.stair, 3.6, 0.15 * (i + 1), 0.5, cx, 0.075 * (i + 1), 7.45 + i * 0.5, { cast: true });
  }
  box(g, M.rail, 0.05, 0.9, 6, cx - 1.85, 0.9, 10.2);
  box(g, M.rail, 0.05, 0.9, 6, cx + 1.85, 0.9, 10.2);

  // 큰 층 번호
  const num = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#3f8a62';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff';
    c.font = 'bold 150px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(`${f}F`, w / 2, h / 2 + 6);
  });
  plane(g, new THREE.MeshBasicMaterial({ map: num.tex }), 1.5, 1.5, wallX, 2.0, 9.0, side === 'W' ? Math.PI / 2 : -Math.PI / 2);

  // 이동 안내판 (복도 쪽에서 보여요)
  const guide = canvasTex(512, 192, (c, w, h) => {
    c.fillStyle = '#2f4f6f';
    c.beginPath(); c.roundRect(4, 4, w - 8, h - 8, 20); c.fill();
    c.fillStyle = '#fff';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = 'bold 54px sans-serif';
    let y = h / 2;
    const lines = [];
    if (f < FLOORS) lines.push(`▲ ${f + 1}층으로`);
    if (f > 1) lines.push(`▼ ${f - 1}층으로`);
    y = h / 2 - ((lines.length - 1) * 34);
    lines.forEach((ln, i) => c.fillText(ln, w / 2, y + i * 68));
  });
  plane(g, new THREE.MeshBasicMaterial({ map: guide.tex }), 1.8, 0.675, cx, 2.55, 6.95, Math.PI);

  // 바닥의 노란 이동 표시 원
  const pad = STAIR_PADS.find((p) => (side === 'W' ? p.id === 'W' : p.id === 'E'));
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.95, 1.15, 40),
    new THREE.MeshBasicMaterial({ color: 0xffd34d, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(pad.x, 0.02, pad.z);
  g.add(ring);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.95, 40),
    new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(pad.x, 0.015, pad.z);
  g.add(disc);
}

// ---------- 건물 밖 풍경: 하늘, 운동장, 나무, 산, 구름, 맞은편 건물 ----------
function buildEnvironment(root) {
  // 하늘(위는 진한 파랑, 아래는 연한 색으로 변하는 큰 공)
  const skyGeo = new THREE.SphereGeometry(900, 24, 16);
  const col = [];
  const top = new THREE.Color(0x5ea6e6);
  const hor = new THREE.Color(0xdcecf7);
  const pos = skyGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, pos.getY(i) / 900);
    const c = hor.clone().lerp(top, Math.pow(t, 0.55));
    col.push(c.r, c.g, c.b);
  }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.position.set(BW / 2, 0, BD / 2);
  root.add(sky);

  // 잔디밭
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), std(0x8dbb6b));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(BW / 2, -0.06, BD / 2);
  ground.receiveShadow = true;
  root.add(ground);

  // 운동장(남쪽, 교실 창문 쪽)
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(96, 62), std(0xd9b98a));
  yard.rotation.x = -Math.PI / 2;
  yard.position.set(BW / 2, -0.04, BD + 8 + 31);
  yard.receiveShadow = true;
  root.add(yard);
  const line = std(0xffffff);
  const yz = BD + 8 + 31;
  [[0, 0, 60, 0.2], [0, -28, 60, 0.2], [0, 28, 60, 0.2]].forEach(([dx, dz, w, h]) => {
    box(root, line, w, 0.02, h, BW / 2 + dx, -0.02, yz + dz, { recv: false });
  });
  [-30, 0, 30].forEach((dx) => box(root, line, 0.2, 0.02, 56, BW / 2 + dx, -0.02, yz, { recv: false }));
  // 골대
  [-1, 1].forEach((s) => {
    const x = BW / 2 + s * 44;
    box(root, std(0xf2f2f2), 0.12, 2.4, 0.12, x, 1.2, yz - 3.6);
    box(root, std(0xf2f2f2), 0.12, 2.4, 0.12, x, 1.2, yz + 3.6);
    box(root, std(0xf2f2f2), 0.12, 0.12, 7.4, x, 2.4, yz);
  });

  // 맞은편 건물(체육관/후관): 창문 무늬를 반복해서 붙여요
  const facade = canvasTex(256, 128, (c, w, h) => {
    c.fillStyle = '#e9e3d2';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#8fb6d6';
    for (let i = 0; i < 4; i++) c.fillRect(10 + i * 62, 22, 44, 36);
    for (let i = 0; i < 4; i++) c.fillRect(10 + i * 62, 74, 44, 36);
  });
  facade.tex.wrapS = facade.tex.wrapT = THREE.RepeatWrapping;
  facade.tex.repeat.set(10, 3);
  const bldg = new THREE.Mesh(new THREE.BoxGeometry(80, 16, 16), new THREE.MeshStandardMaterial({ map: facade.tex, roughness: 0.9 }));
  bldg.position.set(BW / 2, 8, BD + 8 + 62 + 40);
  root.add(bldg);
  const gym = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 44, 24, 1, false, 0, Math.PI), std(0xb8c4cf));
  gym.rotation.z = Math.PI / 2;
  gym.rotation.y = Math.PI / 2;
  gym.position.set(-46, 0, BD + 36);
  root.add(gym);

  // 산
  const mtn = [0x7d9a86, 0x6e8c7a, 0x8aa58f];
  const rnd = mulberry32(11);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rnd() * 0.2;
    const R = 420 + rnd() * 140;
    const h = 70 + rnd() * 90;
    const m = new THREE.Mesh(new THREE.ConeGeometry(70 + rnd() * 60, h, 7), std(mtn[i % 3], { flatShading: true }));
    m.position.set(BW / 2 + Math.cos(a) * R, h / 2 - 2, BD / 2 + Math.sin(a) * R);
    root.add(m);
  }

  // 구름
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, fog: false });
  for (let i = 0; i < 14; i++) {
    const cg = new THREE.Group();
    const parts = 3 + Math.floor(rnd() * 3);
    for (let j = 0; j < parts; j++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(10 + rnd() * 8, 10, 8), cloudMat);
      s.position.set(j * 14 - parts * 6, rnd() * 4, rnd() * 6);
      s.scale.y = 0.55;
      cg.add(s);
    }
    const a = rnd() * Math.PI * 2;
    const R = 160 + rnd() * 380;
    cg.position.set(BW / 2 + Math.cos(a) * R, 85 + rnd() * 55, BD / 2 + Math.sin(a) * R);
    root.add(cg);
  }

  // 나무 (건물과 운동장을 피해서 주변에 심어요)
  const trunks = [];
  const crowns = [];
  let tries = 0;
  while (trunks.length < 110 && tries < 2000) {
    tries++;
    const x = BW / 2 + (rnd() - 0.5) * 300;
    const z = BD / 2 + (rnd() - 0.5) * 300;
    const inBuilding = x > -12 && x < BW + 12 && z > -10 && z < BD + 6;
    const inYard = x > BW / 2 - 52 && x < BW / 2 + 52 && z > BD + 4 && z < BD + 76;
    const inBldg = x > BW / 2 - 44 && x < BW / 2 + 44 && z > BD + 90 && z < BD + 130;
    if (inBuilding || inYard || inBldg) continue;
    const s = 0.8 + rnd() * 0.9;
    trunks.push({ x, y: 1.0 * s, z, sx: s, sy: s, sz: s });
    crowns.push({ x, y: 2.0 * s + 2.2 * s, z, sx: s, sy: s, sz: s });
  }
  instanced(root, new THREE.CylinderGeometry(0.25, 0.32, 2, 8), std(0x7a5a3a), trunks);
  instanced(root, new THREE.ConeGeometry(1.7, 4.4, 8), std(0x4f8f52), crowns);
}

// 이 파일은 "들어오는 정보 검사"를 맡아요: 누가 이상한 값을 보내도 서버가 망가지지 않게 걸러요.
import { BW, BD, FLOORS, ROOMS } from '../shared/config.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const stripControl = (s) => s.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();

// 입장할 때 받은 닉네임·색을 안전한 값으로 바꿔요
export function sanitizeJoin(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  let nickname = typeof r.nickname === 'string' ? stripControl(r.nickname).slice(0, 8) : '';
  if (!nickname) nickname = '수험생' + Math.floor(100 + Math.random() * 900);
  const color = Number.isInteger(r.color) && r.color >= 0 && r.color <= 0xffffff ? r.color : 0x6a8fb3;
  const adminCode = typeof r.adminCode === 'string' ? r.adminCode.slice(0, 64) : '';
  return { nickname, color, adminCode };
}

// 운영자인 척하는 닉네임 막기 (진짜 관리자는 관리자 코드로 입장해요)
const RESERVED = /(관리자|운영자|제작자|운영진|admin|moderator|staff)/i;
export const isReservedName = (n) => RESERVED.test(String(n).replace(/\s/g, ''));

// 좌표 검사 (숫자가 아니면 버리고, 건물 밖이면 안으로 끌어와요)
export function sanitizePoint(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const x = Number(raw.x);
  const z = Number(raw.z);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  return { x: clamp(x, 0.3, BW - 0.3), z: clamp(z, 0.3, BD - 0.3) };
}

export function sanitizeFloor(v) {
  const f = Number(v);
  return Number.isInteger(f) && f >= 1 && f <= FLOORS ? f : null;
}

// 채팅 글: 제어문자 제거, 1~80자
export function sanitizeChat(raw) {
  if (typeof raw !== 'string') return null;
  const t = stripControl(raw).slice(0, 80);
  return t.length ? t : null;
}

// 위치 표시(예: "2층 3반")
export function sanitizeLoc(raw) {
  return typeof raw === 'string' ? stripControl(raw).slice(0, 12) : '';
}

// 포스트잇 검사: 칠판 번호, 붙일 위치(0~1), 글(1~36자), 색(0~4)
export const POSTIT_MAX_LEN = 36;
export function sanitizePostit(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const m = /^(\d)-(\d)$/.exec(String(raw.board));
  if (!m) return null;
  const f = Number(m[1]);
  const r = Number(m[2]);
  if (f < 1 || f > FLOORS || r < 0 || r >= ROOMS) return null;
  const u = Number(raw.u);
  const v = Number(raw.v);
  if (!Number.isFinite(u) || !Number.isFinite(v)) return null;
  const text = typeof raw.text === 'string' ? stripControl(raw.text).slice(0, POSTIT_MAX_LEN) : '';
  if (!text) return null;
  const color = Number.isInteger(raw.color) && raw.color >= 0 && raw.color <= 4 ? raw.color : 0;
  // u: 칠판 왼쪽(0)~오른쪽(1), v: 위(0)~아래(1). 칠판 가장자리·제목 줄과 겹치지 않게 범위를 제한해요.
  return { board: `${f}-${r}`, u: clamp(u, 0.04, 0.96), v: clamp(v, 0.2, 0.86), text, color };
}

// 입장 위치: 1층 복도 가운데에 한 줄씩 나눠 세워요 (번호표 i번째 사람)
export function spawnPoint(i) {
  const col = i % 8;
  const row = Math.floor(i / 8) % 3;
  return { x: BW / 2 - 2.8 + col * 0.8, z: 1.3 + row * 0.7 };
}

// 너무 자주 보내는 것을 막는 도우미: 최소 간격(ms)이 지나야 true
export function createLimiter() {
  const last = new Map();
  return (key, gapMs) => {
    const now = Date.now();
    if (now - (last.get(key) || 0) < gapMs) return false;
    last.set(key, now);
    return true;
  };
}

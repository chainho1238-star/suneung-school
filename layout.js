// 이 파일은 "건물 설계도(좌표 계산)"예요. 그림은 그리지 않고 숫자만 계산해요.
// 좌석 위치, 책상·벽 같은 "지나갈 수 없는 구역", 계단 위치를 정해요. (화면·서버·길찾기가 같이 써요)
import {
  FLOORS, ROOMS, ROOM_L, CORR_W, BW, BD, ZC, COLS, ROWS, COL_DZ, ROW_X, SEATS_PER_ROOM,
  DOOR_X0, DOOR_X1, roomX0,
} from './config.js';

// ---------- 좌석 ----------
// 책상은 서쪽(칠판) 쪽을 바라보고, 학생은 책상의 동쪽 의자에 앉아요.
export function seatInfo(floor, room, idx) {
  const row = Math.floor(idx / COLS);
  const col = idx % COLS;
  const cx = roomX0(room) + ROW_X[row];  // 책상 가운데 x
  const cz = ZC + (col - (COLS - 1) / 2) * COL_DZ; // 책상 가운데 z
  return {
    id: `${floor}-${room}-${idx}`,
    floor, room, idx, row, col,
    cx, cz,
    sx: cx + 0.62, sz: cz,        // 앉는 자리(의자 가운데)
    ax: cx + 0.62, az: cz + 0.85, // 앉기 전에 서 있는 자리(책상 옆 통로)
  };
}

// ---------- 급식실 ----------
// 1층 맨 끝 교실(5반 자리)은 교실 대신 급식실이에요. (2·3층의 같은 자리는 평범한 교실)
export const CAFETERIA = { floor: 1, room: 4 };
export const isCafeteria = (floor, room) => floor === CAFETERIA.floor && room === CAFETERIA.room;
// 급식 받는 곳(줄 서는 곳)과 식탁 위치 (x는 급식실 서쪽 벽 기준 거리)
export const CAFE = {
  counterX0: 0.2, counterX1: 1.7,     // 배식대(벽 쪽)
  counterZ0: 4.8, counterZ1: 12.4,
  serveX: 3.2,                          // 이 x 안쪽으로 오면 급식을 받아요
  tableX: [5.4, 8.0, 10.6],             // 긴 식탁 3개 (z 방향으로 길어요)
  tableZ0: 5.6, tableZ1: 12.2,
  staffX: 0.6, staffZ: 8.6,             // 급식 아주머니 자리
};
export const cafeServeZone = (roomIdx) => {
  const x0 = roomX0(roomIdx);
  return { x0: x0 + CAFE.counterX1, x1: x0 + CAFE.serveX, z0: CAFE.counterZ0, z1: CAFE.counterZ1 };
};

// "2-3-7" 같은 좌석 이름이 올바른지 확인하고 좌석 정보로 바꿔줘요 (틀리면 null)
export function parseSeatId(id) {
  if (typeof id !== 'string') return null;
  const m = /^(\d)-(\d)-(\d{1,2})$/.exec(id);
  if (!m) return null;
  const f = Number(m[1]);
  const r = Number(m[2]);
  const i = Number(m[3]);
  if (f < 1 || f > FLOORS || r < 0 || r >= ROOMS || i < 0 || i >= SEATS_PER_ROOM) return null;
  if (isCafeteria(f, r)) return null; // 급식실에는 책상이 없어요
  return seatInfo(f, r, i);
}

export function seatsOfFloor(floor) {
  const out = [];
  for (let r = 0; r < ROOMS; r++) {
    if (isCafeteria(floor, r)) continue;
    for (let i = 0; i < SEATS_PER_ROOM; i++) out.push(seatInfo(floor, r, i));
  }
  return out;
}

// ---------- 교실 안 가구 위치 (x는 교실 서쪽 벽 기준 거리) ----------
export const LOUNGE = {
  tableX: 9.0, tableZ: 9.0,        // 둥근 탁자
  stool: 1.05,                     // 탁자에서 의자까지 거리
  benchX0: 8.2, benchX1: 10.4,     // 창가 벤치
  lockerX: 11.45,                  // 사물함 시작(뒤쪽 벽)
  lecternX: 1.3,                   // 교탁
};

// ---------- 계단 ----------
export const STAIR_PADS = [
  { id: 'W', x: 2.25, z: 5.0 },
  { id: 'E', x: BW - 2.25, z: 5.0 },
];
export const STAIR_RADIUS = 1.8;

// ---------- 길찾기용 "못 가는 구역" ----------
const rect = (minX, maxX, minZ, maxZ) => ({ minX, maxX, minZ, maxZ });

export const CORRIDOR_BENCH_X = [17, 29, 41, 53]; // 복도 벤치 x

export function getObstacles(floor = 2) {
  const out = [];

  for (let r = 0; r < ROOMS; r++) {
    const x0 = roomX0(r);
    const x1 = x0 + ROOM_L;

    if (isCafeteria(floor, r)) {
      // 급식실: 배식대 + 긴 식탁 3개 + 복도 쪽 벽
      out.push(rect(x0 + CAFE.counterX0, x0 + CAFE.counterX1, CAFE.counterZ0, CAFE.counterZ1));
      CAFE.tableX.forEach((tx) => out.push(rect(x0 + tx - 0.9, x0 + tx + 0.9, CAFE.tableZ0, CAFE.tableZ1)));
      out.push(rect(x0, x0 + DOOR_X0, CORR_W - 0.12, CORR_W + 0.12));
      out.push(rect(x0 + DOOR_X1, x1, CORR_W - 0.12, CORR_W + 0.12));
      continue;
    }

    // 책상 + 의자
    for (let i = 0; i < SEATS_PER_ROOM; i++) {
      const s = seatInfo(1, r, i);
      out.push(rect(s.cx - 0.32, s.cx + 1.0, s.cz - 0.47, s.cz + 0.47));
    }
    // 교탁
    out.push(rect(x0 + LOUNGE.lecternX - 0.4, x0 + LOUNGE.lecternX + 0.4, ZC - 0.7, ZC + 0.7));
    // 라운지 탁자 + 의자 4개
    const tx = x0 + LOUNGE.tableX;
    const tz = LOUNGE.tableZ;
    out.push(rect(tx - 0.7, tx + 0.7, tz - 0.7, tz + 0.7));
    const st = LOUNGE.stool;
    [[st, 0], [-st, 0], [0, st], [0, -st]].forEach(([dx, dz]) =>
      out.push(rect(tx + dx - 0.25, tx + dx + 0.25, tz + dz - 0.25, tz + dz + 0.25)));
    // 사물함(뒤쪽 벽)
    out.push(rect(x0 + LOUNGE.lockerX, x1, CORR_W + 0.8, BD - 0.2));
    // 창가 벤치
    out.push(rect(x0 + LOUNGE.benchX0, x0 + LOUNGE.benchX1, BD - 0.6, BD));
    // 화분
    out.push(rect(x0 + 0.4, x0 + 1.0, BD - 0.8, BD - 0.2));
    out.push(rect(x1 - 1.0, x1 - 0.4, BD - 0.8, BD - 0.2));

    // 복도 쪽 벽 (문 부분만 뚫어 둠)
    out.push(rect(x0, x0 + DOOR_X0, CORR_W - 0.12, CORR_W + 0.12));
    out.push(rect(x0 + DOOR_X1, x1, CORR_W - 0.12, CORR_W + 0.12));
  }

  // 교실 사이 벽 (맨 왼쪽·맨 오른쪽 포함 6개)
  for (let r = 0; r <= ROOMS; r++) {
    const x = roomX0(r);
    out.push(rect(x - 0.12, x + 0.12, CORR_W - 0.12, BD));
  }

  // 복도 벤치
  CORRIDOR_BENCH_X.forEach((x) => out.push(rect(x - 0.9, x + 0.9, 0.2, 0.75)));
  // 정수기
  out.push(rect(9.6, 10.4, 0.2, 0.8));
  // 계단 모양 장식 (양쪽 계단실 안쪽)
  out.push(rect(0.4, 4.1, 7.0, 13.3));
  out.push(rect(BW - 4.1, BW - 0.4, 7.0, 13.3));

  return out;
}

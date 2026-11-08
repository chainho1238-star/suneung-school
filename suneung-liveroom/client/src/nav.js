// 이 파일은 "길찾기"를 맡아요: 책상·벽을 피해서 문을 지나 목적지까지 걷는 길을 계산해요.
// 바닥을 0.2m 칸으로 나누고, 지나갈 수 없는 칸을 표시한 뒤 A*(에이스타) 방식으로 길을 찾아요.
// 모든 층의 구조가 똑같아서 길찾기 지도는 하나만 만들어 모든 층에서 같이 써요.
import { BW, BD } from '../../shared/config.js';
import { getObstacles } from '../../shared/layout.js';

const CELL = 0.2;      // 바닥을 0.2m 칸으로 나눠요
const NAV_PAD = 0.18;  // 캐릭터 몸 크기만큼 가구·벽에서 떨어져 걸어요
const WALL_PAD = 0.3;  // 바깥벽에서 떨어져 걸어요

function createGrid(floor) {
  const cols = Math.ceil(BW / CELL);
  const rows = Math.ceil(BD / CELL);
  const blocked = new Uint8Array(cols * rows); // 1이면 못 가는 칸
  const rects = getObstacles(floor);

  const colX = (c) => (c + 0.5) * CELL;
  const rowZ = (r) => (r + 0.5) * CELL;
  const toCol = (x) => Math.min(cols - 1, Math.max(0, Math.floor(x / CELL)));
  const toRow = (z) => Math.min(rows - 1, Math.max(0, Math.floor(z / CELL)));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = colX(c);
      const z = rowZ(r);
      let b = x < WALL_PAD || x > BW - WALL_PAD || z < WALL_PAD || z > BD - WALL_PAD;
      if (!b) {
        for (const q of rects) {
          if (x > q.minX - NAV_PAD && x < q.maxX + NAV_PAD && z > q.minZ - NAV_PAD && z < q.maxZ + NAV_PAD) {
            b = true;
            break;
          }
        }
      }
      blocked[r * cols + c] = b ? 1 : 0;
    }
  }

  const isFreeCell = (c, r) => c >= 0 && c < cols && r >= 0 && r < rows && !blocked[r * cols + c];
  const isFreePoint = (x, z) => isFreeCell(Math.floor(x / CELL), Math.floor(z / CELL));

  // 가장 가까운 "갈 수 있는 칸" 찾기 (책상 위를 클릭했을 때 쓰여요)
  function nearestFree(x, z) {
    const c0 = toCol(x);
    const r0 = toRow(z);
    const maxK = Math.max(cols, rows);
    for (let k = 0; k < maxK; k++) {
      let best = null;
      let bestD = Infinity;
      for (let dr = -k; dr <= k; dr++) {
        for (let dc = -k; dc <= k; dc++) {
          if (Math.max(Math.abs(dc), Math.abs(dr)) !== k) continue;
          const c = c0 + dc;
          const r = r0 + dr;
          if (!isFreeCell(c, r)) continue;
          const d = (colX(c) - x) ** 2 + (rowZ(r) - z) ** 2;
          if (d < bestD) {
            bestD = d;
            best = { c, r };
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  // 클릭한 곳이 못 가는 곳이면 가장 가까운 갈 수 있는 바닥 좌표로 바꿔줘요
  function snap(x, z) {
    if (isFreePoint(x, z)) return { x, z };
    const n = nearestFree(x, z);
    return n ? { x: colX(n.c), z: rowZ(n.r) } : { x, z };
  }

  // 두 점 사이를 직선으로 걸어도 되는지 확인
  function hasLine(a, b) {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.05));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      if (!isFreePoint(a.x + dx * t, a.z + dz * t)) return false;
    }
    return true;
  }

  // 길 찾기: 지나갈 지점들의 목록을 돌려줘요 (시작점은 빼고)
  function findPath(from, to) {
    const s = nearestFree(from.x, from.z);
    const goalPoint = snap(to.x, to.z);
    if (!s) return [];
    if (hasLine(from, goalPoint)) return [goalPoint]; // 직선으로 갈 수 있으면 끝

    const goalCell = { c: toCol(goalPoint.x), r: toRow(goalPoint.z) };
    const N = cols * rows;
    const gs = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const idx = (c, r) => r * cols + c;
    const heur = (c, r) => {
      const dx = Math.abs(c - goalCell.c);
      const dy = Math.abs(r - goalCell.r);
      return dx + dy + (1.4142 - 2) * Math.min(dx, dy);
    };

    // 가장 점수 낮은 칸을 빨리 꺼내기 위한 작은 힙
    const heap = [];
    const push = (f, i) => {
      heap.push([f, i]);
      let k = heap.length - 1;
      while (k > 0) {
        const p = (k - 1) >> 1;
        if (heap[p][0] <= heap[k][0]) break;
        [heap[p], heap[k]] = [heap[k], heap[p]];
        k = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let k = 0;
        for (;;) {
          const l = 2 * k + 1;
          const rt = l + 1;
          let m = k;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (rt < heap.length && heap[rt][0] < heap[m][0]) m = rt;
          if (m === k) break;
          [heap[m], heap[k]] = [heap[k], heap[m]];
          k = m;
        }
      }
      return top;
    };

    const si = idx(s.c, s.r);
    const gi = idx(goalCell.c, goalCell.r);
    gs[si] = 0;
    push(heur(s.c, s.r), si);
    const DIRS = [
      [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
      [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142],
    ];
    let found = false;
    while (heap.length) {
      const cur = pop()[1];
      if (closed[cur]) continue;
      closed[cur] = 1;
      if (cur === gi) { found = true; break; }
      const cc = cur % cols;
      const cr = (cur - cc) / cols;
      for (const [dc, dr, cost] of DIRS) {
        const nc = cc + dc;
        const nr = cr + dr;
        if (!isFreeCell(nc, nr)) continue;
        // 모서리를 비스듬히 스치며 지나가지 않게
        if (dc !== 0 && dr !== 0 && (!isFreeCell(cc + dc, cr) || !isFreeCell(cc, cr + dr))) continue;
        const ni = idx(nc, nr);
        if (closed[ni]) continue;
        const ng = gs[cur] + cost;
        if (ng < gs[ni]) {
          gs[ni] = ng;
          came[ni] = cur;
          push(ng + heur(nc, nr), ni);
        }
      }
    }
    if (!found) return [];

    // 거꾸로 따라가며 칸 목록 만들기
    const cells = [];
    for (let i = gi; i !== -1; i = came[i]) {
      const c = i % cols;
      cells.push({ x: colX(c), z: rowZ((i - c) / cols) });
    }
    cells.reverse(); // [시작칸, ..., 도착칸]
    const pts = [{ x: from.x, z: from.z }, ...cells.slice(1)];
    if (cells.length > 1) pts[pts.length - 1] = goalPoint;
    else pts.push(goalPoint);

    // 불필요하게 꺾이는 곳을 펴서 자연스럽게 걷게 해요
    const out = [];
    let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      while (j > i + 1 && !hasLine(pts[i], pts[j])) j--;
      out.push(pts[j]);
      i = j;
    }
    return out;
  }

  return { findPath, snap, isFreePoint };
}

// 1층(급식실이 있어요)과 2·3층은 구조가 조금 달라서 지도를 따로 만들어요
export function createNav() {
  const grids = {};
  const g = (f) => {
    const k = f === 1 ? 1 : 2;
    return grids[k] || (grids[k] = createGrid(k));
  };
  g(1);
  g(2);
  return {
    findPath: (a, b, f = 2) => g(f).findPath(a, b),
    snap: (x, z, f = 2) => g(f).snap(x, z),
    isFreePoint: (x, z, f = 2) => g(f).isFreePoint(x, z),
  };
}

// 이 파일은 "포스트잇 보관함"이에요. 칠판마다 최대 40장, 넘치면 가장 오래된 것부터 떼어내요.
// 파일(server/data/postits.json)에 저장해서 서버를 껐다 켜도 남아 있게 해요.
// (Render 무료 플랜처럼 파일이 매번 지워지는 호스팅에서는 재시작 때 사라질 수 있어요.)
import fs from 'fs';
import path from 'path';

export const MAX_PER_BOARD = 40;

export function createPostitStore(file) {
  let items = [];
  let nextId = 1;
  let timer = null;

  try {
    if (file && fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (Array.isArray(data.items)) {
        items = data.items.filter((p) => p && typeof p.id === 'number' && typeof p.text === 'string');
        nextId = items.reduce((m, p) => Math.max(m, p.id), 0) + 1;
      }
    }
  } catch (e) {
    console.log('포스트잇 파일을 읽지 못했어요(새로 시작해요):', e.message);
  }

  function save() {
    if (!file) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify({ items }), 'utf8');
      } catch (e) {
        console.log('포스트잇 저장 실패:', e.message);
      }
    }, 2000);
  }

  // 새 포스트잇 붙이기. 넘쳐서 떨어진 것들의 번호도 함께 돌려줘요.
  function add(p) {
    const item = { id: nextId++, board: p.board, u: p.u, v: p.v, text: p.text, color: p.color, at: Date.now() };
    items.push(item);
    const removed = [];
    const onBoard = items.filter((x) => x.board === p.board);
    while (onBoard.length > MAX_PER_BOARD) {
      const old = onBoard.shift();
      removed.push(old.id);
    }
    if (removed.length) items = items.filter((x) => !removed.includes(x.id));
    save();
    return { item, removed };
  }

  return { add, all: () => items };
}

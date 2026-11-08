// 이 파일은 화면 위에 뜨는 작은 부품들을 맡아요: 알림 글(토스트), 채팅창, 포스트잇 쓰기/읽기 창.

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// 잠깐 떴다 사라지는 알림
let toastTimer = 0;
export function toast(msg, ms = 2800) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), ms);
}

// ---------- 채팅 ----------
// 쉬는 시간에만 열리고, 시험 중에는 입력창이 잠겨요.
export function createChat({ onSend }) {
  const root = document.getElementById('chat');
  const log = document.getElementById('chatlog');
  const form = document.getElementById('chatform');
  const input = document.getElementById('chatinput');
  const btn = document.getElementById('chatsend');
  const head = document.getElementById('chathead');
  let open = false;
  let reason = '';

  function scroll() {
    log.scrollTop = log.scrollHeight;
  }
  function trim() {
    while (log.children.length > 80) log.removeChild(log.firstChild);
  }

  function addMessage({ nickname, text, loc, mine, admin }) {
    const d = document.createElement('div');
    d.className = 'msg' + (mine ? ' mine' : '') + (admin ? ' admin' : '');
    d.innerHTML = `<span class="loc">${esc(loc || '')}</span> <b>${admin ? '👑 ' : ''}${esc(nickname)}</b> ${esc(text)}`;
    log.appendChild(d);
    trim();
    scroll();
  }

  function addSystem(text) {
    const d = document.createElement('div');
    d.className = 'msg sys';
    d.textContent = text;
    log.appendChild(d);
    trim();
    scroll();
  }

  function setOpen(isOpen, why = '') {
    open = isOpen;
    reason = why;
    input.disabled = !isOpen;
    btn.disabled = !isOpen;
    input.placeholder = isOpen ? '쉬는 시간이에요! 팁이나 일상 이야기를 나눠요' : why || '지금은 채팅할 수 없어요';
    root.classList.toggle('locked', !isOpen);
    head.textContent = isOpen ? '💬 채팅 (열림)' : '🔒 채팅 (시험 중 닫힘)';
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const t = input.value.trim();
    if (!t) return;
    if (!open) {
      toast(reason || '지금은 채팅할 수 없어요');
      return;
    }
    onSend(t);
    input.value = '';
  });

  // 폰에서는 머리글을 눌러 접고 펼 수 있어요
  head.addEventListener('click', () => root.classList.toggle('folded'));

  setOpen(false, '입장하면 쉬는 시간에 채팅할 수 있어요');
  return { addMessage, addSystem, setOpen };
}

// ---------- 포스트잇 ----------
export const POSTIT_CSS_COLORS = ['#fff59d', '#ffcc80', '#f8bbd0', '#b3e5fc', '#c8e6c9'];

export function createPostitUI({ onSubmit }) {
  const wrap = document.getElementById('postit-write');
  const area = document.getElementById('postit-text');
  const count = document.getElementById('postit-count');
  const colorsEl = document.getElementById('postit-colors');
  const okBtn = document.getElementById('postit-ok');
  const cancelBtn = document.getElementById('postit-cancel');
  const view = document.getElementById('postit-read');
  const viewText = document.getElementById('postit-read-text');
  const viewClose = document.getElementById('postit-read-close');

  let target = null;
  let color = 0;

  POSTIT_CSS_COLORS.forEach((c, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pcolor' + (i === 0 ? ' on' : '');
    b.style.background = c;
    b.addEventListener('click', () => {
      color = i;
      [...colorsEl.children].forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      area.style.background = c;
    });
    colorsEl.appendChild(b);
  });
  area.style.background = POSTIT_CSS_COLORS[0];

  area.addEventListener('input', () => {
    count.textContent = `${area.value.length}/36`;
  });

  function openWrite(boardId, u, v) {
    target = { boardId, u, v };
    area.value = '';
    count.textContent = '0/36';
    wrap.classList.add('on');
    setTimeout(() => area.focus(), 30);
  }
  function close() {
    wrap.classList.remove('on');
    target = null;
  }
  okBtn.addEventListener('click', () => {
    const t = area.value.trim();
    if (!t || !target) return;
    onSubmit({ board: target.boardId, u: target.u, v: target.v, text: t.slice(0, 36), color });
    close();
  });
  cancelBtn.addEventListener('click', close);

  function openRead(p) {
    viewText.textContent = p.text;
    viewText.style.background = POSTIT_CSS_COLORS[p.color] || POSTIT_CSS_COLORS[0];
    view.classList.add('on');
  }
  viewClose.addEventListener('click', () => view.classList.remove('on'));
  view.addEventListener('click', (e) => {
    if (e.target === view) view.classList.remove('on');
  });

  return { openWrite, openRead, close };
}

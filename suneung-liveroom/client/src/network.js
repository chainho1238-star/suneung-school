// 이 파일은 "서버와 말하는 통로"예요.
// 서버가 있으면 Socket.io로 연결하고, 없으면(파일을 더블클릭해서 열었거나 서버가 꺼져 있으면)
// 같은 모양의 "혼자 보기" 가짜 서버를 써서 똑같이 동작하게 해요. (채팅·포스트잇도 혼자 연습 가능)
import { io } from 'socket.io-client';
import { BW, SCHOOL_NAME } from '../../shared/config.js';
import { phaseAt } from '../../shared/schedule.js';

const POSTIT_KEY = 'suneung-postits';

// ---------- 혼자 보기(서버 없음) ----------
export function createLocalNet(h) {
  let me = null;
  let items = [];
  try {
    const d = JSON.parse(localStorage.getItem(POSTIT_KEY) || '[]');
    if (Array.isArray(d)) items = d;
  } catch (e) { /* 저장소를 못 쓰는 환경이면 그냥 비어 있는 채로 시작해요 */ }
  let nextId = items.reduce((m, p) => Math.max(m, p.id || 0), 0) + 1;
  const save = () => {
    try { localStorage.setItem(POSTIT_KEY, JSON.stringify(items)); } catch (e) { /* 무시 */ }
  };
  const later = (fn) => setTimeout(fn, 0);

  return {
    available: false,
    local: true,
    join(data) {
      me = { id: 'me', nickname: data.nickname, color: data.color, x: BW / 2, z: 1.8, floor: 1, seat: null };
      later(() => h.onStatus && h.onStatus('offline'));
      later(() => h.onJoined && h.onJoined({
        me,
        school: { name: `${SCHOOL_NAME} (혼자 보기)`, count: 1, max: 1 },
        players: [],
        postits: items,
        serverNow: Date.now(),
      }));
    },
    move() {}, arrive() {}, floor() {}, stand() {}, close() {},
    emote(e) { h.onEmote && h.onEmote({ id: 'me', e }); },
    tray(n) { h.onTray && h.onTray({ id: 'me', n }); },
    sit(seatId) { later(() => h.onSitOk && h.onSitOk({ seat: seatId })); },
    chat(text, loc) {
      const ph = phaseAt(Date.now());
      if (!ph.chat) {
        h.onChatDenied && h.onChatDenied({ reason: `${ph.name} 중에는 채팅할 수 없어요. 쉬는 시간에 열려요.` });
        return;
      }
      h.onChat && h.onChat({ id: 'me', nickname: me ? me.nickname : '나', text: String(text).slice(0, 80), loc });
    },
    postit(p) {
      const item = { id: nextId++, board: p.board, u: p.u, v: p.v, text: p.text, color: p.color, at: Date.now() };
      items.push(item);
      const onBoard = items.filter((x) => x.board === p.board);
      if (onBoard.length > 40) items = items.filter((x) => x.id !== onBoard[0].id);
      save();
      h.onPostitAdded && h.onPostitAdded(item);
    },
  };
}

// ---------- 진짜 서버 ----------
export function connectNetwork(h) {
  // 파일을 더블클릭해서 연 경우(file:)에는 서버가 없으니 혼자 보기로 가요
  if (location.protocol === 'file:') return createLocalNet(h);

  // 개발 모드(npm run dev)에서는 3000번 서버로, 서버가 화면을 직접 보여줄 때는 같은 주소로 연결해요
  const isDev = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;
  const socket = isDev ? io(`${location.protocol}//${location.hostname}:3000`) : io();

  let lastJoin = null; // 연결이 끊겼다 다시 붙으면 자동으로 다시 입장해요

  socket.on('connect', () => {
    h.onStatus && h.onStatus('online');
    if (lastJoin) socket.emit('join', lastJoin);
  });
  socket.on('disconnect', () => h.onStatus && h.onStatus('offline'));
  socket.on('connect_error', () => h.onStatus && h.onStatus('offline'));

  const forward = {
    joined: 'onJoined', player_joined: 'onPlayerJoined', player_move: 'onPlayerMove', player_floor: 'onPlayerFloor',
    player_left: 'onPlayerLeft', school_info: 'onSchoolInfo', emote: 'onEmote', tray: 'onTray', sit_ok: 'onSitOk', sit_denied: 'onSitDenied',
    player_sat: 'onPlayerSat', player_stood: 'onPlayerStood', chat: 'onChat', chat_denied: 'onChatDenied',
    postit_added: 'onPostitAdded', postit_removed: 'onPostitRemoved', postit_denied: 'onPostitDenied',
  };
  Object.entries(forward).forEach(([ev, fn]) => socket.on(ev, (d) => h[fn] && h[fn](d)));

  return {
    available: true,
    local: false,
    join(data) { lastJoin = data; socket.emit('join', data); },
    move(x, z, floor) { socket.emit('move', { x, z, floor }); },
    arrive(x, z, floor) { socket.emit('arrive', { x, z, floor }); },
    floor(floor, x, z) { socket.emit('floor', { floor, x, z }); },
    sit(seatId) { socket.emit('sit', seatId); },
    stand() { socket.emit('stand'); },
    chat(text, loc) { socket.emit('chat', { text, loc }); },
    emote(e) { socket.emit('emote', e); },
    tray(n) { socket.emit('tray', n); },
    postit(p) { socket.emit('postit', p); },
    close() { lastJoin = null; socket.disconnect(); },
  };
}

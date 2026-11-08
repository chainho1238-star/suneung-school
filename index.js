// 이 파일은 "건물 관리 사무실"(서버)의 시작점이에요.
// 하는 일: ① 화면 파일(client/dist)을 손님에게 보여주기 ② 실시간 통로(Socket.io)로 입장·이동·층 이동·착석·채팅·포스트잇을 서로에게 알려주기
// ③ 채팅은 시간표에서 "쉬는 시간"일 때만 허용하기
import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import { createSchoolManager } from './schools.js';
import { createPostitStore } from './postits.js';
import {
  sanitizeJoin, isReservedName, sanitizePoint, sanitizeFloor, sanitizeChat, sanitizeLoc, sanitizePostit,
  spawnPoint, createLimiter,
} from './validate.js';
import { parseSeatId } from '../shared/layout.js';
import { phaseAt } from '../shared/schedule.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'client', 'dist');

const app = express();
app.use(cors());
app.get('/health', (req, res) => res.send('서버 정상 작동 중'));

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir)); // 주소 하나로 사이트 + 실시간 기능이 같이 돌아가요
} else {
  app.get('/', (req, res) => {
    res.send('서버 정상 작동 중 (화면 파일이 아직 없어요: client 폴더에서 npm run build 를 먼저 하세요)');
  });
}

const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' }, maxHttpBufferSize: 20_000 });

const schools = createSchoolManager();
const postits = createPostitStore(path.join(__dirname, 'data', 'postits.json'));
const allow = createLimiter();
// 관리자(사이트 만든 사람) 입장 코드. 배포할 때는 환경변수 ADMIN_CODE 로 꼭 바꾸세요!
const ADMIN_CODE = process.env.ADMIN_CODE || 'suneung-owner-2026';
const ADMIN_NAME = process.env.ADMIN_NAME || '제작자';

// 다른 사람에게 보내도 되는 정보만 골라요
const pub = (p) => ({ id: p.id, nickname: p.nickname, color: p.color, x: p.x, z: p.z, floor: p.floor, seat: p.seat, admin: !!p.admin, tray: p.tray || 0 });
const schoolInfo = (s) => ({ id: s.id, name: s.name, count: s.players.size, max: s.max });

io.on('connection', (socket) => {
  let me = null; // 입장 전에는 null

  socket.on('join', (raw) => {
    if (me) return;
    const info = sanitizeJoin(raw);
    const isAdmin = info.adminCode !== '' && info.adminCode === ADMIN_CODE;
    if (!isAdmin && isReservedName(info.nickname)) info.nickname = '수험생' + Math.floor(100 + Math.random() * 900);
    if (isAdmin) info.nickname = ADMIN_NAME;
    me = { id: socket.id, nickname: info.nickname, color: isAdmin ? 0xe0b13a : info.color, floor: 1, x: 0, z: 0, seat: null, admin: isAdmin };
    const s = schools.addPlayer(me);
    const spot = spawnPoint(s.spawnCounter++);
    me.x = spot.x;
    me.z = spot.z;
    socket.join(s.id);

    socket.emit('joined', {
      me: pub(me),
      school: schoolInfo(s),
      players: schools.playersIn(s).filter((p) => p.id !== me.id).map(pub),
      postits: postits.all(),
      serverNow: Date.now(), // 모두의 시계를 맞추기 위한 서버 시각
    });
    socket.to(s.id).emit('player_joined', pub(me));
    io.to(s.id).emit('school_info', schoolInfo(s));
    console.log(`입장: ${me.admin ? '[관리자] ' : ''}${me.nickname} -> ${s.name} (${s.players.size}/${s.max})`);
  });

  // 이동: 목적지 좌표 한 번만 보내요
  socket.on('move', (raw) => {
    if (!me || me.seat) return;
    if (!allow(socket.id + ':move', 80)) return;
    const p = sanitizePoint(raw);
    const f = sanitizeFloor(raw && raw.floor);
    if (!p || !f) return;
    me.x = p.x;
    me.z = p.z;
    me.floor = f;
    const s = schools.getSchoolOf(me.id);
    if (s) socket.to(s.id).emit('player_move', { id: me.id, x: p.x, z: p.z, floor: f });
  });

  // 도착: 실제로 멈춘 위치를 기억해요 (나중에 들어온 사람에게 보여주려고)
  socket.on('arrive', (raw) => {
    if (!me || me.seat) return;
    const p = sanitizePoint(raw);
    const f = sanitizeFloor(raw && raw.floor);
    if (!p || !f) return;
    me.x = p.x;
    me.z = p.z;
    me.floor = f;
  });

  // 계단으로 층 이동
  socket.on('floor', (raw) => {
    if (!me || me.seat) return;
    if (!allow(socket.id + ':floor', 400)) return;
    const p = sanitizePoint(raw);
    const f = sanitizeFloor(raw && raw.floor);
    if (!p || !f) return;
    me.x = p.x;
    me.z = p.z;
    me.floor = f;
    const s = schools.getSchoolOf(me.id);
    if (s) socket.to(s.id).emit('player_floor', { id: me.id, x: p.x, z: p.z, floor: f });
  });

  // 자리 앉기 요청: 비어 있으면 허락
  socket.on('sit', (seatId) => {
    if (!me) return;
    if (!allow(socket.id + ':sit', 300)) return;
    const seat = parseSeatId(seatId);
    if (!seat) return;
    const s = schools.getSchoolOf(me.id);
    if (!s) return;
    if (!schools.claimSeat(me, seat.id)) {
      socket.emit('sit_denied', { seat: seat.id });
      return;
    }
    me.floor = seat.floor;
    socket.emit('sit_ok', { seat: seat.id });
    socket.to(s.id).emit('player_sat', { id: me.id, seat: seat.id });
  });

  socket.on('stand', () => {
    if (!me) return;
    const s = schools.getSchoolOf(me.id);
    const old = schools.releaseSeat(me);
    if (old && s) {
      const seat = parseSeatId(old);
      if (seat) { me.x = seat.ax; me.z = seat.az; }
      socket.to(s.id).emit('player_stood', { id: me.id });
    }
  });

  // 채팅: 시간표에서 chat이 열린 구간(쉬는 시간·자유 시간)에만 허용해요
  socket.on('chat', (data) => {
    if (!me) return;
    const s = schools.getSchoolOf(me.id);
    if (!s) return;
    const ph = phaseAt(Date.now());
    if (!ph.chat) {
      socket.emit('chat_denied', { reason: `${ph.name} 중에는 채팅할 수 없어요. 쉬는 시간에 열려요.` });
      return;
    }
    if (!allow(socket.id + ':chat', 1200)) return;
    const text = sanitizeChat(data && data.text);
    if (!text) return;
    io.to(s.id).emit('chat', { id: me.id, nickname: me.nickname, text, loc: sanitizeLoc(data && data.loc), admin: !!me.admin });
  });

  // 이모티콘: 글자가 아니라서 시험 중에도 보낼 수 있어요 (머리 위에 잠깐 떠요)
  socket.on('emote', (e) => {
    if (!me) return;
    if (!allow(socket.id + ':emote', 1500)) return;
    const n = Number(e);
    if (!Number.isInteger(n) || n < 0 || n > 9) return;
    const s = schools.getSchoolOf(me.id);
    if (s) io.to(s.id).emit('emote', { id: me.id, e: n });
  });

  // 급식 식판 (0=없음, 1~3=남은 양). 급식실 근처에서만 받을 수 있게 하는 검사는 화면 쪽에서 해요.
  socket.on('tray', (raw) => {
    if (!me) return;
    if (!allow(socket.id + ':tray', 400)) return;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > 3) return;
    me.tray = n;
    const s = schools.getSchoolOf(me.id);
    if (s) io.to(s.id).emit('tray', { id: me.id, n });
  });

  // 포스트잇 붙이기 (칠판은 모든 건물이 함께 써요)
  socket.on('postit', (raw) => {
    if (!me) return;
    if (!allow(socket.id + ':postit', 8000)) {
      socket.emit('postit_denied', { reason: '포스트잇은 8초에 한 장씩 붙일 수 있어요.' });
      return;
    }
    const p = sanitizePostit(raw);
    if (!p) return;
    const { item, removed } = postits.add(p);
    io.emit('postit_added', item);
    removed.forEach((id) => io.emit('postit_removed', { id }));
  });

  socket.on('disconnect', () => {
    if (!me) return;
    const r = schools.removePlayer(me.id);
    if (r) {
      io.to(r.school.id).emit('player_left', { id: me.id });
      io.to(r.school.id).emit('school_info', schoolInfo(r.school));
      console.log(`퇴장: ${me.nickname} <- ${r.school.name} (${r.school.players.size}/${r.school.max})`);
    }
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 켜졌어요`);
});

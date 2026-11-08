// 이 파일은 3D 학교를 "켜는 시작점"이에요. 모든 부품을 이어 붙여요:
// 입장 화면 → 내 캐릭터 → 클릭 이동 → 계단으로 층 이동 → 책상 클릭하면 앉기(3인칭→1인칭) → 시험/OMR
// → 쉬는 시간 채팅 → 칠판 포스트잇 → 다른 접속자 실시간 표시
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FLOORS, ROOM_L, CORR_W, BW, BD, STAIR_W, ZC, floorY, roomX0 } from '../../shared/config.js';
import { seatsOfFloor, STAIR_PADS, STAIR_RADIUS, parseSeatId, CAFE, cafeServeZone } from '../../shared/layout.js';
import { SESSION_NAMES, phaseAt, secondsToNextExam, virtualMinutes, fmtClock } from '../../shared/schedule.js';
import { buildSchool } from './world.js';
import { createNav } from './nav.js';
import { createActor } from './character.js';
import { connectNetwork, createLocalNet } from './network.js';
import { createAudio } from './audio.js';
import { createExam } from './exam.js';
import { toast, createChat, createPostitUI } from './ui.js';

const $ = (id) => document.getElementById(id);
// 오류가 나도 화면이 멈춘 채로 있지 않게, 작은 빨간 상자로 알려줘요 (캡처해서 보내주세요)
function showError(e) {
  console.error(e);
  const box = $('errbox');
  if (!box) return;
  box.style.display = 'block';
  box.textContent = '⚠ 오류: ' + (e && (e.stack || e.message) || e).toString().slice(0, 600);
}
window.addEventListener('error', (ev) => showError(ev.error || ev.message));
window.addEventListener('unhandledrejection', (ev) => showError(ev.reason));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const ease = (t) => t * t * (3 - 2 * t);
const mmss = (s) => {
  s = Math.max(0, Math.ceil(s));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

// ---------- 화면(렌더러)·장면·카메라 ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 폰에서 너무 무거워지지 않게 제한
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1500);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 2.2;
controls.maxDistance = 6.5;
controls.maxPolarAngle = Math.PI * 0.48;
controls.enabled = false; // 입장하기 전에는 배경만 보여줘요

const school = buildSchool(scene);
const nav = createNav();
const audio = createAudio();

// 입장 화면 뒤에 보이는 배경 시점: 1층 3반 뒤쪽에서 칠판을 바라봐요
const BACK_POS = new THREE.Vector3(roomX0(2) + 10.5, 1.9, 8.2);
const BACK_LOOK = new THREE.Vector3(roomX0(2) + 1, 1.7, 8.2);
camera.position.copy(BACK_POS);
camera.lookAt(BACK_LOOK);

// ---------- 상태 ----------
let net = null;
let myId = null;
let myInfo = null;
let player = null;
let currentFloor = 1;
let timeOffset = 0; // 서버 시계와 내 시계의 차이(모두의 시간표를 맞추려고)
const nowMs = () => Date.now() + timeOffset;

const remotes = new Map();    // 접속자 id -> { actor, seatId, pendingStand }
const occupied = new Map();   // 좌석 이름 -> 앉은 사람 id
const postitsByBoard = new Map();
let schoolText = SCHOOL_TEXT_DEFAULT();
function SCHOOL_TEXT_DEFAULT() { return ''; }

let pendingSeat = null; // 앉으러 가는 중인 자리
let mySeat = null;      // 지금 앉아 있는(또는 앉는 중인) 자리
let seated = false;     // 완전히 앉은 상태
let lastPhase = null;
let fallbackTimer = 0;
let fading = false;

const floorSeats = {};
for (let f = 1; f <= FLOORS; f++) floorSeats[f] = seatsOfFloor(f);

// 위치 이름(채팅에 붙여요)
function locLabel(f, x, z) {
  if (x < STAIR_W || x > BW - STAIR_W) return `${f}층 계단`;
  if (z < CORR_W) return `${f}층 복도`;
  const r = Math.floor((x - STAIR_W) / ROOM_L);
  if (f === 1 && r === 4) return '1층 급식실';
  return `${f}층 ${r + 1}반`;
}

// ---------- 채팅·포스트잇·시험 부품 ----------
const chat = createChat({
  onSend: (t) => {
    if (!net || !player) return;
    const p = player.group.position;
    net.chat(t, locLabel(currentFloor, p.x, p.z));
  },
});
const postitUI = createPostitUI({ onSubmit: (p) => net && net.postit(p) });
const exam = createExam({ onMark: () => audio.pencil() });

// ---------- 서버에서 오는 소식 처리 ----------
function addRemote(p) {
  if (remotes.has(p.id)) return;
  const actor = createActor(scene, nav, {
    nickname: p.nickname, color: p.color, start: { x: p.x, z: p.z }, floor: p.floor || 1, admin: !!p.admin,
  });
  const r = { actor, seatId: null, pendingStand: false };
  remotes.set(p.id, r);
  if (p.tray) actor.setTray(p.tray);
  if (p.seat) {
    const s = parseSeatId(p.seat);
    if (s) {
      actor.setFloor(s.floor);
      actor.placeSeated(s);
      r.seatId = p.seat;
      occupied.set(p.seat, p.id);
    }
  }
}

function removeRemote(id) {
  const r = remotes.get(id);
  if (!r) return;
  if (r.seatId && occupied.get(r.seatId) === id) occupied.delete(r.seatId);
  r.actor.dispose();
  remotes.delete(id);
}

function addPostit(p) {
  const l = postitsByBoard.get(p.board) || [];
  l.push(p);
  postitsByBoard.set(p.board, l);
  school.drawBoard(p.board, l);
}

const handlers = {
  onStatus: () => {},
  onJoined: ({ me, school: s, players, postits, serverNow }) => {
    clearTimeout(fallbackTimer);
    timeOffset = serverNow - Date.now();
    [...remotes.keys()].forEach(removeRemote);
    occupied.clear();
    players.forEach(addRemote);
    schoolText = `${s.name}${s.max > 1 ? ` ${s.count}/${s.max}명` : ''}`;
    postitsByBoard.clear();
    (postits || []).forEach((p) => {
      const l = postitsByBoard.get(p.board) || [];
      l.push(p);
      postitsByBoard.set(p.board, l);
    });
    postitsByBoard.forEach((l, id) => school.drawBoard(id, l));
    if (!player) startPlayer(me);
    else net.arrive(player.group.position.x, player.group.position.z, currentFloor); // 끊겼다 다시 연결된 경우
  },
  onSchoolInfo: (s) => { schoolText = `${s.name} ${s.count}/${s.max}명`; },
  onPlayerJoined: addRemote,
  onPlayerMove: ({ id, x, z, floor }) => {
    const r = remotes.get(id);
    if (!r) return;
    if (r.actor.floor !== floor) r.actor.setFloor(floor);
    r.actor.moveTo(x, z);
  },
  onPlayerFloor: ({ id, x, z, floor }) => {
    const r = remotes.get(id);
    if (!r) return;
    r.actor.setFloor(floor);
    r.actor.teleport(x, z);
  },
  onPlayerLeft: ({ id }) => removeRemote(id),
  onPlayerSat: ({ id, seat }) => {
    const r = remotes.get(id);
    const s = parseSeatId(seat);
    if (!r || !s) return;
    r.seatId = seat;
    r.pendingStand = false;
    occupied.set(seat, id);
    r.actor.setFloor(s.floor);
    r.actor.goSit(s);
  },
  onPlayerStood: ({ id }) => {
    const r = remotes.get(id);
    if (!r) return;
    if (r.seatId && occupied.get(r.seatId) === id) occupied.delete(r.seatId);
    const st = r.actor.state;
    if (st === 'seated') r.actor.standUp();
    else if (st === 'toSeat' && r.actor.seat) r.actor.moveTo(r.actor.seat.ax, r.actor.seat.az);
    else if (st === 'sitting') r.pendingStand = true; // 앉는 동작이 끝나면 일어나요
    r.seatId = null;
  },
  onSitOk: ({ seat }) => {
    if (mySeat && mySeat.id === seat) return; // 이미 앉는 중이면 중복 응답은 무시
    if (!pendingSeat || pendingSeat.id !== seat) {
      if (net) net.stand(); // 그새 마음이 바뀐 경우: 자리를 돌려줘요
      return;
    }
    occupied.set(seat, myId);
    const s = pendingSeat;
    pendingSeat = null;
    mySeat = s;
    player.goSit(s, { onSitStart: beginToFirst, onSeated: onSeatedDone });
  },
  onSitDenied: ({ seat }) => {
    if (pendingSeat && pendingSeat.id === seat) pendingSeat = null;
    toast('이미 다른 사람이 앉은 자리예요');
  },
  onTray: ({ id, n }) => {
    const a = id === myId ? player : (remotes.get(id) || {}).actor;
    if (a) a.setTray(n);
  },
  onEmote: ({ id, e }) => {
    const a = id === myId ? player : (remotes.get(id) || {}).actor;
    if (a) a.say(EMOTES[e] || '👍');
  },
  onChat: ({ id, nickname, text, loc, admin }) => {
    chat.addMessage({ nickname, text, loc, mine: id === myId, admin });
    const a = id === myId ? player : (remotes.get(id) || {}).actor;
    if (a) a.say(text);
  },
  onChatDenied: ({ reason }) => toast(reason),
  onPostitAdded: addPostit,
  onPostitRemoved: ({ id }) => {
    postitsByBoard.forEach((l, board) => {
      const i = l.findIndex((p) => p.id === id);
      if (i >= 0) {
        l.splice(i, 1);
        school.drawBoard(board, l);
      }
    });
  },
  onPostitDenied: ({ reason }) => toast(reason),
};

// ---------- 급식실: 급식 아주머니 + 식판 ----------
const CAFE_ROOM = 4;
const cafeX0 = roomX0(CAFE_ROOM);
const aunt = createActor(scene, nav, {
  nickname: '급식 아주머니', color: 0xe9e4d8, start: { x: cafeX0 + CAFE.staffX, z: CAFE.staffZ }, floor: 1, cook: true, faceYaw: Math.PI / 2,
});
let myTray = 0;
let servedCycle = -1;
let auntCool = 0;
function setMyTray(n) {
  myTray = n;
  if (player) player.setTray(n);
  if (net) net.tray(n);
}
function serveMe(ph) {
  servedCycle = ph.cycle;
  setMyTray(3);
  aunt.say('많이 드세요~ 🍚');
  audio.ding();
  toast('🍱 급식을 받았어요! 오른쪽 위 "먹기" 버튼을 눌러 식사하세요', 4500);
}
function eatBite() {
  if (!player || myTray <= 0) return;
  setMyTray(myTray - 1);
  player.say(myTray > 0 ? '냠냠 😋' : '잘 먹었습니다! 🙏');
  if (net) net.emote(8);
  audio.page(0.5);
  if (myTray === 0) toast('잘 먹었습니다! 식판은 자동으로 반납돼요 🙏');
}
$('btn-eat').addEventListener('click', eatBite);
$('btn-lunch').addEventListener('click', () => {
  if (!player || seated || mySeat) return;
  if (currentFloor !== 1) { toast('급식실은 1층 맨 끝(오른쪽) 교실이에요. 계단으로 내려가세요 🍱', 4000); return; }
  const z = (CAFE.counterZ0 + CAFE.counterZ1) / 2;
  const t = nav.snap(cafeX0 + CAFE.serveX - 0.3, z, 1);
  cancelPendingSeat();
  player.moveTo(t.x, t.z);
  net.move(t.x, t.z, 1);
  toast('급식실로 이동 중… 줄 서는 선 안쪽에 서면 급식을 받아요', 3000);
});

// ---------- 안내방송 (실제 수능처럼: 입실 안내, 시작/종료령, 종료 전 알림) ----------
function announce(text) {
  chat.addSystem('📢 ' + text);
  toast('📢 ' + text, 5000);
  audio.chime();
  try {
    if (!audio.isMuted() && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ko-KR';
      u.rate = 1.0;
      u.volume = 0.8;
      window.speechSynthesis.speak(u);
    }
  } catch (e) { /* 방송 음성이 안 되는 브라우저는 글자로만 보여줘요 */ }
}
let warnedKey = '';

// ---------- 수험표 ----------
let ticket = null;
function makeTicket(name, admin) {
  let h = 7;
  for (const ch of name) h = (h * 131 + ch.charCodeAt(0)) % 9000000;
  const no = admin ? '00000001' : String(10000000 + h);
  return { no, type: Number(no[no.length - 1]) % 2 ? '홀수형' : '짝수형', name };
}
function openTicket() {
  if (!ticket) return;
  $('tk-no').textContent = ticket.no;
  $('tk-name').textContent = ticket.name;
  $('tk-type').textContent = ticket.type;
  $('ticket').classList.add('on');
}
$('btn-ticket').addEventListener('click', openTicket);
$('tk-close').addEventListener('click', () => $('ticket').classList.remove('on'));

// ---------- 이모티콘 (시험 중에도 보낼 수 있어요) ----------
const EMOTES = ['😊', '👍', '🔥', '🙏', '😭', '📚', '💪', '🍀', '😋', '🍚'];
EMOTES.forEach((em, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = em;
  b.addEventListener('click', () => { if (net && player) net.emote(i); });
  $('emotes').appendChild(b);
});
$('btn-admin').addEventListener('click', () => {
  $('admincode').style.display = $('admincode').style.display === 'block' ? 'none' : 'block';
});
$('btn-share').addEventListener('click', async () => {
  const url = location.href.split('#')[0];
  try { await navigator.clipboard.writeText(url); toast('주소를 복사했어요! 친구에게 보내서 같이 시험 봐요 📮'); }
  catch (e) { toast('주소창의 주소를 복사해서 친구에게 보내주세요'); }
});

// ---------- 입장 ----------
const COLORS = [0x6a8fb3, 0xc27a7a, 0x7aa37f, 0xd1a85a, 0x8e7ab5, 0x5fb0b7];
let selectedColor = COLORS[0];
COLORS.forEach((c, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'swatch' + (i === 0 ? ' on' : '');
  b.style.background = '#' + c.toString(16).padStart(6, '0');
  b.addEventListener('click', () => {
    selectedColor = c;
    [...$('colors').children].forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
  });
  $('colors').appendChild(b);
});
try {
  const saved = localStorage.getItem('suneung-nick');
  if (saved) $('nick').value = saved;
} catch (e) { /* 저장소를 못 쓰면 그냥 넘어가요 */ }

function enterRoom() {
  if (myInfo) return;
  audio.unlock(); // 브라우저 규칙: 클릭한 순간에 소리를 켜야 해요
  let name = $('nick').value.trim().slice(0, 8);
  if (!name) name = '수험생' + Math.floor(100 + Math.random() * 900);
  try { localStorage.setItem('suneung-nick', name); } catch (e) { /* 무시 */ }
  const adminCode = ($('admincode').value || '').trim();
  myInfo = { nickname: name, color: selectedColor, adminCode };
  $('enter').disabled = true;
  $('enter').textContent = '입장 중…';
  net = connectNetwork(handlers);
  net.join(myInfo);
  // 3.5초 안에 서버 응답이 없으면 혼자 보기로 들어가요
  fallbackTimer = setTimeout(() => {
    if (player) return;
    net.close();
    net = createLocalNet(handlers);
    net.join(myInfo);
  }, 3500);
}
$('enter').addEventListener('click', enterRoom);
$('nick').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.isComposing) enterRoom(); // 한글 입력 중 엔터는 무시
});

function startPlayer(me) {
  myId = me.id;
  currentFloor = me.floor || 1;
  school.setFloor(currentFloor);
  player = createActor(scene, nav, {
    nickname: me.nickname || myInfo.nickname, color: me.color != null ? me.color : myInfo.color, start: { x: me.x, z: me.z },
    floor: currentFloor, admin: !!me.admin,
  });
  ticket = makeTicket(me.nickname || myInfo.nickname, !!me.admin);
  exam.setTicket(ticket.type);
  $('login').style.display = 'none';
  try {
    if (!localStorage.getItem('suneung-ticket-seen')) {
      localStorage.setItem('suneung-ticket-seen', '1');
      setTimeout(openTicket, 600);
    }
  } catch (e) { /* 무시 */ }
  $('hud').classList.add('on');
  controls.enabled = true;
  $('emotes').style.display = 'flex';
  const p = player.group.position;
  controls.target.set(p.x, floorY(currentFloor) + 0.9, p.z);
  camera.position.set(p.x + 2.2, floorY(currentFloor) + 2.7, p.z + 2.6);
  controls.update();
  lastPhase = null; // 입장하면 지금 시간표 안내를 한 번 띄워요
  const hint = $('hint');
  hint.classList.add('on');
  setTimeout(() => hint.classList.remove('on'), 14000);
}

// ---------- 시간표가 바뀔 때 ----------
function handlePhaseChange(ph, first) {
  audio.setMode(ph.exam ? 'exam' : ph.chat ? 'break' : 'idle');
  chat.setOpen(ph.chat, ph.chat ? '' : `${ph.name} 중에는 채팅할 수 없어요. 쉬는 시간에 열려요.`);
  exam.resetCycle(ph.cycle);
  if (!first) audio.bell();

  let msg;
  if (ph.exam) msg = `🔔 ${ph.name} 시작! 자리에 앉아 응시하세요. (채팅 닫힘)`;
  else if (ph.result) msg = '🔔 시험 끝! 성적표가 열렸어요. 자유롭게 대화하고 칠판에 응원 글을 남겨요.';
  else if (ph.chat) msg = '🔔 쉬는 시간이에요. 채팅이 열렸어요!';
  else msg = '🔔 곧 시험이 시작돼요. 자리에 앉아 준비하세요.';
  chat.addSystem(first ? `입장했어요 · 지금은 "${ph.name}" 시간이에요.` : msg);

  // 안내방송
  const prev = lastPhase;
  if (ph.key === 'enter') announce('수험생 여러분, 입실해 주세요. 휴대전화 등 전자기기는 가방에 넣어 제출하세요.');
  else if (ph.exam) announce(`지금부터 ${ph.name.replace(/^\d교시 /, '')}${ph.name.startsWith('4') ? '' : ' 영역'} 시험을 시작합니다. 시작종이 울렸습니다.`);
  else if (ph.key === 'lunch') announce('점심시간입니다. 1층 급식실에서 식사하세요.');
  else if (ph.result) announce('수능이 모두 끝났습니다. 수고하셨습니다!');
  if (prev && prev.exam && !first) chat.addSystem('📢 종료령이 울렸습니다. 필기구를 내려놓으세요.');
  if (ph.key !== 'lunch' && myTray > 0) { setMyTray(0); toast('식판을 반납했어요 🙏'); }
  if (ph.exam && !seated) toast('📣 시험 시작! 책상을 클릭해서 앉으면 응시할 수 있어요');
  if (ph.exam && seated) audio.page();
  if (ph.result && exam.hasParticipated()) exam.openResult();
}

// ---------- 카메라: 3인칭 ↔ 1인칭 ----------
const cam = {
  mode: 'third',   // third | toFirst | first | toThird
  t: 0, dur: 2.6,
  fromPos: new THREE.Vector3(), fromTarget: new THREE.Vector3(),
  toPos: new THREE.Vector3(), toTarget: new THREE.Vector3(),
  yaw: 0, yawT: 0, pitch: -0.58, pitchT: -0.58,
  free: false, lookUp: false,
};
const V = THREE.Vector3;

// 앉았을 때 눈 위치와 바라보는 곳 (기본은 서쪽 = 칠판 방향, pitch가 음수면 아래(책상))
function fpPose(pos, target) {
  const s = mySeat;
  pos.set(s.sx - 0.04, floorY(s.floor) + 1.12, s.sz);
  const dx = -Math.cos(cam.pitch) * Math.cos(cam.yaw);
  const dz = -Math.cos(cam.pitch) * Math.sin(cam.yaw);
  const dy = Math.sin(cam.pitch);
  target.set(pos.x + dx * 2, pos.y + dy * 2, pos.z + dz * 2);
}

function beginToFirst() {
  cam.mode = 'toFirst';
  cam.t = 0;
  cam.dur = 2.6; // 천천히 1인칭으로
  cam.fromPos.copy(camera.position);
  cam.fromTarget.copy(controls.target);
  cam.yaw = cam.yawT = 0;
  cam.pitch = cam.pitchT = -0.58;
  cam.lookUp = false;
  cam.free = false;
  controls.enabled = false;
}

function onSeatedDone() {
  seated = true;
  $('seatbar').classList.add('on');
  const ph = phaseAt(nowMs());
  if (ph.exam) audio.page();
}

function beginToThird() {
  cam.mode = 'toThird';
  cam.t = 0;
  cam.dur = 1.6;
  cam.fromPos.copy(camera.position);
  const s = mySeat;
  cam.toTarget.set(s.ax, floorY(s.floor) + 0.9, s.az);
  cam.toPos.set(s.ax + 2.0, floorY(s.floor) + 2.0, s.az + (s.az < ZC ? 2.4 : -2.4));
  // 지금 바라보는 지점을 시작 목표로 삼아요
  cam.fromTarget.copy(camera.position).add(camera.getWorldDirection(new V()).multiplyScalar(2));
  player.group.visible = true;
}

function doStand() {
  if (!seated || cam.mode !== 'first') return;
  const ph = phaseAt(nowMs());
  if (ph.exam && !window.confirm('시험 중이에요. 정말 일어나서 응시를 포기할까요?')) return;
  seated = false;
  $('seatbar').classList.remove('on');
  exam.setVisible(false);
  occupied.delete(mySeat.id);
  net.stand();
  beginToThird();
  player.standUp({ onStood: () => { mySeat = null; } });
}
$('btn-stand').addEventListener('click', doStand);
$('btn-look').addEventListener('click', () => {
  cam.lookUp = !cam.lookUp;
  $('btn-look').textContent = cam.lookUp ? '✏️ 시험지 보기' : '👀 고개 들기';
});

// ---------- 내 자리 표시 ----------
// 한 번 고른 자리는 "내 자리"로 기억해요. 내 화면에서만 초록 빛 고리와 "내 자리" 표지가 보여요.
const seatLabel = (s) => `${s.floor}층 ${s.room + 1}반 ${s.idx + 1}번`;
let prefSeat = null;
try {
  const id = localStorage.getItem('suneung-seat');
  prefSeat = id ? parseSeatId(id) : null;
} catch (e) { /* 무시 */ }
function setPrefSeat(seat) {
  prefSeat = seat;
  try { localStorage.setItem('suneung-seat', seat.id); } catch (e) { /* 무시 */ }
}
const seatMarker = new THREE.Group();
const ringMat = new THREE.MeshBasicMaterial({ color: 0x4fd37a, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
const seatRing = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 40), ringMat);
seatRing.rotation.x = -Math.PI / 2;
seatMarker.add(seatRing);
{
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 96;
  const c = cv.getContext('2d');
  c.fillStyle = '#2f9e5a';
  c.beginPath(); c.roundRect(6, 6, 244, 66, 22); c.fill();
  c.beginPath(); c.moveTo(108, 70); c.lineTo(128, 92); c.lineTo(148, 70); c.fill();
  c.fillStyle = '#fff';
  c.font = 'bold 40px sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('🪑 내 자리', 128, 40);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false }));
  sp.scale.set(1.1, 0.41, 1);
  sp.position.y = 1.55;
  sp.renderOrder = 10;
  seatMarker.add(sp);
}
seatMarker.visible = false;
scene.add(seatMarker);

// 현재 층에서 나와 가장 가까운 빈 자리
function nearestFreeSeat() {
  const p = player.group.position;
  let best = null;
  let bd = 1e9;
  for (const s of floorSeats[currentFloor]) {
    if (occupied.has(s.id)) continue;
    const d = Math.hypot(s.ax - p.x, s.az - p.z);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

function goMySeat() {
  if (!player || seated || mySeat || pendingSeat || cam.mode !== 'third') return;
  if (prefSeat && prefSeat.floor !== currentFloor) {
    toast(`내 자리는 ${seatLabel(prefSeat)}이에요. 계단(노란 원)으로 ${prefSeat.floor}층에 가세요`, 4000);
    return;
  }
  let seat = prefSeat;
  if (!seat || (occupied.has(seat.id) && occupied.get(seat.id) !== myId)) {
    seat = nearestFreeSeat();
    if (!seat) { toast('빈 자리가 없어요. 다른 층도 살펴보세요'); return; }
  }
  requestSit(seat);
}
$('btn-myseat').addEventListener('click', goMySeat);

// ---------- 앉기 ----------
function requestSit(seat) {
  if (seated || mySeat || pendingSeat) return;
  const holder = occupied.get(seat.id);
  if (holder && holder !== myId) {
    toast('이미 다른 사람이 앉은 자리예요');
    return;
  }
  pendingSeat = seat;
  setPrefSeat(seat);
  toast(`${seatLabel(seat)} 자리로 이동 중 🪑 (취소하려면 바닥을 클릭)`, 2200);
  net.sit(seat.id);
  // 서버 답이 2초 넘게 없어도 멈추지 않게, 내 화면에서는 그냥 앉아요
  const want = seat.id;
  setTimeout(() => {
    if (pendingSeat && pendingSeat.id === want) handlers.onSitOk({ seat: want });
  }, 2000);
}

function cancelPendingSeat() {
  if (!pendingSeat) return;
  pendingSeat = null;
  net.stand(); // 서버에 잡아 둔 자리를 돌려줘요
}

// ---------- 클릭: 앉기 / 칠판 / 이동 ----------
const raycaster = new THREE.Raycaster();
const UP = new THREE.Vector3(0, 1, 0);
const hit = new THREE.Vector3();
const ripple = new THREE.Mesh(
  new THREE.RingGeometry(0.12, 0.18, 32),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
);
ripple.rotation.x = -Math.PI / 2;
scene.add(ripple);
let rippleT = 99;

// 책상 위/의자 위/책상 아래 바닥을 눌렀는지 찾아요
function seatAtRay(f) {
  const y0 = floorY(f);
  const seats = floorSeats[f];
  if (raycaster.ray.intersectPlane(new THREE.Plane(UP, -(y0 + 0.76)), hit)) {
    for (const s of seats) if (Math.abs(hit.x - s.cx) < 0.5 && Math.abs(hit.z - s.cz) < 0.62) return s;
  }
  if (raycaster.ray.intersectPlane(new THREE.Plane(UP, -(y0 + 0.48)), hit)) {
    for (const s of seats) if (Math.abs(hit.x - s.sx) < 0.42 && Math.abs(hit.z - s.sz) < 0.5) return s;
  }
  if (raycaster.ray.intersectPlane(new THREE.Plane(UP, -y0), hit)) {
    for (const s of seats) if (hit.x > s.cx - 0.5 && hit.x < s.cx + 1.1 && Math.abs(hit.z - s.cz) < 0.62) return s;
  }
  return null;
}

function handleClick(clientX, clientY) {
  try { handleClickInner(clientX, clientY); } catch (e) { showError(e); }
}
function handleClickInner(clientX, clientY) {
  if (!player || cam.mode !== 'third' || fading) return;
  const ndc = new THREE.Vector2((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);

  // 1) 책상·의자 → 앉으러 가기
  const seat = seatAtRay(currentFloor);
  if (seat && seat.floor === currentFloor) {
    requestSit(seat);
    return;
  }
  // 2) 칠판 → 포스트잇 읽기/붙이기
  const bh = raycaster.intersectObjects(school.boardMeshes(currentFloor), false);
  if (bh.length && bh[0].distance < 16) {
    const id = bh[0].object.userData.boardId;
    const u = bh[0].uv.x;
    const v = 1 - bh[0].uv.y;
    const p = school.postitAt(id, u, v);
    if (p) postitUI.openRead(p);
    else postitUI.openWrite(id, u, v);
    return;
  }
  // 3) 바닥 → 걸어가기
  if (!raycaster.ray.intersectPlane(new THREE.Plane(UP, -floorY(currentFloor)), hit)) return;
  const x = clamp(hit.x, 0.4, BW - 0.4);
  const z = clamp(hit.z, 0.4, BD - 0.4);
  const target = nav.snap(x, z, currentFloor);
  cancelPendingSeat();
  player.moveTo(target.x, target.z);
  net.move(target.x, target.z, currentFloor);
  ripple.position.set(target.x, floorY(currentFloor) + 0.03, target.z);
  rippleT = 0;
}

// 드래그(시점 회전)와 클릭(이동)을 구분해요
let down = null;
let lastPtr = null;
renderer.domElement.addEventListener('pointerdown', (e) => {
  down = { x: e.clientX, y: e.clientY, t: performance.now(), button: e.button };
  lastPtr = { x: e.clientX, y: e.clientY };
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!down || !lastPtr || cam.mode !== 'first' || !cam.free) return;
  cam.yawT = clamp(cam.yawT - (e.clientX - lastPtr.x) * 0.004, -1.3, 1.3); // 끌면 고개가 돌아가요
  cam.pitchT = clamp(cam.pitchT + (e.clientY - lastPtr.y) * 0.004, -1.1, 0.45);
  lastPtr = { x: e.clientX, y: e.clientY };
});
renderer.domElement.addEventListener('pointerup', (e) => {
  const d = down;
  down = null;
  if (!d || d.button !== 0) return;
  const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
  if (moved > 6 || performance.now() - d.t > 500) return; // 드래그였으면 이동 안 함
  handleClick(e.clientX, e.clientY);
});

// ---------- 계단 ----------
function nearestStair() {
  if (!player) return null;
  const p = player.group.position;
  for (const s of STAIR_PADS) if (Math.hypot(p.x - s.x, p.z - s.z) < STAIR_RADIUS) return s;
  return null;
}

function changeFloor(nf) {
  if (fading || !player || seated || mySeat || pendingSeat) return;
  const pad = nearestStair();
  if (!pad || nf < 1 || nf > FLOORS) return;
  fading = true;
  $('fade').classList.add('on');
  setTimeout(() => {
    const op = player.group.position.clone();
    const oldY = floorY(currentFloor);
    currentFloor = nf;
    player.setFloor(nf);
    player.teleport(pad.x, CORR_W - 0.6); // 계단 원에서 조금 떨어진 복도로
    school.setFloor(nf);
    const np = player.group.position;
    const shift = new V(np.x - op.x, floorY(nf) - oldY, np.z - op.z);
    camera.position.add(shift);
    controls.target.add(shift);
    net.floor(nf, np.x, np.z);
    toast(`${nf}층`);
    $('fade').classList.remove('on');
    setTimeout(() => { fading = false; }, 250);
  }, 350);
}
$('stair-up').addEventListener('click', () => changeFloor(currentFloor + 1));
$('stair-down').addEventListener('click', () => changeFloor(currentFloor - 1));

// ---------- 버튼들 ----------
$('btn-sound').addEventListener('click', () => {
  audio.unlock();
  audio.setMuted(!audio.isMuted());
  $('btn-sound').textContent = audio.isMuted() ? '🔇' : '🔊';
});
$('btn-result').addEventListener('click', () => {
  if (exam.hasParticipated()) exam.openResult();
  else toast('이번 회차에는 아직 응시 기록이 없어요. 시험 시간에 책상에 앉아보세요!');
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- 매 프레임 ----------
const clock = new THREE.Clock();
const desired = new V();
const delta = new V();
const tmpPos = new V();
const tmpTarget = new V();
let hudAcc = 1;
let t0 = 0;

function setFov(v) {
  if (Math.abs(camera.fov - v) > 0.01) {
    camera.fov = v;
    camera.updateProjectionMatrix();
  }
}

function updateCamera(dt, ph) {
  if (cam.mode === 'third') {
    // 캐릭터를 부드럽게 따라가요 (시점 회전은 그대로 유지)
    desired.set(player.group.position.x, floorY(currentFloor) + 0.9, player.group.position.z);
    delta.copy(desired).sub(controls.target).multiplyScalar(Math.min(1, 8 * dt));
    controls.target.add(delta);
    camera.position.add(delta);
    controls.update();
    // 카메라가 건물 밖·천장 위로 나가지 않게 제한
    camera.position.x = clamp(camera.position.x, 0.3, BW - 0.3);
    camera.position.z = clamp(camera.position.z, 0.3, BD - 0.3);
    camera.position.y = clamp(camera.position.y, floorY(currentFloor) + 0.3, floorY(currentFloor) + 3.3);
    setFov(60);
  } else if (cam.mode === 'toFirst') {
    cam.t = Math.min(1, cam.t + dt / cam.dur);
    const e = ease(cam.t);
    fpPose(tmpPos, tmpTarget);
    camera.position.lerpVectors(cam.fromPos, tmpPos, e);
    const tg = new V().lerpVectors(cam.fromTarget, tmpTarget, e);
    camera.lookAt(tg);
    setFov(60 + 8 * e);
    player.group.visible = cam.t < 0.75;
    if (cam.t >= 1) cam.mode = 'first';
  } else if (cam.mode === 'first') {
    // 시험 중에는 책상 위 시험지를 내려다보고, 아니면 자유롭게 둘러봐요
    const free = !(ph.exam && !cam.lookUp);
    if (free !== cam.free) {
      cam.free = free;
      if (free) cam.pitchT = -0.1;
      else { cam.yawT = 0; cam.pitchT = -0.58; }
    }
    const k = Math.min(1, 6 * dt);
    cam.yaw += (cam.yawT - cam.yaw) * k;
    cam.pitch += (cam.pitchT - cam.pitch) * k;
    fpPose(tmpPos, tmpTarget);
    camera.position.copy(tmpPos);
    camera.lookAt(tmpTarget);
    setFov(68);
    player.group.visible = false;
  } else if (cam.mode === 'toThird') {
    cam.t = Math.min(1, cam.t + dt / cam.dur);
    const e = ease(cam.t);
    camera.position.lerpVectors(cam.fromPos, cam.toPos, e);
    const tg = new V().lerpVectors(cam.fromTarget, cam.toTarget, e);
    camera.lookAt(tg);
    setFov(68 - 8 * e);
    if (cam.t >= 1) {
      cam.mode = 'third';
      controls.target.copy(cam.toTarget);
      camera.position.copy(cam.toPos);
      controls.enabled = true;
      controls.update();
    }
  }
}

function updateHud(now, ph) {
  const pill = $('phase');
  pill.className = ph.exam ? 'exam' : ph.chat ? 'break' : 'prep';
  $('phase-name').textContent = ph.name;
  $('phase-time').textContent = mmss(ph.remaining);
  const vclock = `🕗 ${fmtClock(virtualMinutes(ph))}`;
  $('phase-sub').textContent = ph.exam
    ? `${vclock} · ${seated ? '시험 중 · 정숙' : '책상을 클릭해 앉으세요'}`
    : `${vclock} · 다음 시험까지 ${mmss(secondsToNextExam(now))}`;
  const p = player.group.position;
  $('hud-loc').textContent = `${schoolText} · ${locLabel(currentFloor, p.x, p.z)}`;

  // 계단 버튼
  const near = !seated && !mySeat && !pendingSeat && !fading && nearestStair();
  $('stairs').classList.toggle('on', !!near);
  $('stair-up').style.display = currentFloor < FLOORS ? '' : 'none';
  $('stair-down').style.display = currentFloor > 1 ? '' : 'none';
  $('stair-up').textContent = `▲ ${currentFloor + 1}층으로`;
  $('stair-down').textContent = `▼ ${currentFloor - 1}층으로`;

  // 앉아 있을 때 버튼
  const fp = cam.mode === 'first';
  const showMarker = !!prefSeat && prefSeat.floor === currentFloor && !seated && !mySeat;
  seatMarker.visible = showMarker;
  if (showMarker) seatMarker.position.set(prefSeat.sx, floorY(prefSeat.floor) + 0.04, prefSeat.sz);
  $('btn-myseat').textContent = prefSeat ? `🪑 내 자리 (${seatLabel(prefSeat)})` : '🪑 빈 자리 앉기';
  $('btn-myseat').style.display = seated || mySeat ? 'none' : '';
  const canWalk = !seated && !mySeat && cam.mode === 'third';
  $('btn-eat').style.display = myTray > 0 && canWalk ? '' : 'none';
  $('btn-lunch').style.display = ph.key === 'lunch' && myTray === 0 && servedCycle !== ph.cycle && canWalk ? '' : 'none';
  $('btn-stand').textContent = ph.exam ? '시험 포기하고 일어나기' : '일어나기';
  $('btn-stand').style.display = seated && fp ? '' : 'none';
  $('btn-look').style.display = seated && fp && ph.exam ? '' : 'none';
}

function loop() {
  try { frame(); } catch (e) { showError(e); }
  requestAnimationFrame(loop);
}
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  t0 += dt;
  const now = nowMs();
  const ph = phaseAt(now);

  aunt.update(dt);
  aunt.group.visible = currentFloor === 1;
  remotes.forEach((r) => {
    r.actor.update(dt);
    r.actor.group.visible = r.actor.floor === currentFloor;
    if (r.pendingStand && r.actor.state === 'seated') {
      r.pendingStand = false;
      r.actor.standUp();
    }
  });

  let focus = { x: BACK_LOOK.x, y: 0, z: BACK_LOOK.z };
  if (player) {
    if (!lastPhase || lastPhase.index !== ph.index || lastPhase.cycle !== ph.cycle) {
      handlePhaseChange(ph, !lastPhase);
      lastPhase = ph;
    }
    player.update(dt);

    // 멈추는 순간 실제 위치를 서버에 알려요
    const moving = player.isMoving();
    if (loop.wasMoving && !moving && !mySeat && !pendingSeat) {
      const p = player.group.position;
      net.arrive(p.x, p.z, currentFloor);
    }
    loop.wasMoving = moving;

    updateCamera(dt, ph);

    // 급식실: 점심시간에 줄 서는 선 안쪽으로 들어가면 급식 아주머니가 식판을 줘요
    {
      const cz = cafeServeZone(CAFE_ROOM);
      const pp = player.group.position;
      const inZone = currentFloor === 1 && pp.x > cz.x0 && pp.x < cz.x1 && pp.z > cz.z0 && pp.z < cz.z1;
      auntCool -= dt;
      if (inZone && !seated && !mySeat) {
        if (ph.key === 'lunch' && myTray === 0 && servedCycle !== ph.cycle) serveMe(ph);
        else if (ph.key !== 'lunch' && auntCool <= 0) { aunt.say('점심시간에 오렴~ 🍚'); auntCool = 9; }
        else if (ph.key === 'lunch' && servedCycle === ph.cycle && myTray === 0 && auntCool <= 0) { aunt.say('이미 먹었지? 다음에 또 와~'); auntCool = 9; }
      }
    }
    // 종료 30초 전 안내
    if (ph.exam && ph.remaining <= 30) {
      const k = `${ph.cycle}:${ph.index}`;
      if (warnedKey !== k) { warnedKey = k; announce('종료 30초 전입니다. 답안 마킹을 확인하세요.'); }
    }

    // 시험 화면(종이 시험지 + OMR)은 1인칭으로 앉은 뒤 시험 시간에만 책상 위에 떠요
    exam.sync(ph, seated);
    exam.setVisible(cam.mode === 'first' && seated && ph.exam && !cam.lookUp);

    hudAcc += dt;
    if (hudAcc > 0.2) {
      hudAcc = 0;
      updateHud(now, ph);
    }
    const p = player.group.position;
    focus = { x: p.x, y: floorY(currentFloor), z: p.z };
  } else {
    // 입장 전: 배경 시점이 살짝 흔들려요
    camera.position.set(BACK_POS.x, BACK_POS.y, BACK_POS.z + Math.sin(t0 * 0.25) * 0.9);
    camera.lookAt(BACK_LOOK.x, BACK_LOOK.y, BACK_LOOK.z + Math.sin(t0 * 0.25) * 0.4);
  }

  // 물결 효과
  if (rippleT < 0.7) {
    rippleT += dt;
    const s = 1 + rippleT * 2.5;
    ripple.scale.set(s, s, s);
    ripple.material.opacity = Math.max(0, 0.9 * (1 - rippleT / 0.7));
  } else {
    ripple.material.opacity = 0;
  }

  if (seatMarker.visible) {
    const k = 1 + Math.sin(t0 * 4) * 0.08;
    seatRing.scale.set(k, k, k);
    ringMat.opacity = 0.6 + Math.sin(t0 * 4) * 0.25;
  }
  audio.update(dt);
  school.update(now, ph, focus);
  renderer.render(scene, camera);
}
loop();

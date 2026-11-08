// 이 파일은 "학교(건물) 관리"를 맡아요: 한 건물에 최대 80명, 꽉 차면 다음 건물("2관")을 새로 열어요.
// 그리고 "누가 어느 자리에 앉아 있는지"를 기억해서 한 의자에 두 명이 앉지 않게 해요.
import { MAX_PER_SCHOOL, SCHOOL_NAME } from '../shared/config.js';

export function createSchoolManager(max = MAX_PER_SCHOOL) {
  const schools = [];
  const schoolOf = new Map(); // 접속자 id -> 건물

  function addPlayer(player) {
    let s = schools.find((x) => x.players.size < max);
    if (!s) {
      s = {
        id: `school-${schools.length + 1}`,
        name: `${SCHOOL_NAME} ${schools.length + 1}관`,
        max,
        players: new Map(),
        seats: new Map(), // 좌석 이름 -> 앉은 사람 id
        spawnCounter: 0,
      };
      schools.push(s);
    }
    s.players.set(player.id, player);
    schoolOf.set(player.id, s);
    return s;
  }

  // 나갈 때: 앉아 있던 자리도 비워줘요
  function removePlayer(id) {
    const s = schoolOf.get(id);
    if (!s) return null;
    const p = s.players.get(id);
    let freedSeat = null;
    if (p && p.seat) {
      if (s.seats.get(p.seat) === id) s.seats.delete(p.seat);
      freedSeat = p.seat;
    }
    s.players.delete(id);
    schoolOf.delete(id);
    return { school: s, freedSeat };
  }

  // 자리 잡기: 비어 있으면 true
  function claimSeat(player, seatId) {
    const s = schoolOf.get(player.id);
    if (!s) return false;
    const holder = s.seats.get(seatId);
    if (holder && holder !== player.id) return false;
    releaseSeat(player);
    s.seats.set(seatId, player.id);
    player.seat = seatId;
    return true;
  }

  function releaseSeat(player) {
    const s = schoolOf.get(player.id);
    if (!s || !player.seat) return null;
    if (s.seats.get(player.seat) === player.id) s.seats.delete(player.seat);
    const old = player.seat;
    player.seat = null;
    return old;
  }

  return {
    addPlayer,
    removePlayer,
    claimSeat,
    releaseSeat,
    getSchoolOf: (id) => schoolOf.get(id) || null,
    playersIn: (s) => [...s.players.values()],
    schools,
  };
}

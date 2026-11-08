// 이 파일은 "시간표"예요. 시험 → 쉬는 시간 → 시험 … 이 한 바퀴(약 16분)로 계속 반복돼요.
// 모두가 같은 시계(서버 시간)를 보기 때문에 접속한 모든 사람의 시간표가 똑같이 흘러가요.
// 채팅은 chat: true 인 구간(쉬는 시간·자유 시간)에만 열려요.

export const SESSION_NAMES = ['국어', '수학', '영어', '한국사'];
export const SESSION_QUESTIONS = [4, 3, 3, 2]; // 교시별 문항 수 (합계 12문항)

// 실제 수능 시간표를 짧게 줄인 버전이에요. dur(초)는 접속자가 실제로 보내는 시간이고,
// vFrom~vTo(하루 중 몇 분)는 교실 시계에 보이는 "수능 날 시각"이에요. (예: 520 = 08:40)
export const SCHEDULE = [
  { key: 'enter', name: '입실 · 시험 준비',   short: '입실',        dur: 30,  exam: false, chat: false, vFrom: 490, vTo: 520 },
  { key: 's1',    name: '1교시 국어',          short: '1교시 국어',   dur: 150, exam: true,  session: 0, chat: false, vFrom: 520, vTo: 600 },
  { key: 'b1',    name: '쉬는 시간',           short: '쉬는 시간',    dur: 60,  exam: false, chat: true, vFrom: 600, vTo: 630 },
  { key: 's2',    name: '2교시 수학',          short: '2교시 수학',   dur: 150, exam: true,  session: 1, chat: false, vFrom: 630, vTo: 730 },
  { key: 'lunch', name: '점심시간',            short: '점심시간',     dur: 90,  exam: false, chat: true, vFrom: 730, vTo: 790 },
  { key: 's3',    name: '3교시 영어',          short: '3교시 영어',   dur: 120, exam: true,  session: 2, chat: false, vFrom: 790, vTo: 860 },
  { key: 'b3',    name: '쉬는 시간',           short: '쉬는 시간',    dur: 60,  exam: false, chat: true, vFrom: 860, vTo: 890 },
  { key: 's4',    name: '4교시 한국사',        short: '4교시 한국사', dur: 90,  exam: true,  session: 3, chat: false, vFrom: 890, vTo: 930 },
  { key: 'free',  name: '수능 끝! 성적 확인 · 자유 시간', short: '성적·자유시간', dur: 240, exam: false, chat: true, result: true, vFrom: 930, vTo: 1020 },
];

// 지금 시간표 위치를 "수능 날 시각"(분, 소수 포함)으로 바꿔줘요
export function virtualMinutes(ph) {
  return ph.vFrom + (ph.vTo - ph.vFrom) * (ph.elapsed / ph.dur);
}
export const fmtClock = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;

export const CYCLE = SCHEDULE.reduce((sum, p) => sum + p.dur, 0); // 한 바퀴 길이(초)

// 어떤 시각(밀리초)에 시간표가 어디쯤인지 알려줘요
export function phaseAt(ms) {
  const t = ms / 1000;
  const cycle = Math.floor(t / CYCLE);
  let r = t - cycle * CYCLE;
  for (let i = 0; i < SCHEDULE.length; i++) {
    const p = SCHEDULE[i];
    if (r < p.dur) {
      return {
        ...p,
        index: i,
        cycle,
        elapsed: r,
        remaining: p.dur - r,
        next: SCHEDULE[(i + 1) % SCHEDULE.length],
      };
    }
    r -= p.dur;
  }
  return { ...SCHEDULE[0], index: 0, cycle, elapsed: 0, remaining: SCHEDULE[0].dur, next: SCHEDULE[1] };
}

// 다음 시험(교시)이 시작되기까지 남은 초 (지금 시험 중이면 다음 교시 기준)
export function secondsToNextExam(ms) {
  const ph = phaseAt(ms);
  let acc = ph.remaining;
  let i = (ph.index + 1) % SCHEDULE.length;
  for (let n = 0; n < SCHEDULE.length; n++) {
    if (SCHEDULE[i].exam) return acc;
    acc += SCHEDULE[i].dur;
    i = (i + 1) % SCHEDULE.length;
  }
  return acc;
}

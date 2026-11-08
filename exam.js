// 이 파일은 "시험 화면"을 맡아요: 책상 위에 놓인 종이 시험지, OMR 카드(마킹), 채점 결과(성적표).
// 책상에 앉아 1인칭 시점이 되면 이 화면이 책상 위 종이처럼 떠요.
import { QUESTIONS } from './questions.js';
import { SESSION_NAMES } from '../../shared/schedule.js';

const CIRCLED = ['①', '②', '③', '④', '⑤'];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function createExam({ onMark }) {
  const rootEl = document.getElementById('exam');
  const paperEl = document.getElementById('paper');
  const omrEl = document.getElementById('omr');
  const resultEl = document.getElementById('result');

  let cycle = -1;
  let answers = {};          // 문제 번호 -> 고른 번호
  let participated = false;  // 이번 회차에 자리에 앉아 시험에 참여했는지
  let renderedKey = '';
  let phase = null;
  let seated = false;
  let ticketType = '';

  // 새 회차가 시작되면 답안을 비워요
  function resetCycle(c) {
    if (c === cycle) return;
    cycle = c;
    answers = {};
    participated = false;
    renderedKey = '';
    closeResult();
  }

  const activeSession = () => (phase && phase.exam ? phase.session : -1);
  const canMark = (q) => seated && phase && phase.exam && q.session === phase.session;

  function mark(no, c) {
    const q = QUESTIONS[no - 1];
    if (!q || !canMark(q)) return;
    if (answers[no] === c) delete answers[no];
    else answers[no] = c;
    participated = true;
    paint();
    if (onMark) onMark();
  }

  // 시험지(왼쪽)
  function renderPaper() {
    const s = activeSession();
    if (s < 0) {
      paperEl.innerHTML = '';
      return;
    }
    const qs = QUESTIONS.filter((q) => q.session === s);
    const first = qs[0].n;
    const last = qs[qs.length - 1].n;
    paperEl.innerHTML =
      `<div class="paper-head"><b>${SESSION_NAMES[s]} 영역 ${ticketType}</b><span>${first}~${last}번 (${qs.length}문항)</span></div>` +
      qs.map((q) => `
        <div class="q" data-no="${q.no}">
          <div class="qtitle"><b>${q.n}.</b> ${esc(q.text).replace(/\n/g, '<br>')}</div>
          ${q.passage ? `<div class="passage">${esc(q.passage)}</div>` : ''}
          <div class="choices">
            ${q.choices.map((c, i) => `<button type="button" class="choice" data-no="${q.no}" data-c="${i + 1}"><span class="cn">${CIRCLED[i]}</span> ${esc(c)}</button>`).join('')}
          </div>
        </div>`).join('') +
      `<div class="paper-foot">※ 이 문제는 서비스를 위해 직접 만든 문항이에요. 시간이 끝나면 자동으로 제출돼요.</div>`;
  }

  // OMR 카드(오른쪽): 10문항 전체가 보이고, 지금 교시 줄만 칠할 수 있어요
  function renderOmr() {
    const s = activeSession();
    omrEl.innerHTML =
      `<div class="omr-head"><b>OMR 답안카드</b><span>${s >= 0 ? SESSION_NAMES[s] + ' 영역' : ''}</span></div>` +
      `<div class="omr-rows">` +
      QUESTIONS.filter((q) => s < 0 || q.session === s).map((q) => `
        <div class="omr-row ${q.session === s ? 'live' : ''}" data-no="${q.no}">
          <span class="omr-no">${q.n}</span>
          ${[1, 2, 3, 4, 5].map((c) => `<button type="button" class="bub" data-no="${q.no}" data-c="${c}" ${q.session === s ? '' : 'disabled'}>${c}</button>`).join('')}
        </div>`).join('') +
      `</div>`;
  }

  // 마킹 표시만 갱신
  function paint() {
    rootEl.querySelectorAll('.choice').forEach((b) => {
      b.classList.toggle('on', answers[Number(b.dataset.no)] === Number(b.dataset.c));
    });
    rootEl.querySelectorAll('.bub').forEach((b) => {
      b.classList.toggle('on', answers[Number(b.dataset.no)] === Number(b.dataset.c));
    });
  }

  function onClick(e) {
    const b = e.target.closest('[data-no][data-c]');
    if (!b) return;
    mark(Number(b.dataset.no), Number(b.dataset.c));
  }
  paperEl.addEventListener('click', onClick);
  omrEl.addEventListener('click', onClick);

  // 매 프레임 불러줘요: 지금 시간표와 앉은 상태에 맞춰 화면 내용을 갈아 끼워요
  function sync(ph, isSeated) {
    phase = ph;
    seated = isSeated;
    if (ph.exam && isSeated) participated = true;
    const key = `${ph.cycle}:${ph.exam ? ph.session : -1}`;
    if (key !== renderedKey) {
      renderedKey = key;
      renderPaper();
      renderOmr();
      paint();
    }
  }

  function setTicket(t) {
    ticketType = t || '';
    renderedKey = '';
  }

  function setVisible(v) {
    rootEl.classList.toggle('on', v);
  }

  // ---------- 성적표 ----------
  function score() {
    let right = 0;
    const rows = QUESTIONS.map((q) => {
      const mine = answers[q.no];
      const ok = mine === q.answer;
      if (ok) right++;
      return { q, mine, ok };
    });
    return { right, rows };
  }

  function openResult() {
    const { right, rows } = score();
    const bySubject = SESSION_NAMES.map((n, i) => {
      const rs = rows.filter((r) => r.q.session === i);
      return `${n} ${rs.filter((r) => r.ok).length}/${rs.length}`;
    }).join(' · ');
    resultEl.innerHTML = `
      <div class="result-card">
        <div class="result-title">📊 내 성적표 <button type="button" id="result-close" aria-label="닫기">✕</button></div>
        <div class="result-score"><b>${Math.round(right * 100 / QUESTIONS.length)}</b>점 <span>(${right}/${QUESTIONS.length} 정답)</span></div>
        <div class="result-sub">${bySubject}</div>
        <div class="result-table">
          ${rows.map((r) => `
            <div class="rrow ${r.mine === undefined ? 'skip' : r.ok ? 'ok' : 'bad'}">
              <span class="rno">${r.q.subject.slice(0, 2)} ${r.q.n}</span>
              <span class="rres">${r.mine === undefined ? '－' : r.ok ? 'O' : 'X'}</span>
              <span class="rans">내 답 ${r.mine === undefined ? '없음' : CIRCLED[r.mine - 1]} · 정답 ${CIRCLED[r.q.answer - 1]}</span>
              <span class="rexp">${esc(r.q.explain)}</span>
            </div>`).join('')}
        </div>
        <div class="result-foot">자유 시간 동안 칠판에 합격 기원·공부 팁을 남겨보세요. 다음 회차가 곧 시작돼요!</div>
      </div>`;
    resultEl.classList.add('on');
    const close = document.getElementById('result-close');
    if (close) close.addEventListener('click', closeResult);
  }

  function closeResult() {
    resultEl.classList.remove('on');
  }

  return {
    sync, setVisible, setTicket, resetCycle, openResult, closeResult,
    hasParticipated: () => participated,
    answeredCount: () => Object.keys(answers).length,
  };
}

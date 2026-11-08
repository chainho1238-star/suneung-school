// 이 파일은 "소리"를 맡아요. 소리 파일 없이 코드로 직접 만들어 내요(WebAudio).
// 종소리, 책장 넘기는 소리, 연필 소리, 쉬는 시간의 웅성거림, 시험 중의 고요함을 흉내 내요.
// 브라우저 규칙상 "입장하기" 버튼을 누른 뒤에야 소리를 낼 수 있어서 unlock()을 그때 불러요.
// 나중에 진짜 녹음 파일(mp3)로 바꾸고 싶으면 이 파일의 bell/page/pencil 함수만 바꾸면 돼요.

export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let murmurGain = null;   // 쉬는 시간 웅성거림 크기
  let roomGain = null;     // 교실 공기 소리 크기
  let muted = false;
  let mode = 'idle';       // idle | exam | break
  let nextEventIn = 6;     // 다음 책장/연필 소리까지 남은 시간(초)

  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
    } catch (e) {
      return;
    }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.85;
    master.connect(ctx.destination);

    // 2초짜리 잡음(노이즈)을 만들어 두고 여러 소리에 재활용해요
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    // 교실 공기 소리(아주 낮고 부드러운 잡음)
    const room = ctx.createBufferSource();
    room.buffer = noiseBuf;
    room.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    roomGain = ctx.createGain();
    roomGain.gain.value = 0.02;
    room.connect(lp).connect(roomGain).connect(master);
    room.start();

    // 웅성거림(사람 목소리 대역의 잡음을 천천히 흔들어서 만들어요)
    const mur = ctx.createBufferSource();
    mur.buffer = noiseBuf;
    mur.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 700;
    bp.Q.value = 0.8;
    murmurGain = ctx.createGain();
    murmurGain.gain.value = 0;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.35;
    const lfoAmt = ctx.createGain();
    lfoAmt.gain.value = 180;
    lfo.connect(lfoAmt).connect(bp.frequency);
    lfo.start();
    mur.connect(bp).connect(murmurGain).connect(master);
    mur.start();
    applyMode();
  }

  function applyMode() {
    if (!ctx) return;
    const t = ctx.currentTime;
    murmurGain.gain.cancelScheduledValues(t);
    murmurGain.gain.linearRampToValueAtTime(mode === 'break' ? 0.055 : 0, t + 1.5);
    roomGain.gain.cancelScheduledValues(t);
    roomGain.gain.linearRampToValueAtTime(mode === 'exam' ? 0.012 : 0.022, t + 1.5);
  }

  function setMode(m) {
    mode = m;
    applyMode();
  }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.value = m ? 0 : 0.85;
  }

  const ready = () => ctx && ctx.state !== 'suspended' && !muted;

  // 학교 종소리: 딩-동-댕-동 (네 음)
  function bell() {
    if (!ready()) return;
    const notes = [659.25, 523.25, 587.33, 392.0];
    notes.forEach((f, i) => {
      const t0 = ctx.currentTime + i * 0.62;
      [[1, 0.5], [2, 0.18], [2.76, 0.1]].forEach(([mul, vol]) => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f * mul;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0005, t0 + 1.9);
        o.connect(g).connect(master);
        o.start(t0);
        o.stop(t0 + 2);
      });
    });
  }

  // 책장 넘기는 소리
  function page(vol = 1) {
    if (!ready()) return;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = 1;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(1500, t0);
    bp.frequency.linearRampToValueAtTime(5200, t0 + 0.28);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.22 * vol, t0 + 0.06);
    g.gain.linearRampToValueAtTime(0.0, t0 + 0.34);
    src.connect(bp).connect(g).connect(master);
    src.start(t0, Math.random() * 1.5, 0.4);
  }

  // 연필로 쓰는 소리(짧게 사각사각)
  function pencil(vol = 1) {
    if (!ready()) return;
    const n = 3 + Math.floor(Math.random() * 3);
    let t = ctx.currentTime;
    for (let i = 0; i < n; i++) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 2800;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.07 * vol, t + 0.01);
      g.gain.linearRampToValueAtTime(0, t + 0.06);
      src.connect(hp).connect(g).connect(master);
      src.start(t, Math.random() * 1.5, 0.08);
      t += 0.07 + Math.random() * 0.05;
    }
  }

  // 기침 소리 (시험장의 흔한 소음)
  function cough(vol = 1) {
    if (!ready()) return;
    let t = ctx.currentTime;
    const n = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 520 + Math.random() * 200;
      bp.Q.value = 1.2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.28 * vol, t + 0.02);
      g.gain.linearRampToValueAtTime(0, t + 0.16);
      src.connect(bp).connect(g).connect(master);
      src.start(t, Math.random() * 1.5, 0.2);
      t += 0.22;
    }
  }

  // 의자 끄는 소리
  function chair(vol = 1) {
    if (!ready()) return;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t0);
    lp.frequency.linearRampToValueAtTime(300, t0 + 0.35);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.16 * vol, t0 + 0.05);
    g.gain.linearRampToValueAtTime(0, t0 + 0.4);
    src.connect(lp).connect(g).connect(master);
    src.start(t0, Math.random() * 1.5, 0.45);
  }

  // 안내방송 "딩동" / 급식 받을 때 "딩" 소리
  function tone(freqs, dur = 0.28, vol = 0.18) {
    if (!ready()) return;
    let t = ctx.currentTime;
    freqs.forEach((f) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + dur + 0.05);
      t += dur * 0.9;
    });
  }
  const chime = () => tone([784, 622, 698, 466], 0.32, 0.16); // 학교 방송 시작음 느낌
  const ding = () => tone([988], 0.4, 0.14);

  // 시험 중에는 가끔 책장·연필·기침·의자 소리가 나요 (매 프레임 불러줘요)
  function update(dt) {
    if (!ctx || mode !== 'exam') return;
    nextEventIn -= dt;
    if (nextEventIn <= 0) {
      nextEventIn = 5 + Math.random() * 9;
      const r = Math.random();
      if (r < 0.3) page(0.7);
      else if (r < 0.62) pencil(0.8);
      else if (r < 0.8) cough(0.6);
      else chair(0.6);
    }
  }

  return { unlock, setMode, setMuted, bell, page, pencil, cough, chair, chime, ding, update, isMuted: () => muted };
}

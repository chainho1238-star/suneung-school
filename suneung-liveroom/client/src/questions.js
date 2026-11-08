// 이 파일은 "시험 문제 10개"예요. 실제 수능 유형(독서·문학·문법 / 미적분·확률·수열 / 빈칸·순서·주제)을 본떠
// 이 서비스를 위해 직접 만든 문제라서 저작권 문제가 없어요.
// (실제 수능·모의고사 기출은 한국교육과정평가원 저작물이라, 쓰려면 이용 조건을 따로 확인해야 해요.)
// session: 0=국어, 1=수학, 2=영어, 3=한국사. no=전체 번호, n=그 과목 안에서의 번호(1번부터). answer는 정답 번호(1~5).

export const QUESTIONS = [
  // ---------- 1교시 국어 (1~4번) ----------
  {
    session: 0, subject: '국어', no: 1,
    passage:
      '경제학에서 ‘기회비용’은 어떤 선택을 하면서 포기한 여러 대안 중 가장 가치가 큰 것을 말한다. ' +
      '예를 들어 한 시간 동안 영화를 보는 대신 아르바이트를 하면 5천 원을 벌 수 있다면, 영화 관람의 기회비용은 5천 원이다. ' +
      '기회비용에는 직접 지불한 돈뿐 아니라 포기한 이익도 포함되므로, 겉으로 돈이 들지 않는 선택이라도 기회비용이 없다고 할 수 없다.',
    text: '윗글을 바탕으로 이해한 내용으로 적절한 것은?',
    choices: [
      '기회비용은 선택에 직접 지불한 금액만을 뜻한다.',
      '돈이 들지 않는 선택은 기회비용이 항상 0이다.',
      '포기한 대안이 여럿이면 그 가치를 모두 더한 것이 기회비용이다.',
      '무료 공연을 보러 가는 일에도 그 시간에 할 수 있었던 다른 일의 가치만큼 기회비용이 든다.',
      '아르바이트 대신 영화를 보면 기회비용은 영화표 값이다.',
    ],
    answer: 4,
    explain: '기회비용은 포기한 대안 중 가장 가치가 큰 것이에요. 무료여도 그 시간에 포기한 일이 있으니 기회비용이 있어요.',
  },
  {
    session: 0, subject: '국어', no: 2,
    passage:
      '저녁 버스 창가에\n이마를 대고 앉으면\n하루치 숫자들이\n김처럼 흩어진다.\n\n' +
      '오늘도 나는\n정답이 없는 문제를\n끝까지 풀었다고\n가만히 적어 본다.',
    text: '위 시에 대한 감상으로 가장 적절한 것은?',
    choices: [
      '명령적 어조로 강한 의지를 드러내고 있다.',
      '하루를 마친 화자가 스스로를 담담하게 위로하고 있다.',
      '대상과의 이별에서 오는 분노가 격렬하게 표출되어 있다.',
      '자연물을 의인화하여 미래를 예언하고 있다.',
      '후렴구의 반복으로 운율을 만들고 있다.',
    ],
    answer: 2,
    explain: '‘끝까지 풀었다고 가만히 적어 본다’에서 하루를 정리하며 자신을 다독이는 담담한 어조가 드러나요.',
  },
  {
    session: 0, subject: '국어', no: 3,
    text: '다음 단어의 발음에서 음운 변동이 일어나지 않는 것은?',
    choices: ['국물[궁물]', '낱말[난말]', '좋다[조타]', '밥상[밥쌍]', '하늘[하늘]'],
    answer: 5,
    explain: '국물(비음화), 낱말(음절의 끝소리 규칙+비음화), 좋다(거센소리되기), 밥상(된소리되기)은 모두 변동이 있어요. 하늘은 소리 그대로예요.',
  },
  {
    session: 0, subject: '국어', no: 4,
    passage:
      '수면 중 뇌는 낮 동안 들어온 정보를 정리한다. 특히 깊은 잠에서는 해마에 임시로 저장된 기억이 대뇌피질로 옮겨져 ' +
      '장기 기억이 된다. 따라서 시험 전날 밤을 새워 공부하면, 그 내용이 장기 기억으로 자리 잡을 기회가 줄어든다.',
    text: '윗글에서 추론할 수 있는 내용은?',
    choices: [
      '해마는 장기 기억을 영구히 보관하는 곳이다.',
      '깊은 잠은 기억이 자리 잡는 과정과 관련이 있다.',
      '밤샘 공부는 임시 저장 능력을 높여 준다.',
      '낮에는 해마가 작동하지 않는다.',
      '대뇌피질은 수면 중에만 활동한다.',
    ],
    answer: 2,
    explain: '깊은 잠에서 기억이 해마→대뇌피질로 옮겨져 장기 기억이 된다고 했으니 관련이 있어요. (수험생 꿀팁: 잠도 공부예요!)',
  },

  // ---------- 2교시 수학 (5~7번) ----------
  {
    session: 1, subject: '수학', no: 5,
    text: '함수 f(x) = x³ − 3x² + 2 의 극솟값은?',
    choices: ['−4', '−3', '−2', '−1', '0'],
    answer: 3,
    explain: "f'(x) = 3x(x−2) 이므로 x=2에서 극소예요. f(2) = 8 − 12 + 2 = −2.",
  },
  {
    session: 1, subject: '수학', no: 6,
    text: '서로 다른 주사위 2개를 동시에 던질 때, 나온 두 눈의 합이 8 이상일 확률은?',
    choices: ['1/3', '5/12', '1/2', '7/12', '2/3'],
    answer: 2,
    explain: '합이 8,9,10,11,12인 경우는 5+4+3+2+1 = 15가지. 전체 36가지 중 15/36 = 5/12.',
  },
  {
    session: 1, subject: '수학', no: 7,
    text: '등차수열 {aₙ} 에서 a₃ = 7, a₇ = 19 일 때, a₁₀ 의 값은?',
    choices: ['25', '26', '27', '28', '29'],
    answer: 4,
    explain: '공차 d = (19−7)/(7−3) = 3. a₁₀ = a₇ + 3d = 19 + 9 = 28.',
  },

  // ---------- 3교시 영어 (8~10번) ----------
  {
    session: 2, subject: '영어', no: 8,
    text: '다음 빈칸에 들어갈 말로 가장 적절한 것은?',
    passage:
      'Many people believe that talent alone leads to success. However, research shows that ________ matters far more. ' +
      'Those who keep practicing despite repeated failures eventually outperform gifted but less determined peers.',
    choices: ['persistence', 'luck', 'appearance', 'competition', 'imitation'],
    answer: 1,
    explain: '실패에도 계속 연습하는 사람이 결국 앞선다는 내용이므로 persistence(끈기)가 알맞아요.',
  },
  {
    session: 2, subject: '영어', no: 9,
    text: '주어진 글 다음에 이어질 글의 순서로 가장 적절한 것은?',
    passage:
      'Sleep is often the first thing students sacrifice before an exam.\n\n' +
      '(A) However, studies show that sleeping well improves memory and focus.\n' +
      '(B) As a result, many stay up late to study more.\n' +
      '(C) Students who sleep enough tend to recall more the next day, despite studying fewer hours.',
    choices: ['(A)-(C)-(B)', '(B)-(A)-(C)', '(B)-(C)-(A)', '(C)-(A)-(B)', '(C)-(B)-(A)'],
    answer: 2,
    explain: '주어진 글 → (B) 그 결과 밤샘 → (A) 하지만 잠이 기억에 좋다 → (C) 구체적 근거 순서예요.',
  },
  {
    session: 2, subject: '영어', no: 10,
    text: '다음 글의 주제로 가장 적절한 것은?',
    passage:
      'Small habits repeated every day shape who we become. Reading ten pages a night may seem trivial, but over a year it ' +
      'adds up to several books. Likewise, a minor daily lapse, left unchecked, can grow into a serious problem.',
    choices: [
      '작은 습관이 쌓여 큰 변화를 만든다',
      '독서는 시험 성적을 높인다',
      '큰 목표를 세우는 것이 중요하다',
      '실수는 즉시 사과해야 한다',
      '휴식은 생산성을 떨어뜨린다',
    ],
    answer: 1,
    explain: '매일의 작은 반복이 쌓여 큰 결과가 된다는 내용이에요.',
  },
  // ---------- 4교시 한국사 (11~12번) ----------
  {
    session: 3, subject: '한국사', no: 11,
    passage: '훈민정음을 창제하여 반포하였다. 집현전을 설치해 학문을 장려하였고, 4군 6진을 개척하여 영토를 넓혔다.',
    text: '위 설명에 해당하는 왕은?',
    choices: ['태조', '세종', '정조', '영조', '고종'],
    answer: 2,
    explain: '훈민정음 창제와 집현전, 4군 6진 개척은 세종의 업적이에요.',
  },
  {
    session: 3, subject: '한국사', no: 12,
    text: '다음 사건을 일어난 순서대로 옳게 나열한 것은?\n\n(가) 3·1 운동   (나) 4·19 혁명\n(다) 6·25 전쟁   (라) 8·15 광복',
    choices: ['(가)-(다)-(라)-(나)', '(가)-(라)-(다)-(나)', '(라)-(가)-(나)-(다)', '(가)-(나)-(라)-(다)', '(라)-(다)-(가)-(나)'],
    answer: 2,
    explain: '3·1 운동(1919) → 광복(1945) → 6·25 전쟁(1950) → 4·19 혁명(1960) 순서예요.',
  },
];

// 화면에 보이는 번호는 과목마다 1번부터 시작해요
{
  const count = {};
  QUESTIONS.forEach((q) => { count[q.session] = (count[q.session] || 0) + 1; q.n = count[q.session]; });
}

export const bySession = (s) => QUESTIONS.filter((q) => q.session === s);

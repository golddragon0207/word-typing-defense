/**
 * ==========================================
 * Word Typing Defense - WordPacks & Hangul Utility
 * ==========================================
 * 2단 몬스터 데이터(닉네임/제시어) 분리 공급,
 * 실시간 채팅 시청자 대기열(Queue) 관리,
 * 비속어 필터링, 한글 자모 분해 및 정밀 획수 계산 유틸리티를 제공합니다.
 */

const wordPacks = {
  // 1. 기본 게임 타깃 제시어 데이터베이스 (밈, 게임 용어, 개발 단어 등)
  words: [
    "치지직", "아프리카", "스트리머", "나이스샷", "크리티컬",
    "타자왕", "디펜스", "키보드", "마우스", "레벨업",
    "헤드샷", "클리어", "게임오버", "피버모드", "보스몬스터",
    "알고리즘", "자바스크립트", "캔버스", "웹게임", "트래픽",
    "구독자", "후원하기", "채팅창", "영도", "하이라이트"
  ],

  // 1-1. 선택형 프리셋 단어 팩 (모달 > 단어/닉네임 팩 설정에서 선택)
  presetPacks: {
    mixed: null, // null = 기본 words 배열 그대로 사용
    memes: [
      "구독과좋아요", "오타내지마라", "쀍", "어쩔티비", "뇌절금지",
      "이게맞냐", "억까자제", "스트리머능지", "개같이부활", "나만아니면돼",
      "가즈아", "킹받네", "무한제공참말사", "알빠임", "개추",
      "비추", "방종각", "실수다", "치트키", "멘탈바사삭", "개꿀잼"
    ],
    hardcore: [
      "간장공장공장장", "경찰청철창살", "저기저뜀틀은",
      "안촉촉한초콜릿촉촉촉촉한초콜릿", "서울특별시특별시민",
      "역경을거꾸로하면경력이된다", "신라면과진라면", "칠월칠일",
      "홍삼홍삼황홍삼", "육개장과닭개장"
    ],
    spelling: [
      "어의없다X어이없다O", "몇일X며칠O", "왠지O웬지X",
      "설레임X설렘O", "돼다X되다O", "웬만하면", "역할O역활X",
      "안돼요O안되요X", "찌개O찌게X", "금세O금새X"
    ],
    english: [
      "javascript", "canvas", "keyboard", "developer", "algorithm",
      "streamer", "defense", "critical", "combo", "victory"
    ]
  },

  // 2. 보스전 전용 단어 팩 (Stage 5, 10, 15...)
  bossWords: [
    "방열판작동불가", "시스템전면마비", "네트워크접속초과",
    "최종방어선돌파", "서버데이터손실", "트래픽대폭발"
  ],

  // 3. 가상 시청자 닉네임 팩 ([BOT] 생성용)
  botNicknames: [
    "자동소환봇", "알고리즘봇", "시청자봇", "방관자봇",
    "매니저봇", "채팅봇", "연습용봇", "도우미봇"
  ],

  // 4. 실시간 방송 채팅으로 들어온 시청자 대기열 (Queue)
  //    - chatIntegration.js가 processChatMessage()를 통해 여기에 적재하고,
  //    - MonsterManager가 getNextMonsterData()를 호출할 때마다 하나씩 소비합니다.
  viewerQueue: [],
  // 대기열(순번 대기) 상한. 화면 동시 15마리 + 대기 30명 = 순간 최대 45명이 파이프라인에 참여.
  // 초과 시 가장 오래된 대기자부터 밀려나며, 봇 보충 목표(TARGET_MIN_POPULATION)는 이보다 작아야
  // 봇이 실참여자를 밀어내지 않는다 (30 > 20 여유 확보).
  MAX_QUEUE_LENGTH: 30,
  // 한 시청자가 큐에 동시에 대기할 수 있는 최대 항목 수 (도배로 큐 독점 방지). [BOT]은 예외.
  MAX_QUEUE_PER_VIEWER: 2,

  // `!참여`로 들어온 시청자만 라이브 채팅 제시어 후보가 될 수 있습니다.
  // Set에는 플랫폼 접두사가 포함된 닉네임을 저장해 플랫폼 간 동명이인도 구분합니다.
  joinedViewers: new Set(),

  // '!참여' 실시간 참가자 누적 카운트 (통계용) 및 최소 유지 인원(부족분은 봇으로 보충)
  // ※ 이 값은 '실참여자가 적을 때 봇으로 채우는 최소 기준선'일 뿐, 실참여자 수를 제한하지 않음
  //   (실참여자는 대기열에 계속 쌓이고 항상 봇보다 먼저 소환됨 — getNextMonsterData 참고)
  realParticipantCount: 0,
  TARGET_MIN_POPULATION: 20,

  // 💬 라이브 채팅 모드 (하이브리드): 켜면 시청자가 실제로 채팅에 친 문구가
  // (안전하게 정제된 뒤) 타이핑 타깃 단어로 쓰인다. 끄면 항상 단어팩에서만 뽑힘.
  // 상단 컨트롤바의 "💬 라이브 채팅 모드" 버튼으로 게임 중에도 즉시 켜고 끌 수 있다.
  liveChatMode: false,
  liveChatMaxLen: 10,        // 라이브 채팅 문구 최대 글자수 (단어팩 모달에서 조정 가능)
  liveChatStripSpecial: true, // 이모티콘/특수문자 제거 여부 (단어팩 모달에서 조정 가능)

  // 🔥 다음 몬스터 자리를 두고 시청자들이 채팅으로 경쟁하는 "후보" 슬롯 (마지막 채팅이 덮어씀).
  // 몬스터가 소환되는 순간 이 후보가 확정되어 그 몬스터로 등장하고, 후보는 비워져 새 경쟁이 시작된다.
  // { nickname, chatWord } 또는 null.
  liveCandidate: null,

  // 5. 비속어/욕설 간이 필터 목록 (마스킹 처리)
  badWords: [
    "씨발", "시발", "병신", "개새끼", "좆", "존나", "지랄",
    "닥쳐", "미친놈", "미친년", "새끼", "느금", "니미"
  ],

  /**
   * 🧹 비속어 필터링: 목록에 포함된 단어를 '*' 처리
   * @param {string} text
   * @returns {string}
   */
  filterText(text) {
    if (!text) return text;
    let result = String(text);
    this.badWords.forEach(bad => {
      if (!bad) return;
      const masked = '*'.repeat(bad.length);
      result = result.split(bad).join(masked);
    });
    return result;
  },

  /**
   * 📡 실시간 채팅 메시지 수신 처리 (chatIntegration.js에서 호출)
   * - '!참여' 단일 명령어 입력 시 시청자 대기열(Queue)에 자동 등록
   * - 비속어 필터링 적용
   * - 💬 라이브 채팅 모드가 켜져 있으면, 채팅 원문을 정제해서 타이핑 타깃으로도 함께 저장
   * @param {string} nickname - 채팅 발화 시청자 닉네임(플랫폼 접두사 포함)
   * @param {string} messageText - 채팅 원문
   * @param {boolean} keywordOnly - true면 '!참여' 명령어 입력자만 등록
   */
  processChatMessage(nickname, messageText, keywordOnly = false) {
    if (!nickname) return false;

    const msg = (messageText || '').trim();
    const hasJoinCommand = /!참여/.test(msg);
    const safeNickname = this.filterText(nickname).slice(0, 20);

    // 1) `!참여`를 친 시청자만 참가자 명단에 등록하고, 우선 일반 단어팩 몬스터로 한 번 소환합니다.
    if (hasJoinCommand) {
      const wasJoined = this.joinedViewers.has(safeNickname);
      this.joinedViewers.add(safeNickname);
      this.enqueueViewer(safeNickname);
      if (!wasJoined) this.realParticipantCount += 1;
      return true;
    }

    // 2) 🔥 라이브 채팅 모드: 이미 `!참여`한 시청자의 후속 채팅은 "다음 몬스터 자리"를 두고 경쟁한다.
    //    큐에 바로 넣지 않고 경쟁 후보(liveCandidate)를 덮어써서, 마지막에 친 시청자가 승자가 된다.
    //    (미참여자의 일반 채팅은 절대 후보가 되지 않음)
    if (this.liveChatMode && this.joinedViewers.has(safeNickname)) {
      const chatWord = this.sanitizeLiveChatWord(msg);
      if (!chatWord) return false;
      this.liveCandidate = { nickname: safeNickname, chatWord };
      return true;
    }

    // 호환성 옵션: 라이브 모드가 꺼졌고 명령어 전용 체크도 해제된 경우에만 닉네임 몬스터를 허용.
    // 라이브 채팅 제시어 후보는 항상 위의 `!참여` 등록자에게만 제한됩니다.
    if (!this.liveChatMode && !keywordOnly) {
      this.enqueueViewer(safeNickname);
      return true;
    }

    return false;
  },

  /**
   * 💬 라이브 채팅 원문을 안전한 타이핑 타깃으로 정제
   * - '!참여' 명령어 토큰 제거
   * - (설정 시) 한글/영문/숫자 외 문자(이모티콘, 특수문자 등) 제거
   * - 비속어 필터링
   * - 최대 글자수로 자르기
   * 결과가 빈 문자열이면 null에 준하는 빈 값을 반환 → 호출부에서 단어팩으로 자동 폴백
   * @param {string} rawText
   * @returns {string}
   */
  sanitizeLiveChatWord(rawText) {
    if (!rawText) return '';
    let cleaned = String(rawText).replace(/!참여/g, '').trim();

    if (this.liveChatStripSpecial) {
      cleaned = cleaned.replace(/[^가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9\s]/g, '').trim();
    }

    cleaned = this.filterText(cleaned).trim();
    if (cleaned.length > this.liveChatMaxLen) cleaned = cleaned.slice(0, this.liveChatMaxLen);

    return cleaned;
  },

  /**
   * 시청자 대기열에 닉네임(+선택적으로 라이브 채팅 원문) 추가
   * (최대 길이 초과 시 오래된 것부터 제거)
   * @param {string} nickname
   * @param {string|null} chatWord - 라이브 채팅 모드일 때 이 시청자의 정제된 채팅 문구 (없으면 null)
   */
  enqueueViewer(nickname, chatWord = null) {
    if (!nickname) return false;

    // 실참여자(비봇)는 1인당 큐 대기 상한 적용 → 한 명이 도배해도 큐를 독점하지 못함
    // ([BOT]은 물량 보충용이라 예외로 중복 허용)
    if (!nickname.startsWith('[BOT]')) {
      let count = 0;
      for (const e of this.viewerQueue) {
        if (e.nickname === nickname) count++;
      }
      if (count >= this.MAX_QUEUE_PER_VIEWER) return false;
    }

    this.viewerQueue.push({ nickname, chatWord });
    if (this.viewerQueue.length > this.MAX_QUEUE_LENGTH) {
      this.viewerQueue.shift();
    }
    return true;
  },

  /**
   * 🤖 실시간 참여 인원 자동 보충: '!참여' 참가자가 목표 인원보다 적으면
   * 부족한 만큼 [BOT] 가상 시청자를 대기열에 채워 넣어 몬스터 물량을 유지한다.
   * @param {number} target - 유지하고 싶은 최소 동시 대기 인원 (기본 8명)
   */
  topUpBotsToTarget(target = this.TARGET_MIN_POPULATION) {
    const shortage = target - this.viewerQueue.length;
    if (shortage <= 0) return 0;

    for (let i = 0; i < shortage; i++) {
      const botName = this.botNicknames[Math.floor(Math.random() * this.botNicknames.length)];
      this.enqueueViewer(`[BOT] ${botName}`);
    }
    return shortage;
  },

  /**
   * 현재 선택된 프리셋/커스텀 단어 배열 반환
   */
  getActiveWords() {
    return (this._customWords && this._customWords.length > 0) ? this._customWords : this.words;
  },

  /**
   * 프리셋 팩 적용 (모달 > 단어팩 선택)
   * @param {string} packKey - 'mixed' | 'memes' | 'hardcore' | 'spelling' | 'english'
   */
  applyPresetPack(packKey) {
    const preset = this.presetPacks[packKey];
    this._customWords = Array.isArray(preset) && preset.length > 0 ? preset : null;
  },

  /**
   * 📋 미리보기용: 특정 프리셋 팩에 실제로 들어있는 단어 목록 반환
   * ('mixed'이거나 등록되지 않은 키면 기본 words 배열을 반환)
   * @param {string} packKey
   * @returns {Array<string>}
   */
  getPackWords(packKey) {
    const preset = this.presetPacks[packKey];
    return Array.isArray(preset) && preset.length > 0 ? preset : this.words;
  },

  /**
   * 2단 몬스터 데이터 생성 (상단 닉네임 + 하단 제시어)
   * - 실시간 채팅 대기열에 시청자가 있으면 우선 소비, 없으면 [BOT] 표식 부여
   * - 💬 라이브 채팅 모드로 등록된 시청자면 실제 채팅 문구를, 아니면 단어팩 단어를 제시어로 사용
   * @param {string|null} customNickname - 강제 지정 닉네임 (선택)
   * @returns {Object} { nickname, isBot, word, isLiveChat }
   */
  getNextMonsterData(customNickname = null) {
    // 🔥 라이브 경쟁: 소환 순간 경쟁 후보가 있으면 그 승자(마지막 채팅)가 이 몬스터로 확정된다.
    if (!customNickname && this.liveChatMode && this.liveCandidate && this.liveCandidate.chatWord) {
      const winner = this.liveCandidate;
      this.liveCandidate = null; // 확정 후 후보 비움 → 다음 경쟁 시작
      return {
        nickname: winner.nickname,
        isBot: false,
        word: winner.chatWord,
        isLiveChat: true
      };
    }

    let nickname = customNickname;
    let isBot = false;
    let chatWord = null;

    if (!nickname) {
      if (this.viewerQueue.length > 0) {
        // 🟢 실시간 채팅으로 참여한 실제 시청자 우선 소환
        const entry = this.viewerQueue.shift();
        nickname = entry.nickname;
        chatWord = entry.chatWord;
      } else {
        // 🤖 Smart Fallback: 대기 중인 실시청자가 없으면 가상 [BOT] 시청자 자동 소환
        const randomBotName = this.botNicknames[Math.floor(Math.random() * this.botNicknames.length)];
        nickname = `[BOT] ${randomBotName}`;
        isBot = true;
      }
    }

    const activeWords = this.getActiveWords();
    const randomWord = activeWords[Math.floor(Math.random() * activeWords.length)];

    return {
      nickname: nickname,
      isBot: isBot,
      word: chatWord || randomWord,
      isLiveChat: !!chatWord
    };
  },

  /**
   * 보스전 전용 제시어 반환
   */
  getBossWord() {
    return this.bossWords[Math.floor(Math.random() * this.bossWords.length)];
  },

  /**
   * 한글 초성/중성/종성 자모 획수 정밀 분석 유틸리티
   * @param {string} text - 분석할 단어
   * @returns {number} 총 자모 획수
   */
  getHangulStrokeCount(text) {
    if (!text) return 0;

    // 초성 19개 획수 (ㄱ ㄲ ㄴ ㄷ ㄸ ㄹ ㅁ ㅂ ㅃ ㅅ ㅆ ㅇ ㅈ ㅉ ㅊ ㅋ ㅌ ㅍ ㅎ)
    const initialStrokes = [1, 2, 1, 2, 4, 3, 3, 4, 8, 2, 4, 1, 2, 4, 3, 2, 3, 4, 3];

    // 중성 21개 획수 (ㅏ ㅐ ㅑ ㅐ ㅓ ㅔ ㅕ ㅖ ㅗ ㅘ ㅙ ㅚ ㅛ ㅜ ㅝ ㅞ ㅟ ㅠ ㅡ ㅢ ㅣ)
    const medialStrokes = [2, 3, 3, 4, 2, 3, 3, 4, 2, 4, 5, 3, 3, 2, 4, 5, 3, 3, 1, 2, 1];

    // 종성 28개 획수 (없음, ㄱ, ㄲ, ㄳ, ㄴ, ㄵ, ㄶ, ㄷ, ㄹ, ㄺ, ㄻ, ㄼ, ㄽ, ㄾ, ㄿ, ㅀ, ㅁ, ㅂ, ㅄ, ㅅ, ㅆ, ㅇ, ㅈ, ㅊ, ㅋ, ㅌ, ㅍ, ㅎ)
    const finalStrokes = [0, 1, 2, 3, 1, 3, 4, 2, 3, 4, 6, 7, 5, 5, 7, 6, 3, 4, 6, 2, 4, 1, 2, 3, 2, 3, 4, 3];

    let totalStrokes = 0;

    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);

      // 한글 가음절 완성형 범위 (가 ~ 힣)
      if (charCode >= 0xac00 && charCode <= 0xd7a3) {
        const hangulIndex = charCode - 0xac00;

        const initialIndex = Math.floor(hangulIndex / 588);
        const medialIndex = Math.floor((hangulIndex % 588) / 28);
        const finalIndex = hangulIndex % 28;

        totalStrokes += initialStrokes[initialIndex] || 1;
        totalStrokes += medialStrokes[medialIndex] || 1;
        totalStrokes += finalStrokes[finalIndex] || 0;
      }
      // 알파벳, 숫자, 특수문자 기본 처리
      else if ((charCode >= 65 && charCode <= 90) || (charCode >= 97 && charCode <= 122)) {
        totalStrokes += 1; // 영문 1타
      } else {
        totalStrokes += 1; // 기본 1타
      }
    }

    return totalStrokes;
  }
};

// 전역 객체 바인딩
window.wordPacks = wordPacks;

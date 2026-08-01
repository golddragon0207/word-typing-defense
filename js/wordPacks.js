/* ==========================================================================
   STREAMER WORD DEFENSE - WORD PACKS & CUSTOM LIST MANAGER
   ========================================================================== */

const WORD_PACKS = {
  // 1. 방송 밈 및 유행어 팩
  memes: [
    "구독과좋아요", "알림설정", "치킨사주세요", "오타내지마라", "억까전문가",
    "김유튜브", "치지직짱짱맨", "숲속의아이", "비상사태", " 레전드방송",
    "트위치그립다", "채팅화력폭발", "피버모드온", "대회우승가자", "스트리머리액션",
    "하트뿅뿅", "슈퍼챗발사", "별풍선100개", "치즈1000개", "어이쿠실수"
  ],

  // 2. 오타 유발 억까 매운맛 팩
  hardcore: [
    "쀍", "뙈", "똠양꿍", "C++", "querySelector", "0x1F3",
    "뛔뛔뛔", "옾", "뷁", "낢", "쓔", "JavaScript",
    "async/await", "flex-direction", "rgba(0,243,255)", "ㄹㅇㅋㅋ", "ㄱ깪",
    "쀼쀼", "뽈뽈뽈", "쯧쯧", "쩨쩨", "뚬칫뚬칫"
  ],

  // 3. 자주 틀리는 맞춤법 & 밈 퀴즈 팩
  spelling: [
    "어이없다", "금세", "요새", "희한하다", "무난하다",
    "설렘", "움켜쥐다", "웬일인지", "문안인사", "결단코",
    "나지막이", "다디단", "설레다", "어리바리", "오뚝이"
  ],

  // 4. 영문 & 기술 용어 팩
  english: [
    "CYBERPUNK", "OVERLAY", "STREAMER", "VICTORY", "DEFENSE",
    "COMBO", "FEVER", "SYNTHESIZER", "CANVAS", "TURRET",
    "LASER", "EXPLOSION", "CHZZK", "YOUTUBE", "AFREECA"
  ]
};

class WordPackManager {
  constructor() {
    this.currentPack = 'mixed';
    this.customWords = [];
    this.viewerQueue = [];
    this.fallbackNicknames = [
      "🟢 억까의신", "🔵 SOOP팬클럽1등", "🔴 유튜브구독자", "💬 방송애청자",
      "🟢 치지직시청자A", "🔵 숲속의라이더", "🔴 슈퍼챗1만원", "💜 트위치난민",
      "🟢 타자왕김스트리머", "🔵 오타유발자", "🔴 구독알림완료", "💬 억까전문가"
    ];
  }

  setPack(packName) {
    this.currentPack = packName;
  }

  setCustomWords(wordListArray) {
    this.customWords = wordListArray.filter(w => w.trim().length > 0);
  }

  // 복사한 방송 채팅 텍스트([14:20] 닉네임: 메시지) 지능형 자동 파싱 및 정제기
  parseAndAddCustomChatText(rawText) {
    if (!rawText || rawText.trim().length === 0) return { nickCount: 0, wordCount: 0 };

    const lines = rawText.split('\n');
    let nickCount = 0;
    let wordCount = 0;

    lines.forEach(line => {
      let cleanLine = line.trim();
      if (!cleanLine) return;

      // 타임스탬프 패턴([14:20], 14:20:05 등) 제거
      cleanLine = cleanLine.replace(/^\[?\d{1,2}:\d{2}(:\d{2})?(\s?[AP]M)?\]?\s*/i, '');

      // 콜론(:) 또는 대괄호(]) 구분자 추출
      if (cleanLine.includes(':')) {
        const parts = cleanLine.split(':');
        const nick = parts[0].trim();
        const msg = parts.slice(1).join(':').trim();

        if (nick.length > 0) {
          this.addViewerNickname(`💬 ${nick}`, msg);
          nickCount++;
        }
        if (msg.length > 0 && msg.length <= 15) {
          this.customWords.push(msg);
          wordCount++;
        }
      } else if (cleanLine.includes(']')) {
        const parts = cleanLine.split(']');
        const nick = parts[0].replace('[', '').trim();
        const msg = parts.slice(1).join(']').trim();

        if (nick.length > 0) {
          this.addViewerNickname(`💬 ${nick}`, msg);
          nickCount++;
        }
        if (msg.length > 0 && msg.length <= 15) {
          this.customWords.push(msg);
          wordCount++;
        }
      } else {
        // 일반 텍스트 라인
        this.customWords.push(cleanLine);
        wordCount++;
      }
    });

    return { nickCount, wordCount };
  }

  addViewerNickname(nickname, text = "") {
    this.viewerQueue.push({
      nickname: nickname,
      text: text
    });
  }

  getNextMonsterData() {
    let viewerNick = "";
    // 1. 시청자 대기 큐에서 시청자 닉네임 가져오기
    if (this.viewerQueue.length > 0 && Math.random() < 0.8) {
      const item = this.viewerQueue.shift();
      viewerNick = item.nickname;
    } else {
      viewerNick = this.fallbackNicknames[Math.floor(Math.random() * this.fallbackNicknames.length)];
    }

    // 2. 스트리머가 실제로 입력할 clean 타깃 제시어 구하기
    let targetWord = "";
    if (this.customWords.length > 0 && Math.random() < 0.6) {
      targetWord = this.customWords[Math.floor(Math.random() * this.customWords.length)];
    } else {
      let pool = [];
      if (this.currentPack === 'mixed') {
        pool = [...WORD_PACKS.memes, ...WORD_PACKS.hardcore, ...WORD_PACKS.spelling, ...WORD_PACKS.english];
      } else if (WORD_PACKS[this.currentPack]) {
        pool = WORD_PACKS[this.currentPack];
      } else {
        pool = WORD_PACKS.memes;
      }
      targetWord = pool[Math.floor(Math.random() * pool.length)];
    }

    return {
      viewerNick: viewerNick,
      targetWord: targetWord
    };
  }

  getRandomWord() {
    return this.getNextMonsterData().targetWord;
  }
}

const wordManager = new WordPackManager();


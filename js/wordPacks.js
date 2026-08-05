/**
 * ==========================================
 * Word Typing Defense - WordPacks & Hangul Utility
 * ==========================================
 * 2단 몬스터 데이터(닉네임/제시어) 분리 공급,
 * 한글 자모 분해 및 정밀 획수 계산 유틸리티를 제공합니다.
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

  /**
   * 2단 몬스터 데이터 생성 (상단 닉네임 + 하단 제시어)
   * @param {string|null} customNickname - 실시간 방송 채팅 연동 닉네임 (없을 시 BOT 처리)
   * @returns {Object} { nickname, isBot, word }
   */
  getNextMonsterData(customNickname = null) {
    let nickname = customNickname;
    let isBot = false;

    // 시청자 닉네임이 없으면 [BOT] 표식을 붙인 가상 시청자 닉네임 부여
    if (!nickname) {
      const randomBotName = this.botNicknames[Math.floor(Math.random() * this.botNicknames.length)];
      nickname = `[BOT] ${randomBotName}`;
      isBot = true;
    }

    // 랜덤 clean 제시어 선택
    const randomWord = this.words[Math.floor(Math.random() * this.words.length)];

    return {
      nickname: nickname,
      isBot: isBot,
      word: randomWord
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
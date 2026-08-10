/**
 * ==========================================
 * Word Typing Defense - WordPacks & Hangul Utility
 * ==========================================
 * 2단 몬스터 데이터(닉네임/제시어) 분리 공급,
 * 실시간 채팅 시청자 대기열(Queue) 관리,
 * 비속어 필터링, 한글 자모 분해 및 정밀 획수 계산 유틸리티를 제공합니다.
 */

// ⚙️ 시청자 참여/대기열 튜닝 값은 config.js의 CONFIG.QUEUE 한 곳에서 관리한다 (아래 메서드들이 참조).

// 🔢 한글 자모 획수/타수 계산용 상수 (호출마다 재생성하지 않도록 모듈 스코프로 승격).
//    getHangulStrokeCount(스폰마다) · getKeystrokeCount(명중마다·보스 차지 역산) 핫패스에서 참조.
// 초성 19개 획수 (ㄱ ㄲ ㄴ ㄷ ㄸ ㄹ ㅁ ㅂ ㅃ ㅅ ㅆ ㅇ ㅈ ㅉ ㅊ ㅋ ㅌ ㅍ ㅎ)
const HANGUL_INITIAL_STROKES = [1, 2, 1, 2, 4, 3, 3, 4, 8, 2, 4, 1, 2, 4, 3, 2, 3, 4, 3];
// 중성 21개 획수 (ㅏ ㅐ ㅑ ㅒ ㅓ ㅔ ㅕ ㅖ ㅗ ㅘ ㅙ ㅚ ㅛ ㅜ ㅝ ㅞ ㅟ ㅠ ㅡ ㅢ ㅣ)
const HANGUL_MEDIAL_STROKES = [2, 3, 3, 4, 2, 3, 3, 4, 2, 4, 5, 3, 3, 2, 4, 5, 3, 3, 1, 2, 1];
// 종성 28개 획수 (없음, ㄱ, ㄲ, ㄳ, ㄴ, ㄵ, ㄶ, ㄷ, ㄹ, ㄺ, ㄻ, ㄼ, ㄽ, ㄾ, ㄿ, ㅀ, ㅁ, ㅂ, ㅄ, ㅅ, ㅆ, ㅇ, ㅈ, ㅊ, ㅋ, ㅌ, ㅍ, ㅎ)
const HANGUL_FINAL_STROKES = [0, 1, 2, 3, 1, 3, 4, 2, 3, 4, 6, 7, 5, 5, 7, 6, 3, 4, 6, 2, 4, 1, 2, 3, 2, 3, 4, 3];
// 타수(자소 단위) 계산: 두 자모 조합이라 2타로 세는 겹모음/겹받침 인덱스 집합
const HANGUL_MEDIAL_DOUBLE = new Set([9, 10, 11, 14, 15, 16, 19]);              // ㅘㅙㅚㅝㅞㅟㅢ
const HANGUL_FINAL_DOUBLE = new Set([3, 5, 6, 9, 10, 11, 12, 13, 14, 15, 18]); // 겹받침

const wordPacks = {
  // 1. 기본 게임 타깃 제시어 데이터베이스 (밈, 게임/방송 용어, 일상어 등 다양하게 혼합)
  //    ⚠️ 다양성이 핵심 — 짧은 말(2자)부터 상한(6자)까지 길이를 골고루 섞어 밸런스 측정/체감을 넓힌다.
  //    (별도 JSON 없이 여기 배열만 늘리면 정적 사이트에서 fetch 없이 즉시 반영된다)
  words: [
    // 📺 방송/스트리밍
    "치지직", "아프리카", "스트리머", "구독자", "후원하기",
    "채팅창", "채널구독", "실시간", "방송사고", "도네이션",
    "시청자", "팔로우", "다시보기", "본방사수", "이모티콘",
    "별풍선", "구독료", "라이브", "인방", "합방",
    "하이라이트", "실시간방송", "시청자참여", "스트리머님", "방송종료각",
    "게임스트리머", "실시간채팅창",

    // 🎮 게임/타자
    "나이스샷", "크리티컬", "타자왕", "디펜스", "레벨업",
    "헤드샷", "클리어", "게임오버", "피버모드", "중간보스",
    "리스폰", "콤보", "버프", "너프", "만렙",
    "노데스", "스피드런", "하드코어", "랭킹전", "일격필살",
    "보스몬스터", "크리티컬샷", "게임오버각", "스피드클리어", "일격필살기",

    // 💻 개발/기술
    "알고리즘", "스크립트", "캔버스", "웹게임", "트래픽",
    "코딩", "버그수정", "데이터", "서버", "네트워크",
    "프로그램", "업데이트", "메모리", "브라우저", "픽셀",
    "자바스크립트", "데이터베이스", "네트워크오류", "프로그래머", "버그리포트",
    "알고리즘문제", "브라우저게임",

    // 🍜 음식/일상
    "떡볶이", "치킨", "삼겹살", "김치찌개", "라면",
    "카페라떼", "붕어빵", "마라탕", "곱창", "탕수육",
    "커피한잔", "야식타임", "물한잔", "낮잠", "운동",
    "아메리카노", "삼겹살구이", "치킨한마리", "떡볶이세트", "마라탕세트",
    "김치찌개백반", "아이스라떼",

    // 😆 밈/유행어(가벼운 것)
    "가즈아", "킹받네", "개추", "레게노", "어쩔티비",
    "실화냐", "폼미쳤다", "빼박", "갓겜", "국룰",
    "완전킹받네", "럭키비키", "레전드각",

    // 🌤️ 자연/생활 명사
    "무지개", "소나기", "고양이", "강아지", "바닷가",
    "벚꽃", "단풍", "첫눈", "별똥별", "구름다리",
    "자전거", "지하철", "우산", "여행가방", "손난로",
    "무지개다리", "첫눈오는날", "자전거여행", "바닷가노을", "단풍구경",
    "바닷가산책로", "자전거하이킹"
  ],

  // 1-1. 선택형 프리셋 단어 팩 (모달 > 단어/닉네임 팩 설정에서 선택)
  presetPacks: {
    mixed: null, // null = 기본 words 배열 그대로 사용
    // 🟢 몬스터 팩은 전부 6글자 이하로 통일(밸런스 균일화). 기본 words와 동일 규칙.
    memes: [
      "좋댓구독", "오타주의", "쀍", "어쩔티비", "뇌절금지",
      "이게맞냐", "억까자제", "능지폭발", "부활각", "내로남불",
      "가즈아", "킹받네", "참교육", "알빠임", "개추",
      "비추", "방종각", "실수다", "치트키", "멘붕각", "개꿀잼",
      "구독과좋아요", "오타내지마라", "스트리머능지", "개같이부활",
      "나만아니면돼", "멘탈바사삭", "무야호", "갓생살기"
    ],
    // 잰말놀이 컨셉 유지하되 6글자 이하로 통일.
    hardcore: [
      "간장공장장", "경찰청철창살", "저기저뜀틀은",
      "내가그린기린", "서울특별시민",
      "앞집콩죽팥죽", "신라면진라면", "칠월칠일",
      "홍삼황홍삼", "육개장닭개장"
    ],
    // 맞춤법 O/X 퀴즈 컨셉: 글자수·X/O 표기는 교육용이라 규칙에서 예외로 둔다.
    spelling: [
      "어의없다X어이없다O", "몇일X며칠O", "왠지O웬지X",
      "설레임X설렘O", "돼다X되다O", "웬만하면", "역할O역활X",
      "안돼요O안되요X", "찌개O찌게X", "금세O금새X"
    ],
    // 영타 컨셉 유지하되 6글자 이하로 통일.
    english: [
      "kernel", "canvas", "cursor", "shell", "debug",
      "stream", "server", "buffer", "combo", "pixel"
    ]
  },

  // 2. 보스전 전용 단어 팩 (Stage 5, 10, 15...)
  //    ⚠️ 밸런스: 전부 정확히 8글자 한글로 통일(몬스터 6글자보다 길게)해 보스전 난도를 균일화.
  //    '시스템 붕괴' 테마를 유지하되 소재를 다양하게 섞어 반복 체감을 줄인다.
  //    (팩 난도 구분 없이 모든 팩이 이 한 세트를 공유 — 차지 시간은 _bossChargeMs가 타수로 자동 역산)
  bossWords: [
    // 🖥️ 서버/인프라 붕괴
    "네트워크접속초과", "네트워크전면마비", "서버전면다운발생", "커널패닉연쇄발생",
    "시스템전면붕괴됨", "트래픽대폭발발생", "데이터전량손실됨", "메모리누수폭증됨",
    // 🔒 보안/침투
    "백신엔진무력화됨", "루트권한탈취완료", "암호화키전량유출", "백도어침투성공됨",
    "권한상승공격탐지", "랜섬웨어전면감염", "침입탐지기능정지", "보안체계전면돌파",
    // ⚙️ 시스템 과부하/오작동
    "캐시일관성붕괴됨", "무한루프과부하됨", "코어온도임계돌파", "백업서버동시다운",
    "동기화충돌연쇄됨", "버퍼오버플로우됨", "방화벽동시붕괴됨", "제어권한전량상실",
    // 🚨 긴급/최종
    "긴급복구전면실패", "통신프로토콜교란", "최종병기가동준비", "전원공급전면차단"
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

  // `!참여`로 들어온 시청자만 라이브 채팅 제시어 후보가 될 수 있습니다.
  // Set에는 플랫폼 접두사가 포함된 닉네임을 저장해 플랫폼 간 동명이인도 구분합니다.
  joinedViewers: new Set(),

  // 💬 라이브 채팅 모드 (하이브리드): 켜면 시청자가 실제로 채팅에 친 문구가
  // (안전하게 정제된 뒤) 타이핑 타깃 단어로 쓰인다. 끄면 항상 단어팩에서만 뽑힘.
  // 상단 컨트롤바의 "💬 라이브 채팅 모드" 버튼으로 게임 중에도 즉시 켜고 끌 수 있다.
  liveChatMode: false,
  liveChatMaxLen: 6,         // 라이브 채팅 문구 최대 글자수 (몬스터 밸런스에 맞춰 6자 고정 — 조정 UI 없음)
  liveChatStripSpecial: true, // 한글만 남기기(영문·숫자·이모티콘·특수문자 제거) 여부 (true 고정 — 조정 UI 없음)

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
   * - '!참여' 입력 시 참가자 명단(joinedViewers)에 등록. 일반 모드는 즉시 단어팩 랜덤 몬스터로 소환하고,
   *   라이브 채팅 모드는 등록만 하고 랜덤 몬스터를 띄우지 않는다(진짜 한글 채팅만 타깃이 되도록).
   * - '!참여'하지 않은 시청자의 일반 채팅은 무시(라이브 모드 여부와 무관)
   * - 비속어 필터링 적용
   * - 💬 라이브 채팅 모드가 켜져 있으면, '!참여' 등록자의 후속 채팅 원문을 정제해 타이핑 타깃으로 저장
   *   (게임 상태 게이트 없음 — 홈 화면·게임 중·일시정지 어디서든 등록은 받는다. 홈에선 대기열에 쌓이기만 하고
   *    실제 몬스터 스폰은 MonsterManager가 도는 PLAYING 구간에서 이뤄진다.)
   * @param {string} nickname - 채팅 발화 시청자 닉네임(플랫폼 접두사 포함)
   * @param {string} messageText - 채팅 원문
   */
  processChatMessage(nickname, messageText) {
    if (!nickname) return false;

    const msg = (messageText || '').trim();
    const hasJoinCommand = /!참여/.test(msg);
    const safeNickname = this.filterText(nickname).slice(0, 20);

    // 1) `!참여`를 친 시청자를 참가자 명단에 등록한다.
    //    - 일반(비-라이브) 모드: 등록과 동시에 단어팩 랜덤 몬스터로 한 번 소환(기존 참여 연출).
    //    - 💬 라이브 채팅 모드: 등록만 하고 랜덤 몬스터는 띄우지 않는다. 그 시청자가 '한글 채팅'을
    //      실제로 쳐야 그 문구로 몬스터가 된다(억지 랜덤 단어 대신 진짜 채팅만 타깃이 되도록).
    //      단, `!참여 안녕`처럼 같은 줄에 한글이 붙어 있으면 그 문구를 바로 타깃으로 큐에 넣는다.
    if (hasJoinCommand) {
      const wasJoined = this.joinedViewers.has(safeNickname);
      // 명단이 가득 찼는데(=상한 도달) 새 시청자면 참여 거부. 기존 참여자의 재참여는 계속 허용.
      if (!wasJoined && this.joinedViewers.size >= CONFIG.QUEUE.MAX_JOINED_VIEWERS) {
        return false;
      }
      this.joinedViewers.add(safeNickname);
      if (this.liveChatMode) {
        // sanitizeLiveChatWord가 `!참여` 토큰을 제거하므로, 순수 `!참여`는 빈값 → 큐 미적재(몬스터 X).
        const joinWord = this.sanitizeLiveChatWord(msg);
        if (joinWord) this.enqueueViewer(safeNickname, joinWord);
      } else {
        this.enqueueViewer(safeNickname);
      }
      return true;
    }

    // 2) 💬 라이브 채팅 모드: 이미 `!참여`한 시청자의 후속 채팅을 대기열에 순서대로 누적한다.
    //    (친 사람이 차례로 다 몬스터가 됨. 대형 방송 폭주는 MAX_QUEUE_LENGTH(30) 상한 +
    //     1인당 MAX_QUEUE_PER_VIEWER(2) 제한으로 자동 조절 — 한 명이 큐를 독점하지 못한다.)
    //    (미참여자의 일반 채팅은 절대 큐에 들어가지 않음)
    if (this.liveChatMode && this.joinedViewers.has(safeNickname)) {
      const chatWord = this.sanitizeLiveChatWord(msg);
      if (!chatWord) return false;
      return this.enqueueViewer(safeNickname, chatWord);
    }

    // `!참여`하지 않은 시청자의 일반 채팅은 무시한다(라이브 모드 여부와 무관).
    return false;
  },

  /**
   * 🔄 참여자 명단/대기열 초기화. 새 판 시작 시, 그리고 채팅 모달의 "참여자 초기화" 버튼에서 호출.
   *    joinedViewers(명단)·viewerQueue(대기열)를 모두 비운다.
   */
  resetParticipants() {
    this.joinedViewers.clear();
    this.viewerQueue = [];
  },

  /**
   * 🧹 대기열(viewerQueue)만 비운다 — 참여자 명단(joinedViewers)은 유지.
   *    라이브 채팅 모드에서 START로 새 판을 시작할 때, 홈 화면에서 오간 잡담 한글 채팅이
   *    첫 몬스터 제시어가 되지 않도록 game.js startGame()이 호출한다.
   *    (명단은 유지하므로 시청자가 다시 `!참여`할 필요는 없다.)
   */
  clearQueue() {
    this.viewerQueue = [];
  },

  /**
   * 💬 라이브 채팅 원문을 안전한 타이핑 타깃으로 정제
   * - '!참여' 명령어 토큰 제거
   * - 띄어쓰기(공백) 전량 제거 — 공백은 몇 칸을 쳤는지 알 수 없어 타이핑 판정이 애매해지므로 항상 삭제
   * - (설정 시) 한글 외 문자(영문·숫자·이모티콘·특수문자) 전량 제거 — 한/영 전환이 필요한
   *   영문 혼용 타깃('억까')을 원천 차단하고 한글만 남긴다
   * - 비속어 필터링
   * - 최대 글자수로 자르기
   * 결과가 빈 문자열이면 null에 준하는 빈 값을 반환 → 호출부에서 단어팩으로 자동 폴백
   * @param {string} rawText
   * @returns {string}
   */
  sanitizeLiveChatWord(rawText) {
    if (!rawText) return '';
    let cleaned = String(rawText).replace(/!참여/g, '');

    // 띄어쓰기는 입력 시 몇 칸인지 구분이 안 돼 판정이 애매하므로 항상 전부 제거한다.
    cleaned = cleaned.replace(/\s+/g, '');

    if (this.liveChatStripSpecial) {
      // 🇰🇷 라이브 채팅 타깃은 '한글만' 남긴다(완성형 가-힣 + 자모 ㄱ-ㅎ/ㅏ-ㅣ).
      //    영문·숫자·이모티콘·특수문자를 전부 제거하는 이유: 제시어에 영문이 섞이면
      //    (예: "레게노gg") 플레이어가 단어 중간에 한/영 키를 눌러야 해 사실상 칠 수 없는
      //    '억까' 타깃이 된다. 한글 IME 상태 그대로 끝까지 칠 수 있게 영문/숫자를 걸러낸다.
      //    (ㅋㅋ·ㅠㅠ 같은 자모 연타는 한글 입력 상태로 그대로 쳐지므로 남긴다.)
      cleaned = cleaned.replace(/[^가-힣ㄱ-ㅎㅏ-ㅣ]/g, '');
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
      if (count >= CONFIG.QUEUE.MAX_QUEUE_PER_VIEWER) return false;
    }

    this.viewerQueue.push({ nickname, chatWord });
    if (this.viewerQueue.length > CONFIG.QUEUE.MAX_QUEUE_LENGTH) {
      this.viewerQueue.shift();
    }
    return true;
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
   * 2단 몬스터 데이터 생성 (상단 닉네임 + 하단 제시어)
   * - 실시간 채팅 대기열에 시청자가 있으면 우선 소비, 없으면 [BOT] 표식 부여
   * - 💬 라이브 채팅 모드로 등록된 시청자면 실제 채팅 문구를, 아니면 단어팩 단어를 제시어로 사용
   * @param {string|null} customNickname - 강제 지정 닉네임 (선택)
   * @param {Set<string>|null} excludeWords - 이미 화면에 떠 있는 제시어 집합(랜덤 단어 중복 회피용, 선택)
   * @returns {Object} { nickname, isBot, word, isLiveChat }
   */
  getNextMonsterData(customNickname = null, excludeWords = null) {
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
    // 🎯 "제시어 하나 = 타깃 하나" 유지: 이미 화면에 떠 있는 단어는 랜덤 뽑기에서 제외해
    //    같은 제시어 몬스터가 동시에 존재하는(복제처럼 보이는) 혼란을 방지한다.
    //    (라이브 채팅 문구 chatWord는 시청자 실제 메시지이므로 회피 대상이 아니다.
    //     단어 풀이 화면 상한보다 커서 대부분 회피 가능하나, 다 겹치면 그냥 원본 풀에서 뽑는다.)
    let pool = activeWords;
    if (excludeWords && excludeWords.size > 0) {
      const filtered = activeWords.filter(w => !excludeWords.has(w));
      if (filtered.length > 0) pool = filtered;
    }
    const randomWord = pool[Math.floor(Math.random() * pool.length)];

    return {
      nickname: nickname,
      isBot: isBot,
      word: chatWord || randomWord,
      isLiveChat: !!chatWord
    };
  },

  /**
   * 한글 초성/중성/종성 자모 획수 정밀 분석 유틸리티
   * @param {string} text - 분석할 단어
   * @returns {number} 총 자모 획수
   */
  getHangulStrokeCount(text) {
    if (!text) return 0;

    let totalStrokes = 0;

    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);

      // 한글 가음절 완성형 범위 (가 ~ 힣)
      if (charCode >= 0xac00 && charCode <= 0xd7a3) {
        const hangulIndex = charCode - 0xac00;

        const initialIndex = Math.floor(hangulIndex / 588);
        const medialIndex = Math.floor((hangulIndex % 588) / 28);
        const finalIndex = hangulIndex % 28;

        totalStrokes += HANGUL_INITIAL_STROKES[initialIndex] || 1;
        totalStrokes += HANGUL_MEDIAL_STROKES[medialIndex] || 1;
        totalStrokes += HANGUL_FINAL_STROKES[finalIndex] || 0;
      }
      // 알파벳, 숫자, 특수문자 기본 처리
      else if ((charCode >= 65 && charCode <= 90) || (charCode >= 97 && charCode <= 122)) {
        totalStrokes += 1; // 영문 1타
      } else {
        totalStrokes += 1; // 기본 1타
      }
    }

    return totalStrokes;
  },

  /**
   * ⌨️ 타수 계산 — HUD의 CPM/WPM 표시용. **한컴 타자연습 "자소 단위" 방식과 일치**.
   *   자소(자모) 하나당 1타로 세되, 두 자모를 조합해 한 키 위치가 없는 것만 2타로 센다.
   *   (쌍자음 ㄲㄸㅃㅆㅉ·ㅒㅖ은 Shift로 입력해도 한컴 기준 1타. 획수 기반 점수와는 별개 단위.)
   *   - 초성: 쌍자음 포함 항상 1타
   *   - 중성: 겹모음 ㅘㅙㅚㅝㅞㅟㅢ = 2타(두 자모 조합), 나머지(ㅒㅖ 포함) 1타
   *   - 종성: 없음 0타 / 겹받침 ㄳㄵㄶㄺㄻㄼㄽㄾㄿㅀㅄ = 2타 / 나머지(쌍받침 ㄲㅆ 포함) 1타
   *   예: "떡볶이" = 떡(1+1+1) + 볶(1+1+1) + 이(1+1) = 8타, "김치찌개" = 9타
   * @param {string} text
   * @returns {number} 총 타수(자소 단위)
   */
  getKeystrokeCount(text) {
    if (!text) return 0;

    let keys = 0;
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      if (charCode >= 0xac00 && charCode <= 0xd7a3) {
        const h = charCode - 0xac00;
        const medialIndex = Math.floor((h % 588) / 28);
        const finalIndex = h % 28;
        keys += 1;                                   // 초성(쌍자음 포함) 1타
        keys += HANGUL_MEDIAL_DOUBLE.has(medialIndex) ? 2 : 1;
        keys += finalIndex === 0 ? 0 : (HANGUL_FINAL_DOUBLE.has(finalIndex) ? 2 : 1);
      } else {
        keys += 1; // 영문/숫자/기호 1타
      }
    }
    return keys;
  }
};

// 전역 객체 바인딩
window.wordPacks = wordPacks;

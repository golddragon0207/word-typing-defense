/**
 * ============================================================
 * STREAMER WORD DEFENSE — 전역 설정 파일 (js/config.js)
 *
 * ✅ 카카오 애드핏 배너 6개 ID 및 광고 동적 리프레시 관리
 * ============================================================
 */

const CONFIG = {
  // 📺 유튜브 라이브 채팅 연동용 YouTube Data API v3 키 (직접 발급 후 아래에 입력)
  // https://console.cloud.google.com/apis/credentials 에서 "YouTube Data API v3" 사용 설정 후 API 키 발급
  // 키가 비어 있으면 유튜브 연동은 자동으로 [BOT] 시뮬레이션 모드로 대체됩니다.
  YOUTUBE_API_KEY: "AIzaSyCD9Gh03q3exnSz8T9YRdHzWXCcLwXfELs",
  // 🌐 글로벌 명예의 전당(Firestore) + 📊 애널리틱스 연동용 설정
  // Firebase 콘솔(https://console.firebase.google.com/) > 프로젝트 설정 > 일반 > "내 앱" > 웹 앱에서
  // 발급받은 firebaseConfig 값을 그대로 아래에 붙여넣으세요.
  // apiKey가 비어 있으면 글로벌 리더보드/애널리틱스 기능은 자동으로 꺼지고 기존 로컬(localStorage) TOP5만 사용됩니다.
  // measurementId는 앱 등록 시 "이 앱에 대해 Google Analytics 사용 설정" 체크 시에만 발급됩니다
  // (비어 있으면 애널리틱스만 자동으로 꺼지고 리더보드는 정상 동작합니다).
  // ⚠️ Firebase의 apiKey는 서버 비밀키가 아니라 "공개용 웹 API 식별자"라 클라이언트 코드에 그대로 넣어도 안전합니다.
  //   실제 접근 제어는 Firestore 보안 규칙(js/globalLeaderboard.js 상단 주석 참고)으로 합니다.
  FIREBASE: {
    apiKey: "AIzaSyDsAJWfkQpzqlF5BhwIXK4nfYqaOtRiK5k",
    authDomain: "word-typing-defense.firebaseapp.com",
    projectId: "word-typing-defense",
    storageBucket: "word-typing-defense.firebasestorage.app",
    messagingSenderId: "628991807771",
    appId: "1:628991807771:web:8dcbc88cd5b800453f83be",
    measurementId: "G-K6VVVNWNWM"
  },

  // 💰 수익화: 카카오 애드핏 (Kakao AdFit) 728x90 PC 전용 배너 설정 (총 6개)
  KAKAO_ADFIT: {
    MAIN: "DAN-sCTP6AnIeAemuGrC",         // 메인_최하단_728x90 ID
    GAMEOVER: "DAN-wtmcwTgfJbkapFIQ",     // 결과창_카드_728x90 ID
    CHAT: "DAN-9KbCAkkKSv4pFqAO",         // 모달_채팅연동_728x90 ID
    WORDS: "DAN-Jdl49AhXKb3Dg6Ce",        // 모달_단어팩_728x90 ID
    LEADERBOARD: "DAN-4f2Zy9rvtpYIdFwz", // 모달_명예의전당_728x90 ID
    SUPPORT: "DAN-7HAZgjuUDNHfPgph",      // 모달_후원_728x90 ID
    WIDTH: "728",
    HEIGHT: "90"
  },

  // 🎮 난이도별 밸런스 테이블 (MonsterManager / StateManager / game.js 공용 참조)
  // - maxMonsterCap: 화면에 동시 출전 가능한 최대 몬스터 수. 방송 마비 방지를 위해
  //   난이도 상관없이 항상 15로 고정 (계획서상 하드 상한선, 절대 넘기지 않음)
  // - speedMult: 몬스터 낙하 속도 배율
  // - spawnIntervalBase/Step/Min: 스폰 주기(ms) = max(spawnIntervalMin, spawnIntervalBase - stage * spawnIntervalStep)
  // - killPerStageBase/Step: 스테이지 클리어에 필요한 처치 수 = killPerStageBase + floor((stage-1) * killPerStageStep)
  // - maxHp: 기지 최대 체력 / damagePerLeak: 몬스터 1마리가 기지에 도달했을 때 입는 피해
  DIFFICULTY: {
    easy: {
      speedMult: 0.75,
      maxMonsterCap: 15,
      spawnIntervalBase: 2600, spawnIntervalStep: 110, spawnIntervalMin: 1100,
      killPerStageBase: 30, killPerStageStep: 0.4,
      maxHp: 130, damagePerLeak: 8
    },
    normal: {
      speedMult: 1.0,
      maxMonsterCap: 15,
      spawnIntervalBase: 2400, spawnIntervalStep: 150, spawnIntervalMin: 800,
      killPerStageBase: 30, killPerStageStep: 0.5,
      maxHp: 100, damagePerLeak: 10
    },
    hard: {
      speedMult: 1.4,
      maxMonsterCap: 15,
      spawnIntervalBase: 2200, spawnIntervalStep: 170, spawnIntervalMin: 650,
      killPerStageBase: 30, killPerStageStep: 0.8,
      maxHp: 100, damagePerLeak: 12
    },
    hell: {
      speedMult: 2.0,
      maxMonsterCap: 15, // ⚠️ 계획서상 하드 상한선(Max Monster Cap = 15) — 이 값을 넘기면 안 됨
      spawnIntervalBase: 2000, spawnIntervalStep: 200, spawnIntervalMin: 500,
      killPerStageBase: 30, killPerStageStep: 1,
      maxHp: 90, damagePerLeak: 15
    }
  }
};

/**
 * 난이도 키로 밸런스 설정을 조회 (없으면 normal로 폴백)
 * @param {string} difficulty
 */
function getDifficultyConfig(difficulty) {
  return CONFIG.DIFFICULTY[difficulty] || CONFIG.DIFFICULTY.normal;
}
window.getDifficultyConfig = getDifficultyConfig;

// 광고 슬롯 - 컨테이너 ID 맵핑 객체 (총 6개)
const AD_CONTAINER_MAP = {
  'ad-container-main': CONFIG.KAKAO_ADFIT.MAIN,
  'ad-container-gameover': CONFIG.KAKAO_ADFIT.GAMEOVER,
  'ad-container-chat': CONFIG.KAKAO_ADFIT.CHAT,
  'ad-container-words': CONFIG.KAKAO_ADFIT.WORDS,
  'ad-container-leaderboard': CONFIG.KAKAO_ADFIT.LEADERBOARD,
  'ad-container-support': CONFIG.KAKAO_ADFIT.SUPPORT
};

/**
 * 🚀 숨겨진 화면/모달이 열릴 때 카카오 애드핏 광고 동적 생성/리프레시 (안전 가드 적용)
 * @param {string} containerId - HTML 배너 상자 ID (예: 'ad-container-support')
 */
function refreshAdfitSlot(containerId) {
  try {
    const container = document.getElementById(containerId);
    if (!container) return;

    const adUnitId = AD_CONTAINER_MAP[containerId];
    if (!adUnitId) return;

    // 기존 자식 요소(ins, script) 제거 후 깔끔하게 재구성 (메모리 누수 차단)
    container.innerHTML = '';

    const ins = document.createElement('ins');
    ins.className = 'kakao_ad_area';
    ins.style.display = 'none';
    ins.setAttribute('data-ad-unit', adUnitId);
    ins.setAttribute('data-ad-width', CONFIG.KAKAO_ADFIT.WIDTH);
    ins.setAttribute('data-ad-height', CONFIG.KAKAO_ADFIT.HEIGHT);

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = '//t1.daumcdn.net/kas/static/ba.min.js';
    script.async = true;

    container.appendChild(ins);
    container.appendChild(script);
  } catch (err) {
    // 광고 스크립트에 에러가 생기더라도 게임 동작이 멈추지 않도록 예외 처리
    console.warn(`⚠️ [AdFit] ${containerId} 광고 로드 중 예외 발생:`, err);
  }
}

/**
 * 🎯 메인 초기화 함수: DOM 로드 시 메인 화면 하단 배너 초기 로드
 */
function initializeAds() {
  refreshAdfitSlot('ad-container-main');
}

// DOM 로딩 완료 시 광고 초기화 실행
document.addEventListener('DOMContentLoaded', initializeAds);

// 전역 객체 바인딩
window.CONFIG = CONFIG;
window.refreshAdfitSlot = refreshAdfitSlot;
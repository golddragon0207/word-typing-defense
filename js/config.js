/**
 * ============================================================
 * STREAMER WORD DEFENSE — 전역 설정 파일 (config.js)
 *
 * ✅ 이 파일은 GitHub에 올려도 안전합니다.
 * - 게임 내 광고 ID 및 기본 환경 변수를 통합 관리합니다.
 * ============================================================
 */

const CONFIG = {
  // 💰 수익화: 카카오 애드핏 (Kakao AdFit) 설정 (추후 배너 생성 시 채워넣을 예정)
  KAKAO_ADFIT: {
    TOP: "DAN-4hiutMEdhD30CTQ0",         // 메인_최상단_728x90 ID
    MAIN: "DAN-sCTP6AnIeAemuGrC",        // 메인_최하단_728x90 ID
    GAMEOVER: "DAN-wtmcwTgfJbkapFIQ",    // 결과창_카드_728x90 ID
    CHAT: "DAN-9KbCAkkKSv4pFqAO",      // 모달_채팅연동_728x90 ID
    WORDS: "DAN-Jdl49AhXKb3Dg6Ce",       // 모달_단어팩_728x90 ID
    LEADERBOARD: "DAN-4f2Zy9rvtpYIdFwz",// 모달_명예의전당_728x90 ID
    SUPPORT: "DAN-7HAZgjuUDNHfPgph",       // 모달_후원_728x90 ID
    WIDTH: "728",
    HEIGHT: "90"
  }
};

/**
 * 🚀 초기화 함수: HTML 각 컨테이너 ID에 맞춰 해당 애드핏 ID를 자동으로 주입합니다.
 */
function initializeAds() {
  const adMapping = {
    'ad-container-top': CONFIG.KAKAO_ADFIT.TOP,
    'ad-container-main': CONFIG.KAKAO_ADFIT.MAIN,
    'ad-container-gameover': CONFIG.KAKAO_ADFIT.GAMEOVER,
    'ad-container-chat': CONFIG.KAKAO_ADFIT.CHAT,
    'ad-container-words': CONFIG.KAKAO_ADFIT.WORDS,
    'ad-container-leaderboard': CONFIG.KAKAO_ADFIT.LEADERBOARD,
    'ad-container-support': CONFIG.KAKAO_ADFIT.SUPPORT
  };

  Object.keys(adMapping).forEach(containerId => {
    const container = document.getElementById(containerId);
    if (container) {
      const ins = container.querySelector('.kakao_ad_area');
      if (ins) {
        ins.setAttribute('data-ad-unit', adMapping[containerId]);
        ins.setAttribute('data-ad-width', CONFIG.KAKAO_ADFIT.WIDTH);
        ins.setAttribute('data-ad-height', CONFIG.KAKAO_ADFIT.HEIGHT);
      }
    }
  });
}

// 웹페이지(DOM) 로딩이 완료되면 광고 초기화 함수를 실행합니다.
document.addEventListener('DOMContentLoaded', initializeAds);

/**
 * 숨겨진 화면/모달이 열릴 때 카카오 애드핏 광고 재초기화
 * (숨겨진 상태에서는 광고가 로드되지 않으므로 모달 표시 시 컨테이너 ID로 호출)
 */
function refreshAdfitSlot(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const adMapping = {
    'ad-container-top': CONFIG.KAKAO_ADFIT.TOP,
    'ad-container-main': CONFIG.KAKAO_ADFIT.MAIN,
    'ad-container-gameover': CONFIG.KAKAO_ADFIT.GAMEOVER,
    'ad-container-chat': CONFIG.KAKAO_ADFIT.CHAT,
    'ad-container-words': CONFIG.KAKAO_ADFIT.WORDS,
    'ad-container-leaderboard': CONFIG.KAKAO_ADFIT.LEADERBOARD,
    'ad-container-support': CONFIG.KAKAO_ADFIT.SUPPORT
  };

  const adUnitId = adMapping[containerId];
  if (!adUnitId) return;

  // 기존 ins + script 제거 후 재생성
  container.innerHTML = '';

  const ins = document.createElement('ins');
  ins.className = 'kakao_ad_area';
  ins.style.display = 'none';
  ins.setAttribute('data-ad-unit', adUnitId);
  ins.setAttribute('data-ad-width', CONFIG.KAKAO_ADFIT.WIDTH);
  ins.setAttribute('data-ad-height', CONFIG.KAKAO_ADFIT.HEIGHT);

  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = '//t1.kakaocdn.net/kas/static/ba.min.js';
  script.async = true;

  container.appendChild(ins);
  container.appendChild(script);
}
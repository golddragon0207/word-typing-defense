/**
 * ============================================================
 * STREAMER WORD DEFENSE — 전역 설정 파일 (js/config.js)
 *
 * ✅ 카카오 애드핏 배너 7개 ID 및 광고 동적 리프레시를 통합 관리합니다.
 * ============================================================
 */

const CONFIG = {
  // 💰 수익화: 카카오 애드핏 (Kakao AdFit) 728x90 PC 전용 배너 설정
  KAKAO_ADFIT: {
    MAIN: "DAN-sCTP6AnIeAemuGrC",         // 메인_최하단_728x90 ID
    GAMEOVER: "DAN-wtmcwTgfJbkapFIQ",     // 결과창_카드_728x90 ID
    CHAT: "DAN-9KbCAkkKSv4pFqAO",         // 모달_채팅연동_728x90 ID
    WORDS: "DAN-Jdl49AhXKb3Dg6Ce",        // 모달_단어팩_728x90 ID
    LEADERBOARD: "DAN-4f2Zy9rvtpYIdFwz", // 모달_명예의전당_728x90 ID
    SUPPORT: "DAN-7HAZgjuUDNHfPgph",      // 모달_후원_728x90 ID
    WIDTH: "728",
    HEIGHT: "90"
  }
};

// 광고 슬롯 - 컨테이너 ID 맵핑 객체
const AD_CONTAINER_MAP = {
  'ad-container-main': CONFIG.KAKAO_ADFIT.MAIN,
  'ad-container-gameover': CONFIG.KAKAO_ADFIT.GAMEOVER,
  'ad-container-chat': CONFIG.KAKAO_ADFIT.CHAT,
  'ad-container-words': CONFIG.KAKAO_ADFIT.WORDS,
  'ad-container-leaderboard': CONFIG.KAKAO_ADFIT.LEADERBOARD,
  'ad-container-support': CONFIG.KAKAO_ADFIT.SUPPORT
};

/**
 * 🚀 숨겨진 화면/모달이 열릴 때 카카오 애드핏 광고 동적 생성/리프레시
 * @param {string} containerId - HTML 배너 상자 ID (예: 'ad-container-support')
 */
function refreshAdfitSlot(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const adUnitId = AD_CONTAINER_MAP[containerId];
  if (!adUnitId) return;

  // 기존 자식 요소(ins, script) 제거 후 재구성
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

/**
 * 🎯 메인 초기화 함수: DOM 로드 시 메인 화면에 노출되는 상/하단 배너 초기 로드
 */
function initializeAds() {
  // 페이지 진입 시 눈에 보이는 메인 배너 슬롯 우선 생성
  refreshAdfitSlot('ad-container-top');
  refreshAdfitSlot('ad-container-main');
}

// DOM 로딩 완료 시 광고 초기화 실행
document.addEventListener('DOMContentLoaded', initializeAds);

// 전역 객체 바인딩 (모달 열림 이벤트 발생 시 외부 JS에서 refreshAdfitSlot('ID') 호출 가능)
window.CONFIG = CONFIG;
window.refreshAdfitSlot = refreshAdfitSlot;
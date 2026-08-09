/**
 * ============================================================
 * WORD-TYPING-DEFENSE — 부트스트랩 엔트리 (js/main.js)
 *   모든 스크립트(GameEngine 클래스 + ui/* 부분 클래스)가 로드된 뒤 마지막에 실행되어,
 *   엔진 인스턴스를 만들고 DOM 준비 시점에 init()을 호출한다.
 *   → ui/*.js가 GameEngine.prototype를 모두 확장한 뒤 인스턴스화되므로 로드 순서 의존성이 없다.
 * ============================================================
 */
window.gameEngine = new GameEngine();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.gameEngine.init());
} else {
  window.gameEngine.init();
}

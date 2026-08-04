/**
 * ============================================================
 *  STREAMER WORD DEFENSE — 설정 파일 템플릿
 *  (이 파일을 복사하여 js/config.js 로 저장하고 값을 채우세요)
 *
 *  ⚠️  js/config.js 는 .gitignore 에 등록되어 있어
 *       GitHub 에 절대 올라가지 않습니다.
 *       이 예시 파일(config.example.js)만 공개됩니다.
 * ============================================================
 *
 *  [설정 방법]
 *  1. 이 파일을 복사 → 이름을 config.js 로 바꾸기
 *  2. 아래 YOUR_TOSS_ID 를 본인 토스 아이디로 교체
 *     (토스 앱 → 전체 → 내 토스아이디에서 생성 가능)
 *  3. 저장 후 게임 실행 시 [☕ 후원] 버튼이 활성화됩니다.
 * ============================================================
 */

const CONFIG = {
  /**
   * 토스 아이디 (toss.me/{TOSS_ID}/{금액} 형태로 후원 링크 생성)
   * 예) "mystreamerid" 이면 → toss.me/mystreamerid/5000
   */
  TOSS_ID: "YOUR_TOSS_ID",   // ← 여기에 본인 토스 아이디 입력

  /**
   * 카카오 애드핏 광고 단위 ID (선택)
   * 카카오 애드핏 사이트에서 발급받은 DAN-XXXXXXXX 코드
   */
  KAKAO_AD_UNIT: "YOUR_KAKAO_AD_UNIT_ID",

  /**
   * 구글 애드센스 퍼블리셔 ID (선택)
   * ca-pub-XXXXXXXXXXXXXXXX 형태
   */
  ADSENSE_PUB_ID: "YOUR_ADSENSE_PUB_ID",
};

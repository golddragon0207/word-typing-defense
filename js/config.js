/**
 * ============================================================
 * STREAMER WORD DEFENSE — 전역 설정 파일 (js/config.js)
 *
 * ✅ 카카오 애드핏 배너 5개 ID 및 광고 동적 리프레시 관리
 * ============================================================
 */

const CONFIG = {
  // 📺 유튜브 라이브 채팅 연동용 YouTube Data API v3 키 (직접 발급 후 아래에 입력)
  // https://console.cloud.google.com/apis/credentials 에서 "YouTube Data API v3" 사용 설정 후 API 키 발급
  // 키가 비어 있으면 유튜브 연동은 자동으로 [BOT] 시뮬레이션 모드로 대체됩니다.
  YOUTUBE_API_KEY: "AIzaSyCD9Gh03q3exnSz8T9YRdHzWXCcLwXfELs",

  // 🔵 SOOP(숲/아프리카) 연동용 CORS 프록시. ⭐ 개발자가 딱 한 번만 설정하면 됩니다.
  //   SOOP은 채팅 서버 주소·방송번호(BNO)를 player_live_api.php에서 받아와야 하는데
  //   이 API가 CORS 헤더를 주지 않아 브라우저에서 직접 호출하면 차단됩니다.
  //   → 무료 Cloudflare Worker(proxy/soop-cors-proxy.worker.js)를 배포하고,
  //     나온 주소 뒤에 "/?url=" 를 붙여서 아래에 넣으세요. (반드시 /?url= 로 끝나야 함)
  //     예) SOOP_PROXY: "https://soop-proxy.내계정.workers.dev/?url="
  //   👉 배포 방법 전체 안내: docs/SOOP_연동_설정.md
  //   여기만 채워두면 스트리머는 방송국 URL만 붙여넣으면 자동 연동됩니다(프록시 조작 불필요).
  //   비어 있으면 SOOP 실시간 연동은 시작하지 않고 BOT 시뮬레이션으로 폴백합니다.
  SOOP_PROXY: "https://soop-proxy.skkim867.workers.dev/?url=",

  // 🟢 치지직(Chzzk) 연동용 CORS 프록시. 치지직도 live-status·access-token API가 CORS 차단이라
  //   프록시가 필요합니다. 위 SOOP 프록시(Cloudflare Worker)가 치지직 도메인도 허용하도록
  //   확장돼 있으므로, 같은 주소를 그대로 넣으면 됩니다(별도 배포 불필요).
  //   비워두면 SOOP_PROXY 값을 재사용하며, 둘 다 비면 치지직은 BOT 시뮬레이션으로 폴백합니다.
  //   ⚠️ Worker를 proxy/soop-cors-proxy.worker.js 최신본으로 반드시 재배포해야 치지직이 열립니다.
  CHZZK_PROXY: "https://soop-proxy.skkim867.workers.dev/?url=",

  // SOOP 채팅 파싱 디버그 로그(원본 프레임/파싱 결과를 콘솔에 출력). 라이브에서 필드 인덱스 튜닝용.
  // (치지직 연동 디버그 로그도 이 플래그를 함께 사용합니다.)
  // ⚠️ 프로덕션 기본값은 false — 켜면 채팅 메시지마다 원본 프레임을 콘솔에 출력해(JSON.stringify 포함)
  //    대형 방송에서 콘솔이 도배되고 성능에 부담이 됩니다. 파싱 규격을 조정할 때만 true로 켜세요.
  SOOP_DEBUG: false,
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

  // 💰 수익화: 카카오 애드핏 (Kakao AdFit) 728x90 PC 전용 배너 설정 (총 5개)
  KAKAO_ADFIT: {
    MAIN: "DAN-sCTP6AnIeAemuGrC",         // 메인_최하단_728x90 ID
    GAMEOVER: "DAN-wtmcwTgfJbkapFIQ",     // 결과창_카드_728x90 ID
    LEADERBOARD: "DAN-4f2Zy9rvtpYIdFwz", // 모달_명예의전당_728x90 ID
    SUPPORT: "DAN-7HAZgjuUDNHfPgph",      // 모달_후원_728x90 ID
    SUGGESTION: "DAN-0yaoDJ8fNLA4tD92",   // 모달_건의사항_728x90 ID
    WIDTH: "728",
    HEIGHT: "90"
  },

  // 🎮 밸런스 테이블 (MonsterManager / StateManager / game.js 공용 참조)
  //   난이도 선택 UI가 없어 표준(normal) 한 세트만 사용한다. getDifficultyConfig()가 이 값을 반환.
  // - maxMonsterCap: 화면에 동시 출전 가능한 최대 몬스터 수(항상 15 고정, 계획서상 하드 상한선).
  // - speedMult: 몬스터 낙하 속도 배율
  // - 스폰 주기(ms): 이 테이블이 아니라 아래 CONFIG.SPAWN_CURVE에서 "목표 타자속도 곡선"으로 역산.
  // - killPerStageBase/Step: 스테이지 클리어에 필요한 처치 수 = killPerStageBase + floor((stage-1) * killPerStageStep)
  // - maxHp: 기지 최대 체력 / damagePerLeak: 몬스터 1마리가 기지에 도달했을 때 입는 피해
  //
  // ⚙️ 난이도 곡선: "스테이지가 오를수록 요구 타자속도(한컴 자소 기준)가 선형 상승 → 800타에서 소프트 캡,
  //   이후는 집중력·지구력 싸움"이 되도록 튜닝. (스폰 주기는 CONFIG.SPAWN_CURVE에서 역산)
  //   ▶ 핵심 원리: 스테이지를 깨려면 결국 "몬스터가 쏟아지는 속도만큼" 쳐내야 하므로,
  //      요구 타자속도 ≈ (60000 ÷ 스폰주기ms) × 단어당타수(~8.9, 3~4글자 중간값). → 목표 타자속도에서 스폰주기를 역산한다.
  //   ① 요구 타자속도 곡선(SPAWN_CURVE: start100·step10.5·max800·afterMax3): s1=100타(초보 클리어) →
  //      스테이지당 +10.5타로 선형 상승 → s20≈300타 → s40≈510타 → s60≈720타 →
  //      s68에서 소프트 캡 800타 도달 → 이후는 +3타/s로만 완만히 상승(평평해지지 않음 = 불멸 제거).
  //      스폰 주기로 환산하면 s1≈9000ms → s68≈1120ms → 이후 서서히 더 짧아짐(하한 400ms).
  //      "초보(100타)~월드클래스(800타+)"까지 실력이 곧 도달 스테이지가 되도록 하는 **주 난이도 축**.
  //   ② 낙하 속도(MonsterManager: 0.30 + (min(stage,60)-1)*0.05): s60에서 상한(반응 ≈2.8s).
  //      요구 타자속도는 ①이 정하고, 낙하는 "실수·머뭇거림을 봐주는 버퍼"를 스테이지마다 줄여
  //      같은 요구 타수라도 후반일수록 무오타를 강요하는 **반응 압박(연출) 축**. (반응 하한 ≈2.8s, s60서 고정)
  //   ③ 처치 수(killPerStageBase 8·Step 0.5, 2스테이지당 +1): s68에서 요구 타자속도가 소프트 캡(800타)에
  //      닿은 뒤에는 처치 수(지구력)+보스 치명성(공격력 무한↑)+스폰 완만 조임이 겹쳐 난이도를 이어받는다
  //      (=속도 목표는 사실상 멈추고, 무오타 지구력으로 갈리는 집중력 싸움).
  //   ※ 화면 동시 몬스터는 항상 15 상한(MAX_MONSTER_CAP, 방송 보호).
  DIFFICULTY: {
    normal: {
      speedMult: 1.0,
      maxMonsterCap: 15, killPerStageBase: 8, killPerStageStep: 0.5,
      maxHp: 100, damagePerLeak: 10
    }
  },

  // 🎯 스폰 주기 곡선 (전 난이도 공용) — "목표 요구 타자속도(한컴 자소 기준, 타/분)"에서 스폰 주기를 역산.
  //    MonsterManager:
  //      linear      = kpmStart + (stage-1)*kpmStep
  //      requiredKpm = linear<=kpmMax ? linear : kpmMax + (linear-kpmMax)*(kpmStepAfterMax/kpmStep)  // 소프트 캡
  //      spawnInterval(ms) = clamp(60000*avgWordKeystrokes / requiredKpm, 하한 400ms)
  //    - kpmStart 100 : 스테이지1 요구 타자속도(초보도 클리어 가능한 하한)
  //    - kpmStep 10.5 : 상한 전 스테이지당 상승폭(선형). s20≈300 · s40≈510 · s60≈720타
  //    - kpmMax  800  : 요구 타자속도 소프트 캡(≈s68 도달). "속도 목표"의 천장이자 집중력 싸움의 시작점.
  //    - kpmStepAfterMax 3 : 소프트 캡 이후 완만 상승폭(3타/스테이지). 스폰이 절대 평평해지지 않아
  //         **무오타 초고속 플레이의 불멸을 제거**(속도는 거의 안 오르지만 계속 조금씩 조여짐).
  //         s80≈837 · s100≈897타 → 900타는 ≈s101, 1000타는 ≈s134에서 결국 뚫림.
  //    - avgWordKeystrokes 8.9 : 단어팩 평균 타수의 **단일 고정값**. 몬스터 제시어를 3글자(실측 ≈7.66타)·4글자
  //         (실측 ≈10.14타) 두 풀로 나눴고, 8.9는 그 둘의 중간값이다(wordPacks.words3/words4 참조).
  //         ⚠️ 단일 고정이 핵심: 스폰 주기는 이 8.9로만 계산하므로, 초반 3글자(평균보다 짧음)는 실제로 더 쉽고
  //         후반 4글자(평균보다 김)는 실제로 더 빡세진다(= 글자수 스케줄이 난이도를 얹는다). 스테이지1=100타 기준은
  //         "평균 단어" 기준이라 유지된다. 풀 구성을 바꾸면 3·4글자 평균을 다시 재서 이 중간값도 갱신해야 한다.
  //    ※ 하한 400ms는 극후반 안전장치일 뿐(요구타수 1335타 이상에서야 도달 — 사실상 미발동).
  //    ※ 튜닝: 초반 관대/빡빡=kpmStart, 상승 기울기=kpmStep, 속도 목표 천장=kpmMax, 후반 조임세기=kpmStepAfterMax.
  SPAWN_CURVE: { kpmStart: 100, kpmStep: 10.5, kpmMax: 800, kpmStepAfterMax: 3, avgWordKeystrokes: 8.9 },

  // 🐲 보스 난이도 (MonsterManager._bossChargeMs) — 보스를 "직전 스테이지보다 조금 더 어려운 스파이크"로.
  //    ⚠️ 기준은 '클리어(게이지 1회 밀어내기)'가 아니라 **'한 대도 안 맞는(무피격)' 요구 속도**다.
  //    정타 시 게이지는 절반만 밀리고(chargeElapsed −= chargeTime×0.5) N=requiredHits회를 연속으로 막아야
  //    무피격이라 게이지가 누적된다. 누적을 풀면 무피격 조건은  타이핑시간 W < 차지시간 C × (N+1)/(2N).  이를 뒤집어
  //    "무피격 속도 = kpmMult × 요구타수(stage-1)"이 되게 차지 시간을 **출제된 그 단어의 실제 타수 k**로 역산:
  //        차지시간 = (60000·k / (kpmMult · 요구타수(stage-1))) × 2N/(N+1)  (공격력 = 10 + 보스index*2)
  //    ✅ 단어별 역산이라 5글자·6글자 편차가 있어도 무피격 요구 속도는 모든 보스 단어에서 동일. (풀 평균으로 한 번만
  //       잡던 옛 방식은 단어 길이 편차가 그대로 난도 편차가 되어 요구 속도가 99~250타로 널뛰었다.)
  //    ▶ 기준을 stage가 아니라 'stage-1'로 두는 이유: 보스 스테이지엔 일반 몹 구간이 없어 플레이어가
  //      실제로 겪은 마지막 속도가 직전 스테이지다. 이렇게 해야 4→5 같은 첫 보스 진입 갭이 과하지 않다.
  //    - kpmMult 1.15 : 무피격 스파이크 세기. ↑일수록 무피격에 더 높은 버스트 강요. 1.10≈완만, 1.25≈가혹.
  //         (예: 보스5 = 1.15×131.5타(직전 스테이지4) ≈ 151타를 내면 무피격 = 스테이지4 대비 +15%의 자연스러운 연속선.)
  //    - minChargeSec 1.5 : 차지 시간 하한(초). 후반 초고속 구간에서 차지가 인간 불가로 짧아지는 것 방지.
  //    ※ 요구 타수(SPAWN_CURVE)에 자동 연동되므로, 스폰 곡선을 바꿔도 보스가 같이 스케일된다.
  BOSS: { kpmMult: 1.15, minChargeSec: 1.5 },

  // 🛡️ 화면 동시 출전 몬스터 절대 상한 (방송 마비 방지 — 계획서상 하드 상한선).
  //    MonsterManager가 난이도별 maxMonsterCap과 Math.min으로 clamp하는 "천장" 값.
  MAX_MONSTER_CAP: 15,

  // ⏱️ 게임 시작(1스테이지) 시 첫 몬스터가 나오기까지의 지연(ms).
  //    '게임 시작' 직후 시청자가 !참여로 모일 여유를 주는 그레이스 타임.
  START_SPAWN_DELAY_MS: 5000,

  // ⏱️ 스테이지 클리어 후 다음 스테이지 첫 몬스터(또는 보스)가 나오기까지의 지연(ms).
  //    스테이지업 때마다 잠깐 숨 돌릴 여유를 준다(0이면 즉시 시작).
  //    (게임 시작 그레이스는 5초 유지, 스테이지 전환은 템포를 위해 3초로 단축)
  STAGE_UP_SPAWN_DELAY_MS: 3000,

  // ⏱️ 일시정지 → 재개 시 곧바로 시작하지 않고 보여주는 그레이스 카운트다운(ms).
  //    화장실 등으로 잠깐 비웠다 돌아왔을 때 마음의 준비를 할 여유를 준다.
  RESUME_GRACE_MS: 5000,

  // ⚙️ 시청자 참여/대기열 튜닝 값 (참여 명단·큐) — 여기 한 곳에서 조절.
  //    봇은 미리 채우지 않고 스폰 시점(getNextMonsterData)에 대기열이 비면 한 명씩 자연 보충한다.
  QUEUE: {
    MAX_JOINED_VIEWERS: 10000, // 참여자 명단 최대 인원 (가득 차면 새 !참여 무시, 기존 참여자는 계속 동작)
    MAX_QUEUE_LENGTH: 30,      // 대기열 최대 길이 (초과 시 가장 오래된 대기자부터 밀려남)
    MAX_QUEUE_PER_VIEWER: 2    // 한 시청자가 큐에 동시에 대기할 수 있는 최대 항목 ([BOT]은 예외)
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

// 광고 슬롯 - 컨테이너 ID 맵핑 객체 (총 5개)
const AD_CONTAINER_MAP = {
  'ad-container-main': CONFIG.KAKAO_ADFIT.MAIN,
  'ad-container-gameover': CONFIG.KAKAO_ADFIT.GAMEOVER,
  'ad-container-leaderboard': CONFIG.KAKAO_ADFIT.LEADERBOARD,
  'ad-container-support': CONFIG.KAKAO_ADFIT.SUPPORT,
  'ad-container-suggestion': CONFIG.KAKAO_ADFIT.SUGGESTION
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
    // 실제 발급 ID가 없거나(플레이스홀더 DAN-REPLACE_ME 포함) 비어 있으면 깨진 광고 주입을 건너뜀
    if (!adUnitId || adUnitId.indexOf('REPLACE_ME') !== -1) return;

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
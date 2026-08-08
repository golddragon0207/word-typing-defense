# 🎮 word-typing-defense (스트리머 워드 디펜스) 구현 계획서 (v3.1)

 스트리머 1인 솔로 플레이에 최적화된 단일 입력 웹 타자 디펜스 환경을 제공하며, 화면상에는 시청자 닉네임 뱃지와 타깃 제시어(밈/유행어/실시간 채팅)가 직관적으로 구분되는 **2단 몬스터 UI 시스템**을 구축합니다.
 모바일 접속은 완전히 배제하고 최소 지원 해상도를 **1024x768 (PC 전용)**로 확정하여, 방송 송출(OBS 크로마키 및 투명 오버레이 지원) 시 화면 잘림이나 가로 스크롤 없이 100% 쾌적하고 안정적인 방송 플레이를 보장합니다.

> **v3.1 변경 요약**: **SOOP(숲/아프리카) 실시간 채팅 실제 연동 구현**(입장 핸드셰이크·패킷 파싱 + 전용 무료 Cloudflare Worker CORS 프록시 `CONFIG.SOOP_PROXY`, 스트리머는 URL만 붙여넣으면 자동), SOOP를 연동 모달 **기본/맨 왼쪽 탭**·시작화면 배지 선두로 배치, 라이브 채팅 설정 박스 **테두리 ON/OFF 상태 표시**, 후원 모달 **QR·계좌 가로 배치 + 헤더 '카카오뱅크'**, SOOP URL 파서 `sooplive.com` 도메인 지원.
>
> **v3.0 변경 요약**: 난이도별 밸런스 테이블 도입, `!참여` 단일 명령어 + 봇 자동 보충, 💬 라이브 채팅 하이브리드 모드(실제 채팅 문구를 타깃으로), 명예의 전당(최고 도달 스테이지 기준, 로컬 + Firebase 글로벌), Firebase Analytics(GA4) 게임 이벤트 수집, 피버 모드, 단어팩 미리보기, 토스트 알림, 배경 파티클 연출 추가.

---

## 🎮 1. 프로젝트 개요

| 구분 | 최종 반영 사양 |
| :--- | :--- |
| **게임명 / 프로젝트명** |  `word-typing-defense` (스트리머 워드 디펜스) |
| **타깃 플랫폼 & 해상도** |  PC Desktop 전용 (**1024 × 768** 최소 해상도 고정, OBS 크로마키/투명 오버레이 지원) |
| **웹 배포 및 접속 주소** |  **GitHub Pages 단일 Git URL 배포** (`https://golddragon0207.github.io/word-typing-defense/`) |
| **플레이 모드** |  **1인 솔로 스트리머 전용 디펜스** (복잡한 N인 합방/대결 모드 옵션 전면 제거) |
| **방송 채팅 연동 방식** |  **원클릭 방송 URL 파싱 연동** (스트리머가 방송 주소 입력 시 자동 ID 추출). SOOP/치지직/유튜브 **동시 다중 연동**. SOOP는 전용 무료 Cloudflare Worker 프록시(`CONFIG.SOOP_PROXY`, 개발자 1회 배포) 경유 — 스트리머는 URL만 입력 |
| **몬스터 UI 시스템** |  **2단 UI** (상단: 시청자 닉네임 Pill Tag / 하단: 제시어 Box). 보스는 금색·확대, 라이브 채팅 문구는 보라색으로 강조. **Max Cap 15마리** 고정 상한 |
| **난이도 밸런스** |  밸런스 테이블(`CONFIG.DIFFICULTY`)로 낙하속도·스폰주기·기지 체력·피격 데미지·스테이지 처치목표 차등. **난이도 선택 UI는 제거**되어 표준(`normal`)으로 고정 실행(스테이지별 자동 상승은 유지) |
| **명예의 전당** |  **최고 도달 스테이지 기준 단일 TOP 5**(동점 시 점수순). 로컬(`localStorage`) 기본 + Firebase Firestore **글로벌 리더보드**(설정 시 자동 활성, 미설정 시 로컬 폴백) |
| **화면 & 모달 최적화** |  카드 너비 `width: min(96%, 800px)` / 세로 `max-height: 72vh`. 버튼 영역(`.modal-actions`)과 광고 영역(`.modal-footer`)을 구조적으로 분리 |
| **상단 컨트롤바 (7개)** |  📝 단어/닉네임 팩, 🏆 명예의 전당, ☕ 개발자 후원, 💡 건의사항, 💬 라이브 채팅 모드, 📺 OBS 크로마키, 🔊 사운드 ON/OFF (방송 채팅 연동은 홈 화면 인라인 패널) |
| **수익화 광고 및 후원** | **총 6개** 카카오 애드핏 `728x90` 슬롯(메인/결과/단어팩/명예의전당/후원/건의사항) + **카카오뱅크(`3333-28-2684443`) 계좌 복사 & QR(`donation-qr.png`)** 후원 모달 |
| **선택형 백엔드** |  Firebase(무료 티어) — Firestore 글로벌 리더보드 + 건의사항(`suggestions`) 저장 + Analytics(GA4). `CONFIG.FIREBASE` 미설정 시 전 기능 자동 비활성/로컬 폴백 |

---

## 🎯 2. 주요 기능 및 상세 정책

### 1. 📡 원클릭 방송 URL 실시간 채팅 연동 (치지직/SOOP/유튜브 다중)
*  **URL 자동 파서**: 붙여넣은 방송 주소에서 치지직 32자리 채널 ID(URL 위치 무관하게 첫 32자리 hex 추출 — `chzzk.naver.com/live/{ID}`·`chzzk.naver.com/{ID}`·`studio.chzzk.naver.com/{ID}/live` 모두 지원) / SOOP BJ·방송국 ID(`sooplive.com`·`sooplive.co.kr`·`afreecatv.com` 도메인 지원, 첫 경로 세그먼트=BJ ID) / 유튜브 Video ID 자동 추출.
*  **다중 플랫폼 동시 연동**: `channels[]` 배열 구조로 SOOP + 치지직 + 유튜브를 동시에 연결 가능. 각 플랫폼 채팅은 플랫폼 접두사(🔵/🟢/🔴)와 함께 하나의 시청자 대기열로 병합. 연동 모달 기본 탭·시작화면 배지는 **SOOP를 선두**로 배치.
*  **참여자 목록 표시**: `!참여`한 시청자를 홈 화면의 채팅 연동 패널(`<details id="home-chat-panel">`)에 실시간 목록(총원 + 최근 참여자 칩)으로 표시해 스트리머가 연동 상태를 바로 확인.
*  **스트리머 닉네임 필수 입력**: 스트리머 닉네임 칸(`#input-player-nickname`)은 홈 화면 채팅 연동 패널 안(참여자 명단 바로 위)에 위치하며 **필수 입력**. 빈 값으로 게임 시작 시 시작을 막고 패널을 펼쳐 입력칸에 포커스한다(자동 닉네임 채움 기능은 제거).
*  **SOOP 실제 채팅 클라이언트**: `player_live_api.php`로 방송번호(BNO)·**채팅방번호(CHATNO)**·채팅서버(CHDOMAIN/CHPT) 조회 → `wss://{CHDOMAIN}:{CHPT+1}/Websocket/{BJID}` 접속(서브프로토콜 `chat`) → **LOGIN(svc 1, 익명 CONNECT 페이로드 = 구분자×3 + `16` + 구분자)** → 응답 후 **JOIN(svc 2, 입장 대상은 BNO가 아니라 `CHATNO`)** → 주기 PING(svc 0), 수신 CHAT(svc 5) 패킷을 `0x0c` 구분자로 파싱해 닉네임·메시지 추출. `CONFIG.SOOP_DEBUG`로 원본 프레임 로그 출력(프로토콜이 비공식이라 라이브 검증·필드 튜닝 지원).
*  **치지직 실제 채팅 클라이언트**: `polling/v2/channels/{채널ID}/live-status`로 방송 상태(OPEN)·채팅방ID(`chatChannelId`) 조회 → `comm-api.game.naver.com/.../access-token`로 익명 읽기용 `accessToken` 발급(code 42601이면 성인 인증 필요 방송이라 익명 불가) → `chatChannelId` 문자코드 합 해시로 채팅 서버(`kr-ss1~9`) 결정 → `wss://kr-ss{N}.chat.naver.com/chat` 접속 → **CONNECT(cmd 100, `accTkn` 포함)** → CONNECTED(cmd 10100) 후 CHAT(cmd 93101)의 `profile.nickname`/`msg` 파싱. keepalive: 서버 PING(cmd 0)→PONG(cmd 10000) + 20초 주기 PING. 두 REST 호출은 CORS 차단이라 프록시 경유(WS는 CORS 대상 아님, 직접 연결).
*  **CORS 프록시 / 웹소켓**: GitHub Pages 정적 환경의 브라우저 제약을 우회. SOOP·치지직 REST API는 **하나의 무료 Cloudflare Worker 프록시**([`proxy/soop-cors-proxy.worker.js`](proxy/soop-cors-proxy.worker.js), SOOP/아프리카 + `api.chzzk.naver.com`·`comm-api.game.naver.com` 도메인만 허용) 경유; 채팅 웹소켓은 양쪽 다 브라우저에서 직접 연결; 유튜브는 Data API v3 폴링.
*  **Smart Fallback**: 방송 비활성화·주소 오류·통신 장애·프록시 미설정 시 토스트로 안내 후, 대기열이 비면 `getNextMonsterData`가 자동으로 `[BOT]` 가상 시청자를 배정(별도 폴백 로직 불필요한 자연 폴백 구조).
*  ⚠️ 유튜브 연동은 `CONFIG.YOUTUBE_API_KEY` 필요(미설정 시 BOT 시뮬레이션). SOOP·치지직은 `CONFIG.SOOP_PROXY`/`CONFIG.CHZZK_PROXY`(같은 Worker 주소, 개발자 1회 배포)가 필요하며 미설정 시 BOT 폴백. **Worker는 치지직 도메인 허용본으로 재배포해야 치지직이 열림.**

### 2. 🙋 `!참여` 단일 명령어 참가 & 봇 자동 보충
*  **`!참여`만 참가 명령어로 인정**(`!참가`는 제거). '명령어 전용' 체크박스 해제 시 아무 메시지나 곧 참가 처리.
*  **봇 자동 보충(스폰 시점 폴백)**: 봇으로 큐를 미리 채우지 않는다. `MonsterManager.spawnMonster()` → `wordPacks.getNextMonsterData()` 호출 시 대기열이 비어 있으면 그 자리에서 `[BOT]`을 **한 명씩** 생성한다. 따라서 봇도 실참여자와 똑같이 **스폰 주기마다 한 명씩** 등장하며(좌상단 대기열 패널이 시작하자마자 봇으로 가득 차던 문제 해결), 실참여자가 큐에 있으면 항상 그들이 우선 소비된다. 동시 출전 수는 `MAX_MONSTER_CAP`(15) + 스폰 주기로 자연 조절. (기존 `topUpBotsToTarget`/`TARGET_MIN_POPULATION` 일괄 선(先)충전 방식은 제거 — 함수 정의는 미사용으로 잔존.)
*  **게임 시작 그레이스 타임(`START_SPAWN_DELAY_MS`, 기본 5000ms)**: '게임 시작' 직후 곧바로 몬스터가 튀어나오지 않고 **5초 대기** 후 첫 소환을 시작해, 그 사이 시청자가 `!참여`로 모일 여유를 준다. `startStage(stage, difficulty, startDelayMs)`의 3번째 인자로 전달되며 **게임 시작(1스테이지)에만 적용**되고 스테이지 전환(`advanceStage`)에는 지연이 없다(0). 지연/보스 타이머는 `clear()`에서 함께 정리해 재시작 시 누수 방지.
*  **대기열(`MAX_QUEUE_LENGTH` 30)**: 순번 대기 상한. 화면 동시 15 + 대기 30 = 순간 최대 45명 파이프라인. 봇 목표(20) < 큐 상한(30)이라 봇이 실참여자를 밀어내지 않음. 반응 신선함을 위해 60→30으로 축소.
*  **1인당 큐 상한(`MAX_QUEUE_PER_VIEWER` 2)**: 한 시청자가 큐에 동시에 대기할 수 있는 항목을 최대 2개로 제한(도배로 큐 독점 방지 → 채팅 폭주 시에도 여러 시청자가 골고루 등장). `[BOT]`은 예외(물량 보충용).
*  **참여자 명단 상한(`MAX_JOINED_VIEWERS` 10,000)**: `joinedViewers`(참여자 명단) 누적 인원 상한. 무제한 누적만 막는 안전장치라 대형 방송도 사실상 제한 없이 수용. 가득 차면 새 시청자의 `!참여`는 무시(기존 참여자 재참여는 계속 동작).
*  **판마다 명단 초기화 & 재모집**: 판이 끝나 **'메인 화면으로'(`returnToMain`)로 돌아갈 때** `wordPacks.resetParticipants()`로 명단·대기열·카운트를 비우고 홈의 채팅 연동 패널을 자동으로 펼쳐 시청자를 다시 `!참여`로 모집한다(방송 WebSocket 연결은 유지되어 URL 재입력 불필요). ⚠️ 게임 시작(`startGame`) 시점엔 리셋하지 않는다 — 시작 전에 모인 시청자가 지워지지 않도록. **'다시 도전하기'(`restartWithSameParticipants`)는 `startGame`을 그대로 호출**해 방금 판에 모인 참여자 명단을 유지한 채 즉시 새 판을 시작한다(재모집 없이 바로 한 판 더). 연동 패널의 **🗑️ 참여자 초기화** 버튼으로도 수동 초기화 가능.
*  **비속어 필터(`filterText`)**: 닉네임/채팅 문구에 항상 적용.

### 3. 💬 라이브 채팅 하이브리드 모드 (신규)
*  **기본(OFF)**: 몬스터 제시어는 항상 안전한 프리셋 단어팩에서 추출 — 방송 사고 방지.
*  **라이브 모드(ON)**: `!참여`한 시청자가 친 채팅 문구를 정제(`sanitizeLiveChatWord`)해 **타이핑 타깃으로 사용**. 정제 규칙: `!참여` 토큰 제거 → (설정 시) 이모티콘·특수문자 제거 → 비속어 필터 → 최대 글자수 컷.
*  **💬 채팅 대기열 누적**: 라이브 모드에선 `!참여`한 시청자의 후속 채팅이 **순서대로 대기열(`viewerQueue`)에 쌓여** 차례차례 몬스터로 등장한다(친 사람 모두 반영). 대형 방송의 채팅 폭주는 `CONFIG.QUEUE.MAX_QUEUE_LENGTH`(30) + 1인당 `MAX_QUEUE_PER_VIEWER`(2)로 자동 조절되고, 아무도 안 치면 봇 보충으로 폴백. 라이브 문구 몬스터는 좌상단 대기열 패널에 `🔥`로 강조.
*  **토글 위치**: 상단 컨트롤바 `💬 라이브 채팅 모드` 버튼으로 **게임 중에도 즉시 ON/OFF**(OBS·사운드 토글과 동일한 라이브 컨트롤 성격).
*  **세부 설정**: 단어/닉네임 팩 모달에서 최대 글자수·특수문자 제거 여부 설정. 라이브 채팅 설정 박스는 **모드 ON일 때만 보라색 테두리+글로우로 활성 상태를 표시**(OFF 시 테두리 꺼짐, `.live-active` 클래스로 양쪽 토글 동기화). 상태 전환 토스트는 🟢 ON / 🔴 OFF 스위치 표기.
*  **시각 강조**: 라이브 채팅 문구가 그대로 쓰인 몬스터는 하단 박스를 **보라색**으로 렌더링해 팩 단어 몬스터와 구분.
*  ※ 시청자 채팅은 항상 **닉네임(상단 태그)**으로 반영되며, 채팅 문구가 타깃이 되는 것은 라이브 모드일 때만.

### 4. 🏷️ 2단 몬스터 UI
*  **상단 Pill Tag**: 실참여 시청자 닉네임(플랫폼 접두사 포함) 또는 `[BOT]` 표식.
*  **하단 Target Box**: 팩 제시어(기본) 또는 라이브 채팅 문구(라이브 모드). 보스는 확대·금색, 라이브 채팅은 보라색으로 구분.
*  **동적 박스 폭**: `measureText`로 제시어/닉네임 실제 너비를 재서 박스 폭을 자동 확장(최소 110px 보장). 긴 단어(프리셋 hardcore 팩·라이브 채팅 문구 포함)가 박스를 넘치거나 옆 몬스터와 겹치지 않음.

### 4-1. 📝 단어팩 & 라이브 제시어 길이 처리
*  프리셋 팩(믹스/밈/하드코어/맞춤법/영문) 선택 + 실시간 미리보기(칩).
*  ※ 자율 커스텀 단어장은 라이브 채팅 모드와 역할이 겹쳐 제거함(프리셋 + 라이브 채팅 조합으로 대체).
*  라이브 채팅 제시어: 시청자가 길게 치면 최대 글자수(모달 설정 6/8/10/14, 기본 10)로 **잘라서(truncate)** 사용.

### 5. 🛡️ 대형 방송 마비 방지 (Max Monster Cap)
*  화면 동시 출전 몬스터를 **`CONFIG.MAX_MONSTER_CAP`(기본 15)로 고정 제한**(난이도와 무관한 하드 상한). MonsterManager가 난이도 테이블의 `maxMonsterCap`과 `Math.min`으로 clamp.

### 6. 🎚️ 난이도별 밸런스 테이블 (신규 — `CONFIG.DIFFICULTY`)
*  4단계(Easy/Normal/Hard/Hell) 각각에 대해 아래 값을 차등 적용:
   *  `speedMult`(낙하속도 배율), `maxMonsterCap`(동시 상한, 15 고정), `spawnIntervalBase/Step/Min`(스폰 주기), `killPerStageBase/Step`(스테이지 클리어 처치목표), `maxHp`(기지 체력), `damagePerLeak`(피격 데미지).
*  **낙하속도는 스테이지가 오를수록 가속**: `speed = (0.28 + (stage-1)*0.15) * speedMult`. 스테이지1은 낙하 약 25초로 매우 느려 **초보(~50타)도 클리어 가능**하고, 스테이지마다 +0.15씩 빨라진다.
*  **스테이지1 온램프 밸런스**: `spawnIntervalBase 18600·Step 2600·Min 1200`(스테이지1 스폰 약 16초), `killPerStageBase 8·Step 2`(스테이지1 처치 8마리 → 스테이지마다 +2). 초보 타이피스트가 스테이지1을 넘긴 뒤, 스테이지2부터는 점점 더 빠른 타수를 요구하도록 낙하·스폰·처치수가 함께 상승. (난이도 선택 UI는 없어 실제로는 `normal`만 사용되며, 표는 `speedMult`를 축으로 일관되게 유지)
*  `MonsterManager`/`StateManager`/`game.js`가 `getDifficultyConfig()`로 공용 참조.

### 7. 💻 PC 전용 UI 및 모달/레이아웃 최적화 (1024x768)
*  **1024×768 고정 레이아웃 + 비율 스케일(scale-to-fit)**: 상단바(60px) + 게임 무대(`#game-stage.game-viewport`, **논리 크기 1024×708 고정**) = 1024×768(PC 최소 해상도)에 정확히 맞음. 무대는 부모 프레임(`.stage-frame`)에서 `transform: scale(var(--stage-scale))`로 창에 맞춰 비율 유지하며 확대/축소한다(`GameEngine.fitStage()`가 상단바 아래 남는 영역 기준으로 `min(availW/1024, availH/708)` 배율 계산 — 1024×768 창에선 scale=1로 딱 맞음). 게임 좌표·방어선·몬스터 위치가 창 크기와 무관하게 **불변** → 창 리사이즈/탭 복귀로 인한 좌표·방어선 급변 버그를 원천 차단. 무대보다 다른 비율의 창은 레터박스 처리(OBS에선 투명).
*  **홈/게임오버 화면은 고정 무대 밖으로 분리**: `#screen-main`·`#screen-gameover`는 게임플레이가 아니라 입력 폼이므로 스케일되는 무대(`#game-stage`) 밖(`.stage-frame` 직속)에 두어, **상단바 아래 전체 영역을 항상 꽉 채운다**(무대가 세로로 레터박스될 때 홈 화면이 상단바와 떨어져 보이던 문제 해결). 게임플레이 요소(캔버스/HUD/대기열/배너/입력바)만 고정 무대 안에 유지.
*  **반응형 상단바(아이콘 접힘 + 호버 툴팁)**: 각 컨트롤 버튼(`.qc-btn`)을 `아이콘(.qc-ic) + 라벨(.qc-tx)` span으로 구성하고 `data-tip` 부여. `@media (max-width:1439px)`에서 라벨을 숨겨 아이콘만 표시하고 `:hover::after`로 이름(토글은 현재 상태)을 툴팁 표시 → 좁은 폭에서도 넘침 없음. 토글 버튼(라이브/OBS/사운드)은 `GameEngine._setQcLabel()`로 라벨/아이콘 span과 `data-tip`만 갱신(전체 innerHTML 교체를 피해 구조 유지).
*  모달 너비 `min(96%, 800px)`, 높이 `max-height: 72vh`, `.modal-body` 독립 스크롤. (모달은 무대 스케일과 무관하게 전체 화면 오버레이 유지)
*  **버튼/광고 구역 분리**: `.modal-actions`(버튼, 위) + `.modal-footer`(광고, 아래)를 별도 구역으로 구조화. 단일/소수 버튼은 가장자리 여백(`.modal-actions-pad`) 확보.
*  후원 모달 레이아웃 최적화(카카오뱅크 QR·계좌 복사 가로 배치).

### 8. 🎯 스마트 타깃 우선순위 & OBS 가시성
*  **바닥 우선 타깃팅**: 동일 제시어 다수 시 기지에 가장 가까운(Y 최대) 몬스터 우선 처치(`checkHit`).
*  **OBS 크로마키 가시성**: 텍스트 두꺼운 아웃라인(Stroke) + Drop Shadow. `body.obs-overlay` 클래스로 배경 투명화(상단바 `📺 OBS 크로마키` 토글).

### 9. 👤 1인 솔로 모드 & 중앙 포탑
*  스트리머 닉네임 단일 입력(**필수** — 입력값이 실제 포탑/저장에 반영). 난이도 선택 UI는 제거되어 표준(`normal`) 밸런스로 고정 실행(스테이지 상승 시 난이도 테이블에 따라 자동 가속).
*  중앙 단일 포탑 회전각($\theta$)·레이저 빔·폭발 파티클·반동. **좌표는 `clientWidth/clientHeight`(고정 1024×708 논리 픽셀) 기준**으로 계산해 창 크기 변화·4K/Retina(DPR≠1)에서도 정위치(무대 스케일은 CSS transform이므로 `clientWidth`는 항상 1024로 불변).
*  **포탑·방어선 하단 배치**: 하단 타자 입력 바가 대포를 가리지 않도록 포탑(`height−105`)과 방어선/몬스터 도달선(`groundY = height−160`, CanvasRenderer·MonsterManager 동일값 유지)을 배치(대포~방어선 간격 55px). 방어선을 소폭 내려 낙하 구간을 넓혔다.
*  **HUD 상태바는 무대 상단에 부착**: `#game-hud`(STAGE/SCORE/타수/COMBO/체력/FEVER)를 `top:0` 전체 폭 띠로 두고 하단 네온 경계선으로 상단바와 이어지게 표시. 몬스터는 이 상태바 아래(`y:130`)에서 등장해 제시어가 상태창에 가려지지 않으며, 출전 대기열 패널은 `top:80`으로 내려 겹침을 피한다.

### 10. ⌨️ 한글 자모 획수 기반 CPM/WPM & 콤보 & 피버
*  IME 조합 완료 감지, 초/중/종성 획수 정밀 연산(`getHangulStrokeCount`)으로 CPM/WPM 산출 → HUD 실시간 표시.
*  **콤보**: 명중 시 증가, 오타/피격 시 초기화. 최대 콤보 기록.
*  **🔥 피버 모드**: 콤보 누적으로 게이지가 차면 6초간 **점수 2배**(사운드/토스트 연출), 이후 게이지 리셋.

### 11. ♾️ 무한 Stage & 5 Stage 단위 보스전
*  처치목표(`killPerStageBase + floor((stage-1)*killPerStageStep)`) 달성 시 다음 스테이지로 진행.
*  **5 Stage마다 보스전**: WARNING 배너 → 보스 소환(확대·다중 피해). 보스 처치 시 즉시 다음 스테이지.

### 12. 👑 등급 뱃지(SSS~D) & 명예의 전당 (최고 도달 스테이지 기준)
*  점수 기반 등급(`calculateRankGrade`), **0점/0처치 시 'D' 예외 처리**.
*  **최고 도달 스테이지 기준 단일 TOP 5** 저장/조회 (동점이면 점수 내림차순 타이브레이크). 난이도 선택 제거에 맞춰 난이도별 분리·탭을 걷어낸 통합 랭킹:
   *  로컬: `localStorage`에 단일 리스트로 상위 20개 보관·상위 5개 표시. 옛 난이도별 데이터도 이 기준으로 자동 재정렬.
   *  글로벌: Firebase Firestore(`leaderboard` 컬렉션). `stage` 내림차순으로 넉넉히 조회 후 클라이언트에서 동점은 점수순으로 재정렬(단일 필드 orderBy → 복합 인덱스 불필요). 미설정/오류 시 로컬 폴백.
*  표시는 STAGE를 금색 주지표로 강조하고 등급·점수·WPM·날짜는 보조로 배치. 명예의 전당 모달은 순위 조회 전용.
*  **🏅 이번 판 MVP**: 게임오버 결과 화면에 실참여 시청자(봇·보스 제외) 중 몬스터를 가장 많이 낸 닉네임을 MVP 배너로 표시. **집계 기준은 처치가 아니라 "등장(참여)"** — 스폰 시점에 `MonsterManager.spawnMonster`가 `window.gameEngine.trackMvpAppearance(닉네임)`을 호출해 닉네임별 등장 수를 누적(`game.mvpTracker`)하므로 스트리머가 못 죽여도 카운트됨. 동점이면 먼저 참여한 시청자 우선(`computeMvp`), 참여자가 없으면(봇만) 배너 자동 숨김. 닉네임은 시청자 입력값이라 `innerText`로 안전 출력.

### 13. 🌐 Firebase 글로벌 리더보드 & 📊 Analytics (신규 — 선택형)
*  **Firestore 글로벌 리더보드**: `CONFIG.FIREBASE.apiKey` 설정 시 자동 활성. 보안 규칙으로 읽기 공개 + 최소 검증(점수·스테이지 범위/닉네임 길이)만 허용, 클라이언트 수정·삭제 금지. ⚠️ 스테이지 기준 개편에 맞춰 규칙을 `difficulty` 제거 + `stage` 검증본으로 교체·게시 필요(`js/globalLeaderboard.js` 상단 주석 참고).
*  **💡 건의사항(`suggestions`)**: 읽기 비공개(`allow read: if false`) + create만 최소 검증(text 1~500자, nickname ≤20자)으로 허용. 운영 프로젝트에는 규칙 게시 완료(활성). 새 Firebase 프로젝트로 배포 시엔 동일 규칙을 추가·게시해야 전송 가능(`js/globalLeaderboard.js` 상단 주석 참고).
*  **Analytics(GA4)**: `measurementId` 설정 시 활성. `game_start`/`game_over`/`difficulty_selected`/`chat_platform_connected` 이벤트 수집(개인식별정보 미전송).
*  두 기능 모두 실패해도 게임 진행에 영향 없음(try/catch 격리).

### 14. 💰 수익화 광고 & 후원
*  카카오 애드핏 `728x90` **6개 슬롯**(메인/결과/단어팩/명예의전당/후원/건의사항). 모달 오픈 시 `refreshAdfitSlot()` 동적 리프레시(광고 단위 ID가 미발급 플레이스홀더면 주입을 건너뜀).
*  카카오뱅크 계좌복사(`3333-28-2684443`) 및 QR(`donation-qr.png`) 후원 모달.

### 15. ✨ UX 연출
*  **토스트 알림 시스템**(`window.showToast`): 연동 성공/실패, 신기록, 팩 적용 등 피드백.
*  **배경 파티클(스타필드)**: `#bg-canvas`에 드리프트 파티클. OBS 모드 시 비표시.
*  단어팩 미리보기(칩), 난이도/등급/채널칩 색상 구분 등.

---

## 📂 프로젝트 파일 구조 및 역할

1.  **`index.html`**
    *  메인 화면(스트리머 닉네임 입력 + 홈 인라인 방송 채팅 연동 패널), 4개 모달(단어팩/명예의전당/후원/건의사항), 상단 컨트롤바 7개 버튼.
    *  카카오 애드핏 6개 슬롯, Firebase SDK(app/firestore/analytics compat) 로드, 스크립트 의존성 로드(`globalLeaderboard.js` 포함).

2.  **`style.css`**
    *  1024x768 고정 레이아웃, 모달 잘림 방지, `.modal-actions`/`.modal-footer` 분리, `body.obs-overlay` 투명 스타일, 토스트/등급뱃지/난이도탭/단어칩/피버 등 컴포넌트 스타일.

3.  **`js/config.js`**
    *  `CONFIG.YOUTUBE_API_KEY`, **`CONFIG.SOOP_PROXY`/`CONFIG.SOOP_DEBUG`(SOOP 프록시·디버그)**, `CONFIG.FIREBASE`(리더보드/애널리틱스), `CONFIG.KAKAO_ADFIT`(6개), **`CONFIG.DIFFICULTY`(난이도 밸런스 테이블)** + `getDifficultyConfig()`, **`CONFIG.MAX_MONSTER_CAP`(동시 출전 절대 상한)·`CONFIG.QUEUE`(참여/큐/봇 보충 튜닝)**, 광고 리프레시 로직.

4.  **`js/wordPacks.js`**
    *  단어팩(기본/프리셋/보스), 시청자 대기열(`{nickname, chatWord}`) 관리, `!참여` 처리·참가자 명단, 봇 자동 보충, **라이브 채팅 정제(`sanitizeLiveChatWord`)**, 비속어 필터, 한글 자모 획수 유틸.

5.  **`js/audio.js`**
    *  Web Audio API 효과음 5종(레이저/폭발/피버/오타/팡파르) + Mute.

6.  **`js/chatIntegration.js`**
    *  플랫폼별 URL 파서, SOOP/치지직/유튜브 다중 연동, **SOOP·치지직 채팅 프로토콜 클라이언트**(SOOP: 핸드셰이크·패킷 빌드/파싱 / 치지직: live-status·access-token→WS cmd 100·PING/PONG·CHAT 파싱, `CONFIG.SOOP_PROXY`/`CONFIG.CHZZK_PROXY` 경유), Smart Fallback 토스트 안내, `handleIncomingChat` → `wordPacks.processChatMessage` 전달.

7.  **`js/globalLeaderboard.js`**
    *  Firebase 초기화, Firestore 점수 제출/스테이지 기준 조회(`submitScore`/`fetchTop`), 💡 건의사항 저장(`submitSuggestion` → `suggestions` 컬렉션, 읽기 비공개), Analytics `logEvent`. 미설정 시 자동 비활성. 상단 주석에 리더보드·건의사항 Firestore 보안 규칙 포함.

8.  **`js/core/StateManager.js`**
    *  상태 머신, 무한 Stage/HP/점수/콤보/CPM·WPM/피버 관리, 난이도별 체력·데미지 적용, 등급 환산, **최고 도달 스테이지 기준 단일 로컬 TOP5** 저장/조회.

9.  **`js/core/TurretManager.js`**
    *  중앙 포탑 좌표(논리 픽셀 기준)·회전각·사격·반동.

10. **`js/core/MonsterManager.js`**
    *  난이도별 스폰/속도/상한, 대기열 소비, 5 Stage 보스전(WARNING), `isLiveChat` 플래그 전달, 낙하 관리.
    *  **탭 백그라운드 스폰 정지**: 주기 스폰은 `setInterval`이지만 `_spawnTick()`에서 `document.hidden`이면 스폰을 건너뛴다. 낙하(움직임)는 `requestAnimationFrame`이라 탭 숨김 시 자동 정지되므로, 다른 탭을 보는 동안 몬스터가 화면 밖에서 쌓였다가 복귀 시 한꺼번에 몰리는 현상을 방지.

11. **`js/core/InputManager.js`**
    *  단일 타자 입력, 한글 IME 조합 감지, 바닥 우선 타깃팅 유틸(`.text` 기준).

12. **`js/renderers/CanvasRenderer.js`**
    *  **논리 좌표계 1024×708 고정** Draw. `resizeCanvas()`는 백버퍼를 `getBoundingClientRect()`(무대 scale 반영) × `devicePixelRatio`로 잡고 `setTransform`으로 1024×708 논리 좌표를 매핑 → 어떤 창 배율·DPR에서도 선명. 2단 몬스터 UI(보스 금색·확대 / 라이브 채팅 보라색, 흰 글자+불투명 상자+정수 픽셀 정렬로 가독성 강화), OBS 가시성 Stroke·Shadow, 이펙트.

13. **`js/game.js`**
    *  메인 루프 오케스트레이터. 전 UI 배선(모달·닉네임 필수·홈 인라인 채팅연동 패널·단어팩·명예의전당·OBS·사운드·**라이브 채팅 토글**), 스테이지 진행, 사운드/피버/보스 배너 연출, 배경 파티클, 토스트, 글로벌 리더보드/애널리틱스 연동.

14. **`proxy/soop-cors-proxy.worker.js`**
    *  SOOP 연동용 무료 Cloudflare Worker CORS 프록시. `player_live_api.php` 요청을 pass-through로 중계하고 CORS 헤더 부여. SOOP/아프리카 도메인만 허용(오픈 프록시 악용 방지). 개발자가 1회 배포 후 주소를 `CONFIG.SOOP_PROXY`에 입력.

15. **`docs/SOOP_연동_설정.md`**
    *  SOOP 프록시(Cloudflare Worker) 배포·설정 단계별 가이드 + `SOOP_DEBUG` 콘솔 로그 기반 라이브 문제 해결.

# 🎮 word-typing-defense (스트리머 워드 디펜스) 구현 계획서

스트리머 1인 솔로 플레이에 최적화된 단일 입력 웹 타자 디펜스 환경을 제공하며, 화면상에는 시청자 닉네임 뱃지와 타깃 제시어(밈/유행어/실시간 채팅)가 직관적으로 구분되는 **2단 몬스터 UI 시스템**을 구축합니다.
모바일 접속은 배제하고 방송 표준 해상도인 **1280×720 (16:9, PC 전용)** 을 논리 프레임으로 사용합니다. 상단바를 포함한 앱 전체를 창 크기에 맞춰 비율 스케일(`fitBroadcastFrame`)하여 720p·1080p 송출 화면을 정확히 채우고, 다른 화면 비율에서는 잘림 없는 레터박스로 표시합니다. 게임 논리 무대는 **1280×660**이며 OBS 크로마키 및 투명 오버레이를 지원합니다.

---

## 🎮 1. 프로젝트 개요

| 구분 | 사양 |
| :--- | :--- |
| **게임명 / 프로젝트명** | `word-typing-defense` (스트리머 워드 디펜스) |
| **타깃 플랫폼 & 해상도** | PC Desktop 전용 (방송 표준 논리 프레임 **1280×720, 16:9**, 논리 무대 **1280×660**, 720p·1080p 비율 스케일, OBS 크로마키/투명 오버레이 지원) |
| **웹 배포 및 접속 주소** | **GitHub Pages 단일 Git URL 배포** (`https://golddragon0207.github.io/word-typing-defense/`) |
| **플레이 모드** | **1인 솔로 스트리머 전용 디펜스** |
| **방송 채팅 연동 방식** | **원클릭 방송 URL 파싱 연동**(방송 주소 입력 시 자동 ID 추출). SOOP/치지직/유튜브 **동시 다중 연동**. SOOP·치지직 REST는 전용 무료 Cloudflare Worker 프록시(`CONFIG.SOOP_PROXY`/`CONFIG.CHZZK_PROXY`, 개발자 1회 배포) 경유 |
| **몬스터 UI 시스템** | **2단 UI**(상단: 시청자 닉네임 Pill Tag / 하단: 제시어 Target Box). 보스는 금색·확대(`scale: 1.65`) + HP 하트(`HP ♥♥`) + 차지 게이지(`CHARGE`), 라이브 채팅 문구는 보라색 강조. **동시 출전 Max Cap 15마리** |
| **밸런스** | 밸런스 테이블(`CONFIG.DIFFICULTY`)로 낙하속도·스폰주기·기지 체력·피격 데미지·스테이지 처치목표 관리. 표준(`normal`)으로 실행하며 스테이지별 자동 상승 |
| **명예의 전당** | **최고 도달 스테이지 기준 단일 TOP 5**(동점 시 점수순). 로컬(`localStorage`) 기본 + Firebase Firestore **글로벌 리더보드**(설정 시 자동 활성, 미설정 시 로컬 폴백). 3가지 뷰 — **📜 전체 순위 보기(최대 200위)** / **🙋 내 순위 보기(글로벌 점수 기준 `#N위 / 총 M명 · 상위 X%`)** / **🔎 닉네임 검색**. 모달 진입 시 상위 200을 1회만 로드·캐시해 뷰 전환·검색은 추가 조회 없이 처리 |
| **화면 & 모달** | 홈 카드 `width: min(94%, 1000px)`, 결과·모달 카드 최대 800px / 모달 세로 `max-height: 520px`. 버튼 영역(`.modal-actions`)과 광고 영역(`.modal-footer`) 분리 |
| **상단 컨트롤바 (6개)** | 🏆 명예의 전당, ☕ 개발자 후원, 💡 건의사항, 💬 라이브 채팅 모드, 📺 OBS 크로마키, 🔊 사운드 ON/OFF(방송 채팅 연동은 홈 화면 인라인 패널). **게임 중에는 앞 3개(모달) 자동 잠금**, 뒤 3개(라이브/OBS/사운드)는 상시 조작 |
| **수익화 광고 및 후원** | 카카오 애드핏 `728x90` **5개 슬롯**(메인/결과/명예의전당/후원/건의사항) + **카카오뱅크(`3333-28-2684443`) 계좌 복사 & QR(`donation-qr.png`)** 후원 모달 |
| **선택형 백엔드** | Firebase(무료 티어) — Firestore 글로벌 리더보드(`leaderboard`) + 건의사항(`suggestions`) 저장 + Analytics(GA4). `CONFIG.FIREBASE` 미설정 시 전 기능 자동 비활성/로컬 폴백 |

---

## 🎯 2. 주요 기능 및 상세 정책

### 1. 📡 원클릭 방송 URL 실시간 채팅 연동 (치지직/SOOP/유튜브 다중)
* **URL 자동 파서 (`ChatIntegrationEngine.parseStreamUrl`)**: 붙여넣은 방송 주소에서 채널 ID 자동 추출.
  * 치지직: URL 위치 무관하게 첫 32자리 hex 추출(`chzzk.naver.com/live/{ID}`·`chzzk.naver.com/{ID}`·`studio.chzzk.naver.com/{ID}/live` 지원).
  * SOOP: `sooplive.com`·`sooplive.co.kr`·`afreecatv.com` 도메인 지원, 첫 경로 세그먼트 = BJ ID.
  * 유튜브: Video ID 추출 (`v=` 쿼리, `/live/` 경로, `youtu.be/` 단축 URL 지원).
* **다중 플랫폼 동시 연동**: `channels[]` 배열 구조로 SOOP + 치지직 + 유튜브 동시 연결. 각 플랫폼 채팅은 플랫폼 접두사(🔵/🟢/🔴)와 함께 하나의 시청자 대기열로 병합. 연동 모달 기본 탭·시작화면 배지는 **SOOP 선두** 배치.
* **참여자 목록 표시**: `!참여`한 시청자를 홈 화면 채팅 연동 패널(`<details id="home-chat-panel">`)에 실시간 목록(총원 + 최근 참여자 칩)으로 표시.
* **스트리머 닉네임 필수 입력**: 스트리머 닉네임 칸(`#input-player-nickname`)은 홈 화면 채팅 연동 패널 안(참여자 명단 바로 위)에 위치하며 **필수 입력**. 빈 값으로 게임 시작 시 시작을 막고 패널을 펼쳐 입력칸에 포커스.
* **SOOP 실제 채팅 클라이언트 (`connectSoop`)**: `player_live_api.php`로 방송번호(BNO)·**채팅방번호(CHATNO)**·채팅서버(CHDOMAIN/CHPT) 조회 → `wss://{CHDOMAIN}:{CHPT+1}/Websocket/{BJID}` 접속(서브프로토콜 `chat`) → **LOGIN(svc 1, 익명 CONNECT 페이로드 = 구분자×3 + `16` + 구분자)** → 응답 후 **JOIN(svc 2, 입장 대상은 `CHATNO`)** → 주기 PING(svc 0, 60초), 수신 CHAT(svc 5) 패킷을 `0x0c` 구분자로 파싱해 닉네임·메시지 추출. `CONFIG.SOOP_DEBUG`(**프로덕션 기본 false** — 켜면 채팅 메시지마다 원본 프레임을 콘솔 출력)로 파싱 규격 튜닝 로그 확인.
* **치지직 실제 채팅 클라이언트 (`connectChzzk`)**: `polling/v2/channels/{채널ID}/live-status`로 방송 상태(OPEN)·채팅방ID(`chatChannelId`) 조회 → `comm-api.game.naver.com/.../access-token`으로 익명 읽기용 `accessToken` 발급(code 42601이면 성인 인증 방송이라 익명 불가) → `chatChannelId` 문자코드 합 해시로 채팅 서버(`kr-ss1~9`) 결정 → `wss://kr-ss{N}.chat.naver.com/chat` 접속 → **CONNECT(cmd 100, `accTkn` 포함)** → CONNECTED(cmd 10100) 후 CHAT(cmd 93101)의 `profile.nickname`/`msg` 파싱. keepalive: 서버 PING(cmd 0)→PONG(cmd 10000) + 20초 주기 PING. REST 호출은 CORS 대상이라 프록시 경유, WS는 직접 연결.
* **CORS 프록시 / 웹소켓**: SOOP·치지직 REST API는 **하나의 무료 Cloudflare Worker 프록시**([`proxy/soop-cors-proxy.worker.js`](proxy/soop-cors-proxy.worker.js), SOOP/아프리카 + `api.chzzk.naver.com`·`comm-api.game.naver.com` 도메인 허용) 경유; 채팅 웹소켓은 양쪽 다 브라우저에서 직접 연결; 유튜브는 Data API v3 폴링.
* **Smart Fallback**: 방송 비활성화·주소 오류·통신 장애·프록시 미설정 시 토스트 안내 후, 대기열이 비면 `getNextMonsterData`가 자동으로 `[BOT]` 가상 시청자를 배정(대기열 소비 시점의 자연 폴백 구조).
* ⚠️ 유튜브 연동은 `CONFIG.YOUTUBE_API_KEY` 필요(미설정 시 BOT 시뮬레이션). SOOP·치지직은 `CONFIG.SOOP_PROXY`/`CONFIG.CHZZK_PROXY`(같은 Worker 주소) 필요(미설정 시 BOT 폴백).

### 2. 🙋 `!참여` 참가 등록 & 봇 자동 보충
* **`!참여`만 참가로 인정**: `!참여`를 친 시청자만 참가자 명단(`joinedViewers`)에 등록되어 **라이브 채팅 제시어 후보·MVP 집계 대상** 자격을 얻는다. **비-라이브 모드**에선 등록과 동시에 출전 대기열(`viewerQueue`)에 1건 등록되고(`processChatMessage` → `enqueueViewer`), 화면 출전은 즉시가 아니라 **스폰 주기가 돌아왔을 때** `MonsterManager.spawnMonster` → `getNextMonsterData`가 대기열에서 순번대로 한 명씩 꺼내 몬스터로 소환하는 방식이다. **라이브 모드**에선 `!참여`가 **명단 등록만** 하고 대기열에 넣지 않아 랜덤 단어 몬스터가 뜨지 않으며, 그 시청자가 실제 한글 채팅을 쳐야 대기열에 쌓여 몬스터가 된다(단 `!참여 안녕`처럼 같은 줄 한글은 즉시 큐 적재). **`!참여`하지 않은 시청자의 일반 채팅은 라이브 모드 여부와 무관하게 무시**한다.
* **봇 자동 보충(스폰 시점 폴백)**: 대기열이 비었을 때만 소환 시점에 `[BOT]`을 한 명 생성한다(`getNextMonsterData`). 실참여자가 큐에 있으면 항상 봇보다 먼저 출전한다.
* **소환 딜레이(`START_SPAWN_DELAY_MS` 5000ms / `STAGE_UP_SPAWN_DELAY_MS` 3000ms)**: 게임 시작 직후는 5초, 스테이지 전환 때는 3초 대기 후 첫 소환을 시작해 시청자가 `!참여`로 모일 여유를 준다. 게임 시작 시 화면 중앙 카운트다운 오버레이(`#start-countdown`)에 5초 카운트다운 연출. **보스 스테이지는 이 딜레이(3초) 동안 화면이 비지 않도록 WARNING 배너를 `startStage` 시점에 즉시 띄우고(그레이스 시작과 동시), 배너가 사라진 직후(그레이스 종료 시점)에 보스를 소환한다.** 배너 표시시간은 그레이스−400ms로 잡아 보스 제시어(중앙 부근)와 겹치지 않게 한다.
* **대기열(`MAX_QUEUE_LENGTH` 30)**: 순번 대기 상한. 화면 동시 15 + 대기 30 = 순간 최대 45명 파이프라인.
* **1인당 큐 상한(`MAX_QUEUE_PER_VIEWER` 2)**: 한 시청자가 큐에 동시에 대기할 수 있는 항목을 최대 2개로 제한(도배로 큐 독점 방지, 여러 시청자가 골고루 등장). `[BOT]`은 예외.
* **참여자 명단 상한(`MAX_JOINED_VIEWERS` 10,000)**: `joinedViewers` 누적 인원 상한(무제한 누적 방지용 안전장치, 대형 방송도 사실상 제한 없음). 가득 차면 새 시청자의 `!참여`는 무시(기존 참여자 재참여는 계속 동작).
* **판마다 명단 초기화 & 재모집**: 판이 끝나 **'메인 화면으로'(`returnToMain`)로 돌아갈 때** `wordPacks.resetParticipants()`로 명단·대기열·카운트를 비우고 홈의 채팅 연동 패널을 자동으로 펼쳐 다시 `!참여`로 모집한다(방송 WebSocket 연결은 유지, URL 재입력 불필요). 게임 시작(`startGame`) 시점엔 명단을 리셋하지 않아 시작 전에 모인 시청자를 유지한다(단, **라이브 모드에선 `startGame`이 대기열만 비워** 홈 화면 잡담이 첫 제시어가 되지 않게 한다 — 명단은 유지). **'다시 도전하기'(`restartWithSameParticipants`)는 `startGame`을 그대로 호출**해 방금 판 참여자 명단을 유지한 채 즉시 새 판을 시작(재모집 없이 바로 한 판 더). 연동 패널의 **🗑️ 참여자 초기화** 버튼으로도 수동 초기화 가능.
* **비속어 필터(`filterText`)**: 닉네임/채팅 문구에 항상 적용 (13종 기본 비속어).

### 3. 💬 라이브 채팅 하이브리드 모드
* **두 모드 모두 상단 뱃지는 `!참여` 시청자 닉네임**을 그대로 쓰고, **차이는 하단 제시어를 어디서 뽑느냐**뿐이다(`getNextMonsterData`의 `word: chatWord || randomWord` / `isLiveChat: !!chatWord`).

  | 구분 | 상단 뱃지(닉네임) | 하단 제시어 | 하단 박스 색 |
  | :--- | :--- | :--- | :--- |
  | **라이브 OFF(기본)** | `!참여` 시청자 닉네임 | 기본 제시어 풀(`wordPacks.words3`/`words4`, **화면에 떠 있는 단어 제외**) | 일반 색 (`rgb(168, 0, 52)`) |
  | **라이브 ON** | `!참여` 시청자 닉네임 | 그 시청자가 친 채팅 문구(정제) | 보라색 (`rgb(74, 0, 140)`, stroke `#bf00ff`) |

* **기본(OFF)**: `!참여` 시청자의 후속 채팅은 대기열에 쌓지 않고, 소환 시 제시어를 항상 안전한 단어팩에서 뽑는다(`processChatMessage`가 라이브 분기를 건너뛰어 후속 일반 채팅은 무시 → `chatWord`가 `null`이라 팩 단어 사용). 부적절한 채팅 문구가 화면에 뜨는 방송 사고를 원천 차단.
* **라이브 모드(ON)**: `!참여`한 시청자가 친 채팅 문구를 정제(`sanitizeLiveChatWord`)해 **타이핑 타깃으로 사용**. 정제 규칙: `!참여` 토큰 제거 → 공백 전량 제거 → **한글만 남기기**(완성형 `가-힣` + 자모 `ㄱ-ㅎ`/`ㅏ-ㅣ` 외 영문·숫자·이모티콘·특수문자 전량 제거) → 비속어 필터 → 최대 글자수 컷. **영문·숫자 제거 이유**: 제시어에 영문이 섞이면(예: `레게노gg`) 플레이어가 단어 중간에 한/영 키를 눌러야 해 사실상 못 치는 '억까' 타깃이 되므로, 한글 IME 상태 그대로 끝까지 칠 수 있게 한글만 남긴다. 정제 결과가 빈 문자열이면(예: `gg`, `hello123`) 대기열에 넣지 않아 몬스터가 되지 않는다.
* **`!참여`는 랜덤 몬스터를 띄우지 않음(라이브 모드)**: 라이브 모드에선 `!참여`가 **명단 등록만** 하고 단어팩 랜덤 몬스터를 소환하지 않는다. 그 시청자가 실제 한글 채팅을 쳐야 그 문구로 몬스터가 된다(억지 랜덤 단어 대신 진짜 채팅만 타깃). 단 `!참여 안녕`처럼 같은 줄에 한글이 붙어 있으면 그 문구를 즉시 타깃으로 큐에 넣는다. (비-라이브 모드는 기존대로 `!참여` 즉시 랜덤 단어 몬스터 1마리 소환)
* **제시어 인정 시점 = 게임 시작부터(라이브 모드)**: 채팅 수집은 게임 상태 게이트가 없어 홈 화면부터 계속 대기열에 쌓이지만, 라이브 모드에선 `startGame()`이 새 판 시작 때 **대기열만 비운다**(`wordPacks.clearQueue()`). 홈 화면에서 오간 잡담 한글 채팅이 첫 몬스터 제시어로 튀어나오지 않게 하기 위함이며, 참여자 명단(`joinedViewers`)은 유지되므로 시청자는 다시 `!참여`할 필요가 없다. START 이후(5초 그레이스 포함) 친 채팅부터 제시어로 인정된다.
* **💬 채팅 대기열 누적**: 라이브 모드에선 `!참여`한 시청자의 후속 한글 채팅이 **순서대로 대기열(`viewerQueue`)에 쌓여** 차례차례 몬스터로 등장한다(친 사람 모두 반영). 채팅 폭주는 `CONFIG.QUEUE.MAX_QUEUE_LENGTH`(30) + 1인당 `MAX_QUEUE_PER_VIEWER`(2)로 조절되고, 아무도 안 치면 봇 보충으로 폴백. 라이브 문구 몬스터는 좌상단 대기열 패널에 `🔥`로 강조.
* **토글 위치(2곳, 양방향 동기화)**: ① 상단 컨트롤바 `💬 라이브 채팅 모드` 버튼 — **게임 중에도 즉시 ON/OFF**(OBS·사운드 토글과 동일한 라이브 컨트롤). ② 홈 화면 **참여자 명단 헤더**의 `💬 라이브 모드` 버튼 — 방송 세팅 단계에서 참여자 명단 바로 옆에서 켠다. 두 버튼(`#btn-live-chat-toggle` / `#btn-modal-live-chat-toggle`)은 실시간 동기화되며, ON이면 보라색으로 활성 표시. 클릭 후 버튼 포커스 해제(`_blurQuickControl`, 라이브/OBS/사운드 공용) — 게임 중이면 입력창으로 포커스를 되돌린다.
* **세부 설정(고정값)**: 제시어 최대 글자수 `4자`(일반 몬스터 최대치) · 이모티콘/특수문자 제거는 `wordPacks` 기본값(`liveChatMaxLen=4`, `liveChatStripSpecial=true`)으로 **고정**(별도 UI 없음 — 과거 단어/닉네임 팩 모달의 설정 박스는 제거). 상태 전환 토스트는 🟢 ON / 🔴 OFF 표기.
* **시각 강조**: 라이브 채팅 문구가 쓰인 몬스터는 하단 박스를 **보라색**(`rgb(74, 0, 140)`)으로 렌더링해 팩 단어 몬스터와 구분.
* ※ 시청자 채팅은 항상 **닉네임(상단 태그)** 으로 반영되며, 채팅 문구가 타깃이 되는 것은 라이브 모드일 때만.

### 4. 🏷️ 2단 몬스터 UI
* **상단 Pill Tag**: 실참여 시청자 닉네임(플랫폼 접두사 포함) 또는 `[BOT]` 표식.
* **하단 Target Box**: 팩 제시어(기본) 또는 라이브 채팅 문구(라이브 모드). 보스는 확대·금색, 라이브 채팅은 보라색.
* **동적 박스 폭**: `measureText`로 제시어/닉네임 실제 너비를 재서 박스 폭을 자동 확장(최소 110px 보장). 긴 단어나 라이브 채팅 문구가 박스를 넘치거나 옆 몬스터와 겹치지 않음.

### 5. 📝 단어팩 & 라이브 제시어 길이 처리
* **기본 제시어 풀(`wordPacks.words3` / `wordPacks.words4`)**: 방송/게임/개발/음식·일상/밈/자연/동물/장소 등 8개 카테고리를 **3글자 풀(words3)** 과 **4글자 풀(words4)** 로 분리 구성. **스테이지가 오를수록 4글자 비중이 선형 상승**(`getNextMonsterData(_, _, stage)` → `p4 = clamp((stage-4)/11, 0, 1)`): **s1~4=순수 3글자(온보딩) → s5~14 혼합 → s15+ 순수 4글자**. 실측 평균 타수는 3글자 ≈7.66타·4글자 ≈10.14타이고, `SPAWN_CURVE.avgWordKeystrokes`=**8.9(둘의 중간값 단일 고정)**. 스폰 주기를 8.9로만 계산하므로 **초반 3글자는 실제로 더 쉽고 후반 4글자는 더 빡세져** "초반 쉽고 후반 빡센" 곡선을 글자수로 얹는다(스테이지1=100타 기준은 "평균 단어" 기준으로 유지). 풀 구성을 바꾸면 3·4글자 평균을 다시 재서 중간값도 갱신해야 함. 별도 JSON/`fetch` 없이 배열 정적 관리. **한글 타자 중심 게임이라 영타 제시어는 두지 않는다.**
* **단어 모달팩 제거 및 제시어 다변화**: 선택형 프리셋 단어/닉네임 팩 모달을 삭제하고, 3·4글자 제시어 풀로 통합하여 복잡한 설정 없이 게임 본연의 타자 재미와 스테이지 진행형 난이도 밸런스를 전달.
* 라이브 채팅 제시어: 시청자가 길게 치면 최대 글자수(**4자 상한**, 일반 몬스터 최대치, `wordPacks.liveChatMaxLen`)로 **잘라서(truncate)** 사용. **띄어쓰기(공백)는 몇 칸인지 판정이 애매해 항상 전량 제거**하고, **한글(`가-힣`·자모)만 남기고 영문·숫자·이모티콘·특수문자를 전량 제거**(`liveChatStripSpecial=true` 고정) — 단어 중간 한/영 전환 억까를 막기 위함. (길이·정제 조정 UI는 §3대로 제거되어 값이 고정이다.)

### 6. 🛡️ 대형 방송 마비 방지 (Max Monster Cap)
* 화면 동시 출전 몬스터를 **`CONFIG.MAX_MONSTER_CAP`(기본 15)로 고정 제한**(하드 상한). MonsterManager가 밸런스 테이블의 `maxMonsterCap`과 `Math.min`으로 clamp.
* **스폰 스로틀(처치목표 초과 스폰 방지)**: 주기 스폰(`_spawnTick`)은 `(누적 처치수 + 화면상 일반몹) < 스테이지 킬 목표`일 때만 소환한다(`_reachedStageSpawnQuota` → `GameEngine.getStageKillTarget`). 목표를 카운트로만 보고 동시상한까지 계속 스폰하면, 목표 달성 순간 남은 몹이 `startStage()`의 `clear()`로 증발("마지막 몹이 저절로 잡히는" 현상)하므로, 필요한 만큼만 스폰해 둔다. 바닥 도달로 사라진 몹은 화면수에서 빠져 스폰이 자동 재개되어 소프트락은 없다.

### 7. 🎚️ 밸런스 테이블 (`CONFIG.DIFFICULTY`)
* 난이도 선택 UI가 없어 표준(`normal`) 밸런스 한 세트만 사용한다(`getDifficultyConfig()`가 반환):
  * `speedMult`(낙하속도 배율), `maxMonsterCap`(동시 상한, 15 고정), `killPerStageBase/Step`(스테이지 클리어 처치목표), `maxHp`(기지 체력), `damagePerLeak`(피격 데미지). **스폰 주기는 이 테이블이 아니라 `CONFIG.SPAWN_CURVE`에서 목표 요구 타자속도로 역산**.
* **요구 타자속도 곡선(실력 = 도달 스테이지)**: "몇 타를 쳐야 스테이지를 깨는가"는 스폰 주기가 결정하므로(`요구타수 ≈ 60000÷스폰주기 × 단어당타수`), **목표 타자속도(한컴 자소 기준)에서 스폰 주기를 역산**한다. 단어팩 획수 분포 + 현실적 플레이 모델(이산사건 시뮬)로 검증.
  * 스폰(`CONFIG.SPAWN_CURVE`): `requiredKpm = start100 + (stage-1)*step10.5`, `max800`(소프트 캡, ≈s68) 도달 후 `+afterMax3타/스테이지`로만 완만 상승(절대 평평해지지 않음 = 무오타 초고속 불멸 제거). 스폰 주기(ms) = `max(400, 60000*avgWordKeystrokes(8.9) ÷ requiredKpm)` — **3글자(≈7.66)·4글자(≈10.14) 평균의 중간값 8.9 단일 고정**이라 "평균 단어" 기준 요구 타수가 스테이지1=100타로 유지됨(스폰 주기 s1≈5340ms). → **s1=100타(초보 클리어) · s20≈300 · s40≈510 · s60≈720 · s68≈800타**.
  * 낙하 속도(반응 압박 보조축): `speed = (0.30 + (min(stage,60)-1)*0.05) * speedMult * (490/538)` — 16:9 전환으로 낙하 거리가 538px에서 490px로 짧아진 비율을 속도에 보정해 **stage1≈30초, stage60≈2.8초의 기존 반응 시간**을 유지. 요구 타수는 안 바꾸고 "실수 봐주는 버퍼"만 후반까지 좁힘.
  * 처치 수: `killPerStageBase 8·Step 0.5`(2스테이지당 +1) — 소프트 캡 이후 지구력 축.
* `MonsterManager`/`StateManager`/`game.js`가 `getDifficultyConfig()`로 공용 참조.

### 8. 💻 방송용 UI 및 모달/레이아웃 (1280×720, 16:9)
* **1280×720 고정 방송 프레임 + 전체 비율 스케일(scale-to-fit)**: 상단바(60px) + 게임 무대(`#game-stage.game-viewport`, **논리 크기 1280×660 고정**) = 1280×720. `.app-container` 전체를 `transform: scale(var(--app-scale))`로 확대·축소하며, `GameEngine.fitBroadcastFrame()`이 `min(innerWidth/1280, innerHeight/720)` 배율을 계산한다. 따라서 상단바·HUD·캔버스가 서로 어긋나지 않고 1280×720 및 1920×1080 OBS 소스를 정확히 채운다.
* **비표준 화면 안전 처리**: 16:9가 아닌 브라우저 창에서는 앱을 중앙 정렬하고 남는 영역만 레터박스로 처리한다. 콘텐츠를 자르거나 가로 스크롤을 만들지 않는다.
* **홈/게임오버 화면 분리**: `#screen-main`·`#screen-gameover`는 `.stage-frame` 직속으로 두어 상단바 아래 1280×660 영역을 항상 채운다.
* **홈 화면 가독성·세로 맞춤**: 홈 배경은 상단바 아래 `660px` 전체를 사용하고, 폭 `min(94%, 1000px)`의 홈 카드는 상단바와 위아래 12px 간격을 둔다. 상단바에 이미 게임명이 있으므로 홈 카드 내부의 중복 대형 제목·부제는 제거한다. 설명서와 방송 연동 패널을 첫 행의 2열로 바로 올리고 각 본문을 최대 175px 내부 스크롤로 제한해, 시작 버튼과 728×90 광고까지 화면 안에 모두 표시한다. 게임 설명서는 **기본 펼침** 상태다.
* **상단바(아이콘 + 축약 라벨 + 호버 툴팁)**: 각 컨트롤 버튼(`.qc-btn`)은 `아이콘(.qc-ic) + 짧은 한글 라벨(.qc-tx)`을 함께 표시해 기능을 즉시 알아볼 수 있게 한다. 논리 프레임이 1100px 미만으로 바뀌는 예외 상황에서만 라벨을 숨기고 `data-tip` 툴팁으로 대체한다.
* 모달 너비 `min(96%, 800px)`, 높이 `max-height: 520px`, `.modal-body` 독립 스크롤. 모달과 토스트도 논리 프레임 내부에 배치되어 앱과 같은 비율로 스케일된다.
* **OBS 권장값**: 브라우저 소스는 `1280×720` 또는 `1920×1080`으로 설정한다. 두 해상도 모두 16:9라 추가 자르기 없이 화면을 채운다.
* **버튼/광고 구역 분리**: `.modal-actions`(버튼, 위) + `.modal-footer`(광고, 아래) 분리.

### 9. 🎯 스마트 타깃 우선순위 & OBS 가시성
* **랜덤 단어 중복 회피**: 랜덤 제시어는 스폰 시 **화면에 이미 떠 있는 단어를 제외**하고 뽑아(`getNextMonsterData(_, excludeWords, stage)`) "제시어 하나 = 타깃 하나"를 유지한다(같은 단어 몬스터가 동시에 뜨는 복제성 혼란 방지). 단어 풀이 화면 상한보다 커서 대부분 회피 가능하며, 전부 겹치면 원본 풀로 폴백. **라이브 채팅 문구(`chatWord`)는 시청자 실제 메시지라 회피 대상에서 제외** — 도배로 같은 문구가 겹치면 친 만큼 등장한다.
* **바닥 우선 타깃팅**: 동일 제시어 다수 시(주로 라이브 채팅 도배) 기지에 가장 가까운(Y 최대) 몬스터 우선 처치(`checkHit`) → 친 횟수만큼 아래쪽부터 정리.
* **OBS 크로마키 가시성**: 텍스트 두꺼운 아웃라인(Stroke) + Drop Shadow. `body.obs-overlay` 클래스로 배경 투명화.

### 10. 👤 1인 솔로 모드 & 중앙 포탑
* 스트리머 닉네임 단일 입력(**필수**).
* 중앙 단일 포탑 회전각(θ)·레이저 빔·폭발 파티클·반동. **좌표는 `clientWidth/clientHeight`(1280×660 논리 픽셀) 기준**으로 계산.
* **포탑·방어선 하단 배치**: 포탑(`height−105`)과 방어선/지면(`groundY = height−130`).
* **HUD 위치**: `#game-hud`를 `top:0` 전체 폭 띠로 구성. 몬스터는 Y=40에서 생성되어 스르륵 떨어짐. 출전 대기열 패널(`top:80`) 우측끝(183px) 침범 방지를 위해 스폰 x 최소값을 `190 + 박스폭/2`로 고정.

### 11. ⚡ 방어 속도(타수 지표) & 콤보 & 피버 & 일시정지
* **방어 속도(WPM)**: IME 조합 완료 후 자소 단위 타수(`getKeystrokeCount`, 한컴 타자연습 2024.4 방식)를 전체 경과시간(분)으로 나눠 실시간 산출.
* **점수 연산**: 한글 자모 획수 기반(`getHangulStrokeCount`). **스테이지 배수는 반선형 `1 + (stage-1) × 0.5`** — 기존 선형(`× stage`) 대비 후반 점수 복리 폭주를 절반으로 완화. 일반 몬스터 점수는 `round(max(30, round(자모획수 × 6)) × (1 + (stage-1)×0.5))`, 보스 점수는 `round(500 × (1 + (stage-1)×0.5))`. (계수 0.5는 조정 가능.)
* **🔥 피버 버스트**: 콤보 누적으로 게이지(100) 도달 시 발동 — 화면의 일반 몬스터를 모두 클리어(`clearNonBoss`), 정리분 점수 합 + 500 보너스 점수(`addFeverBonus`), 기지 체력 10% 회복(`healBase`).
  * **발동 연출(`playFeverOverlay`)**: 코너 토스트만으로는 눈에 안 띄어, 게임 화면 한복판에서 크게 터지는 오버레이(`#fever-overlay`)를 띄운다 — 주황~붉은 방사형 **불빛 플래시**(`feverFlash`) + 대형 **"🔥 FEVER TIME 🔥" 텍스트**(`feverTextPop`, 제자리 scale 팝). **멀미 방지를 위해 화면 흔들림은 없음.** 두 애니메이션 모두 마지막 키프레임이 opacity 0이라 `animation-fill-mode: forwards`로 종료 상태를 고정한다 — 기본값(`none`)이면 애니메이션 종료(≈1.2s)와 오버레이 숨김(1.3s) 사이 꼬리 구간에 요소가 기본 opacity 1로 되돌아가 **"두 번째로" 다시 번쩍이던 문제**를 방지. (보스 공격 오버레이 `#boss-attack-overlay`도 동일 조치.)
  * **보스 스테이지 게이지 동결**: 5의 배수 스테이지에서는 게이지 충전/감소가 스킵되고 `fever-locked` 클래스(회색+🔒) 적용.
* **⏸ 일시정지 (`GameEngine.togglePause`)**: **ESC 키** 또는 **마우스(HUD `#btn-pause` / 오버레이 `#btn-pause-resume`)** 로 정지/재개. 정지 중 몬스터 이동·스폰·입력 멈춤. **재개 시 곧바로 시작하지 않고 `RESUME_GRACE_MS`(5초) 그레이스 카운트다운(`#start-countdown`)을 띄운 뒤** 실제 재개(`MonsterManager.resumeSpawns()` 호출)한다. 그레이스 동안에도 게임은 정지 상태(`isPaused=true`)를 유지하며, 카운트다운 도중 다시 정지하면 카운트다운을 취소하고 정지 오버레이로 복귀한다. 정지+그레이스로 흐른 시간은 `startTime`에 합산해 WPM 계산에서 제외. **재개 시 스폰 인터벌 위상도 리셋**한다(`resumeSpawns`가 `setInterval` 재생성): 인터벌은 정지 중에도 실시간으로 계속 돌아(틱만 스킵) 재개 순간 '남은 짜투리'만큼 다음 스폰이 앞당겨지는데, 이를 없애 **첫 스폰이 재개 후 온전히 한 주기 뒤**에 나오게 한다(그레이스가 준 여유를 스폰이 잡아먹지 않도록).

### 12. ♾️ 무한 Stage & 5 Stage 단위 보스전
* **5 Stage마다 보스전**: 스테이지 전환 그레이스(3초) 시작과 동시에 WARNING 배너를 띄워 빈 화면 구간을 없애고, 배너가 사라진 직후 보스를 소환한다(`onBossWarning(stage, durationMs)` → `showBanner(..., durationMs)`). 보스전 중에는 일반 몬스터를 스폰하지 않는다.
* **보스 제시어 팩(`bossWords`, 5~6글자)**: 팩 난도 구분 없이 **모든 팩이 하나의 5~6글자 보스 세트를 공유**(일반 몬스터 3~4글자보다 길게). `_pickBossWord(stage)`가 시스템 붕괴 테마 문구를 출제하며, 후반 스테이지일수록 획수 상위(=긴 6글자) 문구로 좁힌다(`_bossPool`). 보스 차지 시간(`_bossChargeMs`)은 단어 타수에서 자동 역산.
* **⚡ 차지 보스**: 고정 위치(`y:260`, `speed:0`)에서 차지 게이지를 채움.
  * 체력: `requiredHits = min(5, 2 + floor(stage/30))`
  * 차지시간(`_bossChargeMs(word, stage)`, `CONFIG.BOSS`): **'클리어'가 아니라 '한 대도 안 맞는(무피격)' 요구 속도 기준**. 정타 시 게이지가 절반만 밀리고(`chargeElapsed −= chargeTime×0.5`) `requiredHits`(N)회를 연속으로 막아야 하므로 게이지가 누적된다. 무피격 조건 `W < C×(N+1)/(2N)`를 뒤집어, **무피격 속도 = 1.15×requiredKpm(stage-1)** 이 되게 차지시간 `C = (60000·그단어타수 ÷ (1.15·requiredKpm(stage-1))) × 2N/(N+1)`, 하한 `minChargeSec 1.5s`. **출제된 단어의 실제 타수로 역산**하므로 5·6글자 편차가 있어도 무피격 요구 속도가 모든 보스 단어에서 동일(옛 풀평균 방식은 99~250타로 널뛰었음). 리롤 시 새 단어 기준으로 재계산하고 게이지는 비율로 이월. **기준을 stage-1로 두는 이유**: 보스 스테이지엔 일반 몹 구간이 없어 플레이어가 실제 겪은 마지막 속도가 직전 스테이지이기 때문(첫 보스 진입 갭 완화). 보스5 = 1.15×131.5 ≈ **151타를 내면 무피격 = 스테이지4 대비 +15%**.
  * 공격력: `attackDamage = 10 + bossIndex * 2`(무한↑ — 후반 치명성).
  * 정타 시: 게이지 절반 밀어내기(`chargeElapsed -= chargeTime * 0.5`) + 제시어 리롤.
  * 명중 공격 발동 시: 정액 피해 + 다음 차지시간 1.5배~2배 연장 (`chargeAttackCount`).
  * **공격 발동 연출(`playBossAttackOverlay`)**: 게이지가 다 차 기지가 피격당하면 화면 전체 오버레이(`#boss-attack-overlay`)로 확실히 알린다 — 가장자리에서 안쪽으로 번지는 **붉은 위험 비네트**(`bossAttackFlash`) + 중앙 **피해량 텍스트**(`💥 기지 -N`, `bossAttackTextPop`). 피버(주황·중앙→바깥)와 색·방향을 반대로 잡아 **보상 vs 피격**을 즉시 구분. 흔들림 없음. (기존 코너 토스트는 제거.)
  * 처치 보상: 보스 완전 처치 시 기지 체력 25% 회복(`healBase(maxHp * 0.25)`).
  * 렌더링: 보스 머리 위에 **HP 하트(`HP ♥♥`)** 및 **차지 바(`CHARGE`)** 표시.

### 13. 👑 등급 뱃지(SSS~D) & 명예의 전당 & MVP
* **도달 스테이지 기준 등급**: `SSS ≥ 53 · SS ≥ 39 · S ≥ 30 · A ≥ 20 · B ≥ 11 · C ≥ 1 · D=미플레이` (0점/0처치 시 D). 임계는 SPAWN_CURVE 요구 타자속도(200·300·400·500·650타 구간)에 정렬하되 **각 등급을 한 칸씩 후하게** 부여(같은 스테이지가 종전보다 한 등급 위 — s29=A).
* **🌐 상위 %(글로벌 백분위)**: `fetchPercentile`로 내 점수의 백분위 + **정확 등수(`rank` = 나보다 높은 점수 수 + 1)** 산출 (`PERCENTILE_SCAN_CAP` 2000, `MIN_SAMPLE` 50).
* **명예의 전당**: 최고 도달 스테이지 내림차순(동점 시 점수순). 로컬 `localStorage`(`wtd_leaderboard_top5`) 기본 + Firebase Firestore(`leaderboard`). 모달 진입 시 `loadLeaderboard`가 상위 200을 **1회만** 로드해 캐시하고, 이후 TOP5·전체·검색은 캐시에서 클라이언트 측으로 처리(추가 조회 없음). 3가지 뷰(`leaderboardView`):
  * **📜 전체 순위 보기**(`#btn-leaderboard-all`): TOP 5 ↔ 전체(최대 200위) 토글. 순위 번호는 필터와 무관하게 전체 정렬상의 실제 등수를 유지.
  * **🙋 내 순위 보기**(`#btn-leaderboard-me`): 전체 랭킹과 분리된 내 등수 전용 뷰. 로컬 최고 기록(`getMyBestRecord` — 내 닉네임 우선)을 카드로 보여주고, 글로벌 연동 시 점수 기준 정확 등수(`#N위 / 총 M명 · 상위 X%`)를 붙임. 같은 점수는 세션 캐시(`_myRankCache`)로 재조회 방지, 늦은 응답은 토큰으로 무시. 본인 식별은 `getMyNickname`(홈 입력값 우선, 없으면 `config.playerNames[0]`, 기본값 `'스트리머'`는 미설정 처리).
  * **🔎 닉네임 검색**(`#leaderboard-search`): 부분일치 필터. 검색어 입력 시 상위 5개에 갇히지 않도록 전체 뷰로 자동 확장(캐시라 재조회 없음), 뷰 버튼 클릭 시 검색어 초기화.
* **🏅 이번 판 MVP**: 실참여 시청자의 몬스터 스폰 시점 등장 카운트(`trackMvpAppearance`) 누적, 결과 화면 배너 표시.

### 14. 🌐 Firebase 글로벌 리더보드 & Analytics
* **Firestore**: `leaderboard` 컬렉션 저장/조회. 보안 규칙으로 `stage` 범위 및 타입 검증.
* **건의사항(`suggestions`)**: 모달에서 내용(1~500자) 및 닉네임 제출, 읽기 비공개 보안 규칙 적용.
* **Analytics(GA4)**: `logEvent('game_start')`, `logEvent('game_over')`, `logEvent('chat_platform_connected')` 이벤트 수집.

### 15. 💰 수익화 광고 & 후원
* 카카오 애드핏 728x90 **5개 슬롯**(메인/결과/명예의전당/후원/건의사항). `refreshAdfitSlot()` 동적 리프레시.
* 카카오뱅크 계좌복사(`3333-28-2684443`) 및 QR(`donation-qr.png`) 후원 모달.

### 16. ✨ UX 연출 & 스타필드 배경
* **토스트 알림 (`window.showToast`)**: 연동 상태, 신기록, 팩 적용, 피버 버스트 등 알림. **컨테이너(`#toast-container`)는 화면 좌측 상단(스테이지 카드 아래)에 배치** — 우측 상단의 일시정지 버튼(`#btn-pause`)과 겹치지 않게 좌측으로 뒀고, 슬라이드 인도 좌측에서 등장한다.
* **피버/보스 공격 화면 오버레이 (`js/ui/fx.js`)**: `playFeverOverlay`(주황 불빛 플래시 + "🔥 FEVER TIME" 대형 텍스트) / `playBossAttackOverlay(damage)`(가장자리 붉은 위험 비네트 + "💥 기지 -N" 피해 텍스트). 둘 다 화면 한복판 연출이지만 **멀미 방지를 위해 흔들림은 넣지 않음**. `#fever-overlay`(z:158) / `#boss-attack-overlay`(z:157).
* **배경 파티클 스타필드 (`#bg-canvas`)**: 90개 영롱한 드리프트 파티클 렌더링.

---

## 📂 프로젝트 파일 구조 및 역할

1. **`index.html`**
   * 메인 화면(스트리머 닉네임 입력 + 홈 인라인 방송 채팅 연동 패널), 3개 모달(명예의전당/후원/건의사항), 상단 컨트롤바 6개 버튼.
   * 카카오 애드핏 5개 슬롯, Firebase SDK(app/firestore/analytics compat) 로드, 전용 JS 모듈 스크립트 로드.

2. **`style.css`**
   * 1280×720 방송용 16:9 고정 프레임, 앱 전체 비율 스케일, 모달 잘림 방지, `.modal-actions`/`.modal-footer` 분리, `body.obs-overlay` 투명 스타일, 토스트/등급뱃지/단어칩/피버 등 컴포넌트 스타일.

3. **`js/config.js`**
   * `CONFIG.YOUTUBE_API_KEY`, `CONFIG.SOOP_PROXY`/`CONFIG.CHZZK_PROXY`/`CONFIG.SOOP_DEBUG`, `CONFIG.FIREBASE`, `CONFIG.KAKAO_ADFIT`(6개), `CONFIG.DIFFICULTY`(밸런스 테이블) + `getDifficultyConfig()`, `CONFIG.MAX_MONSTER_CAP`(15), `CONFIG.START_SPAWN_DELAY_MS`(5000)/`STAGE_UP_SPAWN_DELAY_MS`(3000)/`RESUME_GRACE_MS`(5000), `CONFIG.QUEUE` 튜닝값, 광고 리프레시 로직.

4. **`js/wordPacks.js`**
   * 제시어 풀(기본 3·4글자 `words3`/`words4` 스테이지별 비율 + 보스 `bossWords` 5~6글자), 시청자 대기열(`{nickname, chatWord}`) 관리, `!참여` 처리·참가자 명단, 봇 자동 보충, 라이브 채팅 정제(`sanitizeLiveChatWord`), 비속어 필터(13종), 한글 자모 획수(`getHangulStrokeCount`) 및 자소 타수(`getKeystrokeCount`) 유틸.

5. **`js/audio.js`**
   * Web Audio API 효과음 5종(레이저/폭발/피버/오타/팡파르) + Mute.

6. **`js/chatIntegration.js`**
   * `ChatIntegrationEngine`: 플랫폼별 URL 파서, SOOP/치지직/유튜브 다중 연동, SOOP·치지직 채팅 프로토콜 클라이언트(`CONFIG.SOOP_PROXY`/`CONFIG.CHZZK_PROXY` 경유), Smart Fallback 토스트, `handleIncomingChat` → `wordPacks.processChatMessage` 전달.

7. **`js/globalLeaderboard.js`**
   * Firebase 초기화, Firestore 점수 제출/스테이지 기준 조회(`submitScore`/`fetchTop`), 백분위 조회(`fetchPercentile`), 건의사항 저장(`submitSuggestion`), Analytics `logEvent`. 상단 주석에 Firestore 보안 규칙 포함.

8. **`js/core/StateManager.js`**
   * 상태 머신, 무한 Stage/HP/점수/콤보/WPM/피버 관리, 체력·데미지·회복 적용, 등급 환산(SSS~D), 최고 도달 스테이지 기준 단일 로컬 TOP 5 저장/조회.

9. **`js/core/TurretManager.js`**
   * 중앙 포탑 좌표(논리 픽셀 기준 1280×660)·회전각·사격·반동.

10. **`js/core/MonsterManager.js`**
    * 스폰/속도/상한(15), 대기열 소비, 5 Stage 보스전(차지 보스, HP 하트, 차지 게이지, 명중 리롤), 탭 백그라운드 스폰 정지.

11. **`js/core/InputManager.js`**
    * 단일 타자 입력, 한글 IME 조합 감지(compositionstart/compositionend) 및 Enter 중복 방지.

12. **`js/renderers/CanvasRenderer.js`**
    * **논리 좌표계 1280×660 고정** Draw. 백버퍼 `displayW/displayH` × DPR 매핑. 2단 몬스터 UI(보스 금색·확대 / 라이브 채팅 보라색), 보스 HP(`HP ♥♥`) 및 차지바(`CHARGE`), OBS 가시성 Stroke·Shadow, 이펙트.

13. **`js/game.js`**
    * 게임 루프 오케스트레이터 (`GameEngine` **클래스 정의**). 게임 흐름·상태 전용: `init`, `fitBroadcastFrame()` 앱 전체 스케일, `bindUIEvents`(핵심 버튼 배선), 시작/재시작/메인복귀, 타자 제출 판정, 스테이지 진행, 피버 버스트, 보스 공격/처치, 일시정지(ESC/버튼), 시작 카운트다운, 메인 루프(update/render), MVP 집계.
    * UI 배선/렌더링은 아래 `js/ui/*`가 **`GameEngine.prototype`에 부착**(부분 클래스)해 game.js를 게임 로직에 집중시킨다.

14. **`js/ui/*.js`** (GameEngine 부분 클래스 — game.js 뒤·main.js 앞에 로드)
    * **`fx.js`**: 토스트 알림(`showToastInternal`, 전역 `window.showToast`) + 배경 스타필드(90개).
    * **`chatPanel.js`**: 방송 채팅 연동 모달·참여자 명단·출전 대기열 패널 렌더링.
    * **`modals.js`**: 명예의전당(`renderLeaderboard` async)·후원·건의사항 모달 + 공용 유틸(`escapeHtml`/`copyToClipboard`).
    * **`quickControls.js`**: 상단바 잠금(`updateTopBarLock`) + 라이브 채팅/OBS/사운드 토글 + 라벨/포커스 헬퍼(`_setQcLabel`/`_blurQuickControl`).

15. **`js/main.js`**
    * 부트스트랩 엔트리. 모든 스크립트 로드 후 `new GameEngine()` 인스턴스화 + DOM 준비 시 `init()` 호출(로드 순서 의존성 제거).

16. **`proxy/soop-cors-proxy.worker.js`**
    * SOOP·치지직 연동용 무료 Cloudflare Worker CORS 프록시.

17. **`docs/SOOP_연동_설정.md`**
    * SOOP 프록시(Cloudflare Worker) 배포·설정 가이드 및 디버깅 안내.

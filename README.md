# 🎮 스트리머 워드 타자 디펜스 (Word Typing Defense)

SOOP · 치지직 · 유튜브 라이브 **1인 솔로 스트리머**에 최적화된 **네온 사이버펑크 스타일 타자 방어(산성비) 웹 게임**입니다.
시청자가 채팅으로 `!참여`하면 그 닉네임이 몬스터로 등장하고, 스트리머가 아래 제시어를 타이핑해서 방어합니다.

> **웹 배포 주소**: [https://golddragon0207.github.io/word-typing-defense/](https://golddragon0207.github.io/word-typing-defense/)
> PC 전용(최소 1024×768). 브라우저로 접속 후 바로 플레이하거나 OBS 브라우저 소스로 얹어서 방송할 수 있습니다.

---

## 🎯 주요 기능

### 1. 🏷️ 2단 몬스터 UI (시청자 닉네임 + 제시어)
- **상단 뱃지**: 실제 참여 시청자 닉네임(`🔵SOOP`, `🟢치지직`, `🔴유튜브` 접두사) 또는 `[BOT]` 표식.
- **하단 제시어 상자**: 실제로 타이핑할 제시어. **글자 길이에 맞춰 박스가 자동으로 늘어나** 긴 단어도 깔끔하게 표시됩니다.
- 보스는 금색·확대, 라이브 채팅 문구 몬스터는 보라색으로 구분됩니다.

### 2. 📡 실시간 방송 채팅 연동 (SOOP · 치지직 · 유튜브 동시)
- 방송 주소를 붙여넣으면 채널 ID를 자동 파싱해 연동합니다. **세 플랫폼 동시 연동** 지원. (연동 모달 기본 탭은 **SOOP**)
- 시청자가 채팅에 **`!참여`**를 치면 그 닉네임이 몬스터로 출전합니다.
- **SOOP 연동은 CORS 우회용 프록시가 필요**합니다. 무료 Cloudflare Worker([`proxy/soop-cors-proxy.worker.js`](./proxy/soop-cors-proxy.worker.js))를 **개발자가 한 번만 배포**해 `CONFIG.SOOP_PROXY`에 넣어두면, 이후 **스트리머는 방송 URL만 붙여넣으면 자동 연동**됩니다(프록시 조작 불필요). 설정법: [`docs/SOOP_연동_설정.md`](./docs/SOOP_연동_설정.md).
- 연동 실패·방송 오프라인·프록시 미설정 시 **`[BOT]` 가상 시청자 자동 소환**으로 끊김 없이 진행(Smart Fallback).
- 실참여자가 적으면 목표 인원까지 봇으로 자동 보충하고, 비속어는 자동 필터링됩니다.
- **참여자 목록**: 채팅 모달에서 `!참여`한 시청자를 실시간 목록으로 확인.
- **스트리머 닉네임 자동 입력**: SOOP 연동 성공 시 방송 BJ 닉네임으로 스트리머 닉네임 칸을 자동 설정합니다(직접 입력한 값이 있으면 그대로 유지). *현재 SOOP만 지원.*
- **공정성 장치**: 대기열은 30명 버퍼 + **1인당 최대 2자리**로 제한해, 한 명이 도배해도 여러 시청자가 골고루 등장합니다.
- **게임 중 대기열 패널**: 좌상단에 다음 소환 순서를 실시간 표시(실참여자는 밝게, 봇은 흐리게).

### 3. 💬 라이브 채팅 모드 & 🔥 다음 자리 쟁탈전 (신규)
- 상단 **`💬 라이브 채팅 모드`** 버튼을 켜면 **`!참여`한 시청자의 채팅 문구**가 그대로 타이핑 제시어가 됩니다(게임 중에도 즉시 ON/OFF).
- **다음 자리 경쟁**: 시청자들이 채팅으로 **"다음 몬스터 자리"를 두고 경쟁**합니다. 나중에 친 채팅이 앞 채팅을 덮어쓰고(마지막이 승자), 몬스터가 소환되는 순간 그 승자의 닉네임+문구로 확정 등장합니다. 좌상단 패널에 `🔥` 현재 경쟁 후보가 실시간 표시됩니다.
- 이모티콘·특수문자 제거, 비속어 필터, 최대 글자수 컷(모달에서 설정) 후 안전하게 사용하며, 라이브 문구 몬스터는 **보라색**으로 강조됩니다.

### 4. 🎚️ 4단계 난이도 밸런스 (쉬움 / 보통 / 어려움 / 헬)
- 난이도별로 낙하 속도, 스폰 주기, 기지 체력, 피격 데미지, 스테이지 처치목표가 차등 적용됩니다.
- 스테이지가 오를수록 낙하 속도가 점점 빨라집니다.
- 동시 출전 몬스터는 방송 마비 방지를 위해 난이도와 무관하게 **최대 15마리로 고정**됩니다.

### 5. ⌨️ 한글 자모 획수 기반 CPM/WPM & 콤보 & 🔥 피버 모드
- 초/중/종성 획수를 정밀 분해해 실시간 타수(CPM/WPM)를 산출합니다.
- 콤보가 쌓여 게이지가 차면 **6초간 점수 2배** 피버 모드가 발동합니다.

### 6. ♾️ 무한 스테이지 & 5 스테이지 보스전
- 종료 엔딩 없이 패배할 때까지 무한 진행. **5 스테이지마다 WARNING 배너와 함께 보스**가 등장합니다.

### 7. 👑 등급(SSS~D) & 난이도별 명예의 전당
- 점수 기반 등급 부여(0점/0처치 시 D). 신기록 시 `🎉 NEW RECORD!` 연출.
- **🏅 이번 판 MVP**: 게임오버 결과 화면에 몬스터를 가장 많이 낸 실참여 시청자를 MVP로 표시. **집계 기준은 "등장(참여)"** 라 스트리머가 그 몬스터를 못 죽여도 카운트됩니다(봇만 있었던 판은 표시 안 함).
- **명예의 전당은 난이도별 TOP 5**로 분리 표시됩니다.
  - **로컬**: 브라우저 `localStorage`에 난이도별 저장(기본).
  - **글로벌**: Firebase Firestore 연동 시 전 스트리머 공유 글로벌 리더보드(미설정 시 로컬 폴백).

### 8. 🖥️ Canvas 4K / HiDPI 선명도 & OBS 크로마키
- `devicePixelRatio` 렌더링으로 고배율 디스플레이에서도 선명하게 출력. 중앙 포탑 좌표도 논리 픽셀 기준이라 4K/Retina에서 정위치.
- 상단 **`📺 OBS 크로마키`** 버튼으로 배경 투명화 → 캠/방송 화면 위 오버레이로 사용.
- 텍스트는 두꺼운 아웃라인 + 그림자로 크로마키 배경에서도 잘 보입니다.

### 9. 📝 단어팩
- 프리셋 팩(믹스/밈/하드코어/맞춤법/영문) 선택 + 어떤 단어가 들어있는지 미리보기.
- 몬스터 제시어 박스는 글자 길이에 맞춰 자동으로 늘어나 긴 단어도 깔끔하게 표시됩니다.

### 10. 💰 수익화 광고 & ☕ 후원
- 카카오 애드핏 `728×90` 배너 6개 슬롯(메인/결과/각 모달). 모달 오픈 시 동적 리프레시.
- 상단 `☕ 후원` → 카카오뱅크(`3333-28-2684443`) 계좌복사 & QR(`donation-qr.png`)를 **가로로 나란히** 배치한 후원 모달(가입 0단계).

### 11. 📊 (선택) Firebase 애널리틱스
- Firebase 연동 시 게임 시작/종료, 난이도 선택, 방송 플랫폼 연동 등 이벤트를 GA4로 수집(개인식별정보 미전송). 미설정 시 자동 비활성.

---

## 📁 파일 구조

- [`index.html`](./index.html) : 메인 화면, 4개 모달(채팅/단어팩/명예의전당/후원), 상단 컨트롤바 7개, 광고 슬롯, Firebase SDK 로드
- [`style.css`](./style.css) : 사이버펑크 네온 CSS, 1024×768 고정 레이아웃, 모달/토스트/등급뱃지/난이도탭 스타일, OBS 투명 오버레이
- [`js/config.js`](./js/config.js) : 유튜브 API 키, Firebase 설정, 카카오 애드핏 ID, **난이도 밸런스 테이블(`CONFIG.DIFFICULTY`)**
- [`js/wordPacks.js`](./js/wordPacks.js) : 단어팩(프리셋/보스), 시청자 대기열·참가자 명단, `!참여` 처리·봇 보충, 라이브 채팅 경쟁/정제, 한글 자모 획수 유틸
- [`js/audio.js`](./js/audio.js) : Web Audio API 효과음 5종(레이저/폭발/피버/오타/팡파르)
- [`js/chatIntegration.js`](./js/chatIntegration.js) : 치지직/SOOP/유튜브 URL 파서 및 다중 실시간 연동. **SOOP 채팅 프로토콜 클라이언트**(입장 핸드셰이크·패킷 파싱, `CONFIG.SOOP_PROXY` 경유)
- [`js/globalLeaderboard.js`](./js/globalLeaderboard.js) : Firebase Firestore 글로벌 리더보드 + Analytics 연동(선택형)
- [`js/core/StateManager.js`](./js/core/StateManager.js) : 상태 머신, 점수/HP/콤보/CPM·WPM/피버, 난이도별 로컬 TOP5
- [`js/core/TurretManager.js`](./js/core/TurretManager.js) : 중앙 포탑 좌표·회전각·사격·반동
- [`js/core/MonsterManager.js`](./js/core/MonsterManager.js) : 난이도별 스폰/속도/상한, 보스전, 낙하 관리
- [`js/core/InputManager.js`](./js/core/InputManager.js) : 타자 입력, 한글 IME 조합 감지, 바닥 우선 타깃팅
- [`js/renderers/CanvasRenderer.js`](./js/renderers/CanvasRenderer.js) : 고해상도 Draw, 2단 몬스터 UI(동적 박스폭), 이펙트
- [`js/game.js`](./js/game.js) : 메인 루프 오케스트레이터, 전 UI 배선, 스테이지 진행, 연출
- [`proxy/soop-cors-proxy.worker.js`](./proxy/soop-cors-proxy.worker.js) : SOOP 연동용 무료 Cloudflare Worker CORS 프록시(개발자 1회 배포)
- [`docs/SOOP_연동_설정.md`](./docs/SOOP_연동_설정.md) : SOOP 프록시 배포·설정 단계별 가이드 + 라이브 문제 해결
- [`implementation_plan.md`](./implementation_plan.md) : 상세 기술 구현 계획서

---

## ⚙️ 배포 전 설정 (선택)

정적 호스팅(GitHub Pages)이라 아래 값은 **비워두면 해당 기능만 자동으로 꺼지고 나머지는 정상 동작**합니다.

- **SOOP 라이브 연동**: `js/config.js`의 `SOOP_PROXY`에 배포한 Cloudflare Worker 주소(`.../?url=`) 입력. 비우면 SOOP은 BOT 시뮬레이션으로 폴백. 배포·설정 전체 절차는 [`docs/SOOP_연동_설정.md`](./docs/SOOP_연동_설정.md) 참고. (프로토콜이 비공식이라 실제 방송에서 `SOOP_DEBUG` 로그로 최종 검증 권장)
- **유튜브 라이브 연동**: `js/config.js`의 `YOUTUBE_API_KEY`에 YouTube Data API v3 키 입력. (키에 HTTP 리퍼러 제한을 걸면 배포 도메인에서만 동작하며 로컬에서는 막힘)
- **글로벌 명예의 전당 / 애널리틱스**: `js/config.js`의 `CONFIG.FIREBASE`에 Firebase 웹 앱 설정 입력 + Firestore 보안 규칙 게시(규칙은 `js/globalLeaderboard.js` 상단 주석 참고).

---

## 🌐 접속 주소

- **웹 게임**: [https://golddragon0207.github.io/word-typing-defense/](https://golddragon0207.github.io/word-typing-defense/)
- **레포지토리**: [https://github.com/golddragon0207/word-typing-defense](https://github.com/golddragon0207/word-typing-defense)

> **💡 스트리머 팁**
> - 위 주소를 브라우저로 접속하면 바로 플레이할 수 있습니다.
> - OBS 브라우저 소스에 위 주소를 넣고 게임 내 `📺 OBS 크로마키` 버튼을 켜면 배경이 투명하게 합성됩니다.
> - 유튜브 실시간 채팅 연동은 실제 배포된 주소 + 진짜 라이브 방송 중인 영상에서만 동작합니다(로컬 `file://` 테스트에서는 API 키 리퍼러 제한으로 막힙니다).

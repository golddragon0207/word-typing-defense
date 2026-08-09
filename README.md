# 🎮 스트리머 워드 타자 디펜스 (Word Typing Defense)

SOOP · 치지직 · 유튜브 라이브 **1인 솔로 스트리머**를 위한 **네온 사이버펑크 타자 방어(산성비) 웹 게임**입니다.
시청자가 채팅으로 `!참여`하면 그 닉네임이 몬스터로 내려오고, 스트리머가 제시어를 타이핑해서 방어합니다.

> **플레이/방송 주소**: [https://golddragon0207.github.io/word-typing-defense/](https://golddragon0207.github.io/word-typing-defense/)
> PC 전용(최소 1024×768). 브라우저로 바로 플레이하거나 OBS 브라우저 소스로 얹어 방송할 수 있습니다.

---

## ▶️ 빠른 시작

1. 위 주소를 브라우저로 엽니다.
2. **스트리머 닉네임**을 입력합니다(필수).
3. (선택) 방송 URL을 붙여넣어 실시간 채팅을 연동합니다.
4. `게임 시작` → 5초 뒤 첫 몬스터가 내려옵니다. 제시어를 타이핑해 막으면 됩니다.

> **방송 팁**: OBS 브라우저 소스에 주소를 넣고 게임 내 `📺 OBS 크로마키`를 켜면 배경이 투명하게 합성됩니다.

---

## 🎯 주요 기능

- **🏷️ 2단 몬스터 UI** — 상단 뱃지에 시청자 닉네임(`🔵SOOP`·`🟢치지직`·`🔴유튜브`) 또는 `[BOT]`, 하단 상자에 타이핑할 제시어. 보스는 금색·확대, 라이브 채팅 문구는 보라색으로 구분됩니다.
- **📡 실시간 채팅 연동 (3사 동시)** — 방송 URL만 붙여넣으면 채널을 자동 파싱해 SOOP·치지직·유튜브를 동시에 연동. 시청자가 `!참여`를 치면 그 닉네임이 몬스터로 출전합니다. 연동이 안 되거나 방송이 꺼져 있으면 `[BOT]`이 자동으로 채워 끊김 없이 진행됩니다(Smart Fallback).
- **💬 라이브 채팅 모드** — 켜면 `!참여`한 시청자의 채팅 문구가 그대로 타이핑 제시어가 됩니다(게임 중에도 즉시 ON/OFF). 이모티콘·특수문자·비속어를 걸러 안전하게 사용합니다.
- **⌨️ 한글 자모 획수 기반 타수 & 점수** — 초/중/종성 획수를 정밀 분해해 CPM/WPM을 산출하고, 어려운(획수 많은) 단어일수록 높은 점수를 줍니다.
- **🔥 피버 모드** — 콤보가 쌓여 게이지가 차면 화면의 일반 몬스터를 한 번에 정리하고 보너스 점수 + 기지 체력을 회복합니다.
- **♾️ 무한 스테이지 & 보스전** — 패배할 때까지 무한 진행하며, 5스테이지마다 **차지(기 모으기) 보스**가 등장합니다. 게이지가 차기 전에 정타로 격파하는 방식이라 실력과 무관하게 클리어는 보장되되, 느릴수록 데미지를 더 맞습니다.
- **👑 등급 & 명예의 전당** — 최고 도달 스테이지 기준 등급(SSS~D)과 TOP 5 리더보드(로컬 기본, Firebase 연동 시 글로벌). 이번 판 MVP 시청자와 글로벌 상위 %도 표시합니다.
- **🖥️ PC 고정 레이아웃 + OBS 크로마키** — 1024×768 기준으로 비율을 유지하며 스케일되어 창 크기·해상도가 달라도 게임이 깨지지 않습니다. `📺 OBS 크로마키`로 배경 투명화, 방송 중 실수 클릭 방지를 위한 버튼 잠금도 있습니다.
- **⏸ 일시정지** — ESC 또는 화면 버튼으로 잠깐 멈췄다 이어서 플레이(멈춘 시간은 타수 계산에서 제외).
- **💰 수익화 & 후원** — 카카오 애드핏 배너 슬롯과 카카오뱅크 계좌·QR 후원 모달.

> 낙하 속도·스폰 주기·점수·보스 스케일링 등 세부 수치와 내부 동작은 [`implementation_plan.md`](./implementation_plan.md)를 참고하세요.

---

## 📁 파일 구조

- [`index.html`](./index.html) : 메인 화면·모달 4개·상단 컨트롤바·광고 슬롯·Firebase SDK 로드
- [`style.css`](./style.css) : 사이버펑크 네온 스타일, 1024×768 고정 레이아웃 + 비율 스케일, OBS 투명 오버레이
- [`js/config.js`](./js/config.js) : API 키·Firebase·애드핏 설정, 밸런스 테이블(`CONFIG.DIFFICULTY`), 큐/봇 튜닝
- [`js/wordPacks.js`](./js/wordPacks.js) : 단어팩(프리셋/보스), 시청자 대기열·참가자 명단, `!참여`·봇 보충, 라이브 채팅 정제
- [`js/audio.js`](./js/audio.js) : Web Audio API 효과음
- [`js/chatIntegration.js`](./js/chatIntegration.js) : SOOP·치지직·유튜브 URL 파서 및 실시간 채팅 클라이언트
- [`js/globalLeaderboard.js`](./js/globalLeaderboard.js) : Firebase 글로벌 리더보드 + 건의사항 + Analytics (선택형)
- [`js/core/`](./js/core/) : `StateManager`(상태·점수·피버) · `TurretManager`(포탑) · `MonsterManager`(스폰·보스·낙하) · `InputManager`(타자·IME)
- [`js/renderers/CanvasRenderer.js`](./js/renderers/CanvasRenderer.js) : 고해상도 Draw, 2단 몬스터 UI, 이펙트
- [`js/game.js`](./js/game.js) : 메인 루프 오케스트레이터, 전 UI 배선, 스테이지 진행, 연출
- [`proxy/soop-cors-proxy.worker.js`](./proxy/soop-cors-proxy.worker.js) : SOOP·치지직 연동용 Cloudflare Worker CORS 프록시(개발자 1회 배포)
- [`docs/SOOP_연동_설정.md`](./docs/SOOP_연동_설정.md) : 프록시 배포·설정 가이드
- [`implementation_plan.md`](./implementation_plan.md) : 상세 기술 구현 계획서

---

## ⚙️ 배포 전 설정 (선택)

정적 호스팅(GitHub Pages)이라 아래 값은 **비워두면 해당 기능만 자동으로 꺼지고 나머지는 정상 동작**합니다.

- **SOOP·치지직 라이브 연동**: Cloudflare Worker 프록시를 한 번 배포해 `CONFIG.SOOP_PROXY`/`CONFIG.CHZZK_PROXY`(같은 주소)에 입력. 미설정 시 BOT 폴백. 전체 절차: [`docs/SOOP_연동_설정.md`](./docs/SOOP_연동_설정.md).
- **유튜브 라이브 연동**: `CONFIG.YOUTUBE_API_KEY`에 YouTube Data API v3 키 입력. ⚠️ 공개 레포라 키가 노출되므로 **구글 클라우드 콘솔에서 HTTP 리퍼러 제한(배포 도메인만 허용)을 반드시 걸어** 도용을 막으세요.
- **글로벌 명예의 전당 / 애널리틱스 / 건의사항**: `CONFIG.FIREBASE`에 Firebase 웹 앱 설정 입력 + Firestore 보안 규칙 게시(규칙 원문은 [`js/globalLeaderboard.js`](./js/globalLeaderboard.js) 상단 주석 참고).

---

## 🌐 링크

- **웹 게임**: [https://golddragon0207.github.io/word-typing-defense/](https://golddragon0207.github.io/word-typing-defense/)
- **레포지토리**: [https://github.com/golddragon0207/word-typing-defense](https://github.com/golddragon0207/word-typing-defense)

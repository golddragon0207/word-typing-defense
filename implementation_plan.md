# 🎮 동적 다중 스트리머 (Multi-Streamer N인) 및 2단 몬스터 UI 구현 계획서

스트리머 1~2명 제한을 해제하고 **3인, 4인, 6인 이상 동적 다중 스트리머 참여**가 가능하며, 대형 방송에서도 시청자 닉네임과 clean 제시어가 직관적으로 구분되는 **2단 몬스터 시스템**을 구축합니다.

---

## 🎯 주요 개선 목표

1. **🏷️ 2단 몬스터 UI (상단: 시청자 닉네임 뱃지 / 하단: clean 타깃 제시어)**:
   - **상단 Pill Tag**: `🟢 억까의신`, `🔵 SOOP팬클럽` 등 시청자 닉네임을 상단 네온 글로우 뱃지로 표시.
   - **하단 Target Box**: 스트리머가 입력할 가독성 높은 clean 제시어(`구독과좋아요`, `쀍`, `오타내지마라` 등)를 메인 몬스터 상자 내부에 표시.

2. **🛡️ 대형 방송 마비 방지 시스템 (Max Monster Cap = 15)**:
   - 화면에 동시에 출전하는 몬스터 갯수를 최대 15개로 제한하여 대형 스트리머방 채팅 폭주 시에도 브라우저 렉이나 화면 마비를 완전 방지.

3. **👥 자유로운 인원 수 선택 (1명 ~ 6명+)**:
   - **1인 솔로 선택 시**: `대결/협동` 및 `개별/통합 입력창` 등 복잡한 합방 전용 옵션을 자동으로 숨기고 `1인 솔로 방어` 모드로 깔끔하게 고정.
   - **2인 이상 합방 선택 시**: **대결 모드(Versus Battle)** 또는 **협동 모드(Co-op Raid)** 및 **입력창 방식 선택** 옵션을 동적으로 노출.
   - 각 플레이어별 닉네임 및 포탑 전용 네온 색상 개별 지정.

4. **💥 동적 다중 포탑 및 최적 조준 엔진 (Multi-Turret Engine)**:
   - 선택된 인원 수에 따라 Canvas 화면 하단에 포탑 N개가 자동으로 균등 배치.
   - 각 포탑 상단/하단에 스트리머 닉네임 뱃지 및 개별 레이저/파티클 렌더링.
   - 통합 입력창 사용 시 낙하 몬스터의 X좌표와 가장 가까운 포탑이 자동으로 조준 사격.

5. **⌨️ 다중 입력 방식 지원 (Multi-Input System)**:
   - **개별 입력모드**: 화면 하단에 P1 ~ PN 플레이어별 개별 입력창이 생성되어 각 스트리머가 자기 전용 포탑으로 타격.
   - **통합 입력모드**: 단일 입력창 1개로 주 스트리머나 관전자/MC가 타격하는 모드 토글 가능.

6. **📡 실시간 방송 연동 & `!참여` 명령어 자동 참가 (메인 시스템)**:
   - 복사-붙여넣기 없이 스트리머 방송 URL/채널ID 연동으로 시청자가 `!참여`, `!참가`, `!억까` 입력 시 자동 출전. 기본 활성화 처리.

7. **🎯 한글 자모 획수(Stroke) 타수 (CPM) 및 HiDPI 고해상도 최적화**:
   - 한글 초성/중성/종성 획수를 감안한 정밀 타수(CPM) 계산 및 WPM 동시 제공.
   - `devicePixelRatio` 스케일링으로 4K/Retina 화면에서도 선명한 텍스처 출력 및 Canvas 클릭 포커스 자동 유지.

8. **🎯 난이도 4단계 선택 및 🌊 웨이브 스테이지(Stage) 시스템**:
   - **난이도 4종**: 쉬움(Easy), 보통(Normal), 어려움(Hard), 헬(Hell) 계수 적용.
   - **Stage 진행**: 몬스터 처치 시 `STAGE 1 ➔ STAGE 2...` 연출 배너 및 팡파르 상승음 재생.
   - **Boss Wave**: 5 스테이지 단위마다 대형 보스 몬스터 집중 소환 및 WARNING 연출.

9. **👑 성과 등급 뱃지(SSS~D) 및 🏆 로컬 명예의 전당 TOP 5 리더보드**:
   - **Rank Grade**: 점수/스테이지/난이도 종합 환산 `SSS`, `SS`, `S`, `A`, `B`, `C`, `D` 뱃지 렌더링.
   - **Local Leaderboard**: 브라우저 `localStorage` 전적 저장 및 TOP 5 갱신 시 `NEW RECORD!` 축하 이펙트.

10. **💰 웹 게임 수익화 (카카오 애드핏 배너 연동 & ☕ 토스(Toss) 후원 모달)**:
   - **Kakao AdFit**: 실시간 광고 스크립트 메인, 결과 창, 명예의 전당 배너 슬롯 3곳 탑재. (ID는 `js/config.js`에서 관리)
   - **Google AdSense**: 소유권 인증 스크립트 연동. (ID는 `js/config.js`에서 관리)
   - **후원 모달**: 상단바 `[☕ 후원]` 버튼 클릭 시 금액 프리셋(6종) 및 직접 입력 후 토스 송금 링크(`toss.me/{id}/{amount}`)로 이동. 계좌번호 등 개인정보 일절 노출 없음.

11. **📱 반응형 UI & 멀티 디스플레이 바운드 최적화 (Responsive Bounds)**:
   - **Fluid Typography**: `clamp()` 타이포그래피로 4K 및 소형 디스플레이 가독성 보장.
   - **Modal Flex Box**: `flex-shrink: 0` 푸터 고정 및 `modal-body` 독립 스크롤 처리로 버튼 잘림 완전 방지.
   - **Typing Bar & Screen Overlay**: 소형 노트북(1280x800) 및 모바일 뷰포트 오버플로우 방지.

12. **🌐 GitHub Pages 무료 웹 배포 주소 연동**:
   - Repository: `https://github.com/golddragon0207/word-typing-defense.git`
   - Live Web URL: `https://golddragon0207.github.io/word-typing-defense/`

---

## 📁 변경 대상 파일

### 1. `index.html`
- 메인 화면에 **참여 인원 조절 카운터 (1P ~ 6P+)**, **난이도 선택(Easy, Normal, Hard, Hell)** 및 플레이어 닉네임 설정 UI 추가.
- 상단 컨트롤바에 **`🏆 명예의 전당 (Top 5)`** 및 **`☕ 후원`** 모달 버튼 추가.
- 메인 타이틀, 결과 창, 리더보드 모달에 **`#ad-container-main` / `#ad-container-gameover` 카카오 애드핏 광고 배너 슬롯** 추가.
- 결과 화면에 **`👑 SSS~D RANK 뱃지`**, **`🎉 NEW RECORD!`** 태그 및 **최종 도달 스테이지** 추가.
- **`#modal-leaderboard`** 역대 최고 기록 TOP 5 리더보드 모달 및 **`#modal-support`** 카카오뱅크 계좌 후원 모달 추가.

### 2. `style.css`
- 플레이어 수에 맞춰 1~6개의 입력창이 깔끔하게 정렬되는 Responsive Grid CSS 추가.
- `.ad-banner-box` 광고 영역 네온 테두리 및 OBS 크로마키 투명 오버레이 처리 스타일 추가.
- `.modal-card` flex 구조 및 `modal-body` 독립 스크롤바, `modal-footer` 고정 스타일 추가.
- 반응형 미디어 쿼리(`@media (max-width: 768px)`, `@media (max-height: 800px)`) 추가.

### 3. `js/game.js`
- 2단 몬스터 구조(시청자 닉네임 Tag + 제시어 Box) Canvas 렌더링.
- `calculateRankGrade()` 등급 환산 로직 및 `saveLeaderboardRecord()` 로컬스토리지 전적 관리 구현.
- `renderLeaderboardUI()` 리더보드 동적 렌더링 및 `clearLeaderboard()` 초기화 기능 추가.
- 토스(Toss) 후원 링크(`toss.me/{id}/{amount}`) 핸들러 및 금액 프리셋 선택 이벤트 추가. (`CONFIG.TOSS_ID` 사용)
- `gameOver()` 실행 시 성과 등급 산정 및 TOP 5 신기록 달성 감지 연출.




### 4. `js/wordPacks.js`
- `getNextMonsterData()`를 추가하여 시청자 닉네임과 clean 제시어 쌍을 2단 구조로 공급.
- `getHangulStrokeCount()` 한글 자모 획수 분석 유틸리티 추가.

### 5. `js/audio.js`
- `playError()` 타격 매칭 실패 / 오타 입력 경고음 추가.
- `playStageUp()` 스테이지 달성 팡파르 상승 합성음 추가.

### 6. `js/chatIntegration.js`
- 단일 채널 연동 방식에서 **배열 기반 다중 채널 동시 연동 엔진 (`channels[]`)**으로 개선.


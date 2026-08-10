/**
 * ============================================================
 * WORD-TYPING-DEFENSE — 메인 오케스트레이터 (game.js)
 * [1인 솔로 싱글 플레이어 최적화 & 모달/루프 성능 최적화 완료]
 * ============================================================
 */

class GameEngine {
  constructor() {
    this.isInitialized = false;
    this.animationFrameId = null;

    // 1인 전용 고정 설정
    this.config = {
      playerCount: 1,
      difficulty: 'normal', // 밸런스 세트 키 (현재 normal 단일)
      playerNames: ['스트리머']
    };

    this.stateManager = null;
    this.turretManager = null;
    this.monsterManager = null;
    this.inputManager = null;
    this.renderer = null;

    this.stageKillCount = 0;
    // 🏅 이번 판 MVP 집계: 실제 참여 시청자(봇/보스 제외) 닉네임별 몬스터 "등장(참여)" 수 누적
    //    (처치 여부와 무관 — 스폰 시점에 MonsterManager가 trackMvpAppearance로 보고)
    this.mvpTracker = new Map();
    this.bgStars = [];
    this.bgAnimId = null;

    this.leaderboardCache = null;          // 명예의 전당 캐시 { source: 'global'|'local', scores: Array }
  }

  /**
   * 🚀 게임 엔진 초기화
   */
  init() {
    if (this.isInitialized) return;

    // 1. Canvas DOM 확보
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) {
      console.error('❌ #gameCanvas 요소를 찾을 수 없습니다.');
      return;
    }

    // 2. 모듈 인스턴스화
    this.stateManager = typeof StateManager !== 'undefined' ? new StateManager() : null;
    this.turretManager = typeof TurretManager !== 'undefined' ? new TurretManager(canvas) : null;
    this.monsterManager = typeof MonsterManager !== 'undefined' ? new MonsterManager(canvas) : null;
    this.inputManager = typeof InputManager !== 'undefined' ? new InputManager() : null;
    this.renderer = typeof CanvasRenderer !== 'undefined' ? new CanvasRenderer(canvas) : null;

    // 3. 렌더러 & 포탑 셋업 (1인 포탑 중앙 배치)
    if (this.renderer) {
      // 🖥️ 무대(1024×708 고정)를 창에 맞춰 비율 스케일 → 그 뒤 백버퍼 해상도 갱신
      this.fitStage();
      this.renderer.resizeCanvas();
      this.resizeBgCanvas();
      window.addEventListener('resize', () => {
        this.fitStage();                                   // 무대 스케일 재계산 (게임 좌표는 불변)
        if (this.renderer) this.renderer.resizeCanvas();   // 새 표시 크기에 맞춰 백버퍼만 갱신 → 선명도 유지
        this.resizeBgCanvas();
      });
    }

    if (this.turretManager) {
      this.turretManager.setupTurrets(1, this.config.playerNames, canvas);
    }

    // 4. 보스 WARNING 배너 콜백 연결
    if (this.monsterManager) {
      this.monsterManager.onBossWarning = (stage, durationMs = 3000) => {
        this.showBanner(`⚠️ STAGE ${stage} BOSS WARNING ⚠️`, '보스가 기를 모읍니다! 게이지가 차기 전에 제시어를 격파하세요!', true, durationMs);
        if (window.audioManager) window.audioManager.playFever();
      };
      // 🐲 보스 차지 게이지가 다 차면(공격 발동) 기지에 정액 피해
      this.monsterManager.onBossAttack = (damage) => this.handleBossAttack(damage);
    }

    // 5. 피버 버스트(화면 클리어 + 보너스 + 소량 회복) 콜백 연결
    if (this.stateManager) {
      this.stateManager.onFeverStart = () => this.triggerFeverBurst();

      // 🔒 게임 플레이 중에는 플레이와 무관한 상단바 버튼(단어팩·명예의전당·후원·건의사항)을
      //    비활성화한다. 이 모달들은 열려도 게임을 멈추지 않아, 플레이 중 클릭 시 그냥 지게 되기 때문.
      //    (라이브 채팅 모드·OBS 크로마키·사운드는 방송 중 즉시 조정이 필요하므로 잠그지 않는다)
      this.stateManager.onStateChange = (newState) => this.updateTopBarLock(newState);
    }

    // 6. UI 및 이벤트 바인딩
    this.bindUIEvents();
    this.initToastSystem();
    this.startBackgroundStarfield();

    // 홈 화면의 방송 채팅 연동 패널: 시작부터 참여자/연동 목록을 실시간 갱신
    this.startChatPanelLiveRefresh();

    // 7. 메인 루프 시작
    this.isInitialized = true;
    this.startMainLoop();

    console.log("🎮 Word Defense 1인 싱글 모드 엔진 초기화 완료!");
  }

  /**
   * 🖥️ 고정 무대(1024×708)를 상단 바 아래 남는 영역에 "비율 유지"로 맞춘다.
   *    내부 논리 좌표는 그대로 두고 CSS transform:scale 배율(--stage-scale)만 조정하므로
   *    창을 키우거나 줄여도 게임 좌표·방어선·몬스터 위치가 절대 바뀌지 않는다.
   *    (상단바 60px + 무대 708px = 1024×768 PC 최소 해상도에 정확히 맞음)
   */
  fitStage() {
    const frame = document.querySelector('.stage-frame');
    const stage = document.getElementById('game-stage');
    if (!frame || !stage) return;
    const availW = frame.clientWidth;
    const availH = frame.clientHeight;
    if (availW <= 0 || availH <= 0) return;
    const scale = Math.min(availW / 1024, availH / 708);
    stage.style.setProperty('--stage-scale', String(scale));
  }

  /**
   * 🖱️ UI 버튼 이벤트 바인딩 (광고 호출 유지 + 모달 반응속도 최적화)
   */
  bindUIEvents() {
    // 모달 팝업 및 해당 카카오 애드핏 배너 슬롯 매핑
    const modalMap = [
      { btnId: 'btn-word-modal', modalId: 'modal-words', adContainerId: 'ad-container-words' },
      { btnId: 'btn-leaderboard-modal', modalId: 'modal-leaderboard', adContainerId: 'ad-container-leaderboard' },
      { btnId: 'btn-support-modal', modalId: 'modal-support', adContainerId: 'ad-container-support' },
      { btnId: 'btn-suggestion-modal', modalId: 'modal-suggestion', adContainerId: 'ad-container-suggestion' }
    ];

    modalMap.forEach(({ btnId, modalId, adContainerId }) => {
      const btn = document.getElementById(btnId);
      const modal = document.getElementById(modalId);
      if (btn && modal) {
        btn.addEventListener('click', () => {
          // 🔒 게임 플레이 중 잠긴 버튼은 클릭 무시 (updateTopBarLock이 qc-locked 부여)
          if (btn.classList.contains('qc-locked')) return;

          // ⚡ 1. 클릭하는 순간 모달창부터 0ms 만에 즉시 띄움
          modal.classList.remove('hidden');

          // 모달별 진입 시 최신 데이터 렌더링 (명예의 전당은 항상 TOP5·검색 초기화 후 1회 로드)
          if (modalId === 'modal-leaderboard') {
            this.leaderboardView = 'top5';
            this.leaderboardQuery = '';
            const lbSearch = document.getElementById('leaderboard-search');
            if (lbSearch) { lbSearch.value = ''; lbSearch.classList.remove('hidden'); }
            this.loadLeaderboard();
          }
          if (modalId === 'modal-words') this.renderWordPackPreview();

          // ⚡ 2. 광고 호출 함수는 그대로 유지하되, 모달이 다 뜨고 난 150ms 뒤 비동기로 실행
          setTimeout(() => {
            if (window.refreshAdfitSlot && adContainerId) {
              window.refreshAdfitSlot(adContainerId);
            }
          }, 150);
        });
      }
    });

    // 🏆 명예의 전당 뷰 전환: 전체 ↔ TOP5, 내 순위 ↔ TOP5, 닉네임 검색
    //    (뷰 버튼을 누르면 남아있던 검색어는 초기화해 예측 가능하게 동작시킴)
    const lbSearch = document.getElementById('leaderboard-search');
    const clearLbSearch = () => { this.leaderboardQuery = ''; if (lbSearch) lbSearch.value = ''; };
    const lbAllBtn = document.getElementById('btn-leaderboard-all');
    if (lbAllBtn) {
      lbAllBtn.addEventListener('click', () => { clearLbSearch(); this.renderLeaderboard(this.leaderboardView === 'all' ? 'top5' : 'all'); });
    }
    const lbMeBtn = document.getElementById('btn-leaderboard-me');
    if (lbMeBtn) {
      lbMeBtn.addEventListener('click', () => { clearLbSearch(); this.renderLeaderboard(this.leaderboardView === 'me' ? 'top5' : 'me'); });
    }
    if (lbSearch) {
      lbSearch.addEventListener('input', () => this.onLeaderboardSearch(lbSearch.value));
    }

    // ⏸ 일시정지/재개: ESC 키 또는 마우스(일시정지/계속하기 버튼).
    //    스페이스바는 제시어(특히 라이브 채팅 문구)에 공백이 들어갈 수 있어 사용하지 않는다.
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!this.stateManager || this.stateManager.currentState !== 'PLAYING') return;
      if (document.querySelector('.modal-backdrop:not(.hidden)')) return; // 모달 상호작용 우선
      e.preventDefault();
      this.togglePause();
    });
    const pauseBtn = document.getElementById('btn-pause');
    if (pauseBtn) pauseBtn.addEventListener('click', () => this.togglePause());
    const resumeBtn = document.getElementById('btn-pause-resume');
    if (resumeBtn) resumeBtn.addEventListener('click', () => this.togglePause());

    // 닫기 버튼 (모달 닫을 때 게임 중이면 타자 입력창으로 포커스 자동 복원)
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetId = e.currentTarget.getAttribute('data-close');
        const targetModal = document.getElementById(targetId);
        if (targetModal) targetModal.classList.add('hidden');

        // 모달을 닫은 직후 타자 입력창으로 포커스 즉시 복원
        setTimeout(() => {
          const activeInput = document.querySelector('.game-typing-input');
          if (activeInput && this.stateManager && this.stateManager.currentState === 'PLAYING') {
            activeInput.focus();
          }
        }, 50);
      });
    });

    // 게임 시작 / 재시작 / 메인 이동 버튼
    const btnStart = document.getElementById('btn-start-game');
    if (btnStart) btnStart.addEventListener('click', () => this.startGame());

    const btnRestart = document.getElementById('btn-restart');
    if (btnRestart) btnRestart.addEventListener('click', () => this.restartWithSameParticipants());

    // 메인으로 돌아가기 버튼 (클래스/ID 다중 바인딩 처리)
    document.querySelectorAll('#btn-return-main, .btn-return-main').forEach(btn => {
      btn.addEventListener('click', () => this.returnToMain());
    });

    // 🔄 채팅 연동 모달: 참여자 명단 초기화 버튼
    const btnResetParticipants = document.getElementById('btn-reset-participants');
    if (btnResetParticipants) {
      btnResetParticipants.addEventListener('click', () => {
        if (typeof wordPacks !== 'undefined' && typeof wordPacks.resetParticipants === 'function') {
          wordPacks.resetParticipants();
        }
        this.renderParticipants();
        this.showToastInternal('🔄 참여자 명단을 초기화했습니다.', 'info');
      });
    }

    // 결과 화면 → 후원 모달 바로가기
    const btnResultSupport = document.getElementById('btn-result-support');
    if (btnResultSupport) {
      btnResultSupport.addEventListener('click', () => {
        const modal = document.getElementById('modal-support');
        if (modal) modal.classList.remove('hidden');
        setTimeout(() => window.refreshAdfitSlot && window.refreshAdfitSlot('ad-container-support'), 150);
      });
    }

    // 계좌번호 1초 복사 버튼
    const btnCopyAccount = document.getElementById('btn-copy-account');
    if (btnCopyAccount) {
      btnCopyAccount.addEventListener('click', () => {
        const accountNumber = '3333-28-2684443';
        this.copyToClipboard(accountNumber, () => {
          this.showToastInternal(`📋 계좌번호가 복사되었습니다! (${accountNumber})`, 'success');
        });
      });
    }

    this.bindChatModalEvents();
    this.bindWordPackModalEvents();
    this.bindLiveChatToggle();
    this.bindObsToggle();
    this.bindSfxToggle();
    this.bindSuggestionModal();
  }

  /**
   * ⌨️ 1인 전용 타자 입력창 바인딩
   */
  setupInputBars() {
    const container = document.getElementById('multi-input-container');
    if (!container) return;

    // 1인 전용 단일 입력창 생성
    container.innerHTML = `
      <div class="typing-input-box solo-mode">
        <span class="player-tag">🎯 PLAYER</span>
        <input type="text" class="game-typing-input" data-player="0" placeholder="타깃 단어를 입력하고 Enter!" autofocus />
      </div>
    `;

    if (this.inputManager) {
      this.inputManager.bindInputs(container.querySelectorAll('.game-typing-input'), (playerIdx, text) => {
        this.handleTypingSubmit(playerIdx, text);
      });
    }
  }

  /**
   * 🚀 게임 시작
   */
  startGame() {
    if (this.monsterManager) this.monsterManager.clear();

    // ⏸ 새 판 시작 시 일시정지 상태 초기화
    this.isPaused = false;
    this._pauseStart = null;
    this._cancelResumeGrace(); // 진행 중이던 재개 그레이스 카운트다운 정리
    const pauseOverlay = document.getElementById('pause-overlay');
    if (pauseOverlay) pauseOverlay.classList.add('hidden');

    // 스트리머 닉네임 필수: 비어 있으면 시작을 막고 입력을 유도한다.
    const nicknameInput = document.getElementById('input-player-nickname');
    const nickname = nicknameInput ? nicknameInput.value.trim() : '';
    if (!nickname) {
      // 입력칸이 접이식 연동 패널 안에 있으므로 펼쳐서 보이게 한 뒤 포커스
      const chatPanel = document.getElementById('home-chat-panel');
      if (chatPanel) chatPanel.open = true;
      if (nicknameInput) nicknameInput.focus();
      this.showToastInternal('🎨 스트리머 닉네임을 먼저 입력해주세요!', 'warn');
      return;
    }
    this.config.playerNames = [nickname];

    const mainScreen = document.getElementById('screen-main');
    const gameOverScreen = document.getElementById('screen-gameover');
    const gameHud = document.getElementById('game-hud');
    const typingBar = document.getElementById('typing-input-bar');

    if (mainScreen) mainScreen.classList.add('hidden');
    if (gameOverScreen) gameOverScreen.classList.add('hidden');
    if (gameHud) gameHud.classList.remove('hidden');
    if (typingBar) typingBar.classList.remove('hidden');
    const queuePanel = document.getElementById('queue-panel');
    if (queuePanel) queuePanel.classList.remove('hidden');

    this.setupInputBars();

    const canvas = document.getElementById('gameCanvas');

    this.stageKillCount = 0;
    this.mvpTracker = new Map(); // 🏅 새 판 시작 시 MVP 집계 초기화
    // ⚠️ 참여자 명단은 여기서 리셋하지 않는다. 게임 시작 전에 모인 시청자가 지워지기 때문.
    //    명단 리셋은 판이 끝나 메인으로 돌아갈 때(returnToMain)에서 수행한다.

    if (this.stateManager) this.stateManager.resetGame(this.config);
    if (this.turretManager) this.turretManager.setupTurrets(1, this.config.playerNames, canvas);
    // 게임 시작 직후엔 시청자가 !참여로 모일 여유(그레이스 타임)를 두고 첫 몬스터를 소환한다.
    const startDelayMs = (typeof CONFIG !== 'undefined' && CONFIG.START_SPAWN_DELAY_MS) || 0;
    if (this.monsterManager) this.monsterManager.startStage(this.stateManager ? this.stateManager.currentStage : 1, this.config.difficulty, startDelayMs);
    // ⏱️ 그레이스 타임 동안 화면 중앙에 카운트다운 표시(시청자 !참여 유도)
    if (startDelayMs > 0) this.showStartCountdown(startDelayMs);

    if (this.stateManager) this.stateManager.changeState('PLAYING');

    if (window.GlobalLeaderboard) {
      window.GlobalLeaderboard.logEvent('game_start', { difficulty: this.config.difficulty });
    }

    setTimeout(() => {
      const firstInput = document.querySelector('.game-typing-input');
      if (firstInput) firstInput.focus();
    }, 50);
  }

  returnToMain() {
    // ⏸ 일시정지 상태/오버레이 해제
    this.isPaused = false;
    this._pauseStart = null;
    this._cancelResumeGrace(); // 진행 중이던 재개 그레이스 카운트다운 정리
    const pauseOverlay = document.getElementById('pause-overlay');
    if (pauseOverlay) pauseOverlay.classList.add('hidden');
    this.stopStartCountdown(); // ⏱️ 진행 중이던 시작 카운트다운 정리

    const gameOverScreen = document.getElementById('screen-gameover');
    const gameHud = document.getElementById('game-hud');
    const typingBar = document.getElementById('typing-input-bar');
    const mainScreen = document.getElementById('screen-main');

    if (gameOverScreen) gameOverScreen.classList.add('hidden');
    if (gameHud) gameHud.classList.add('hidden');
    if (typingBar) typingBar.classList.add('hidden');
    if (mainScreen) mainScreen.classList.remove('hidden');
    const queuePanel = document.getElementById('queue-panel');
    if (queuePanel) queuePanel.classList.add('hidden');

    if (this.monsterManager) this.monsterManager.clear();
    if (this.stateManager) this.stateManager.changeState('MENU');

    // 🔄 판이 끝나 메인으로 돌아올 때 참여자 명단을 새로 시작 (다음 판은 시청자를 다시 모집)
    if (typeof wordPacks !== 'undefined' && typeof wordPacks.resetParticipants === 'function') {
      wordPacks.resetParticipants();
    }

    // 재모집 유도: 홈의 채팅 연동 패널을 펼치고 참여자/연동 목록 실시간 갱신을 재개한다.
    const chatPanel = document.getElementById('home-chat-panel');
    if (chatPanel) chatPanel.open = true;
    this.startChatPanelLiveRefresh();

    setTimeout(() => {
      if (window.refreshAdfitSlot) window.refreshAdfitSlot('ad-container-main');
    }, 150);
  }

  /**
   * 🔄 '다시 도전하기': 참여자 명단을 그대로 유지한 채 즉시 새 판을 시작한다.
   *    startGame()은 참여자 명단(wordPacks)을 리셋하지 않으므로, 방금 판에 모인 시청자가
   *    그대로 다음 판에 이어진다. (참여자 리셋은 '메인 화면으로'(returnToMain)에서만 수행)
   */
  restartWithSameParticipants() {
    this.startGame();
  }

  /**
   * ⌨️ 타자 입력 제출 처리 (명중/오타 판정, 점수/콤보/CPM/WPM, 사운드, 스테이지 진행)
   */
  handleTypingSubmit(playerIdx, text) {
    if (!this.stateManager || this.stateManager.currentState !== 'PLAYING') return;
    if (this.isPaused) return; // 일시정지 중에는 제출 무시

    const hitResult = this.monsterManager ? this.monsterManager.checkHit(text) : null;

    if (!hitResult || !hitResult.success) {
      // ❌ 일치하는 몬스터 없음 = 오타/미스
      if (window.audioManager) window.audioManager.playError();
      if (this.stateManager) this.stateManager.registerMiss();
      return;
    }

    const { monster, isKilled, isBoss, bossDamaged } = hitResult;

    // 🎯 포탑 조준/사격
    let firedTurret = null;
    if (this.turretManager) {
      firedTurret = this.turretManager.aimAndFire(monster);
    }
    if (window.audioManager) window.audioManager.playLaser();

    const turrets = this.turretManager ? this.turretManager.getTurrets() : [];
    const turretPos = firedTurret || turrets[0];

    if (turretPos && this.renderer) {
      this.renderer.addLaserEffect(turretPos, monster);
    }

    // 🐲 보스 피격(아직 생존): 점수·콤보·타수는 인정하되 처치 수는 늘리지 않고, 피격 연출만 낸다.
    if (bossDamaged) {
      if (this.stateManager) this.stateManager.registerHit(text, monster.scoreValue || 100, false);
      if (window.audioManager) window.audioManager.playExplosion();
      monster._flashUntil = performance.now() + 170; // 렌더러 피격 플래시(붉게 번쩍)
      return;
    }

    if (isKilled) {
      if (this.renderer) this.renderer.addExplosionEffect(monster);
      if (window.audioManager) window.audioManager.playExplosion();
      if (this.stateManager) this.stateManager.registerHit(text, monster.scoreValue || 100);

      // 🏆 스테이지 진행: 보스 처치 or 일반 처치 누적 목표 달성 시 다음 스테이지로
      if (isBoss) {
        // 💚 보스 처치 보상: 기지 체력 일부 회복(최대 체력의 25%, 상한 초과분은 버림)
        if (this.stateManager) {
          const healAmount = Math.round(this.stateManager.maxHp * 0.25);
          const healed = this.stateManager.healBase(healAmount);
          if (healed > 0) this.showToastInternal(`💚 보스 격파! 기지 +${healed} 회복`, 'success');
        }
        this.advanceStage();
      } else {
        this.stageKillCount += 1;
        const killTarget = this.getStageKillTarget();
        const isBossStageWaiting = this.monsterManager && this.stateManager.currentStage % 5 === 0;
        if (!isBossStageWaiting && this.stageKillCount >= killTarget) {
          this.advanceStage();
        }
      }
    }
  }

  /**
   * 🎯 현재 스테이지의 처치 목표 수. 스테이지 진행 판정과 스폰 스로틀(MonsterManager)이 공용으로 참조한다.
   *    (killPerStageBase + (stage-1)×killPerStageStep, 난이도 테이블 기준)
   */
  getStageKillTarget() {
    const diffCfg = (typeof getDifficultyConfig === 'function')
      ? getDifficultyConfig(this.config.difficulty)
      : { killPerStageBase: 8, killPerStageStep: 0.5 };
    const stage = this.stateManager ? this.stateManager.currentStage : 1;
    return diffCfg.killPerStageBase + Math.floor((stage - 1) * diffCfg.killPerStageStep);
  }

  /**
   * ♾️ 다음 스테이지로 진행 (무한 Stage + 5 Stage 단위 보스전)
   */
  advanceStage() {
    if (!this.stateManager || !this.monsterManager) return;

    this.stateManager.currentStage += 1;
    this.stageKillCount = 0;

    // ⏱️ 스테이지업 때마다 잠깐 숨 돌릴 여유(기본 5초) 후 다음 몬스터/보스 소환
    const stageUpDelay = (typeof CONFIG !== 'undefined' && CONFIG.STAGE_UP_SPAWN_DELAY_MS != null)
      ? CONFIG.STAGE_UP_SPAWN_DELAY_MS : 5000;
    this.monsterManager.startStage(this.stateManager.currentStage, this.config.difficulty, stageUpDelay);
    this.stateManager.updateHUDUI();

    if (window.audioManager) window.audioManager.playStageUp();

    const isBossStage = this.stateManager.currentStage % 5 === 0;
    if (!isBossStage) {
      this.showBanner(`STAGE ${this.stateManager.currentStage} START!`, '시청자 몬스터를 타자로 방어하세요!', false);
    }
  }

  /**
   * 🔥 피버 버스트: 피버 게이지가 다 차면 화면의 일반 몬스터를 한 번에 정리하고
   *    보너스 점수 + 소량 회복을 준다(보스는 남긴다). '칠 게 없는 타이밍'에도 확실한 보상.
   */
  triggerFeverBurst() {
    if (!this.monsterManager || !this.stateManager) return;

    // 🔥 화면 한복판에서 크게 터지는 피버 연출(플래시 + 대형 텍스트 + 흔들림)
    this.playFeverOverlay();

    const cleared = this.monsterManager.clearNonBoss();

    // 정리된 몬스터마다 폭발 이펙트 + 점수 합산 (+ 기본 보너스)
    let bonus = 0;
    cleared.forEach(m => {
      if (this.renderer) this.renderer.addExplosionEffect(m);
      bonus += (m.scoreValue || 100);
    });
    const totalBonus = bonus + 500;
    this.stateManager.addFeverBonus(totalBonus);

    // 기지 소량 회복 (최대 체력의 10%, 상한 초과분 버림)
    const heal = Math.round(this.stateManager.maxHp * 0.1);
    const healed = this.stateManager.healBase(heal);

    if (window.audioManager) {
      window.audioManager.playFever();
      window.audioManager.playExplosion();
    }

    const parts = [`🔥 FEVER! +${totalBonus.toLocaleString()}점`];
    if (cleared.length > 0) parts.push(`${cleared.length}마리 정리`);
    if (healed > 0) parts.push(`기지 +${healed}`);
    this.showToastInternal(parts.join(' · '), 'success');
  }

  /**
   * 🐲 보스 차지 공격 발동: 게이지가 다 차면 기지에 정액 피해를 입힌다(느릴수록 누적).
   * @param {number} damage
   */
  handleBossAttack(damage) {
    if (!this.stateManager || this.stateManager.currentState !== 'PLAYING') return;
    const isDead = this.stateManager.damageBaseFlat(damage);
    if (window.audioManager) window.audioManager.playExplosion();
    // 💥 화면 전체에 붉은 위험 비네트 + 피해 텍스트로 피격을 확실히 알린다
    this.playBossAttackOverlay(damage);
    if (isDead) {
      this.stateManager.changeState('GAME_OVER');
      this.showGameOverScreen();
    }
  }

  /**
   * 🚩 화면 중앙 배너 표시 (스테이지 시작 / 보스 WARNING 공용)
   */
  showBanner(title, desc, isWarning = false, durationMs = 3000) {
    const banner = document.getElementById('stage-banner');
    const titleEl = document.getElementById('stage-banner-title');
    const descEl = document.getElementById('stage-banner-desc');
    if (!banner) return;

    if (titleEl) titleEl.innerText = title;
    if (descEl) descEl.innerText = desc;
    banner.classList.toggle('warning-banner', isWarning);
    banner.classList.remove('hidden');

    clearTimeout(this._bannerTimeout);
    this._bannerTimeout = setTimeout(() => banner.classList.add('hidden'), durationMs > 0 ? durationMs : 3000);
  }

  /**
   * ⏱️ 게임 시작 그레이스 타임 카운트다운 표시.
   *   첫 몬스터 스폰까지 남은 초를 화면 중앙에 크게 보여주며(5→4→3→2→1),
   *   그 사이 시청자가 '!참여'로 모일 수 있음을 안내한다.
   * @param {number} delayMs - 첫 스폰까지의 그레이스 타임(ms)
   */
  showStartCountdown(delayMs) {
    const overlay = document.getElementById('start-countdown');
    const numEl = document.getElementById('start-countdown-num');
    if (!overlay || !numEl) return;

    this.stopStartCountdown(); // 혹시 남아있던 이전 카운트다운 정리

    let remaining = Math.ceil(delayMs / 1000);
    const render = () => {
      numEl.innerText = remaining;
      // tick 애니메이션 재생(클래스 재적용을 위해 리플로우 강제)
      numEl.classList.remove('tick');
      void numEl.offsetWidth;
      numEl.classList.add('tick');
    };

    overlay.classList.remove('hidden');
    render();

    this._countdownInterval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        this.stopStartCountdown();
        return;
      }
      render();
    }, 1000);
  }

  /** 카운트다운 오버레이/타이머 정리 */
  stopStartCountdown() {
    if (this._countdownInterval) {
      clearInterval(this._countdownInterval);
      this._countdownInterval = null;
    }
    const overlay = document.getElementById('start-countdown');
    if (overlay) overlay.classList.add('hidden');
  }

  /**
   * ⏸ 일시정지 토글 (ESC 키 / 일시정지·계속하기 버튼). 게임 진행 중일 때만 동작.
   *   - 몬스터 이동/스폰을 멈추고, 일시정지 동안 흐른 시간을 startTime에 더해
   *     WPM/경과시간 계산에서 제외한다(화장실 등으로 잠깐 비워도 타수가 왜곡되지 않음).
   */
  togglePause() {
    if (!this.stateManager || this.stateManager.currentState !== 'PLAYING') return;

    const overlay = document.getElementById('pause-overlay');
    const input = document.querySelector('.game-typing-input');

    if (!this.isPaused) {
      // ── ⏸ 일시정지 진입 ──
      this.isPaused = true;
      this._pauseStart = performance.now();
      this._cancelResumeGrace(); // 혹시 진행 중이던 재개 그레이스 취소
      if (overlay) overlay.classList.remove('hidden');
      if (input) { input.blur(); input.disabled = true; } // 일시정지 중 입력 차단
    } else if (this._resumeGracePending) {
      // ── 재개 그레이스 카운트다운 도중 다시 정지: 카운트다운을 접고 정지 상태로 복귀 ──
      //    (isPaused/_pauseStart는 그대로 유지 → 게임은 계속 얼어붙은 상태)
      this._cancelResumeGrace();
      if (overlay) overlay.classList.remove('hidden');
    } else {
      // ── ▶ 재개: 즉시 풀지 않고 5초 그레이스 카운트다운을 보여준 뒤 실제 시작 ──
      //    카운트다운 동안에도 isPaused=true를 유지해 몬스터/스폰을 계속 멈춘다.
      if (overlay) overlay.classList.add('hidden');
      this._startResumeGrace();
    }
  }

  /** ▶ 재개 그레이스 시작: 5초 카운트다운을 띄우고, 끝나면 실제 재개(_finishResume). */
  _startResumeGrace() {
    const graceMs = (typeof CONFIG !== 'undefined' && CONFIG.RESUME_GRACE_MS != null)
      ? CONFIG.RESUME_GRACE_MS : 5000;
    this._resumeGracePending = true;
    this.showStartCountdown(graceMs);
    clearTimeout(this._resumeGraceTimeout);
    this._resumeGraceTimeout = setTimeout(() => this._finishResume(), graceMs);
  }

  /** 재개 그레이스 타이머/카운트다운 정리(취소). isPaused 상태는 건드리지 않는다. */
  _cancelResumeGrace() {
    if (this._resumeGraceTimeout) {
      clearTimeout(this._resumeGraceTimeout);
      this._resumeGraceTimeout = null;
    }
    if (this._resumeGracePending) {
      this._resumeGracePending = false;
      this.stopStartCountdown();
    }
  }

  /** 재개 그레이스 완료 → 실제 재개 처리(입력 복구·스폰 복구·경과시간 보정). */
  _finishResume() {
    this._resumeGraceTimeout = null;
    this._resumeGracePending = false;
    this.stopStartCountdown();

    const input = document.querySelector('.game-typing-input');
    this.isPaused = false;
    // 일시정지+그레이스 동안 흐른 시간만큼 startTime을 미뤄 경과시간(=WPM 분모)에서 제외
    if (this._pauseStart && this.stateManager.startTime) {
      this.stateManager.startTime += (performance.now() - this._pauseStart);
    }
    this._pauseStart = null;
    if (input) { input.disabled = false; setTimeout(() => input.focus(), 30); }
    // ▶ 정지 동안 타이머가 발화하며 스킵된 '스테이지 첫 등장'을 복구 (재개 후 빈 화면 방지)
    if (this.monsterManager) this.monsterManager.resumeSpawns();
  }

  startMainLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    const loop = () => {
      this.update(0.016);
      this.render();
      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  update(deltaTime) {
    // ⏸ 일시정지 중에는 몬스터 이동/포탑/이펙트를 모두 멈춘다 (스폰은 _spawnTick에서 별도 차단)
    if (this.isPaused) return;

    if (this.stateManager && this.stateManager.currentState === 'PLAYING' && this.monsterManager) {
      const reachedMonsters = this.monsterManager.update(deltaTime);
      if (reachedMonsters > 0) {
        const isDead = this.stateManager.damageBase(reachedMonsters);
        if (isDead) {
          this.stateManager.changeState('GAME_OVER');
          this.showGameOverScreen();
        }
      }

      // 🕒 대기열 패널 갱신 (매 프레임 대신 약 3회/초로 스로틀)
      const now = performance.now();
      if (!this._lastQueueRender || now - this._lastQueueRender > 350) {
        this._lastQueueRender = now;
        this.renderQueuePanel();
      }
    }
    if (this.turretManager) this.turretManager.update(deltaTime);
    if (this.renderer) this.renderer.updateEffects(deltaTime);
  }

  render() {
    if (!this.renderer) return;

    this.renderer.clear();

    if (this.turretManager && this.renderer.ctx) {
      this.renderer.drawTurrets(this.turretManager.getTurrets());
    }
    if (this.monsterManager && this.renderer.ctx) {
      this.renderer.drawMonsters(this.monsterManager.getMonsters());
    }
    if (this.renderer) {
      this.renderer.drawEffects();
    }
  }

  /**
   * 🏅 MVP 등장(참여) 집계: 실참여 시청자의 몬스터가 화면에 뜰 때마다 MonsterManager가 호출.
   *    처치 여부와 무관하게 "낸 몬스터 수"를 닉네임별로 누적한다. 봇/보스는 호출되지 않음.
   * @param {string} username - 몬스터에 표시되는 시청자 닉네임
   */
  trackMvpAppearance(username) {
    const name = (username || '').toString().trim();
    if (!name) return;
    this.mvpTracker.set(name, (this.mvpTracker.get(name) || 0) + 1);
  }

  /**
   * 🏅 이번 판 MVP 산출: 실참여 시청자(봇/보스 제외) 중 몬스터를 가장 많이 낸 닉네임.
   * 동점이면 먼저 집계된(=먼저 참여한) 시청자를 우선한다. 참여자가 없으면 null.
   * @returns {{name: string, count: number}|null}
   */
  computeMvp() {
    if (!this.mvpTracker || this.mvpTracker.size === 0) return null;
    let best = null;
    for (const [name, count] of this.mvpTracker.entries()) {
      if (!best || count > best.count) best = { name, count };
    }
    return best;
  }

  showGameOverScreen() {
    document.getElementById('game-hud').classList.add('hidden');
    document.getElementById('typing-input-bar').classList.add('hidden');
    const queuePanel = document.getElementById('queue-panel');
    if (queuePanel) queuePanel.classList.add('hidden');

    const gameOverScreen = document.getElementById('screen-gameover');
    if (gameOverScreen && this.stateManager) {
      gameOverScreen.classList.remove('hidden');

      const stageEl = document.getElementById('result-stage');
      const scoreEl = document.getElementById('result-score');
      const wpmEl = document.getElementById('result-wpm');
      const comboEl = document.getElementById('result-combo');
      const killsEl = document.getElementById('result-kills');
      const rankBadgeEl = document.getElementById('result-rank-badge');
      const newRecordEl = document.getElementById('result-new-record');

      if (stageEl) stageEl.innerText = `STAGE ${this.stateManager.currentStage}`;
      if (scoreEl) scoreEl.innerText = this.stateManager.score.toLocaleString();
      if (wpmEl) wpmEl.innerText = this.stateManager.maxWpm;
      if (comboEl) comboEl.innerText = this.stateManager.maxCombo;
      if (killsEl) killsEl.innerText = this.stateManager.totalKills;

      // 🏅 이번 판 MVP(최다 처치 실참여 시청자) 표시. 참여 시청자가 없으면(봇만) 숨김.
      const mvp = this.computeMvp();
      const mvpEl = document.getElementById('result-mvp');
      const mvpNameEl = document.getElementById('result-mvp-name');
      const mvpKillsEl = document.getElementById('result-mvp-kills');
      if (mvpEl) {
        if (mvp) {
          if (mvpNameEl) mvpNameEl.innerText = mvp.name; // 닉네임은 시청자 입력값이라 innerText로 안전 처리
          if (mvpKillsEl) mvpKillsEl.innerText = `몬스터 ${mvp.count}마리 참여`;
          mvpEl.classList.remove('hidden');
        } else {
          mvpEl.classList.add('hidden');
        }
      }

      const rank = this.stateManager.calculateRankGrade();
      if (rankBadgeEl) {
        rankBadgeEl.innerText = `👑 ${rank} RANK`;
        rankBadgeEl.className = `rank-grade-badge rank-${rank.toLowerCase()}`;
      }

      // 🌐 글로벌 상위 %(누적 기록 기준). 누적 기록이 MIN_SAMPLE 미만이면 '집계 중',
      //    Firebase 미설정/오프라인이면 아예 숨긴다. (조회는 비동기 — 먼저 '집계 중'을 띄우고 갱신)
      const pctEl = document.getElementById('result-percentile');
      if (pctEl) {
        if (window.GlobalLeaderboard && window.GlobalLeaderboard.enabled) {
          pctEl.classList.remove('hidden');
          pctEl.innerText = '상위 집계 중…';
          window.GlobalLeaderboard.fetchPercentile(this.stateManager.score).then(res => {
            if (!res || !res.available) { pctEl.classList.add('hidden'); return; }
            if (res.enough) {
              const p = res.topPercent;
              pctEl.innerText = `상위 ${p < 1 ? p.toFixed(1) : Math.round(p)}%`;
            } else {
              pctEl.innerText = '상위 집계 중…';
            }
          });
        } else {
          pctEl.classList.add('hidden');
        }
      }

      // 📊 게임 종료 이벤트 로깅 (닉네임 등 개인식별정보는 넘기지 않음)
      if (window.GlobalLeaderboard) {
        window.GlobalLeaderboard.logEvent('game_over', {
          difficulty: this.config.difficulty,
          stage_reached: this.stateManager.currentStage,
          score: this.stateManager.score,
          grade: rank,
          max_wpm: this.stateManager.maxWpm,
          max_combo: this.stateManager.maxCombo
        });
      }

      // 🏆 localStorage TOP 5 저장 (오프라인 폴백용) 및 신기록 배지 표시
      const nickname = this.config.playerNames && this.config.playerNames[0] ? this.config.playerNames[0] : '스트리머';
      const { isNewRecord } = this.stateManager.saveScore(nickname);
      if (newRecordEl) newRecordEl.classList.toggle('hidden', !isNewRecord);
      if (isNewRecord) {
        this.showToastInternal('🎉 명예의 전당 신기록을 달성했습니다!', 'success');
      }

      // 🌐 글로벌 명예의 전당(Firestore)에도 함께 제출 (설정된 경우에만, 실패해도 게임에 영향 없음)
      if (window.GlobalLeaderboard && window.GlobalLeaderboard.enabled) {
        window.GlobalLeaderboard.submitScore({
          nickname,
          score: this.stateManager.score,
          stage: this.stateManager.currentStage,
          wpm: this.stateManager.maxWpm,
          combo: this.stateManager.maxCombo,
          grade: rank,
          date: new Date().toISOString().slice(0, 10)
        }).then(ok => {
          if (ok) this.showToastInternal('🌐 글로벌 명예의 전당에 기록을 제출했습니다.', 'info');
        });
      }

      // 💰 결과 화면 광고 리프레시 (150ms 비동기 실행)
      setTimeout(() => {
        if (window.refreshAdfitSlot) window.refreshAdfitSlot('ad-container-gameover');
      }, 150);
    }
  }
}

/**
 * ============================================================
 * STREAMER WORD DEFENSE — 메인 오케스트레이터 (game.js)
 * [1인 솔로 싱글 플레이어 최적화 버전]
 * ============================================================
 */

class GameEngine {
  constructor() {
    this.isInitialized = false;
    this.animationFrameId = null;

    // 1인 전용 고정 설정
    this.config = {
      playerCount: 1,
      difficulty: 'normal', // 'easy' | 'normal' | 'hard' | 'hell'
      playerNames: ['스트리머']
    };

    this.stateManager = null;
    this.turretManager = null;
    this.monsterManager = null;
    this.inputManager = null;
    this.renderer = null;
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
      this.renderer.resizeCanvas();
      window.addEventListener('resize', () => {
        if (this.renderer) this.renderer.resizeCanvas();
        if (this.turretManager) this.turretManager.repositionTurrets();
      });
    }

    if (this.turretManager) {
      this.turretManager.setupTurrets(1, this.config.playerNames, canvas);
    }

    // 4. UI 및 이벤트 바인딩
    this.bindUIEvents();

    // 5. 메인 루프 시작
    this.isInitialized = true;
    this.startMainLoop();

    console.log("🎮 Word Defense 1인 싱글 모드 엔진 초기화 완료!");
  }

  /**
   * 🖱️ UI 버튼 이벤트 바인딩
   */
  bindUIEvents() {
    // 모달 팝업 바인딩
    const modalMap = [
      { btnId: 'btn-chat-modal', modalId: 'modal-chat' },
      { btnId: 'btn-word-modal', modalId: 'modal-words' },
      { btnId: 'btn-leaderboard-modal', modalId: 'modal-leaderboard' },
      { btnId: 'btn-support-modal', modalId: 'modal-support' }
    ];

    modalMap.forEach(({ btnId, modalId }) => {
      const btn = document.getElementById(btnId);
      const modal = document.getElementById(modalId);
      if (btn && modal) {
        btn.addEventListener('click', () => {
          modal.classList.remove('hidden');
        });
      }
    });

    // 닫기 버튼
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetId = e.currentTarget.getAttribute('data-close');
        const targetModal = document.getElementById(targetId);
        if (targetModal) targetModal.classList.add('hidden');
      });
    });

    // 난이도 선택 버튼
    const diffBtns = document.querySelectorAll('.btn-diff');
    diffBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        diffBtns.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.config.difficulty = e.currentTarget.dataset.diff;
      });
    });

    // 게임 시작 / 재시작 / 메인 이동 버튼
    const btnStart = document.getElementById('btn-start-game');
    if (btnStart) btnStart.addEventListener('click', () => this.startGame());

    const btnRestart = document.getElementById('btn-restart');
    if (btnRestart) btnRestart.addEventListener('click', () => this.startGame());

    const btnReturnMain = document.getElementById('btn-return-main');
    if (btnReturnMain) btnReturnMain.addEventListener('click', () => this.returnToMain());
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
    // 1. 화면 전환
    const mainScreen = document.getElementById('screen-main');
    const gameOverScreen = document.getElementById('screen-gameover');
    const gameHud = document.getElementById('game-hud');
    const typingBar = document.getElementById('typing-input-bar');

    if (mainScreen) mainScreen.classList.add('hidden');
    if (gameOverScreen) gameOverScreen.classList.add('hidden');
    if (gameHud) gameHud.classList.remove('hidden');
    if (typingBar) typingBar.classList.remove('hidden');

    // 2. 입력창 셋업
    this.setupInputBars();

    const canvas = document.getElementById('gameCanvas');

    // 3. 모듈 리셋 및 스테이지 시작 (포탑 1개)
    if (this.stateManager) this.stateManager.resetGame(this.config);
    if (this.turretManager) this.turretManager.setupTurrets(1, this.config.playerNames, canvas);
    if (this.monsterManager) this.monsterManager.startStage(this.stateManager ? this.stateManager.currentStage : 1, this.config.difficulty);

    if (this.stateManager) this.stateManager.changeState('PLAYING');

    // 4. 입력창 즉시 포커스
    setTimeout(() => {
      const firstInput = document.querySelector('.game-typing-input');
      if (firstInput) firstInput.focus();
    }, 50);
  }

  /**
   * 🏠 메인 화면으로 돌아가기
   */
  returnToMain() {
    document.getElementById('screen-gameover').classList.add('hidden');
    document.getElementById('game-hud').classList.add('hidden');
    document.getElementById('typing-input-bar').classList.add('hidden');
    document.getElementById('screen-main').classList.remove('hidden');

    if (this.monsterManager) this.monsterManager.clear();
    if (this.stateManager) this.stateManager.changeState('MENU');
  }

  /**
   * 🎯 타자 제출 처리 (단어 맞추었을 때)
   */
  handleTypingSubmit(playerIdx, text) {
    if (!this.stateManager || this.stateManager.currentState !== 'PLAYING') return;

    const hitResult = this.monsterManager ? this.monsterManager.checkHit(text) : null;
    if (hitResult && hitResult.success) {
      const { monster, isKilled } = hitResult;

      // 중앙 대포 조준 및 발사
      let firedTurret = null;
      if (this.turretManager) {
        firedTurret = this.turretManager.aimAndFire(monster, 0); // 0번 포탑 고정
      }

      const turrets = this.turretManager ? this.turretManager.getTurrets() : [];
      const turretPos = firedTurret || turrets[0];

      if (turretPos && this.renderer) {
        this.renderer.addLaserEffect(turretPos, monster);
      }

      if (isKilled && this.renderer) {
        this.renderer.addExplosionEffect(monster);
        if (this.stateManager) this.stateManager.addScore(monster.scoreValue || 100);
      }
    }
  }

  startMainLoop() {
    const loop = () => {
      this.update(0.016);
      this.render();
      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  update(deltaTime) {
    if (this.stateManager && this.stateManager.currentState === 'PLAYING' && this.monsterManager) {
      const reachedMonsters = this.monsterManager.update(deltaTime, this.stateManager.currentStage);
      if (reachedMonsters > 0) {
        const isDead = this.stateManager.damageBase(reachedMonsters);
        if (isDead) {
          this.stateManager.changeState('GAME_OVER');
          this.showGameOverScreen();
        }
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

  showGameOverScreen() {
    document.getElementById('game-hud').classList.add('hidden');
    document.getElementById('typing-input-bar').classList.add('hidden');

    const gameOverScreen = document.getElementById('screen-gameover');
    if (gameOverScreen) {
      gameOverScreen.classList.remove('hidden');

      const stageEl = document.getElementById('result-stage');
      const scoreEl = document.getElementById('result-score');

      if (stageEl) stageEl.innerText = `STAGE ${this.stateManager ? this.stateManager.currentStage : 1}`;
      if (scoreEl) scoreEl.innerText = this.stateManager ? this.stateManager.score.toLocaleString() : 0;
    }
  }
}

// 초기화
window.gameEngine = new GameEngine();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.gameEngine.init());
} else {
  window.gameEngine.init();
}
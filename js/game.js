/**
 * ============================================================
 * STREAMER WORD DEFENSE — 메인 오케스트레이터 (game.js)
 * ============================================================
 */

class GameEngine {
  constructor() {
    this.isInitialized = false;
    this.animationFrameId = null;

    this.config = {
      playerCount: 1,
      ruleMode: 'vs',       // 'vs' | 'coop'
      inputMode: 'multi',   // 'multi' | 'single'
      difficulty: 'normal', // 'easy' | 'normal' | 'hard' | 'hell'
      playerNames: ['스트리머1', '스트리머2', '스트리머3', '스트리머4', '스트리머5', '스트리머6']
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

    // 1. Canvas DOM 요소 안전 확보
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) {
      console.error('❌ #gameCanvas 요소를 찾을 수 없습니다.');
      return;
    }

    // 2. 핵심 모듈 인스턴스화 (전역 클래스 안전 체크)
    this.stateManager = typeof StateManager !== 'undefined' ? new StateManager() : null;
    this.turretManager = typeof TurretManager !== 'undefined' ? new TurretManager(canvas) : null;
    this.monsterManager = typeof MonsterManager !== 'undefined' ? new MonsterManager(canvas) : null;
    this.inputManager = typeof InputManager !== 'undefined' ? new InputManager() : null;
    this.renderer = typeof CanvasRenderer !== 'undefined' ? new CanvasRenderer(canvas) : null;

    // 3. 렌더러 리사이즈 및 포탑 셋업
    if (this.renderer) {
      this.renderer.resizeCanvas();
      window.addEventListener('resize', () => {
        if (this.renderer) this.renderer.resizeCanvas();
        if (this.turretManager) this.turretManager.repositionTurrets();
      });
    }

    if (this.turretManager) {
      this.turretManager.setupTurrets(this.config.playerCount, this.config.playerNames, canvas);
    }

    // 4. UI 버튼 및 이벤트 바인딩
    this.bindUIEvents();
    this.renderPlayerNicknameInputs();

    // 5. 메인 루프 시작
    this.isInitialized = true;
    this.startMainLoop();

    console.log("🎮 Word Defense Engine Initialized Successfully!");
  }

  /**
   * 🖱️ UI 버튼 및 모달 이벤트 바인딩
   */
  bindUIEvents() {
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
          if (window.refreshAdfitSlot) {
            const adBox = modal.querySelector('.ad-banner-box');
            if (adBox && adBox.id) window.refreshAdfitSlot(adBox.id);
          }
        });
      }
    });

    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetId = e.currentTarget.getAttribute('data-close');
        const targetModal = document.getElementById(targetId);
        if (targetModal) targetModal.classList.add('hidden');
      });
    });

    const btnObs = document.getElementById('btn-obs-toggle');
    if (btnObs) {
      btnObs.addEventListener('click', () => {
        document.body.classList.toggle('obs-overlay');
        btnObs.classList.toggle('active');
      });
    }

    const countBtns = document.querySelectorAll('.btn-count');
    const multiOptions = document.getElementById('section-multi-options');

    countBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        countBtns.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');

        this.config.playerCount = parseInt(e.currentTarget.dataset.count);

        if (multiOptions) {
          if (this.config.playerCount > 1) {
            multiOptions.classList.remove('hidden');
          } else {
            multiOptions.classList.add('hidden');
          }
        }
        this.renderPlayerNicknameInputs();
      });
    });

    const diffBtns = document.querySelectorAll('.btn-diff');
    diffBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        diffBtns.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.config.difficulty = e.currentTarget.dataset.diff;
      });
    });

    const btnStart = document.getElementById('btn-start-game');
    if (btnStart) {
      btnStart.addEventListener('click', () => this.startGame());
    }

    const btnRestart = document.getElementById('btn-restart');
    if (btnRestart) {
      btnRestart.addEventListener('click', () => this.startGame());
    }

    const btnReturnMain = document.getElementById('btn-return-main');
    if (btnReturnMain) {
      btnReturnMain.addEventListener('click', () => this.returnToMain());
    }
  }

  renderPlayerNicknameInputs() {
    const listContainer = document.getElementById('player-settings-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    for (let i = 0; i < this.config.playerCount; i++) {
      const div = document.createElement('div');
      div.className = 'player-nickname-item';
      div.innerHTML = `
        <label>P${i + 1} 닉네임:</label>
        <input type="text" class="input-player-name" data-index="${i}" value="${this.config.playerNames[i]}" placeholder="스트리머${i + 1}" />
      `;
      listContainer.appendChild(div);
    }

    listContainer.querySelectorAll('.input-player-name').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.index);
        this.config.playerNames[idx] = e.target.value.trim() || `스트리머${idx + 1}`;
      });
    });
  }

  setupInputBars() {
    const container = document.getElementById('multi-input-container');
    if (!container) return;

    container.innerHTML = '';
    const isSingleInput = (this.config.playerCount > 1 && this.config.inputMode === 'single') || this.config.playerCount === 1;
    const countToCreate = isSingleInput ? 1 : this.config.playerCount;

    for (let i = 0; i < countToCreate; i++) {
      const pName = isSingleInput ? '전체 공격' : this.config.playerNames[i];
      const div = document.createElement('div');
      div.className = 'typing-input-box';
      div.innerHTML = `
        <span class="player-tag">P${i + 1} (${pName})</span>
        <input type="text" class="game-typing-input" data-player="${i}" placeholder="타깃 단어를 입력하고 Enter!" />
      `;
      container.appendChild(div);
    }

    if (this.inputManager) {
      this.inputManager.bindInputs(container.querySelectorAll('.game-typing-input'), (playerIdx, text) => {
        this.handleTypingSubmit(playerIdx, text);
      });
    }
  }

  startGame() {
    // 1. 화면 전환 처리 (먼저 un-hide 실행)
    const mainScreen = document.getElementById('screen-main');
    const gameOverScreen = document.getElementById('screen-gameover');
    const gameHud = document.getElementById('game-hud');
    const typingBar = document.getElementById('typing-input-bar');

    if (mainScreen) mainScreen.classList.add('hidden');
    if (gameOverScreen) gameOverScreen.classList.add('hidden');
    if (gameHud) gameHud.classList.remove('hidden');
    if (typingBar) typingBar.classList.remove('hidden');

    // 2. 화면 표시 후 입력창 바 동적 생성
    this.setupInputBars();

    const canvas = document.getElementById('gameCanvas');

    if (this.stateManager) this.stateManager.resetGame(this.config);
    if (this.turretManager) this.turretManager.setupTurrets(this.config.playerCount, this.config.playerNames, canvas);
    if (this.monsterManager) this.monsterManager.startStage(this.stateManager ? this.stateManager.currentStage : 1, this.config.difficulty);

    if (this.stateManager) this.stateManager.changeState('PLAYING');

    setTimeout(() => {
      const firstInput = document.querySelector('.game-typing-input');
      if (firstInput) firstInput.focus();
    }, 50);
  }

  returnToMain() {
    document.getElementById('screen-gameover').classList.add('hidden');
    document.getElementById('game-hud').classList.add('hidden');
    document.getElementById('typing-input-bar').classList.add('hidden');
    document.getElementById('screen-main').classList.remove('hidden');

    if (this.monsterManager) this.monsterManager.clear();
    if (this.stateManager) this.stateManager.changeState('MENU');
  }

  handleTypingSubmit(playerIdx, text) {
    if (!this.stateManager || this.stateManager.currentState !== 'PLAYING') return;

    const hitResult = this.monsterManager ? this.monsterManager.checkHit(text) : null;
    if (hitResult && hitResult.success) {
      const { monster, isKilled } = hitResult;

      let firedTurret = null;
      if (this.turretManager) {
        firedTurret = this.turretManager.aimAndFire(monster, playerIdx);
      }

      const turrets = this.turretManager ? this.turretManager.getTurrets() : [];
      const turretPos = firedTurret || turrets[playerIdx] || turrets[0];

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
      const wpmEl = document.getElementById('result-wpm');
      const comboEl = document.getElementById('result-combo');
      const killsEl = document.getElementById('result-kills');

      if (stageEl) stageEl.innerText = `STAGE ${this.stateManager ? this.stateManager.currentStage : 1}`;
      if (scoreEl) scoreEl.innerText = this.stateManager ? this.stateManager.score.toLocaleString() : 0;
      if (wpmEl) wpmEl.innerText = this.stateManager ? (this.stateManager.maxWpm || 0) : 0;
      if (comboEl) comboEl.innerText = this.stateManager ? (this.stateManager.maxCombo || 0) : 0;
      if (killsEl) killsEl.innerText = this.stateManager ? (this.stateManager.totalKills || 0) : 0;

      if (window.refreshAdfitSlot) window.refreshAdfitSlot('ad-container-gameover');
    }
  }
}

// 안전한 전역 초기화
window.gameEngine = new GameEngine();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.gameEngine.init());
} else {
  window.gameEngine.init();
}
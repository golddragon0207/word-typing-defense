/**
 * ============================================================
 * STREAMER WORD DEFENSE — 메인 오케스트레이터 (game.js)
 * ============================================================
 * 모든 서브 모듈(StateManager, TurretManager, MonsterManager, 
 * InputManager, CanvasRenderer)을 통합 제어하고 DOM 이벤트를 바인딩합니다.
 */

class GameEngine {
  constructor() {
    this.isInitialized = false;
    this.animationFrameId = null;

    // 설정 기본값
    this.config = {
      playerCount: 1,
      ruleMode: 'vs',       // 'vs' | 'coop'
      inputMode: 'multi',   // 'multi' | 'single'
      difficulty: 'normal', // 'easy' | 'normal' | 'hard' | 'hell'
      playerNames: ['스트리머1', '스트리머2', '스트리머3', '스트리머4', '스트리머5', '스트리머6']
    };

    // 모듈 인스턴스 (DOM Loaded 후 초기화)
    this.stateManager = null;
    this.turretManager = null;
    this.monsterManager = null;
    this.inputManager = null;
    this.renderer = null;
  }

  /**
   * 🚀 게임 엔진 및 모듈 초기화
   */
  init() {
    if (this.isInitialized) return;

    // 1. 핵심 모듈 인스턴스화
    this.stateManager = new StateManager();
    this.turretManager = new TurretManager();
    this.monsterManager = new MonsterManager();
    this.inputManager = new InputManager();
    this.renderer = new CanvasRenderer();

    // 2. 렌더러 Canvas 바인딩
    const canvas = document.getElementById('gameCanvas');
    const bgCanvas = document.getElementById('bg-canvas');
    if (canvas && bgCanvas) {
      this.renderer.init(canvas, bgCanvas);
    }

    // 3. UI 및 버튼 이벤트 바인딩
    this.bindUIEvents();
    this.renderPlayerNicknameInputs();

    // 4. 메인 루프 시작
    this.isInitialized = true;
    this.startMainLoop();

    console.log("🎮 Word Defense Engine Initialized Successfully!");
  }

  /**
   * 🖱️ 모든 DOM 버튼 및 모달 이벤트 바인딩
   */
  bindUIEvents() {
    // A. 상단바 모달 열기 버튼들
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

    // B. 모달 닫기 버튼 (data-close 속성 지정 요소)
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetId = e.currentTarget.getAttribute('data-close');
        const targetModal = document.getElementById(targetId);
        if (targetModal) targetModal.classList.add('hidden');
      });
    });

    // C. OBS 배경 투명 토글
    const btnObs = document.getElementById('btn-obs-toggle');
    if (btnObs) {
      btnObs.addEventListener('click', () => {
        document.body.classList.toggle('obs-overlay');
        btnObs.classList.toggle('active');
      });
    }

    // D. 인원 수 선택 (1인 ~ 6인)
    const countBtns = document.querySelectorAll('.btn-count');
    const multiOptions = document.getElementById('section-multi-options');

    countBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        countBtns.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');

        this.config.playerCount = parseInt(e.currentTarget.dataset.count);

        // 1인 솔로일 경우 옵션 숨김
        if (multiOptions) {
          if (this.config.playerCount > 1) {
            multiOptions.classList.remove('hidden');
          } else {
            multiOptions.classList.add('hidden');
          }
        }

        // 닉네임 입력 필드 재생성
        this.renderPlayerNicknameInputs();
      });
    });

    // E. 모드 선택 (배틀 / 협동)
    const modeBtns = document.querySelectorAll('.btn-mode');
    modeBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        modeBtns.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.config.ruleMode = e.currentTarget.dataset.rule;
      });
    });

    // F. 난이도 선택
    const diffBtns = document.querySelectorAll('.btn-diff');
    diffBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        diffBtns.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.config.difficulty = e.currentTarget.dataset.diff;
      });
    });

    // G. 🔥 게임 시작 버튼
    const btnStart = document.getElementById('btn-start-game');
    if (btnStart) {
      btnStart.addEventListener('click', () => this.startGame());
    }

    // H. 결과창 버튼 (다시 도전 / 메인으로)
    const btnRestart = document.getElementById('btn-restart');
    if (btnRestart) {
      btnRestart.addEventListener('click', () => this.startGame());
    }

    const btnReturnMain = document.getElementById('btn-return-main');
    if (btnReturnMain) {
      btnReturnMain.addEventListener('click', () => this.returnToMain());
    }
  }

  /**
   * 🎨 플레이어 인원수에 맞춘 닉네임 입력 UI 생성
   */
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

    // 닉네임 변경 시 설정 저장
    listContainer.querySelectorAll('.input-player-name').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.index);
        this.config.playerNames[idx] = e.target.value.trim() || `스트리머${idx + 1}`;
      });
    });
  }

  /**
   * ⌨️ 하단 타자 입력창 생성
   */
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
        <input type="text" class="game-typing-input" data-player="${i}" placeholder="타깃 단어를 입력하고 Enter!" autofocus />
      `;
      container.appendChild(div);
    }

    // InputManager에 입력창 등록
    if (this.inputManager) {
      this.inputManager.bindInputs(container.querySelectorAll('.game-typing-input'), (playerIdx, text) => {
        this.handleTypingSubmit(playerIdx, text);
      });
    }
  }

  /**
   * 🔥 게임 시작 처리
   */
  startGame() {
    // 1. 화면 전환
    document.getElementById('screen-main').classList.add('hidden');
    document.getElementById('screen-gameover').classList.add('hidden');
    document.getElementById('game-hud').classList.remove('hidden');
    document.getElementById('typing-input-bar').classList.remove('hidden');

    // 2. 입력창 세팅
    this.setupInputBars();

    // 3. 서브 모듈 초기화 및 시작
    this.stateManager.resetGame(this.config);
    this.turretManager.setupTurrets(this.config.playerCount, this.config.playerNames);
    this.monsterManager.startStage(this.stateManager.currentStage, this.config.difficulty);

    // 4. 상태 변경
    this.stateManager.changeState('PLAYING');

    // 첫 입력창 포커스
    const firstInput = document.querySelector('.game-typing-input');
    if (firstInput) firstInput.focus();
  }

  /**
   * 🏠 메인 메뉴로 돌아가기
   */
  returnToMain() {
    document.getElementById('screen-gameover').classList.add('hidden');
    document.getElementById('game-hud').classList.add('hidden');
    document.getElementById('typing-input-bar').classList.add('hidden');
    document.getElementById('screen-main').classList.remove('hidden');

    this.stateManager.changeState('MENU');
  }

  /**
   * 💥 단어 입력(Enter) 제출 시 타격 로직
   */
  handleTypingSubmit(playerIdx, text) {
    if (this.stateManager.currentState !== 'PLAYING') return;

    const hitResult = this.monsterManager.checkHit(text);
    if (hitResult.success) {
      // 몬스터 적중 시 처리
      const { monster, isKilled } = hitResult;

      // 포탑 사격 레이저 및 파티클
      const turretPos = this.turretManager.getTurretPosition(playerIdx);
      this.renderer.addLaserEffect(turretPos, monster.position);

      if (isKilled) {
        this.renderer.addExplosionEffect(monster.position);
        this.stateManager.addScore(monster.scoreValue);
        if (typeof playLaserSound === 'function') playLaserSound();
      }
    } else {
      // 오타 경고음
      if (typeof playError === 'function') playError();
    }
  }

  /**
   * 🔄 메인 프레임 루프 (requestAnimationFrame)
   */
  startMainLoop() {
    const loop = (timestamp) => {
      this.update(timestamp);
      this.render();
      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  /**
   * ⚙️ 프레임 업데이트
   */
  update(timestamp) {
    if (this.stateManager && this.stateManager.currentState === 'PLAYING') {
      // 몬스터 위치 이동 및 기지 도달 감지
      const reachedMonsters = this.monsterManager.update();
      if (reachedMonsters > 0) {
        const isDead = this.stateManager.damageBase(reachedMonsters);
        if (isDead) {
          this.stateManager.changeState('GAME_OVER');
          this.showGameOverScreen();
        }
      }
    }
  }

  /**
   * 🎨 프레임 렌더링
   */
  render() {
    if (!this.renderer) return;

    this.renderer.clear();
    if (this.turretManager) this.turretManager.draw(this.renderer.ctx);
    if (this.monsterManager) this.monsterManager.draw(this.renderer.ctx);
    this.renderer.drawEffects();
  }

  /**
   * 💀 게임 오버 화면 출력
   */
  showGameOverScreen() {
    document.getElementById('game-hud').classList.add('hidden');
    document.getElementById('typing-input-bar').classList.add('hidden');

    const gameOverScreen = document.getElementById('screen-gameover');
    if (gameOverScreen) {
      gameOverScreen.classList.remove('hidden');

      // 최종 결과 데이터 바인딩
      document.getElementById('result-stage').innerText = `STAGE ${this.stateManager.currentStage}`;
      document.getElementById('result-score').innerText = this.stateManager.score.toLocaleString();
      document.getElementById('result-wpm').innerText = this.stateManager.maxWpm;
      document.getElementById('result-combo').innerText = this.stateManager.maxCombo;
      document.getElementById('result-kills').innerText = this.stateManager.totalKills;

      // 카카오 애드핏 리프레시
      if (window.refreshAdfitSlot) window.refreshAdfitSlot('ad-container-gameover');
    }
  }
}

// DOM 준비 완료 시 글로벌 실행
window.gameEngine = new GameEngine();
document.addEventListener('DOMContentLoaded', () => {
  window.gameEngine.init();
});
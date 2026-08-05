/**
 * ==========================================
 * Word Typing Defense - Game Orchestrator
 * ==========================================
 * 서브 모듈(State, Turret, Monster, Input, Renderer)을 
 * 초기화하고 메인 루프(requestAnimationFrame)를 관장합니다.
 */

class Game {
  constructor() {
    // 1. Canvas 및 컨텍스트 확보
    this.canvas = document.getElementById('gameCanvas');
    if (!this.canvas) {
      console.error('❌ Canvas 요소를 찾을 수 없습니다 (#gameCanvas).');
      return;
    }

    // 2. 핵심 서브 모듈 인스턴스화
    this.stateManager = new StateManager();
    this.turretManager = new TurretManager(this.canvas);
    this.monsterManager = new MonsterManager(this.canvas);
    this.inputManager = new InputManager();
    this.renderer = new CanvasRenderer(this.canvas);

    // 3. 메인 루프 제어 변수
    this.lastTime = 0;
    this.animationFrameId = null;

    // 4. 초기화 실행
    this.init();
  }

  /**
   * 게임 전체 시스템 초기화 및 이벤트 연결
   */
  init() {
    console.log('🎮 Word Typing Defense 게임 엔진 초기화 중...');

    // 렌더러 Canvas 스케일링 설정 (HiDPI / Retina 대응)
    this.renderer.resizeCanvas();
    window.addEventListener('resize', () => this.handleResize());

    // 각 모듈 간 상호작용 및 바인딩
    this.bindEvents();

    // 메인 프레임 루프 가동
    this.startLoop();
  }

  /**
   * 모듈 간 이벤트 및 입력 콜백 연결
   */
  bindEvents() {
    // 예: 입력창에서 타격(Hit) 이벤트 발생 시 포탑 조준 및 몬스터 피격 처리 콜백
    this.inputManager.onTargetHit = (hitData) => {
      if (!this.stateManager.isPlaying()) return;

      // 1. 입력된 제시어와 일치하는 몬스터 타깃 탐색
      const targetMonster = this.monsterManager.findTargetMonster(hitData.word);

      if (targetMonster) {
        // 2. 가장 가까운 포탑 조준 및 사격 요청
        const activeTurret = this.turretManager.aimAndFire(
          targetMonster,
          hitData.playerId
        );

        // 3. 몬스터 피격/제거 처리
        this.monsterManager.destroyMonster(targetMonster.id);

        // 4. 점수 및 타수(CPM/WPM) 업데이트
        this.stateManager.addScore(targetMonster.scoreValue);
        this.stateManager.updateTypingStats(hitData.stats);

        // 5. 사격 이펙트 및 파티클 렌더링 요청
        this.renderer.addLaserEffect(activeTurret, targetMonster);
        this.renderer.addExplosionEffect(targetMonster.x, targetMonster.y);
      } else {
        // 오타 발생 시 효과음 처리
        if (window.audioManager) {
          window.audioManager.playError();
        }
      }
    };

    // 예: 상태 변경 시 모듈별 리셋 및 동작 제어
    this.stateManager.onStateChange = (newState) => {
      console.log(`📌 Game State Changed: ${newState}`);

      if (newState === 'READY' || newState === 'PLAYING') {
        this.monsterManager.reset();
        this.turretManager.setupTurrets(this.stateManager.playerCount);
      }
    };
  }

  /**
   * 창 크기 변경 시 렌더러 및 포탑 위치 재계산
   */
  handleResize() {
    this.renderer.resizeCanvas();
    this.turretManager.repositionTurrets();
  }

  /**
   * 메인 게임 루프 시작
   */
  startLoop() {
    this.lastTime = performance.now();
    const loop = (currentTime) => {
      const deltaTime = (currentTime - this.lastTime) / 1000; // 초 단위
      this.lastTime = currentTime;

      // 프레임 업데이트 및 렌더링 하달
      this.update(deltaTime);
      this.render();

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  /**
   * 루프 정지
   */
  stopLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * 매 프레임 데이터 및 물리 업데이트 하달
   */
  update(deltaTime) {
    // PLAYING 상태일 때만 몬스터 낙하 및 물리 업데이트 실행
    if (this.stateManager.isPlaying()) {
      // 몬스터 스폰 및 이동 (Max Cap 15마리 제어 적용)
      this.monsterManager.update(deltaTime, this.stateManager.currentStage);

      // 몬스터 바닥 도달 판정 (HP 차감)
      const passedCount = this.monsterManager.checkBottomCollision();
      if (passedCount > 0) {
        this.stateManager.decreaseHP(passedCount);
      }
    }

    // 포탑 조준 회전 및 시각 이펙트 애니메이션 업데이트
    this.turretManager.update(deltaTime);
    this.renderer.updateEffects(deltaTime);
  }

  /**
   * 매 프레임 화면 Draw 하달
   */
  render() {
    // 1. Canvas 화면 초기화
    this.renderer.clear();

    // 2. 포탑 렌더링
    const turrets = this.turretManager.getTurrets();
    this.renderer.drawTurrets(turrets);

    // 3. 2단 몬스터 렌더링 (상단: 시청자 닉네임 Pill Tag / 하단: 제시어 Target Box)
    const monsters = this.monsterManager.getMonsters();
    this.renderer.drawMonsters(monsters);

    // 4. 파티클, 레이저 빔 및 UI 오버레이 연출
    this.renderer.drawEffects();
    this.renderer.drawUIOverlay(this.stateManager.getGameStateData());
  }
}

// DOM 로드 완료 시 메인 오케스트레이터 가동
document.addEventListener('DOMContentLoaded', () => {
  window.gameEngine = new Game();
});
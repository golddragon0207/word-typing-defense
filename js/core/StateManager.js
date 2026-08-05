/**
 * StateManager.js
 * 게임 상태, 점수, 체력(HP) 관리 및 화면 HUD 실시간 연동
 */
class StateManager {
    constructor(initialState = 'MENU') {
        this.currentState = initialState;
        this.currentStage = 1;
        this.score = 0;
        this.hp = 100;
        this.maxHp = 100;
        this.maxWpm = 0;
        this.maxCombo = 0;
        this.totalKills = 0;
        this.config = null;
    }

    resetGame(config = {}) {
        this.config = config;
        this.currentStage = 1;
        this.score = 0;
        this.hp = 100;
        this.maxHp = 100;
        this.maxWpm = 0;
        this.maxCombo = 0;
        this.totalKills = 0;
        this.currentState = 'READY';

        this.updateHUDUI();
    }

    changeState(newState) {
        if (this.currentState === newState) return;
        this.currentState = newState;
    }

    addScore(amount = 100) {
        this.score += amount;
        this.totalKills += 1;
        this.updateHUDUI();
    }

    /**
     * 바닥 피격 시 체력 차감 및 화면 HUD 연동
     */
    damageBase(reachedCount = 1) {
        const damage = reachedCount * 10;
        this.hp = Math.max(0, this.hp - damage);

        // UI 실시간 차감
        this.updateHUDUI();

        return this.hp <= 0;
    }

    /**
     * 상단 HUD 체력바, 체력%, 점수, 스테이지 실시간 갱신
     */
    updateHUDUI() {
        const hpPercent = Math.max(0, Math.round((this.hp / this.maxHp) * 100));

        // 1. 체력 텍스트 탐색 후 갱신
        const hpTextEl = document.getElementById('player-hp') ||
            document.getElementById('hud-hp') ||
            document.querySelector('.hp-val') ||
            document.querySelector('.hp-text');
        if (hpTextEl) {
            hpTextEl.innerText = `${hpPercent}%`;
        }

        // 2. 체력바 그래픽 탐색 후 길이 차감
        const hpBarEl = document.getElementById('hp-bar') ||
            document.getElementById('hp-bar-fill') ||
            document.querySelector('.hp-bar-fill') ||
            document.querySelector('.bar-fill');
        if (hpBarEl) {
            hpBarEl.style.width = `${hpPercent}%`;

            // 체력별 색상 변경
            if (hpPercent <= 30) {
                hpBarEl.style.backgroundColor = '#ff0055';
            } else if (hpPercent <= 60) {
                hpBarEl.style.backgroundColor = '#ffaa00';
            } else {
                hpBarEl.style.backgroundColor = '#00ff66';
            }
        }

        // 3. 점수 갱신
        const scoreEl = document.getElementById('game-score') || document.getElementById('hud-score');
        if (scoreEl) scoreEl.innerText = this.score.toLocaleString();

        // 4. 스테이지 갱신
        const stageEl = document.getElementById('game-stage') || document.getElementById('hud-stage');
        if (stageEl) stageEl.innerText = `STAGE ${this.currentStage}`;
    }
}

window.StateManager = StateManager;
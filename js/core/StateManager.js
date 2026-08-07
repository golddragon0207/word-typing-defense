/**
 * StateManager.js
 * 게임 상태, 점수, 체력(HP), 콤보, CPM/WPM 관리,
 * 화면 HUD 실시간 연동 및 localStorage 기반 TOP 5 명예의 전당 관리
 */
const WTD_LEADERBOARD_STORAGE_KEY = 'wtd_leaderboard_top5';

class StateManager {
    constructor(initialState = 'MENU') {
        this.currentState = initialState;
        this.currentStage = 1;
        this.score = 0;
        this.hp = 100;
        this.maxHp = 100;

        this.combo = 0;
        this.maxCombo = 0;

        this.totalStrokes = 0;   // 한글 자모 획수 기반 누적 타수
        this.startTime = null;   // 플레이 시작 시각 (performance.now())
        this.wpm = 0;
        this.maxWpm = 0;

        this.totalKills = 0;
        this.config = null;
        this.damagePerLeak = 10; // 몬스터 1마리가 기지에 도달했을 때 입는 피해 (난이도별로 resetGame에서 재설정)

        // 🔥 피버 모드 (콤보 누적 시 점수 2배 보너스)
        this.fever = 0;            // 0~100
        this.feverActive = false;
        this.feverTimer = null;
        this.onFeverStart = null;  // game.js가 주입하는 콜백 () => void (사운드/토스트 연출용)
        this.onFeverEnd = null;
    }

    resetGame(config = {}) {
        this.config = config;
        this.currentStage = 1;
        this.score = 0;

        // 🎮 난이도별 최대 체력 / 피격 데미지 (config.js CONFIG.DIFFICULTY)
        const diffCfg = (typeof getDifficultyConfig === 'function')
            ? getDifficultyConfig(config.difficulty)
            : { maxHp: 100, damagePerLeak: 10 };
        this.maxHp = diffCfg.maxHp;
        this.hp = diffCfg.maxHp;
        this.damagePerLeak = diffCfg.damagePerLeak;

        this.combo = 0;
        this.maxCombo = 0;

        this.totalStrokes = 0;
        this.startTime = performance.now();
        this.wpm = 0;
        this.maxWpm = 0;

        this.totalKills = 0;
        this.currentState = 'READY';

        this.fever = 0;
        this.feverActive = false;
        if (this.feverTimer) clearTimeout(this.feverTimer);
        this.feverTimer = null;

        this.updateHUDUI();
    }

    changeState(newState) {
        if (this.currentState === newState) return;
        this.currentState = newState;
    }

    /**
     * ⌨️ [계획서 v2.0 필수] 한글 자모 획수 기반 정밀 CPM/WPM 산출
     * 몬스터를 명중시킬 때마다 호출: 점수/콤보/타수를 한 번에 갱신
     * @param {string} word - 명중한 제시어 원문
     * @param {number} scoreValue - 몬스터가 지급하는 점수
     */
    registerHit(word, scoreValue = 100) {
        // 1. 점수 & 처치 수 (피버 모드 중이면 2배 보너스)
        const finalScore = this.feverActive ? scoreValue * 2 : scoreValue;
        this.score += finalScore;
        this.totalKills += 1;

        // 2. 콤보
        this.combo += 1;
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;

        // 2-1. 피버 게이지 누적
        this.fever = Math.min(100, this.fever + 12);
        if (this.fever >= 100 && !this.feverActive) {
            this.activateFever();
        }

        // 3. 한글 자모 획수 기반 타수 누적 및 WPM 갱신
        const strokes = (typeof wordPacks !== 'undefined' && word)
            ? wordPacks.getHangulStrokeCount(word)
            : (word ? word.length : 0);
        this.totalStrokes += strokes;

        if (this.startTime) {
            const elapsedMinutes = Math.max((performance.now() - this.startTime) / 60000, 1 / 60);
            this.wpm = Math.round(this.totalStrokes / elapsedMinutes);
            if (this.wpm > this.maxWpm) this.maxWpm = this.wpm;
        }

        this.updateHUDUI();
    }

    /**
     * ❌ 오타/미스매치 시 콤보 초기화 및 피버 게이지 감소
     */
    registerMiss() {
        this.combo = 0;
        this.fever = Math.max(0, this.fever - 20);
        this.updateHUDUI();
    }

    /**
     * 🔥 피버 모드 발동 (6초간 점수 2배, 이후 게이지 초기화)
     */
    activateFever() {
        this.feverActive = true;
        this.fever = 100;

        if (typeof this.onFeverStart === 'function') this.onFeverStart();

        if (this.feverTimer) clearTimeout(this.feverTimer);
        this.feverTimer = setTimeout(() => {
            this.feverActive = false;
            this.fever = 0;
            this.feverTimer = null;
            if (typeof this.onFeverEnd === 'function') this.onFeverEnd();
            this.updateHUDUI();
        }, 6000);
    }

    /**
     * 바닥 피격 시 체력 차감 및 화면 HUD 연동
     */
    damageBase(reachedCount = 1) {
        const damage = reachedCount * (this.damagePerLeak || 10);
        this.hp = Math.max(0, this.hp - damage);
        this.combo = 0;

        // UI 실시간 차감
        this.updateHUDUI();

        return this.hp <= 0;
    }

    /**
     * 상단 HUD 체력바, 체력%, 점수, 스테이지, 콤보, WPM 실시간 갱신
     */
    updateHUDUI() {
        const hpPercent = Math.max(0, Math.round((this.hp / this.maxHp) * 100));

        // 1. 체력 텍스트 탐색 후 갱신
        const hpTextEl = document.getElementById('hud-hp-text') ||
            document.getElementById('player-hp') ||
            document.querySelector('.hp-text');
        if (hpTextEl) {
            hpTextEl.innerText = `${hpPercent}%`;
        }

        // 2. 체력바 그래픽 탐색 후 길이 차감
        const hpBarEl = document.getElementById('hud-hp-fill') ||
            document.getElementById('hp-bar-fill') ||
            document.querySelector('.hp-bar-fill');
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
        const scoreEl = document.getElementById('hud-score');
        if (scoreEl) scoreEl.innerText = this.score.toLocaleString();

        // 4. 스테이지 갱신
        const stageEl = document.getElementById('hud-stage');
        if (stageEl) stageEl.innerText = `STAGE ${this.currentStage}`;

        // 5. 콤보 갱신
        const comboEl = document.getElementById('hud-combo');
        if (comboEl) comboEl.innerText = this.combo;

        // 6. CPM/WPM 갱신
        const wpmEl = document.getElementById('hud-wpm');
        if (wpmEl) wpmEl.innerText = this.wpm;

        // 7. 피버 게이지 갱신
        const feverBarEl = document.getElementById('hud-fever-fill');
        if (feverBarEl) {
            feverBarEl.style.width = `${this.fever}%`;
            feverBarEl.classList.toggle('fever-ready', this.feverActive);
        }
        const feverCardEl = document.querySelector('.fever-card');
        if (feverCardEl) feverCardEl.classList.toggle('fever-active', this.feverActive);
    }

    /**
     * 👑 최종 결과 등급(Rank) 환산 메서드 (0점 판정 추가)
     */
    calculateRankGrade() {
        if (!this.score || this.score <= 0 || this.totalKills <= 0) {
            return 'D';
        }

        const finalScore = this.score;

        if (finalScore >= 10000) {
            return 'SSS';
        } else if (finalScore >= 7000) {
            return 'SS';
        } else if (finalScore >= 5000) {
            return 'S';
        } else if (finalScore >= 3000) {
            return 'A';
        } else if (finalScore >= 1500) {
            return 'B';
        } else if (finalScore >= 500) {
            return 'C';
        } else {
            return 'D';
        }
    }

    /**
     * 🏆 localStorage에 저장된 전체 원본 목록 조회 (난이도별로 이미 상위 5개씩만 유지됨)
     * @returns {Array<Object>}
     */
    getAllScores() {
        try {
            const raw = localStorage.getItem(WTD_LEADERBOARD_STORAGE_KEY);
            const list = raw ? JSON.parse(raw) : [];
            return Array.isArray(list) ? list : [];
        } catch (e) {
            console.warn('[StateManager] 명예의 전당 로드 실패:', e);
            return [];
        }
    }

    /**
     * 🏆 localStorage 기반 난이도별 TOP 5 명예의 전당 조회
     * @param {string|null} difficulty - 'easy'|'normal'|'hard'|'hell' (없으면 전체 원본 반환, 하위호환용)
     * @returns {Array<Object>}
     */
    getTopScores(difficulty = null) {
        const all = this.getAllScores();
        if (!difficulty) return all;

        return all
            .filter(e => (e.difficulty || 'normal') === difficulty)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);
    }

    /**
     * 🏆 현재 전적을 localStorage에 저장 — 난이도별로 각각 상위 5개씩 유지
     * (예: easy 5개 + normal 5개 + hard 5개 + hell 5개 = 최대 20개 저장)
     * @param {string} nickname
     * @returns {{isNewRecord: boolean, list: Array<Object>}}
     */
    saveScore(nickname = '스트리머') {
        const difficulty = (this.config && this.config.difficulty) || 'normal';

        const entry = {
            nickname: (nickname || '스트리머').slice(0, 20),
            score: this.score,
            stage: this.currentStage,
            wpm: this.maxWpm,
            combo: this.maxCombo,
            grade: this.calculateRankGrade(),
            date: new Date().toISOString().slice(0, 10),
            difficulty
        };

        const all = this.getAllScores();
        all.push(entry);

        // 난이도별로 그룹핑해서 각각 상위 5개씩만 남긴다
        const grouped = {};
        all.forEach(e => {
            const d = e.difficulty || 'normal';
            if (!grouped[d]) grouped[d] = [];
            grouped[d].push(e);
        });

        let finalList = [];
        Object.keys(grouped).forEach(d => {
            grouped[d].sort((a, b) => b.score - a.score);
            finalList = finalList.concat(grouped[d].slice(0, 5));
        });

        const isNewRecord = this.score > 0 &&
            (grouped[difficulty] || []).slice(0, 5).indexOf(entry) !== -1;

        try {
            localStorage.setItem(WTD_LEADERBOARD_STORAGE_KEY, JSON.stringify(finalList));
        } catch (e) {
            console.warn('[StateManager] 명예의 전당 저장 실패:', e);
        }

        return { isNewRecord, list: this.getTopScores(difficulty) };
    }

    /**
     * 🗑️ 명예의 전당 전적 초기화
     */
    clearScores() {
        try {
            localStorage.removeItem(WTD_LEADERBOARD_STORAGE_KEY);
        } catch (e) {
            console.warn('[StateManager] 명예의 전당 초기화 실패:', e);
        }
    }
}

window.StateManager = StateManager;

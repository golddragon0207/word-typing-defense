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

        this.totalStrokes = 0;   // 실제 키 입력(2벌식) 누적 타수 (CPM/WPM 표시용)
        this.startTime = null;   // 플레이 시작 시각 (performance.now())
        this.wpm = 0;
        this.maxWpm = 0;

        this.totalKills = 0;
        this.config = null;
        this.damagePerLeak = 10; // 몬스터 1마리가 기지에 도달했을 때 입는 피해 (난이도별로 resetGame에서 재설정)

        // 🔥 피버 모드 (콤보 누적으로 게이지 만땅 시 화면 클리어 + 보너스 점수·소량 회복 버스트)
        this.fever = 0;            // 0~100
        this.feverActive = false;
        this.feverTimer = null;
        this.onFeverStart = null;  // game.js가 주입하는 콜백 () => void (사운드/토스트 연출용)

        this.onStateChange = null; // game.js가 주입하는 콜백 (newState) => void (상단바 버튼 잠금 등)
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
        if (typeof this.onStateChange === 'function') this.onStateChange(newState);
    }

    /**
     * ⌨️ [계획서 v2.0 필수] 한글 자모 획수 기반 정밀 CPM/WPM 산출
     * 몬스터를 명중시킬 때마다 호출: 점수/콤보/타수를 한 번에 갱신
     * @param {string} word - 명중한 제시어 원문
     * @param {number} scoreValue - 몬스터가 지급하는 점수
     */
    registerHit(word, scoreValue = 100, countKill = true) {
        // 1. 점수 & 처치 수
        //    countKill=false면 점수·콤보·타수만 반영하고 처치 수는 늘리지 않는다
        //    (보스 다중 HP 피격: 한 마리를 여러 번 격파해도 처치 1로 집계하기 위함)
        this.score += scoreValue;
        if (countKill) this.totalKills += 1;

        // 2. 콤보
        this.combo += 1;
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;

        // 2-1. 피버 게이지 누적 → 만땅이면 피버 버스트(화면 클리어 + 보너스) 발동
        //    ⚠️ 보스 스테이지(5의 배수)에서는 게이지를 채우지 않는다.
        //    보스전엔 정리할 잡몹이 없어 버스트가 의미 없이 터지던 문제 방지(게이지는 그대로 다음 스테이지로 이월).
        const isBossStage = (this.currentStage % 5) === 0;
        if (!isBossStage) {
            this.fever = Math.min(100, this.fever + 12);
            if (this.fever >= 100 && !this.feverActive) {
                this.triggerFeverBurst();
            }
        }

        // 3. 실제 키 입력 타수(2벌식) 누적 및 WPM 갱신 (표시용 — 점수는 획수 기반과 별개)
        const strokes = (typeof wordPacks !== 'undefined' && word)
            ? wordPacks.getKeystrokeCount(word)
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
        // ⚠️ 보스 스테이지(5의 배수)에서는 피버 게이지를 건드리지 않는다(채우지도·깎지도 않음).
        //    보스전엔 게이지를 채울 수 없으니(registerHit도 스킵), 오타로 깎이기만 하면 억울하므로 완전 동결.
        const isBossStage = (this.currentStage % 5) === 0;
        if (!isBossStage) {
            this.fever = Math.max(0, this.fever - 20);
        }
        this.updateHUDUI();
    }

    /**
     * 🔥 피버 게이지 만땅 → 피버 버스트 발동.
     *   (기존 '6초간 점수 2배' 방식 대체) 화면의 일반 몬스터를 한 번에 정리하고
     *   보너스 점수 + 소량 회복을 주는 실제 처리는 game.js의 onFeverStart 콜백(triggerFeverBurst)이 담당한다.
     *   여기서는 게이지 리셋 + 짧은 HUD 플래시 + 콜백 발동만 담당(지속형 2배 효과 없음).
     */
    triggerFeverBurst() {
        this.fever = 0;

        // 짧은 시각 플래시(HUD FEVER 카드 번쩍) — 약 0.9초 후 자동 해제
        this.feverActive = true;
        if (this.feverTimer) clearTimeout(this.feverTimer);
        this.feverTimer = setTimeout(() => {
            this.feverActive = false;
            this.feverTimer = null;
            this.updateHUDUI();
        }, 900);

        if (typeof this.onFeverStart === 'function') this.onFeverStart();
        this.updateHUDUI();
    }

    /**
     * 🔥 피버 버스트 보너스 점수 반영 (화면 클리어 보상). 처치 수/콤보는 건드리지 않는다.
     * @param {number} points - 더할 보너스 점수
     */
    addFeverBonus(points = 0) {
        this.score += Math.max(0, Math.round(points));
        this.updateHUDUI();
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
     * 🐲 보스 차지 공격 등 정액(고정 수치) 기지 피해. 콤보를 끊고 HP를 직접 차감한다.
     * @param {number} amount - 차감할 체력
     * @returns {boolean} 사망 여부
     */
    damageBaseFlat(amount = 0) {
        this.hp = Math.max(0, this.hp - Math.max(0, amount));
        this.combo = 0;
        this.updateHUDUI();
        return this.hp <= 0;
    }

    /**
     * 💚 기지 체력 회복 (보스 처치 보상 등). 최대 체력을 넘지 않는다.
     * @param {number} amount - 회복량
     * @returns {number} 실제로 회복된 체력(상한 초과분 제외)
     */
    healBase(amount = 0) {
        const before = this.hp;
        this.hp = Math.min(this.maxHp, this.hp + Math.max(0, amount));
        this.updateHUDUI();
        return this.hp - before;
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
        if (feverCardEl) {
            feverCardEl.classList.toggle('fever-active', this.feverActive);
            // 🔒 보스 스테이지(5의 배수)에서는 피버 게이지가 동결(충전·감소 정지)된다.
            //    막대가 멈춰 있는 게 버그처럼 보이지 않도록 카드에 잠금 상태를 표시(CSS: 회색+🔒).
            const bossStageLock = (this.currentStage % 5) === 0;
            feverCardEl.classList.toggle('fever-locked', bossStageLock);
        }
    }

    /**
     * 👑 최종 결과 등급(Rank) 환산 — "도달 스테이지" 기준.
     *   게임의 목표(얼마나 오래 방어했나)·명예의 전당 순위와 동일한 잣대로 통일.
     *   임계 스테이지는 CONFIG.SPAWN_CURVE(_requiredKpm)에서 요구 타자속도를 역산해
     *   깔끔한 타/분 구간(200·300·400·500·650·800타)에 맞춰 정렬한다.
     *     requiredKpm = 100 + (stage-1)*10.5  (s68 소프트 캡 800타)
     *     → C=s11≈205 · B=s20≈300 · A=s30≈405 · S=s39≈500 · SS=s53≈650 · SSS=s68≈800
     *   0점/0처치(사실상 미플레이)는 항상 D.
     */
    calculateRankGrade() {
        if (!this.score || this.score <= 0 || this.totalKills <= 0) {
            return 'D';
        }

        const stage = this.currentStage || 1;

        if (stage >= 68) {
            return 'SSS';   // 월드클래스 (≈800타+, 소프트 캡 도달점)
        } else if (stage >= 53) {
            return 'SS';    // 고수 (≈650타)
        } else if (stage >= 39) {
            return 'S';     // 상급 (≈500타)
        } else if (stage >= 30) {
            return 'A';     // 숙련 (≈400타)
        } else if (stage >= 20) {
            return 'B';     // 평균 (≈300타)
        } else if (stage >= 11) {
            return 'C';     // 초급 (≈200타)
        } else {
            return 'D';     // 입문 (<200타)
        }
    }

    /**
     * 🏆 localStorage에 저장된 전체 원본 목록 조회 (상위 STORE_MAX개만 보관됨)
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
     * 🏆 localStorage 기반 단일 통합 TOP 명예의 전당 조회
     *    '최고 도달 스테이지 내림차순, 동점이면 점수 내림차순'으로 정렬해 상위 limit개 반환.
     *    (난이도 구분 없음 — 옛 난이도별 데이터도 이 기준으로 자동 재정렬되어 함께 랭크됨)
     * @param {number} limit - 반환 개수 (기본 5)
     * @returns {Array<Object>}
     */
    getTopScores(limit = 5) {
        return this.getAllScores()
            .slice()
            .sort((a, b) => (b.stage || 1) - (a.stage || 1) || (b.score || 0) - (a.score || 0))
            .slice(0, limit);
    }

    /**
     * ⏱️ 플레이 시간(초 단위) 계산
     * @returns {number}
     */
    getPlayTimeSec() {
        if (!this.startTime) return 0;
        return Math.max(0, Math.floor((performance.now() - this.startTime) / 1000));
    }

    /**
     * ⏱️ 플레이 시간 포맷팅 ("2분 35초" 또는 "45초")
     * @returns {string}
     */
    getFormattedPlayTime() {
        const sec = this.getPlayTimeSec();
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        if (m > 0) {
            return `${m}분 ${s}초`;
        }
        return `${s}초`;
    }

    /**
     * 🏆 현재 전적을 localStorage에 저장 — '최고 도달 스테이지' 기준 단일 통합 랭킹.
     *    스테이지 내림차순(동점이면 점수 내림차순)으로 정렬해 상위 STORE_MAX개만 보관한다.
     * @param {string} nickname
     * @returns {{isNewRecord: boolean, list: Array<Object>}}
     */
    saveScore(nickname = '스트리머') {
        const STORE_MAX = 20;   // 보관 개수(표시는 상위 DISPLAY_TOP개). 재랭킹 여유분 포함.
        const DISPLAY_TOP = 5;

        const entry = {
            nickname: (nickname || '스트리머').slice(0, 20),
            score: this.score,
            stage: this.currentStage,
            wpm: this.maxWpm,
            combo: this.maxCombo,
            grade: this.calculateRankGrade(),
            playTimeSec: this.getPlayTimeSec(),
            playTimeStr: this.getFormattedPlayTime(),
            date: new Date().toISOString().slice(0, 10)
        };

        const all = this.getAllScores();
        all.push(entry);
        all.sort((a, b) => (b.stage || 1) - (a.stage || 1) || (b.score || 0) - (a.score || 0));
        const finalList = all.slice(0, STORE_MAX);

        // 신기록: 이번 판이 유효(점수>0 또는 스테이지>1)하고 상위 DISPLAY_TOP 안에 들었는지
        const isNewRecord = (this.score > 0 || this.currentStage > 1) &&
            finalList.slice(0, DISPLAY_TOP).indexOf(entry) !== -1;

        try {
            localStorage.setItem(WTD_LEADERBOARD_STORAGE_KEY, JSON.stringify(finalList));
        } catch (e) {
            console.warn('[StateManager] 명예의 전당 저장 실패:', e);
        }

        return { isNewRecord, list: this.getTopScores(DISPLAY_TOP) };
    }
}

window.StateManager = StateManager;

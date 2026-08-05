/**
 * ==========================================
 * Word Typing Defense - StateManager
 * ==========================================
 * 게임 상태(State Machine), 점수, 체력(HP), 무한 스테이지 진행,
 * 랭크 계산(SSS~D) 및 LocalStorage 전적 저장(TOP 5)을 전담합니다.
 */

class StateManager {
    constructor() {
        // 1. 게임 상태 정의 (State Machine)
        this.STATES = {
            MENU: 'MENU',           // 메인 타이틀 화면
            SETTING: 'SETTING',     // 인원, 난이도 및 닉네임 설정
            READY: 'READY',         // 카운트다운 및 시작 준비
            PLAYING: 'PLAYING',     // 실제 게임 진행 중
            PAUSE: 'PAUSE',         // 일시 정지
            GAMEOVER: 'GAMEOVER',   // 체력 고갈 및 패배 연출
            RESULT: 'RESULT'        // 최종 성과 등급 및 리더보드 출력
        };

        this.currentState = this.STATES.MENU;

        // 2. 게임 핵심 변수
        this.score = 0;
        this.currentStage = 1;
        this.maxHp = 10;
        this.hp = this.maxHp;
        this.playerCount = 1;       // 참여 인원 (1~6명)
        this.difficulty = 'Normal'; // Easy, Normal, Hard, Hell
        this.gameMode = 'SOLO';     // SOLO, VERSUS, COOP

        // 3. 타수 및 통계 데이터 (CPM/WPM)
        this.typingStats = {
            totalKeystrokes: 0,
            correctKeystrokes: 0,
            cpm: 0,
            wpm: 0,
            accuracy: 100
        };

        // 4. 이벤트 바인딩 콜백 (game.js 오케스트레이터 전달용)
        this.onStateChange = null;
        this.onHpChange = null;
        this.onScoreChange = null;
        this.onStageUp = null;
    }

    /**
     * 상태 변경 및 UI/이벤트 바인딩 실행
     * @param {string} newState 
     */
    setState(newState) {
        if (!this.STATES[newState]) {
            console.error(`❌ 존재하지 않는 게임 상태입니다: ${newState}`);
            return;
        }

        console.log(`🔄 State Transition: ${this.currentState} ➔ ${newState}`);
        this.currentState = newState;

        // 상태 변경 시 콜백 실행
        if (typeof this.onStateChange === 'function') {
            this.onStateChange(this.currentState);
        }
    }

    /**
     * 현재 플레이 진행 상태인지 확인
     */
    isPlaying() {
        return this.currentState === this.STATES.PLAYING;
    }

    /**
     * 새로운 게임 시작 시 데이터 초기화
     * @param {Object} config - { playerCount, difficulty, gameMode }
     */
    resetGame(config = {}) {
        this.score = 0;
        this.currentStage = 1;
        this.maxHp = config.maxHp || 10;
        this.hp = this.maxHp;
        this.playerCount = config.playerCount || 1;
        this.difficulty = config.difficulty || 'Normal';
        this.gameMode = config.gameMode || (this.playerCount === 1 ? 'SOLO' : 'COOP');

        // 타수 통계 리셋
        this.typingStats = {
            totalKeystrokes: 0,
            correctKeystrokes: 0,
            cpm: 0,
            wpm: 0,
            accuracy: 100
        };

        if (typeof this.onHpChange === 'function') this.onHpChange(this.hp, this.maxHp);
        if (typeof this.onScoreChange === 'function') this.onScoreChange(this.score);
    }

    /**
     * 점수 추가
     * @param {number} points 
     */
    addScore(points) {
        const difficultyMultiplier = { Easy: 1.0, Normal: 1.2, Hard: 1.5, Hell: 2.0 };
        const multiplier = difficultyMultiplier[this.difficulty] || 1.0;

        const finalPoints = Math.round(points * multiplier);
        this.score += finalPoints;

        if (typeof this.onScoreChange === 'function') {
            this.onScoreChange(this.score);
        }
    }

    /**
     * 체력 감소를 처리하고, 0 이하일 경우 GAME OVER로 전환
     * @param {number} amount 
     */
    decreaseHP(amount = 1) {
        this.hp = Math.max(0, this.hp - amount);

        if (typeof this.onHpChange === 'function') {
            this.onHpChange(this.hp, this.maxHp);
        }

        // 체력 고갈 시 게임 오버 상태 진입
        if (this.hp <= 0 && this.currentState === this.STATES.PLAYING) {
            this.setState(this.STATES.GAMEOVER);
        }
    }

    /**
     * Stage 진입 및 업데이트
     */
    nextStage() {
        this.currentStage += 1;

        if (typeof this.onStageUp === 'function') {
            this.onStageUp(this.currentStage);
        }
    }

    /**
     * 실시간 타수(CPM/WPM) 통계 업데이트
     * @param {Object} stats 
     */
    updateTypingStats(stats) {
        if (!stats) return;
        this.typingStats = { ...this.typingStats, ...stats };
    }

    /**
     * 종합 점수, 스테이지, 난이도 기반 최종 랭크 등급(SSS ~ D) 계산
     * @returns {string} SSS, SS, S, A, B, C, D
     */
    calculateRankGrade() {
        const baseScore = this.score;
        const stageFactor = this.currentStage * 500;
        const totalEvalScore = baseScore + stageFactor;

        if (totalEvalScore >= 15000) return 'SSS';
        if (totalEvalScore >= 11000) return 'SS';
        if (totalEvalScore >= 8000) return 'S';
        if (totalEvalScore >= 5000) return 'A';
        if (totalEvalScore >= 3000) return 'B';
        if (totalEvalScore >= 1500) return 'C';
        return 'D';
    }

    /**
     * 브라우저 localStorage에 TOP 5 명예의 전당 저장
     * @param {string} playerNames 
     * @returns {boolean} New Record 여부
     */
    saveLeaderboardRecord(playerNames = 'Player') {
        const STORAGE_KEY = 'typing_defense_leaderboard';
        const rank = this.calculateRankGrade();

        const newRecord = {
            id: Date.now(),
            names: playerNames,
            score: this.score,
            stage: this.currentStage,
            rank: rank,
            difficulty: this.difficulty,
            date: new Date().toISOString().split('T')[0]
        };

        // 로컬스토리지에서 기존 전적 불러오기
        let leaderboard = [];
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) leaderboard = JSON.parse(saved);
        } catch (e) {
            console.error('Leaderboard load error:', e);
        }

        // 새 기록 추가 후 점수 내림차순 정렬
        leaderboard.push(newRecord);
        leaderboard.sort((a, b) => b.score - a.score);

        // TOP 5까지만 유지
        const top5 = leaderboard.slice(0, 5);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(top5));

        // 저장된 TOP 5 안에 이번 기록이 포함되었는지 확인
        return top5.some(item => item.id === newRecord.id);
    }

    /**
     * TOP 5 명예의 전당 전적 불러오기
     */
    getLeaderboard() {
        const STORAGE_KEY = 'typing_defense_leaderboard';
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    }

    /**
     * 렌더러/UI 전달용 현재 전체 게임 상태 데이터 패키징
     */
    getGameStateData() {
        return {
            state: this.currentState,
            score: this.score,
            stage: this.currentStage,
            hp: this.hp,
            maxHp: this.maxHp,
            playerCount: this.playerCount,
            difficulty: this.difficulty,
            typingStats: this.typingStats,
            rank: this.calculateRankGrade()
        };
    }
}
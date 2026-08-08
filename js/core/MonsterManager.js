/**
 * MonsterManager.js
 * 인터넷 밈(Meme), 스트리머 유행어, 시청자 닉네임이 적용된 몬스터 관리 모듈
 * - wordPacks.js를 통해 실시간 채팅 시청자 대기열 / 프리셋 단어 팩과 연동
 * - 5 Stage 단위 보스전(WARNING) 지원
 */
class MonsterManager {
    constructor(canvas = null) {
        this.canvas = canvas;
        this.monsters = [];
        this.currentStage = 1;
        this.spawnInterval = null;
        this.startTimeout = null; // 게임 시작 그레이스 타임(첫 스폰 지연) 타이머
        this.bossTimeout = null;  // 보스 소환 지연 타이머
        this.speed = 1.0;
        this.onBossWarning = null; // game.js에서 주입하는 콜백 (stage) => void
        this.bossSpawnedForStage = false;

        // MAX_MONSTER_CAP: 대형 방송 마비 방지용 동시 출전 몬스터 상한.
        //   절대 상한은 CONFIG.MAX_MONSTER_CAP(천장)이며, startStage에서 난이도별 값과 clamp된다.
        this.MAX_MONSTER_CAP = (typeof CONFIG !== 'undefined' && CONFIG.MAX_MONSTER_CAP) || 15;
    }

    getMonsters() {
        return this.monsters || [];
    }

    /**
     * 스테이지 시작 메서드
     * @param {number} stage - 스테이지 번호
     * @param {string} difficulty - 난이도 ('easy' | 'normal' | 'hard' | 'hell')
     */
    startStage(stage = 1, difficulty = 'normal', startDelayMs = 0) {
        this.clear();
        this.currentStage = stage;
        this.bossSpawnedForStage = false;

        // 🎮 난이도별 밸런스 테이블 조회 (config.js CONFIG.DIFFICULTY)
        const cfg = (typeof getDifficultyConfig === 'function')
            ? getDifficultyConfig(difficulty)
            : { speedMult: 1.0, maxMonsterCap: 15, spawnIntervalBase: 2400, spawnIntervalStep: 150, spawnIntervalMin: 800 };

        // 낙하 속도: 스테이지마다 +0.04로 완만하게 가속 → 각 스테이지 최소 클리어 타수가
        //   약 50/60/70/80/90타…로 부드럽게 오르도록 튜닝(스폰·처치 수와 함께 시뮬레이션 검증).
        //   stage1=0.30(낙하 약 23초), stage2=0.34, stage3=0.38 ... (× 난이도 speedMult)
        this.speed = (0.30 + (stage - 1) * 0.04) * cfg.speedMult;
        // 절대 상한(CONFIG.MAX_MONSTER_CAP)을 넘지 않도록 항상 clamp
        const hardCap = (typeof CONFIG !== 'undefined' && CONFIG.MAX_MONSTER_CAP) || 15;
        this.MAX_MONSTER_CAP = Math.min(hardCap, cfg.maxMonsterCap);

        // 🤖 봇 보충은 큐를 미리 채우지 않는다. 스폰 시점에 대기열이 비어 있으면
        //    getNextMonsterData가 봇을 하나씩 생성하므로, 봇도 실참여자와 똑같이
        //    스폰 주기마다 한 명씩 등장한다(시작하자마자 큐가 봇으로 가득 차는 문제 방지).

        const isBossStage = stage > 0 && stage % 5 === 0;

        console.log(`[MonsterManager] Stage ${stage} 시작! (난이도: ${difficulty}, 동시상한: ${this.MAX_MONSTER_CAP}, 보스전: ${isBossStage ? 'YES' : 'NO'}, 시작지연: ${startDelayMs}ms)`);

        // 주기적 몬스터 생성 주기 (난이도별 스폰 주기 + Max Monster Cap 적용)
        const spawnInterval = Math.max(
            cfg.spawnIntervalMin,
            cfg.spawnIntervalBase - (stage * cfg.spawnIntervalStep)
        );

        // 실제 몬스터 등장 시작 로직 (게임 시작 시 startDelayMs 만큼 그레이스 타임 후 실행)
        const beginSpawning = () => {
            this.startTimeout = null;
            if (isBossStage) {
                // 🛡️ 5 Stage 단위 보스전: WARNING 배너 콜백 후 약간의 텀을 두고 보스 소환
                if (typeof this.onBossWarning === 'function') {
                    this.onBossWarning(stage);
                }
                this.bossTimeout = setTimeout(() => this.spawnBoss(), 1800);
            } else {
                this.spawnMonster();
            }

            this._isBossStage = isBossStage;
            this.spawnInterval = setInterval(() => this._spawnTick(), spawnInterval);
        };

        if (startDelayMs > 0) {
            this.startTimeout = setTimeout(beginSpawning, startDelayMs);
        } else {
            beginSpawning();
        }
    }

    /**
     * 시청자 닉네임과 밈 제시어가 결합된 2단 몬스터 생성
     * (wordPacks.getNextMonsterData가 실시간 채팅 대기열 → BOT 순으로 자동 배정)
     */
    spawnMonster() {
        if (this.monsters.length >= this.MAX_MONSTER_CAP) return;

        const data = (typeof wordPacks !== 'undefined')
            ? wordPacks.getNextMonsterData()
            : { nickname: '[BOT] 시뮬레이터', isBot: true, word: '타자연습', isLiveChat: false };

        // CanvasRenderer가 논리(CSS) 좌표계로 그리므로 clientWidth(논리 픽셀) 기준으로 스폰 위치 계산
        const safeWidth = this.canvas ? (this.canvas.clientWidth || 1024) : (window.innerWidth || 1024);

        const monster = {
            id: Date.now() + Math.random(),
            username: data.nickname, // 🏷️ 상단: 시청자 닉네임
            isBot: data.isBot,
            text: data.word,         // 🎯 하단: 제시어 (라이브 채팅 모드면 실제 채팅 문구)
            isLiveChat: !!data.isLiveChat, // 💬 라이브 채팅 문구가 그대로 쓰인 몬스터인지 (렌더러 강조용)
            x: Math.random() * (safeWidth - 180) + 90, // 화면 좌우 넘침 방지
            y: 130, // 상단 HUD 상태바(상단 부착 띠) 아래에서 등장 → 제시어가 상태창에 가려지지 않음
            speed: this.speed,
            scoreValue: 100 * this.currentStage,
            hp: 1,
            isBoss: false
        };

        this.monsters.push(monster);

        // 🏅 MVP 등장 집계: 실참여 시청자(봇 제외) 몬스터가 뜰 때마다 게임 엔진에 보고
        //    (처치 여부와 무관하게 "참여/등장" 기준으로 MVP 산정)
        if (!data.isBot && data.nickname && typeof window !== 'undefined'
            && window.gameEngine && typeof window.gameEngine.trackMvpAppearance === 'function') {
            window.gameEngine.trackMvpAppearance(data.nickname);
        }
    }

    /**
     * 🐲 5 Stage 단위 보스 몬스터 소환 (대형 개체, 다중 HP, 전용 단어)
     */
    spawnBoss() {
        const bossWord = (typeof wordPacks !== 'undefined') ? wordPacks.getBossWord() : '최종방어선돌파';
        const canvasWidth = this.canvas ? (this.canvas.clientWidth || 1024) : 1024;

        const boss = {
            id: Date.now() + Math.random(),
            username: `👑 STAGE ${this.currentStage} BOSS`,
            isBot: true,
            text: bossWord,
            x: canvasWidth / 2,
            y: 130, // 상단 HUD 상태바 아래에서 등장 (일반 몬스터와 동일 기준선)
            speed: this.speed * 0.55, // 보스는 느리지만 강력하게
            scoreValue: 500 * this.currentStage,
            hp: 1,
            isBoss: true
        };

        this.monsters.push(boss);
        this.bossSpawnedForStage = true;
    }

    /**
     * 동일 단어 존재 시 기지(바닥)와 가장 가까운(Y좌표가 가장 큰) 몬스터 우선 타깃팅
     */
    checkHit(text) {
        if (!text) return { success: false };

        let targetIndex = -1;
        let maxY = -1;

        for (let i = 0; i < this.monsters.length; i++) {
            if (this.monsters[i].text === text && this.monsters[i].y > maxY) {
                maxY = this.monsters[i].y;
                targetIndex = i;
            }
        }

        if (targetIndex !== -1) {
            const killedMonster = this.monsters.splice(targetIndex, 1)[0];

            if (killedMonster.isBoss) {
                this.bossSpawnedForStage = false; // 보스 처치 후 다음 스테이지 준비
            }

            return {
                success: true,
                monster: killedMonster,
                score: killedMonster.scoreValue,
                isKilled: true,
                isBoss: !!killedMonster.isBoss
            };
        }

        return { success: false };
    }

    update(deltaTime = 0.016, stage = 1) {
        let reachedCount = 0;
        const canvasHeight = this.canvas ? (this.canvas.clientHeight || 708) : 708;
        const bottomY = canvasHeight - 160; // CanvasRenderer의 방어선(groundY)과 정렬

        for (let i = this.monsters.length - 1; i >= 0; i--) {
            const m = this.monsters[i];
            m.y += m.speed * (deltaTime * 60);

            if (m.y >= bottomY) {
                this.monsters.splice(i, 1);
                reachedCount += m.isBoss ? 3 : 1; // 보스가 뚫리면 피해 가중
                if (m.isBoss) this.bossSpawnedForStage = false;
            }
        }

        return reachedCount;
    }

    /**
     * ⏱️ 주기 스폰 1틱. 탭이 백그라운드(document.hidden)일 때는 스폰을 건너뛴다.
     *    (움직임은 requestAnimationFrame이라 탭 숨김 시 자동 정지되지만, setInterval은 계속
     *     실행되어 몬스터가 화면 밖에서 쌓이는 문제를 방지 — 다른 화면 갔다 오면 몰려있던 버그)
     */
    _spawnTick() {
        if (typeof document !== 'undefined' && document.hidden) return;
        if (typeof window !== 'undefined' && window.gameEngine && window.gameEngine.isPaused) return; // ⏸ 일시정지 중 스폰 정지
        if (this.monsters.length < this.MAX_MONSTER_CAP && !(this._isBossStage && !this.bossSpawnedForStage)) {
            this.spawnMonster();
        }
    }

    /**
     * 현재 스테이지가 보스전이며 보스가 아직 생존 중인지 여부
     */
    isBossAlive() {
        return this.monsters.some(m => m.isBoss);
    }

    clear() {
        if (this.spawnInterval) {
            clearInterval(this.spawnInterval);
            this.spawnInterval = null;
        }
        if (this.startTimeout) {
            clearTimeout(this.startTimeout);
            this.startTimeout = null;
        }
        if (this.bossTimeout) {
            clearTimeout(this.bossTimeout);
            this.bossTimeout = null;
        }
        this.monsters = [];
    }
}

window.MonsterManager = MonsterManager;

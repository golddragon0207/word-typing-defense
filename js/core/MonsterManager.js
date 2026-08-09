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
        this.onBossAttack = null;  // game.js에서 주입: 차지 게이지가 다 차면 (damage) => void 로 기지 피해
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
        //   stage1=0.30(낙하 약 30초, 538px÷18px/s), stage2=0.34, stage3=0.38 ... (× 난이도 speedMult)
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
                this.bossTimeout = setTimeout(() => { this.bossTimeout = null; this.spawnBoss(); }, 1800);
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
        // ⏸ 일시정지 중에는 스폰하지 않는다. (시작 그레이스/스테이지업 지연 타이머(setTimeout)는
        //    정지와 무관하게 발화하므로, 여기서 막지 않으면 정지 중에 몬스터가 튀어나온다.)
        if (typeof window !== 'undefined' && window.gameEngine && window.gameEngine.isPaused) return;

        const data = (typeof wordPacks !== 'undefined')
            ? wordPacks.getNextMonsterData()
            : { nickname: '[BOT] 시뮬레이터', isBot: true, word: '타자연습', isLiveChat: false };

        // CanvasRenderer가 논리(CSS) 좌표계로 그리므로 clientWidth(논리 픽셀) 기준으로 스폰 위치 계산
        const safeWidth = this.canvas ? (this.canvas.clientWidth || 1024) : (window.innerWidth || 1024);

        // 🕒 좌상단 '출전 대기열' 패널(우측끝 ≈ 183px)에 몬스터가 가려지지 않도록,
        //    닉네임/제시어 길이로 박스 폭을 추정해 몬스터 중심 x의 최소값을 확보한다.
        //    (짧은 단어는 살짝만, 긴 단어는 더 오른쪽에서 등장 → 패널을 절대 침범하지 않음)
        const estLen = Math.max(String(data.word || '').length, String(data.nickname || '').length);
        const estBoxW = Math.max(110, estLen * 20 + 26); // CanvasRenderer의 박스 폭 계산과 동일한 감각
        const QUEUE_PANEL_RIGHT = 190;                   // 패널 우측끝(183) + 여백
        const rightMargin = 90;
        const minX = QUEUE_PANEL_RIGHT + estBoxW / 2;
        const maxX = safeWidth - rightMargin;
        const spawnX = (minX < maxX) ? (Math.random() * (maxX - minX) + minX) : (safeWidth / 2);

        // 🎯 제시어 난이도(한글 자모 획수)에 비례한 점수: 어려운(길고 획수 많은) 단어일수록 높은 점수.
        //    '획수 × 6 × 스테이지' — 기본팩 평균(≈16획)이 스테이지1에서 ≈100점이 되도록 보정(배수는 조정 가능).
        const strokes = (typeof wordPacks !== 'undefined' && typeof wordPacks.getHangulStrokeCount === 'function')
            ? wordPacks.getHangulStrokeCount(data.word)
            : (data.word ? data.word.length : 1);
        const scoreValue = Math.max(30, Math.round(strokes * 6)) * this.currentStage;

        const monster = {
            id: Date.now() + Math.random(),
            username: data.nickname, // 🏷️ 상단: 시청자 닉네임
            isBot: data.isBot,
            text: data.word,         // 🎯 하단: 제시어 (라이브 채팅 모드면 실제 채팅 문구)
            isLiveChat: !!data.isLiveChat, // 💬 라이브 채팅 문구가 그대로 쓰인 몬스터인지 (렌더러 강조용)
            x: spawnX, // 좌상단 대기열 패널을 피해(좌측 확보) 좌우 넘침도 방지한 스폰 위치
            // 상단 HUD 상태바(스테이지창, 0~71px) '안'에서 생성 → HUD가 캔버스 위에 겹쳐 그려지므로
            // 제시어가 스테이지창에 가려진 채 시작해 아래로 스르륵 내려오는 연출(잠깐 안 보여도 의도된 것)
            // + 낙하(반응) 구간 최대 확보.
            y: 40,
            speed: this.speed,
            scoreValue: scoreValue,
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
     * 🐲 5 Stage 단위 "기 모으기(차지)" 보스 소환.
     *    보스는 낙하하지 않고 고정 위치에서 차지 게이지를 채운다.
     *      - 게이지가 다 차기 전에 제시어를 격파(정타)하면 게이지를 절반 밀어내고(공격 저지) 새 제시어로 교체.
     *      - 필요 격파 횟수(requiredHits)를 모두 채우면 처치 → 다음 스테이지. (진행도는 절대 사라지지 않음)
     *      - 게이지가 다 차면 보스 공격 발동 → 기지에 attackDamage 피해 후 게이지만 0으로 리셋(진행도 유지).
     *    스테이지가 오를수록 필요 격파·차지 시간·공격력이 함께 커진다.
     */
    spawnBoss() {
        // ⏸ 일시정지 중이면 보스도 소환하지 않는다(재개 시 resumeSpawns가 이어서 소환).
        if (typeof window !== 'undefined' && window.gameEngine && window.gameEngine.isPaused) return;
        // 🛡️ 스테이지당 보스는 하나만 — 타이머와 재개 복구가 겹쳐도 이중 소환되지 않도록 가드.
        if (this.bossSpawnedForStage) return;

        const stage = this.currentStage;
        const canvasWidth = this.canvas ? (this.canvas.clientWidth || 1024) : 1024;

        // 후반 보스일수록 더 긴(어려운) 제시어를 우선 출제
        const bossWord = this._pickBossWord(stage);

        // 🐲 보스 난이도 스케일: 보스 인덱스(5→0, 10→1, 15→2 …) 기준으로 후반일수록 강해진다.
        //    - 체력(정타 수)      ↑ : 2 → 5     (싸움이 길어짐)
        //    - 차지 시간          ↓ : 22s → 7s  (공격이 더 자주 = 요구 타수 상승, 첫 보스는 4스테이지 대비 완만한 상승)
        //    - 공격력            ↑ : 10 → +2/보스 (후반 치명성 — 못 따라가면 실제로 사망 가능)
        //    - 제시어           ↑ : _pickBossWord가 후반일수록 긴 문구 우선 출제
        //    ※ 차지 공격에 '명중'당하면 update()에서 chargeTime을 다시 늘려(차지 느려짐) 연속 피격을 완화.
        const bossIndex = Math.max(0, Math.floor(stage / 5) - 1);
        const requiredHits = Math.min(5, 2 + Math.floor(stage / 20));  // 보스 체력: 2 → 5
        const chargeTime = Math.max(7000, 22000 - bossIndex * 2000);   // 차지 시간: 22s → 7s (후반 빨라짐)
        const attackDamage = 10 + bossIndex * 2;                        // 공격력: 10 → 매 보스 +2

        const boss = {
            id: Date.now() + Math.random(),
            username: `👑 STAGE ${stage} BOSS`,
            isBot: true,
            text: bossWord,
            x: canvasWidth / 2,
            y: 260,             // 상단 HUD·게이지/pip 장식이 겹치지 않는 고정 위치(낙하하지 않음)
            speed: 0,           // 차지 보스는 이동하지 않음
            scoreValue: 500 * stage,
            isBoss: true,
            // ⚡ 차지 보스 전용 상태
            requiredHits,
            hitsLanded: 0,
            chargeTime,
            baseChargeTime: chargeTime, // 성공 공격마다 chargeTime을 늘릴 때의 기준값
            chargeAttackCount: 0,       // 지금까지 기지에 명중시킨 횟수
            chargeElapsed: 0,
            attackDamage
        };

        this.monsters.push(boss);
        this.bossSpawnedForStage = true;
    }

    /**
     * 🎯 스테이지에 맞는 보스 제시어 선택. 후반일수록 획수가 긴 상위 티어에서 우선 출제한다.
     * @param {number} stage
     * @returns {string}
     */
    _pickBossWord(stage) {
        if (typeof wordPacks === 'undefined' || !Array.isArray(wordPacks.bossWords) || wordPacks.bossWords.length === 0) {
            return '최종방어선돌파';
        }
        const pool = wordPacks.bossWords;
        // 획수 오름차순 정렬 후, 스테이지가 높을수록 뒤쪽(더 긴) 절반으로 후보를 좁힌다.
        const sorted = pool.slice().sort((a, b) =>
            wordPacks.getHangulStrokeCount(a) - wordPacks.getHangulStrokeCount(b));
        let candidates = sorted;
        if (stage >= 30) candidates = sorted.slice(Math.floor(sorted.length / 2)); // 상위 50% (긴 문구)
        else if (stage >= 15) candidates = sorted.slice(Math.floor(sorted.length / 4)); // 하위 25% 제외
        return candidates[Math.floor(Math.random() * candidates.length)];
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
            const target = this.monsters[targetIndex];

            // 🐲 차지 보스: 정타하면 진행도 +1 + 차지 게이지 절반 밀어내기(공격 저지) + 새 제시어.
            //    필요 격파 수를 모두 채우기 전까지는 처치되지 않는다(진행도는 유지).
            if (target.isBoss) {
                target.hitsLanded = (target.hitsLanded || 0) + 1;

                if (target.hitsLanded >= target.requiredHits) {
                    // ✅ 완전 격파 → 처치(공격 실패 연출은 game.js)
                    this.monsters.splice(targetIndex, 1);
                    this.bossSpawnedForStage = false;
                    return {
                        success: true,
                        monster: target,
                        score: target.scoreValue,
                        isKilled: true,
                        isBoss: true
                    };
                }

                // 아직 남음: 게이지를 절반 밀어내고(공격 지연) 새 제시어로 교체
                target.chargeElapsed = Math.max(0, (target.chargeElapsed || 0) - target.chargeTime * 0.5);
                if (typeof wordPacks !== 'undefined') {
                    let next = this._pickBossWord(this.currentStage);
                    let guard = 0;
                    while (next === target.text && guard++ < 8) next = this._pickBossWord(this.currentStage);
                    target.text = next;
                }
                return {
                    success: true,
                    monster: target,
                    score: target.scoreValue,
                    isKilled: false,
                    isBoss: true,
                    bossDamaged: true,
                    hitsLanded: target.hitsLanded,
                    requiredHits: target.requiredHits
                };
            }

            const killedMonster = this.monsters.splice(targetIndex, 1)[0];

            return {
                success: true,
                monster: killedMonster,
                score: killedMonster.scoreValue,
                isKilled: true,
                isBoss: false
            };
        }

        return { success: false };
    }

    update(deltaTime = 0.016, stage = 1) {
        let reachedCount = 0;
        const canvasHeight = this.canvas ? (this.canvas.clientHeight || 708) : 708;
        const bottomY = canvasHeight - 130; // CanvasRenderer의 방어선(groundY)과 정렬

        const nowMs = (typeof performance !== 'undefined' ? performance.now() : Date.now());

        for (let i = this.monsters.length - 1; i >= 0; i--) {
            const m = this.monsters[i];

            // 🐲 차지 보스: 낙하하지 않고 게이지를 채운다. 다 차면 공격 발동 후 게이지만 리셋(진행도 유지).
            if (m.isBoss) {
                m.chargeElapsed = (m.chargeElapsed || 0) + deltaTime * 1000;
                if (m.chargeElapsed >= m.chargeTime) {
                    m.chargeElapsed = 0;
                    m._attackFlashUntil = nowMs + 450; // 렌더러 공격 플래시
                    if (typeof this.onBossAttack === 'function') this.onBossAttack(m.attackDamage || 10);
                    // ⏳ 공격이 기지에 명중할 때마다 다음 차지 시간을 늘려(공격 간격↑) 연속 피격을 완화.
                    //    기준값의 +50%씩 누적, 최대 2배까지(예: 12s → 18s → 24s).
                    m.chargeAttackCount = (m.chargeAttackCount || 0) + 1;
                    const base = m.baseChargeTime || m.chargeTime;
                    m.chargeTime = Math.min(base * 2, base * (1 + 0.5 * m.chargeAttackCount));
                    // 공격 발동 후 새 제시어로 교체 (정타 밀어내기와 동일하게)
                    if (typeof wordPacks !== 'undefined') {
                        let next = this._pickBossWord(this.currentStage);
                        let guard = 0;
                        while (next === m.text && guard++ < 8) next = this._pickBossWord(this.currentStage);
                        m.text = next;
                    }
                }
                continue; // 보스는 낙하/기지 도달 로직을 건너뜀
            }

            m.y += m.speed * (deltaTime * 60);

            if (m.y >= bottomY) {
                this.monsters.splice(i, 1);
                reachedCount += 1;
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
        // 🛡️ 보스 스테이지에는 일반 몬스터(산성비)를 절대 스폰하지 않는다 — 보스 하나만 상대.
        //    (보스가 이미 소환된 뒤에도 주기 스폰이 계속돼 산성비가 쏟아지던 버그 방지)
        if (this._isBossStage) return;
        if (this.monsters.length < this.MAX_MONSTER_CAP) {
            this.spawnMonster();
        }
    }

    /**
     * ▶ 일시정지 해제 시 호출 — 정지 중 타이머가 발화하며 스킵됐던 '스테이지 첫 등장'을 복구한다.
     *    (spawnMonster/spawnBoss는 isPaused일 때 스폰을 건너뛰므로, 재개 후 화면이 비는 것을 방지)
     *    - 보스 스테이지: 보스 소환 타이머가 이미 발화(bossTimeout=null)했는데 아직 보스가 없으면 지금 소환.
     *    - 일반 스테이지: 스폰이 시작됐는데(spawnInterval 활성) 화면에 몬스터가 하나도 없으면 하나 소환.
     */
    resumeSpawns() {
        if (this._isBossStage) {
            if (!this.bossSpawnedForStage && !this.startTimeout && !this.bossTimeout) {
                this.spawnBoss();
            }
        } else if (this.spawnInterval && this.monsters.length === 0) {
            this.spawnMonster();
        }
    }

    /**
     * 🔥 피버 버스트: 화면의 일반 몬스터를 모두 제거하고 제거된 목록을 반환(보스는 남긴다).
     *    직접 필터로 없애므로 기지 피해(update의 reached)로 집계되지 않는다.
     * @returns {Array} 제거된 일반 몬스터 목록
     */
    clearNonBoss() {
        const cleared = this.monsters.filter(m => !m.isBoss);
        this.monsters = this.monsters.filter(m => m.isBoss);
        return cleared;
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

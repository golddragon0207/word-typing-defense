/**
 * MonsterManager.js
 * 인터넷 밈(Meme), 스트리머 유행어, 시청자 닉네임이 적용된 몬스터 관리 모듈
 * - wordPacks.js를 통해 실시간 채팅 시청자 대기열 / 3·4글자 제시어 풀과 연동
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
     * @param {string} difficulty - 밸런스 세트 키 (현재 'normal' 단일)
     */
    startStage(stage = 1, difficulty = 'normal', startDelayMs = 0) {
        this.clear();
        this.currentStage = stage;
        this.bossSpawnedForStage = false;

        // 🎮 난이도별 밸런스 테이블 조회 (config.js CONFIG.DIFFICULTY)
        const cfg = (typeof getDifficultyConfig === 'function')
            ? getDifficultyConfig(difficulty)
            : { speedMult: 1.0, maxMonsterCap: 15 };

        // 낙하 속도: 스테이지마다 +0.05로 가속하되 **stage 60에서 상한**(이후 고정, 3.25).
        //   요구 타자속도(스폰)와 별개로 "실수 봐주는 버퍼(반응창)"를 후반까지 계속 좁혀, 800타 소프트 캡 이후
        //   무오타 지구력을 강요하는 보조 축(요구 타수 자체는 CONFIG.SPAWN_CURVE가 정한다). (상한 stage24 → stage60로 연장)
        //   stage1=0.30(낙하 ≈30초, 538px÷18px/s) … stage60=3.25(낙하 ≈2.8초)에서 고정 (× 난이도 speedMult)
        //   ※ 반응 하한 ≈2.8s에서 멈춘다: 더 좁히면(≈1.5s↓) 인간 불가·일반 스테이지가 보스보다 어려워지는 역전 발생.
        const speedStage = Math.min(stage, 60);
        this.speed = (0.30 + (speedStage - 1) * 0.05) * cfg.speedMult;
        // 절대 상한(CONFIG.MAX_MONSTER_CAP)을 넘지 않도록 항상 clamp
        const hardCap = (typeof CONFIG !== 'undefined' && CONFIG.MAX_MONSTER_CAP) || 15;
        this.MAX_MONSTER_CAP = Math.min(hardCap, cfg.maxMonsterCap);

        // 🤖 봇 보충은 큐를 미리 채우지 않는다. 스폰 시점에 대기열이 비어 있으면
        //    getNextMonsterData가 봇을 하나씩 생성하므로, 봇도 실참여자와 똑같이
        //    스폰 주기마다 한 명씩 등장한다(시작하자마자 큐가 봇으로 가득 차는 문제 방지).

        const isBossStage = stage > 0 && stage % 5 === 0;

        console.log(`[MonsterManager] Stage ${stage} 시작! (난이도: ${difficulty}, 동시상한: ${this.MAX_MONSTER_CAP}, 보스전: ${isBossStage ? 'YES' : 'NO'}, 시작지연: ${startDelayMs}ms)`);

        // 주기적 몬스터 생성 주기 — CONFIG.SPAWN_CURVE의 "목표 요구 타자속도(한컴 타/분)"에서 역산.
        //   linear      = kpmStart + (stage-1)*kpmStep          (s1=100타 → 선형 상승)
        //   requiredKpm = linear<=kpmMax ? linear               (800타 소프트 캡 전)
        //               : kpmMax + (linear-kpmMax)*(kpmStepAfterMax/kpmStep)  (캡 이후 완만 상승 — 불멸 제거)
        //   spawnInterval(ms) = max(400, round(60000 * 단어당평균타수 / requiredKpm))
        //   (구 'base - stage*step' 선형 스폰은 요구 타수가 후반 급가속이라, 선형 타수 상승을 위해 역산 방식으로 대체)
        const sc = (typeof CONFIG !== 'undefined' && CONFIG.SPAWN_CURVE)
            || { kpmStart: 100, kpmStep: 10.5, kpmMax: 800, kpmStepAfterMax: 3, avgWordKeystrokes: 8.9 };
        const requiredKpm = this._requiredKpm(stage);   // 요구 타자속도(스폰 주기·보스 차지 시간 공용 기준)
        const spawnInterval = Math.max(400, Math.round(60000 * sc.avgWordKeystrokes / requiredKpm));

        // 실제 몬스터/보스 등장 시작 로직 (startDelayMs 만큼 그레이스 타임 후 실행)
        const beginSpawning = () => {
            this.startTimeout = null;
            this.bossTimeout = null;
            if (isBossStage) {
                this.spawnBoss();
            } else {
                this.spawnMonster();
            }

            this._isBossStage = isBossStage;
            this.spawnInterval = setInterval(() => this._spawnTick(), spawnInterval);
        };

        // 🛡️ 5 Stage 단위 보스전: WARNING 배너를 '그레이스 시작과 동시에' 띄워 빈 화면 구간을 없앤다.
        //   (예전엔 그레이스가 끝난 뒤에야 배너가 떠, 그 사이 몇 초 동안 화면이 텅 비어 멈춘 것처럼 보였다)
        //   ⚠️ 배너는 화면 중앙(top:42%)에 뜨고 보스 제시어도 중앙 부근(y=260)에 뜨므로 둘이 겹치면 안 된다.
        //      → 보스 소환까지의 텀(bossLeadMs)을 잡고, 배너는 그 '직전'(−400ms)에 사라지게 해 겹침을 막으면서
        //         끝의 빈 구간을 최소화한다. 그레이스가 없는(예외) 경로에서도 최소 2200ms를 확보해 WARNING을 보여준다.
        const beginDelay = isBossStage ? Math.max(startDelayMs, 2200) : startDelayMs;
        if (isBossStage && typeof this.onBossWarning === 'function') {
            this.onBossWarning(stage, Math.max(1200, beginDelay - 400));
        }

        if (beginDelay > 0) {
            this.startTimeout = setTimeout(beginSpawning, beginDelay);
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

        // 🎯 화면에 이미 떠 있는 제시어를 넘겨 중복 단어 회피(같은 단어 몬스터 동시 등장 방지)
        const onScreenWords = new Set(this.monsters.map(m => m.text));
        // 🎯 현재 스테이지를 넘겨 3글자/4글자 풀 선택 확률에 반영(초반=3글자 위주 → 후반=4글자 위주).
        const data = (typeof wordPacks !== 'undefined')
            ? wordPacks.getNextMonsterData(null, onScreenWords, this.currentStage)
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
        //    기본점 = '획수 × 6' (3글자 평균 ≈15.5획→≈93점 · 4글자 평균 ≈20.4획→≈122점이 스테이지1 기준 —
        //    글자수가 짧아져도 음절 획수가 높아 기존 6글자(≈100점)와 같은 점수대가 유지된다. 배수 조정 가능).
        //    스테이지 배수 = 반선형 '1 + (stage-1) × 0.5' — 기존 '×stage'(선형) 대비 후반 성장을 절반으로 완화해
        //    스테이지가 오를수록 점수가 복리로 폭주하던 것을 억제(계수 0.5 조정 가능).
        const strokes = (typeof wordPacks !== 'undefined' && typeof wordPacks.getHangulStrokeCount === 'function')
            ? wordPacks.getHangulStrokeCount(data.word)
            : (data.word ? data.word.length : 1);
        const stageMult = 1 + (this.currentStage - 1) * 0.5;
        const scoreValue = Math.round(Math.max(30, Math.round(strokes * 6)) * stageMult);

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

        // 🐲 보스 난이도 스케일: 각 보스가 "직전 일반 스테이지보다 조금 더 어렵도록" 튜닝.
        //    - 차지 시간 : _bossChargeMs — 직전 일반 스테이지(stage-1) 요구 타수의 CONFIG.BOSS.kpmMult(×1.15)배 속도를
        //                  요구하도록 역산. 요구 타수 상승에 자동 연동돼 후반에도 보스가 뒤처지지 않는다.
        //                  (일반 스테이지 생존 최소 속도로는 첫 게이지를 다 못 밀어내 ~1회 피격 = 스파이크)
        //    - 체력(정타): 2 → 5, s30/60/90에서 +1씩(완만화 — 잦은 체력 점프로 보스가 급등하는 것 방지).
        //    - 공격력    : 10 → 매 보스 +2 (후반 치명성 — 못 따라가면 실제 사망 가능).
        //    - 제시어    : _pickBossWord가 후반일수록 긴 문구 우선 출제(차지도 그 평균 길이로 역산).
        //    ※ 차지 공격에 '명중'당하면 update()에서 chargeTime을 다시 늘려(차지 느려짐) 연속 피격을 완화.
        const bossIndex = Math.max(0, Math.floor(stage / 5) - 1);
        const requiredHits = Math.min(5, 2 + Math.floor(stage / 30));  // 보스 체력: 2 → 5 (완만)
        const chargeTime = this._bossChargeMs(stage);                  // 요구 타수 ×kpmMult 속도 요구(자동 스케일)
        const attackDamage = 10 + bossIndex * 2;                        // 공격력: 10 → 매 보스 +2

        const boss = {
            id: Date.now() + Math.random(),
            username: `👑 STAGE ${stage} BOSS`,
            isBot: true,
            text: bossWord,
            x: canvasWidth / 2,
            y: 260,             // 상단 HUD·게이지/pip 장식이 겹치지 않는 고정 위치(낙하하지 않음)
            speed: 0,           // 차지 보스는 이동하지 않음
            // 🐲 보스 점수도 일반 몬스터와 동일한 반선형 배수 '1 + (stage-1)×0.5' 적용(기본 500).
            //    기존 '500 × stage'(선형) 대비 후반 폭주를 억제해 일반 몬스터 점수 곡선과 결을 맞춘다.
            scoreValue: Math.round(500 * (1 + (stage - 1) * 0.5)),
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
        const candidates = this._bossPool(stage);
        return candidates[Math.floor(Math.random() * candidates.length)];
    }

    /**
     * 📈 해당 스테이지의 "목표 요구 타자속도(한컴 자소 타/분)" — 스폰 주기와 보스 차지 시간이 공용 참조.
     *    CONFIG.SPAWN_CURVE: s1=kpmStart → +kpmStep/스테이지 → kpmMax 소프트 캡 → 이후 +kpmStepAfterMax/스테이지.
     * @param {number} stage
     * @returns {number} 요구 타자속도(타/분)
     */
    _requiredKpm(stage) {
        const sc = (typeof CONFIG !== 'undefined' && CONFIG.SPAWN_CURVE)
            || { kpmStart: 100, kpmStep: 10.5, kpmMax: 800, kpmStepAfterMax: 3, avgWordKeystrokes: 8.9 };
        const linear = sc.kpmStart + (stage - 1) * sc.kpmStep;
        return (linear <= sc.kpmMax)
            ? linear
            : sc.kpmMax + (linear - sc.kpmMax) * ((sc.kpmStepAfterMax || 0) / sc.kpmStep);
    }

    /**
     * 🐲 bossWords를 획수 오름차순으로 정렬한 결과를 캐시해 반환.
     *    _bossPool이 보스 스폰·리롤(=정타)마다 호출되므로, 원본 배열이 바뀔 때만 다시 정렬한다.
     */
    _getSortedBossWords() {
        const src = wordPacks.bossWords;
        if (this._sortedBossWords && this._sortedBossWordsSrc === src) {
            return this._sortedBossWords;
        }
        this._sortedBossWordsSrc = src;
        this._sortedBossWords = src.slice().sort((a, b) =>
            wordPacks.getHangulStrokeCount(a) - wordPacks.getHangulStrokeCount(b));
        return this._sortedBossWords;
    }

    /**
     * 🐲 해당 스테이지의 보스 제시어 후보 풀(획수 오름차순 정렬 후 후반일수록 긴 문구로 좁힘).
     *    _pickBossWord(랜덤 출제)와 _bossChargeMs(평균 타수로 차지 역산)가 공용 사용.
     */
    _bossPool(stage) {
        const sorted = this._getSortedBossWords();
        if (stage >= 30) return sorted.slice(Math.floor(sorted.length / 2)); // 상위 50%(긴 문구)
        if (stage >= 15) return sorted.slice(Math.floor(sorted.length / 4)); // 하위 25% 제외
        return sorted;
    }

    /**
     * 🐲 보스 차지 시간(ms) — "직전 일반 스테이지(stage-1) 요구 타수의 kpmMult배 속도"를 요구하도록 역산.
     *    즉 일반 스테이지 생존 최소 속도로는 차지를 다 못 밀어내 ~1회 피격(=난이도 스파이크).
     *    (요구 타수 상승에 자동 연동되므로 후반에도 보스가 뒤처지지 않음. CONFIG.BOSS로 튜닝.)
     * @param {number} stage
     * @returns {number} 차지 시간(ms)
     */
    _bossChargeMs(stage) {
        const bcfg = (typeof CONFIG !== 'undefined' && CONFIG.BOSS) || { kpmMult: 1.15, minChargeSec: 1.5 };
        const pool = (typeof wordPacks !== 'undefined' && Array.isArray(wordPacks.bossWords) && wordPacks.bossWords.length)
            ? this._bossPool(stage) : null;
        const avgKb = pool
            ? pool.reduce((a, w) => a + wordPacks.getKeystrokeCount(w), 0) / pool.length
            : 15; // 폴백: 보스 문구(5~6글자) 평균 타수 근사
        // 🎯 기준 요구타수는 '직전 일반 스테이지(stage-1)'. 보스 스테이지엔 일반 몹 구간이 없어
        //    플레이어가 실제로 겪은 마지막 속도가 stage-1이기 때문. (그 스테이지(stage) 요구타수로 잡으면
        //    겪어보지 못한 속도 기준 + 곱셈 스파이크가 겹쳐 4→5 갭이 과도해짐.)
        const refStage = Math.max(1, stage - 1);
        const sec = 60 * avgKb / (bcfg.kpmMult * this._requiredKpm(refStage));
        return Math.round(Math.max(bcfg.minChargeSec, sec) * 1000);
    }

    /**
     * 🔁 보스 제시어를 직전과 겹치지 않는 새 문구로 교체(정타 밀어내기·공격 발동 공용).
     * @param {Object} boss - 교체 대상 보스 몬스터
     */
    _rerollBossWord(boss) {
        if (typeof wordPacks === 'undefined' || !boss) return;
        let next = this._pickBossWord(this.currentStage);
        let guard = 0;
        while (next === boss.text && guard++ < 8) next = this._pickBossWord(this.currentStage);
        boss.text = next;
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
                this._rerollBossWord(target);
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

    update(deltaTime = 0.016) {
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
                    //    기준값의 +50%씩 누적, 최대 2배까지(예: s5 base 20s → 30s → 40s).
                    m.chargeAttackCount = (m.chargeAttackCount || 0) + 1;
                    const base = m.baseChargeTime || m.chargeTime;
                    m.chargeTime = Math.min(base * 2, base * (1 + 0.5 * m.chargeAttackCount));
                    this._rerollBossWord(m); // 공격 발동 후 새 제시어로 교체(정타 밀어내기와 동일)
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
        // 🎯 스폰 스로틀: (누적 처치수 + 화면상 몬스터)가 스테이지 킬 목표에 도달하면 더 스폰하지 않는다.
        //    목표를 '카운트'로만 보고 동시상한까지 계속 스폰하면, 목표 달성 순간 화면에 남은 몹이
        //    startStage()의 clear()로 한꺼번에 증발한다("마지막 몹이 알아서 잡히는" 현상). 필요한 만큼만
        //    스폰해 두면 마지막 처치 때 화면이 비어 증발이 없다. 바닥 도달로 사라진 몹은 화면수에서
        //    빠져 자동으로 스폰이 재개되므로 소프트락도 없다.
        if (this._reachedStageSpawnQuota()) return;
        if (this.monsters.length < this.MAX_MONSTER_CAP) {
            this.spawnMonster();
        }
    }

    /**
     * 🎯 이번 스테이지 스폰 쿼터 도달 여부 — (처치수 + 화면상 일반몹) ≥ 킬 목표면 true.
     *    game.js(GameEngine)가 목표 수·처치수를 관리하므로 window.gameEngine에서 참조한다.
     */
    _reachedStageSpawnQuota() {
        const ge = (typeof window !== 'undefined') ? window.gameEngine : null;
        if (!ge || typeof ge.getStageKillTarget !== 'function') return false;
        const target = ge.getStageKillTarget();
        if (!target || target <= 0) return false;
        const aliveNonBoss = this.monsters.reduce((n, m) => n + (m.isBoss ? 0 : 1), 0);
        return (ge.stageKillCount || 0) + aliveNonBoss >= target;
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

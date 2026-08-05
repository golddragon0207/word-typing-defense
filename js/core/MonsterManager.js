/**
 * ==========================================
 * Word Typing Defense - MonsterManager
 * ==========================================
 * 대형 방송 렉 방지용 Max Monster Cap (15마리) 제어,
 * 2단 몬스터(닉네임 Tag + 타깃 Word) 스폰 대기열, 이동 및 바닥 충돌 판정을 담당합니다.
 */

class MonsterManager {
    /**
     * @param {HTMLCanvasElement} canvas 
     */
    constructor(canvas) {
        this.canvas = canvas;
        this.monsters = [];          // 화면에 활성화된 몬스터 리스트
        this.spawnQueue = [];        // 스폰 대기열 (Queue)

        // ⚙️ 핵심 제한 정책
        this.MAX_MONSTER_CAP = 15;   // 동시 화면 최대 출전 몬스터 수
        this.spawnTimer = 0;
        this.spawnInterval = 2.0;    // 기본 스폰 주기 (초)
        this.monsterIdCounter = 1;

        // 보스전 상태
        this.isBossWave = false;
        this.bossSpawned = false;
    }

    /**
     * 초기화 / 리셋
     */
    reset() {
        this.monsters = [];
        this.spawnQueue = [];
        this.spawnTimer = 0;
        this.monsterIdCounter = 1;
        this.isBossWave = false;
        this.bossSpawned = false;
    }

    /**
     * 스폰 대기열에 몬스터 데이터 추가
     * (chatIntegration / wordPacks 에서 받아온 2단 데이터 저장)
     * @param {Object} rawData - { nickname, isBot, word }
     */
    enqueueMonsterData(rawData) {
        this.spawnQueue.push(rawData);
    }

    /**
     * 매 프레임 스폰 대기열 체크 및 몬스터 이동 좌표 업데이트
     * @param {number} deltaTime 
     * @param {number} currentStage 
     */
    update(deltaTime, currentStage = 1) {
        // 1. 5 Stage 단위 보스전 여부 확인
        this.checkBossStage(currentStage);

        // 2. 몬스터 스폰 타이머 업데이트 (Max Cap 15마리 미만일 때만)
        this.spawnTimer += deltaTime;

        // 난이도/Stage 상승에 따라 스폰 속도 단축
        const currentInterval = Math.max(0.8, this.spawnInterval - (currentStage * 0.1));

        if (this.spawnTimer >= currentInterval) {
            this.spawnTimer = 0;
            this.trySpawnMonster(currentStage);
        }

        // 3. 화면 내 몬스터 Y축 낙하 이동
        const baseSpeed = 30 + (currentStage * 5); // Stage별 속도 증가

        this.monsters.forEach(monster => {
            const speed = monster.isBoss ? baseSpeed * 0.5 : baseSpeed * monster.speedMultiplier;
            monster.y += speed * deltaTime;
        });
    }

    /**
     * Max Monster Cap (15마리) 범위 내에서 몬스터 스폰 시도
     * @param {number} currentStage 
     */
    trySpawnMonster(currentStage) {
        // Max Monster Cap 초과 시 스폰 차단
        if (this.monsters.length >= this.MAX_MONSTER_CAP) {
            return;
        }

        // 보스 스테이지인데 아직 보스가 등장하지 않은 경우
        if (this.isBossWave && !this.bossSpawned) {
            this.spawnBossMonster(currentStage);
            return;
        }

        // 2단 몬스터 데이터 확보 (대기열에 없으면 wordPacks에서 자동 생성)
        let monsterData = this.spawnQueue.shift();

        if (!monsterData && window.wordPacks) {
            monsterData = window.wordPacks.getNextMonsterData();
        }

        // 기본 안전 데이터 확보
        if (!monsterData) {
            monsterData = {
                nickname: '[BOT] 자동소환봇',
                isBot: true,
                word: '타자디펜스'
            };
        }

        // 몬스터 좌표 계산 (Canvas 상단 X축 랜덤 배치)
        const margin = 100;
        const xPos = margin + Math.random() * (this.canvas.width - (margin * 2));

        const newMonster = {
            id: this.monsterIdCounter++,
            nickname: monsterData.nickname,
            isBot: monsterData.isBot,
            word: monsterData.word,
            x: xPos,
            y: -40, // Canvas 상단 바깥에서 낙하 시작
            width: 140,
            height: 50,
            speedMultiplier: 0.8 + Math.random() * 0.5,
            isBoss: false,
            scoreValue: 100
        };

        this.monsters.push(newMonster);
    }

    /**
     * 5 Stage 단위 대형 보스 몬스터 스폰
     * @param {number} currentStage 
     */
    spawnBossMonster(currentStage) {
        let bossWord = '최종방어타깃';
        if (window.wordPacks && window.wordPacks.getBossWord) {
            bossWord = window.wordPacks.getBossWord();
        }

        const bossMonster = {
            id: this.monsterIdCounter++,
            nickname: `👑 STAGE ${currentStage} BOSS`,
            isBot: false,
            word: bossWord,
            x: this.canvas.width / 2,
            y: -80,
            width: 220,
            height: 80,
            speedMultiplier: 0.4,
            isBoss: true,
            scoreValue: 500
        };

        this.monsters.push(bossMonster);
        this.bossSpawned = true;
    }

    /**
     * 5 Stage 단위 보스전 스테이지 판정
     * @param {number} currentStage 
     */
    checkBossStage(currentStage) {
        if (currentStage % 5 === 0) {
            if (!this.isBossWave) {
                this.isBossWave = true;
                this.bossSpawned = false;
            }
        } else {
            this.isBossWave = false;
            this.bossSpawned = false;
        }
    }

    /**
     * 입력된 단어와 일치하는 타깃 몬스터 탐색 (가장 아래에 있는 몬스터 우선)
     * @param {string} typedWord 
     * @returns {Object|null}
     */
    findTargetMonster(typedWord) {
        if (!typedWord) return null;

        const cleanInput = typedWord.trim();
        let target = null;
        let maxY = -Infinity;

        // 화면 하단에 가장 가까운(Y가 가장 큰) 일치 몬스터 타깃팅
        this.monsters.forEach(monster => {
            if (monster.word === cleanInput) {
                if (monster.y > maxY) {
                    maxY = monster.y;
                    target = monster;
                }
            }
        });

        return target;
    }

    /**
     * 지정 ID 몬스터 파괴 및 화면 제거
     * @param {number} monsterId 
     */
    destroyMonster(monsterId) {
        this.monsters = this.monsters.filter(m => m.id !== monsterId);
    }

    /**
     * 몬스터 바닥 도달 충돌 검사 (도달 시 삭제 및 통과 개수 리턴)
     * @returns {number} 바닥을과한 몬스터 개수
     */
    checkBottomCollision() {
        const bottomY = this.canvas.height - 60; // 포탑 라인 위치
        let passedCount = 0;

        this.monsters = this.monsters.filter(monster => {
            if (monster.y >= bottomY) {
                passedCount += (monster.isBoss ? 3 : 1); // 보스는 HP 3 차감
                return false; // 화면에서 제거
            }
            return true;
        });

        return passedCount;
    }

    /**
     * 현재 활성화된 몬스터 리스트 반환 (CanvasRenderer 전달용)
     */
    getMonsters() {
        return this.monsters;
    }
}
/**
 * MonsterManager.js
 * 인터넷 밈(Meme), 스트리머 유행어, 시청자 닉네임이 적용된 몬스터 관리 모듈
 */
class MonsterManager {
    constructor(canvas = null) {
        this.canvas = canvas;
        this.monsters = [];
        this.currentStage = 1;
        this.spawnInterval = null;
        this.speed = 1.0;

        // 🟢 1. 시청자 닉네임 목록 (상단 Pill Tag용)
        this.viewerNicknames = [
            '억까의신', 'SOOP팬클럽', 'CHZZK열혈', '구독자3년차', '트수1호',
            '매니저_김철수', '방장훈수꾼', '채팅창빌런', '펀치킹', '도네_백만원',
            '익명의후원자', '스팸게시자', '알고리즘수혜자', '과몰입러', '소통전문가'
        ];

        // 🔥 2. 인터넷 밈 & 방송 유행어 제시어 팩 (하단 Target Box용)
        this.words = [
            // 밈 & 유행어
            '구독과좋아요', '오타내지마라', '쀍', '어쩔티비', '뇌절금지',
            '이게맞냐', '억까자제', '스트리머능지', '개같이부활', 'ㄱㅐㄱㅏㅌㅇㅣ',
            '나송함다', '폼미쳤다', '레전드갱신', '나만아니면돼', '가즈아',
            '킹받네', '무한제공참말사', '알빠임', '개추', '비추',
            '구독취소한다', '방종각', '실수다', '골드버그', '치트키',
            '버그냐고', '아몰랑', '멘탈바사삭', '개꿀잼', '알고리즘'
        ];
    }

    getMonsters() {
        return this.monsters || [];
    }

    /**
     * 스테이지 시작 메서드
     * @param {number} stage - 스테이지 번호
     * @param {string|Array} difficultyOrWords - 난이도 또는 커스텀 단어 배열
     */
    startStage(stage = 1, difficultyOrWords = 'normal') {
        this.clear();
        this.currentStage = stage;

        let speedMult = 1.0;
        if (typeof difficultyOrWords === 'string') {
            const mults = { easy: 0.8, normal: 1.0, hard: 1.4, hell: 2.0 };
            speedMult = mults[difficultyOrWords] || 1.0;
        } else if (Array.isArray(difficultyOrWords) && difficultyOrWords.length > 0) {
            this.words = difficultyOrWords;
        }

        this.speed = (1.0 + (stage - 1) * 0.2) * speedMult;

        console.log(`[MonsterManager] Stage ${stage} 시작! (밈 제시어 수: ${this.words.length}개)`);

        // 주기적 몬스터 생성 (최대 15마리 제한 적용)
        this.spawnInterval = setInterval(() => {
            if (this.monsters.length < 15) { // Max Monster Cap = 15
                this.spawnMonster();
            }
        }, Math.max(700, 2400 - (stage * 150)));

        this.spawnMonster();
    }

    /**
     * 시청자 닉네임과 밈 제시어가 결합된 2단 몬스터 생성
     */
    spawnMonster() {
        const randomWord = this.words[Math.floor(Math.random() * this.words.length)];

        // 시청자 닉네임 무작위 할당 (70% 확률로 일반 시청자, 30% 확률로 [BOT])
        let nickname = '';
        if (Math.random() < 0.7) {
            nickname = this.viewerNicknames[Math.floor(Math.random() * this.viewerNicknames.length)];
        } else {
            const botNames = ['[BOT] 자동소환봇', '[BOT] 알파고', '[BOT] 타자시뮬레이터'];
            nickname = botNames[Math.floor(Math.random() * botNames.length)];
        }

        const canvasWidth = this.canvas ? this.canvas.width : (window.innerWidth || 800);

        const monster = {
            id: Date.now() + Math.random(),
            username: nickname,  // 🏷️ 상단: 시청자 닉네임
            text: randomWord,    // 🎯 하단: 밈 제시어
            x: Math.random() * (canvasWidth - 180) + 90, // 화면 좌우 넘침 방지
            y: 40,
            speed: this.speed,
            scoreValue: 100 * this.currentStage,
            hp: 1
        };

        this.monsters.push(monster);
    }

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
            return {
                success: true,
                monster: killedMonster,
                score: killedMonster.scoreValue,
                isKilled: true
            };
        }

        return { success: false };
    }

    update(deltaTime = 0.016, stage = 1) {
        let reachedCount = 0;
        const canvasHeight = this.canvas ? this.canvas.height : 600;
        const bottomY = canvasHeight - 60;

        for (let i = this.monsters.length - 1; i >= 0; i--) {
            this.monsters[i].y += this.monsters[i].speed * (deltaTime * 60);

            if (this.monsters[i].y >= bottomY) {
                this.monsters.splice(i, 1);
                reachedCount++;
            }
        }

        return reachedCount;
    }

    clear() {
        if (this.spawnInterval) {
            clearInterval(this.spawnInterval);
            this.spawnInterval = null;
        }
        this.monsters = [];
    }
}

window.MonsterManager = MonsterManager;
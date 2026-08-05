/**
 * ==========================================
 * Word Typing Defense - TurretManager
 * ==========================================
 * 참여 인원(1~6인)에 따른 포탑 자동 균등 배치,
 * 타깃 몬스터 자동/개별 조준 회전 각도(θ) 계산 및 사격 궤적을 담당합니다.
 */

class TurretManager {
    /**
     * @param {HTMLCanvasElement|null} canvas 
     */
    constructor(canvas = null) {
        this.canvas = canvas || (typeof document !== 'undefined' ? document.getElementById('gameCanvas') : null);
        this.turrets = [];
        this.playerCount = 1;

        // 플레이어별 고유 네온 테마 컬러 (1P ~ 6P)
        this.playerColors = [
            '#00f3ff', // 1P: Cyber Cyan
            '#ff0055', // 2P: Neon Pink
            '#00ff66', // 3P: Lime Green
            '#ffaa00', // 4P: Neon Gold
            '#a000ff', // 5P: Purple Electric
            '#ffffff'  // 6P: Pure White
        ];

        if (this.canvas) {
            this.setupTurrets(1);
        }
    }

    /**
     * 플레이어 인원 수(1~6명)에 따라 포탑 N개 균등 좌표 배치
     * @param {number} count 
     * @param {Array<string>} customNames - 플레이어 닉네임 목록 (선택)
     * @param {HTMLCanvasElement|null} canvas - 전달할 Canvas 객체 (선택)
     */
    setupTurrets(count = 1, customNames = [], canvas = null) {
        if (canvas) this.canvas = canvas;
        if (!this.canvas && typeof document !== 'undefined') {
            this.canvas = document.getElementById('gameCanvas');
        }

        if (!this.canvas) {
            console.warn("TurretManager: gameCanvas 요소를 찾을 수 없어 포탑 셋업을 대기합니다.");
            return;
        }

        this.playerCount = Math.min(Math.max(count, 1), 6);
        this.turrets = [];

        const width = this.canvas.width || 1000;
        const height = this.canvas.height || 750;

        const paddingY = 45;
        const yPos = height - paddingY;
        const segmentWidth = width / (this.playerCount + 1);

        for (let i = 0; i < this.playerCount; i++) {
            const xPos = segmentWidth * (i + 1);
            const name = (customNames && customNames[i]) ? customNames[i] : `P${i + 1}`;
            const color = this.playerColors[i % this.playerColors.length];

            this.turrets.push({
                id: i + 1,
                index: i,
                name: name,
                x: xPos,
                y: yPos,
                angle: -Math.PI / 2, // 초기 각도: 하늘 방향 (-90도)
                targetAngle: -Math.PI / 2,
                color: color,
                isRecoil: false,     // 사격 반동 이펙트 플래그
                recoilOffset: 0,
                lastFiredTime: 0
            });
        }
    }

    /**
     * 창 크기 변경 시 포탑 위치 균등 재배치
     */
    repositionTurrets() {
        if (!this.canvas || this.turrets.length === 0) return;

        const width = this.canvas.width;
        const height = this.canvas.height;
        const paddingY = 45;
        const yPos = height - paddingY;
        const segmentWidth = width / (this.playerCount + 1);

        this.turrets.forEach((turret, index) => {
            turret.x = segmentWidth * (index + 1);
            turret.y = yPos;
        });
    }

    /**
     * 타깃 몬스터 조준 및 사격 처리
     * @param {Object} targetMonster - { x, y }
     * @param {number|null} preferredPlayerIdx - 지정 플레이어 인덱스 (0-based)
     * @returns {Object} 조준/사격에 사용된 포탑 객체
     */
    aimAndFire(targetMonster, preferredPlayerIdx = null) {
        if (this.turrets.length === 0 || !targetMonster) return null;

        let selectedTurret = null;

        // 1. 플레이어 인덱스가 전달된 경우 (0-based 예: 0 = 1P, 1 = 2P)
        if (typeof preferredPlayerIdx === 'number' && preferredPlayerIdx >= 0 && preferredPlayerIdx < this.turrets.length) {
            selectedTurret = this.turrets[preferredPlayerIdx];
        } else {
            // 2. 통합 입력 모드 또는 지정 없을 시: 몬스터와 가장 가까운 포탑 자동 선택
            let minDistance = Infinity;

            this.turrets.forEach(turret => {
                const dx = targetMonster.x - turret.x;
                const dy = targetMonster.y - turret.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < minDistance) {
                    minDistance = distance;
                    selectedTurret = turret;
                }
            });
        }

        if (selectedTurret) {
            // 회전 각도(θ) 연산: atan2(dy, dx)
            const dx = targetMonster.x - selectedTurret.x;
            const dy = targetMonster.y - selectedTurret.y;
            const angle = Math.atan2(dy, dx);

            selectedTurret.targetAngle = angle;
            selectedTurret.angle = angle; // 사격 즉시 조준
            selectedTurret.isRecoil = true;
            selectedTurret.recoilOffset = 8; // 반동 깊이
            selectedTurret.lastFiredTime = performance.now();
        }

        return selectedTurret;
    }

    /**
     * game.js 구버전 및 서브모듈 호출 호환용 래퍼 메서드
     * @param {number} playerIdx 
     * @param {Object} targetMonster 
     */
    fire(playerIdx, targetMonster) {
        return this.aimAndFire(targetMonster, playerIdx);
    }

    /**
     * 매 프레임 포탑 회전 및 반동(Recoil) 애니메이션 업데이트
     * @param {number} deltaTime 
     */
    update(deltaTime = 0.016) {
        this.turrets.forEach(turret => {
            // 반동 감쇄 복원
            if (turret.isRecoil) {
                turret.recoilOffset -= deltaTime * 40;
                if (turret.recoilOffset <= 0) {
                    turret.recoilOffset = 0;
                    turret.isRecoil = false;
                }
            }

            // 서서히 중앙(-90도)으로 복귀하는 회전 애니메이션
            const idleAngle = -Math.PI / 2;
            const angleDiff = idleAngle - turret.angle;
            turret.angle += angleDiff * deltaTime * 2.0;
        });
    }

    /**
     * 포탑 데이터 목록 반환 (CanvasRenderer 전달용)
     */
    getTurrets() {
        return this.turrets || [];
    }
}

// 전역 window 및 module 등록
if (typeof window !== 'undefined') {
    window.TurretManager = TurretManager;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TurretManager;
}
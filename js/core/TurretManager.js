/**
 * ==========================================
 * Word Typing Defense - TurretManager
 * ==========================================
 * 참여 인원(1~6인)에 따른 포탑 자동 균등 배치,
 * 타깃 몬스터 자동/개별 조준 회전 각도(θ) 계산 및 사격 궤적을 담당합니다.
 */

class TurretManager {
    /**
     * @param {HTMLCanvasElement} canvas 
     */
    constructor(canvas) {
        this.canvas = canvas;
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

        // 기본 포탑 셋업
        this.setupTurrets(1);
    }

    /**
     * 플레이어 인원 수(1~6명)에 따라 포탑 N개 균등 좌표 배치
     * @param {number} count 
     * @param {Array<string>} customNames - 플레이어 닉네임 목록 (선택)
     */
    setupTurrets(count = 1, customNames = []) {
        this.playerCount = Math.min(Math.max(count, 1), 6);
        this.turrets = [];

        const width = this.canvas.width;
        const height = this.canvas.height;

        // Canvas 하단 여백 및 균등 간격(X) 계산
        const paddingY = 45;
        const yPos = height - paddingY;
        const segmentWidth = width / (this.playerCount + 1);

        for (let i = 0; i < this.playerCount; i++) {
            const xPos = segmentWidth * (i + 1);
            const name = customNames[i] || `P${i + 1}`;
            const color = this.playerColors[i % this.playerColors.length];

            this.turrets.push({
                id: i + 1,
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
     * @param {number|null} preferredPlayerId - 지정 플레이어 ID (개별 입력 모드 시)
     * @returns {Object} 조준/사격에 사용된 포탑 객체
     */
    aimAndFire(targetMonster, preferredPlayerId = null) {
        if (this.turrets.length === 0) return null;

        let selectedTurret = null;

        // 1. 개별 입력 모드: 지정 플레이어 포탑 사용
        if (preferredPlayerId && preferredPlayerId <= this.turrets.length) {
            selectedTurret = this.turrets[preferredPlayerId - 1];
        } else {
            // 2. 통합 입력 모드: 몬스터와 가장 가까운 최적의 포탑 자동 선택
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
            selectedTurret.angle = angle; // 타자 사격 특성상 즉시 조준
            selectedTurret.isRecoil = true;
            selectedTurret.recoilOffset = 8; // 사격 반동 깊이
            selectedTurret.lastFiredTime = performance.now();
        }

        return selectedTurret;
    }

    /**
     * 매 프레임 포탑 회전 및 반동(Recoil) 애니메이션 업데이트
     * @param {number} deltaTime 
     */
    update(deltaTime) {
        this.turrets.forEach(turret => {
            // 반동 감쇄 복원 (Spring effect)
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
        return this.turrets;
    }
}
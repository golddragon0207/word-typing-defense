/**
 * ==========================================
 * Word Typing Defense - TurretManager
 * ==========================================
 * 1인 솔로 스트리머 전용 단일 중앙 포탑 배치,
 * 타깃 몬스터 자동/개별 조준 회전 각도(θ) 계산 및 사격 궤적을 담당합니다.
 */

class TurretManager {
    /**
     * @param {HTMLCanvasElement|null} canvas 
     */
    constructor(canvas = null) {
        this.canvas = canvas || (typeof document !== 'undefined' ? document.getElementById('gameCanvas') : null);
        this.turrets = [];
        this.playerCount = 1; // 1인 솔로 모드 고정

        // 스트리머 전용 네온 시안 테마 컬러
        this.playerColors = [
            '#00f3ff' // Cyber Cyan
        ];

        if (this.canvas) {
            this.setupTurrets(1);
        }
    }

    /**
     * 1인 솔로 플레이어 포탑 Canvas 하단 중앙 배치
     * @param {number} count - 1인 고정 (구버전 호환용)
     * @param {Array<string>} customNames - 스트리머 닉네임 목록 (선택)
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

        // 1인 솔로 모드 고정 (계획서 v2.0 스펙)
        this.playerCount = 1;
        this.turrets = [];

        // ⚠️ canvas.width/height는 백버퍼(표시크기×DPR) 해상도이므로,
        // CanvasRenderer가 setTransform으로 매핑하는 논리 좌표계(1024×708)와 일치하는
        // clientWidth/clientHeight(고정 CSS 픽셀)를 기준으로 좌표를 계산해야 한다.
        const width = this.canvas.clientWidth || 1024;
        const height = this.canvas.clientHeight || 708;

        // 하단 타자 입력창(채팅 입력 바)이 대포를 가리지 않도록 포탑을 위로 올린다.
        // (방어선 groundY = height-130 바로 아래에 대포가 위치 — 대포는 중앙 유지)
        const paddingY = 105;
        const yPos = height - paddingY;
        const xPos = width / 2; // 화면 중앙 배치

        const name = (customNames && customNames[0]) ? customNames[0] : '스트리머';
        const color = this.playerColors[0];

        this.turrets.push({
            id: 1,
            index: 0,
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

    /**
     * 타깃 몬스터 조준 및 사격 처리
     * @param {Object} targetMonster - { x, y }
     * @param {number|null} preferredPlayerIdx - 지정 플레이어 인덱스 (0번 고정)
     * @returns {Object} 조준/사격에 사용된 포탑 객체
     */
    aimAndFire(targetMonster, preferredPlayerIdx = null) {
        if (this.turrets.length === 0 || !targetMonster) return null;

        const selectedTurret = this.turrets[0];

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
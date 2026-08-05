/**
 * ==========================================
 * Word Typing Defense - CanvasRenderer
 * ==========================================
 * devicePixelRatio 기반 HiDPI 고해상도 Canvas Draw,
 * 2단 몬스터 UI, 다중 포탑, 레이저 및 폭발 파티클 연출 전담
 */

class CanvasRenderer {
    /**
     * @param {HTMLCanvasElement|null} canvas 
     */
    constructor(canvas = null) {
        // 1. 외부에서 전달받지 못했거나 undefined인 경우 안전하게 DOM에서 직접 탐색
        this.canvas = canvas || document.getElementById('gameCanvas');

        if (!this.canvas) {
            console.error("❌ CanvasRenderer: #gameCanvas 요소를 찾을 수 없습니다! HTML에 canvas 태그를 확인하세요.");
            return;
        }

        this.ctx = this.canvas.getContext('2d');

        // 파티클 및 시각 이펙트 배열
        this.particles = [];
        this.lasers = [];

        // Retina / 4K 대응 스케일링 비율
        this.dpr = window.devicePixelRatio || 1;
    }

    /**
     * HiDPI(Retina/4K) 모니터 대응 Canvas 크기 자동 재설정
     */
    resizeCanvas() {
        if (!this.canvas) {
            this.canvas = document.getElementById('gameCanvas');
            if (!this.canvas) return;
        }

        const rect = this.canvas.getBoundingClientRect();
        this.dpr = window.devicePixelRatio || 1;

        // 물리적 픽셀 크기 확대
        this.canvas.width = rect.width * this.dpr;
        this.canvas.height = rect.height * this.dpr;

        // CSS 논리적 크기 고정
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;

        if (this.ctx) {
            this.ctx.scale(this.dpr, this.dpr);
        }
    }

    /**
     * 화면 전체 클리어
     */
    clear() {
        if (!this.ctx || !this.canvas) return;
        const width = this.canvas.width / this.dpr;
        const height = this.canvas.height / this.dpr;
        this.ctx.clearRect(0, 0, width, height);
    }

    /**
     * 포탑 목록 렌더링
     */
    drawTurrets(turrets) {
        if (!this.ctx || !turrets) return;

        turrets.forEach(turret => {
            this.ctx.save();
            this.ctx.translate(turret.x, turret.y - (turret.recoilOffset || 0));
            this.ctx.rotate(turret.angle);

            // 포탑 본체 그리기
            this.ctx.fillStyle = turret.color || '#00f3ff';
            this.ctx.shadowColor = turret.color || '#00f3ff';
            this.ctx.shadowBlur = 10;

            this.ctx.beginPath();
            this.ctx.arc(0, 0, 16, 0, Math.PI * 2);
            this.ctx.fill();

            // 포신 그리기
            this.ctx.fillRect(-4, -26, 8, 24);
            this.ctx.restore();

            // 하단 스트리머 닉네임 라벨
            this.ctx.save();
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = 'bold 13px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(turret.name, turret.x, turret.y + 28);
            this.ctx.restore();
        });
    }

    /**
     * 2단 몬스터 UI 렌더링 (상단 닉네임 뱃지 + 하단 제시어 박스)
     */
    drawMonsters(monsters) {
        if (!this.ctx || !monsters) return;

        monsters.forEach(m => {
            this.ctx.save();

            // 몬스터 박스 스타일
            this.ctx.fillStyle = m.isBot ? 'rgba(50, 50, 60, 0.9)' : 'rgba(20, 25, 40, 0.9)';
            this.ctx.strokeStyle = m.color || '#ff0055';
            this.ctx.lineWidth = 2;
            this.ctx.shadowColor = m.color || '#ff0055';
            this.ctx.shadowBlur = 8;

            const boxWidth = 110;
            const boxHeight = 45;
            const drawX = m.x - boxWidth / 2;
            const drawY = m.y - boxHeight / 2;

            // 메인 제시어 박스
            this.ctx.beginPath();
            this.ctx.roundRect(drawX, drawY, boxWidth, boxHeight, 8);
            this.ctx.fill();
            this.ctx.stroke();

            // 1. 하단 메인 제시어 텍스트 (Clean Target Word)
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = 'bold 15px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(m.word, m.x, m.y + 4);

            // 2. 상단 Pill Tag (시청자 닉네임 또는 [BOT] 뱃지)
            const tagText = m.isBot ? '[BOT] 자동소환' : (m.viewerName || '시청자');
            this.ctx.font = 'bold 10px sans-serif';
            const textWidth = this.ctx.measureText(tagText).width;
            const tagWidth = textWidth + 14;
            const tagHeight = 18;
            const tagX = m.x - tagWidth / 2;
            const tagY = drawY - 22;

            this.ctx.fillStyle = m.isBot ? '#4a5568' : '#00f3ff';
            this.ctx.beginPath();
            this.ctx.roundRect(tagX, tagY, tagWidth, tagHeight, 9);
            this.ctx.fill();

            this.ctx.fillStyle = '#0a0a0f';
            this.ctx.fillText(tagText, m.x, tagY + 9);

            this.ctx.restore();
        });
    }

    /**
     * 레이저 이펙트 추가
     */
    addLaserEffect(startPos, targetPos) {
        this.lasers.push({
            startX: startPos.x,
            startY: startPos.y,
            endX: targetPos.x,
            endY: targetPos.y,
            alpha: 1.0,
            color: startPos.color || '#00f3ff'
        });
    }

    /**
     * 폭발 파티클 추가
     */
    addExplosionEffect(targetPos) {
        for (let i = 0; i < 12; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 4 + 2;
            this.particles.push({
                x: targetPos.x,
                y: targetPos.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: Math.random() * 4 + 2,
                alpha: 1.0,
                color: '#ffaa00'
            });
        }
    }

    /**
     * 이펙트 애니메이션 업데이트
     */
    updateEffects(deltaTime) {
        // 레이저 페이드아웃
        this.lasers.forEach(laser => {
            laser.alpha -= deltaTime * 4;
        });
        this.lasers = this.lasers.filter(l => l.alpha > 0);

        // 파티클 이동 및 페이드아웃
        this.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.alpha -= deltaTime * 2;
        });
        this.particles = this.particles.filter(p => p.alpha > 0);
    }

    /**
     * 이펙트 렌더링
     */
    drawEffects() {
        if (!this.ctx) return;

        // 1. 레이저 Draw
        this.lasers.forEach(laser => {
            this.ctx.save();
            this.ctx.strokeStyle = laser.color;
            this.ctx.lineWidth = 3;
            this.ctx.globalAlpha = laser.alpha;
            this.ctx.shadowColor = laser.color;
            this.ctx.shadowBlur = 12;

            this.ctx.beginPath();
            this.ctx.moveTo(laser.startX, laser.startY);
            this.ctx.lineTo(laser.endX, laser.endY);
            this.ctx.stroke();
            this.ctx.restore();
        });

        // 2. 파티클 Draw
        this.particles.forEach(p => {
            this.ctx.save();
            this.ctx.globalAlpha = p.alpha;
            this.ctx.fillStyle = p.color;
            this.ctx.shadowColor = p.color;
            this.ctx.shadowBlur = 6;

            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        });
    }
}
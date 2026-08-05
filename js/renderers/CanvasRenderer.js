/**
 * CanvasRenderer.js
 * 캔버스 화면 그리기: 땅 경계선, 대포 포탑, 2단 몬스터(시청자 닉네임 + 제시어), 이펙트
 */
class CanvasRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas ? canvas.getContext('2d') : null;
        this.effects = [];
    }

    resizeCanvas() {
        if (!this.canvas) return;
        const container = this.canvas.parentElement;
        if (container) {
            this.canvas.width = container.clientWidth || 1024;
            this.canvas.height = container.clientHeight || 768;
        }
    }

    clear() {
        if (!this.ctx || !this.canvas) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 땅(방어선 및 지면) 경계선 렌더링
        this.drawGround();
    }

    /**
     * 바닥 방어선 지면 그리기
     */
    drawGround() {
        if (!this.ctx || !this.canvas) return;
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const groundY = height - 60;

        ctx.save();

        // 바닥 기지 지면 영역
        const gradient = ctx.createLinearGradient(0, groundY, 0, height);
        gradient.addColorStop(0, 'rgba(255, 0, 85, 0.2)');
        gradient.addColorStop(1, 'rgba(15, 19, 29, 0.9)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, groundY, width, height - groundY);

        // 방어선 네온 경계선
        ctx.shadowColor = '#ff0055';
        ctx.shadowBlur = 10;
        ctx.strokeStyle = '#ff0055';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        ctx.lineTo(width, groundY);
        ctx.stroke();

        // 경계선 상단 경고 텍스트
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255, 0, 85, 0.6)';
        ctx.font = 'bold 11px Orbitron, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('⚡ BASE DEFENSE LINE ⚡', width - 15, groundY - 8);

        ctx.restore();
    }

    /**
     * 대포 포탑 렌더링
     */
    drawTurrets(turrets = []) {
        if (!this.ctx) return;

        turrets.forEach(t => {
            const ctx = this.ctx;
            ctx.save();
            ctx.translate(t.x, t.y);

            // 포신 회전
            ctx.save();
            ctx.rotate(t.angle + Math.PI / 2);
            const recoil = t.recoilOffset || 0;

            // 대포 파이프 (Barrel)
            ctx.fillStyle = '#1e2230';
            ctx.strokeStyle = t.color || '#00f3ff';
            ctx.lineWidth = 3;
            ctx.fillRect(-8, -35 + recoil, 16, 35);
            ctx.strokeRect(-8, -35 + recoil, 16, 35);

            // 포구 포인트
            ctx.fillStyle = t.color || '#00f3ff';
            ctx.fillRect(-6, -38 + recoil, 12, 6);
            ctx.restore();

            // 대포 받침대 (Dome Base)
            ctx.beginPath();
            ctx.arc(0, 0, 22, Math.PI, 0, false);
            ctx.fillStyle = '#0f131d';
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = t.color || '#00f3ff';
            ctx.stroke();

            // 코어
            ctx.beginPath();
            ctx.arc(0, -5, 8, 0, Math.PI * 2);
            ctx.fillStyle = t.color || '#00f3ff';
            ctx.fill();

            // 닉네임 라벨
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 13px "Noto Sans KR", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(t.name, 0, 25);

            ctx.restore();
        });
    }

    /**
     * 🌟 2단 몬스터 렌더링 (상단: 시청자 닉네임 / 하단: 제시어)
     */
    drawMonsters(monsters = []) {
        if (!this.ctx) return;

        monsters.forEach(m => {
            const ctx = this.ctx;
            ctx.save();

            // 시청자 닉네임 설정 (없으면 [BOT] 챗봇 표식 지정)
            const nickname = m.username || m.viewerName || '[BOT] 시뮬레이터';
            const text = m.text || '단어';

            const boxWidth = 110;
            const boxHeight = 34;

            // 1. 🏷️ [1단] 상단 시청자 닉네임 뱃지 (Pill Tag)
            ctx.save();
            ctx.fillStyle = m.username ? 'rgba(0, 243, 255, 0.9)' : 'rgba(0, 255, 102, 0.85)';
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(m.x - (boxWidth / 2) + 5, m.y - 38, boxWidth - 10, 18, 10);
            } else {
                ctx.rect(m.x - (boxWidth / 2) + 5, m.y - 38, boxWidth - 10, 18);
            }
            ctx.fill();

            // 닉네임 텍스트
            ctx.fillStyle = '#0f131d';
            ctx.font = 'bold 11px "Noto Sans KR", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(nickname, m.x, m.y - 29);
            ctx.restore();

            // 2. 📦 [2단] 하단 타깃 제시어 상자 (Target Box)
            ctx.fillStyle = 'rgba(255, 0, 85, 0.85)';
            ctx.strokeStyle = '#ffcc00';
            ctx.lineWidth = 2;
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(m.x - (boxWidth / 2), m.y - 16, boxWidth, boxHeight, 8);
            } else {
                ctx.rect(m.x - (boxWidth / 2), m.y - 16, boxWidth, boxHeight);
            }
            ctx.fill();
            ctx.stroke();

            // 타격 제시어 텍스트
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 15px "Noto Sans KR", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, m.x, m.y + 2);

            ctx.restore();
        });
    }

    addLaserEffect(turretPos, monster) {
        this.effects.push({
            type: 'laser',
            x1: turretPos.x,
            y1: turretPos.y,
            x2: monster.x,
            y2: monster.y,
            color: turretPos.color || '#00ffff',
            life: 0.15
        });
    }

    addExplosionEffect(monster) {
        this.effects.push({
            type: 'explosion',
            x: monster.x,
            y: monster.y,
            radius: 10,
            maxRadius: 35,
            life: 0.25
        });
    }

    updateEffects(deltaTime = 0.016) {
        for (let i = this.effects.length - 1; i >= 0; i--) {
            this.effects[i].life -= deltaTime;
            if (this.effects[i].type === 'explosion') {
                this.effects[i].radius += (this.effects[i].maxRadius / 0.25) * deltaTime;
            }
            if (this.effects[i].life <= 0) {
                this.effects.splice(i, 1);
            }
        }
    }

    drawEffects() {
        if (!this.ctx) return;
        this.effects.forEach(ef => {
            this.ctx.save();
            if (ef.type === 'laser') {
                this.ctx.strokeStyle = ef.color || '#00ffff';
                this.ctx.lineWidth = 4;
                this.ctx.beginPath();
                this.ctx.moveTo(ef.x1, ef.y1);
                this.ctx.lineTo(ef.x2, ef.y2);
                this.ctx.stroke();
            } else if (ef.type === 'explosion') {
                this.ctx.strokeStyle = '#ffaa00';
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.arc(ef.x, ef.y, ef.radius, 0, Math.PI * 2);
                this.ctx.stroke();
            }
            this.ctx.restore();
        });
    }
}

window.CanvasRenderer = CanvasRenderer;
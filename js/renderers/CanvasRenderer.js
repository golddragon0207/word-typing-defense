/**
 * CanvasRenderer.js
 * 캔버스 화면 그리기: 땅 경계선, 대포 포탑, 2단 몬스터(시청자 닉네임 + 제시어), 이펙트
 */
class CanvasRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas ? canvas.getContext('2d') : null;
        this.effects = [];
        this.dpr = window.devicePixelRatio || 1;
    }

    /**
     * Retina / 4K 디스플레이 고해상도 렌더링 대응
     */
    resizeCanvas() {
        if (!this.canvas) return;
        const container = this.canvas.parentElement;
        this.dpr = window.devicePixelRatio || 1;

        const displayWidth = container ? (container.clientWidth || 1024) : 1024;
        const displayHeight = container ? (container.clientHeight || 768) : 768;

        // 캔버스 내부 해상도를 devicePixelRatio 비율만큼 확대
        this.canvas.width = displayWidth * this.dpr;
        this.canvas.height = displayHeight * this.dpr;

        // CSS 렌더링 크기는 고정
        this.canvas.style.width = `${displayWidth}px`;
        this.canvas.style.height = `${displayHeight}px`;

        if (this.ctx) {
            // 확대된 해상도 비율에 맞춰 좌표계 스케일 조정
            this.ctx.scale(this.dpr, this.dpr);
        }
    }

    clear() {
        if (!this.ctx || !this.canvas) return;
        const width = this.canvas.width / this.dpr;
        const height = this.canvas.height / this.dpr;

        this.ctx.clearRect(0, 0, width, height);

        // 땅(방어선 및 지면) 경계선 렌더링
        this.drawGround();
    }

    /**
     * 바닥 방어선 지면 그리기
     */
    drawGround() {
        if (!this.ctx || !this.canvas) return;
        const ctx = this.ctx;
        const width = this.canvas.width / this.dpr;
        const height = this.canvas.height / this.dpr;

        // 하단 타자 입력창(채팅 입력 바)이 대포/방어선을 가리지 않도록 방어선 Y좌표를 위로 올림
        const groundY = height - 190;

        ctx.save();

        // 바닥 기지 지면 영역
        const gradient = ctx.createLinearGradient(0, groundY, 0, height);
        gradient.addColorStop(0, 'rgba(255, 0, 85, 0.25)');
        gradient.addColorStop(1, 'rgba(15, 19, 29, 0.95)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, groundY, width, height - groundY);

        // 방어선 네온 경계선
        ctx.shadowColor = '#ff0055';
        ctx.shadowBlur = 12;
        ctx.strokeStyle = '#ff0055';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        ctx.lineTo(width, groundY);
        ctx.stroke();

        // 경계선 상단 경고 텍스트 (OBS 크로마키 대응 Stroke 적용)
        ctx.shadowBlur = 0;
        ctx.font = 'bold 11px Orbitron, sans-serif';
        ctx.textAlign = 'right';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeText('⚡ BASE DEFENSE LINE ⚡', width - 15, groundY - 8);
        ctx.fillStyle = '#ff0055';
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

            // 닉네임 라벨 (OBS 가시성 Stroke 적용)
            ctx.font = 'bold 13px "Noto Sans KR", sans-serif';
            ctx.textAlign = 'center';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.strokeText(t.name, 0, 25);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(t.name, 0, 25);

            ctx.restore();
        });
    }

    /**
     * 🌟 2단 몬스터 렌더링 (상단: 시청자 닉네임 / 하단: 제시어)
     * 보스(m.isBoss)는 확대된 크기와 금색 테마로 강조 렌더링
     */
    drawMonsters(monsters = []) {
        if (!this.ctx) return;

        monsters.forEach(m => {
            const ctx = this.ctx;
            ctx.save();

            const nickname = m.username || m.viewerName || '[BOT] 시뮬레이터';
            const text = m.text || '단어';
            const isBoss = !!m.isBoss;

            const scale = isBoss ? 1.65 : 1;
            const boxHeight = 34 * scale;

            // 📏 글자 길이에 맞춰 박스 폭 동적 계산 (긴 단어가 박스를 넘치지 않도록)
            //    닉네임/제시어 중 더 넓은 쪽 기준 + 좌우 여백, 최소폭 110px는 보장
            const wordFont = `bold ${Math.round(15 * scale)}px "Noto Sans KR", sans-serif`;
            const nickFont = `bold ${Math.round(11 * scale)}px "Noto Sans KR", sans-serif`;
            ctx.font = wordFont;
            const wordW = ctx.measureText(text).width;
            ctx.font = nickFont;
            const nickW = ctx.measureText(nickname).width;
            const boxWidth = Math.max(110 * scale, Math.max(wordW, nickW) + 26 * scale);

            // 👑 보스 전용 후광 링 이펙트
            if (isBoss) {
                ctx.save();
                ctx.strokeStyle = 'rgba(255, 204, 0, 0.55)';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(m.x, m.y - 2, boxWidth * 0.62, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            // 1. 🏷️ [1단] 상단 시청자 닉네임 뱃지 (Pill Tag)
            ctx.save();
            ctx.fillStyle = isBoss
                ? 'rgba(255, 204, 0, 0.95)'
                : (m.isBot ? 'rgba(0, 255, 102, 0.85)' : 'rgba(0, 243, 255, 0.9)');
            ctx.beginPath();
            const pillY = m.y - 38 * scale;
            const pillH = 18 * scale;
            if (ctx.roundRect) {
                ctx.roundRect(m.x - (boxWidth / 2) + 5, pillY, boxWidth - 10, pillH, 10);
            } else {
                ctx.rect(m.x - (boxWidth / 2) + 5, pillY, boxWidth - 10, pillH);
            }
            ctx.fill();

            // 닉네임 텍스트
            ctx.font = `bold ${Math.round(11 * scale)}px "Noto Sans KR", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.strokeText(nickname, m.x, pillY + pillH / 2);
            ctx.fillStyle = '#0f131d';
            ctx.fillText(nickname, m.x, pillY + pillH / 2);
            ctx.restore();

            // 2. 📦 [2단] 하단 타깃 제시어 상자 (Target Box)
            // 💬 라이브 채팅 모드로 실제 채팅 문구가 그대로 쓰인 몬스터는 보라색으로 강조
            const isLiveChat = !!m.isLiveChat && !isBoss;
            ctx.fillStyle = isBoss ? 'rgba(140, 0, 30, 0.95)' : (isLiveChat ? 'rgba(120, 0, 200, 0.9)' : 'rgba(255, 0, 85, 0.9)');
            ctx.strokeStyle = isLiveChat ? '#bf00ff' : '#ffcc00';
            ctx.lineWidth = isBoss ? 4 : 2.5;
            ctx.shadowColor = isBoss ? 'rgba(255, 204, 0, 0.8)' : (isLiveChat ? 'rgba(191, 0, 255, 0.7)' : 'transparent');
            ctx.shadowBlur = isBoss ? 18 : (isLiveChat ? 12 : 0);
            ctx.beginPath();
            const boxY = m.y - 16 * scale;
            if (ctx.roundRect) {
                ctx.roundRect(m.x - (boxWidth / 2), boxY, boxWidth, boxHeight, 8);
            } else {
                ctx.rect(m.x - (boxWidth / 2), boxY, boxWidth, boxHeight);
            }
            ctx.fill();
            ctx.stroke();
            ctx.shadowBlur = 0;

            // 타격 제시어 텍스트
            ctx.font = `bold ${Math.round(15 * scale)}px "Noto Sans KR", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3.5;
            ctx.strokeText(text, m.x, boxY + boxHeight / 2);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(text, m.x, boxY + boxHeight / 2);

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
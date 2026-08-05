/**
 * ==========================================
 * Word Typing Defense - CanvasRenderer
 * ==========================================
 * devicePixelRatio 기반 HiDPI 고해상도 Canvas Draw,
 * 2단 몬스터 UI (상단: 닉네임 Tag / 하단: 제시어 Box),
 * 다중 포탑, 레이저 beam 및 폭발 파티클 연출을 전담합니다.
 */

class CanvasRenderer {
    /**
     * @param {HTMLCanvasElement} canvas 
     */
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

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
        if (!this.canvas) return;

        const rect = this.canvas.getBoundingClientRect();
        this.dpr = window.devicePixelRatio || 1;

        // 물리적 픽셀 크기 확대
        this.canvas.width = rect.width * this.dpr;
        this.canvas.height = rect.height * this.dpr;

        // CSS 논리적 크기 고정
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;

        // 2D 컨텍스트 스케일 보정
        this.ctx.scale(this.dpr, this.dpr);
    }

    /**
     * 매 프레임 Canvas 화면 리셋
     */
    clear() {
        const width = this.canvas.width / this.dpr;
        const height = this.canvas.height / this.dpr;
        this.ctx.clearRect(0, 0, width, height);
    }

    /**
     * 1~6인 포탑 N개 Draw
     * @param {Array<Object>} turrets 
     */
    drawTurrets(turrets) {
        if (!turrets || turrets.length === 0) return;

        turrets.forEach(turret => {
            this.ctx.save();
            this.ctx.translate(turret.x, turret.y);

            // 1. 포탑 Base 닉네임 Tag Draw
            this.ctx.fillStyle = turret.color;
            this.ctx.shadowColor = turret.color;
            this.ctx.shadowBlur = 8;
            this.ctx.font = 'bold 12px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(turret.name, 0, 25);

            // 2. 포탑 회전 적용
            this.ctx.rotate(turret.angle);

            // 3. 포탑 포신 (Barrel) Draw (반동 recoilOffset 적용)
            const barrelLength = 35 - turret.recoilOffset;
            this.ctx.fillStyle = '#1e293b';
            this.ctx.strokeStyle = turret.color;
            this.ctx.lineWidth = 4;

            this.ctx.beginPath();
            this.ctx.rect(0, -6, barrelLength, 12);
            this.ctx.fill();
            this.ctx.stroke();

            // 4. 포탑 중심 Body Circle
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 14, 0, Math.PI * 2);
            this.ctx.fillStyle = '#0f172a';
            this.ctx.fill();
            this.ctx.stroke();

            this.ctx.restore();
        });
    }

    /**
     * 2단 몬스터 UI 렌더링 (상단: 닉네임 Pill Tag / 하단: clean 제시어 Box)
     * @param {Array<Object>} monsters 
     */
    drawMonsters(monsters) {
        if (!monsters || monsters.length === 0) return;

        monsters.forEach(monster => {
            this.ctx.save();
            this.ctx.translate(monster.x, monster.y);

            const width = monster.width;
            const height = monster.height;

            // ----------------------------------------------------
            // [상단] Pill Tag: 시청자 닉네임 (또는 [BOT] 자동소환봇)
            // ----------------------------------------------------
            const tagHeight = 18;
            const tagY = -tagHeight / 2 - 12;

            this.ctx.beginPath();
            this.ctx.roundRect(-width / 2, tagY, width, tagHeight, 9);

            // [BOT] 유무에 따른 상단 뱃지 배경색 차별화
            if (monster.isBot) {
                this.ctx.fillStyle = 'rgba(71, 85, 105, 0.85)'; // Slate Gray
            } else {
                this.ctx.fillStyle = monster.isBoss ? 'rgba(225, 29, 72, 0.9)' : 'rgba(14, 165, 233, 0.85)'; // Crimson / Neon Cyan
            }
            this.ctx.fill();

            // 닉네임 텍스트 Draw
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = 'bold 10px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(monster.nickname, 0, tagY + (tagHeight / 2));

            // ----------------------------------------------------
            // [하단] Target Box: clean 타깃 제시어
            // ----------------------------------------------------
            const boxY = 2;
            const boxHeight = height - 16;

            this.ctx.beginPath();
            this.ctx.roundRect(-width / 2, boxY, width, boxHeight, 8);

            // 보스 몬스터 네온 테마
            if (monster.isBoss) {
                this.ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
                this.ctx.strokeStyle = '#f43f5e';
                this.ctx.lineWidth = 3;
                this.ctx.shadowColor = '#f43f5e';
                this.ctx.shadowBlur = 12;
            } else {
                this.ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
                this.ctx.strokeStyle = monster.isBot ? '#64748b' : '#38bdf8';
                this.ctx.lineWidth = 2;
                this.ctx.shadowColor = monster.isBot ? '#64748b' : '#38bdf8';
                this.ctx.shadowBlur = 6;
            }
            this.ctx.fill();
            this.ctx.stroke();

            // 제시어 텍스트 Draw
            this.ctx.fillStyle = '#f8fafc';
            this.ctx.font = monster.isBoss ? 'bold 18px sans-serif' : 'bold 15px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(monster.word, 0, boxY + (boxHeight / 2));

            this.ctx.restore();
        });
    }

    /**
     * 레이저 사격 이펙트 등록
     */
    addLaserEffect(turret, monster) {
        if (!turret || !monster) return;

        this.lasers.push({
            startX: turret.x,
            startY: turret.y,
            endX: monster.x,
            endY: monster.y,
            color: turret.color,
            alpha: 1.0,
            lineWidth: 4
        });
    }

    /**
     * 폭발 파티클 이펙트 생성
     */
    addExplosionEffect(x, y) {
        const particleCount = 12;
        const colors = ['#00f3ff', '#ff0055', '#ffaa00', '#ffffff'];

        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 4;

            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: 3 + Math.random() * 3,
                alpha: 1.0,
                decay: 0.02 + Math.random() * 0.03
            });
        }
    }

    /**
     * 파티클 및 레이저 이펙트 프레임 업데이트
     * @param {number} deltaTime 
     */
    updateEffects(deltaTime) {
        // 1. 레이저 페이드 아웃
        this.lasers.forEach(laser => {
            laser.alpha -= deltaTime * 5; // 빠르게 소멸
        });
        this.lasers = this.lasers.filter(laser => laser.alpha > 0);

        // 2. 파티클 감쇄 및 이동
        this.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.alpha -= p.decay;
        });
        this.particles = this.particles.filter(p => p.alpha > 0);
    }

    /**
     * 레이저 및 파티클 그려주기
     */
    drawEffects() {
        // 1. 레이저 빔 Draw
        this.lasers.forEach(laser => {
            this.ctx.save();
            this.ctx.globalAlpha = laser.alpha;
            this.ctx.strokeStyle = laser.color;
            this.ctx.lineWidth = laser.lineWidth;
            this.ctx.shadowColor = laser.color;
            this.ctx.shadowBlur = 10;

            this.ctx.beginPath();
            this.ctx.moveTo(laser.startX, laser.startY);
            this.ctx.lineTo(laser.endX, laser.endY);
            this.ctx.stroke();
            this.ctx.restore();
        });

        // 2. 폭발 파티클 Draw
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

    /**
     * 상단 HUD / UI 오버레이 연출
     * @param {Object} gameData 
     */
    drawUIOverlay(gameData) {
        if (!gameData) return;

        // PLAYING 상태일 때만 HUD 출력
        if (gameData.state === 'PLAYING') {
            this.ctx.save();
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = 'bold 16px sans-serif';

            // 점수 & Stage 표시
            this.ctx.textAlign = 'left';
            this.ctx.fillText(`SCORE: ${gameData.score.toLocaleString()}`, 20, 30);
            this.ctx.fillText(`STAGE: ${gameData.stage}`, 20, 55);

            // 체력(HP) 게이지 표시
            this.ctx.textAlign = 'right';
            const width = this.canvas.width / this.dpr;
            this.ctx.fillText(`HP: ${gameData.hp} / ${gameData.maxHp}`, width - 20, 30);
            this.ctx.restore();
        }
    }
}
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

        // 🎯 논리(게임) 좌표계는 항상 1024×708 고정 (상단바 60px + 708 = 1024×768 PC 최소 해상도).
        //    모든 게임 로직/드로잉은 이 좌표계를 쓰므로 창 크기가 바뀌어도 좌표·방어선이
        //    변하지 않는다(리사이즈로 인한 몬스터 위치·방어선 급변 버그 원천 차단).
        //    화면에는 부모 무대(.game-viewport)가 transform:scale로 비율 유지하며 맞춰진다.
        this.LOGICAL_W = 1024;
        this.LOGICAL_H = 708;
    }

    /**
     * 백버퍼 해상도를 "실제 화면에 표시되는 픽셀 크기"에 맞춘다.
     * - 논리 좌표계(1024×708)는 setTransform으로 유지 → 드로잉 코드는 항상 0..1024/0..708 사용
     * - 표시 크기 = getBoundingClientRect(무대 scale 반영) × devicePixelRatio → 어떤 배율에서도 선명
     */
    resizeCanvas() {
        if (!this.canvas) return;
        this.dpr = window.devicePixelRatio || 1;

        const rect = this.canvas.getBoundingClientRect();
        const displayW = Math.max(1, Math.round((rect.width || this.LOGICAL_W) * this.dpr));
        const displayH = Math.max(1, Math.round((rect.height || this.LOGICAL_H) * this.dpr));

        this.canvas.width = displayW;
        this.canvas.height = displayH;
        // CSS 크기는 스타일시트(width/height:100%)가 담당 → 여기서 건드리지 않음

        if (this.ctx) {
            // 논리 좌표계(1024×708)를 백버퍼 픽셀로 매핑하는 변환 행렬
            this.ctx.setTransform(displayW / this.LOGICAL_W, 0, 0, displayH / this.LOGICAL_H, 0, 0);
        }
    }

    clear() {
        if (!this.ctx || !this.canvas) return;

        this.ctx.clearRect(0, 0, this.LOGICAL_W, this.LOGICAL_H);

        // 땅(방어선 및 지면) 경계선 렌더링
        this.drawGround();
    }

    /**
     * 바닥 방어선 지면 그리기
     */
    drawGround() {
        if (!this.ctx || !this.canvas) return;
        const ctx = this.ctx;
        const width = this.LOGICAL_W;
        const height = this.LOGICAL_H;

        // 하단 타자 입력창(채팅 입력 바)이 대포/방어선을 가리지 않도록 방어선 Y좌표를 위로 올림
        // (MonsterManager.update의 bottomY = canvasHeight - 160 과 반드시 동일하게 유지)
        const groundY = height - 160;

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
        ctx.strokeText('🛡️ BASE DEFENSE LINE 🛡️', width - 15, groundY - 8);
        ctx.fillStyle = '#ff0055';
        ctx.fillText('🛡️ BASE DEFENSE LINE 🛡️', width - 15, groundY - 8);

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

            // 🔎 선명도 확보: 텍스트/박스를 정수 픽셀에 스냅 (서브픽셀 렌더링으로 인한 흐림 방지)
            const cx = Math.round(m.x);
            const cy = Math.round(m.y);

            const scale = isBoss ? 1.65 : 1;
            const boxHeight = 40 * scale;

            // 📏 글자 길이에 맞춰 박스 폭 동적 계산 (긴 단어가 박스를 넘치지 않도록)
            //    닉네임/제시어 중 더 넓은 쪽 기준 + 좌우 여백, 최소폭 110px는 보장
            const wordFont = `500 ${Math.round(20 * scale)}px "Noto Sans KR", sans-serif`;
            const nickFont = `700 ${Math.round(14 * scale)}px "Noto Sans KR", sans-serif`;
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
                ctx.arc(cx, cy - 2, boxWidth * 0.62, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            // 1. 🏷️ [1단] 상단 시청자 닉네임 뱃지 (Pill Tag)
            //    누가 썼는지 잘 보이도록 완전 불투명 + 진한 테두리로 또렷하게
            ctx.save();
            const pillY = Math.round(cy - 42 * scale);
            const pillH = Math.round(22 * scale);
            const boxLeft = Math.round(cx - boxWidth / 2);
            const boxW = Math.round(boxWidth);
            ctx.fillStyle = isBoss
                ? 'rgb(255, 204, 0)'
                : (m.isBot ? 'rgb(0, 230, 92)' : 'rgb(0, 224, 255)');
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(boxLeft + 5, pillY, boxW - 10, pillH, 10);
            } else {
                ctx.rect(boxLeft + 5, pillY, boxW - 10, pillH);
            }
            ctx.fill();
            // 뱃지 외곽선(어두운 배경과 분리)
            ctx.strokeStyle = 'rgba(15, 19, 29, 0.9)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // 닉네임 텍스트: 밝은 뱃지 위 진한 글자를 외곽선 없이 그려 획이 또렷하게(흐림 방지)
            ctx.font = nickFont;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#0a0e16';
            ctx.fillText(nickname, cx, pillY + pillH / 2);
            ctx.restore();

            // 1-1. 🐲 차지 보스 UI — 닉네임 뱃지 위에 ①남은 격파 pip + ②차지 게이지 바
            if (isBoss && m.requiredHits) {
                ctx.save();
                const total = m.requiredHits;
                const remain = Math.max(0, total - (m.hitsLanded || 0)); // 남은 격파 수
                // ① 남은 격파 pip (붉음=남음 / 회색=완료)
                const pipR = Math.round(5 * scale);
                const gap = Math.round(6 * scale);
                const totalW = total * (pipR * 2) + (total - 1) * gap;
                const pipY = Math.round(pillY - 24 * scale);
                let px = Math.round(cx - totalW / 2 + pipR);
                for (let k = 0; k < total; k++) {
                    ctx.beginPath();
                    ctx.arc(px, pipY, pipR, 0, Math.PI * 2);
                    ctx.fillStyle = k < remain ? '#ff3b6b' : 'rgba(120, 122, 130, 0.55)';
                    ctx.fill();
                    ctx.lineWidth = 1.5;
                    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
                    ctx.stroke();
                    px += pipR * 2 + gap;
                }
                // ② 차지 게이지 바 (찰수록 노랑→빨강, 다 차면 공격)
                const ratio = m.chargeTime ? Math.min(1, (m.chargeElapsed || 0) / m.chargeTime) : 0;
                const barW = boxW;
                const barH = Math.round(6 * scale);
                const barX = boxLeft;
                const barY = Math.round(pillY - 13 * scale);
                ctx.fillStyle = 'rgba(10, 12, 20, 0.85)'; // 배경(빈 게이지)
                if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 3); ctx.fill(); }
                else ctx.fillRect(barX, barY, barW, barH);
                // 채움: 위험도에 따라 색 변화
                const fillColor = ratio > 0.75 ? '#ff2b2b' : (ratio > 0.45 ? '#ffaa00' : '#ffe14d');
                ctx.fillStyle = fillColor;
                const fw = Math.max(0, Math.round(barW * ratio));
                if (fw > 0) {
                    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(barX, barY, fw, barH, 3); ctx.fill(); }
                    else ctx.fillRect(barX, barY, fw, barH);
                }
                ctx.lineWidth = 1;
                ctx.strokeStyle = 'rgba(255, 204, 0, 0.7)';
                if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 3); ctx.stroke(); }
                else ctx.strokeRect(barX, barY, barW, barH);
                ctx.restore();
            }

            // 2. 📦 [2단] 하단 타깃 제시어 상자 (Target Box)
            // 💬 라이브 채팅 모드로 실제 채팅 문구가 그대로 쓰인 몬스터는 보라색으로 강조
            const isLiveChat = !!m.isLiveChat && !isBoss;
            // 🐲 보스 플래시: 격파(정타) 시 분홍, 공격 발동 시 강한 빨강으로 번쩍인다
            const nowP = (typeof performance !== 'undefined' ? performance.now() : Date.now());
            const hitFlash = isBoss && m._flashUntil && nowP < m._flashUntil;
            const atkFlash = isBoss && m._attackFlashUntil && nowP < m._attackFlashUntil;
            // 🔆 대비 극대화: 배경 박스를 완전 불투명·진한 색으로 하여 흰 글자가 매우 또렷하게
            ctx.fillStyle = isBoss ? (atkFlash ? 'rgb(255, 40, 40)' : (hitFlash ? 'rgb(255, 90, 120)' : 'rgb(130, 0, 26)')) : (isLiveChat ? 'rgb(74, 0, 140)' : 'rgb(168, 0, 52)');
            ctx.strokeStyle = isLiveChat ? '#bf00ff' : '#ffcc00';
            ctx.lineWidth = isBoss ? 4 : 2.5;
            ctx.shadowColor = isBoss ? (atkFlash ? 'rgba(255, 40, 40, 0.95)' : 'rgba(255, 204, 0, 0.8)') : (isLiveChat ? 'rgba(191, 0, 255, 0.7)' : 'transparent');
            ctx.shadowBlur = isBoss ? (atkFlash ? 42 : (hitFlash ? 32 : 18)) : (isLiveChat ? 12 : 0);
            ctx.beginPath();
            const boxY = Math.round(cy - 16 * scale);
            const boxHeightR = Math.round(boxHeight);
            if (ctx.roundRect) {
                ctx.roundRect(boxLeft, boxY, boxW, boxHeightR, 8);
            } else {
                ctx.rect(boxLeft, boxY, boxW, boxHeightR);
            }
            ctx.fill();
            ctx.stroke();
            ctx.shadowBlur = 0;

            // 타격 제시어 텍스트
            ctx.font = wordFont;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.lineJoin = 'round';
            ctx.miterLimit = 2;
            const textY = boxY + boxHeightR / 2;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.lineWidth = 1.5;
            ctx.strokeText(text, cx, textY);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(text, cx, textY);

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
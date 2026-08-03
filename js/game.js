/* ==========================================================================
   STREAMER WORD DEFENSE - CORE CANVAS GAME ENGINE (MULTI-PLAYER EXTENDED)
   ========================================================================== */

class GameEngine {
  constructor() {
    // Canvas & Context
    this.bgCanvas = document.getElementById('bg-canvas');
    this.bgCtx = this.bgCanvas.getContext('2d');
    this.gameCanvas = document.getElementById('game-canvas');
    this.ctx = this.gameCanvas.getContext('2d');

    // UI Elements
    this.hudScore = document.getElementById('hud-score');
    this.hudWpm = document.getElementById('hud-wpm');
    this.hudCombo = document.getElementById('hud-combo');
    this.hudHpFill = document.getElementById('hud-hp-fill');
    this.hudHpText = document.getElementById('hud-hp-text');
    this.hudFeverFill = document.getElementById('hud-fever-fill');

    // Screens
    this.screenMain = document.getElementById('screen-main');
    this.screenGameOver = document.getElementById('screen-gameover');
    this.gameHud = document.getElementById('game-hud');
    this.typingBar = document.getElementById('typing-input-bar');

    // Multi-Player System State
    this.presetColors = ['#00f3ff', '#ff007f', '#ffd700', '#00ff88', '#b026ff', '#ff6600'];
    this.playerCount = 1;
    this.gameRule = 'vs'; // 'vs' (개별 점수 경쟁) or 'coop' (협동 방어)
    this.inputMode = 'multi'; // 'multi' (플레이어별 개별 입력창) or 'single' (통합 1개)

    this.players = [
      { id: 0, name: '스트리머 A', color: '#00f3ff', score: 0, kills: 0, combo: 0 }
    ];

    // Game Loop & State
    this.isRunning = false;
    this.totalScore = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.hp = 100;
    this.maxHp = 100;
    this.fever = 0;
    this.isFeverMode = false;
    this.feverTimer = 0;
    this.kills = 0;

    // Metrics
    this.totalTypedChars = 0;
    this.totalTypedStrokes = 0;
    this.startTime = 0;

    // Entities
    this.monsters = [];
    this.particles = [];
    this.lasers = [];
    this.stars = [];
    this.turrets = [];

    this.spawnTimer = 0;
    this.spawnInterval = 120;
    this.animId = null;

    this.initEvents();
    this.initStars();
    this.updatePlayerSettingsUI();
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  // 플레이어 수에 따라 메인 메뉴의 닉네임 입력 UI 동적 생성
  updatePlayerSettingsUI() {
    const container = document.getElementById('player-settings-list');
    if (!container) return;
    container.innerHTML = '';

    const defaultNames = ['스트리머 A', '스트리머 B', '스트리머 C', '스트리머 D', '스트리머 E', '스트리머 F'];

    // 기존 설정 유지하면서 개수 맞춤
    while (this.players.length < this.playerCount) {
      const idx = this.players.length;
      this.players.push({
        id: idx,
        name: defaultNames[idx] || `스트리머 ${idx + 1}`,
        color: this.presetColors[idx % this.presetColors.length],
        score: 0,
        kills: 0,
        combo: 0
      });
    }
    if (this.players.length > this.playerCount) {
      this.players = this.players.slice(0, this.playerCount);
    }

    // 1인 솔로 시 복잡한 합방 전용 옵션 영역 숨김 / 2인 이상 시 노출
    const multiSection = document.getElementById('section-multi-options');
    if (this.playerCount === 1) {
      if (multiSection) multiSection.classList.add('hidden');
      this.inputMode = 'single';
      this.gameRule = 'coop';
    } else {
      if (multiSection) multiSection.classList.remove('hidden');
      const selectedRadio = document.querySelector('input[name="input-mode"]:checked');
      if (selectedRadio) this.inputMode = selectedRadio.value;
    }

    this.players.forEach((p, i) => {
      const card = document.createElement('div');
      card.className = 'player-name-card';
      card.innerHTML = `
        <span class="player-badge-dot" style="background-color: ${p.color}; color: ${p.color};"></span>
        <input type="text" value="${p.name}" placeholder="P${i + 1} 닉네임" data-pid="${i}" />
      `;

      card.querySelector('input').addEventListener('input', (e) => {
        this.players[i].name = e.target.value || `P${i + 1}`;
      });

      container.appendChild(card);
    });

    this.rebuildTurrets();
  }

  rebuildTurrets() {
    this.turrets = [];
    for (let i = 0; i < this.playerCount; i++) {
      const p = this.players[i];
      const x = ((i + 0.5) / this.playerCount) * this.width;
      this.turrets.push({
        x: x,
        y: this.height - 70,
        angle: -Math.PI / 2,
        color: p ? p.color : this.presetColors[i % this.presetColors.length],
        label: p ? p.name : `P${i + 1}`,
        playerId: i
      });
    }
  }

  resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.gameCanvas.width = Math.floor(this.width * dpr);
    this.gameCanvas.height = Math.floor(this.height * dpr);
    this.bgCanvas.width = Math.floor(this.width * dpr);
    this.bgCanvas.height = Math.floor(this.height * dpr);

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.rebuildTurrets();
  }

  initStars() {
    this.stars = [];
    for (let i = 0; i < 80; i++) {
      this.stars.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        size: Math.random() * 2 + 0.5,
        alpha: Math.random(),
        speed: Math.random() * 0.5 + 0.1
      });
    }
  }

  initEvents() {
    // 1. 인원 수 선택 버튼
    document.querySelectorAll('.btn-count').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-count').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.playerCount = parseInt(btn.dataset.count, 10) || 1;
        this.updatePlayerSettingsUI();
      });
    });

    // 2. 게임 방식 (VS / Co-op) 선택
    document.querySelectorAll('[data-rule]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-rule]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.gameRule = btn.dataset.rule;
      });
    });

    // 3. 입력 방식 라디오 선택
    document.querySelectorAll('input[name="input-mode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.inputMode = e.target.value;
      });
    });

    // 게임 시작 및 화면 이동
    document.getElementById('btn-start-game').addEventListener('click', () => this.startGame());
    document.getElementById('btn-restart').addEventListener('click', () => this.startGame());
    document.getElementById('btn-return-main').addEventListener('click', () => this.showMainScreen());

    // OBS & Sound
    document.getElementById('btn-obs-toggle').addEventListener('click', () => {
      document.body.classList.toggle('obs-transparent-mode');
    });

    document.getElementById('btn-sfx-toggle').addEventListener('click', (e) => {
      const state = audioSynth.toggleSound();
      e.target.innerText = state ? '🔊 사운드: ON' : '🔇 사운드: OFF';
    });

    // 모달 관리
    document.getElementById('btn-chat-modal').addEventListener('click', () => {
      document.getElementById('modal-chat').classList.remove('hidden');
    });

    document.getElementById('btn-word-modal').addEventListener('click', () => {
      document.getElementById('modal-words').classList.remove('hidden');
    });

    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.close;
        document.getElementById(targetId).classList.add('hidden');
      });
    });

    // 탭 전환
    document.querySelectorAll('.tab-btn').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
      });
    });

    // 방송 채널 추가 버튼 이벤트
    document.getElementById('btn-add-chzzk').addEventListener('click', () => {
      const input = document.getElementById('input-chzzk-id');
      if (input.value) {
        chatEngine.addChannel('chzzk', input.value);
        input.value = '';
        this.renderChannelChips();
      }
    });

    document.getElementById('btn-add-soop').addEventListener('click', () => {
      const input = document.getElementById('input-soop-id');
      if (input.value) {
        chatEngine.addChannel('soop', input.value);
        input.value = '';
        this.renderChannelChips();
      }
    });

    document.getElementById('btn-add-yt').addEventListener('click', () => {
      const input = document.getElementById('input-yt-url');
      if (input.value) {
        chatEngine.addChannel('youtube', input.value);
        input.value = '';
        this.renderChannelChips();
      }
    });

    // 커스텀 단어/채팅 복붙 등록 (스마트 파서 적용)
    document.getElementById('btn-apply-custom-words').addEventListener('click', () => {
      const text = document.getElementById('txt-custom-words').value;
      const res = wordManager.parseAndAddCustomChatText(text);
      document.getElementById('modal-words').classList.add('hidden');
      alert(`✨ 채팅 텍스트 지능형 정제 완료!\n- 시청자 닉네임 ${res.nickCount}개 소환 등록\n- 타깃 제시어 ${res.wordCount}개 몬스터 등록`);
    });

    // 화면 클릭 시 입력창 자동 포커스 유지
    document.addEventListener('click', (e) => {
      if (this.isRunning && !e.target.closest('.modal-backdrop') && !e.target.closest('#top-bar') && !e.target.closest('.quick-controls')) {
        this.focusActiveInput();
      }
    });
  }

  focusActiveInput() {
    if (!this.isRunning) return;
    if (this.inputMode === 'single') {
      const inp = document.getElementById('shared-input');
      if (inp && document.activeElement !== inp) inp.focus();
    } else {
      const inp = document.getElementById('p-input-0');
      if (inp && document.activeElement !== inp && (!document.activeElement || !document.activeElement.id || !document.activeElement.id.startsWith('p-input-'))) {
        inp.focus();
      }
    }
  }

  renderChannelChips() {
    const container = document.getElementById('active-channels-list');
    if (!container) return;
    container.innerHTML = '';

    chatEngine.channels.forEach(ch => {
      const chip = document.createElement('div');
      chip.className = 'channel-chip';
      chip.innerHTML = `
        <span>${ch.name}</span>
        <button class="btn-remove-chip" data-id="${ch.id}">✕</button>
      `;

      chip.querySelector('.btn-remove-chip').addEventListener('click', (e) => {
        const id = parseFloat(e.target.dataset.id);
        chatEngine.removeChannel(id);
        this.renderChannelChips();
      });

      container.appendChild(chip);
    });
  }

  showMainScreen() {
    this.isRunning = false;
    if (this.animId) cancelAnimationFrame(this.animId);
    this.screenMain.classList.remove('hidden');
    this.screenGameOver.classList.add('hidden');
    this.gameHud.classList.add('hidden');
    this.typingBar.classList.add('hidden');
  }

  startGame() {
    this.isRunning = true;
    this.totalScore = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.hp = 100;
    this.fever = 0;
    this.isFeverMode = false;
    this.kills = 0;
    this.totalTypedChars = 0;
    this.totalTypedStrokes = 0;
    this.startTime = Date.now();
    this.monsters = [];
    this.particles = [];
    this.lasers = [];

    // 플레이어별 개별 스탯 초기화
    this.players.forEach(p => {
      p.score = 0;
      p.kills = 0;
      p.combo = 0;
    });

    this.rebuildTurrets();
    this.renderInputBar();

    this.screenMain.classList.add('hidden');
    this.screenGameOver.classList.add('hidden');
    this.gameHud.classList.remove('hidden');
    this.typingBar.classList.remove('hidden');

    if (!chatEngine.connected) {
      chatEngine.connect('custom', { simSpeed: 'normal' });
      this.renderChannelChips();
    }

    this.loop();
  }

  // 하단 타자 입력 바 동적 생성 (개별 vs 통합)
  renderInputBar() {
    const container = document.getElementById('multi-input-container');
    if (!container) return;
    container.innerHTML = '';

    if (this.inputMode === 'single') {
      // 통합 1개 입력창
      const card = document.createElement('div');
      card.className = 'player-input-card';
      card.style.setProperty('--p-color', '#00f3ff');
      card.style.maxWidth = '600px';
      card.innerHTML = `
        <div class="player-input-header">
          <span>🎮 통합 방어 타자입력 (전체 포탑 연동)</span>
        </div>
        <div class="player-input-body">
          <span>⌨️</span>
          <input type="text" id="shared-input" autocomplete="off" placeholder="단어를 입력하고 Enter를 누르세요..." autofocus />
        </div>
      `;

      const input = card.querySelector('#shared-input');
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.processTyping(input.value.trim(), 0);
          input.value = '';
        }
      });
      container.appendChild(card);
      setTimeout(() => input.focus(), 100);
    } else {
      // 플레이어별 개별 입력창
      this.players.forEach((p, i) => {
        const card = document.createElement('div');
        card.className = 'player-input-card';
        card.style.setProperty('--p-color', p.color);
        card.innerHTML = `
          <div class="player-input-header">
            <span>P${i + 1}. ${p.name}</span>
            <span id="p-score-${i}">0 Pts</span>
          </div>
          <div class="player-input-body">
            <span>⌨️</span>
            <input type="text" id="p-input-${i}" autocomplete="off" placeholder="${p.name} 단어 입력..." />
          </div>
        `;

        const input = card.querySelector(`#p-input-${i}`);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            this.processTyping(input.value.trim(), i);
            input.value = '';
          }
        });

        container.appendChild(card);
      });

      const firstInput = container.querySelector('#p-input-0');
      if (firstInput) setTimeout(() => firstInput.focus(), 100);
    }
  }

  spawnMonster() {
    // 대형 방송 마비 방지: 화면 내 최대 몬스터 수 15개 제한 Cap
    if (this.monsters.length >= 15) return;

    const data = wordManager.getNextMonsterData();
    const viewerNick = data.viewerNick;
    const text = data.targetWord;
    const x = Math.random() * (this.width - 240) + 120;
    const speed = Math.random() * 0.8 + 0.5;

    let type = 'normal';
    let color = '#00f3ff';
    if (text.length > 10 || Math.random() < 0.15) {
      type = 'boss';
      color = '#ff007f';
    } else if (Math.random() < 0.2) {
      type = 'fast';
      color = '#ffd700';
    }

    this.monsters.push({
      viewerNick: viewerNick,
      text: text,
      typedLen: 0,
      x: x,
      y: -50,
      speed: type === 'fast' ? speed * 1.6 : speed,
      type: type,
      color: color
    });
  }

  processTyping(val, playerId = 0) {
    if (!val || !this.isRunning) return;

    let targetIdx = -1;
    for (let i = 0; i < this.monsters.length; i++) {
      if (this.monsters[i].text === val) {
        targetIdx = i;
        break;
      }
    }

    if (targetIdx !== -1) {
      const target = this.monsters[targetIdx];
      
      let shooterTurret = this.turrets[playerId] || this.turrets[0];
      let shooterId = playerId;

      // 통합 입력 모드이면서 다중 포탑 배치 시, 몬스터와 X좌표가 가장 가까운 포탑 조준 발사
      if (this.inputMode === 'single' && this.turrets.length > 1) {
        let minDist = Infinity;
        this.turrets.forEach((t, idx) => {
          const dist = Math.abs(t.x - target.x);
          if (dist < minDist) {
            minDist = dist;
            shooterTurret = t;
            shooterId = idx;
          }
        });
      }

      const player = this.players[shooterId] || this.players[0];

      this.fireLaser(shooterTurret, target);
      this.createExplosion(target.x, target.y, shooterTurret.color);

      audioSynth.playLaser();
      audioSynth.playExplosion();

      // Stats Update
      this.kills++;
      player.kills++;
      this.combo++;
      player.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      audioSynth.playCombo(this.combo);

      const pts = (target.text.length * 10) * (this.isFeverMode ? 2 : 1);
      this.totalScore += pts;
      player.score += pts;
      this.totalTypedChars += target.text.length;

      // 한글 자모 획수(Stroke) 타수 정밀 계산
      const strokes = wordManager.getHangulStrokeCount(target.text);
      this.totalTypedStrokes += strokes;

      // Update Individual Player UI Score Card
      const pScoreElem = document.getElementById(`p-score-${shooterId}`);
      if (pScoreElem) pScoreElem.innerText = `${player.score.toLocaleString()} Pts`;

      // Fever Charge
      this.fever = Math.min(100, this.fever + 12);
      if (this.fever >= 100 && !this.isFeverMode) {
        this.activateFever();
      }

      this.monsters.splice(targetIdx, 1);
    } else {
      this.combo = 0;
      if (this.players[playerId]) this.players[playerId].combo = 0;
      audioSynth.playError();
    }

    this.updateHUD();
  }

  activateFever() {
    this.isFeverMode = true;
    this.feverTimer = 300;
    audioSynth.playFever();
  }

  fireLaser(turret, target) {
    const angle = Math.atan2(target.y - turret.y, target.x - turret.x);
    turret.angle = angle;

    this.lasers.push({
      x1: turret.x,
      y1: turret.y,
      x2: target.x,
      y2: target.y,
      alpha: 1.0,
      color: turret.color
    });
  }

  createExplosion(x, y, color) {
    for (let i = 0; i < 25; i++) {
      this.particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        size: Math.random() * 5 + 2,
        color: color,
        alpha: 1.0,
        life: 0.04
      });
    }
  }

  updateHUD() {
    this.hudScore.innerText = this.totalScore.toLocaleString();
    this.hudCombo.innerText = this.combo;
    this.hudHpFill.style.width = `${Math.max(0, this.hp)}%`;
    this.hudHpText.innerText = `${Math.ceil(this.hp)} / 100`;

    const elapsedMinutes = (Date.now() - this.startTime) / 60000;
    const cpm = elapsedMinutes > 0 ? Math.round(this.totalTypedStrokes / elapsedMinutes) : 0;
    const wpm = elapsedMinutes > 0 ? Math.round((this.totalTypedChars / 5) / elapsedMinutes) : 0;

    this.hudWpm.innerText = cpm;
    this.hudWpm.title = `실시간 타수: ${cpm} CPM | WPM: ${wpm}`;

    this.hudFeverFill.style.width = `${this.fever}%`;
  }

  gameOver() {
    this.isRunning = false;
    audioSynth.playGameOver();

    document.getElementById('result-score').innerText = this.totalScore.toLocaleString();
    document.getElementById('result-wpm').innerText = this.hudWpm.innerText;
    document.getElementById('result-combo').innerText = this.maxCombo;
    document.getElementById('result-kills').innerText = this.kills;

    // Render Player MVP Ranking Cards
    const rankContainer = document.getElementById('player-ranking-list');
    if (rankContainer) {
      rankContainer.innerHTML = '';
      const sortedPlayers = [...this.players].sort((a, b) => b.score - a.score);

      sortedPlayers.forEach((p, idx) => {
        const card = document.createElement('div');
        card.className = `player-rank-card ${idx === 0 ? 'mvp' : ''}`;
        card.style.setProperty('--p-color', p.color);
        card.innerHTML = `
          ${idx === 0 ? '<span class="mvp-badge">👑 MVP</span>' : ''}
          <span class="player-rank-name">${p.name}</span>
          <span class="player-rank-score">${p.score.toLocaleString()} Pts</span>
          <span class="player-rank-kills">🎯 ${p.kills} 처치</span>
        `;
        rankContainer.appendChild(card);
      });
    }

    this.screenGameOver.classList.remove('hidden');
    this.typingBar.classList.add('hidden');
  }

  loop() {
    if (!this.isRunning) return;

    this.update();
    this.render();

    this.animId = requestAnimationFrame(() => this.loop());
  }

  update() {
    this.spawnTimer++;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnMonster();
      this.spawnTimer = 0;
      this.spawnInterval = Math.max(40, 120 - Math.floor(this.totalScore / 300));
    }

    if (this.isFeverMode) {
      this.feverTimer--;
      this.fever = (this.feverTimer / 300) * 100;
      if (this.feverTimer <= 0) {
        this.isFeverMode = false;
        this.fever = 0;
      }
    }

    for (let i = this.monsters.length - 1; i >= 0; i--) {
      const m = this.monsters[i];
      m.y += m.speed;

      if (m.y >= this.height - 100) {
        this.hp -= (m.type === 'boss' ? 25 : 10);
        audioSynth.playBaseHit();
        this.createExplosion(m.x, m.y, '#ff0055');
        this.monsters.splice(i, 1);
        this.combo = 0;
        this.updateHUD();

        if (this.hp <= 0) {
          this.gameOver();
          return;
        }
      }
    }

    for (let i = this.lasers.length - 1; i >= 0; i--) {
      this.lasers[i].alpha -= 0.08;
      if (this.lasers[i].alpha <= 0) this.lasers.splice(i, 1);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.life;
      if (p.alpha <= 0) this.particles.splice(i, 1);
    }

    this.stars.forEach(s => {
      s.y += s.speed;
      if (s.y > this.height) s.y = 0;
    });
  }

  render() {
    this.bgCtx.clearRect(0, 0, this.width, this.height);
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Stars Background
    this.bgCtx.fillStyle = '#ffffff';
    this.stars.forEach(s => {
      this.bgCtx.globalAlpha = s.alpha;
      this.bgCtx.beginPath();
      this.bgCtx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      this.bgCtx.fill();
    });
    this.bgCtx.globalAlpha = 1.0;

    // Base Shield Line
    this.ctx.strokeStyle = this.isFeverMode ? '#ff007f' : '#00f3ff';
    this.ctx.lineWidth = 3;
    this.ctx.shadowBlur = 15;
    this.ctx.shadowColor = this.ctx.strokeStyle;
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.height - 90);
    this.ctx.lineTo(this.width, this.height - 90);
    this.ctx.stroke();
    this.ctx.shadowBlur = 0;

    // Turrets & Labels Rendering
    this.turrets.forEach(t => {
      this.ctx.save();
      this.ctx.translate(t.x, t.y);
      this.ctx.rotate(t.angle);

      // Barrel
      this.ctx.fillStyle = t.color;
      this.ctx.shadowBlur = 10;
      this.ctx.shadowColor = t.color;
      this.ctx.fillRect(0, -8, 38, 16);

      // Base Dome
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 18, 0, Math.PI * 2);
      this.ctx.fillStyle = '#111524';
      this.ctx.strokeStyle = t.color;
      this.ctx.lineWidth = 3;
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.restore();

      // Draw Player Name Label Below Turret
      this.ctx.save();
      this.ctx.font = '800 13px "Noto Sans KR", sans-serif';
      this.ctx.fillStyle = t.color;
      this.ctx.shadowBlur = 8;
      this.ctx.shadowColor = t.color;
      this.ctx.textAlign = 'center';
      this.ctx.fillText(t.label, t.x, t.y + 35);
      this.ctx.restore();
    });

    // Lasers Rendering
    this.lasers.forEach(l => {
      this.ctx.strokeStyle = l.color;
      this.ctx.globalAlpha = l.alpha;
      this.ctx.lineWidth = 4;
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = l.color;
      this.ctx.beginPath();
      this.ctx.moveTo(l.x1, l.y1);
      this.ctx.lineTo(l.x2, l.y2);
      this.ctx.stroke();
    });
    this.ctx.globalAlpha = 1.0;
    this.ctx.shadowBlur = 0;

    // 👾 2단 구조 몬스터 렌더링 (상단: 시청자 닉네임 뱃지 / 하단: 스트리머가 칠 clean 제시어)
    this.monsters.forEach(m => {
      this.ctx.save();

      // 1. 계산
      this.ctx.font = '700 16px "Noto Sans KR", sans-serif';
      const targetTextWidth = this.ctx.measureText(m.text).width;
      this.ctx.font = '700 11px "Noto Sans KR", sans-serif';
      const nickWidth = this.ctx.measureText(m.viewerNick || '').width;

      const paddingX = 16;
      const boxWidth = Math.max(targetTextWidth, nickWidth) + paddingX * 2;
      const boxHeight = 34;

      // 2. 상단 시청자 닉네임 뱃지 렌더링 (Pill Tag)
      if (m.viewerNick) {
        const badgeHeight = 18;
        const badgeY = m.y - boxHeight / 2 - 12;
        const badgeWidth = nickWidth + 16;

        this.ctx.fillStyle = 'rgba(10, 14, 25, 0.9)';
        this.ctx.strokeStyle = '#ffd700';
        this.ctx.lineWidth = 1;
        this.ctx.shadowBlur = 8;
        this.ctx.shadowColor = '#ffd700';

        this.ctx.beginPath();
        if (this.ctx.roundRect) {
          this.ctx.roundRect(m.x - badgeWidth / 2, badgeY - badgeHeight / 2, badgeWidth, badgeHeight, 9);
        } else {
          this.ctx.rect(m.x - badgeWidth / 2, badgeY - badgeHeight / 2, badgeWidth, badgeHeight);
        }
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.font = '700 11px "Noto Sans KR", sans-serif';
        this.ctx.fillStyle = '#ffd700';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(m.viewerNick, m.x, badgeY);
      }

      // 3. 하단 스트리머가 타이핑할 메인 제시어 몬스터 상자 렌더링
      this.ctx.fillStyle = 'rgba(12, 16, 28, 0.9)';
      this.ctx.strokeStyle = m.color;
      this.ctx.lineWidth = 2;
      this.ctx.shadowBlur = 12;
      this.ctx.shadowColor = m.color;

      this.ctx.beginPath();
      if (this.ctx.roundRect) {
        this.ctx.roundRect(m.x - boxWidth / 2, m.y - boxHeight / 2, boxWidth, boxHeight, 10);
      } else {
        this.ctx.rect(m.x - boxWidth / 2, m.y - boxHeight / 2, boxWidth, boxHeight);
      }
      this.ctx.fill();
      this.ctx.stroke();

      // 메인 제시어 텍스트
      this.ctx.font = '700 16px "Noto Sans KR", sans-serif';
      this.ctx.fillStyle = '#ffffff';
      this.ctx.shadowBlur = 5;
      this.ctx.shadowColor = '#ffffff';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(m.text, m.x, m.y);

      this.ctx.restore();
    });

    // Particles Rendering
    this.particles.forEach(p => {
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = p.alpha;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    });
    this.ctx.globalAlpha = 1.0;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.gameEngine = new GameEngine();
});


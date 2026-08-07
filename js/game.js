/**
 * ============================================================
 * WORD-TYPING-DEFENSE — 메인 오케스트레이터 (game.js)
 * [1인 솔로 싱글 플레이어 최적화 & 모달/루프 성능 최적화 완료]
 * ============================================================
 */

class GameEngine {
  constructor() {
    this.isInitialized = false;
    this.animationFrameId = null;

    // 1인 전용 고정 설정
    this.config = {
      playerCount: 1,
      difficulty: 'normal', // 'easy' | 'normal' | 'hard' | 'hell'
      playerNames: ['스트리머']
    };

    this.stateManager = null;
    this.turretManager = null;
    this.monsterManager = null;
    this.inputManager = null;
    this.renderer = null;

    this.stageKillCount = 0;
    this.simInterval = null; // 가상 시청자 자동 소환(테스트) 타이머
    this.bgStars = [];
    this.bgAnimId = null;

    this.leaderboardDifficulty = 'normal'; // 명예의 전당 모달에서 현재 선택된 난이도 탭
    this.leaderboardCache = null;          // { source, grouped: {easy,normal,hard,hell} }
  }

  /**
   * 🚀 게임 엔진 초기화
   */
  init() {
    if (this.isInitialized) return;

    // 1. Canvas DOM 확보
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) {
      console.error('❌ #gameCanvas 요소를 찾을 수 없습니다.');
      return;
    }

    // 2. 모듈 인스턴스화
    this.stateManager = typeof StateManager !== 'undefined' ? new StateManager() : null;
    this.turretManager = typeof TurretManager !== 'undefined' ? new TurretManager(canvas) : null;
    this.monsterManager = typeof MonsterManager !== 'undefined' ? new MonsterManager(canvas) : null;
    this.inputManager = typeof InputManager !== 'undefined' ? new InputManager() : null;
    this.renderer = typeof CanvasRenderer !== 'undefined' ? new CanvasRenderer(canvas) : null;

    // 3. 렌더러 & 포탑 셋업 (1인 포탑 중앙 배치)
    if (this.renderer) {
      this.renderer.resizeCanvas();
      window.addEventListener('resize', () => {
        if (this.renderer) this.renderer.resizeCanvas();
        if (this.turretManager) this.turretManager.repositionTurrets();
        this.resizeBgCanvas();
      });
    }

    if (this.turretManager) {
      this.turretManager.setupTurrets(1, this.config.playerNames, canvas);
    }

    // 4. 보스 WARNING 배너 콜백 연결
    if (this.monsterManager) {
      this.monsterManager.onBossWarning = (stage) => {
        this.showBanner(`⚠️ STAGE ${stage} BOSS WARNING ⚠️`, '강력한 보스 몬스터가 접근 중입니다!', true);
        if (window.audioManager) window.audioManager.playFever();
      };
    }

    // 5. 피버 모드 사운드/배너 콜백 연결
    if (this.stateManager) {
      this.stateManager.onFeverStart = () => {
        if (window.audioManager) window.audioManager.playFever();
        this.showToastInternal('🔥 FEVER TIME! 점수 2배!', 'success');
      };
    }

    // 6. UI 및 이벤트 바인딩
    this.bindUIEvents();
    this.initToastSystem();
    this.startBackgroundStarfield();

    // 7. 메인 루프 시작
    this.isInitialized = true;
    this.startMainLoop();

    console.log("🎮 Word Defense 1인 싱글 모드 엔진 초기화 완료!");
  }

  /* ==========================================================
   * 🍞 TOAST 알림 시스템 (연동 성공/실패, 저장 완료 등 UX 피드백)
   * ========================================================== */
  initToastSystem() {
    if (document.getElementById('toast-container')) return;
    const container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);

    // chatIntegration.js 등 다른 모듈에서 호출할 수 있도록 전역에 노출
    window.showToast = (message, type = 'info') => this.showToastInternal(message, type);
  }

  showToastInternal(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  /* ==========================================================
   * 🌌 배경 파티클(스타필드) 연출 — #bg-canvas
   * ========================================================== */
  startBackgroundStarfield() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    this.bgCanvas = canvas;
    this.bgCtx = canvas.getContext('2d');
    this.resizeBgCanvas();

    this.bgStars = Array.from({ length: 90 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.6 + 0.4,
      speed: Math.random() * 0.15 + 0.03,
      hue: Math.random() > 0.5 ? '0, 243, 255' : '191, 0, 255'
    }));

    const loop = () => {
      this.renderBackgroundStarfield();
      this.bgAnimId = requestAnimationFrame(loop);
    };
    this.bgAnimId = requestAnimationFrame(loop);
  }

  resizeBgCanvas() {
    const canvas = document.getElementById('bg-canvas');
    const container = canvas ? canvas.parentElement : null;
    if (!canvas || !container) return;
    canvas.width = container.clientWidth || 1024;
    canvas.height = container.clientHeight || 768;
  }

  renderBackgroundStarfield() {
    if (!this.bgCtx || !this.bgCanvas) return;
    const ctx = this.bgCtx;
    const w = this.bgCanvas.width;
    const h = this.bgCanvas.height;

    ctx.clearRect(0, 0, w, h);

    this.bgStars.forEach(star => {
      star.y += star.speed * 0.002;
      if (star.y > 1) star.y = 0;

      const px = star.x * w;
      const py = star.y * h;
      ctx.beginPath();
      ctx.fillStyle = `rgba(${star.hue}, 0.55)`;
      ctx.arc(px, py, star.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  /**
   * 🖱️ UI 버튼 이벤트 바인딩 (광고 호출 유지 + 모달 반응속도 최적화)
   */
  bindUIEvents() {
    // 모달 팝업 및 해당 카카오 애드핏 배너 슬롯 매핑
    const modalMap = [
      { btnId: 'btn-chat-modal', modalId: 'modal-chat', adContainerId: 'ad-container-chat' },
      { btnId: 'btn-word-modal', modalId: 'modal-words', adContainerId: 'ad-container-words' },
      { btnId: 'btn-leaderboard-modal', modalId: 'modal-leaderboard', adContainerId: 'ad-container-leaderboard' },
      { btnId: 'btn-support-modal', modalId: 'modal-support', adContainerId: 'ad-container-support' }
    ];

    modalMap.forEach(({ btnId, modalId, adContainerId }) => {
      const btn = document.getElementById(btnId);
      const modal = document.getElementById(modalId);
      if (btn && modal) {
        btn.addEventListener('click', () => {
          // ⚡ 1. 클릭하는 순간 모달창부터 0ms 만에 즉시 띄움
          modal.classList.remove('hidden');

          // 모달별 진입 시 최신 데이터 렌더링
          if (modalId === 'modal-leaderboard') this.renderLeaderboard();
          if (modalId === 'modal-chat') this.startChatModalLiveRefresh();
          if (modalId === 'modal-words') this.renderWordPackPreview();

          // ⚡ 2. 광고 호출 함수는 그대로 유지하되, 모달이 다 뜨고 난 150ms 뒤 비동기로 실행
          setTimeout(() => {
            if (window.refreshAdfitSlot && adContainerId) {
              window.refreshAdfitSlot(adContainerId);
            }
          }, 150);
        });
      }
    });

    // 닫기 버튼 (모달 닫을 때 게임 중이면 타자 입력창으로 포커스 자동 복원)
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetId = e.currentTarget.getAttribute('data-close');
        const targetModal = document.getElementById(targetId);
        if (targetModal) targetModal.classList.add('hidden');

        // 모달을 닫은 직후 타자 입력창으로 포커스 즉시 복원
        setTimeout(() => {
          const activeInput = document.querySelector('.game-typing-input');
          if (activeInput && this.stateManager && this.stateManager.currentState === 'PLAYING') {
            activeInput.focus();
          }
        }, 50);
      });
    });

    // 난이도 선택 버튼
    const diffBtns = document.querySelectorAll('.btn-diff');
    diffBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        diffBtns.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.config.difficulty = e.currentTarget.dataset.diff;
        if (window.GlobalLeaderboard) window.GlobalLeaderboard.logEvent('difficulty_selected', { difficulty: this.config.difficulty });
      });
    });

    // 게임 시작 / 재시작 / 메인 이동 버튼
    const btnStart = document.getElementById('btn-start-game');
    if (btnStart) btnStart.addEventListener('click', () => this.startGame());

    const btnRestart = document.getElementById('btn-restart');
    if (btnRestart) btnRestart.addEventListener('click', () => this.startGame());

    // 메인으로 돌아가기 버튼 (클래스/ID 다중 바인딩 처리)
    document.querySelectorAll('#btn-return-main, .btn-return-main').forEach(btn => {
      btn.addEventListener('click', () => this.returnToMain());
    });

    // 결과 화면 → 후원 모달 바로가기
    const btnResultSupport = document.getElementById('btn-result-support');
    if (btnResultSupport) {
      btnResultSupport.addEventListener('click', () => {
        const modal = document.getElementById('modal-support');
        if (modal) modal.classList.remove('hidden');
        setTimeout(() => window.refreshAdfitSlot && window.refreshAdfitSlot('ad-container-support'), 150);
      });
    }

    // 계좌번호 1초 복사 버튼
    const btnCopyAccount = document.getElementById('btn-copy-account');
    if (btnCopyAccount) {
      btnCopyAccount.addEventListener('click', () => {
        const accountNumber = '3333-28-2684443';
        const onCopied = () => {
          if (window.showToast) window.showToast(`📋 계좌번호가 복사되었습니다! (${accountNumber})`);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(accountNumber).then(onCopied).catch(() => {
            const tempInput = document.createElement('input');
            tempInput.value = accountNumber;
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand('copy');
            document.body.removeChild(tempInput);
            onCopied();
          });
        } else {
          const tempInput = document.createElement('input');
          tempInput.value = accountNumber;
          document.body.appendChild(tempInput);
          tempInput.select();
          document.execCommand('copy');
          document.body.removeChild(tempInput);
          onCopied();
        }
      });
    }

    this.bindChatModalEvents();
    this.bindWordPackModalEvents();
    this.bindLiveChatToggle();
    this.bindLeaderboardEvents();
    this.bindObsToggle();
    this.bindSfxToggle();
  }

  /* ==========================================================
   * 📡 방송 채팅 연동 모달 이벤트
   * ========================================================== */
  bindChatModalEvents() {
    // 플랫폼 탭 전환
    document.querySelectorAll('.tab-btn').forEach(tabBtn => {
      tabBtn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tabBtn.classList.add('active');
        const target = document.getElementById(tabBtn.dataset.tab);
        if (target) target.classList.add('active');
      });
    });

    const addChannelHandler = (platform, inputId) => {
      const input = document.getElementById(inputId);
      if (!input || !window.chatEngine) return;
      const value = input.value.trim();
      if (!value) {
        this.showToastInternal('방송 주소를 입력해주세요.', 'warn');
        return;
      }
      window.chatEngine.addChannel(platform, value);
      input.value = '';
      this.renderActiveChannels();
      if (window.GlobalLeaderboard) window.GlobalLeaderboard.logEvent('chat_platform_connected', { platform });
    };

    const btnAddChzzk = document.getElementById('btn-add-chzzk');
    if (btnAddChzzk) btnAddChzzk.addEventListener('click', () => addChannelHandler('chzzk', 'input-chzzk-id'));

    const btnAddSoop = document.getElementById('btn-add-soop');
    if (btnAddSoop) btnAddSoop.addEventListener('click', () => addChannelHandler('soop', 'input-soop-id'));

    const btnAddYt = document.getElementById('btn-add-yt');
    if (btnAddYt) btnAddYt.addEventListener('click', () => addChannelHandler('youtube', 'input-yt-url'));

    // 🤖 [BOT] 가상 시청자 자동 소환 (테스트/오프라인 시뮬레이션)
    const simSelect = document.getElementById('select-sim-speed');
    if (simSelect) {
      simSelect.addEventListener('change', () => {
        if (this.simInterval) {
          clearInterval(this.simInterval);
          this.simInterval = null;
        }
        const speedMap = { slow: 5000, normal: 2500, fast: 1000 };
        const interval = speedMap[simSelect.value];
        if (interval) {
          this.simInterval = setInterval(() => {
            if (typeof wordPacks === 'undefined') return;
            const name = wordPacks.botNicknames[Math.floor(Math.random() * wordPacks.botNicknames.length)];
            wordPacks.enqueueViewer(`[BOT] ${name}`);
          }, interval);
          this.showToastInternal('🤖 가상 시청자 자동 소환을 시작합니다.', 'info');
        }
      });
    }
  }

  renderActiveChannels() {
    const list = document.getElementById('active-channels-list');
    if (!list || !window.chatEngine) return;

    const channels = window.chatEngine.getActiveChannels();
    if (channels.length === 0) {
      list.innerHTML = '<span class="channel-chip-empty">연동된 방송이 없습니다.</span>';
      return;
    }

    list.innerHTML = '';
    channels.forEach(ch => {
      const chip = document.createElement('span');
      chip.className = `channel-chip channel-chip-${ch.platform}`;
      chip.innerHTML = `${ch.name} <button type="button" class="chip-remove" data-channel-id="${ch.id}">✕</button>`;
      list.appendChild(chip);
    });

    list.querySelectorAll('.chip-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = parseFloat(e.currentTarget.getAttribute('data-channel-id'));
        window.chatEngine.removeChannel(id);
        this.renderActiveChannels();
      });
    });
  }

  /**
   * 🙋 `!참여`한 시청자 목록 렌더링 (총원 + 최근 참여자 칩)
   */
  renderParticipants() {
    const listEl = document.getElementById('participant-list');
    const countEl = document.getElementById('participant-count');
    if (!listEl || typeof wordPacks === 'undefined') return;

    const joined = Array.from(wordPacks.joinedViewers || []);
    if (countEl) countEl.textContent = `(${joined.length}명)`;

    if (joined.length === 0) {
      listEl.innerHTML = '<span class="participant-empty">아직 !참여한 시청자가 없습니다.</span>';
      return;
    }

    // 최근 참여자 40명만 최신순으로 표시 (Set은 삽입 순서 보존)
    const recent = joined.slice(-40).reverse();
    listEl.innerHTML = recent.map(n => `<span class="participant-chip">${this.escapeHtml(n)}</span>`).join('');
  }

  /**
   * 🕒 게임 중 화면 좌상단 "출전 대기열" 패널 갱신
   * (큐 앞쪽 = 다음에 소환될 순서. 실참여자는 밝게, [BOT]은 흐리게 표시)
   */
  renderQueuePanel() {
    const panel = document.getElementById('queue-panel');
    const listEl = document.getElementById('queue-list');
    const countEl = document.getElementById('queue-count');
    if (!panel || !listEl || typeof wordPacks === 'undefined') return;

    const queue = wordPacks.viewerQueue || [];
    if (countEl) countEl.textContent = queue.length;

    let html = '';

    // 🔥 라이브 경쟁 후보 (현재 채팅으로 다투는 "다음 몬스터 자리")
    const cand = wordPacks.liveChatMode ? wordPacks.liveCandidate : null;
    if (cand && cand.nickname) {
      html += `<span class="queue-item queue-item-live">🔥 ${this.escapeHtml(cand.nickname)}: ${this.escapeHtml(cand.chatWord || '')}</span>`;
    }

    // 다음에 소환될 순서대로 앞에서 최대 8개
    const upcoming = queue.slice(0, 8);
    html += upcoming.map(entry => {
      const name = entry && entry.nickname ? entry.nickname : '[BOT]';
      const isBot = name.startsWith('[BOT]');
      return `<span class="queue-item${isBot ? ' queue-item-bot' : ''}">${this.escapeHtml(name)}</span>`;
    }).join('');

    listEl.innerHTML = html;
  }

  /**
   * 채팅 모달이 열려 있는 동안 연동 목록/참여자 목록을 주기적으로 갱신 (모달 닫히면 자동 중지)
   */
  startChatModalLiveRefresh() {
    this.renderActiveChannels();
    this.renderParticipants();

    clearInterval(this._chatModalTimer);
    this._chatModalTimer = setInterval(() => {
      const modal = document.getElementById('modal-chat');
      if (!modal || modal.classList.contains('hidden')) {
        clearInterval(this._chatModalTimer);
        return;
      }
      this.renderActiveChannels();
      this.renderParticipants();
    }, 1500);
  }

  /* ==========================================================
   * 📝 단어/닉네임 팩 모달 이벤트
   * ========================================================== */
  bindWordPackModalEvents() {
    const packSelect = document.getElementById('select-word-pack');
    if (packSelect) {
      packSelect.addEventListener('change', () => {
        if (typeof wordPacks === 'undefined') return;
        wordPacks.applyPresetPack(packSelect.value);
        this.renderWordPackPreview();
        this.showToastInternal('📝 단어 팩이 적용되었습니다.', 'success');
      });
    }

    const maxLenSelect = document.getElementById('select-live-chat-max-len');
    if (maxLenSelect) {
      maxLenSelect.addEventListener('change', () => {
        if (typeof wordPacks === 'undefined') return;
        wordPacks.liveChatMaxLen = Number(maxLenSelect.value) || 10;
        this.showToastInternal(`💬 라이브 채팅 제시어 최대 길이: ${wordPacks.liveChatMaxLen}자`, 'info');
      });
    }

    const stripSpecialCheck = document.getElementById('chk-live-chat-strip-special');
    if (stripSpecialCheck) {
      stripSpecialCheck.addEventListener('change', () => {
        if (typeof wordPacks === 'undefined') return;
        wordPacks.liveChatStripSpecial = stripSpecialCheck.checked;
      });
    }
  }

  /**
   * 💬 라이브 채팅 제시어 모드: `!참여`한 시청자의 후속 채팅만 타깃 단어로 사용한다.
   * 상단 컨트롤바 버튼 및 단어팩 모달 내부 버튼 어느 곳에서나 토글 가능하며 실시간 양방향 동기화된다.
   */
  bindLiveChatToggle() {
    const topBtn = document.getElementById('btn-live-chat-toggle');
    const modalBtn = document.getElementById('btn-modal-live-chat-toggle');

    const updateUI = () => {
      const enabled = typeof wordPacks !== 'undefined' && wordPacks.liveChatMode;

      if (topBtn) {
        topBtn.classList.toggle('active', enabled);
        topBtn.setAttribute('aria-pressed', String(enabled));
        topBtn.textContent = enabled ? '💬 라이브 채팅 모드: ON' : '💬 라이브 채팅 모드: OFF';
      }

      if (modalBtn) {
        modalBtn.classList.toggle('active', enabled);
        modalBtn.setAttribute('aria-pressed', String(enabled));
        modalBtn.textContent = enabled ? '💬 라이브 모드: ON' : '💬 라이브 모드: OFF';
      }
    };

    const toggleMode = () => {
      if (typeof wordPacks === 'undefined') return;
      wordPacks.liveChatMode = !wordPacks.liveChatMode;
      updateUI();
      this.showToastInternal(
        wordPacks.liveChatMode
          ? '💬 라이브 채팅 모드 ON — !참여한 시청자의 채팅이 제시어가 됩니다.'
          : '🛡️ 라이브 채팅 모드 OFF — 안전 단어팩으로 돌아갑니다.',
        wordPacks.liveChatMode ? 'success' : 'info'
      );
      if (window.GlobalLeaderboard) {
        window.GlobalLeaderboard.logEvent('live_chat_mode_toggled', { enabled: wordPacks.liveChatMode });
      }
    };

    if (topBtn) topBtn.addEventListener('click', toggleMode);
    if (modalBtn) modalBtn.addEventListener('click', toggleMode);

    updateUI();
  }

  /**
   * 📋 현재 실제로 게임에 사용 중인 단어 목록(프리셋 또는 커스텀)을 모달에 칩 형태로 미리보기
   */
  renderWordPackPreview() {
    const previewEl = document.getElementById('word-pack-preview');
    if (!previewEl || typeof wordPacks === 'undefined') return;

    const maxLenSelect = document.getElementById('select-live-chat-max-len');
    if (maxLenSelect) maxLenSelect.value = String(wordPacks.liveChatMaxLen);
    const stripSpecialCheck = document.getElementById('chk-live-chat-strip-special');
    if (stripSpecialCheck) stripSpecialCheck.checked = !!wordPacks.liveChatStripSpecial;

    const modalBtn = document.getElementById('btn-modal-live-chat-toggle');
    if (modalBtn) {
      const enabled = !!wordPacks.liveChatMode;
      modalBtn.classList.toggle('active', enabled);
      modalBtn.textContent = enabled ? '💬 라이브 모드: ON' : '💬 라이브 모드: OFF';
    }

    const words = wordPacks.getActiveWords();
    if (!words || words.length === 0) {
      previewEl.innerHTML = '<span class="word-pack-preview-empty">표시할 단어가 없습니다.</span>';
      return;
    }

    previewEl.innerHTML = words.map(w => `<span class="word-chip">${this.escapeHtml(w)}</span>`).join('');
  }

  /* ==========================================================
   * 🏆 명예의 전당 (난이도별 TOP 5, localStorage + 글로벌)
   * ========================================================== */
  bindLeaderboardEvents() {
    // 난이도 탭 전환 (쉬움/보통/어려움/헬) — 이미 불러온 캐시에서 바로 다시 그림 (재조회 없음)
    document.querySelectorAll('.leaderboard-diff-tabs .tab-btn').forEach(tabBtn => {
      tabBtn.addEventListener('click', () => {
        document.querySelectorAll('.leaderboard-diff-tabs .tab-btn').forEach(b => b.classList.remove('active'));
        tabBtn.classList.add('active');
        this.leaderboardDifficulty = tabBtn.dataset.lbDiff;
        this.renderLeaderboardList();
      });
    });
  }

  /**
   * 🏆 명예의 전당 데이터 로드: 글로벌(Firestore)이 설정돼 있으면 난이도별로 한 번에 조회해 캐시하고,
   * 미설정이거나 네트워크 실패 시 로컬(localStorage) 난이도별 TOP5로 자동 폴백한다.
   */
  async renderLeaderboard() {
    const listEl = document.getElementById('leaderboard-list');
    const sourceEl = document.getElementById('leaderboard-source');
    if (!listEl || !this.stateManager) return;

    if (!this.leaderboardDifficulty) this.leaderboardDifficulty = 'normal';

    let grouped = null;
    let source = 'local';

    if (window.GlobalLeaderboard && window.GlobalLeaderboard.enabled) {
      if (sourceEl) sourceEl.textContent = '🌐 글로벌 기록 불러오는 중...';
      grouped = await window.GlobalLeaderboard.fetchTopByDifficulty();
      if (grouped) source = 'global';
    }

    if (!grouped) {
      source = 'local';
      grouped = {
        easy: this.stateManager.getTopScores('easy'),
        normal: this.stateManager.getTopScores('normal'),
        hard: this.stateManager.getTopScores('hard'),
        hell: this.stateManager.getTopScores('hell')
      };
    }

    this.leaderboardCache = { source, grouped };

    if (sourceEl) {
      sourceEl.textContent = source === 'global'
        ? '🌐 모든 스트리머가 함께 보는 난이도별 글로벌 TOP5입니다.'
        : '💾 이 브라우저에만 저장된 난이도별 로컬 TOP5입니다. (글로벌 미설정 또는 연결 실패)';
    }

    this.renderLeaderboardList();
  }

  /**
   * 캐시된 데이터에서 현재 선택된 난이도 탭의 TOP5만 다시 그린다 (네트워크 재조회 없음)
   */
  renderLeaderboardList() {
    const listEl = document.getElementById('leaderboard-list');
    if (!listEl || !this.leaderboardCache) return;

    const scores = this.leaderboardCache.grouped[this.leaderboardDifficulty] || [];

    if (scores.length === 0) {
      listEl.innerHTML = '<p class="leaderboard-empty">아직 이 난이도의 저장된 전적이 없습니다. 첫 기록에 도전해보세요!</p>';
      return;
    }

    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
    listEl.innerHTML = scores.map((entry, idx) => `
      <div class="leaderboard-row">
        <span class="lb-rank">${medals[idx] || (idx + 1)}</span>
        <span class="lb-nickname">${this.escapeHtml(entry.nickname)}</span>
        <span class="lb-grade rank-${(entry.grade || 'D').toLowerCase()}">${entry.grade}</span>
        <span class="lb-score">${(entry.score || 0).toLocaleString()}점</span>
        <span class="lb-meta">STAGE ${entry.stage || 1} · ${entry.wpm || 0}WPM</span>
        <span class="lb-date">${entry.date || ''}</span>
      </div>
    `).join('');
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  /* ==========================================================
   * 📺 OBS 크로마키 토글 / 🔊 사운드 토글
   * ========================================================== */
  bindObsToggle() {
    const btn = document.getElementById('btn-obs-toggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const active = document.body.classList.toggle('obs-overlay');
      btn.classList.toggle('active', active);
      btn.innerHTML = active ? '📺 OBS 모드: ON (배경 투명)' : '📺 OBS 크로마키 (배경 투명)';
      this.showToastInternal(active ? '📺 OBS 크로마키 모드가 켜졌습니다.' : '📺 OBS 크로마키 모드가 꺼졌습니다.', 'info');
    });
  }

  bindSfxToggle() {
    const btn = document.getElementById('btn-sfx-toggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (!window.audioManager) return;
      const enabled = window.audioManager.toggleSound();
      btn.innerHTML = enabled ? '🔊 사운드: ON' : '🔇 사운드: OFF';
    });
  }

  /**
   * ⌨️ 1인 전용 타자 입력창 바인딩
   */
  setupInputBars() {
    const container = document.getElementById('multi-input-container');
    if (!container) return;

    // 1인 전용 단일 입력창 생성
    container.innerHTML = `
      <div class="typing-input-box solo-mode">
        <span class="player-tag">🎯 PLAYER</span>
        <input type="text" class="game-typing-input" data-player="0" placeholder="타깃 단어를 입력하고 Enter!" autofocus />
      </div>
    `;

    if (this.inputManager) {
      this.inputManager.bindInputs(container.querySelectorAll('.game-typing-input'), (playerIdx, text) => {
        this.handleTypingSubmit(playerIdx, text);
      });
    }
  }

  /**
   * 🚀 게임 시작
   */
  startGame() {
    if (this.monsterManager) this.monsterManager.clear();
    if (this.simInterval) {
      clearInterval(this.simInterval);
      this.simInterval = null;
    }

    // 스트리머 닉네임 입력값 반영
    const nicknameInput = document.getElementById('input-player-nickname');
    const nickname = (nicknameInput && nicknameInput.value.trim()) ? nicknameInput.value.trim() : '스트리머';
    this.config.playerNames = [nickname];

    const mainScreen = document.getElementById('screen-main');
    const gameOverScreen = document.getElementById('screen-gameover');
    const gameHud = document.getElementById('game-hud');
    const typingBar = document.getElementById('typing-input-bar');

    if (mainScreen) mainScreen.classList.add('hidden');
    if (gameOverScreen) gameOverScreen.classList.add('hidden');
    if (gameHud) gameHud.classList.remove('hidden');
    if (typingBar) typingBar.classList.remove('hidden');
    const queuePanel = document.getElementById('queue-panel');
    if (queuePanel) queuePanel.classList.remove('hidden');

    this.setupInputBars();

    const canvas = document.getElementById('gameCanvas');

    this.stageKillCount = 0;

    if (this.stateManager) this.stateManager.resetGame(this.config);
    if (this.turretManager) this.turretManager.setupTurrets(1, this.config.playerNames, canvas);
    if (this.monsterManager) this.monsterManager.startStage(this.stateManager ? this.stateManager.currentStage : 1, this.config.difficulty);

    if (this.stateManager) this.stateManager.changeState('PLAYING');

    if (window.GlobalLeaderboard) {
      window.GlobalLeaderboard.logEvent('game_start', { difficulty: this.config.difficulty });
    }

    setTimeout(() => {
      const firstInput = document.querySelector('.game-typing-input');
      if (firstInput) firstInput.focus();
    }, 50);
  }

  returnToMain() {
    const gameOverScreen = document.getElementById('screen-gameover');
    const gameHud = document.getElementById('game-hud');
    const typingBar = document.getElementById('typing-input-bar');
    const mainScreen = document.getElementById('screen-main');

    if (gameOverScreen) gameOverScreen.classList.add('hidden');
    if (gameHud) gameHud.classList.add('hidden');
    if (typingBar) typingBar.classList.add('hidden');
    if (mainScreen) mainScreen.classList.remove('hidden');
    const queuePanel = document.getElementById('queue-panel');
    if (queuePanel) queuePanel.classList.add('hidden');

    if (this.monsterManager) this.monsterManager.clear();
    if (this.stateManager) this.stateManager.changeState('MENU');

    setTimeout(() => {
      if (window.refreshAdfitSlot) window.refreshAdfitSlot('ad-container-main');
    }, 150);
  }

  /**
   * ⌨️ 타자 입력 제출 처리 (명중/오타 판정, 점수/콤보/CPM/WPM, 사운드, 스테이지 진행)
   */
  handleTypingSubmit(playerIdx, text) {
    if (!this.stateManager || this.stateManager.currentState !== 'PLAYING') return;

    const hitResult = this.monsterManager ? this.monsterManager.checkHit(text) : null;

    if (!hitResult || !hitResult.success) {
      // ❌ 일치하는 몬스터 없음 = 오타/미스
      if (window.audioManager) window.audioManager.playError();
      if (this.stateManager) this.stateManager.registerMiss();
      return;
    }

    const { monster, isKilled, isBoss } = hitResult;

    // 🎯 포탑 조준/사격
    let firedTurret = null;
    if (this.turretManager) {
      firedTurret = this.turretManager.aimAndFire(monster, 0);
    }
    if (window.audioManager) window.audioManager.playLaser();

    const turrets = this.turretManager ? this.turretManager.getTurrets() : [];
    const turretPos = firedTurret || turrets[0];

    if (turretPos && this.renderer) {
      this.renderer.addLaserEffect(turretPos, monster);
    }

    if (isKilled) {
      if (this.renderer) this.renderer.addExplosionEffect(monster);
      if (window.audioManager) window.audioManager.playExplosion();
      if (this.stateManager) this.stateManager.registerHit(text, monster.scoreValue || 100);

      // 🏆 스테이지 진행: 보스 처치 or 일반 처치 누적 목표 달성 시 다음 스테이지로
      if (isBoss) {
        this.advanceStage();
      } else {
        this.stageKillCount += 1;
        const diffCfg = (typeof getDifficultyConfig === 'function')
          ? getDifficultyConfig(this.config.difficulty)
          : { killPerStageBase: 30, killPerStageStep: 0.5 };
        const killTarget = diffCfg.killPerStageBase + Math.floor((this.stateManager.currentStage - 1) * diffCfg.killPerStageStep);
        const isBossStageWaiting = this.monsterManager && this.stateManager.currentStage % 5 === 0;
        if (!isBossStageWaiting && this.stageKillCount >= killTarget) {
          this.advanceStage();
        }
      }
    }
  }

  /**
   * ♾️ 다음 스테이지로 진행 (무한 Stage + 5 Stage 단위 보스전)
   */
  advanceStage() {
    if (!this.stateManager || !this.monsterManager) return;

    this.stateManager.currentStage += 1;
    this.stageKillCount = 0;

    this.monsterManager.startStage(this.stateManager.currentStage, this.config.difficulty);
    this.stateManager.updateHUDUI();

    if (window.audioManager) window.audioManager.playStageUp();

    const isBossStage = this.stateManager.currentStage % 5 === 0;
    if (!isBossStage) {
      this.showBanner(`STAGE ${this.stateManager.currentStage} START!`, '시청자 몬스터를 타자로 방어하세요!', false);
    }
  }

  /**
   * 🚩 화면 중앙 배너 표시 (스테이지 시작 / 보스 WARNING 공용)
   */
  showBanner(title, desc, isWarning = false) {
    const banner = document.getElementById('stage-banner');
    const titleEl = document.getElementById('stage-banner-title');
    const descEl = document.getElementById('stage-banner-desc');
    if (!banner) return;

    if (titleEl) titleEl.innerText = title;
    if (descEl) descEl.innerText = desc;
    banner.classList.toggle('warning-banner', isWarning);
    banner.classList.remove('hidden');

    clearTimeout(this._bannerTimeout);
    this._bannerTimeout = setTimeout(() => banner.classList.add('hidden'), 2000);
  }

  startMainLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    const loop = () => {
      this.update(0.016);
      this.render();
      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  update(deltaTime) {
    if (this.stateManager && this.stateManager.currentState === 'PLAYING' && this.monsterManager) {
      const reachedMonsters = this.monsterManager.update(deltaTime, this.stateManager.currentStage);
      if (reachedMonsters > 0) {
        const isDead = this.stateManager.damageBase(reachedMonsters);
        if (isDead) {
          this.stateManager.changeState('GAME_OVER');
          this.showGameOverScreen();
        }
      }

      // 🕒 대기열 패널 갱신 (매 프레임 대신 약 3회/초로 스로틀)
      const now = performance.now();
      if (!this._lastQueueRender || now - this._lastQueueRender > 350) {
        this._lastQueueRender = now;
        this.renderQueuePanel();
      }
    }
    if (this.turretManager) this.turretManager.update(deltaTime);
    if (this.renderer) this.renderer.updateEffects(deltaTime);
  }

  render() {
    if (!this.renderer) return;

    this.renderer.clear();

    if (this.turretManager && this.renderer.ctx) {
      this.renderer.drawTurrets(this.turretManager.getTurrets());
    }
    if (this.monsterManager && this.renderer.ctx) {
      this.renderer.drawMonsters(this.monsterManager.getMonsters());
    }
    if (this.renderer) {
      this.renderer.drawEffects();
    }
  }

  showGameOverScreen() {
    document.getElementById('game-hud').classList.add('hidden');
    document.getElementById('typing-input-bar').classList.add('hidden');
    const queuePanel = document.getElementById('queue-panel');
    if (queuePanel) queuePanel.classList.add('hidden');

    if (this.simInterval) {
      clearInterval(this.simInterval);
      this.simInterval = null;
    }

    const gameOverScreen = document.getElementById('screen-gameover');
    if (gameOverScreen && this.stateManager) {
      gameOverScreen.classList.remove('hidden');

      const stageEl = document.getElementById('result-stage');
      const scoreEl = document.getElementById('result-score');
      const wpmEl = document.getElementById('result-wpm');
      const comboEl = document.getElementById('result-combo');
      const killsEl = document.getElementById('result-kills');
      const rankBadgeEl = document.getElementById('result-rank-badge');
      const newRecordEl = document.getElementById('result-new-record');

      if (stageEl) stageEl.innerText = `STAGE ${this.stateManager.currentStage}`;
      if (scoreEl) scoreEl.innerText = this.stateManager.score.toLocaleString();
      if (wpmEl) wpmEl.innerText = this.stateManager.maxWpm;
      if (comboEl) comboEl.innerText = this.stateManager.maxCombo;
      if (killsEl) killsEl.innerText = this.stateManager.totalKills;

      const rank = this.stateManager.calculateRankGrade();
      if (rankBadgeEl) {
        rankBadgeEl.innerText = `👑 ${rank} RANK`;
        rankBadgeEl.className = `rank-grade-badge rank-${rank.toLowerCase()}`;
      }

      // 📊 게임 종료 이벤트 로깅 (닉네임 등 개인식별정보는 넘기지 않음)
      if (window.GlobalLeaderboard) {
        window.GlobalLeaderboard.logEvent('game_over', {
          difficulty: this.config.difficulty,
          stage_reached: this.stateManager.currentStage,
          score: this.stateManager.score,
          grade: rank,
          max_wpm: this.stateManager.maxWpm,
          max_combo: this.stateManager.maxCombo
        });
      }

      // 🏆 localStorage TOP 5 저장 (오프라인 폴백용) 및 신기록 배지 표시
      const nickname = this.config.playerNames && this.config.playerNames[0] ? this.config.playerNames[0] : '스트리머';
      const { isNewRecord } = this.stateManager.saveScore(nickname);
      if (newRecordEl) newRecordEl.classList.toggle('hidden', !isNewRecord);
      if (isNewRecord) {
        this.showToastInternal('🎉 명예의 전당 신기록을 달성했습니다!', 'success');
      }

      // 🌐 글로벌 명예의 전당(Firestore)에도 함께 제출 (설정된 경우에만, 실패해도 게임에 영향 없음)
      if (window.GlobalLeaderboard && window.GlobalLeaderboard.enabled) {
        window.GlobalLeaderboard.submitScore({
          nickname,
          score: this.stateManager.score,
          stage: this.stateManager.currentStage,
          wpm: this.stateManager.maxWpm,
          combo: this.stateManager.maxCombo,
          grade: rank,
          date: new Date().toISOString().slice(0, 10),
          difficulty: this.config.difficulty
        }).then(ok => {
          if (ok) this.showToastInternal('🌐 글로벌 명예의 전당에 기록을 제출했습니다.', 'info');
        });
      }

      // 💰 결과 화면 광고 리프레시 (150ms 비동기 실행)
      setTimeout(() => {
        if (window.refreshAdfitSlot) window.refreshAdfitSlot('ad-container-gameover');
      }, 150);
    }
  }
}

// 초기화
window.gameEngine = new GameEngine();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.gameEngine.init());
} else {
  window.gameEngine.init();
}

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
    // 🏅 이번 판 MVP 집계: 실제 참여 시청자(봇/보스 제외) 닉네임별 몬스터 "등장(참여)" 수 누적
    //    (처치 여부와 무관 — 스폰 시점에 MonsterManager가 trackMvpAppearance로 보고)
    this.mvpTracker = new Map();
    this.bgStars = [];
    this.bgAnimId = null;

    this.leaderboardCache = null;          // 명예의 전당 캐시 { source: 'global'|'local', scores: Array }
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
      // 🖥️ 무대(1024×708 고정)를 창에 맞춰 비율 스케일 → 그 뒤 백버퍼 해상도 갱신
      this.fitStage();
      this.renderer.resizeCanvas();
      this.resizeBgCanvas();
      window.addEventListener('resize', () => {
        this.fitStage();                                   // 무대 스케일 재계산 (게임 좌표는 불변)
        if (this.renderer) this.renderer.resizeCanvas();   // 새 표시 크기에 맞춰 백버퍼만 갱신 → 선명도 유지
        this.resizeBgCanvas();
      });
    }

    if (this.turretManager) {
      this.turretManager.setupTurrets(1, this.config.playerNames, canvas);
    }

    // 4. 보스 WARNING 배너 콜백 연결
    if (this.monsterManager) {
      this.monsterManager.onBossWarning = (stage) => {
        this.showBanner(`⚠️ STAGE ${stage} BOSS WARNING ⚠️`, '보스가 기를 모읍니다! 게이지가 차기 전에 제시어를 격파하세요!', true);
        if (window.audioManager) window.audioManager.playFever();
      };
      // 🐲 보스 차지 게이지가 다 차면(공격 발동) 기지에 정액 피해
      this.monsterManager.onBossAttack = (damage) => this.handleBossAttack(damage);
    }

    // 5. 피버 버스트(화면 클리어 + 보너스 + 소량 회복) 콜백 연결
    if (this.stateManager) {
      this.stateManager.onFeverStart = () => this.triggerFeverBurst();

      // 🔒 게임 플레이 중에는 플레이와 무관한 상단바 버튼(단어팩·명예의전당·후원·건의사항)을
      //    비활성화한다. 이 모달들은 열려도 게임을 멈추지 않아, 플레이 중 클릭 시 그냥 지게 되기 때문.
      //    (라이브 채팅 모드·OBS 크로마키·사운드는 방송 중 즉시 조정이 필요하므로 잠그지 않는다)
      this.stateManager.onStateChange = (newState) => this.updateTopBarLock(newState);
    }

    // 6. UI 및 이벤트 바인딩
    this.bindUIEvents();
    this.initToastSystem();
    this.startBackgroundStarfield();

    // 홈 화면의 방송 채팅 연동 패널: 시작부터 참여자/연동 목록을 실시간 갱신
    this.startChatPanelLiveRefresh();

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

  /**
   * 🖥️ 고정 무대(1024×708)를 상단 바 아래 남는 영역에 "비율 유지"로 맞춘다.
   *    내부 논리 좌표는 그대로 두고 CSS transform:scale 배율(--stage-scale)만 조정하므로
   *    창을 키우거나 줄여도 게임 좌표·방어선·몬스터 위치가 절대 바뀌지 않는다.
   *    (상단바 60px + 무대 708px = 1024×768 PC 최소 해상도에 정확히 맞음)
   */
  fitStage() {
    const frame = document.querySelector('.stage-frame');
    const stage = document.getElementById('game-stage');
    if (!frame || !stage) return;
    const availW = frame.clientWidth;
    const availH = frame.clientHeight;
    if (availW <= 0 || availH <= 0) return;
    const scale = Math.min(availW / 1024, availH / 708);
    stage.style.setProperty('--stage-scale', String(scale));
  }

  resizeBgCanvas() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    // 표시 크기(무대 scale 반영) × DPR 로 백버퍼를 잡아 어떤 배율에서도 선명하게
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round((rect.width || 1024) * dpr));
    canvas.height = Math.max(1, Math.round((rect.height || 708) * dpr));
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
      { btnId: 'btn-word-modal', modalId: 'modal-words', adContainerId: 'ad-container-words' },
      { btnId: 'btn-leaderboard-modal', modalId: 'modal-leaderboard', adContainerId: 'ad-container-leaderboard' },
      { btnId: 'btn-support-modal', modalId: 'modal-support', adContainerId: 'ad-container-support' },
      { btnId: 'btn-suggestion-modal', modalId: 'modal-suggestion', adContainerId: 'ad-container-suggestion' }
    ];

    modalMap.forEach(({ btnId, modalId, adContainerId }) => {
      const btn = document.getElementById(btnId);
      const modal = document.getElementById(modalId);
      if (btn && modal) {
        btn.addEventListener('click', () => {
          // 🔒 게임 플레이 중 잠긴 버튼은 클릭 무시 (updateTopBarLock이 qc-locked 부여)
          if (btn.classList.contains('qc-locked')) return;

          // ⚡ 1. 클릭하는 순간 모달창부터 0ms 만에 즉시 띄움
          modal.classList.remove('hidden');

          // 모달별 진입 시 최신 데이터 렌더링 (명예의 전당은 항상 TOP5로 초기화)
          if (modalId === 'modal-leaderboard') this.renderLeaderboard(false);
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

    // 🏆 명예의 전당 전체 ↔ TOP5 토글
    const lbAllBtn = document.getElementById('btn-leaderboard-all');
    if (lbAllBtn) {
      lbAllBtn.addEventListener('click', () => this.renderLeaderboard(!this.leaderboardShowAll));
    }

    // ⏸ 일시정지/재개: ESC 키 또는 마우스(일시정지/계속하기 버튼).
    //    스페이스바는 제시어(특히 라이브 채팅 문구)에 공백이 들어갈 수 있어 사용하지 않는다.
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!this.stateManager || this.stateManager.currentState !== 'PLAYING') return;
      if (document.querySelector('.modal-backdrop:not(.hidden)')) return; // 모달 상호작용 우선
      e.preventDefault();
      this.togglePause();
    });
    const pauseBtn = document.getElementById('btn-pause');
    if (pauseBtn) pauseBtn.addEventListener('click', () => this.togglePause());
    const resumeBtn = document.getElementById('btn-pause-resume');
    if (resumeBtn) resumeBtn.addEventListener('click', () => this.togglePause());

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

    // 게임 시작 / 재시작 / 메인 이동 버튼
    const btnStart = document.getElementById('btn-start-game');
    if (btnStart) btnStart.addEventListener('click', () => this.startGame());

    const btnRestart = document.getElementById('btn-restart');
    if (btnRestart) btnRestart.addEventListener('click', () => this.restartWithSameParticipants());

    // 메인으로 돌아가기 버튼 (클래스/ID 다중 바인딩 처리)
    document.querySelectorAll('#btn-return-main, .btn-return-main').forEach(btn => {
      btn.addEventListener('click', () => this.returnToMain());
    });

    // 🔄 채팅 연동 모달: 참여자 명단 초기화 버튼
    const btnResetParticipants = document.getElementById('btn-reset-participants');
    if (btnResetParticipants) {
      btnResetParticipants.addEventListener('click', () => {
        if (typeof wordPacks !== 'undefined' && typeof wordPacks.resetParticipants === 'function') {
          wordPacks.resetParticipants();
        }
        this.renderParticipants();
        this.showToastInternal('🔄 참여자 명단을 초기화했습니다.', 'info');
      });
    }

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
        this.copyToClipboard(accountNumber, () => {
          this.showToastInternal(`📋 계좌번호가 복사되었습니다! (${accountNumber})`, 'success');
        });
      });
    }

    this.bindChatModalEvents();
    this.bindWordPackModalEvents();
    this.bindLiveChatToggle();
    this.bindObsToggle();
    this.bindSfxToggle();
    this.bindSuggestionModal();
  }

  /* ==========================================================
   * 💡 건의사항 모달: 입력 → Firestore(suggestions) 저장
   * ========================================================== */
  bindSuggestionModal() {
    const btn = document.getElementById('btn-submit-suggestion');
    const textEl = document.getElementById('input-suggestion-text');
    const nickEl = document.getElementById('input-suggestion-nickname');
    const countEl = document.getElementById('suggestion-charcount');

    // 글자수 카운터 실시간 갱신
    if (textEl && countEl) {
      textEl.addEventListener('input', () => {
        countEl.textContent = String(textEl.value.length);
      });
    }

    if (!btn) return;
    btn.addEventListener('click', async () => {
      const text = textEl ? textEl.value.trim() : '';
      if (!text) {
        this.showToastInternal('💡 건의 내용을 입력해주세요!', 'warn');
        if (textEl) textEl.focus();
        return;
      }
      if (!window.GlobalLeaderboard || !window.GlobalLeaderboard.enabled) {
        this.showToastInternal('⚠️ 지금은 건의사항 전송을 사용할 수 없습니다. 잠시 후 다시 시도해주세요.', 'warn');
        return;
      }

      btn.disabled = true;
      const nickname = nickEl ? nickEl.value.trim() : '';
      const ok = await window.GlobalLeaderboard.submitSuggestion(text, nickname);
      btn.disabled = false;

      if (ok) {
        this.showToastInternal('📨 건의사항이 전송되었습니다. 소중한 의견 감사합니다! 💛', 'success');
        if (textEl) textEl.value = '';
        if (nickEl) nickEl.value = '';
        if (countEl) countEl.textContent = '0';
        const modal = document.getElementById('modal-suggestion');
        if (modal) modal.classList.add('hidden');
      } else {
        this.showToastInternal('⚠️ 전송에 실패했습니다. 네트워크를 확인 후 다시 시도해주세요.', 'warn');
      }
    });
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

    // 다음에 소환될 순서대로 앞에서 최대 8개. 라이브 채팅 문구가 실린 실참여자는 🔥로 강조.
    const upcoming = queue.slice(0, 8);
    const html = upcoming.map(entry => {
      const name = entry && entry.nickname ? entry.nickname : '[BOT]';
      const isBot = name.startsWith('[BOT]');
      if (entry && entry.chatWord) {
        return `<span class="queue-item queue-item-live">🔥 ${this.escapeHtml(name)}: ${this.escapeHtml(entry.chatWord)}</span>`;
      }
      return `<span class="queue-item${isBot ? ' queue-item-bot' : ''}">${this.escapeHtml(name)}</span>`;
    }).join('');

    listEl.innerHTML = html;
  }

  /**
   * 홈 화면(방송 채팅 연동 패널)이 보이는 동안 연동 목록/참여자 목록을 주기적으로 갱신한다.
   * 게임이 시작되어 홈(screen-main)이 숨겨지면 자동으로 멈추고, 홈으로 돌아오면 다시 시작한다.
   */
  startChatPanelLiveRefresh() {
    this.renderActiveChannels();
    this.renderParticipants();

    clearInterval(this._chatModalTimer);
    this._chatModalTimer = setInterval(() => {
      const home = document.getElementById('screen-main');
      if (!home || home.classList.contains('hidden')) {
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
   * 🔒 상단바 버튼 잠금 토글: 게임 플레이 중(PLAYING/READY)에는 플레이와 무관한 모달 버튼을 막는다.
   *    막는 대상은 게임을 멈추지 않는 모달(단어팩·명예의전당·후원·건의사항)뿐이며,
   *    라이브 채팅 모드·OBS·사운드는 방송 중 즉시 조정이 필요하므로 항상 활성 상태로 둔다.
   * @param {string} [state] - 현재 상태. 생략 시 stateManager에서 읽는다.
   */
  updateTopBarLock(state) {
    const current = state || (this.stateManager ? this.stateManager.currentState : 'MENU');
    const inGame = current === 'PLAYING' || current === 'READY';

    const lockIds = ['btn-word-modal', 'btn-leaderboard-modal', 'btn-support-modal', 'btn-suggestion-modal'];
    lockIds.forEach(id => {
      const btn = document.getElementById(id);
      if (!btn) return;
      // disabled 속성 대신 클래스로 잠근다: disabled면 hover가 안 잡혀 안내 툴팁이 뜨지 않기 때문.
      // 실제 클릭 차단은 bindUIEvents의 모달 핸들러에서 qc-locked를 검사해 막는다.
      btn.classList.toggle('qc-locked', inGame);
      btn.setAttribute('aria-disabled', String(inGame));
      // 게임 중에는 툴팁으로 이유를 안내, 아니면 원래 안내로 복원
      if (inGame) {
        btn.dataset.tipRest = btn.dataset.tipRest || btn.getAttribute('data-tip') || '';
        btn.setAttribute('data-tip', '게임 중에는 사용할 수 없어요 (일시정지 후 이용)');
      } else if (btn.dataset.tipRest) {
        btn.setAttribute('data-tip', btn.dataset.tipRest);
      }
    });
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
        // 아이콘(💬)은 고정, 라벨 span만 갱신 → 아이콘 축소 모드/툴팁 구조 유지
        this._setQcLabel(topBtn, enabled ? '라이브 채팅 모드: ON' : '라이브 채팅 모드: OFF');
      }

      this._syncLiveChatModalBtn(enabled);
    };

    const toggleMode = () => {
      if (typeof wordPacks === 'undefined') return;
      wordPacks.liveChatMode = !wordPacks.liveChatMode;
      updateUI();
      this.showToastInternal(
        wordPacks.liveChatMode
          ? '🟢 라이브 채팅 모드 ON — !참여한 시청자의 채팅이 제시어가 됩니다.'
          : '🔴 라이브 채팅 모드 OFF — 안전 단어팩으로 돌아갑니다.',
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
   * 💬 단어팩 모달 안의 라이브 채팅 토글 버튼 상태를 현재 모드에 맞춰 동기화한다.
   *    (상단바 토글·모달 진입 미리보기 양쪽에서 공용 — 라벨/활성/설정박스 테두리 일괄 갱신)
   * @param {boolean} enabled - 라이브 채팅 모드 ON 여부
   */
  _syncLiveChatModalBtn(enabled) {
    const modalBtn = document.getElementById('btn-modal-live-chat-toggle');
    if (!modalBtn) return;
    modalBtn.classList.toggle('active', enabled);
    modalBtn.setAttribute('aria-pressed', String(enabled));
    modalBtn.textContent = enabled ? '💬 라이브 모드: ON' : '💬 라이브 모드: OFF';
    const settingsBox = modalBtn.closest('.live-chat-settings');
    if (settingsBox) settingsBox.classList.toggle('live-active', enabled);
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

    this._syncLiveChatModalBtn(!!wordPacks.liveChatMode);

    const words = wordPacks.getActiveWords();
    if (!words || words.length === 0) {
      previewEl.innerHTML = '<span class="word-pack-preview-empty">표시할 단어가 없습니다.</span>';
      return;
    }

    previewEl.innerHTML = words.map(w => `<span class="word-chip">${this.escapeHtml(w)}</span>`).join('');
  }

  /* ==========================================================
   * 🏆 명예의 전당 (최고 도달 스테이지 기준 단일 TOP 5, localStorage + 글로벌)
   * ========================================================== */

  /**
   * 🏆 명예의 전당 데이터 로드: 글로벌(Firestore)이 설정돼 있으면 스테이지 기준으로 조회해 캐시하고,
   * 미설정이거나 네트워크 실패 시 로컬(localStorage) 스테이지 기준 TOP5로 자동 폴백한다.
   */
  async renderLeaderboard(showAll = false) {
    const listEl = document.getElementById('leaderboard-list');
    const sourceEl = document.getElementById('leaderboard-source');
    if (!listEl || !this.stateManager) return;

    this.leaderboardShowAll = showAll;
    const limit = showAll ? 200 : 5; // 전체 보기: 글로벌 최대 200 / 로컬 보관분 전체

    // 📜 전체 ↔ TOP5 토글 버튼 라벨 갱신
    const allBtn = document.getElementById('btn-leaderboard-all');
    if (allBtn) allBtn.textContent = showAll ? '🏅 TOP 5만 보기' : '📜 전체 순위 보기';

    let scores = null;
    let source = 'local';

    if (window.GlobalLeaderboard && window.GlobalLeaderboard.enabled) {
      if (sourceEl) sourceEl.textContent = '🌐 글로벌 기록 불러오는 중...';
      scores = await window.GlobalLeaderboard.fetchTop(limit);
      if (scores) source = 'global';
    }

    if (!scores) {
      source = 'local';
      scores = this.stateManager.getTopScores(limit);
    }

    this.leaderboardCache = { source, scores };

    if (sourceEl) {
      const scopeTxt = showAll ? `전체 순위 (${scores.length}명)` : 'TOP 5';
      sourceEl.textContent = source === 'global'
        ? `🌐 모든 스트리머가 함께 보는 글로벌 ${scopeTxt} (최고 도달 스테이지 기준)입니다.`
        : `💾 이 브라우저에만 저장된 로컬 ${scopeTxt} (최고 도달 스테이지 기준)입니다. (글로벌 미설정 또는 연결 실패)`;
    }

    this.renderLeaderboardList();
  }

  /**
   * 캐시된 단일 TOP 리스트를 그린다 (네트워크 재조회 없음).
   * 랭킹 기준이 '최고 도달 스테이지'이므로 스테이지를 주지표로 강조한다.
   */
  renderLeaderboardList() {
    const listEl = document.getElementById('leaderboard-list');
    if (!listEl || !this.leaderboardCache) return;

    const scores = this.leaderboardCache.scores || [];

    if (scores.length === 0) {
      listEl.innerHTML = '<p class="leaderboard-empty">아직 저장된 전적이 없습니다. 첫 기록에 도전해보세요!</p>';
      return;
    }

    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
    listEl.innerHTML = scores.map((entry, idx) => `
      <div class="leaderboard-row">
        <span class="lb-rank">${medals[idx] || (idx + 1)}</span>
        <span class="lb-nickname">${this.escapeHtml(entry.nickname)}</span>
        <span class="lb-stage">STAGE ${entry.stage || 1}</span>
        <span class="lb-grade rank-${(entry.grade || 'D').toLowerCase()}">${entry.grade}</span>
        <span class="lb-meta">${(entry.score || 0).toLocaleString()}점 · ${entry.wpm || 0}WPM</span>
        <span class="lb-date">${entry.date || ''}</span>
      </div>
    `).join('');
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  /**
   * 📋 클립보드 복사 (Clipboard API 우선, 실패/미지원 시 execCommand 폴백).
   * @param {string} text - 복사할 문자열
   * @param {Function} [onCopied] - 복사 완료 시 콜백
   */
  copyToClipboard(text, onCopied) {
    const fallback = () => {
      const tempInput = document.createElement('input');
      tempInput.value = text;
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand('copy');
      document.body.removeChild(tempInput);
      if (onCopied) onCopied();
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => onCopied && onCopied()).catch(fallback);
    } else {
      fallback();
    }
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
      this._setQcLabel(btn, active ? 'OBS 모드: ON (배경 투명)' : 'OBS 크로마키 (배경 투명)');
      this.showToastInternal(active ? '📺 OBS 크로마키 모드가 켜졌습니다.' : '📺 OBS 크로마키 모드가 꺼졌습니다.', 'info');
    });
  }

  bindSfxToggle() {
    const btn = document.getElementById('btn-sfx-toggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (!window.audioManager) return;
      const enabled = window.audioManager.toggleSound();
      // 사운드는 아이콘도 상태에 따라 바뀜(🔊/🔇)
      this._setQcLabel(btn, enabled ? '사운드: ON' : '사운드: OFF', enabled ? '🔊' : '🔇');
    });
  }

  /**
   * 상단 컨트롤 버튼(.qc-btn)의 라벨 span과 툴팁(data-tip)을 갱신한다.
   * 아이콘 축소 모드에서 라벨이 숨겨져도 data-tip(호버 툴팁)으로 현재 상태를 보여준다.
   * @param {HTMLElement} btn - 대상 버튼
   * @param {string} label - 라벨 텍스트(아이콘 제외)
   * @param {string} [icon] - 지정 시 아이콘 span도 교체(사운드 on/off처럼 아이콘이 바뀌는 경우)
   */
  _setQcLabel(btn, label, icon) {
    if (!btn) return;
    const txEl = btn.querySelector('.qc-tx');
    const icEl = btn.querySelector('.qc-ic');
    if (icon && icEl) icEl.textContent = icon;
    if (txEl) {
      txEl.textContent = label;
    } else {
      // 방어적 폴백: span 구조가 없으면 통째로 설정
      btn.textContent = (icon || (icEl ? icEl.textContent : '')) + ' ' + label;
    }
    btn.setAttribute('data-tip', label);
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

    // ⏸ 새 판 시작 시 일시정지 상태 초기화
    this.isPaused = false;
    this._pauseStart = null;
    const pauseOverlay = document.getElementById('pause-overlay');
    if (pauseOverlay) pauseOverlay.classList.add('hidden');

    // 스트리머 닉네임 필수: 비어 있으면 시작을 막고 입력을 유도한다.
    const nicknameInput = document.getElementById('input-player-nickname');
    const nickname = nicknameInput ? nicknameInput.value.trim() : '';
    if (!nickname) {
      // 입력칸이 접이식 연동 패널 안에 있으므로 펼쳐서 보이게 한 뒤 포커스
      const chatPanel = document.getElementById('home-chat-panel');
      if (chatPanel) chatPanel.open = true;
      if (nicknameInput) nicknameInput.focus();
      this.showToastInternal('🎨 스트리머 닉네임을 먼저 입력해주세요!', 'warn');
      return;
    }
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
    this.mvpTracker = new Map(); // 🏅 새 판 시작 시 MVP 집계 초기화
    // ⚠️ 참여자 명단은 여기서 리셋하지 않는다. 게임 시작 전에 모인 시청자가 지워지기 때문.
    //    명단 리셋은 판이 끝나 메인으로 돌아갈 때(returnToMain)에서 수행한다.

    if (this.stateManager) this.stateManager.resetGame(this.config);
    if (this.turretManager) this.turretManager.setupTurrets(1, this.config.playerNames, canvas);
    // 게임 시작 직후엔 시청자가 !참여로 모일 여유(그레이스 타임)를 두고 첫 몬스터를 소환한다.
    const startDelayMs = (typeof CONFIG !== 'undefined' && CONFIG.START_SPAWN_DELAY_MS) || 0;
    if (this.monsterManager) this.monsterManager.startStage(this.stateManager ? this.stateManager.currentStage : 1, this.config.difficulty, startDelayMs);
    // ⏱️ 그레이스 타임 동안 화면 중앙에 카운트다운 표시(시청자 !참여 유도)
    if (startDelayMs > 0) this.showStartCountdown(startDelayMs);

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
    // ⏸ 일시정지 상태/오버레이 해제
    this.isPaused = false;
    this._pauseStart = null;
    const pauseOverlay = document.getElementById('pause-overlay');
    if (pauseOverlay) pauseOverlay.classList.add('hidden');
    this.stopStartCountdown(); // ⏱️ 진행 중이던 시작 카운트다운 정리

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

    // 🔄 판이 끝나 메인으로 돌아올 때 참여자 명단을 새로 시작 (다음 판은 시청자를 다시 모집)
    if (typeof wordPacks !== 'undefined' && typeof wordPacks.resetParticipants === 'function') {
      wordPacks.resetParticipants();
    }

    // 재모집 유도: 홈의 채팅 연동 패널을 펼치고 참여자/연동 목록 실시간 갱신을 재개한다.
    const chatPanel = document.getElementById('home-chat-panel');
    if (chatPanel) chatPanel.open = true;
    this.startChatPanelLiveRefresh();

    setTimeout(() => {
      if (window.refreshAdfitSlot) window.refreshAdfitSlot('ad-container-main');
    }, 150);
  }

  /**
   * 🔄 '다시 도전하기': 참여자 명단을 그대로 유지한 채 즉시 새 판을 시작한다.
   *    startGame()은 참여자 명단(wordPacks)을 리셋하지 않으므로, 방금 판에 모인 시청자가
   *    그대로 다음 판에 이어진다. (참여자 리셋은 '메인 화면으로'(returnToMain)에서만 수행)
   */
  restartWithSameParticipants() {
    this.startGame();
  }

  /**
   * ⌨️ 타자 입력 제출 처리 (명중/오타 판정, 점수/콤보/CPM/WPM, 사운드, 스테이지 진행)
   */
  handleTypingSubmit(playerIdx, text) {
    if (!this.stateManager || this.stateManager.currentState !== 'PLAYING') return;
    if (this.isPaused) return; // 일시정지 중에는 제출 무시

    const hitResult = this.monsterManager ? this.monsterManager.checkHit(text) : null;

    if (!hitResult || !hitResult.success) {
      // ❌ 일치하는 몬스터 없음 = 오타/미스
      if (window.audioManager) window.audioManager.playError();
      if (this.stateManager) this.stateManager.registerMiss();
      return;
    }

    const { monster, isKilled, isBoss, bossDamaged } = hitResult;

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

    // 🐲 보스 피격(아직 생존): 점수·콤보·타수는 인정하되 처치 수는 늘리지 않고, 피격 연출만 낸다.
    if (bossDamaged) {
      if (this.stateManager) this.stateManager.registerHit(text, monster.scoreValue || 100, false);
      if (window.audioManager) window.audioManager.playExplosion();
      monster._flashUntil = performance.now() + 170; // 렌더러 피격 플래시(붉게 번쩍)
      return;
    }

    if (isKilled) {
      if (this.renderer) this.renderer.addExplosionEffect(monster);
      if (window.audioManager) window.audioManager.playExplosion();
      if (this.stateManager) this.stateManager.registerHit(text, monster.scoreValue || 100);

      // 🏆 스테이지 진행: 보스 처치 or 일반 처치 누적 목표 달성 시 다음 스테이지로
      if (isBoss) {
        // 💚 보스 처치 보상: 기지 체력 일부 회복(최대 체력의 25%, 상한 초과분은 버림)
        if (this.stateManager) {
          const healAmount = Math.round(this.stateManager.maxHp * 0.25);
          const healed = this.stateManager.healBase(healAmount);
          if (healed > 0) this.showToastInternal(`💚 보스 격파! 기지 +${healed} 회복`, 'success');
        }
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

    // ⏱️ 스테이지업 때마다 잠깐 숨 돌릴 여유(기본 5초) 후 다음 몬스터/보스 소환
    const stageUpDelay = (typeof CONFIG !== 'undefined' && CONFIG.STAGE_UP_SPAWN_DELAY_MS != null)
      ? CONFIG.STAGE_UP_SPAWN_DELAY_MS : 5000;
    this.monsterManager.startStage(this.stateManager.currentStage, this.config.difficulty, stageUpDelay);
    this.stateManager.updateHUDUI();

    if (window.audioManager) window.audioManager.playStageUp();

    const isBossStage = this.stateManager.currentStage % 5 === 0;
    if (!isBossStage) {
      this.showBanner(`STAGE ${this.stateManager.currentStage} START!`, '시청자 몬스터를 타자로 방어하세요!', false);
    }
  }

  /**
   * 🔥 피버 버스트: 피버 게이지가 다 차면 화면의 일반 몬스터를 한 번에 정리하고
   *    보너스 점수 + 소량 회복을 준다(보스는 남긴다). '칠 게 없는 타이밍'에도 확실한 보상.
   */
  triggerFeverBurst() {
    if (!this.monsterManager || !this.stateManager) return;

    const cleared = this.monsterManager.clearNonBoss();

    // 정리된 몬스터마다 폭발 이펙트 + 점수 합산 (+ 기본 보너스)
    let bonus = 0;
    cleared.forEach(m => {
      if (this.renderer) this.renderer.addExplosionEffect(m);
      bonus += (m.scoreValue || 100);
    });
    const totalBonus = bonus + 500;
    this.stateManager.addFeverBonus(totalBonus);

    // 기지 소량 회복 (최대 체력의 10%, 상한 초과분 버림)
    const heal = Math.round(this.stateManager.maxHp * 0.1);
    const healed = this.stateManager.healBase(heal);

    if (window.audioManager) {
      window.audioManager.playFever();
      window.audioManager.playExplosion();
    }

    const parts = [`🔥 FEVER! +${totalBonus.toLocaleString()}점`];
    if (cleared.length > 0) parts.push(`${cleared.length}마리 정리`);
    if (healed > 0) parts.push(`기지 +${healed}`);
    this.showToastInternal(parts.join(' · '), 'success');
  }

  /**
   * 🐲 보스 차지 공격 발동: 게이지가 다 차면 기지에 정액 피해를 입힌다(느릴수록 누적).
   * @param {number} damage
   */
  handleBossAttack(damage) {
    if (!this.stateManager || this.stateManager.currentState !== 'PLAYING') return;
    const isDead = this.stateManager.damageBaseFlat(damage);
    if (window.audioManager) window.audioManager.playExplosion();
    this.showToastInternal(`💥 보스 공격! 기지 -${damage}`, 'warn');
    if (isDead) {
      this.stateManager.changeState('GAME_OVER');
      this.showGameOverScreen();
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

  /**
   * ⏱️ 게임 시작 그레이스 타임 카운트다운 표시.
   *   첫 몬스터 스폰까지 남은 초를 화면 중앙에 크게 보여주며(5→4→3→2→1),
   *   그 사이 시청자가 '!참여'로 모일 수 있음을 안내한다.
   * @param {number} delayMs - 첫 스폰까지의 그레이스 타임(ms)
   */
  showStartCountdown(delayMs) {
    const overlay = document.getElementById('start-countdown');
    const numEl = document.getElementById('start-countdown-num');
    if (!overlay || !numEl) return;

    this.stopStartCountdown(); // 혹시 남아있던 이전 카운트다운 정리

    let remaining = Math.ceil(delayMs / 1000);
    const render = () => {
      numEl.innerText = remaining;
      // tick 애니메이션 재생(클래스 재적용을 위해 리플로우 강제)
      numEl.classList.remove('tick');
      void numEl.offsetWidth;
      numEl.classList.add('tick');
    };

    overlay.classList.remove('hidden');
    render();

    this._countdownInterval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        this.stopStartCountdown();
        return;
      }
      render();
    }, 1000);
  }

  /** 카운트다운 오버레이/타이머 정리 */
  stopStartCountdown() {
    if (this._countdownInterval) {
      clearInterval(this._countdownInterval);
      this._countdownInterval = null;
    }
    const overlay = document.getElementById('start-countdown');
    if (overlay) overlay.classList.add('hidden');
  }

  /**
   * ⏸ 일시정지 토글 (스페이스바). 게임 진행 중일 때만 동작.
   *   - 몬스터 이동/스폰을 멈추고, 일시정지 동안 흐른 시간을 startTime에 더해
   *     WPM/경과시간 계산에서 제외한다(화장실 등으로 잠깐 비워도 타수가 왜곡되지 않음).
   */
  togglePause() {
    if (!this.stateManager || this.stateManager.currentState !== 'PLAYING') return;

    this.isPaused = !this.isPaused;
    const overlay = document.getElementById('pause-overlay');
    const input = document.querySelector('.game-typing-input');

    if (this.isPaused) {
      this._pauseStart = performance.now();
      if (overlay) overlay.classList.remove('hidden');
      if (input) { input.blur(); input.disabled = true; } // 일시정지 중 입력 차단
    } else {
      // 일시정지 동안 흐른 시간만큼 startTime을 미뤄 경과시간(=WPM 분모)에서 제외
      if (this._pauseStart && this.stateManager.startTime) {
        this.stateManager.startTime += (performance.now() - this._pauseStart);
      }
      this._pauseStart = null;
      if (overlay) overlay.classList.add('hidden');
      if (input) { input.disabled = false; setTimeout(() => input.focus(), 30); }
      // ▶ 정지 동안 타이머가 발화하며 스킵된 '스테이지 첫 등장'을 복구 (재개 후 빈 화면 방지)
      if (this.monsterManager) this.monsterManager.resumeSpawns();
    }
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
    // ⏸ 일시정지 중에는 몬스터 이동/포탑/이펙트를 모두 멈춘다 (스폰은 _spawnTick에서 별도 차단)
    if (this.isPaused) return;

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

  /**
   * 🏅 MVP 등장(참여) 집계: 실참여 시청자의 몬스터가 화면에 뜰 때마다 MonsterManager가 호출.
   *    처치 여부와 무관하게 "낸 몬스터 수"를 닉네임별로 누적한다. 봇/보스는 호출되지 않음.
   * @param {string} username - 몬스터에 표시되는 시청자 닉네임
   */
  trackMvpAppearance(username) {
    const name = (username || '').toString().trim();
    if (!name) return;
    this.mvpTracker.set(name, (this.mvpTracker.get(name) || 0) + 1);
  }

  /**
   * 🏅 이번 판 MVP 산출: 실참여 시청자(봇/보스 제외) 중 몬스터를 가장 많이 낸 닉네임.
   * 동점이면 먼저 집계된(=먼저 참여한) 시청자를 우선한다. 참여자가 없으면 null.
   * @returns {{name: string, count: number}|null}
   */
  computeMvp() {
    if (!this.mvpTracker || this.mvpTracker.size === 0) return null;
    let best = null;
    for (const [name, count] of this.mvpTracker.entries()) {
      if (!best || count > best.count) best = { name, count };
    }
    return best;
  }

  showGameOverScreen() {
    document.getElementById('game-hud').classList.add('hidden');
    document.getElementById('typing-input-bar').classList.add('hidden');
    const queuePanel = document.getElementById('queue-panel');
    if (queuePanel) queuePanel.classList.add('hidden');

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

      // 🏅 이번 판 MVP(최다 처치 실참여 시청자) 표시. 참여 시청자가 없으면(봇만) 숨김.
      const mvp = this.computeMvp();
      const mvpEl = document.getElementById('result-mvp');
      const mvpNameEl = document.getElementById('result-mvp-name');
      const mvpKillsEl = document.getElementById('result-mvp-kills');
      if (mvpEl) {
        if (mvp) {
          if (mvpNameEl) mvpNameEl.innerText = mvp.name; // 닉네임은 시청자 입력값이라 innerText로 안전 처리
          if (mvpKillsEl) mvpKillsEl.innerText = `몬스터 ${mvp.count}마리 참여`;
          mvpEl.classList.remove('hidden');
        } else {
          mvpEl.classList.add('hidden');
        }
      }

      const rank = this.stateManager.calculateRankGrade();
      if (rankBadgeEl) {
        rankBadgeEl.innerText = `👑 ${rank} RANK`;
        rankBadgeEl.className = `rank-grade-badge rank-${rank.toLowerCase()}`;
      }

      // 🌐 글로벌 상위 %(누적 기록 기준). 누적 기록이 MIN_SAMPLE 미만이면 '집계 중',
      //    Firebase 미설정/오프라인이면 아예 숨긴다. (조회는 비동기 — 먼저 '집계 중'을 띄우고 갱신)
      const pctEl = document.getElementById('result-percentile');
      if (pctEl) {
        if (window.GlobalLeaderboard && window.GlobalLeaderboard.enabled) {
          pctEl.classList.remove('hidden');
          pctEl.innerText = '상위 집계 중…';
          window.GlobalLeaderboard.fetchPercentile(this.stateManager.score).then(res => {
            if (!res || !res.available) { pctEl.classList.add('hidden'); return; }
            if (res.enough) {
              const p = res.topPercent;
              pctEl.innerText = `상위 ${p < 1 ? p.toFixed(1) : Math.round(p)}%`;
            } else {
              pctEl.innerText = '상위 집계 중…';
            }
          });
        } else {
          pctEl.classList.add('hidden');
        }
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
          date: new Date().toISOString().slice(0, 10)
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

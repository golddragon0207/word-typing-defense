/**
 * ============================================================
 * GameEngine UI 파트 — 🎛️ 상단바 퀵컨트롤 (js/ui/quickControls.js)
 *   상단바 버튼 잠금 + 라이브 채팅/OBS/사운드 토글 + 라벨/포커스 헬퍼(부분 클래스).
 *   game.js가 클래스를 정의한 뒤 로드되어야 한다.
 * ============================================================
 */
(function () {
  if (typeof GameEngine === 'undefined') {
    console.error('[ui/quickControls] GameEngine이 정의되기 전에 로드되었습니다. index.html의 스크립트 순서를 확인하세요.');
    return;
  }
  const P = GameEngine.prototype;

  /**
   * 🔒 상단바 버튼 잠금 토글: 게임 플레이 중(PLAYING/READY)에는 플레이와 무관한 모달 버튼을 막는다.
   *    막는 대상은 게임을 멈추지 않는 모달(명예의전당·후원·건의사항)뿐이며,
   *    라이브 채팅 모드·OBS·사운드는 방송 중 즉시 조정이 필요하므로 항상 활성 상태로 둔다.
   * @param {string} [state] - 현재 상태. 생략 시 stateManager에서 읽는다.
   */
  P.updateTopBarLock = function (state) {
    const current = state || (this.stateManager ? this.stateManager.currentState : 'MENU');
    const inGame = current === 'PLAYING' || current === 'READY';

    const lockIds = ['btn-leaderboard-modal', 'btn-support-modal', 'btn-suggestion-modal'];
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
  };

  /**
   * 💬 라이브 채팅 제시어 모드: `!참여`한 시청자의 후속 채팅만 타깃 단어로 사용한다.
   * 상단 컨트롤바 버튼 및 홈 참여자 명단 헤더 버튼 어느 곳에서나 토글 가능하며 실시간 양방향 동기화된다.
   */
  P.bindLiveChatToggle = function () {
    const topBtn = document.getElementById('btn-live-chat-toggle');
    const modalBtn = document.getElementById('btn-modal-live-chat-toggle');

    const updateUI = () => {
      const enabled = typeof wordPacks !== 'undefined' && wordPacks.liveChatMode;

      if (topBtn) {
        topBtn.classList.toggle('active', enabled);
        topBtn.setAttribute('aria-pressed', String(enabled));
        // 아이콘(💬)은 고정, 라벨 span만 갱신 → 아이콘 축소 모드/툴팁 구조 유지
        this._setQcLabel(topBtn, enabled ? '라이브 ON' : '라이브 OFF');
      }

      this._syncLiveChatModalBtn(enabled);
    };

    const toggleMode = (btn) => {
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
      this._blurQuickControl(btn);
    };

    if (topBtn) topBtn.addEventListener('click', () => toggleMode(topBtn));
    if (modalBtn) modalBtn.addEventListener('click', () => toggleMode(modalBtn));

    updateUI();
  };

  /**
   * 💬 홈 참여자 명단 헤더의 라이브 채팅 토글 버튼(`#btn-modal-live-chat-toggle`) 상태를 현재 모드에 맞춰 동기화한다.
   *    (상단바 토글과 양쪽에서 공용 — 라벨/활성/설정박스 테두리 일괄 갱신)
   * @param {boolean} enabled - 라이브 채팅 모드 ON 여부
   */
  P._syncLiveChatModalBtn = function (enabled) {
    const modalBtn = document.getElementById('btn-modal-live-chat-toggle');
    if (!modalBtn) return;
    modalBtn.classList.toggle('active', enabled);
    modalBtn.setAttribute('aria-pressed', String(enabled));
    modalBtn.textContent = enabled ? '💬 라이브 모드: ON' : '💬 라이브 모드: OFF';
    const settingsBox = modalBtn.closest('.live-chat-settings');
    if (settingsBox) settingsBox.classList.toggle('live-active', enabled);
  };

  /* ==========================================================
   * 📺 OBS 크로마키 토글 / 🔊 사운드 토글
   * ========================================================== */
  P.bindObsToggle = function () {
    const btn = document.getElementById('btn-obs-toggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const active = document.body.classList.toggle('obs-overlay');
      if (typeof this.syncBackgroundStarfield === 'function') {
        this.syncBackgroundStarfield();
      }
      btn.classList.toggle('active', active);
      this._setQcLabel(btn, active ? 'OBS 투명 ON' : 'OBS 투명 OFF');
      this.showToastInternal(active ? '📺 OBS 크로마키 모드가 켜졌습니다.' : '📺 OBS 크로마키 모드가 꺼졌습니다.', 'info');
      this._blurQuickControl(btn);
    });
  };

  P.bindSfxToggle = function () {
    const btn = document.getElementById('btn-sfx-toggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (!window.audioManager) return;
      const enabled = window.audioManager.toggleSound();
      // 사운드는 아이콘도 상태에 따라 바뀜(🔊/🔇)
      this._setQcLabel(btn, enabled ? '사운드 ON' : '사운드 OFF', enabled ? '🔊' : '🔇');
      this._blurQuickControl(btn);
    });
  };

  /**
   * 상단 라이브 컨트롤 버튼(라이브 채팅/OBS/사운드) 클릭 후처리.
   *   마우스 클릭 시 버튼에 포커스가 남으면, 이어지는 Enter가 그 버튼을 재클릭
   *   (토글 재발동)해 방송 중 모드가 의도치 않게 뒤집힌다. 클릭 직후 포커스를 떼고,
   *   게임 진행 중이면 제시어 입력창으로 되돌려 곧바로 타이핑을 이어갈 수 있게 한다.
   * @param {HTMLElement} btn - 방금 클릭된 버튼
   */
  P._blurQuickControl = function (btn) {
    if (btn && typeof btn.blur === 'function') btn.blur();
    // 게임 플레이 중(일시정지·모달 아님)이면 입력창으로 포커스 복귀
    const playing = this.stateManager && this.stateManager.currentState === 'PLAYING' && !this.isPaused;
    if (!playing) return;
    const input = document.querySelector('.game-typing-input');
    if (input) input.focus();
  };

  /**
   * 상단 컨트롤 버튼(.qc-btn)의 라벨 span과 툴팁(data-tip)을 갱신한다.
   * 아이콘 축소 모드에서 라벨이 숨겨져도 data-tip(호버 툴팁)으로 현재 상태를 보여준다.
   * @param {HTMLElement} btn - 대상 버튼
   * @param {string} label - 라벨 텍스트(아이콘 제외)
   * @param {string} [icon] - 지정 시 아이콘 span도 교체(사운드 on/off처럼 아이콘이 바뀌는 경우)
   */
  P._setQcLabel = function (btn, label, icon) {
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
  };
})();

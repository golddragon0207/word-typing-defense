/**
 * ============================================================
 * GameEngine UI 파트 — 📡 방송 채팅 연동 패널 (js/ui/chatPanel.js)
 *   채팅 연동 모달·참여자 명단·출전 대기열 패널 렌더링을 담당한다(부분 클래스).
 *   game.js가 클래스를 정의한 뒤 로드되어야 한다.
 * ============================================================
 */
(function () {
  if (typeof GameEngine === 'undefined') {
    console.error('[ui/chatPanel] GameEngine이 정의되기 전에 로드되었습니다. index.html의 스크립트 순서를 확인하세요.');
    return;
  }
  const P = GameEngine.prototype;

  /* ==========================================================
   * 📡 방송 채팅 연동 모달 이벤트
   * ========================================================== */
  P.bindChatModalEvents = function () {
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

    if (!this._chatStatusListenerBound) {
      this._chatStatusListenerBound = true;
      window.addEventListener('chat-channel-status', () => this.renderActiveChannels());
    }
  };

  P.renderActiveChannels = function () {
    const list = document.getElementById('active-channels-list');
    const summary = document.getElementById('chat-connection-summary');
    const detail = document.getElementById('chat-connection-detail');
    if (!list || !window.chatEngine) return;

    const channels = window.chatEngine.getActiveChannels();
    if (channels.length === 0) {
      list.innerHTML = '<span class="channel-chip-empty">연동된 방송이 없습니다.</span>';
      if (summary) {
        summary.className = 'connection-summary is-idle';
        summary.textContent = '미연결';
      }
      if (detail) {
        detail.className = 'connection-detail is-idle';
        detail.textContent = '방송 URL을 추가하면 연결 결과가 여기에 표시됩니다.';
      }
      return;
    }

    const connectedCount = channels.filter(ch => ch.status === 'connected').length;
    const errorChannels = channels.filter(ch => ch.status === 'error' || ch.status === 'disconnected');
    const errorCount = errorChannels.length;
    if (summary) {
      if (connectedCount > 0) {
        summary.className = `connection-summary ${errorCount > 0 ? 'is-mixed' : 'is-connected'}`;
        summary.textContent = errorCount > 0
          ? `연결 ${connectedCount} · 오류 ${errorCount}`
          : `연결됨 ${connectedCount}/${channels.length}`;
      } else if (errorCount > 0) {
        summary.className = 'connection-summary is-error';
        summary.textContent = `연결 오류 ${errorCount}`;
      } else {
        summary.className = 'connection-summary is-connecting';
        summary.textContent = '연결 확인 중';
      }
    }

    if (detail) {
      if (errorCount > 0) {
        const failed = errorChannels[0];
        const platformNames = { soop: 'SOOP', chzzk: '치지직', youtube: '유튜브' };
        const more = errorCount > 1 ? ` · 외 ${errorCount - 1}개` : '';
        detail.className = 'connection-detail is-error';
        detail.textContent = `⚠️ ${platformNames[failed.platform] || failed.platform} URL 연동 실패${more}`;
      } else if (connectedCount > 0) {
        detail.className = 'connection-detail is-connected';
        detail.textContent = '✅ 채팅 수신 준비가 완료되었습니다.';
      } else {
        detail.className = 'connection-detail is-connecting';
        detail.textContent = '⏳ 방송 정보와 채팅 서버 연결을 확인하고 있습니다.';
      }
    }

    list.innerHTML = '';
    const statusLabels = {
      connecting: '연결 중',
      connected: '연결됨',
      error: '오류',
      disconnected: '끊김'
    };
    channels.forEach(ch => {
      const chip = document.createElement('span');
      chip.className = `channel-chip channel-chip-${ch.platform} status-${ch.status}`;

      const name = document.createElement('span');
      name.textContent = ch.name;
      chip.appendChild(name);

      const status = document.createElement('span');
      status.className = 'channel-status';
      status.textContent = statusLabels[ch.status] || '확인 중';
      status.title = ch.statusMessage || status.textContent;
      chip.appendChild(status);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'chip-remove';
      remove.dataset.channelId = ch.id;
      remove.setAttribute('aria-label', `${ch.name} 연동 해제`);
      remove.textContent = '✕';
      chip.appendChild(remove);
      list.appendChild(chip);
    });

    list.querySelectorAll('.chip-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = parseFloat(e.currentTarget.getAttribute('data-channel-id'));
        window.chatEngine.removeChannel(id);
        this.renderActiveChannels();
      });
    });
  };

  /**
   * 🙋 `!참여`한 시청자 목록 렌더링 (총원 + 최근 참여자 칩)
   */
  P.renderParticipants = function () {
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
  };

  /**
   * 🕒 게임 중 화면 좌상단 "출전 대기열" 패널 갱신
   * (큐 앞쪽 = 다음에 소환될 순서. 실참여자는 밝게, [BOT]은 흐리게 표시)
   */
  P.renderQueuePanel = function () {
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
  };

  /**
   * 홈 화면(방송 채팅 연동 패널)이 보이는 동안 연동 목록/참여자 목록을 주기적으로 갱신한다.
   * 게임이 시작되어 홈(screen-main)이 숨겨지면 자동으로 멈추고, 홈으로 돌아오면 다시 시작한다.
   */
  P.startChatPanelLiveRefresh = function () {
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
  };
})();

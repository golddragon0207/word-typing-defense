/**
 * ============================================================
 * GameEngine UI 파트 — 📝 모달 (js/ui/modals.js)
 *   단어팩·명예의전당·건의사항 모달 배선/렌더링 + 공용 유틸(escapeHtml/copyToClipboard).
 *   game.js가 클래스를 정의한 뒤 로드되어야 한다(부분 클래스).
 * ============================================================
 */
(function () {
  if (typeof GameEngine === 'undefined') {
    console.error('[ui/modals] GameEngine이 정의되기 전에 로드되었습니다. index.html의 스크립트 순서를 확인하세요.');
    return;
  }
  const P = GameEngine.prototype;

  /* ==========================================================
   * 💡 건의사항 모달: 입력 → Firestore(suggestions) 저장
   * ========================================================== */
  P.bindSuggestionModal = function () {
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
  };

  /* ==========================================================
   * 📝 단어/닉네임 팩 모달 이벤트
   * ========================================================== */
  P.bindWordPackModalEvents = function () {
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
  };

  /**
   * 📋 현재 실제로 게임에 사용 중인 단어 목록(프리셋 또는 커스텀)을 모달에 칩 형태로 미리보기
   */
  P.renderWordPackPreview = function () {
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
  };

  /* ==========================================================
   * 🏆 명예의 전당 (최고 도달 스테이지 기준 단일 TOP 5, localStorage + 글로벌)
   * ========================================================== */

  /**
   * 🏆 명예의 전당 데이터 로드: 글로벌(Firestore)이 설정돼 있으면 스테이지 기준으로 조회해 캐시하고,
   * 미설정이거나 네트워크 실패 시 로컬(localStorage) 스테이지 기준 TOP5로 자동 폴백한다.
   */
  P.renderLeaderboard = async function (showAll = false) {
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
  };

  /**
   * 캐시된 단일 TOP 리스트를 그린다 (네트워크 재조회 없음).
   * 랭킹 기준이 '최고 도달 스테이지'이므로 스테이지를 주지표로 강조한다.
   */
  P.renderLeaderboardList = function () {
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
        <span class="lb-meta">${(entry.score || 0).toLocaleString()}점 · 방어속도 ${entry.wpm || 0}</span>
        <span class="lb-date">${entry.date || ''}</span>
      </div>
    `).join('');
  };

  P.escapeHtml = function (str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  };

  /**
   * 📋 클립보드 복사 (Clipboard API 우선, 실패/미지원 시 execCommand 폴백).
   * @param {string} text - 복사할 문자열
   * @param {Function} [onCopied] - 복사 완료 시 콜백
   */
  P.copyToClipboard = function (text, onCopied) {
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
  };
})();

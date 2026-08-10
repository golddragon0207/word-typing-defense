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
        wordPacks.liveChatMaxLen = Number(maxLenSelect.value) || 6;
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
   * 🏆 명예의 전당 데이터 로드(모달 진입 시 1회): 글로벌(Firestore) 설정 시 상위 200을 스테이지 기준으로 조회해
   *    캐시하고, 미설정/실패 시 로컬(localStorage) 상위 200으로 폴백한다.
   *    이후 TOP5·전체·검색은 이 캐시에서 클라이언트 측으로 처리해 추가 조회를 하지 않는다.
   *    ('내 순위'만 점수 기준 별도 조회 — fetchPercentile.)
   */
  P.loadLeaderboard = async function () {
    const sourceEl = document.getElementById('leaderboard-source');
    if (!this.stateManager) return;

    let scores = null;
    let source = 'local';
    if (window.GlobalLeaderboard && window.GlobalLeaderboard.enabled) {
      if (sourceEl) sourceEl.textContent = '🌐 글로벌 기록 불러오는 중...';
      scores = await window.GlobalLeaderboard.fetchTop(200);
      if (scores) source = 'global';
    }
    if (!scores) {
      source = 'local';
      scores = this.stateManager.getTopScores(200);
    }
    this.leaderboardCache = { source, scores };
    this.renderLeaderboard(this.leaderboardView || 'top5');
  };

  /**
   * 🏆 뷰 전환(추가 네트워크 조회 없음). view: 'top5' | 'all' | 'me'
   *   - top5/all: 캐시 목록에서 슬라이스·필터해 렌더
   *   - me: 내 기록 + 글로벌 점수 기준 정확 등수(별도 조회)를 렌더
   */
  P.renderLeaderboard = function (view = 'top5') {
    const listEl = document.getElementById('leaderboard-list');
    if (!listEl || !this.leaderboardCache) return;
    this.leaderboardView = view;

    // 버튼 라벨: 현재 뷰의 버튼은 'TOP 5로' 되돌리기로 표기
    const allBtn = document.getElementById('btn-leaderboard-all');
    if (allBtn) allBtn.textContent = view === 'all' ? '🏅 TOP 5만 보기' : '📜 전체 순위 보기';
    const meBtn = document.getElementById('btn-leaderboard-me');
    if (meBtn) meBtn.textContent = view === 'me' ? '🏅 TOP 5만 보기' : '🙋 내 순위 보기';

    // 검색창은 목록형(top5/all)에서만 노출
    const searchEl = document.getElementById('leaderboard-search');
    if (searchEl) searchEl.classList.toggle('hidden', view === 'me');

    if (view === 'me') { this.renderMyRankView(); return; }
    this.renderLeaderboardList();
  };

  /**
   * 🔎 검색 입력 처리 — 닉네임 부분일치. 검색어가 있으면 전체(200) 대상에서 찾도록 자동 확장한다.
   * @param {string} q
   */
  P.onLeaderboardSearch = function (q) {
    this.leaderboardQuery = (q || '').trim().toLowerCase();
    if (this.leaderboardView === 'me') return; // 내 순위 뷰에선 검색 무시
    // 검색어가 있으면 상위 5개에 갇히지 않도록 전체 뷰로 전환(캐시라 재조회 없음)
    if (this.leaderboardQuery && this.leaderboardView !== 'all') {
      this.renderLeaderboard('all');
      return;
    }
    this.renderLeaderboardList();
  };

  /**
   * 캐시된 목록을 현재 뷰(top5/all)와 검색어에 맞춰 그린다 (네트워크 재조회 없음).
   * 순위 번호는 필터와 무관하게 '전체 정렬상의 실제 등수'를 유지한다.
   * 랭킹 기준이 '최고 도달 스테이지'이므로 스테이지를 주지표로 강조한다.
   */
  P.renderLeaderboardList = function () {
    const listEl = document.getElementById('leaderboard-list');
    const sourceEl = document.getElementById('leaderboard-source');
    if (!listEl || !this.leaderboardCache) return;

    const source = this.leaderboardCache.source;
    const scores = this.leaderboardCache.scores || [];
    const q = this.leaderboardQuery || '';
    const view = this.leaderboardView || 'top5';
    const myName = this.getMyNickname();

    // 실제 등수(전체 정렬 인덱스)를 유지한 채 필터/슬라이스
    let indexed = scores.map((entry, idx) => ({ entry, rank: idx + 1 }));
    if (q) indexed = indexed.filter(x => (x.entry.nickname || '').toLowerCase().includes(q));
    else if (view === 'top5') indexed = indexed.slice(0, 5);

    // 안내 문구
    if (sourceEl) {
      const scope = q ? `검색 결과 (${indexed.length}명)` : (view === 'all' ? `전체 순위 (${scores.length}명)` : 'TOP 5');
      sourceEl.textContent = source === 'global'
        ? `🌐 모든 스트리머가 함께 보는 글로벌 ${scope} (최고 도달 스테이지 기준)입니다.`
        : `💾 이 브라우저에만 저장된 로컬 ${scope} (최고 도달 스테이지 기준)입니다. (글로벌 미설정 또는 연결 실패)`;
    }

    if (scores.length === 0) {
      listEl.innerHTML = '<p class="leaderboard-empty">아직 저장된 전적이 없습니다. 첫 기록에 도전해보세요!</p>';
      return;
    }
    if (indexed.length === 0) {
      listEl.innerHTML = `<p class="leaderboard-empty">'${this.escapeHtml(q)}' 검색 결과가 없습니다.</p>`;
      return;
    }

    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
    listEl.innerHTML = indexed.map(({ entry, rank }) => {
      const isMe = !!myName && entry.nickname === myName;
      return `
      <div class="leaderboard-row${isMe ? ' is-me' : ''}">
        <span class="lb-rank">${medals[rank - 1] || rank}</span>
        <span class="lb-nickname">${this.escapeHtml(entry.nickname)}${isMe ? '<span class="lb-me-tag">나</span>' : ''}</span>
        <span class="lb-stage">STAGE ${entry.stage || 1}</span>
        <span class="lb-grade rank-${(entry.grade || 'D').toLowerCase()}">${entry.grade || 'D'}</span>
        <span class="lb-meta">${(entry.score || 0).toLocaleString()}점 · 방어속도 ${entry.wpm || 0}</span>
        <span class="lb-date">${entry.date || ''}</span>
      </div>`;
    }).join('');
  };

  /**
   * 🙋 '내 순위' 뷰 — 전체 랭킹과 분리해 내 등수만 따로 보여준다.
   *   로컬 최고 기록(내 닉네임 우선)을 기준으로, 글로벌 연동 시 점수 기준 정확 등수(#N/총 M명·상위 X%)를 붙인다.
   *   같은 점수는 세션 캐시(_myRankCache)로 재조회를 막고, 늦게 온 응답은 토큰으로 무시한다.
   */
  P.renderMyRankView = async function () {
    const listEl = document.getElementById('leaderboard-list');
    const sourceEl = document.getElementById('leaderboard-source');
    if (!listEl) return;

    const myBest = this.getMyBestRecord();
    if (!myBest) {
      if (sourceEl) sourceEl.textContent = '🙋 내 순위';
      listEl.innerHTML = '<p class="leaderboard-empty">아직 내 기록이 없습니다. 한 판 플레이해보세요!</p>';
      return;
    }

    const renderCard = (rankLabel, note) => {
      listEl.innerHTML = `
      <div class="leaderboard-row is-me">
        <span class="lb-rank">${rankLabel}</span>
        <span class="lb-nickname">${this.escapeHtml(myBest.nickname)}<span class="lb-me-tag">나</span></span>
        <span class="lb-stage">STAGE ${myBest.stage || 1}</span>
        <span class="lb-grade rank-${(myBest.grade || 'D').toLowerCase()}">${myBest.grade || 'D'}</span>
        <span class="lb-meta">${(myBest.score || 0).toLocaleString()}점 · 방어속도 ${myBest.wpm || 0}</span>
        <span class="lb-date">${myBest.date || ''}</span>
      </div>
      ${note ? `<p class="leaderboard-note">${note}</p>` : ''}`;
    };

    const globalOn = !!(window.GlobalLeaderboard && window.GlobalLeaderboard.enabled);
    if (!globalOn) {
      if (sourceEl) sourceEl.textContent = '🙋 내 기록 (이 브라우저 개인 최고)';
      renderCard('★', '글로벌 순위는 Firebase 연동 시 표시됩니다.');
      return;
    }

    if (sourceEl) sourceEl.textContent = '🙋 내 글로벌 순위 조회 중…';
    renderCard('…', '글로벌 순위 집계 중…');

    const token = (this._myRankToken = (this._myRankToken || 0) + 1);
    let res = (this._myRankCache && this._myRankCache.score === myBest.score) ? this._myRankCache.res : null;
    if (!res) {
      res = await window.GlobalLeaderboard.fetchPercentile(myBest.score);
      if (token !== this._myRankToken) return;        // 그새 다른 조회로 교체됨
      if (res && res.available && res.enough) this._myRankCache = { score: myBest.score, res };
    }
    if (this.leaderboardView !== 'me') return;         // 그새 뷰가 바뀜

    if (!res || !res.available) {
      if (sourceEl) sourceEl.textContent = '🙋 내 기록';
      renderCard('★', '(글로벌 순위 조회 불가 — 로컬 최고 기록만 표시)');
      return;
    }
    if (!res.enough) {
      if (sourceEl) sourceEl.textContent = '🙋 내 기록';
      renderCard('★', `글로벌 순위 집계 중… (표본 ${(res.total || 0).toLocaleString()}명, 조금 더 쌓이면 표시)`);
      return;
    }
    const p = res.topPercent;
    const pStr = p < 1 ? p.toFixed(1) : Math.round(p);
    if (sourceEl) sourceEl.textContent = `🙋 내 글로벌 순위 — #${res.rank}위 / ${res.total.toLocaleString()}명 · 상위 ${pStr}%`;
    renderCard(`#${res.rank}`, `상위 ${pStr}% · 총 ${res.total.toLocaleString()}명 중 (점수 기준 순위 — 전체 목록은 스테이지 기준이라 순서가 다를 수 있어요)`);
  };

  /**
   * 🙋 현재 플레이어(스트리머 본인)의 닉네임을 구한다.
   *    홈 화면 입력값을 우선하고, 없으면 이번 판 설정값(config.playerNames[0])을 쓴다.
   *    아직 아무것도 설정하지 않은 기본값('스트리머')은 오탐 방지를 위해 미설정으로 간주한다.
   * @returns {string} 식별 가능한 닉네임, 없으면 ''
   */
  P.getMyNickname = function () {
    const input = document.getElementById('input-player-nickname');
    const typed = input ? input.value.trim() : '';
    if (typed) return typed;
    const pn = this.config && this.config.playerNames && this.config.playerNames[0];
    return (pn && pn !== '스트리머') ? pn : '';
  };

  /**
   * 🙋 로컬에 저장된 '내 최고 기록' — 내 닉네임과 일치하는 기록 중 최상위(스테이지→점수),
   *    닉네임을 알 수 없으면 로컬 전체 최고로 폴백한다. 기록이 없으면 null.
   * @returns {Object|null}
   */
  P.getMyBestRecord = function () {
    if (!this.stateManager) return null;
    const all = this.stateManager.getAllScores();
    if (!all.length) return null;
    const myName = this.getMyNickname();
    const pool = myName ? all.filter(e => e.nickname === myName) : [];
    const list = (pool.length ? pool : all).slice()
      .sort((a, b) => (b.stage || 1) - (a.stage || 1) || (b.score || 0) - (a.score || 0));
    return list[0] || null;
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

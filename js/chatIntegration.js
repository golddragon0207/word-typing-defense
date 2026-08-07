/* ==========================================================================
   WORD-TYPING-DEFENSE - PURE LIVE CHAT INTEGRATION (chatIntegration.js)
   ========================================================================== */

class ChatIntegrationEngine {
  constructor() {
    this.channels = []; // Array of { id, platform, targetId, rawUrl, name, ws, pollTimer }
    this.connected = false;
  }

  /**
   * 1. 방송 URL 자동 파싱 엔진 (URL Parser)
   * 스트리머가 방송 주소 전체를 붙여넣어도 고유 Target ID만 정확하게 추출
   */
  parseStreamUrl(platform, input) {
    if (!input || typeof input !== 'string') return '';
    const trimmed = input.trim();

    try {
      // 🟢 치지직 (Chzzk): https://chzzk.naver.com/live/{32자리 Hash ID}
      if (platform === 'chzzk') {
        const chzzkRegex = /(?:live\/|channel\/)([a-f0-9]{32})/i;
        const match = trimmed.match(chzzkRegex);
        if (match && match[1]) return match[1];
      }

      // 🔵 SOOP (아프리카TV): 방송국 주소 및 BJ ID 파싱
      if (platform === 'soop') {
        if (trimmed.includes('sooplive.co.kr') || trimmed.includes('afreecatv.com')) {
          const urlObj = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
          const pathSegments = urlObj.pathname.split('/').filter(p => p.length > 0);
          if (pathSegments.length > 0) return pathSegments[0];
        }
      }

      // 🔴 유튜브 (YouTube): 라이브 영상 URL 또는 Video ID 파싱
      if (platform === 'youtube') {
        if (trimmed.includes('youtube.com') || trimmed.includes('youtu.be')) {
          if (trimmed.includes('youtu.be/')) {
            return trimmed.split('youtu.be/')[1].split('?')[0];
          }
          if (trimmed.includes('/live/')) {
            return trimmed.split('/live/')[1].split('?')[0];
          }
          const urlObj = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
          const videoId = urlObj.searchParams.get('v');
          if (videoId) return videoId;
        }
      }
    } catch (e) {
      console.warn(`[ChatIntegration] URL 파싱 중 오류 발생 (기본값 사용): ${e.message}`);
    }

    return trimmed;
  }

  /**
   * 2. 채널 추가 및 실제 라이브 연동 시작
   */
  addChannel(platform, targetInput) {
    if (!targetInput || targetInput.trim().length === 0) return false;

    const targetId = this.parseStreamUrl(platform, targetInput);

    let icon = '💬';
    let prefix = '[💬테스트]';
    if (platform === 'chzzk') { icon = '🟢'; prefix = '[🟢치지직]'; }
    if (platform === 'soop') { icon = '🔵'; prefix = '[🔵SOOP]'; }
    if (platform === 'youtube') { icon = '🔴'; prefix = '[🔴유튜브]'; }

    const channelObj = {
      id: Date.now() + Math.random(),
      platform: platform,
      targetId: targetId,
      rawUrl: targetInput.trim(),
      name: `${icon} [${platform.toUpperCase()}] ${targetId}`,
      ws: null,
      pollTimer: null
    };

    this.channels.push(channelObj);
    this.connected = true;

    this.startPlatformListener(channelObj, prefix);
    return channelObj;
  }

  /**
   * 3. 플랫폼별 실시간 수신 리스너 분기
   */
  startPlatformListener(channel, prefix) {
    console.log(`📡 ${prefix} 라이브 연동 시도 Target ID: ${channel.targetId}`);

    switch (channel.platform) {
      case 'chzzk':
        this.connectChzzk(channel, prefix);
        break;
      case 'soop':
        this.connectSoop(channel, prefix);
        break;
      case 'youtube':
        this.connectYouTube(channel, prefix);
        break;
      default:
        console.warn(`[ChatIntegration] 지원하지 않는 플랫폼이거나 커스텀 모드입니다.`);
        break;
    }
  }

  /**
   * 🟢 치지직 (Chzzk) 실시간 라이브 웹소켓 연동
   */
  async connectChzzk(channel, prefix) {
    try {
      const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
      const res = await fetch(`${proxyUrl}https://api.chzzk.naver.com/polling/v2/channels/${channel.targetId}/live-detail`);

      if (!res.ok) throw new Error(`HTTP status ${res.status}`);
      const data = await res.json();
      const chatChannelId = data?.content?.chatChannelId;

      if (!chatChannelId) {
        throw new Error("치지직 방송이 비활성화 상태이거나 채팅 채널 ID를 찾을 수 없습니다.");
      }

      const wsUrl = `wss://kr-ss1.chat.naver.com/chat`;
      const ws = new WebSocket(wsUrl);
      channel.ws = ws;

      ws.onopen = () => {
        console.log(`✅ ${prefix} 치지직 웹소켓 연결 성공!`);
        const handshakeCmd = {
          ver: "2",
          cmd: 100,
          svcid: "game",
          cid: chatChannelId,
          bdy: { uid: null, devType: 2001, accTkn: "", auth: "READ" },
          tid: 1
        };
        ws.send(JSON.stringify(handshakeCmd));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.cmd === 93101 && Array.isArray(msg.bdy)) {
            msg.bdy.forEach(chat => {
              const profile = JSON.parse(chat.profile || '{}');
              const nickname = profile.nickname || '치지직시청자';
              const chatText = chat.msg || '';
              this.handleIncomingChat(nickname, chatText, prefix);
            });
          }
        } catch (err) {
          console.warn(`[Chzzk] 패킷 파싱 에러:`, err);
        }
      };

      ws.onerror = (err) => {
        console.error(`❌ ${prefix} 치지직 웹소켓 통신 오류 발생`, err);
        this.notifyFallback(prefix, '웹소켓 통신 오류');
      };

      this.notifySuccess(prefix, '연동 시도 시작');
    } catch (e) {
      console.error(`❌ ${prefix} 치지직 연동 실패: ${e.message}`);
      this.notifyFallback(prefix, e.message);
    }
  }

  /**
   * 🔵 SOOP (아프리카TV) 라이브 채팅 연동
   */
  connectSoop(channel, prefix) {
    try {
      const wsUrl = `wss://livews.sooplive.co.kr/connect`;
      const ws = new WebSocket(wsUrl);
      channel.ws = ws;

      ws.onopen = () => {
        console.log(`✅ ${prefix} SOOP 웹소켓 연결 성공!`);
      };

      ws.onmessage = (event) => {
        if (typeof event.data === 'string' && event.data.includes('CHAT')) {
          this.handleIncomingChat("SOOP시청자", event.data, prefix);
        }
      };

      ws.onerror = (err) => {
        console.error(`❌ ${prefix} SOOP 웹소켓 오류`, err);
        this.notifyFallback(prefix, 'SOOP 웹소켓 오류');
      };

      this.notifySuccess(prefix, '연동 시도 시작');
    } catch (e) {
      console.error(`❌ ${prefix} SOOP 연동 실패`, e);
      this.notifyFallback(prefix, e.message);
    }
  }

  /**
   * 🔴 유튜브 (YouTube) 라이브 채팅 연동 (YouTube Data API v3 폴링)
   * 1) Video ID → liveChatId 조회 (videos.list)
   * 2) liveChatId → liveChatMessages.list 주기적 폴링
   */
  async connectYouTube(channel, prefix) {
    const apiKey = (typeof CONFIG !== 'undefined' && CONFIG.YOUTUBE_API_KEY) ? CONFIG.YOUTUBE_API_KEY : null;

    if (!apiKey) {
      console.warn(`⚠️ ${prefix} YouTube API Key(CONFIG.YOUTUBE_API_KEY)가 설정되지 않아 실시간 연동을 시작할 수 없습니다.`);
      this.notifyFallback(prefix, 'YouTube API Key 미설정');
      return;
    }

    try {
      const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${channel.targetId}&key=${apiKey}`;
      const res = await fetch(videosUrl);
      if (!res.ok) throw new Error(`HTTP status ${res.status}`);

      const data = await res.json();
      const liveChatId = data?.items?.[0]?.liveStreamingDetails?.activeLiveChatId;

      if (!liveChatId) {
        throw new Error('현재 라이브 방송 중이 아니거나 채팅 ID를 찾을 수 없습니다.');
      }

      this.notifySuccess(prefix, '연동 시도 시작');

      let nextPageToken = '';
      const poll = async () => {
        try {
          const chatUrl = `https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${liveChatId}&part=snippet,authorDetails&key=${apiKey}` +
            (nextPageToken ? `&pageToken=${nextPageToken}` : '');
          const chatRes = await fetch(chatUrl);
          if (!chatRes.ok) throw new Error(`HTTP status ${chatRes.status}`);

          const chatData = await chatRes.json();
          nextPageToken = chatData.nextPageToken || '';

          (chatData.items || []).forEach(item => {
            const nickname = item?.authorDetails?.displayName || '유튜브시청자';
            const text = item?.snippet?.displayMessage || '';
            this.handleIncomingChat(nickname, text, prefix);
          });
        } catch (pollErr) {
          console.error(`❌ ${prefix} YouTube 채팅 폴링 오류`, pollErr);
        }
      };

      poll();
      channel.pollTimer = setInterval(poll, 5000);

    } catch (e) {
      console.error(`❌ ${prefix} YouTube 연동 실패: ${e.message}`);
      this.notifyFallback(prefix, e.message);
    }
  }

  /**
   * ✅ 연동 시도/성공 알림 (game.js가 등록한 window.showToast 사용, 없으면 콘솔만)
   */
  notifySuccess(prefix, message) {
    if (typeof window.showToast === 'function') {
      window.showToast(`${prefix} ${message}`, 'success');
    }
  }

  /**
   * 🤖 Smart Fallback 알림: 연동 실패 시 [BOT] 가상 시청자 자동 소환 모드로 전환됨을 안내
   * (실제 폴백 동작 자체는 wordPacks.getNextMonsterData가 대기열이 빌 때 자동으로 BOT을 배정하므로
   *  여기서는 스트리머에게 상황을 알리는 역할만 수행한다)
   */
  notifyFallback(prefix, reason) {
    console.warn(`🤖 ${prefix} 연동 실패(${reason}) → [BOT] 가상 시청자 자동 소환 모드로 전환합니다.`);
    if (typeof window.showToast === 'function') {
      window.showToast(`⚠️ ${prefix} 연동 실패: ${reason} → BOT 시뮬레이션으로 전환`, 'warn');
    }
  }

  /**
   * 4. 수신된 실시간 채팅 데이터를 wordPacks 데이터 매니저로 전달
   */
  handleIncomingChat(nickname, messageText, prefix) {
    const chkKeywordOnly = document.getElementById('chk-keyword-only');
    const keywordMode = chkKeywordOnly ? chkKeywordOnly.checked : false;

    const fullNickname = prefix ? `${prefix} ${nickname}` : nickname;

    // 계획서 v2.0 표준 객체인 wordPacks에 채팅 메시지 전달
    if (typeof wordPacks !== 'undefined' && typeof wordPacks.processChatMessage === 'function') {
      wordPacks.processChatMessage(fullNickname, messageText, keywordMode);
    } else {
      console.warn('[ChatIntegration] wordPacks 객체를 찾을 수 없습니다.');
    }
  }

  /**
   * 5. 외부 연결 인터페이스 통제
   */
  connect(platform, config = {}) {
    if (platform === 'custom') {
      this.disconnect();
      console.log(`[ChatIntegration] 커스텀/시뮬레이션 모드는 시뮬레이션 매니저를 이용하세요.`);
    } else if (config.channelId || config.bjId || config.ytUrl || config.targetInput) {
      const target = config.targetInput || config.channelId || config.bjId || config.ytUrl;
      this.addChannel(platform, target);
    }
  }

  /**
   * 현재 연동 중인 채널 목록 반환 (UI 렌더링용)
   */
  getActiveChannels() {
    return this.channels.map(c => ({ id: c.id, name: c.name, platform: c.platform }));
  }

  /**
   * 6. 채널 제거 및 해제
   */
  removeChannel(id) {
    const idx = this.channels.findIndex(c => c.id === id);
    if (idx !== -1) {
      const target = this.channels[idx];
      if (target.ws) target.ws.close();
      if (target.pollTimer) clearInterval(target.pollTimer);
      this.channels.splice(idx, 1);
    }
    if (this.channels.length === 0) {
      this.disconnect();
    }
  }

  /**
   * 전체 연결 해제
   */
  disconnect() {
    this.connected = false;
    this.channels.forEach(ch => {
      if (ch.ws) ch.ws.close();
      if (ch.pollTimer) clearInterval(ch.pollTimer);
    });
    this.channels = [];
  }
}

// 전역 인스턴스 생성 및 window 바인딩 (다른 스크립트에서 window.chatEngine으로 접근)
const chatEngine = new ChatIntegrationEngine();
const chatIntegration = chatEngine;
window.chatEngine = chatEngine;
window.chatIntegration = chatIntegration;
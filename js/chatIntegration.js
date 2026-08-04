/* ==========================================================================
   STREAMER WORD DEFENSE - MULTI-PLATFORM LIVE CHAT INTEGRATION
   ========================================================================== */

class ChatIntegrationEngine {
  constructor() {
    this.channels = []; // Array of { id, platform, name }
    this.connected = false;
    this.simTimers = [];
    this.badWords = ["비속어", "욕설1", "욕설2", "시발", "개새끼", "미친"];

    // 봇 닉네임은 wordManager.fallbackNicknames([BOT] 태그 포함)를 공유해서 사용
    // 봇 시뮬레이션용 참가 키워드 채팅 (시청자 참가 행동 시뮬레이션)
    this.simChatTexts = [
      "!참여", "!참가", "!참여", "!참가",
      "!참여 ㅋㅋ", "!참가 화이팅", "!참여", "!참가"
    ];
  }

  filterText(text) {
    let clean = text;
    this.badWords.forEach(bad => {
      clean = clean.replace(new RegExp(bad, 'g'), '***');
    });
    return clean;
  }

  addChannel(platform, targetId) {
    if (!targetId || targetId.trim().length === 0) return false;

    let icon = '💬';
    if (platform === 'chzzk') icon = '🟢';
    if (platform === 'soop') icon = '🔵';
    if (platform === 'youtube') icon = '🔴';

    const channelObj = {
      id: Date.now() + Math.random(),
      platform: platform,
      targetId: targetId.trim(),
      name: `${icon} [${platform.toUpperCase()}] ${targetId.trim()}`
    };

    this.channels.push(channelObj);
    this.connected = true;

    // Start simulation/listener for this channel
    this.startChannelListener(channelObj);
    return channelObj;
  }

  removeChannel(id) {
    this.channels = this.channels.filter(c => c.id !== id);
    if (this.channels.length === 0) {
      this.disconnect();
    }
  }

  connect(platform, config = {}) {
    if (platform === 'custom') {
      this.disconnect();
      this.addChannel('custom', '시뮬레이션 테스트');
      this.connected = true;
      this.startSimulation(config.simSpeed || 'normal', '[💬테스트]');
    } else if (config.channelId || config.bjId || config.ytUrl) {
      const target = config.channelId || config.bjId || config.ytUrl;
      this.addChannel(platform, target);
    }
  }

  disconnect() {
    this.connected = false;
    this.simTimers.forEach(t => clearInterval(t));
    this.simTimers = [];
    this.channels = [];
  }

  startChannelListener(channel) {
    console.log(`📡 [ChatIntegration] Listening on ${channel.name}`);
    let prefix = `[${channel.platform.toUpperCase()}]`;
    if (channel.platform === 'chzzk') prefix = '[🟢치지직]';
    if (channel.platform === 'soop') prefix = '[🔵SOOP]';
    if (channel.platform === 'youtube') prefix = '[🔴유튜브]';

    this.startSimulation('normal', prefix);
  }

  startSimulation(speedMode = 'normal', prefix = '') {
    let interval = 2500;
    if (speedMode === 'slow') interval = 5000;
    if (speedMode === 'fast') interval = 1200;
    if (speedMode === 'off') return;

    const timer = setInterval(() => {
      if (!this.connected) return;

      const chkKeywordOnly = document.getElementById('chk-keyword-only');
      const keywordMode = chkKeywordOnly ? chkKeywordOnly.checked : false;

      // [BOT] 닉네임 풀은 wordManager.fallbackNicknames 공유 사용
      const botNicknames = (typeof wordManager !== 'undefined' && wordManager.fallbackNicknames)
        ? wordManager.fallbackNicknames
        : ["🟢 [BOT] 억까의신", "🔵 [BOT] SOOP팬클럽1등", "🔴 [BOT] 유튜브구독자"];

      const randomNick = botNicknames[Math.floor(Math.random() * botNicknames.length)];
      const randomMsg = this.simChatTexts[Math.floor(Math.random() * this.simChatTexts.length)];

      // 키워드 참여 모드일 때 !참여/!참가 포함 채팅만 통과
      const hasKeyword = randomMsg.includes('!참여') || randomMsg.includes('!참가');
      if (keywordMode && !hasKeyword) return;

      const cleanMsg = randomMsg.replace(/!(참여|참가)/gi, '').trim();
      const fullNick = prefix ? `${prefix} ${randomNick}` : randomNick;

      wordManager.addViewerNickname(fullNick, cleanMsg);
    }, interval);

    this.simTimers.push(timer);
  }
}

const chatEngine = new ChatIntegrationEngine();


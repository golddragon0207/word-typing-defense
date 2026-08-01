/* ==========================================================================
   STREAMER WORD DEFENSE - MULTI-PLATFORM LIVE CHAT INTEGRATION
   ========================================================================== */

class ChatIntegrationEngine {
  constructor() {
    this.channels = []; // Array of { id, platform, name }
    this.connected = false;
    this.simTimers = [];
    this.badWords = ["비속어", "욕설1", "욕설2", "시발", "개새끼", "미친"];

    // 시뮬레이션용 가상 닉네임 샘플
    this.simNicknames = [
      "치지직시청자A", "SOOP팬클럽1등", "유튜브구독자", "트위치난민",
      "타자왕김스트리머", "억까의신", "네온마스터", "치킨은후라이드",
      "오늘방송레전드", "슈퍼챗1만원", "별풍선100개", "알림설정완료",
      "합방천재김스트리머", "억까방지위원회", "레전드타자스피드"
    ];

    this.simChatTexts = [
      "!참여 오늘 방송 개꿀잼ㅋㅋㅋ", "!참가 타자 속도 실화냐", "제 닉네임 잡지마세요",
      "!억까 몬스터 간다!", "피버 모드 켜라", "!도전 구독과 좋아요 누름", "화이팅!"
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

      const randomNick = this.simNicknames[Math.floor(Math.random() * this.simNicknames.length)];
      const randomMsg = this.simChatTexts[Math.floor(Math.random() * this.simChatTexts.length)];

      // 키워드 참여 모드 활성화 시 '!참여', '!참가', '!억까', '!도전' 포함 채팅만 선별 소환
      const hasKeyword = (
        randomMsg.includes('!참여') ||
        randomMsg.includes('!참가') ||
        randomMsg.includes('!억까') ||
        randomMsg.includes('!도전')
      );

      if (keywordMode && !hasKeyword) {
        return; // Skip non-participating chatters
      }

      const cleanNick = this.filterText(randomNick);
      const cleanMsg = this.filterText(randomMsg.replace(/!(참여|참가|억까|도전)/gi, '').trim());

      const fullNick = prefix ? `${prefix} ${cleanNick}` : cleanNick;

      wordManager.addViewerNickname(fullNick, cleanMsg);
    }, interval);

    this.simTimers.push(timer);
  }
}

const chatEngine = new ChatIntegrationEngine();


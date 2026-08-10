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
      // 🟢 치지직 (Chzzk): 채널 ID = 32자리 Hash. URL 위치가 형식마다 달라
      //   URL 어디에 있든 첫 32자리 hex를 채널 ID로 추출한다.
      //   지원: chzzk.naver.com/live/{ID}, chzzk.naver.com/{ID},
      //         studio.chzzk.naver.com/{ID}/live(스튜디오/관리 페이지), 또는 32자리 hex 원문
      if (platform === 'chzzk') {
        const match = trimmed.match(/[0-9a-f]{32}/i);
        if (match) return match[0];
      }

      // 🔵 SOOP (숲/아프리카TV): 방송국 주소 및 BJ ID 파싱
      // 지원 도메인: sooplive.com, sooplive.co.kr, play.sooplive.*, afreecatv.com 등
      // URL 형태: https://play.sooplive.com/{BJID}/{방송번호}  → 첫 경로 세그먼트가 BJ ID
      if (platform === 'soop') {
        if (trimmed.includes('sooplive') || trimmed.includes('afreeca')) {
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
   * 🟢 치지직 (Chzzk) 실시간 라이브 채팅 연동 — 실제 프로토콜 구현
   *
   * 흐름 (kimcore/chzzk 등 공개 구현체 기준):
   *   1) live-status(GET, 프록시 경유)로 방송 상태(OPEN)·채팅방ID(chatChannelId) 조회
   *      → api.chzzk.naver.com 은 CORS 차단 대상이라 CONFIG.CHZZK_PROXY(=SOOP 프록시 재사용)가 필요
   *   2) access-token(GET, 프록시 경유)로 익명 읽기용 accessToken 발급
   *      (comm-api.game.naver.com, code 42601 이면 성인 인증 필요 방송이라 익명 불가)
   *   3) chatChannelId 해시로 채팅 서버(kr-ss1~9) 결정 → wss://kr-ss{N}.chat.naver.com/chat 접속
   *      (웹소켓은 CORS 대상이 아니라 브라우저에서 직접 연결)
   *   4) CONNECT(cmd 100, accTkn 포함) → CONNECTED(cmd 10100) 후 채팅 수신 시작
   *   5) CHAT(cmd 93101) 패킷의 profile.nickname / msg 를 추출 → handleIncomingChat
   *      keepalive: 서버 PING(cmd 0)엔 PONG(cmd 10000) 응답 + 20초 주기로 PING(cmd 0) 송신
   */
  async connectChzzk(channel, prefix) {
    const channelId = (channel.targetId || '').trim();
    // 치지직 REST API도 CORS 차단이라 프록시가 필요. CHZZK_PROXY가 비면 SOOP_PROXY를 재사용.
    const proxy = (typeof CONFIG !== 'undefined' && (CONFIG.CHZZK_PROXY || CONFIG.SOOP_PROXY)) || '';
    const debug = !!(typeof CONFIG !== 'undefined' && CONFIG.SOOP_DEBUG);

    if (!channelId) {
      this.notifyFallback(prefix, '채널 ID를 확인할 수 없습니다.');
      return;
    }
    if (!proxy) {
      console.warn(`⚠️ ${prefix} CONFIG.CHZZK_PROXY/SOOP_PROXY가 비어 있어 치지직 연동을 시작할 수 없습니다. (CORS 프록시 필요)`);
      this.notifyFallback(prefix, '프록시 미설정 (CORS 프록시 필요)');
      return;
    }

    const viaProxy = (targetUrl) => proxy + encodeURIComponent(targetUrl);

    try {
      // 1) 라이브 상태 조회 → chatChannelId
      const statusUrl = `https://api.chzzk.naver.com/polling/v2/channels/${encodeURIComponent(channelId)}/live-status`;
      const sres = await fetch(viaProxy(statusUrl));
      if (!sres.ok) throw new Error(`라이브 상태 조회 실패 (HTTP ${sres.status})`);
      const sdata = await sres.json();
      if (debug) console.log(`[Chzzk] live-status 응답:`, JSON.stringify(sdata));
      const content = sdata && sdata.content ? sdata.content : null;
      if (!content) throw new Error('라이브 정보를 찾을 수 없습니다 (채널 ID를 확인하세요).');
      if (content.status && content.status !== 'OPEN') {
        throw new Error(`방송 중이 아닙니다 (status=${content.status}).`);
      }
      const chatChannelId = content.chatChannelId;
      if (!chatChannelId) throw new Error('chatChannelId를 찾을 수 없습니다.');

      // 2) 접근 토큰 발급 (익명 읽기)
      const tokenUrl = `https://comm-api.game.naver.com/nng_main/v1/chats/access-token?channelId=${encodeURIComponent(chatChannelId)}&chatType=STREAMING`;
      const tres = await fetch(viaProxy(tokenUrl));
      if (!tres.ok) throw new Error(`접근 토큰 발급 실패 (HTTP ${tres.status})`);
      const tdata = await tres.json();
      if (tdata && tdata.code === 42601) throw new Error('성인 인증이 필요한 방송이라 익명 연동이 불가합니다.');
      const accTkn = tdata && tdata.content ? tdata.content.accessToken : null;
      if (!accTkn) throw new Error('접근 토큰(accessToken)을 받지 못했습니다.');

      // 3) 채팅 서버 선택 (chatChannelId 문자 코드 합 해시로 kr-ss1~9 결정)
      const serverId = Math.abs(
        chatChannelId.split('').map(c => c.charCodeAt(0)).reduce((a, b) => a + b, 0)
      ) % 9 + 1;
      const wsUrl = `wss://kr-ss${serverId}.chat.naver.com/chat`;
      if (debug) console.log(`[Chzzk] WS 접속: ${wsUrl} (chatChannelId=${chatChannelId})`);

      const ws = new WebSocket(wsUrl);
      channel.ws = ws;

      const defaults = { cid: chatChannelId, svcid: 'game', ver: '2' };

      ws.onopen = () => {
        console.log(`✅ ${prefix} 치지직 웹소켓 연결 성공! CONNECT 전송`);
        ws.send(JSON.stringify({
          ...defaults,
          cmd: 100, tid: 1,
          bdy: { accTkn, auth: 'READ', devType: 2001, uid: null }
        }));
      };

      ws.onmessage = (event) => {
        let json;
        try { json = JSON.parse(event.data); } catch (_) { return; }
        const body = json.bdy;
        if (debug && json.cmd !== 0 && json.cmd !== 10000) console.log(`[Chzzk] cmd=${json.cmd}`);

        switch (json.cmd) {
          case 10100: // CONNECTED
            this.notifySuccess(prefix, '채팅 연결 성공');
            if (channel.pollTimer) clearInterval(channel.pollTimer);
            channel.pollTimer = setInterval(() => {
              try { ws.send(JSON.stringify({ cmd: 0, ver: '2' })); } catch (_) {}
            }, 20000);
            break;
          case 0: // 서버 PING → PONG 응답
            try { ws.send(JSON.stringify({ cmd: 10000, ver: '2' })); } catch (_) {}
            break;
          case 93101: { // CHAT
            const chats = Array.isArray(body) ? body : ((body && body.messageList) || []);
            chats.forEach(chat => {
              const type = chat.msgTypeCode || chat.messageTypeCode;
              if (type !== 1) return; // 일반 텍스트 채팅만 (도네/구독/시스템 제외)
              let nickname = '치지직시청자';
              try { const p = JSON.parse(chat.profile || '{}'); if (p && p.nickname) nickname = p.nickname; } catch (_) {}
              const message = chat.msg || chat.content || '';
              if (message) this.handleIncomingChat(nickname, message, prefix);
            });
            break;
          }
        }
      };

      ws.onerror = (err) => {
        console.error(`❌ ${prefix} 치지직 웹소켓 오류`, err);
        this.notifyFallback(prefix, '치지직 웹소켓 오류');
      };

      ws.onclose = () => {
        console.warn(`🔌 ${prefix} 치지직 웹소켓 연결 종료`);
        if (channel.pollTimer) { clearInterval(channel.pollTimer); channel.pollTimer = null; }
      };

      this.notifySuccess(prefix, '연동 시도 시작');
    } catch (e) {
      console.error(`❌ ${prefix} 치지직 연동 실패: ${e.message}`);
      this.notifyFallback(prefix, e.message);
    }
  }

  /**
   * 🔵 SOOP (숲/아프리카TV) 라이브 채팅 연동 — 실제 프로토콜 구현
   *
   * ⚠️ SOOP 채팅 프로토콜은 비공식(리버스 엔지니어링)이라 SOOP 측 변경에 따라 깨질 수 있습니다.
   *    필드 인덱스/패킷 규격이 맞지 않으면 CONFIG.SOOP_DEBUG=true로 콘솔 로그를 보며 조정하세요.
   *
   * 흐름:
   *   1) player_live_api.php(POST)로 방송번호(BNO)·채팅서버(CHDOMAIN)·포트(CHPT) 조회
   *      → 이 API는 CORS 차단 대상이라 CONFIG.SOOP_PROXY(pass-through 프록시)가 반드시 필요합니다.
   *   2) wss://{CHDOMAIN}:{CHPT+1}/Websocket/{bjId} 로 접속 (서브프로토콜 'chat')
   *   3) LOGIN(svc 1) → 응답 후 JOIN(svc 2, 채팅방=CHATNO) 전송, 이후 주기적 PING(svc 0)
   *   4) 수신 CHAT(svc 5) 패킷을 파싱해 닉네임·메시지를 추출 → handleIncomingChat
   */
  async connectSoop(channel, prefix) {
    const bid = (channel.targetId || '').trim().toLowerCase();
    const proxy = (typeof CONFIG !== 'undefined' && CONFIG.SOOP_PROXY) ? CONFIG.SOOP_PROXY : '';
    const debug = !!(typeof CONFIG !== 'undefined' && CONFIG.SOOP_DEBUG);

    if (!bid) {
      this.notifyFallback(prefix, 'BJ ID를 확인할 수 없습니다.');
      return;
    }
    if (!proxy) {
      console.warn(`⚠️ ${prefix} CONFIG.SOOP_PROXY가 비어 있어 SOOP 연동을 시작할 수 없습니다. (CORS 프록시 필요)`);
      this.notifyFallback(prefix, 'SOOP_PROXY 미설정 (CORS 프록시 필요)');
      return;
    }

    try {
      // 1) 라이브 정보 조회 (CORS 프록시 경유)
      const apiTarget = `https://live.sooplive.co.kr/afreeca/player_live_api.php?bjid=${encodeURIComponent(bid)}`;
      const apiUrl = proxy + encodeURIComponent(apiTarget);
      const body = `bid=${encodeURIComponent(bid)}&type=live&player_type=html5&mode=landing&from_api=0&pwd=&stream_type=common&quality=HD`;

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
      });
      if (!res.ok) throw new Error(`라이브 정보 조회 실패 (HTTP ${res.status})`);

      const info = await res.json();
      const ch = info && info.CHANNEL ? info.CHANNEL : {};
      // 접힘 없이 그대로 복사할 수 있도록 JSON 문자열로 출력
      if (debug) {
        console.log(`[SOOP] 파싱된 BJ ID: "${bid}"`);
        console.log(`[SOOP] player_live_api 응답 전체:`, JSON.stringify(info));
        console.log(`[SOOP] CHANNEL 요약: RESULT=${ch.RESULT}, BNO=${ch.BNO}, CHATNO=${ch.CHATNO}, CHDOMAIN=${ch.CHDOMAIN}, CHPT=${ch.CHPT}, BPWD=${ch.BPWD}`);
      }

      // RESULT !== 1 이면 방송 중이 아님 (에러 메시지에 실제 RESULT 값 노출)
      if (ch.RESULT !== undefined && Number(ch.RESULT) !== 1) {
        throw new Error(`방송 중이 아니거나 채팅방을 못 찾음 (RESULT=${ch.RESULT}). 방송이 실제 켜져 있는지, 비밀번호/성인 설정이 아닌지 확인하세요.`);
      }

      // ⚠️ 채팅방 입장(JOIN)에 쓰는 번호는 방송번호(BNO)가 아니라 CHATNO다.
      //    (예: BNO=296187049 이지만 CHATNO=6227) — BNO로 JOIN하면 방에 못 들어간다.
      const chatNo = ch.CHATNO || ch.BNO;            // 채팅방 번호 (JOIN 대상)
      const chDomain = (ch.CHDOMAIN || '').toLowerCase();
      const chPort = parseInt(ch.CHPT, 10);
      if (!chatNo || !chDomain || !chPort) {
        throw new Error('채팅 서버 정보(CHATNO/CHDOMAIN/CHPT)가 불완전합니다.');
      }

      // 2) 채팅 웹소켓 접속 (wss 포트 = CHPT + 1)
      const wsUrl = `wss://${chDomain}:${chPort + 1}/Websocket/${bid}`;
      if (debug) console.log(`[SOOP] 웹소켓 접속: ${wsUrl} (CHATNO=${chatNo})`);
      const ws = new WebSocket(wsUrl, ['chat']);
      ws.binaryType = 'arraybuffer';
      channel.ws = ws;

      ws.onopen = () => {
        console.log(`✅ ${prefix} SOOP 웹소켓 연결 성공! LOGIN 전송`);
        // 익명 접속 CONNECT(LOGIN) 페이로드: 구분자×3 + "16" + 구분자 (총 6바이트).
        // 예전처럼 구분자×2만 보내면 서버가 "프로토콜 정의와 맞지 않는 패킷"으로 거절한다.
        ws.send(this._soopPacket(1, `${this.SOOP_SEP.repeat(3)}16${this.SOOP_SEP}`)); // LOGIN
      };

      ws.onmessage = (event) => {
        const text = this._soopDecode(event.data);
        if (!text) return;
        const svc = this._soopServiceCode(text);
        if (debug) console.log(`[SOOP] svc=${svc} raw=`, JSON.stringify(text));

        if (svc === 1) {
          // LOGIN(CONNECT) 응답 → JOIN (채팅방 입장). 익명 입장 페이로드: 구분자 + CHATNO + 구분자×5
          ws.send(this._soopPacket(2, `${this.SOOP_SEP}${chatNo}${this.SOOP_SEP.repeat(5)}`));
          this.notifySuccess(prefix, '채팅방 입장');
          // keepalive PING (svc 0) 60초 주기
          channel.pollTimer = setInterval(() => {
            try { ws.send(this._soopPacket(0, this.SOOP_SEP)); } catch (_) {}
          }, 60000);
        } else if (svc === 5) {
          // CHAT 패킷 → 닉네임/메시지 파싱
          const parsed = this._soopParseChat(text);
          if (parsed && parsed.message) {
            if (debug) console.log(`[SOOP] 파싱결과 nick="${parsed.nickname}" msg="${parsed.message}"`);
            this.handleIncomingChat(parsed.nickname || 'SOOP시청자', parsed.message, prefix);
          }
        }
      };

      ws.onerror = (err) => {
        console.error(`❌ ${prefix} SOOP 웹소켓 오류`, err);
        this.notifyFallback(prefix, 'SOOP 웹소켓 오류');
      };

      ws.onclose = () => {
        console.warn(`🔌 ${prefix} SOOP 웹소켓 연결 종료`);
        if (channel.pollTimer) { clearInterval(channel.pollTimer); channel.pollTimer = null; }
      };

      this.notifySuccess(prefix, '연동 시도 시작');
    } catch (e) {
      console.error(`❌ ${prefix} SOOP 연동 실패: ${e.message}`);
      this.notifyFallback(prefix, e.message);
    }
  }

  /* --- SOOP 프로토콜 상수/헬퍼 ------------------------------------------- */
  get SOOP_ESC() { return '\x1b\t'; }   // 패킷 헤더(ESC + TAB)
  get SOOP_SEP() { return '\x0c'; }     // 필드 구분자(form feed, 0x0c)

  /** svc/body로 SOOP 패킷 문자열 생성: ESC + svc(4) + len(6) + '00' + body */
  _soopPacket(service, bodyStr) {
    const body = bodyStr || '';
    const len = new TextEncoder().encode(body).length;
    return this.SOOP_ESC
      + String(service).padStart(4, '0')
      + String(len).padStart(6, '0')
      + '00'
      + body;
  }

  /** 수신 데이터(ArrayBuffer/Blob/string)를 UTF-8 문자열로 디코드 */
  _soopDecode(data) {
    try {
      if (typeof data === 'string') return data;
      if (data instanceof ArrayBuffer) return new TextDecoder('utf-8').decode(new Uint8Array(data));
      return null; // Blob 등은 이 경로에서 처리하지 않음(binaryType=arraybuffer로 강제)
    } catch (_) {
      return null;
    }
  }

  /** 프레임 헤더에서 서비스 코드(정수) 추출 */
  _soopServiceCode(text) {
    // 헤더: ESC(2) + svc(4) + len(6) + '00'
    const svcStr = text.slice(this.SOOP_ESC.length, this.SOOP_ESC.length + 4);
    const n = parseInt(svcStr, 10);
    return Number.isNaN(n) ? -1 : n;
  }

  /**
   * CHAT(svc 5) 프레임에서 닉네임/메시지 추출.
   * 본문을 구분자(0x0c)로 나눠 파싱한다. SOOP 버전에 따라 인덱스가 달라질 수 있어
   * message=parts[1]을 기본으로 하고, 닉네임은 후보 인덱스를 순차 탐색한다.
   */
  _soopParseChat(text) {
    const HEADER_LEN = this.SOOP_ESC.length + 4 + 6 + 2; // = 14
    const payload = text.slice(HEADER_LEN);
    const parts = payload.split(this.SOOP_SEP);

    const message = (parts[1] || '').trim();
    // 닉네임 후보: 흔히 parts[6]. 유효한(비어있지 않고 숫자ID가 아닌) 첫 항목을 사용.
    let nickname = '';
    const candidates = [parts[6], parts[7], parts[5], parts[2]];
    for (const c of candidates) {
      const v = (c || '').trim();
      if (v && v !== message) { nickname = v; break; }
    }
    return { nickname, message };
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
    const fullNickname = prefix ? `${prefix} ${nickname}` : nickname;

    // 계획서 v2.0 표준 객체인 wordPacks에 채팅 메시지 전달
    if (typeof wordPacks !== 'undefined' && typeof wordPacks.processChatMessage === 'function') {
      wordPacks.processChatMessage(fullNickname, messageText);
    } else {
      console.warn('[ChatIntegration] wordPacks 객체를 찾을 수 없습니다.');
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
window.chatEngine = chatEngine;
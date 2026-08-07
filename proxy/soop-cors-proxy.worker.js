/**
 * ============================================================================
 * SOOP(숲/아프리카) + 치지직(Chzzk) CORS 프록시 — Cloudflare Worker
 * ============================================================================
 *
 * 왜 필요한가?
 *   SOOP은 채팅 서버 주소·방송번호(BNO)를 player_live_api.php에서, 치지직은 채팅방
 *   ID(chatChannelId)·접근 토큰을 각 API에서 받아와야 하는데, 이 API들이 CORS 헤더를
 *   주지 않아 브라우저(정적 사이트)에서 직접 호출하면 차단됩니다.
 *   이 Worker가 요청을 서버 측에서 대신 보내고 CORS 헤더를 붙여 돌려줍니다.
 *   (SOOP·치지직 모두 이 한 개의 Worker로 처리 — config의 SOOP_PROXY/CHZZK_PROXY에 같은 주소 사용)
 *
 * 스트리머는 이걸 만질 필요가 전혀 없습니다.
 *   개발자가 딱 한 번 배포 → 나온 주소를 js/config.js의 SOOP_PROXY에 넣어두면
 *   그 뒤로 스트리머는 방송국 URL만 붙여넣으면 자동으로 연동됩니다.
 *
 * 배포 방법(무료, 카드 불필요): docs/SOOP_연동_설정.md 참고.
 *
 * 사용 형태(클라이언트에서 자동으로 이렇게 호출):
 *   https://<당신의-worker>.workers.dev/?url=<인코딩된_실제주소>
 *
 * 보안: 아무 주소나 중계하는 오픈 프록시가 되지 않도록 SOOP/아프리카 도메인만 허용합니다.
 */

// 오픈 프록시 악용 방지: SOOP/아프리카 + 치지직(네이버) 채팅 API 도메인만 허용.
//   - SOOP:   *.sooplive.co.kr, *.afreecatv.com
//   - 치지직: api.chzzk.naver.com(라이브 상태), comm-api.game.naver.com(접근 토큰)
const ALLOWED_HOST = /(^|\.)sooplive\.co\.kr$|(^|\.)afreecatv\.com$|(^|\.)chzzk\.naver\.com$|(^|\.)game\.naver\.com$/i;

function corsHeaders(extra = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    ...extra,
  };
}

export default {
  async fetch(request) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const url = new URL(request.url);
    const target = url.searchParams.get('url');
    if (!target) {
      return new Response('Missing ?url= parameter', { status: 400, headers: corsHeaders() });
    }

    let t;
    try {
      t = new URL(target);
    } catch (_) {
      return new Response('Invalid target url', { status: 400, headers: corsHeaders() });
    }

    // 오픈 프록시 악용 방지: SOOP/아프리카 도메인만 허용
    if (!ALLOWED_HOST.test(t.hostname)) {
      return new Response('Host not allowed', { status: 403, headers: corsHeaders() });
    }

    // 대상 호스트에 맞는 Referer 지정 (네이버/치지직 API는 sooplive Referer를 싫어할 수 있음)
    const isNaver = /(^|\.)naver\.com$/i.test(t.hostname);
    const referer = isNaver ? 'https://chzzk.naver.com/' : 'https://play.sooplive.co.kr/';

    // 원 요청을 그대로 전달(pass-through)
    const init = {
      method: request.method,
      headers: {
        'Content-Type': request.headers.get('Content-Type') || 'application/x-www-form-urlencoded',
        // SOOP/치지직이 브라우저스러운 UA를 기대하는 경우가 있어 기본값 지정
        'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0',
        'Referer': referer,
      },
    };
    if (request.method === 'POST') {
      init.body = await request.text();
    }

    let resp;
    try {
      resp = await fetch(target, init);
    } catch (err) {
      return new Response('Upstream fetch failed: ' + err.message, { status: 502, headers: corsHeaders() });
    }

    const bodyText = await resp.text();
    return new Response(bodyText, {
      status: resp.status,
      headers: corsHeaders({
        'Content-Type': resp.headers.get('Content-Type') || 'application/json; charset=utf-8',
      }),
    });
  },
};

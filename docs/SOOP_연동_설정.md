# 🔵 SOOP(숲/아프리카) 실시간 채팅 연동 설정 가이드

> **요약:** 개발자가 **딱 한 번** 무료 Cloudflare Worker 프록시를 배포하고 그 주소를
> `js/config.js`에 넣어두면, 그 뒤로 **스트리머는 방송국 URL만 붙여넣으면 자동 연동**됩니다.
> 스트리머는 이 문서/프록시를 만질 필요가 전혀 없습니다.

---

## 왜 프록시가 필요한가?

SOOP은 채팅 서버 주소·방송번호(BNO)를 `player_live_api.php`에서 받아와야 하는데, 이 API가
**CORS 헤더를 주지 않아** 브라우저(정적 사이트)에서 직접 호출하면 차단됩니다. 그래서 요청을
대신 전달해 줄 **중계 서버(프록시)**가 하나 필요합니다.

- 스트리머가 프록시를 조정? ❌ 아님 (개발자가 한 번 세팅하면 끝)
- 세상 누구도 프록시를 안 올림? ❌ 불가능 (CORS는 브라우저의 근본 제약)

Cloudflare Worker는 **무료**(하루 10만 요청, 신용카드 불필요)라 이 용도에 적합합니다.

---

## 1단계 — Cloudflare 가입 (무료, 카드 불필요)

1. https://dash.cloudflare.com/sign-up 에서 이메일로 가입합니다.
2. 로그인 후 왼쪽 메뉴에서 **Workers & Pages** 로 이동합니다.

## 2단계 — Worker 생성 & 코드 붙여넣기

1. **Create application → Create Worker** 클릭.
2. 이름을 정합니다 (예: `soop-proxy`). → **Deploy** 클릭.
3. 배포되면 **Edit code** 클릭 → 기본 코드를 전부 지우고,
   저장소의 [`proxy/soop-cors-proxy.worker.js`](../proxy/soop-cors-proxy.worker.js) 내용을
   **그대로 복사해 붙여넣기** → 오른쪽 위 **Deploy** 클릭.

## 3단계 — Worker 주소 복사

배포 후 이런 형태의 주소가 생깁니다:

```
https://soop-proxy.<당신의계정>.workers.dev
```

## 4단계 — config.js에 주소 넣기 (⭐ 핵심)

`js/config.js` 의 `SOOP_PROXY` 값을 위 주소 뒤에 **`/?url=`** 를 붙여서 넣습니다:

```js
SOOP_PROXY: "https://soop-proxy.<당신의계정>.workers.dev/?url=",
```

> ⚠️ 끝에 `/?url=` 를 꼭 붙여야 합니다. (클라이언트가 실제 주소를 이 뒤에 이어 붙입니다)

저장 후 사이트를 다시 배포/새로고침하면 끝입니다.

---

## 이제 스트리머는?

홈 화면 **방송 채팅 연동 패널 → SOOP 탭** → 방송국 주소(`https://play.sooplive.co.kr/아이디`)를
붙여넣고 **+ BJ 추가**. 시청자가 채팅창에 **`!참여`** 를 치면 참여자 명단에
자동으로 들어갑니다.

---

## 문제 해결 (라이브에서 확인)

SOOP 채팅 프로토콜은 **비공식(리버스 엔지니어링)**이라, SOOP 측 변경에 따라 닉네임/메시지
필드 위치가 어긋날 수 있습니다. `js/config.js` 에서 `SOOP_DEBUG: true` 로 둔 상태로
실제 방송에 연결한 뒤 브라우저 콘솔(F12)을 열면 다음 로그가 보입니다:

- `[SOOP] player_live_api 응답 CHANNEL: {...}` — 방송 정보 조회 성공 여부
- `[SOOP] 웹소켓 접속: wss://... (BNO=...)` — 채팅 서버 접속 시도
- `[SOOP] svc=5 raw= "..."` — 수신한 원본 채팅 패킷
- `[SOOP] 파싱결과 nick="..." msg="..."` — 닉네임/메시지 파싱 결과

만약 `파싱결과`의 닉네임이 이상하게 나오면, 그 `svc=5 raw=` 로그를 개발자에게 전달하면
`js/chatIntegration.js` 의 `_soopParseChat()` 필드 인덱스를 정확히 맞출 수 있습니다.

### 자주 나오는 상황
| 콘솔 로그 | 의미 / 조치 |
|---|---|
| `SOOP_PROXY 미설정` 토스트 | 4단계를 안 함 → config.js에 Worker 주소 입력 |
| `라이브 정보 조회 실패 (HTTP 403/1015)` | Worker 문제 또는 방송 중 아님. Worker 배포/주소 확인 |
| `현재 방송 중이 아니거나...` | 해당 BJ가 지금 방송 중이 아님 |
| 웹소켓이 바로 close | SOOP 채팅서버가 브라우저 Origin을 거부하는 경우 — Worker로 웹소켓까지 중계하도록 확장 필요(문의) |

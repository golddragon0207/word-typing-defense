/**
 * ============================================================
 * globalLeaderboard.js — 🌐 Firebase Firestore 기반 글로벌 명예의 전당
 *                        + 📊 Firebase Analytics(GA4) 게임 이벤트 로깅
 * ============================================================
 * GitHub Pages(정적 호스팅)에는 서버가 없으므로, 모든 스트리머/시청자가
 * 공유하는 TOP 5를 만들기 위해 Firebase Firestore(무료 티어)를 사용한다.
 * 같은 Firebase 프로젝트에 딸려오는 Analytics(GA4)로 게임 시작/종료,
 * 난이도 선택, 방송 채팅 연동 등의 이벤트를 무료로 함께 수집한다.
 *
 * CONFIG.FIREBASE.apiKey가 비어 있으면(설정 전) 이 모듈은 자동으로 비활성화되고,
 * StateManager의 기존 localStorage 기반 로컬 TOP5가 그대로 사용된다 (하위호환/오프라인 폴백).
 * CONFIG.FIREBASE.measurementId가 비어 있으면 애널리틱스만 별도로 비활성화된다
 * (리더보드는 정상 동작, logEvent 호출은 조용히 무시됨).
 *
 * ────────────────────────────────────────────────────────────
 * 🔐 Firestore 보안 규칙 (Firebase 콘솔 > Firestore Database > 규칙 탭에 붙여넣기)
 * ⚠️ 랭킹 기준이 '최고 도달 스테이지'로 바뀌었으므로 아래 규칙(difficulty 제거 + stage 검증
 *    추가)으로 반드시 교체 후 다시 "게시"해야 한다. (기존 문서는 그대로 둬도 읽기는 정상)
 * ────────────────────────────────────────────────────────────
 * rules_version = '2';
 * service cloud.firestore {
 *   match /databases/{database}/documents {
 *     match /leaderboard/{entryId} {
 *       allow read: if true;
 *       allow create: if request.resource.data.keys().hasOnly(
 *                         ['nickname','score','stage','wpm','combo','grade','date','createdAt']
 *                       )
 *                     && request.resource.data.nickname is string
 *                     && request.resource.data.nickname.size() <= 20
 *                     && request.resource.data.score is number
 *                     && request.resource.data.score >= 0
 *                     && request.resource.data.score <= 999999
 *                     && request.resource.data.stage is number
 *                     && request.resource.data.stage >= 1
 *                     && request.resource.data.stage <= 9999;
 *       allow update, delete: if false; // 클라이언트에서 수정/삭제 불가 (스코어 위변조 방지)
 *     }
 *     match /suggestions/{docId} {
 *       allow read: if false;   // 건의사항은 클라이언트 조회 불가 (개발자가 콘솔에서만 확인)
 *       allow create: if request.resource.data.keys().hasOnly(['text','nickname','createdAt'])
 *                     && request.resource.data.text is string
 *                     && request.resource.data.text.size() >= 1
 *                     && request.resource.data.text.size() <= 500
 *                     && request.resource.data.nickname is string
 *                     && request.resource.data.nickname.size() <= 20;
 *       allow update, delete: if false;
 *     }
 *   }
 * }
 * ────────────────────────────────────────────────────────────
 * ⚠️ 참고: 클라이언트(브라우저)에서 직접 점수를 전송하는 구조라 악의적인 시청자가
 * 개발자도구로 임의의 값을 보낼 가능성 자체를 완전히 막을 수는 없다. 위 규칙은
 * "터무니없는 값(음수, 상한 초과, 필드 조작)"만 최소한으로 걸러내는 수준이다.
 *
 * 조회 시 컬렉션 하나를 스테이지 내림차순으로 넉넉히(최대 200건) 가져온 뒤, 클라이언트에서
 * 동점(같은 스테이지)은 점수 내림차순으로 다시 정렬해 상위 N개를 추린다
 * (단일 필드 orderBy라 복합 인덱스가 필요 없다).
 */

const GlobalLeaderboard = {
  db: null,
  enabled: false,
  COLLECTION: 'leaderboard',

  // 📊 상위 % 표시에 필요한 "누적 기록 수" 최소 기준(고정값).
  //   글로벌 리더보드에 쌓인 전체 기록이 이 수 미만이면 백분위 대신 '집계 중'을 보여준다.
  //   (표본이 적을 때 '상위 100%'처럼 무의미하게 나오는 것을 방지)
  MIN_SAMPLE: 50,

  // 백분위 계산 시 점수 내림차순으로 읽어올 최대 문서 수(상한).
  //   이 SDK(compat)에는 count() 집계가 없어, 실제 기록을 읽어 개수·순위를 직접 센다.
  //   기록 총량이 이 값 이하이면 snapshot.size가 곧 정확한 "누적 기록 수"이며,
  //   이 값을 넘어서면 상위 SCAN_CAP개 안에서의 백분위로 saturate된다(그 시점엔 서버측
  //   count/누적 카운터 문서 방식으로 교체 권장).
  PERCENTILE_SCAN_CAP: 2000,

  analytics: null,
  analyticsEnabled: false,

  /**
   * Firebase 앱 초기화 (CONFIG.FIREBASE.apiKey가 있을 때만 활성화)
   * measurementId가 있으면 Analytics(GA4)도 함께 초기화한다.
   */
  init() {
    try {
      const cfg = (typeof CONFIG !== 'undefined') ? CONFIG.FIREBASE : null;
      if (!cfg || !cfg.apiKey || typeof firebase === 'undefined') {
        this.enabled = false;
        return false;
      }

      if (!firebase.apps || firebase.apps.length === 0) {
        firebase.initializeApp(cfg);
      }
      this.db = firebase.firestore();
      this.enabled = true;
      console.log('🌐 [GlobalLeaderboard] Firebase 연동 활성화됨');

      // 📊 Analytics(GA4) — measurementId가 있고 SDK가 로드된 경우에만 활성화
      try {
        if (cfg.measurementId && typeof firebase.analytics === 'function') {
          this.analytics = firebase.analytics();
          this.analyticsEnabled = true;
          console.log('📊 [GlobalLeaderboard] Analytics 활성화됨');
        }
      } catch (analyticsErr) {
        console.warn('⚠️ [GlobalLeaderboard] Analytics 초기화 실패(리더보드는 정상 동작):', analyticsErr.message);
      }

      return true;
    } catch (e) {
      console.warn('⚠️ [GlobalLeaderboard] Firebase 초기화 실패 → 로컬 TOP5로 대체:', e.message);
      this.enabled = false;
      return false;
    }
  },

  /**
   * 📊 게임 이벤트를 Firebase Analytics(GA4)로 전송한다.
   * measurementId 미설정 등으로 비활성 상태면 조용히 아무 일도 하지 않는다(게임 동작에 영향 없음).
   * 개인 식별 가능 정보(닉네임 등)는 절대 넘기지 않는다.
   * @param {string} name - GA4 이벤트 이름 (예: 'game_start', 'game_over')
   * @param {Object} params - 이벤트에 함께 실릴 파라미터 (숫자/문자열만)
   */
  logEvent(name, params = {}) {
    if (!this.analyticsEnabled || !this.analytics) return;
    try {
      this.analytics.logEvent(name, params);
    } catch (e) {
      // 애널리틱스 실패는 게임 진행에 절대 영향을 주지 않는다
      console.warn('⚠️ [GlobalLeaderboard] logEvent 실패:', e.message);
    }
  },

  /**
   * 🏆 글로벌 명예의 전당에 점수 제출 (랭킹 기준: 최고 도달 스테이지)
   * @param {{nickname:string, score:number, stage:number, wpm:number, combo:number, grade:string, date:string}} entry
   * @returns {Promise<boolean>} 성공 여부
   */
  async submitScore(entry) {
    if (!this.enabled || !this.db) return false;
    try {
      await this.db.collection(this.COLLECTION).add({
        nickname: (entry.nickname || '스트리머').slice(0, 20),
        score: Math.max(0, Math.min(999999, Math.floor(entry.score || 0))),
        stage: Math.max(1, Math.min(9999, Math.floor(entry.stage || 1))),
        wpm: entry.wpm || 0,
        combo: entry.combo || 0,
        grade: entry.grade || 'D',
        date: entry.date || new Date().toISOString().slice(0, 10),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return true;
    } catch (e) {
      console.warn('⚠️ [GlobalLeaderboard] 점수 제출 실패:', e.message);
      return false;
    }
  },

  /**
   * 🏆 글로벌 단일 TOP N 조회 (랭킹 기준: 최고 도달 스테이지)
   * 컬렉션을 스테이지 내림차순으로 넉넉히 가져온 뒤, 동점(같은 스테이지)은 클라이언트에서
   * 점수 내림차순으로 재정렬해 상위 limit개만 추린다 (단일 필드 orderBy → 복합 인덱스 불필요).
   * @param {number} limit - 반환 개수 (기본 5)
   * @returns {Promise<Array|null>} 실패 시 null
   */
  async fetchTop(limit = 5) {
    if (!this.enabled || !this.db) return null;
    try {
      const snap = await this.db.collection(this.COLLECTION)
        .orderBy('stage', 'desc')
        .limit(200)
        .get();

      const rows = snap.docs.map(doc => doc.data());
      rows.sort((a, b) => (b.stage || 1) - (a.stage || 1) || (b.score || 0) - (a.score || 0));
      return rows.slice(0, limit);
    } catch (e) {
      console.warn('⚠️ [GlobalLeaderboard] TOP 조회 실패:', e.message);
      return null;
    }
  },

  /**
   * 📊 내 점수의 글로벌 상위 백분위(%) 조회 — "상위 X%" 표시용.
   *   이 compat SDK에는 count() 집계가 없어, 점수 내림차순으로 누적 기록을 SCAN_CAP까지 읽어
   *   (1) 누적 기록 수(snapshot.size)와 (2) 내 점수보다 높은 기록 수를 직접 센다.
   *   - 누적 기록 수가 MIN_SAMPLE 미만이면 { enough:false }로 반환('집계 중' 표시).
   *   - 랭킹 기준은 결과 화면의 등급(점수 기반)과 일관되게 '점수'를 사용한다.
   *   내 기록은 아직 서버에 반영되지 않았을 수 있으므로 "가상으로 1건 추가"해 계산한다
   *   (above+1)/(total+1) — 표본이 충분(≥MIN_SAMPLE)하면 ±1의 영향은 무시할 수준.
   * @param {number} score - 내 최종 점수
   * @returns {Promise<{available:boolean, enough?:boolean, total?:number, topPercent?:number, rank?:number}>}
   */
  async fetchPercentile(score) {
    if (!this.enabled || !this.db) return { available: false };

    // 0점(사실상 미플레이 = D 등급) 판은 상위 %를 매기지 않고, 누적 집계에서도 제외한다.
    const s = Math.floor(score || 0);
    if (s <= 0) return { available: false };

    try {
      const snap = await this.db.collection(this.COLLECTION)
        .where('score', '>', 0)        // 0점 기록은 누적 표본에서 제외
        .orderBy('score', 'desc')
        .limit(this.PERCENTILE_SCAN_CAP)
        .get();

      const docs = snap.docs;
      let above = 0;
      for (let i = 0; i < docs.length; i++) {
        if ((docs[i].data().score || 0) > s) above++;
        else break;
      }

      const total = snap.size; // 0점 제외 누적 기록 수 (SCAN_CAP 이하이면 정확한 전체 누적값)
      if (total < this.MIN_SAMPLE) {
        return { available: true, enough: false, total, rank: above + 1 };
      }

      let topPercent = ((above + 1) / (total + 1)) * 100;
      topPercent = Math.max(0.1, Math.min(100, topPercent));
      // rank = 나보다 높은 점수 수 + 1 (점수 기준 정확 등수). SCAN_CAP 밖이면 그 안에서 saturate.
      return { available: true, enough: true, total, topPercent, rank: above + 1 };
    } catch (e) {
      console.warn('⚠️ [GlobalLeaderboard] 백분위 조회 실패:', e.message);
      return { available: false };
    }
  },

  /**
   * 💡 건의사항 제출 (suggestions 컬렉션에 저장 → 개발자가 Firebase 콘솔에서 확인)
   * 개인정보는 받지 않으며, 닉네임은 선택(비우면 '익명')이다.
   * @param {string} text - 건의 내용 (1~500자)
   * @param {string} [nickname] - 작성자 닉네임 (선택, 최대 20자)
   * @returns {Promise<boolean>} 성공 여부
   */
  async submitSuggestion(text, nickname) {
    if (!this.enabled || !this.db) return false;
    const body = (text || '').trim();
    if (!body) return false;
    try {
      await this.db.collection('suggestions').add({
        text: body.slice(0, 500),
        nickname: (nickname || '').trim().slice(0, 20) || '익명',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return true;
    } catch (e) {
      console.warn('⚠️ [GlobalLeaderboard] 건의사항 제출 실패:', e.message);
      return false;
    }
  }
};

window.GlobalLeaderboard = GlobalLeaderboard;

// DOM 로드 시 자동 초기화 시도 (설정이 비어 있으면 조용히 비활성 상태 유지)
document.addEventListener('DOMContentLoaded', () => GlobalLeaderboard.init());

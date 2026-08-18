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
 * 🔐 배포용 Firestore 보안 규칙의 단일 원본은 루트 `firestore.rules`다.
 * 닉네임 정규화 키를 문서 ID로 사용하고, 같은 문서는 스테이지 우선·동률 시 점수가
 * 높아질 때만 갱신한다. 따라서 글로벌 DB와 count() 모두 닉네임별 최고 기록 1개를 센다.
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
  _aggregateContextPromise: null,

  // 📊 상위 % 표시에 필요한 "누적 기록 수" 최소 기준(고정값).
  //   글로벌 리더보드에 쌓인 전체 기록이 이 수 미만이면 백분위 대신 '집계 중'을 보여준다.
  //   (표본이 적을 때 '상위 100%'처럼 무의미하게 나오는 것을 방지)
  MIN_SAMPLE: 50,

  // 서버 집계 모듈 로드 또는 count()가 실패할 때만 사용하는 호환 폴백 상한.
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
      const nickname = String(entry.nickname || '스트리머').trim().replace(/\s+/g, ' ').slice(0, 20);
      const nicknameKey = this.normalizeNicknameKey(nickname);
      const nextRecord = {
        nickname,
        nicknameKey,
        score: Math.max(0, Math.min(999999, Math.floor(entry.score || 0))),
        stage: Math.max(1, Math.min(9999, Math.floor(entry.stage || 1))),
        wpm: entry.wpm || 0,
        combo: entry.combo || 0,
        grade: entry.grade || 'D',
        playTimeSec: entry.playTimeSec || 0,
        playTimeStr: entry.playTimeStr || '0초',
        date: entry.date || new Date().toISOString().slice(0, 10),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      const docRef = this.db.collection(this.COLLECTION).doc(nicknameKey);

      await this.db.runTransaction(async transaction => {
        const currentSnapshot = await transaction.get(docRef);
        if (currentSnapshot.exists) {
          const current = currentSnapshot.data() || {};
          const isHigher = nextRecord.stage > (current.stage || 1)
            || (nextRecord.stage === (current.stage || 1) && nextRecord.score > (current.score || 0));
          if (!isHigher) return;
        }
        transaction.set(docRef, nextRecord);
      });
      return true;
    } catch (e) {
      console.warn('⚠️ [GlobalLeaderboard] 점수 제출 실패:', e.message);
      return false;
    }
  },

  /** 닉네임별 고정 Firestore 문서 ID. `/`는 경로 구분자가 되지 않도록 전각 문자로 치환한다. */
  normalizeNicknameKey(nickname) {
    return String(nickname || '스트리머')
      .trim()
      .replace(/\s+/g, ' ')
      .toLocaleLowerCase('ko-KR')
      .replace(/\//g, '／')
      .slice(0, 20);
  },

  /** 닉네임별 최고 기록 1개만 남긴다(공백·영문 대소문자 차이는 동일인 처리). */
  dedupeScoresByNickname(rows) {
    const sorted = (Array.isArray(rows) ? rows : [])
      .slice()
      .sort((a, b) => (b.stage || 1) - (a.stage || 1) || (b.score || 0) - (a.score || 0));
    const seen = new Set();
    return sorted.filter(entry => {
      const key = entry.nicknameKey || this.normalizeNicknameKey(entry.nickname);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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
      return this.dedupeScoresByNickname(rows).slice(0, limit);
    } catch (e) {
      console.warn('⚠️ [GlobalLeaderboard] TOP 조회 실패:', e.message);
      return null;
    }
  },

  /**
   * 📊 내 점수의 글로벌 상위 백분위(%) 조회 — "상위 X%" 표시용.
   *   Firestore 모듈 SDK의 count() 서버 집계로 (1) 누적 기록 수와
   *   (2) 내 점수보다 높은 기록 수만 받아 문서 본문 다운로드를 피한다.
   *   모듈 로드 또는 집계가 실패하면 compat 스캔 방식으로 자동 폴백한다.
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
      // compat 앱은 그대로 유지하고, 순위 조회 시에만 동일 버전의 모듈 SDK를 지연 로드한다.
      // count 집계는 문서 본문을 최대 2,000건 내려받지 않고 서버에서 개수만 반환한다.
      const aggregate = await this._getAggregateContext();
      const scores = aggregate.collection(aggregate.db, this.COLLECTION);
      const totalQuery = aggregate.query(scores, aggregate.where('score', '>', 0));
      const aboveQuery = aggregate.query(scores, aggregate.where('score', '>', s));
      const [totalSnapshot, aboveSnapshot] = await Promise.all([
        aggregate.getCountFromServer(totalQuery),
        aggregate.getCountFromServer(aboveQuery)
      ]);

      const total = totalSnapshot.data().count;
      const above = aboveSnapshot.data().count;
      if (total < this.MIN_SAMPLE) {
        return { available: true, enough: false, total, rank: above + 1 };
      }

      let topPercent = ((above + 1) / (total + 1)) * 100;
      topPercent = Math.max(0.1, Math.min(100, topPercent));
      return { available: true, enough: true, total, topPercent, rank: above + 1 };
    } catch (aggregateError) {
      console.warn('⚠️ [GlobalLeaderboard] count 집계 실패, 호환 조회로 폴백:', aggregateError.message);
      return this._fetchPercentileByScan(s);
    }
  },

  async _getAggregateContext() {
    if (!this._aggregateContextPromise) {
      this._aggregateContextPromise = (async () => {
        const [appSdk, firestoreSdk] = await Promise.all([
          import('https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js'),
          import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js')
        ]);
        const cfg = CONFIG.FIREBASE;
        const appName = 'wtd-aggregate';
        const existing = appSdk.getApps().find(app => app.name === appName);
        const app = existing || appSdk.initializeApp(cfg, appName);
        return {
          db: firestoreSdk.getFirestore(app),
          collection: firestoreSdk.collection,
          query: firestoreSdk.query,
          where: firestoreSdk.where,
          getCountFromServer: firestoreSdk.getCountFromServer
        };
      })().catch(error => {
        this._aggregateContextPromise = null;
        throw error;
      });
    }
    return this._aggregateContextPromise;
  },

  async _fetchPercentileByScan(score) {
    try {
      const snap = await this.db.collection(this.COLLECTION)
        .where('score', '>', 0)
        .orderBy('score', 'desc')
        .limit(this.PERCENTILE_SCAN_CAP)
        .get();

      const docs = snap.docs;
      let above = 0;
      for (let i = 0; i < docs.length; i++) {
        if ((docs[i].data().score || 0) > score) above++;
        else break;
      }

      const total = snap.size;
      if (total < this.MIN_SAMPLE) {
        return { available: true, enough: false, total, rank: above + 1 };
      }

      const topPercent = Math.max(0.1, Math.min(100, ((above + 1) / (total + 1)) * 100));
      return { available: true, enough: true, total, topPercent, rank: above + 1 };
    } catch (error) {
      console.warn('⚠️ [GlobalLeaderboard] 백분위 호환 조회 실패:', error.message);
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

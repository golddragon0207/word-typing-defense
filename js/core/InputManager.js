/**
 * ==========================================
 * Word Typing Defense - InputManager
 * ==========================================
 * 단일/개별 입력창 이벤트 수신, 한글 IME(조합 완료) 감지,
 * 한글 자모 획수 분석 기반 정밀 타수(CPM/WPM) 및 정확도 연산을 전담합니다.
 */

class InputManager {
    constructor() {
        // 입력 요소 참조
        this.inputElements = [];
        this.isComposing = false; // 한글 조합 중(IME) 여부

        // 타수 통계용 변수
        this.startTime = null;
        this.totalStrokeCount = 0;   // 입력한 누적 총 획수
        this.correctStrokeCount = 0; // 성공적으로 맞춘 획수
        this.totalAttempts = 0;      // 총 입력 시도 횟수
        this.successfulHits = 0;     // 성공 타격 횟수

        // 타격 발생 시 외부로 이벤트를 전달할 콜백 함수
        // (game.js 오케스트레이터에서 바인딩)
        this.onTargetHit = null;
    }

    /**
     * 입력창 DOM 요소 바인딩 및 이벤트 리스너 등록
     * @param {Array<HTMLElement>|HTMLElement} inputs - 단일 또는 복수의 input 엘리먼트
     */
    setupInputs(inputs) {
        // 기존 바인딩 해제
        this.detachEvents();

        this.inputElements = Array.isArray(inputs) ? inputs : [inputs];

        this.inputElements.forEach((inputEl, index) => {
            if (!inputEl) return;

            // 플레이어 ID 식별자 부여 (1P ~ 6P)
            inputEl.dataset.playerId = index + 1;

            // IME(한글 조합) 시작/끝 감지 이벤트
            const handleCompositionStart = () => { this.isComposing = true; };
            const handleCompositionEnd = () => { this.isComposing = false; };

            // 키보드 입력 및 Enter 타격 처리
            const handleKeyDown = (e) => this.handleKeyDownEvent(e, inputEl);

            inputEl.addEventListener('compositionstart', handleCompositionStart);
            inputEl.addEventListener('compositionend', handleCompositionEnd);
            inputEl.addEventListener('keydown', handleKeyDown);

            // 이벤트 참조 저장 (해제용)
            inputEl._listeners = {
                compositionstart: handleCompositionStart,
                compositionend: handleCompositionEnd,
                keydown: handleKeyDown
            };
        });
    }

    /**
     * 이벤트 바인딩 해제 (메모리 누수 방지)
     */
    detachEvents() {
        this.inputElements.forEach(inputEl => {
            if (inputEl && inputEl._listeners) {
                inputEl.removeEventListener('compositionstart', inputEl._listeners.compositionstart);
                inputEl.removeEventListener('compositionend', inputEl._listeners.compositionend);
                inputEl.removeEventListener('keydown', inputEl._listeners.keydown);
                delete inputEl._listeners;
            }
        });
        this.inputElements = [];
    }

    /**
     * 키보드 눌림 이벤트 핸들러
     * @param {KeyboardEvent} e 
     * @param {HTMLInputElement} inputEl 
     */
    handleKeyDownEvent(e, inputEl) {
        // Enter 키 입력 시 타격 판정 실행 (IME 조합 완료 처리 고려)
        if (e.key === 'Enter') {
            // 한글 조합 중 Enter를 누르면 이벤트 중복 방지
            if (e.isComposing || this.isComposing) {
                this.isComposing = false;
            }

            const typedText = inputEl.value.trim();
            if (typedText.length === 0) return;

            // 최초 입력 시 타이머 시작
            if (!this.startTime) {
                this.startTime = performance.now();
            }

            const playerId = parseInt(inputEl.dataset.playerId, 10) || 1;

            // 한글/영문 자모 획수 계산 (wordPacks.js의 유틸리티 활용)
            const strokeCount = this.calculateStrokes(typedText);
            this.totalStrokeCount += strokeCount;
            this.totalAttempts++;

            // 통계 데이터 연산
            const currentStats = this.calculateTypingStats(strokeCount);

            // 외부 hit 콜백 호출
            if (typeof this.onTargetHit === 'function') {
                this.onTargetHit({
                    word: typedText,
                    playerId: playerId,
                    strokeCount: strokeCount,
                    stats: currentStats
                });
            }

            // 입력창 초기화 및 포커스 유지
            inputEl.value = '';
        }
    }

    /**
     * 한글/영문 단어의 정밀 자모 획수 계산
     * @param {string} text 
     * @returns {number}
     */
    calculateStrokes(text) {
        if (window.wordPacks && typeof window.wordPacks.getHangulStrokeCount === 'function') {
            return window.wordPacks.getHangulStrokeCount(text);
        }

        // 유틸리티가 없을 경우 기본 글자 수 x 2 대체
        return text.length * 2;
    }

    /**
     * 실시간 타수(CPM / WPM) 및 정확도 계산
     * @param {number} recentStrokes - 이번 입력 획수
     * @returns {Object} { cpm, wpm, accuracy }
     */
    calculateTypingStats(recentStrokes) {
        if (!this.startTime) {
            return { cpm: 0, wpm: 0, accuracy: 100 };
        }

        const elapsedMinutes = (performance.now() - this.startTime) / 1000 / 60;
        if (elapsedMinutes <= 0) return { cpm: 0, wpm: 0, accuracy: 100 };

        // 맞춘 획수 누적
        this.correctStrokeCount += recentStrokes;
        this.successfulHits++;

        // CPM (Characters Per Minute): 분당 타수 (획수 기준)
        const cpm = Math.round(this.correctStrokeCount / elapsedMinutes);

        // WPM (Words Per Minute): 일반적으로 5타(strokes)를 1단어로 환산
        const wpm = Math.round(cpm / 5);

        // 입력 정확도 (%)
        const accuracy = Math.min(100, Math.round((this.successfulHits / this.totalAttempts) * 100));

        return {
            cpm: cpm,
            wpm: wpm,
            accuracy: accuracy
        };
    }

    /**
     * 특정 입력창 포커스 처리
     * @param {number} playerIndex - 0부터 시작하는 인덱스
     */
    focusInput(playerIndex = 0) {
        if (this.inputElements[playerIndex]) {
            this.inputElements[playerIndex].focus();
        }
    }

    /**
     * 타수 통계 리셋
     */
    resetStats() {
        this.startTime = null;
        this.totalStrokeCount = 0;
        this.correctStrokeCount = 0;
        this.totalAttempts = 0;
        this.successfulHits = 0;
    }
}
/**
 * InputManager.js
 * word-typing-defense — 플레이어 타자 입력창 바인딩, 한글(IME) 관리 및 타깃팅 연산
 */
class InputManager {
    constructor() {
        this.inputs = [];
        this.onEnterCallback = null;
        this.isComposing = false; // 한글 조합 중 Enter 중복 이벤트 방지
    }

    /**
     * DOM 입력창 요소들과 Enter 콜백 함수 바인딩
     * @param {Array<HTMLElement>|NodeList|HTMLElement} inputElements 
     * @param {Function} callback - (playerIdx, text) => void
     */
    bindInputs(inputElements, callback) {
        this.onEnterCallback = callback;
        this.inputs = [];

        if (!inputElements) return;

        // 전달받은 요소를 배열 형태로 정규화
        if (Array.isArray(inputElements)) {
            this.inputs = inputElements;
        } else if (inputElements instanceof NodeList || inputElements instanceof HTMLCollection) {
            this.inputs = Array.from(inputElements);
        } else if (inputElements instanceof HTMLElement) {
            this.inputs = [inputElements];
        }

        // 유효한 input 요소만 필터링
        this.inputs = this.inputs.filter(el => el && el.tagName === 'INPUT');

        // 각 입력창에 이벤트 리스너 등록
        this.inputs.forEach((input, index) => {
            // IME(한글/일어 등) 입력 상태 감지
            input.addEventListener('compositionstart', () => {
                this.isComposing = true;
            });

            input.addEventListener('compositionend', () => {
                this.isComposing = false;
            });

            // Keydown 이벤트
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    // 한글 조합 도중 Enter 누름으로 인한 2중 제출 방지
                    if (this.isComposing || e.isComposing) return;

                    const text = input.value ? input.value.trim() : '';
                    // HTML input의 data-player 속성값 사용 (없으면 index 기본값)
                    const playerIdx = input.dataset.player !== undefined
                        ? parseInt(input.dataset.player)
                        : index;

                    if (text && typeof this.onEnterCallback === 'function') {
                        // game.js 규격에 맞춰 (playerIdx, text) 순서로 전달
                        this.onEnterCallback(playerIdx, text);
                        input.value = ''; // 제출 후 입력창 초기화
                    }
                }
            });
        });
    }

    /**
     * 🎯 [계획서 v2.0 필수] 바닥 우선 스마트 타깃팅 유틸리티
     * 일치하는 단어를 가진 몬스터 중 기지와 가장 가까운(Y좌표가 가장 바닥 쪽인) 몬스터 선별
     * @param {Array} monsterList - 현재 화면에 존재하는 몬스터 배열
     * @param {string} inputText - 플레이어가 입력한 단어
     * @returns {Object|null} 가장 우선순위가 높은 몬스터 객체
     */
    findClosestTarget(monsterList, inputText) {
        if (!Array.isArray(monsterList) || !inputText) return null;

        // 1. 입력된 단어와 제시어가 일치하는 몬스터 필터링
        // (MonsterManager가 생성하는 몬스터 객체는 제시어를 `.text` 필드에 저장한다)
        const matchedMonsters = monsterList.filter(m => m && m.text === inputText);

        if (matchedMonsters.length === 0) return null;

        // 2. Y좌표가 가장 큰 (화면 바닥/기지에 가장 가까운) 몬스터 우선 선택
        matchedMonsters.sort((a, b) => (b.y || 0) - (a.y || 0));

        return matchedMonsters[0];
    }

    // 구버전 및 서브모듈 호환용 메서드
    setupInputs(inputElements, callback) {
        this.bindInputs(inputElements, callback);
    }

    /**
     * 특정 플레이어 입력창에 포커스
     */
    focus(index = 0) {
        if (this.inputs && this.inputs[index]) {
            this.inputs[index].focus();
        }
    }

    /**
     * 모든 입력창 초기화
     */
    clearAll() {
        if (Array.isArray(this.inputs)) {
            this.inputs.forEach(input => {
                if (input) input.value = '';
            });
        }
    }
}

// 전역 window 등록
if (typeof window !== 'undefined') {
    window.InputManager = InputManager;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = InputManager;
}
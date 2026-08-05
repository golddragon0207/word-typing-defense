/**
 * ==========================================
 * Word Typing Defense - InputManager
 * ==========================================
 * 하단 타자 입력창 관리, 한글 조합(IME) 상태 감지,
 * 엔터키(Enter) 입력 및 타수(CPM/WPM) 연산을 전담합니다.
 */

class InputManager {
    constructor() {
        this.inputs = [];
    }

    /**
     * game.js에서 호출하는 표준 바인딩 메서드
     * @param {NodeList|Array<HTMLInputElement>} inputElements 
     * @param {Function} onSubmitCallback - 엔터 입력 시 실행될 콜백 (playerIdx, text)
     */
    bindInputs(inputElements, onSubmitCallback) {
        this.inputs = inputElements;

        this.inputs.forEach(input => {
            input.onkeydown = null;

            input.addEventListener('keydown', (e) => {
                // 한글 조합(IME) 중복 Enter 입력 방지 (!e.isComposing)
                if (e.key === 'Enter' && !e.isComposing) {
                    e.preventDefault();

                    const text = input.value.trim();
                    const playerIdx = parseInt(input.dataset.player || 0);

                    if (text.length > 0) {
                        if (typeof onSubmitCallback === 'function') {
                            onSubmitCallback(playerIdx, text);
                        }
                        input.value = '';
                    }
                }
            });
        });
    }

    /**
     * 기존 호환용 메서드 (setupInputs 호출 시에도 동일하게 작동)
     */
    setupInputs(inputs, callback) {
        this.bindInputs(inputs, callback);
    }

    /**
     * 첫 번째 입력창에 포커스 부여
     */
    focusFirst() {
        if (this.inputs && this.inputs.length > 0) {
            this.inputs[0].focus();
        }
    }
}
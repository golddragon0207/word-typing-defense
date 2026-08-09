/**
 * ============================================================
 * GameEngine UI 파트 — 🍞 토스트 알림 & 🌌 배경 스타필드 (js/ui/fx.js)
 *   GameEngine.prototype에 UX 연출 메서드를 부착한다(부분 클래스).
 *   game.js가 클래스를 정의한 뒤 로드되어야 한다.
 * ============================================================
 */
(function () {
  if (typeof GameEngine === 'undefined') {
    console.error('[ui/fx] GameEngine이 정의되기 전에 로드되었습니다. index.html의 스크립트 순서를 확인하세요.');
    return;
  }
  const P = GameEngine.prototype;

  /* ==========================================================
   * 🍞 TOAST 알림 시스템 (연동 성공/실패, 저장 완료 등 UX 피드백)
   * ========================================================== */
  P.initToastSystem = function () {
    if (document.getElementById('toast-container')) return;
    const container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);

    // chatIntegration.js 등 다른 모듈에서 호출할 수 있도록 전역에 노출
    window.showToast = (message, type = 'info') => this.showToastInternal(message, type);
  };

  P.showToastInternal = function (message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  };

  /* ==========================================================
   * 🌌 배경 파티클(스타필드) 연출 — #bg-canvas
   * ========================================================== */
  P.startBackgroundStarfield = function () {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    this.bgCanvas = canvas;
    this.bgCtx = canvas.getContext('2d');
    this.resizeBgCanvas();

    this.bgStars = Array.from({ length: 90 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.6 + 0.4,
      speed: Math.random() * 0.15 + 0.03,
      hue: Math.random() > 0.5 ? '0, 243, 255' : '191, 0, 255'
    }));

    const loop = () => {
      this.renderBackgroundStarfield();
      this.bgAnimId = requestAnimationFrame(loop);
    };
    this.bgAnimId = requestAnimationFrame(loop);
  };

  P.resizeBgCanvas = function () {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    // 표시 크기(무대 scale 반영) × DPR 로 백버퍼를 잡아 어떤 배율에서도 선명하게
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round((rect.width || 1024) * dpr));
    canvas.height = Math.max(1, Math.round((rect.height || 708) * dpr));
  };

  P.renderBackgroundStarfield = function () {
    if (!this.bgCtx || !this.bgCanvas) return;
    const ctx = this.bgCtx;
    const w = this.bgCanvas.width;
    const h = this.bgCanvas.height;

    ctx.clearRect(0, 0, w, h);

    this.bgStars.forEach(star => {
      star.y += star.speed * 0.002;
      if (star.y > 1) star.y = 0;

      const px = star.x * w;
      const py = star.y * h;
      ctx.beginPath();
      ctx.fillStyle = `rgba(${star.hue}, 0.55)`;
      ctx.arc(px, py, star.r, 0, Math.PI * 2);
      ctx.fill();
    });
  };
})();

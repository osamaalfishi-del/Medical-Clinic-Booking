// ui.js - small UI toolkit: toasts and modal helpers (for admin editing + notifications)
const UI = (function(){
  // create toast container if missing
  let container;
  function _ensureContainer(){
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      container.setAttribute('aria-live','polite');
      document.body.appendChild(container);
    }
  }

  function showToast(message, type = 'info', timeout = 4500) {
    _ensureContainer();
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.setAttribute('role','status');
    t.innerHTML = `<div class="msg">${escapeHtml(String(message))}</div><div class="close" aria-label="close">&times;</div>`;
    const close = t.querySelector('.close');
    close.addEventListener('click', () => {
      container.removeChild(t);
    });
    container.appendChild(t);
    // auto dismiss
    if (timeout > 0) {
      setTimeout(() => {
        if (t.parentElement) container.removeChild(t);
      }, timeout);
    }
    return t;
  }

  // basic modal builder (reusable)
  function createModal({title = '', html = '', onSubmit = null, submitText = 'حفظ', cancelText = 'إلغاء'}) {
    // backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.tabIndex = -1;
    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <h3>${escapeHtml(title)}</h3>
        <div class="modal-body">${html}</div>
        <div class="modal-actions">
          <button class="small-btn modal-cancel">${escapeHtml(cancelText)}</button>
          <button class="small-btn modal-submit" style="background:${getComputedStyle(document.documentElement).getPropertyValue('--secondary') || '#3498db'}; color:#fff">${escapeHtml(submitText)}</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);

    const modalEl = backdrop.querySelector('.modal');
    const btnCancel = backdrop.querySelector('.modal-cancel');
    const btnSubmit = backdrop.querySelector('.modal-submit');

    function close() {
      if (backdrop.parentElement) backdrop.parentElement.removeChild(backdrop);
    }

    btnCancel.addEventListener('click', (e) => { e.preventDefault(); close(); });
    btnSubmit.addEventListener('click', async (e) => {
      e.preventDefault();
      if (typeof onSubmit === 'function') {
        try {
          await onSubmit(modalEl, {close});
        } catch (err) {
          showToast(err?.message || 'خطأ غير معروف', 'error');
        }
      } else {
        close();
      }
    });

    // close on backdrop click outside modal
    backdrop.addEventListener('click', (ev) => {
      if (ev.target === backdrop) close();
    });

    // trap focus - simple
    setTimeout(() => {
      const focusable = backdrop.querySelector('input,select,textarea,button');
      if (focusable) focusable.focus();
    }, 40);

    return {backdrop, close, element: modalEl};
  }

  // small html escape
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }

  return {
    showToast,
    createModal,
    escapeHtml
  };
})();
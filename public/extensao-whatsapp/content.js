// ============================================================================
// CR TASK - EXTENSÃO AUTO-LEGENDA + 2ª IMAGEM WHATSAPP WEB v1.3.0 (MAIN WORLD)
// ============================================================================

(function () {
  const isWhatsApp = window.location.hostname.includes('whatsapp.com');
  const IMG2_HEADER = '__CRTASK_IMG2_HEADER__';

  function showExtToast(msg, bg = '#4f46e5') {
    try {
      const existing = document.getElementById('crtask-ext-toast');
      if (existing) existing.remove();

      const div = document.createElement('div');
      div.id = 'crtask-ext-toast';
      div.textContent = msg;
      Object.assign(div.style, {
        position: 'fixed',
        top: '18px',
        right: '18px',
        zIndex: '2147483647',
        background: bg,
        color: '#ffffff',
        padding: '10px 16px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: '700',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
        pointerEvents: 'none',
        transition: 'opacity 0.3s ease'
      });
      document.body.appendChild(div);
      setTimeout(() => {
        div.style.opacity = '0';
        setTimeout(() => div.remove(), 300);
      }, 3200);
    } catch (e) {}
  }

  function cleanCaptionHeader(raw) {
    if (!raw || typeof raw !== 'string') return '';
    if (raw.startsWith(IMG2_HEADER)) {
      return raw.slice(IMG2_HEADER.length).trim();
    }
    return raw.trim();
  }

  function sendBundleToBridge(text, image2) {
    const clean = cleanCaptionHeader(text);
    const cleanImg2 = typeof image2 === 'string' ? image2.trim() : '';
    try {
      window.postMessage(
        {
          source: 'CRTASK_EXT_MAIN',
          type: 'SAVE_CAPTION',
          text: clean,
          image2: cleanImg2
        },
        '*'
      );
      if (clean || cleanImg2) {
        const preview = clean.length > 26 ? clean.slice(0, 26) + '...' : clean;
        const suffix = cleanImg2 ? ' (+ 2ª Imagem)' : '';
        showExtToast(`⚡ Auto-Legenda pronta: "${preview}"${suffix}`, '#059669');
      }
    } catch (e) {}
  }

  // --------------------------------------------------------------------------
  // PARTE 1: Roda dentro do CR Task
  // --------------------------------------------------------------------------
  if (!isWhatsApp) {
    window.addEventListener('crtask-copy-whatsapp', (event) => {
      try {
        const detail = (event && event.detail) || {};
        const txt = cleanCaptionHeader(detail.text || '');
        const img2 = detail.image2 || '';
        sendBundleToBridge(txt, img2);
      } catch (e) {}
    });
    return;
  }

  // --------------------------------------------------------------------------
  // PARTE 2: Roda dentro do WhatsApp Web (Main World)
  // --------------------------------------------------------------------------
  let cachedCaption = '';
  let cachedImage2 = '';
  let cachedTime = 0;

  window.addEventListener('message', (event) => {
    if (!event.data || event.data.source !== 'CRTASK_EXT_BRIDGE') return;
    if (event.data.type === 'SYNC_CAPTION') {
      cachedCaption = event.data.text || '';
      cachedImage2 = event.data.image2 || '';
      cachedTime = event.data.time || 0;
    }
  });

  function getSavedBundle() {
    const domCaption =
      (document.documentElement &&
        document.documentElement.getAttribute('data-crtask-caption')) ||
      '';
    const domImage2 =
      (document.documentElement &&
        document.documentElement.getAttribute('data-crtask-image2')) ||
      '';
    const domTime = Number(
      (document.documentElement &&
        document.documentElement.getAttribute('data-crtask-time')) ||
        0
    );

    const text = cleanCaptionHeader(domCaption || cachedCaption || '');
    const image2 = (domImage2 || cachedImage2 || '').trim();
    const time = domTime || cachedTime || 0;

    if ((text || image2) && (!time || Date.now() - time < 30 * 60 * 1000)) {
      return { text, image2 };
    }
    return { text: '', image2: '' };
  }

  function hasEditorContent(editor) {
    const raw = (editor.innerText || editor.textContent || '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim();
    return raw.length > 0;
  }

  function focusEditorProperly(editor) {
    try {
      editor.focus();
      const targetNode = editor.querySelector('p') || editor;
      const sel = window.getSelection();
      if (sel) {
        const range = document.createRange();
        range.selectNodeContents(targetNode);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } catch (e) {}
  }

  function insertIntoLexical(editor, text) {
    if (!editor || !text) return false;
    if (hasEditorContent(editor)) return true;

    focusEditorProperly(editor);

    try {
      document.execCommand('insertText', false, text);
    } catch (e) {}

    if (!hasEditorContent(editor)) {
      try {
        focusEditorProperly(editor);
        const beforeEvt = new InputEvent('beforeinput', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: text
        });
        editor.dispatchEvent(beforeEvt);
      } catch (e) {}
    }

    if (!hasEditorContent(editor)) {
      try {
        focusEditorProperly(editor);
        const dt = new DataTransfer();
        dt.setData('text/plain', text);
        const pasteEvt = new ClipboardEvent('paste', {
          clipboardData: dt,
          bubbles: true,
          cancelable: true,
          composed: true
        });
        Object.defineProperty(pasteEvt, '_crtaskSynthetic', { value: true });
        editor.dispatchEvent(pasteEvt);
      } catch (e) {}
    }

    return hasEditorContent(editor);
  }

  async function dispatchSyntheticSecondImagePaste(dataUrl) {
    if (!dataUrl) return;
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `crtask_img2_${Date.now()}.png`, { type: 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(file);

      const pasteEvt = new ClipboardEvent('paste', {
        clipboardData: dt,
        bubbles: true,
        cancelable: true,
        composed: true
      });
      Object.defineProperty(pasteEvt, '_crtaskSynthetic', { value: true });

      const target = document.activeElement || document.body || document;
      target.dispatchEvent(pasteEvt);
    } catch (e) {
      console.warn('[CR Task Ext] Falha ao anexar 2ª imagem:', e);
    }
  }

  function findNewMediaCaptionEditor(existingEditors) {
    const allEditors = Array.from(
      document.querySelectorAll('div[contenteditable="true"]')
    );

    const newlyMounted = allEditors.find(
      (el) => !existingEditors.has(el) && el.offsetParent !== null
    );
    if (newlyMounted) return newlyMounted;

    const active = document.activeElement;
    if (
      active &&
      active.getAttribute &&
      active.getAttribute('contenteditable') === 'true' &&
      !existingEditors.has(active)
    ) {
      return active;
    }

    return null;
  }

  function waitForCaptionBoxAndInsert(text, image2, existingEditors) {
    let attempts = 0;
    const maxAttempts = 60;
    let secondImageDispatched = false;

    showExtToast('⚡ CR Task: Preparando legenda' + (image2 ? ' + 2ª imagem...' : '...'), '#4f46e5');

    const interval = setInterval(() => {
      attempts++;
      const captionEditor = findNewMediaCaptionEditor(existingEditors);

      if (captionEditor) {
        clearInterval(interval);

        if (text) {
          [220, 500].forEach((delay) => {
            setTimeout(() => {
              const target = findNewMediaCaptionEditor(existingEditors) || captionEditor;
              if (target && !hasEditorContent(target)) {
                insertIntoLexical(target, text);
              }
            }, delay);
          });
        }

        if (image2 && !secondImageDispatched) {
          secondImageDispatched = true;
          setTimeout(() => {
            dispatchSyntheticSecondImagePaste(image2);
            showExtToast('✅ CR Task: 1ª Imagem + Texto + 2ª Imagem prontos!', '#059669');
          }, text ? 650 : 300);
        } else if (text) {
          setTimeout(() => {
            showExtToast('✅ CR Task: Legenda inserida automaticamente!', '#059669');
          }, 550);
        }
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }, 80);
  }

  window.addEventListener(
    'paste',
    (e) => {
      if (e._crtaskSynthetic) return;

      const cb = e.clipboardData;
      if (!cb) return;

      const items = Array.from(cb.items || []);
      const files = Array.from(cb.files || []);
      const hasImage =
        items.some((item) => item.kind === 'file' && item.type && item.type.startsWith('image/')) ||
        files.some((f) => f.type && f.type.startsWith('image/'));

      if (!hasImage) return;

      const directText = cleanCaptionHeader(cb.getData('text/plain') || '');

      const existingEditors = new Set(
        document.querySelectorAll('div[contenteditable="true"]')
      );

      window.postMessage({ source: 'CRTASK_EXT_MAIN', type: 'REQUEST_SYNC' }, '*');

      setTimeout(() => {
        const saved = getSavedBundle();
        const textToUse = directText || saved.text;
        const image2ToUse = saved.image2;

        if (textToUse || image2ToUse) {
          waitForCaptionBoxAndInsert(textToUse, image2ToUse, existingEditors);
        }
      }, 30);
    },
    true
  );
})();

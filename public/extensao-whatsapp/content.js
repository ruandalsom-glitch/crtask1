// ============================================================================
// CR TASK - EXTENSÃO AUTO-LEGENDA WHATSAPP WEB v1.2.0 (MAIN WORLD)
// ============================================================================

(function () {
  const isWhatsApp = window.location.hostname.includes('whatsapp.com');

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

  function findModalTextOnCRTask() {
    try {
      const textarea = document.querySelector('textarea');
      if (textarea && textarea.value && textarea.value.trim()) {
        return textarea.value.trim();
      }
      const monoP = document.querySelector('p.font-mono');
      if (monoP && monoP.textContent && monoP.textContent.trim()) {
        return monoP.textContent.trim();
      }
    } catch (e) {}
    return '';
  }

  function sendCaptionToBridge(text) {
    const clean = (text || '').trim();
    if (!clean) return;
    try {
      window.postMessage(
        {
          source: 'CRTASK_EXT_MAIN',
          type: 'SAVE_CAPTION',
          text: clean
        },
        '*'
      );
      const preview = clean.length > 30 ? clean.slice(0, 30) + '...' : clean;
      showExtToast(`⚡ Auto-Legenda pronta: "${preview}"`, '#059669');
    } catch (e) {}
  }

  // --------------------------------------------------------------------------
  // PARTE 1: Roda dentro do CR Task
  // --------------------------------------------------------------------------
  if (!isWhatsApp) {
    window.addEventListener('crtask-copy-whatsapp', (event) => {
      try {
        const detail = (event && event.detail) || {};
        const txt = (detail.text || '').trim() || findModalTextOnCRTask();
        if (txt) {
          sendCaptionToBridge(txt);
        }
      } catch (e) {}
    });

    if (navigator.clipboard) {
      const origWriteText = navigator.clipboard.writeText.bind(navigator.clipboard);
      navigator.clipboard.writeText = async function (text) {
        if (typeof text === 'string' && text.trim() && !text.startsWith('http')) {
          sendCaptionToBridge(text.trim());
        }
        return origWriteText(text);
      };

      if (navigator.clipboard.write) {
        const origWrite = navigator.clipboard.write.bind(navigator.clipboard);
        navigator.clipboard.write = async function (items) {
          try {
            let captured = '';
            if (Array.isArray(items) && items[0] && items[0].types) {
              if (items[0].types.includes('text/plain')) {
                const blob = await items[0].getType('text/plain');
                captured = (await blob.text()).trim();
              }
            }
            if (!captured) {
              captured = findModalTextOnCRTask();
            }
            if (captured) {
              sendCaptionToBridge(captured);
            }
          } catch (e) {}
          return origWrite(items);
        };
      }
    }
    return;
  }

  // --------------------------------------------------------------------------
  // PARTE 2: Roda dentro do WhatsApp Web (Main World)
  // --------------------------------------------------------------------------
  let cachedCaption = '';
  let cachedTime = 0;

  window.addEventListener('message', (event) => {
    if (!event.data || event.data.source !== 'CRTASK_EXT_BRIDGE') return;
    if (event.data.type === 'SYNC_CAPTION') {
      cachedCaption = event.data.text || '';
      cachedTime = event.data.time || 0;
    }
  });

  function getSavedCaption() {
    const domCaption =
      (document.documentElement &&
        document.documentElement.getAttribute('data-crtask-caption')) ||
      '';
    const domTime = Number(
      (document.documentElement &&
        document.documentElement.getAttribute('data-crtask-time')) ||
        0
    );

    const text = (domCaption || cachedCaption || '').trim();
    const time = domTime || cachedTime || 0;

    if (text && (!time || Date.now() - time < 30 * 60 * 1000)) {
      return text;
    }
    return '';
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

    // Método 1: execCommand('insertText') - dispara beforeinput nativo do Chrome para o Lexical
    try {
      document.execCommand('insertText', false, text);
    } catch (e) {}

    // Método 2: InputEvent('beforeinput')
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

    // Método 3: ClipboardEvent('paste')
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

  // Encontra APENAS o novo campo de legenda que abriu no modal da imagem
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

  function waitForCaptionBoxAndInsert(text, existingEditors) {
    let attempts = 0;
    const maxAttempts = 60; // até ~4.8 segundos esperando o modal da imagem abrir

    showExtToast('⚡ CR Task: Aguardando tela da imagem para colar legenda...', '#4f46e5');

    const interval = setInterval(() => {
      attempts++;
      const captionEditor = findNewMediaCaptionEditor(existingEditors);

      if (captionEditor) {
        clearInterval(interval);

        [250, 550, 950].forEach((delay) => {
          setTimeout(() => {
            const target = findNewMediaCaptionEditor(existingEditors) || captionEditor;
            if (target && !hasEditorContent(target)) {
              const ok = insertIntoLexical(target, text);
              if (ok) {
                showExtToast('✅ CR Task: Legenda inserida automaticamente!', '#059669');
              }
            }
          }, delay);
        });
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

      const existingEditors = new Set(
        document.querySelectorAll('div[contenteditable="true"]')
      );

      window.postMessage({ source: 'CRTASK_EXT_MAIN', type: 'REQUEST_SYNC' }, '*');

      setTimeout(() => {
        const directText = (cb.getData('text/plain') || '').trim();
        const textToUse = directText || getSavedCaption();

        if (textToUse) {
          waitForCaptionBoxAndInsert(textToUse, existingEditors);
        } else {
          showExtToast('⚠️ CR Task: Nenhuma legenda salva. Copie a mensagem no CR Task primeiro.', '#d97706');
        }
      }, 30);
    },
    true // Capture phase
  );
})();

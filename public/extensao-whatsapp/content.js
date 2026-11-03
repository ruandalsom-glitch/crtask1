// ============================================================================
// CR TASK - EXTENSÃO AUTO-LEGENDA WHATSAPP WEB (MAIN WORLD)
// Intercepta a cópia no CR Task e injeta o texto direto no editor Lexical
// do WhatsApp Web quando o usuário aperta Ctrl+V com uma imagem!
// ============================================================================

(function () {
  const isWhatsApp = window.location.hostname.includes('whatsapp.com');

  function sendCaptionToBridge(text) {
    try {
      window.postMessage(
        {
          source: 'CRTASK_EXT_MAIN',
          type: 'SAVE_CAPTION',
          text: text || ''
        },
        '*'
      );
    } catch (e) {}
  }

  // --------------------------------------------------------------------------
  // PARTE 1: Roda dentro do CR Task (captura o texto copiado automaticamente)
  // --------------------------------------------------------------------------
  if (!isWhatsApp) {
    // 1. Escuta evento customizado disparado pelo CR Task
    window.addEventListener('crtask-copy-whatsapp', (event) => {
      try {
        const detail = (event && event.detail) || {};
        if (typeof detail.text === 'string') {
          sendCaptionToBridge(detail.text.trim());
        }
      } catch (e) {}
    });

    // 2. Intercepta navigator.clipboard.writeText e navigator.clipboard.write
    // (Funciona imediatamente mesmo sem precisar atualizar o deploy do site)
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
            if (Array.isArray(items) && items[0] && items[0].types) {
              if (items[0].types.includes('text/plain')) {
                const blob = await items[0].getType('text/plain');
                const txt = await blob.text();
                if (txt && txt.trim()) {
                  sendCaptionToBridge(txt.trim());
                }
              }
            }
          } catch (e) {}
          return origWrite(items);
        };
      }
    }
    return;
  }

  // --------------------------------------------------------------------------
  // PARTE 2: Roda dentro do WhatsApp Web (Main World - mesmo contexto do Lexical)
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

    // Válido por 20 minutos após copiar no CR Task
    if (text && Date.now() - time < 20 * 60 * 1000) {
      return text;
    }
    return '';
  }

  function placeCaretAtEnd(el) {
    try {
      el.focus();
      const sel = window.getSelection();
      if (sel) {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } catch (e) {}
  }

  function hasEditorContent(editor) {
    const raw = (editor.innerText || editor.textContent || '').replace(/\u200B/g, '').trim();
    return raw.length > 0;
  }

  function tryInsertIntoLexical(editor, text) {
    if (!editor || !text) return;
    if (hasEditorContent(editor)) return; // Já foi preenchido

    placeCaretAtEnd(editor);

    // Tentativa 1: Dispara ClipboardEvent('paste') nativo no Main World para o Lexical
    try {
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

    // Tentativa 2: Verifica após 100ms se entrou; se não, usa execCommand('insertText')
    setTimeout(() => {
      if (!hasEditorContent(editor)) {
        placeCaretAtEnd(editor);
        document.execCommand('insertText', false, text);
        editor.dispatchEvent(
          new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            inputType: 'insertText',
            data: text
          })
        );
      }
    }, 100);
  }

  function findMediaCaptionEditor(existingEditors) {
    const allEditors = Array.from(
      document.querySelectorAll('div[contenteditable="true"]')
    );

    // 1. Procura um contenteditable novo que apareceu após o Ctrl+V
    const newlyMounted = allEditors.find(
      (el) => !existingEditors.has(el) && el.offsetParent !== null
    );
    if (newlyMounted) return newlyMounted;

    // 2. Procura qualquer contenteditable visível fora da barra lateral (#side) e fora do footer principal (#main footer)
    return allEditors.find((el) => {
      const inSide = el.closest('#side');
      const inMainFooter = el.closest('#main footer');
      return !inSide && !inMainFooter && el.offsetParent !== null;
    });
  }

  function waitForCaptionBoxAndInsert(text, existingEditors) {
    let attempts = 0;
    const maxAttempts = 50; // ~4 segundos

    const interval = setInterval(() => {
      attempts++;
      const captionEditor = findMediaCaptionEditor(existingEditors);

      if (captionEditor) {
        clearInterval(interval);
        // Dispara em 220ms e faz uma checagem de segurança em 500ms (caso a animação do modal do WhatsApp demore)
        setTimeout(() => tryInsertIntoLexical(captionEditor, text), 220);
        setTimeout(() => {
          const freshEditor = findMediaCaptionEditor(existingEditors) || captionEditor;
          tryInsertIntoLexical(freshEditor, text);
        }, 550);
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

      const directText = (cb.getData('text/plain') || '').trim();
      const textToUse = directText || getSavedCaption();

      if (textToUse) {
        waitForCaptionBoxAndInsert(textToUse, existingEditors);
      }
    },
    true // Capture phase
  );
})();

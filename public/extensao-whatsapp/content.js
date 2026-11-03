// ============================================================================
// CR TASK - EXTENSÃO AUTO-LEGENDA WHATSAPP WEB
// Ponte automática: Ao copiar Imagem + Texto no CR Task e apertar Ctrl+V
// no WhatsApp Web, cola a imagem e preenche o texto na legenda automaticamente!
// ============================================================================

(function () {
  const isWhatsApp = window.location.hostname.includes('whatsapp.com');

  // --------------------------------------------------------------------------
  // PARTE 1: Roda dentro do CR Task (captura o texto copiado com 100% precisão)
  // --------------------------------------------------------------------------
  if (!isWhatsApp) {
    window.addEventListener('crtask-copy-whatsapp', (event) => {
      try {
        const detail = event.detail || {};
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({
            crtask_pending_caption: detail.text || '',
            crtask_caption_time: Date.now()
          });
        }
      } catch (err) {
        console.warn('[CR Task Ext] Erro ao salvar legenda:', err);
      }
    });
    return;
  }

  // --------------------------------------------------------------------------
  // PARTE 2: Roda dentro do WhatsApp Web (escuta o Ctrl+V de imagem)
  // --------------------------------------------------------------------------
  function insertCaptionIntoEditor(editor, text) {
    if (!editor || !text) return false;
    try {
      editor.focus();

      // Tentativa 1: Evento Paste sintético apenas com texto puro (preserva quebras de linha no Lexical)
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

      // Verifica após 80ms se o editor absorveu o texto; se estiver vazio, usa execCommand('insertText')
      setTimeout(() => {
        const currentText = (editor.innerText || editor.textContent || '').trim();
        if (!currentText) {
          editor.focus();
          document.execCommand('insertText', false, text);
        }
      }, 80);

      return true;
    } catch (e) {
      console.warn('[CR Task Ext] Falha ao inserir legenda:', e);
      return false;
    }
  }

  function waitForCaptionBoxAndInsert(text, existingEditors) {
    let attempts = 0;
    const maxAttempts = 50; // ~4 segundos

    const interval = setInterval(() => {
      attempts++;

      // Busca todos os campos editáveis visíveis na tela
      const allEditors = Array.from(
        document.querySelectorAll('div[contenteditable="true"]')
      );

      // O campo de legenda do modal de mídia é um contenteditable novo (que não existia antes do Ctrl+V)
      // ou que está fora do rodapé principal (#main footer) e fora da barra lateral (#side)
      let captionEditor = allEditors.find(
        (el) => !existingEditors.has(el) && el.offsetParent !== null
      );

      if (!captionEditor) {
        captionEditor = allEditors.find((el) => {
          const isInsideMainFooter = el.closest('#main footer');
          const isInsideSideSearch = el.closest('#side');
          return !isInsideMainFooter && !isInsideSideSearch && el.offsetParent !== null;
        });
      }

      if (captionEditor) {
        clearInterval(interval);
        // Aguarda 180ms para o editor Lexical do modal terminar de inicializar o foco
        setTimeout(() => {
          insertCaptionIntoEditor(captionEditor, text);
        }, 180);
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }, 80);
  }

  window.addEventListener(
    'paste',
    (e) => {
      // Ignora o próprio evento sintético de texto disparado pela extensão
      if (e._crtaskSynthetic) return;

      const cb = e.clipboardData;
      if (!cb) return;

      // Verifica se o Ctrl+V contém uma imagem
      const items = Array.from(cb.items || []);
      const hasImage = items.some(
        (item) => item.kind === 'file' && item.type && item.type.startsWith('image/')
      );

      if (!hasImage) return;

      // Captura quais editores já existiam antes do modal de imagem abrir
      const existingEditors = new Set(
        document.querySelectorAll('div[contenteditable="true"]')
      );

      // 1º tenta ler o texto diretamente do próprio ClipboardItem (text/plain)
      const directText = (cb.getData('text/plain') || '').trim();
      if (directText) {
        waitForCaptionBoxAndInsert(directText, existingEditors);
        return;
      }

      // 2º Fallback: lê do chrome.storage.local (salvo quando clicou em Copiar no CR Task)
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(
          ['crtask_pending_caption', 'crtask_caption_time'],
          (res) => {
            const savedText = (res && res.crtask_pending_caption ? res.crtask_pending_caption : '').trim();
            const savedTime = res && res.crtask_caption_time ? res.crtask_caption_time : 0;
            // Válido por 15 minutos após clicar em Copiar no CR Task
            if (savedText && Date.now() - savedTime < 15 * 60 * 1000) {
              waitForCaptionBoxAndInsert(savedText, existingEditors);
            }
          }
        );
      }
    },
    true // Capture phase: intercepta antes do WhatsApp Web parar a propagação
  );
})();

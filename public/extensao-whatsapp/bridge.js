// ============================================================================
// CR TASK - PONTE DE ARMAZENAMENTO (ISOLATED WORLD) v1.3.0
// Sincroniza a legenda e a 2ª imagem entre a aba do CR Task e a aba do WhatsApp Web
// ============================================================================

(function () {
  const isWhatsApp = window.location.hostname.includes('whatsapp.com');

  function syncToDOM(text, image2, time) {
    try {
      if (document.documentElement) {
        document.documentElement.setAttribute('data-crtask-caption', text || '');
        document.documentElement.setAttribute('data-crtask-image2', image2 || '');
        document.documentElement.setAttribute('data-crtask-time', String(time || 0));
      }
      window.postMessage(
        {
          source: 'CRTASK_EXT_BRIDGE',
          type: 'SYNC_CAPTION',
          text: text || '',
          image2: image2 || '',
          time: time || 0
        },
        '*'
      );
    } catch (e) {}
  }

  function loadFromStorage() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(
        ['crtask_pending_caption', 'crtask_pending_image2', 'crtask_caption_time'],
        (res) => {
          if (res) {
            syncToDOM(
              res.crtask_pending_caption || '',
              res.crtask_pending_image2 || '',
              res.crtask_caption_time || 0
            );
          }
        }
      );
    }
  }

  // Escuta mensagens do MAIN world
  window.addEventListener('message', (event) => {
    if (!event.data || event.data.source !== 'CRTASK_EXT_MAIN') return;

    if (event.data.type === 'SAVE_CAPTION') {
      const text = event.data.text || '';
      const image2 = event.data.image2 || '';
      const now = Date.now();
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({
          crtask_pending_caption: text,
          crtask_pending_image2: image2,
          crtask_caption_time: now
        });
      }
    } else if (event.data.type === 'REQUEST_SYNC') {
      loadFromStorage();
    }
  });

  if (isWhatsApp) {
    loadFromStorage();
    document.addEventListener('DOMContentLoaded', loadFromStorage);
    window.addEventListener('focus', loadFromStorage);
    window.addEventListener('visibilitychange', loadFromStorage);

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes) => {
        if (
          changes.crtask_pending_caption ||
          changes.crtask_pending_image2 ||
          changes.crtask_caption_time
        ) {
          loadFromStorage();
        }
      });
    }
  }
})();

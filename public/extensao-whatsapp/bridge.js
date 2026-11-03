// ============================================================================
// CR TASK - PONTE DE ARMAZENAMENTO (ISOLATED WORLD) v1.2.0
// Sincroniza a legenda entre a aba do CR Task e a aba do WhatsApp Web
// ============================================================================

(function () {
  const isWhatsApp = window.location.hostname.includes('whatsapp.com');

  function syncToDOM(text, time) {
    try {
      if (document.documentElement) {
        document.documentElement.setAttribute('data-crtask-caption', text || '');
        document.documentElement.setAttribute('data-crtask-time', String(time || 0));
      }
      window.postMessage(
        {
          source: 'CRTASK_EXT_BRIDGE',
          type: 'SYNC_CAPTION',
          text: text || '',
          time: time || 0
        },
        '*'
      );
    } catch (e) {}
  }

  function loadFromStorage() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['crtask_pending_caption', 'crtask_caption_time'], (res) => {
        if (res) {
          syncToDOM(res.crtask_pending_caption || '', res.crtask_caption_time || 0);
        }
      });
    }
  }

  // Escuta mensagens do MAIN world
  window.addEventListener('message', (event) => {
    if (!event.data || event.data.source !== 'CRTASK_EXT_MAIN') return;

    if (event.data.type === 'SAVE_CAPTION') {
      const text = event.data.text || '';
      const now = Date.now();
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({
          crtask_pending_caption: text,
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
    document.addEventListener('visibilitychange', loadFromStorage);

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes) => {
        if (changes.crtask_pending_caption || changes.crtask_caption_time) {
          loadFromStorage();
        }
      });
    }
  }
})();

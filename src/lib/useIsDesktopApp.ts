'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'crtask_is_desktop_app';

/**
 * Detecta se a página está rodando dentro do App Desktop (PC).
 *
 * O App Desktop abre o site em uma janela "--app" do Chrome/Edge com um perfil
 * próprio (user-data-dir isolado), então:
 *  - `?desktop=1` na URL marca o perfil como desktop (persistido no localStorage desse perfil);
 *  - janelas "--app" não têm barra de ferramentas (`window.toolbar.visible === false`);
 *  - PWAs/janelas de app respondem a `display-mode: standalone`.
 */
export function detectDesktopApp(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('desktop') === '1') {
      localStorage.setItem(STORAGE_KEY, '1');
      return true;
    }
    if (localStorage.getItem(STORAGE_KEY) === '1') return true;
  } catch {}

  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  if (window.matchMedia?.('(display-mode: minimal-ui)').matches) return true;

  // Janelas "--app" do Chromium não possuem barra de ferramentas/endereço.
  // Abas normais e janelas em F11 continuam com toolbar.visible === true.
  if (window.toolbar && window.toolbar.visible === false && !window.opener) return true;

  return false;
}

export function useIsDesktopApp(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    setIsDesktop(detectDesktopApp());
  }, []);
  return isDesktop;
}

'use client';

import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'crtask_is_desktop_app';
const VERSION_STORAGE_KEY = 'crtask_desktop_version';
const DISMISSED_VERSION_STORAGE_KEY = 'crtask_dismissed_desktop_notice_version';

export const LATEST_DESKTOP_APP_VERSION = '2.1.0';
export const DESKTOP_APP_RELEASE_TITLE = 'Nova versão v2.1 disponível!';
export const DESKTOP_APP_RELEASE_SUMMARY = 'Envio Multi-Grupo no WhatsApp + proteção total de Ctrl+C/V.';

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
      const urlVer = params.get('v');
      if (urlVer) {
        localStorage.setItem(VERSION_STORAGE_KEY, urlVer);
      }
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

export function detectInstalledDesktopVersion(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const urlVer = params.get('v');
    if (params.get('desktop') === '1' && urlVer) {
      localStorage.setItem(VERSION_STORAGE_KEY, urlVer);
      return urlVer;
    }
    return localStorage.getItem(VERSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function useIsDesktopApp(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    setIsDesktop(detectDesktopApp());
  }, []);
  return isDesktop;
}

export function useDesktopAppStatus() {
  const [status, setStatus] = useState({
    isDesktopApp: false,
    installedVersion: null as string | null,
    needsUpdate: false,
    isNoticeDismissed: false,
    mounted: false
  });

  useEffect(() => {
    const isDesktop = detectDesktopApp();
    const installedVer = detectInstalledDesktopVersion();
    let dismissedVer: string | null = null;
    try {
      dismissedVer = localStorage.getItem(DISMISSED_VERSION_STORAGE_KEY);
    } catch {}

    // No App Desktop, se não tiver a versão mais recente (incluindo executáveis antigos sem v=), sinaliza atualização
    const needsUpdate = isDesktop && installedVer !== LATEST_DESKTOP_APP_VERSION;
    const isNoticeDismissed = dismissedVer === LATEST_DESKTOP_APP_VERSION;

    setStatus({
      isDesktopApp: isDesktop,
      installedVersion: installedVer,
      needsUpdate,
      isNoticeDismissed,
      mounted: true
    });
  }, []);

  const dismissNotice = useCallback(() => {
    try {
      localStorage.setItem(DISMISSED_VERSION_STORAGE_KEY, LATEST_DESKTOP_APP_VERSION);
    } catch {}
    setStatus(prev => ({ ...prev, isNoticeDismissed: true }));
  }, []);

  return {
    ...status,
    latestVersion: LATEST_DESKTOP_APP_VERSION,
    releaseTitle: DESKTOP_APP_RELEASE_TITLE,
    releaseSummary: DESKTOP_APP_RELEASE_SUMMARY,
    dismissNotice
  };
}

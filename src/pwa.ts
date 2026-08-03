// ==========================================================================
// PWA まわり（インストール導線・更新の通知）をまとめた場所。
// ==========================================================================
import { useCallback, useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

declare global {
  interface Window {
    __deferredInstallPrompt: (Event & { prompt: () => Promise<void> }) | null;
  }
}

/** ホーム画面から「アプリとして」起動しているか */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari だけ独自のフラグを持っている
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iPhone / iPad か（beforeinstallprompt が存在しないので手順を案内する必要がある） */
export function isIos(): boolean {
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13 以降は Mac を名乗るので、タッチの有無で見分ける
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/**
 * インストールボタンの出し分け。
 * - Chrome 系: beforeinstallprompt を受け取れたら出す（実際に出せる時だけ）
 * - iOS Safari: 合図が来ないので、代わりに「ホーム画面に追加」の手順を出す
 * - すでにアプリとして起動中: 出さない
 */
export function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState(() => window.__deferredInstallPrompt !== null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const onInstallable = () => setCanInstall(true);
    const onInstalled = () => {
      setCanInstall(false);
      setInstalled(true);
    };
    window.addEventListener('pwa-installable', onInstallable);
    window.addEventListener('pwa-installed', onInstalled);
    return () => {
      window.removeEventListener('pwa-installable', onInstallable);
      window.removeEventListener('pwa-installed', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    const deferred = window.__deferredInstallPrompt;
    if (!deferred) return;
    await deferred.prompt();
    // 合図は一度しか使えない。断られた場合は次の機会まで出さない。
    window.__deferredInstallPrompt = null;
    setCanInstall(false);
  }, []);

  const showIosGuide = !installed && !canInstall && isIos();

  return { canInstall: canInstall && !installed, installed, install, showIosGuide };
}

/**
 * Service Worker の登録と、新しい版が届いたときの通知。
 *
 * 黙って差し替える（autoUpdate）のはやめている。授業のとちゅうで
 * 表示が変わると児童が混乱するため、「あたらしい バージョンが あります」と
 * 出して、押されたときだけ切り替える。
 */
export function useServiceWorkerUpdate() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [applyUpdate, setApplyUpdate] = useState<(() => void) | null>(null);

  useEffect(() => {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        // setState に関数を渡すと「更新関数」と解釈されるので、包んで渡す
        setApplyUpdate(() => () => updateSW(true));
        setNeedRefresh(true);
      },
    });
  }, []);

  return { needRefresh, applyUpdate, dismiss: () => setNeedRefresh(false) };
}

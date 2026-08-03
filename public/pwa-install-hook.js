/*
 * インストールの合図を「いちばん先に」受け取るための、ごく小さなスクリプト。
 *
 * Chrome は条件が揃うと即座に beforeinstallprompt を出す。React や CSS の
 * 読み込みより後ろに置くと、通信が遅い端末ではこの合図を取りこぼし、
 * 「インストール」ボタンが永久に出てこなくなる。だから <head> の最初に、
 * 同期スクリプトとして読む。
 *
 * インラインではなく外部ファイルにしているのは、CSP（script-src 'self'）を
 * ハッシュ管理なしで成立させるため。<head> の先頭にある同期スクリプトなので、
 * 実行の早さはインラインと変わらない。
 */
(function () {
  window.__deferredInstallPrompt = null;

  window.addEventListener('beforeinstallprompt', function (e) {
    // 既定のミニバナーを止め、アプリ内の自前ボタンから出せるように取っておく
    e.preventDefault();
    window.__deferredInstallPrompt = e;
    window.dispatchEvent(new Event('pwa-installable'));
  });

  window.addEventListener('appinstalled', function () {
    window.__deferredInstallPrompt = null;
    window.dispatchEvent(new Event('pwa-installed'));
  });
})();

// F7（配信物が外部オリジンへ通信しない）の判定のテスト。
//
// この検査は一度、og:url / og:image に自分自身のアドレスを書いただけで赤くなり、
// deploy が push:main でしか走らないため PR は緑のまま main で落ちて、
// 本番が2コミット分止まった（2026-08-21〜22）。
// 「取りに行かないものを数えない」ことと「取りに行くものは見のがさない」ことの
// 両方をここで固定する。
import { describe, it, expect } from 'vitest';
import { externalHosts, hostOf } from '../scripts/lib/external-origins.mjs';

const html = (text: string) => [{ path: 'index.html', text }];

describe('取りに行かないものは数えない', () => {
  it('og:url / og:image は SNS のクローラが読むもので、端末は取りに行かない', () => {
    expect(externalHosts(html(`
      <meta property="og:url" content="https://werewolf.giga-school.com/">
      <meta property="og:image" content="https://giga-school.com/assets/og.png">
    `))).toEqual([]);
  });

  it('rel=canonical は検索エンジンへの申告であって読み込みではない', () => {
    expect(externalHosts(html(
      '<link rel="canonical" href="https://werewolf.giga-school.com/">'
    ))).toEqual([]);
  });

  it('<a href> は利用者が押したときの遷移。塞がれてもアプリは壊れない', () => {
    expect(externalHosts(html(
      '<a href="https://giga-school.com/">GIGA山</a>'
    ))).toEqual([]);
  });

  it('相対パスは自分のオリジン', () => {
    expect(externalHosts(html(
      '<script type="module" src="/assets/index-abc123.js"></script>'
    ))).toEqual([]);
  });

  it('data: URI は外部ではない', () => {
    expect(externalHosts(html('<img src="data:image/svg+xml;base64,AAAA">'))).toEqual([]);
  });
});

describe('取りに行くものは見のがさない', () => {
  it('外部の script は拾う（塞がれるとアプリが動かない）', () => {
    expect(externalHosts(html(
      '<script src="https://cdn.jsdelivr.net/npm/x/y.js"></script>'
    ))).toEqual(['cdn.jsdelivr.net']);
  });

  it('外部のスタイルシートは拾う', () => {
    expect(externalHosts(html(
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=X">'
    ))).toEqual(['fonts.googleapis.com']);
  });

  it('preload / modulepreload も読み込み', () => {
    expect(externalHosts(html(
      '<link rel="modulepreload" href="https://esm.sh/react">'
    ))).toEqual(['esm.sh']);
  });

  it('画像・srcset も拾う', () => {
    expect(externalHosts(html(
      '<img src="/a.png" srcset="https://img.example.net/a@2x.png 2x">'
    ))).toEqual(['img.example.net']);
  });

  it('iframe も拾う', () => {
    expect(externalHosts(html(
      '<iframe src="https://www.youtube.com/embed/x"></iframe>'
    ))).toEqual(['www.youtube.com']);
  });

  it('プロトコル相対 // も拾う', () => {
    expect(externalHosts(html('<script src="//cdn.example.org/x.js"></script>')))
      .toEqual(['cdn.example.org']);
  });

  it('インライン script の fetch も拾う', () => {
    expect(externalHosts(html(
      '<script>fetch("https://api.example.com/v1")</script>'
    ))).toEqual(['api.example.com']);
  });

  it('CSS の url() と @import も拾う', () => {
    expect(externalHosts([{
      path: 'src/index.css',
      text: '@import "https://fonts.example.com/a.css"; a{background:url(https://cdn.example.jp/b.png)}',
    }])).toEqual(['cdn.example.jp', 'fonts.example.com']);
  });

  it('自ドメインでも「読み込み」なら拾う（フィルタは塞ぎうる）', () => {
    // ここが og:image との違い。同じアドレスでも、取りに行くなら報告する
    expect(externalHosts(html(
      '<script src="https://giga-school.com/shared.js"></script>'
    ))).toEqual(['giga-school.com']);
  });
});

describe('hostOf', () => {
  it('絶対URLからホストを取り、相対には null', () => {
    expect(hostOf('https://a.example.com/x')).toBe('a.example.com');
    expect(hostOf('//b.example.com/x')).toBe('b.example.com');
    expect(hostOf('/x/y.png')).toBeNull();
    expect(hostOf('./y.png')).toBeNull();
  });
});

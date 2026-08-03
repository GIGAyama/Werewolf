// ==========================================================================
// アプリの設定（音・うごき・提示モード）の保存。
//
// 保存先は localStorage の werewolf.settings.v1 ひとつだけ。
// gigayama.github.io は複数のアプリで同じドメインを共有しているので、
// 必ずアプリ名の接頭辞を付ける。localStorage.clear() は絶対に呼ばない
// （他のアプリの学習記録 study.records.v1 まで消してしまうため）。
// ==========================================================================
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'werewolf.settings.v1';

export interface Settings {
  /** 音声ガイドと効果音を止める */
  muted: boolean;
  /** 背景アニメーションなどのうごきを減らす（感覚過敏への配慮） */
  reduceMotion: boolean;
}

const DEFAULTS: Settings = {
  muted: false,
  // OS 側で「視差効果を減らす」が入っていれば、初めからそれに合わせる
  reduceMotion:
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      muted: typeof parsed.muted === 'boolean' ? parsed.muted : DEFAULTS.muted,
      reduceMotion:
        typeof parsed.reduceMotion === 'boolean' ? parsed.reduceMotion : DEFAULTS.reduceMotion,
    };
  } catch {
    // プライベートブラウズや容量超過で読めないことがある。
    // 設定が無いだけでゲームは遊べるので、既定値で続行する。
    return { ...DEFAULTS };
  }
}

function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // 保存に失敗しても、その回のプレイには影響しないので黙って続行する
  }
}

/** 設定を読み書きし、うごきの設定は <html> のクラスへ反映する */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', settings.reduceMotion);
  }, [settings.reduceMotion]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  return { settings, update };
}

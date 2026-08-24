import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  User, Skull, Eye, Search, Shield, VenetianMask, Play, RotateCcw,
  Moon, Sun, Vote, Users, MessageCircle, X, Sparkles, Volume2, VolumeX,
  Download, Maximize2, Minimize2, Zap, ZapOff, RefreshCw, Share,
} from 'lucide-react';
import { useSettings } from './settings';
import { useInstallPrompt, useServiceWorkerUpdate } from './pwa';
// ゲームの中核ロジックは、テストできるように src/game.ts へ切り出してある
import {
  ROLE_CONFIGS, createInitialState, checkForWinner,
  type Role, type Player, type GameState,
} from './game';

// ==========================================
// 1. 音声・SEマネージャー
// ==========================================
class AudioManager {
  static ctx: AudioContext | null = null;
  static isMuted: boolean = false;

  static init() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) this.ctx = new AudioContextClass();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  static toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    return this.isMuted;
  }

  static playSE(type: 'click' | 'night' | 'morning' | 'alert') {
    if (this.isMuted || !this.ctx) return;
    try {
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;

      if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'night') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(80, now + 1.0);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0, now + 1.5);
        osc.start(now);
        osc.stop(now + 1.5);
      } else if (type === 'morning') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.15);
        osc.frequency.setValueAtTime(783.99, now + 0.3);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.1);
        gain.gain.setValueAtTime(0.15, now + 0.3);
        gain.gain.linearRampToValueAtTime(0, now + 1.5);
        osc.start(now);
        osc.stop(now + 1.5);
      } else if (type === 'alert') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.setValueAtTime(600, now + 0.1);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch (e) {
      console.warn('Audio play failed', e);
    }
  }

  static speak(text: string) {
    if (this.isMuted) return;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const msg = new SpeechSynthesisUtterance(text);
      msg.lang = 'ja-JP';
      msg.rate = 1.15; // テンポよく
      window.speechSynthesis.speak(msg);
    }
  }
}

// ==========================================
// 3. UI部品（ルビ振り、ボタンなど）
// ==========================================

// ふりがな。<rp> は、ルビに対応していない環境で「漢字(かんじ)」と括弧付きで
// 出すための代替であると同時に、読み上げソフトが本文とルビを続けて
// 「じんろうじんろう」と二重に読むのを防ぐ目印にもなる。CSS で隠している。
const R = ({ t, r }: { t: string; r: string }) => (
  <ruby>
    {t}
    <rp>(</rp>
    <rt>{r}</rt>
    <rp>)</rp>
  </ruby>
);

const ROLE_DETAILS: Record<Role, { icon: React.FC<any>; desc: React.ReactNode; color: string; ruby: string; bg: string }> = {
  '村人': {
    icon: User, ruby: 'むらびと',
    desc: <><R t="特別" r="とくべつ" />な<R t="能力" r="のうりょく" />はありません。<R t="誰" r="だれ" />が<R t="人狼" r="じんろう" />か、みんなと<R t="相談" r="そうだん" />して<R t="見" r="み" />つけだしてください。</>,
    color: 'text-cyan-400', bg: 'bg-cyan-900/40 border-cyan-500',
  },
  '人狼': {
    icon: Skull, ruby: 'じんろう',
    desc: <><R t="村人" r="むらびと" />に<R t="正体" r="しょうたい" />がバレないように、<R t="毎晩" r="まいばん" />ひとりずつ<R t="村人" r="むらびと" />を<R t="襲撃" r="しゅうげき" />します。</>,
    color: 'text-rose-500', bg: 'bg-rose-900/40 border-rose-500',
  },
  '占い師': {
    icon: Eye, ruby: 'うらないし',
    desc: <><R t="毎晩" r="まいばん" />、<R t="誰" r="だれ" />か１<R t="人" r="ひとり" />を<R t="占" r="うらな" />って、その<R t="人" r="ひと" />が「<R t="人狼" r="じんろう" />」かを知ることができます。</>,
    color: 'text-purple-400', bg: 'bg-purple-900/40 border-purple-500',
  },
  '霊能者': {
    icon: Search, ruby: 'れいのうしゃ',
    desc: <><R t="昼" r="ひる" />に<R t="追放" r="ついほう" />された<R t="人" r="ひと" />が、「<R t="人狼" r="じんろう" />」だったかを<R t="知" r="し" />ることができます。</>,
    color: 'text-blue-400', bg: 'bg-blue-900/40 border-blue-500',
  },
  '狩人': {
    icon: Shield, ruby: 'かりうど',
    desc: <><R t="毎晩" r="まいばん" />、<R t="誰" r="だれ" />か１<R t="人" r="ひとり" />を<R t="人狼" r="じんろう" />の<R t="襲撃" r="しゅうげき" />から<R t="守" r="まも" />ることができます。</>,
    color: 'text-emerald-400', bg: 'bg-emerald-900/40 border-emerald-500',
  },
  '狂人': {
    icon: VenetianMask, ruby: 'きょうじん',
    desc: <><R t="人狼" r="じんろう" />の<R t="味方" r="みかた" />です。<R t="占" r="うらな" />われても「<R t="人狼" r="じんろう" />ではない」と<R t="出" r="で" />ます。<R t="人狼" r="じんろう" />が<R t="勝" r="か" />つように、<R t="嘘" r="うそ" />をついてまどわせましょう。</>,
    color: 'text-amber-400', bg: 'bg-amber-900/40 border-amber-500',
  },
};

// --- レイアウト部品 ---
function ScreenLayout({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="glass-panel w-full max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto flex flex-col flex-grow animate-fade-in-up mt-2 mb-4">
      {title && (
        <div className="bg-white/5 p-5 border-b border-white/10 shrink-0 rounded-t-[32px]">
          <h2 className="text-3xl font-bold text-center title-text tracking-wide">{title}</h2>
        </div>
      )}
      <div className="p-5 sm:p-6 md:p-8 flex-grow flex flex-col text-center">
        {children}
      </div>
    </div>
  );
}

function Button({ children, onClick, className = '', icon, variant = 'primary', disabled = false }: { children: React.ReactNode; onClick: () => void; className?: string; icon?: React.ReactNode; variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; disabled?: boolean }) {
  const variants = {
    primary: 'btn-3d-primary',
    secondary: 'btn-3d-secondary',
    danger: 'btn-3d-danger',
    ghost: 'btn-3d-ghost',
  };
  const handleClick = () => {
    AudioManager.init();
    if (!disabled) AudioManager.playSE('click');
    onClick();
  };
  return (
    // px-3 → sm:px-8: 320px 幅の端末では、3列に並べたボタンの左右余白が
    // 大きすぎて中身がセルからはみ出していた（body が overflow:hidden なので
    // スクロールもできず文字が欠ける）。狭い画面では余白を詰める。
    <button onClick={handleClick} disabled={disabled} className={`btn-3d-base py-4 px-3 sm:py-5 sm:px-8 text-2xl w-full min-w-0 shrink-0 ${variants[variant]} ${className}`}>
      {icon && <span className="scale-125 drop-shadow-md shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}

/** ヘッダーの丸いアイコンボタン（44px 以上を絶対値で確保する） */
function IconButton({ onClick, label, active = false, children }: { onClick: () => void; label: string; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={() => { AudioManager.init(); AudioManager.playSE('click'); onClick(); }}
      aria-label={label}
      aria-pressed={active}
      // min-w/h を rem ではなく px で指定するのは、ルート 14px の 320px 端末でも
      // 低学年の指の下限 44px を必ず満たすため（w-12 = 3rem だと 42px になる）。
      className={`flex justify-center items-center min-w-[44px] min-h-[44px] w-11 h-11 rounded-full border transition-colors shadow-inner shrink-0 ${
        active
          ? 'bg-yellow-400 border-yellow-200 text-yellow-950'
          : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
      }`}
    >
      {children}
    </button>
  );
}

// --- ヘッダー / フッター ---
interface HeaderProps {
  onOpenModal: () => void;
  isDayTime?: boolean | null;
  isMuted: boolean;
  toggleMute: () => void;
  reduceMotion: boolean;
  toggleReduceMotion: () => void;
  /** 提示モードを出してよい画面か（役職確認・夜の行動では出さない） */
  canPresent: boolean;
  presentation: boolean;
  togglePresentation: () => void;
  canInstall: boolean;
  onInstall: () => void;
}

function Header({
  onOpenModal, isDayTime, isMuted, toggleMute, reduceMotion, toggleReduceMotion,
  canPresent, presentation, togglePresentation, canInstall, onInstall,
}: HeaderProps) {
  return (
    <header className="safe-top flex justify-between items-center gap-2 px-3 sm:px-5 py-4 bg-gray-900/95 backdrop-blur-md border-b border-white/10 shrink-0 shadow-lg sticky top-0 z-20">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <IconButton onClick={toggleMute} label={isMuted ? '音を出す' : '音を消す'} active={false}>
          {isMuted ? <VolumeX className="w-6 h-6 text-gray-300" /> : <Volume2 className="w-6 h-6 text-blue-300" />}
        </IconButton>
        <IconButton onClick={toggleReduceMotion} label={reduceMotion ? 'うごきをもどす' : 'うごきをへらす'} active={reduceMotion}>
          {reduceMotion ? <ZapOff className="w-6 h-6" /> : <Zap className="w-6 h-6 text-yellow-300" />}
        </IconButton>
        <h1 className="text-3xl font-bold text-white tracking-wider items-center gap-2 drop-shadow-md hidden md:flex whitespace-nowrap">
          <span className="title-red"><R t="人狼" r="じんろう" /></span>ゲーム
          {isDayTime ? (
            <Sun className="w-8 h-8 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]" fill="currentColor" />
          ) : (
            <Moon className="w-8 h-8 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]" fill="currentColor" />
          )}
        </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {canInstall && (
          <IconButton onClick={onInstall} label="アプリとしてインストールする">
            <Download className="w-6 h-6 text-emerald-300" />
          </IconButton>
        )}
        {canPresent && (
          <IconButton onClick={togglePresentation} label={presentation ? 'ふつうの大きさにもどす' : '大きく表示する（提示モード）'} active={presentation}>
            {presentation ? <Minimize2 className="w-6 h-6" /> : <Maximize2 className="w-6 h-6" />}
          </IconButton>
        )}
        <button
          onClick={() => { AudioManager.init(); AudioManager.playSE('click'); onOpenModal(); }}
          className="flex justify-center items-center min-w-[44px] min-h-[44px] w-11 h-11 bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900 rounded-full font-black text-3xl shadow-[0_4px_0_#b45309,0_4px_10px_rgba(0,0,0,0.5)] active:translate-y-1 active:shadow-[0_0px_0_#b45309] transition-all shrink-0"
          aria-label="あそびかた"
        >
          ？
        </button>
      </div>
    </header>
  );
}

function Footer() {
  return (
    // text-white/50 では背景に対して約 3.9:1 でコントラスト不足だったため /75 に上げた
    <footer className="safe-bottom text-center text-white/75 py-4 border-t border-white/10 bg-gray-900/80 backdrop-blur-md shrink-0 relative z-10">
      <small className="text-sm font-bold flex items-center justify-center gap-1 tracking-wider">
        © 2026 人狼ゲーム
        <a href="https://giga-school.com" target="_blank" rel="noopener noreferrer" className="no-underline text-white hover:text-yellow-300 underline-offset-4 hover:underline transition-colors ml-1">
          GIGA山
        </a>
        <a href="https://giga-school.com/apps/werewolf/" target="_blank" rel="noopener noreferrer" className="no-underline text-white hover:text-yellow-300 underline-offset-4 hover:underline transition-colors ml-2">
          使い方を読む
        </a>
      </small>
    </footer>
  );
}

/** 新しい版が届いたことを知らせる帯。押されるまで勝手には切り替えない。 */
function UpdateToast({ onApply, onDismiss }: { onApply: () => void; onDismiss: () => void }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 -translate-x-1/2 bottom-[calc(5rem+var(--safe-b))] z-[60] w-[min(92vw,32rem)] glass-panel border-2 border-yellow-400/60 p-4 flex items-center gap-3 animate-fade-in-up"
    >
      <RefreshCw className="w-8 h-8 text-yellow-300 shrink-0" />
      <p className="text-lg font-bold text-left flex-grow leading-snug">
        あたらしい バージョンが あります
      </p>
      <button
        onClick={onApply}
        className="btn-3d-base btn-3d-secondary px-4 py-2 text-lg shrink-0"
      >
        さいしんに する
      </button>
      <button onClick={onDismiss} aria-label="とじる" className="min-w-[44px] min-h-[44px] flex items-center justify-center text-white/80 hover:text-white shrink-0">
        <X className="w-6 h-6" />
      </button>
    </div>
  );
}

// --- あそびかたモーダル ---
function HowToPlayModal({ onClose, showIosGuide }: { onClose: () => void; showIosGuide: boolean }) {
  const steps = [
    {
      icon: <Users className="w-10 h-10 text-cyan-400" />,
      title: <><R t="役職" r="やくしょく" />の<R t="確認" r="かくにん" /></>,
      desc: <>じゅんばんにタブレットをまわして、じぶんの<R t="役職" r="やくしょく" />（むらびと、じんろうなど）を<R t="確認" r="かくにん" />します。ほかの<R t="人" r="ひと" />には<R t="見" r="み" />せないでね！</>,
    },
    {
      icon: <MessageCircle className="w-10 h-10 text-yellow-400" />,
      title: <><R t="昼" r="ひる" />の<R t="話" r="はな" />し<R t="合" r="あ" />い</>,
      desc: <>だれが<R t="人狼" r="じんろう" />か、みんなで<R t="話" r="はな" />し<R t="合" r="あ" />って<R t="推理" r="すいり" />します。<R t="人狼" r="じんろう" />はウソをついて、みんなをだましましょう！</>,
    },
    {
      icon: <Vote className="w-10 h-10 text-rose-400" />,
      title: <><R t="投票" r="とうひょう" /></>,
      desc: <><R t="話" r="はな" />し<R t="合" r="あ" />いが<R t="終" r="お" />わったら、<R t="人狼" r="じんろう" />だと<R t="思" r="おも" />う<R t="人" r="ひと" />を1<R t="人" r="ひとり" /><R t="選" r="えら" />んで<R t="追放" r="ついほう" />します。</>,
    },
    {
      icon: <Moon className="w-10 h-10 text-indigo-400" fill="currentColor" />,
      title: <><R t="夜" r="よる" />の<R t="行動" r="こうどう" /></>,
      desc: <><R t="人狼" r="じんろう" />は<R t="村人" r="むらびと" />を<R t="襲撃" r="しゅうげき" />し、<R t="占" r="うらな" />い<R t="師" r="し" />は<R t="誰" r="だれ" />かを<R t="占" r="うらな" />うなど、<R t="特別" r="とくべつ" />な<R t="力" r="ちから" />を<R t="使" r="つか" />います。</>,
    },
    {
      icon: <Sparkles className="w-10 h-10 text-amber-400" fill="currentColor" />,
      title: <><R t="決着" r="けっちゃく" />がつくまで！</>,
      desc: <><R t="人狼" r="じんろう" />をぜんいん<R t="追放" r="ついほう" />するか、<R t="人狼" r="じんろう" />の<R t="数" r="かず" />が<R t="村人" r="むらびと" />と<R t="同" r="おな" />じになればゲーム<R t="終了" r="しゅうりょう" />！</>,
    },
  ];

  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // モーダルを開いているあいだは、Esc で閉じられて、Tab がモーダルの外へ
  // 抜けないようにする（キーボードだけで操作する人が迷子にならないため）。
  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-md" onClick={onClose}>
      <div
        ref={dialogRef}
        className="glass-panel w-full max-w-2xl max-h-[90dvh] flex flex-col border-[3px] border-yellow-400/50 shadow-[0_0_50px_rgba(250,204,21,0.2)] overflow-hidden animate-fade-in-up rounded-[32px]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="あそびかた"
      >
        <div className="bg-white/10 border-b border-white/20 p-5 flex justify-between items-center gap-3 shrink-0">
          <h2 className="text-3xl font-bold title-text flex items-center gap-3 drop-shadow-lg min-w-0">
            <span className="bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900 rounded-full w-10 h-10 flex items-center justify-center text-2xl shadow-inner shrink-0">？</span>
            あそびかた
          </h2>
          <button
            ref={closeRef}
            onClick={() => { AudioManager.playSE('click'); onClose(); }}
            className="min-w-[44px] min-h-[44px] w-11 h-11 bg-white/10 hover:bg-rose-500/80 rounded-full flex items-center justify-center text-white font-bold transition-all shadow-md border border-white/20 shrink-0"
            aria-label="とじる"
          >
            <X className="w-8 h-8" />
          </button>
        </div>

        <div className="p-5 md:p-8 overflow-y-auto scroll-area flex-grow space-y-5">
          {steps.map((step, index) => (
            <div key={index} className="flex gap-5 bg-black/40 p-5 rounded-2xl items-start border border-white/10 shadow-inner">
              <div className="shrink-0 bg-white/5 p-4 rounded-2xl border border-white/10 shadow-[0_4px_15px_rgba(0,0,0,0.5)]">
                {step.icon}
              </div>
              <div className="text-left flex-grow pt-1 min-w-0">
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2 tracking-wide">
                  <span className="text-yellow-400 text-2xl font-black">{index + 1}.</span> {step.title}
                </h3>
                <p className="text-gray-200 font-bold leading-relaxed text-lg">{step.desc}</p>
              </div>
            </div>
          ))}

          {showIosGuide && <IosInstallGuide />}

          <Button onClick={onClose} variant="primary" className="mt-6">
            わかった！
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * iPhone / iPad 向けの「ホーム画面に追加」案内。
 * iOS Safari には beforeinstallprompt が無く、ボタン一発で入れる方法が存在しない。
 * さらに ITP により、7日間使わないと保存データが消される。ホーム画面に追加して
 * もらうことがそのまま対策になるので、手順を画面の中で案内する。
 */
function IosInstallGuide() {
  return (
    <div className="bg-emerald-950/60 border-2 border-emerald-400/60 p-5 rounded-2xl text-left shadow-inner">
      <h3 className="text-xl font-bold text-emerald-200 mb-3 flex items-center gap-2">
        <Download className="w-6 h-6 shrink-0" />
        アプリとして<R t="入" r="い" />れておくと<R t="便利" r="べんり" />です
      </h3>
      <ol className="text-gray-100 font-bold leading-relaxed text-lg space-y-2 list-decimal list-inside">
        <li>
          <R t="画面" r="がめん" />の<R t="下" r="した" />（または<R t="上" r="うえ" />）にある
          <Share className="w-5 h-5 inline-block mx-1 align-text-bottom text-blue-300" aria-label="共有ボタン" />
          <R t="共有" r="きょうゆう" />ボタンを<R t="押" r="お" />す
        </li>
        <li>メニューを<R t="下" r="した" />にスクロールする</li>
        <li>「ホーム<R t="画面" r="がめん" />に<R t="追加" r="ついか" />」を<R t="選" r="えら" />ぶ</li>
      </ol>
      <p className="text-emerald-200/90 font-bold mt-3 text-base">
        ※こうしておくと、<R t="全画面" r="ぜんがめん" />で<R t="遊" r="あそ" />べて、つながっていなくても<R t="開" r="ひら" />けます。
      </p>
    </div>
  );
}

// ==========================================
// 4. メインアプリケーション
// ==========================================

export default function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { settings, update: updateSettings } = useSettings();
  const [isMuted, setIsMuted] = useState(settings.muted);
  const [presentation, setPresentation] = useState(false);
  const { canInstall, install, showIosGuide } = useInstallPrompt();
  const { needRefresh, applyUpdate, dismiss } = useServiceWorkerUpdate();

  const isDayTime = gameState && ['day', 'vote', 'voteResult'].includes(gameState.phase);

  // 「役職の確認」と「夜の行動」は、ひとりだけがのぞき込む画面。
  // ここで提示モード（文字を大きくする）を効かせると、となりの席から
  // 役職が見えてしまいゲームが壊れるので、この2画面では出さない・効かせない。
  const isSecretPhase = gameState?.phase === 'roleCheck' || gameState?.phase === 'night';
  const presentationActive = presentation && !isSecretPhase;

  // 起動時に一度だけ、保存してある音の設定を AudioManager へ反映する
  useEffect(() => {
    AudioManager.isMuted = settings.muted;
    setIsMuted(settings.muted);
    // 初期化時のみ。以降はボタン操作から双方向に更新する。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMute = useCallback(() => {
    const next = AudioManager.toggleMute();
    setIsMuted(next);
    updateSettings({ muted: next });
  }, [updateSettings]);

  const togglePresentation = useCallback(() => {
    setPresentation((prev) => {
      const next = !prev;
      // 電子黒板に映すときは、ブラウザの枠を消したほうが大きく見える。
      // フルスクリーンは端末やブラウザによって拒否されることがあるので、
      // 失敗しても提示モード自体は成立させる（catch して無視）。
      if (next) document.documentElement.requestFullscreen?.().catch(() => {});
      else if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      return next;
    });
  }, []);

  const updateState = (updater: (draft: GameState) => void | Partial<GameState>) => {
    setGameState((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      const result = updater(next);
      return result ? { ...next, ...result } : next;
    });
  };

  const renderPhase = () => {
    if (!gameState || gameState.phase === 'setup') {
      return <SetupPhase onStart={(count, names, roles) => setGameState(createInitialState(count, names, roles))} />;
    }
    if (gameState.phase === 'roleCheck') {
      const player = gameState.players[gameState.currentTurnPlayerIndex];
      const handleNext = () => {
        const isMorningNext = gameState.currentTurnPlayerIndex + 1 >= gameState.playerCount;
        if (isMorningNext) {
          AudioManager.playSE('morning');
          AudioManager.speak(`${gameState.day}にちめの、昼になりました。話し合いを始めてください。`);
        }
        updateState((draft) => {
          draft.currentTurnPlayerIndex++;
          if (draft.currentTurnPlayerIndex >= draft.playerCount) {
            draft.phase = 'day';
            draft.gameMessage = <>{draft.day}<R t="日目" r="にちめ" />の<R t="昼" r="ひる" />になりました。</>;
            draft.currentTurnPlayerIndex = 0;
          }
        });
      };
      return <RoleCheckPhase key={player.id} player={player} gameState={gameState} onNext={handleNext} />;
    }
    if (gameState.phase === 'day') {
      const handleStartVote = () => {
        AudioManager.playSE('alert');
        AudioManager.speak('話し合い終了です。順番に投票をしてください。');
        updateState((draft) => {
          draft.phase = 'vote';
          draft.players.forEach((p) => { p.votedBy = []; p.voteTo = null; });
          draft.tieBreakVote = false;
          draft.voteCandidates = [];
          draft.gameMessage = <><R t="追放" r="ついほう" />したい<R t="人" r="ひと" />を<R t="選" r="えら" />んでください。</>;
          const potentialVoters = draft.players.filter((p) => p.isAlive);
          draft.currentVoterId = potentialVoters.length > 0 ? potentialVoters[0].id : null;
        });
      };
      return <DayPhase gameState={gameState} onStartVote={handleStartVote} onShowResult={() => updateState((d) => { d.phase = 'result'; })} />;
    }
    if (gameState.phase === 'vote') {
      const handleVote = (targetId: number) => {
        updateState((draft) => {
          const voter = draft.players.find((p) => p.id === draft.currentVoterId);
          const target = draft.players.find((p) => p.id === targetId);
          if (voter && target && voter.voteTo === null) {
            voter.voteTo = targetId;
            target.votedBy.push(voter.id);
          }

          const alivePlayers = draft.players.filter((p) => p.isAlive);
          // 決選投票では、候補者本人は投票しない（残りの生存者だけが投票する）
          const potentialVoters = draft.tieBreakVote
            ? alivePlayers.filter((p) => !draft.voteCandidates.includes(p.id))
            : alivePlayers;

          const currentVoterIndex = draft.players.findIndex((p) => p.id === draft.currentVoterId);
          let nextVoterId: number | null = null;
          for (let i = 1; i <= draft.players.length; i++) {
            const nextIndex = (currentVoterIndex + i) % draft.players.length;
            const nextPlayer = draft.players[nextIndex];
            if (potentialVoters.some((v) => v.id === nextPlayer.id) && nextPlayer.voteTo === null) {
              nextVoterId = nextPlayer.id;
              break;
            }
          }

          if (nextVoterId !== null) {
            draft.currentVoterId = nextVoterId;
            return;
          }

          // 全員の投票が完了 → 集計
          let maxVotes = 0;
          let exiledCandidates: number[] = [];
          const voteTargets = draft.tieBreakVote
            ? draft.players.filter((p) => draft.voteCandidates.includes(p.id))
            : alivePlayers;

          voteTargets.forEach((p) => {
            if (p.votedBy.length > maxVotes) {
              maxVotes = p.votedBy.length;
              exiledCandidates = [p.id];
            } else if (p.votedBy.length === maxVotes && maxVotes > 0) {
              exiledCandidates.push(p.id);
            }
          });

          draft.voteResultData = alivePlayers
            .map((p) => ({ name: p.name, votes: p.votedBy.length }))
            .sort((a, b) => b.votes - a.votes);

          AudioManager.playSE('alert');

          const exileAndCheck = (exiledId: number, message: React.ReactNode, speak: (winner: string | null) => string) => {
            draft.players.find((p) => p.id === exiledId)!.isAlive = false;
            draft.exiledPlayerId = exiledId;
            draft.gameMessage = message;
            const winner = checkForWinner(draft);
            if (winner) draft.winner = winner;
            draft.phase = 'voteResult';
            AudioManager.speak(speak(winner));
          };

          if (exiledCandidates.length === 1) {
            const exiledId = exiledCandidates[0];
            const exiledName = draft.players.find((p) => p.id === exiledId)!.name;
            exileAndCheck(
              exiledId,
              <>{exiledName}さんが<R t="追放" r="ついほう" />されました。</>,
              (winner) => (winner
                ? `${exiledName}さんが追放されました。ゲーム終了、${winner}の勝利です！`
                : `${exiledName}さんが追放されました。`),
            );
          } else if (exiledCandidates.length > 1) {
            // 決選投票の対象者以外で投票できる人
            const runoffVoters = alivePlayers.filter((p) => !exiledCandidates.includes(p.id));
            // すでに決選投票中で再び同数、または投票できる人がいない → ランダム決定
            if (draft.tieBreakVote || runoffVoters.length === 0) {
              const exiledId = exiledCandidates[Math.floor(Math.random() * exiledCandidates.length)];
              const exiledName = draft.players.find((p) => p.id === exiledId)!.name;
              exileAndCheck(
                exiledId,
                <><R t="同数" r="どうすう" />だったため、ランダムで{exiledName}さんが<R t="追放" r="ついほう" />されました。</>,
                (winner) => (winner
                  ? `投票が同数でした。ランダムで${exiledName}さんが追放されました。ゲーム終了、${winner}の勝利です！`
                  : `投票が同数でした。ランダムで${exiledName}さんが追放されました。`),
              );
            } else {
              // 決選投票を開始
              draft.tieBreakVote = true;
              draft.voteCandidates = exiledCandidates;
              const names = exiledCandidates.map((id) => draft.players.find((p) => p.id === id)!.name).join('さんと');
              draft.gameMessage = <>{names}さんで<R t="決選投票" r="けっせんとうひょう" />を<R t="行" r="おこな" />います。</>;
              draft.players.forEach((p) => { p.votedBy = []; p.voteTo = null; });
              draft.currentVoterId = runoffVoters[0].id;
              draft.phase = 'vote';
              AudioManager.speak(`決選投票を行います。対象者は、${names}さんです。`);
            }
          } else {
            draft.gameMessage = <><R t="追放" r="ついほう" />される<R t="人" r="ひと" />はいませんでした。</>;
            draft.exiledPlayerId = null;
            draft.phase = 'voteResult';
            AudioManager.speak('追放される人はいませんでした。');
          }
        });
      };
      return <VotePhase gameState={gameState} onVote={handleVote} />;
    }
    if (gameState.phase === 'voteResult') {
      const handleNext = () => {
        if (gameState.winner) {
          updateState((d) => { d.phase = 'result'; });
          AudioManager.playSE('alert');
          AudioManager.speak(`ゲーム終了！ ${gameState.winner} の勝利です！`);
        } else {
          updateState((d) => {
            d.phase = 'night';
            d.currentTurnPlayerIndex = 0;
            d.guardedPlayerId = null;
            d.attackedPlayerId = null;
            d.werewolfChoiceId = null;
            d.nightActionResult = null;
          });
          AudioManager.playSE('night');
          AudioManager.speak('夜が来ました。全員、目を閉じてください。順番に夜の行動を行います。');
        }
      };
      return <VoteResultPhase gameState={gameState} onNext={handleNext} />;
    }
    if (gameState.phase === 'night') {
      const alivePlayers = gameState.players.filter((p) => p.isAlive);
      if (gameState.currentTurnPlayerIndex >= alivePlayers.length) {
        const handleMorning = () => {
          updateState((draft) => {
            let victim: Player | null = null;
            if (draft.attackedPlayerId !== null && draft.attackedPlayerId !== draft.guardedPlayerId) {
              victim = draft.players.find((p) => p.id === draft.attackedPlayerId) ?? null;
              if (victim) victim.isAlive = false;
            }
            draft.gameMessage = victim
              ? <><R t="昨夜" r="さくや" />の<R t="犠牲者" r="ぎせいしゃ" />は{victim.name}さんでした。</>
              : <><R t="昨夜" r="さくや" />は<R t="誰" r="だれ" />も<R t="襲撃" r="しゅうげき" />されませんでした。</>;
            const hunter = draft.players.find((p) => p.role === '狩人');
            if (hunter) hunter.lastGuardedId = draft.guardedPlayerId;
            const winner = checkForWinner(draft);
            if (winner) draft.winner = winner;
            draft.day++;
            draft.phase = 'day';
            draft.currentTurnPlayerIndex = 0;

            AudioManager.playSE('morning');
            if (winner) {
              AudioManager.speak(`昼になりました。昨夜の犠牲者は、${victim ? victim.name + 'さん' : '誰もいません'}でした。ゲーム終了、${winner}の勝利です！`);
            } else {
              AudioManager.speak(`昼になりました。昨夜の犠牲者は、${victim ? victim.name + 'さん' : '誰もいません'}でした。話し合いを始めてください。`);
            }
          });
        };
        return (
          <ScreenLayout title={<><R t="夜" r="よる" />が<R t="明" r="あ" />けました</>}>
            <div className="flex flex-col items-center justify-center space-y-12 my-auto">
              <div className="glow-box">
                <Sun className="w-40 h-40 text-yellow-400 drop-shadow-[0_0_20px_rgba(250,204,21,0.8)] float-icon" fill="currentColor" />
              </div>
              <p className="text-3xl font-bold tracking-wide"><R t="全員" r="ぜんいん" />の<R t="夜" r="よる" />の<R t="行動" r="こうどう" />が<R t="終" r="お" />わりました。</p>
              <Button onClick={handleMorning} variant="primary" className="mt-8"><R t="昼" r="ひる" />を<R t="迎" r="むか" />える</Button>
            </div>
          </ScreenLayout>
        );
      }

      const currentPlayer = alivePlayers[gameState.currentTurnPlayerIndex];
      const handleAction = (action: string, targetId: number | null) => {
        updateState((draft) => {
          if (action === 'fortune-tell' && targetId !== null) {
            const target = draft.players.find((p) => p.id === targetId);
            const isWolf = target?.role === '人狼';
            draft.nightActionResult = <>{target!.name}さんは{isWolf ? <strong className="text-rose-400 drop-shadow-md"><R t="人狼" r="じんろう" />です！</strong> : <span className="text-cyan-300"><R t="人狼" r="じんろう" />ではありません。</span>}</>;
          } else if (action === 'attack' && targetId !== null) {
            const livingWerewolves = draft.players.filter((p) => p.role === '人狼' && p.isAlive);
            if (livingWerewolves.length > 1 && draft.werewolfChoiceId === null) {
              draft.werewolfChoiceId = targetId;
            } else {
              draft.attackedPlayerId = targetId;
            }
            draft.currentTurnPlayerIndex++;
          } else if (action === 'guard' && targetId !== null) {
            draft.guardedPlayerId = targetId;
            draft.currentTurnPlayerIndex++;
          } else if (action === 'shaman') {
            const exiled = draft.players.find((p) => p.id === draft.exiledPlayerId);
            if (exiled) {
              draft.nightActionResult = <>{exiled.name}さんは、{exiled.role === '人狼' ? <strong className="text-rose-400 drop-shadow-md"><R t="人狼" r="じんろう" />でした！</strong> : <span className="text-cyan-300"><R t="人狼" r="じんろう" />ではありませんでした。</span>}</>;
            } else {
              draft.nightActionResult = <><R t="昨夜" r="さくや" />は<R t="追放" r="ついほう" />された<R t="人" r="ひと" />はいませんでした。</>;
            }
          } else {
            draft.currentTurnPlayerIndex++;
          }
        });
      };

      return <NightPhase key={currentPlayer.id} player={currentPlayer} gameState={gameState} onAction={handleAction} onNext={() => updateState((d) => { d.nightActionResult = null; d.currentTurnPlayerIndex++; })} />;
    }
    if (gameState.phase === 'result') {
      return (
        <ScreenLayout title={<>ゲーム<R t="終了" r="しゅうりょう" />！</>}>
          <div className="space-y-8 flex flex-col justify-center h-full">
            <div role="status" aria-live="polite" className="p-8 border-[3px] border-yellow-400/50 rounded-[32px] bg-yellow-900/30 shadow-[0_0_40px_rgba(250,204,21,0.3)] glow-box">
              <h3 className="text-4xl md:text-5xl font-black text-yellow-400 drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)] tracking-wider">
                <R t={gameState.winner!} r={gameState.winner === '村人陣営' ? 'むらびとじんえい' : 'じんろうじんえい'} />の<R t="勝利" r="しょうり" />！
              </h3>
            </div>

            <div className="bg-black/30 p-6 rounded-3xl flex-grow border border-white/10 shadow-inner">
              <h3 className="text-2xl font-bold border-b-2 border-white/20 pb-4 mb-5 tracking-widest text-blue-200"><R t="全員" r="ぜんいん" />の<R t="役職" r="やくしょく" /></h3>
              <ul className="space-y-4 text-left">
                {gameState.players.map((p) => (
                  <li key={p.id} className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/10 shadow-sm">
                    <span className="text-2xl font-bold flex items-center gap-3">
                      {!p.isAlive && <Skull className="w-7 h-7 text-rose-500 drop-shadow-md" />}
                      {/* 生死は「色」だけで伝えない。ドクロ・取り消し線・
                          読み上げ用の文字の3つで示す（色覚特性への配慮）。
                          text-white/40 はコントラスト不足だったので /65 に上げた。 */}
                      <span className={!p.isAlive ? 'line-through text-white/65' : 'text-white drop-shadow-md'}>{p.name}</span>
                      <span className="sr-only">{p.isAlive ? '（生きています）' : '（ゲームから外れました）'}</span>
                    </span>
                    <span className={`text-2xl font-black ${ROLE_DETAILS[p.role].color} drop-shadow-md`}>
                      <R t={p.role} r={ROLE_DETAILS[p.role].ruby} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <Button onClick={() => setGameState(null)} variant="primary" icon={<RotateCcw className="w-8 h-8" />} className="mt-4">
              もう<R t="一度" r="いちど" /><R t="遊" r="あそ" />ぶ
            </Button>
          </div>
        </ScreenLayout>
      );
    }
    return null;
  };

  return (
    <div className={`app-shell relative flex flex-col font-sans ${presentationActive ? 'presentation' : ''}`}>
      {/* 背景のクロスフェードアニメーション */}
      <div className={`fixed inset-0 bg-night z-[-2] transition-opacity duration-1000 ${isDayTime ? 'opacity-0' : 'opacity-100'}`} />
      <div className={`fixed inset-0 bg-day z-[-2] transition-opacity duration-1000 ${isDayTime ? 'opacity-100' : 'opacity-0'}`} />
      <div className={`stars-overlay z-[-1] transition-opacity duration-1000 ${isDayTime ? 'opacity-0' : 'opacity-100'}`} />
      <div className={`clouds-overlay z-[-1] transition-opacity duration-1000 ${isDayTime ? 'opacity-100' : 'opacity-0'}`} />

      <Header
        onOpenModal={() => setIsModalOpen(true)}
        isDayTime={isDayTime}
        isMuted={isMuted}
        toggleMute={toggleMute}
        reduceMotion={settings.reduceMotion}
        toggleReduceMotion={() => updateSettings({ reduceMotion: !settings.reduceMotion })}
        canPresent={!isSecretPhase}
        presentation={presentation}
        togglePresentation={togglePresentation}
        canInstall={canInstall}
        onInstall={install}
      />

      <main className="flex-grow p-2 sm:p-4 md:p-6 w-full flex flex-col items-center">
        {renderPhase()}
      </main>

      <Footer />

      {isModalOpen && <HowToPlayModal onClose={() => setIsModalOpen(false)} showIosGuide={showIosGuide} />}
      {needRefresh && applyUpdate && <UpdateToast onApply={applyUpdate} onDismiss={dismiss} />}
    </div>
  );
}

// ==========================================
// 5. 各画面コンポーネント
// ==========================================

function SetupPhase({ onStart }: { onStart: (count: number, names: string[], roles: Role[]) => void }) {
  const [playerCount, setPlayerCount] = useState(4);
  const [names, setNames] = useState<string[]>(Array.from({ length: 12 }, (_, i) => `プレイヤー${i + 1}`));

  const [roleCounts, setRoleCounts] = useState<Record<Role, number>>({
    '村人': 2, '人狼': 1, '占い師': 1, '霊能者': 0, '狩人': 0, '狂人': 0,
  });

  // 人数が変わった時に、デフォルトの役職構成をセットする
  useEffect(() => {
    const config = ROLE_CONFIGS[playerCount] || [];
    const counts: Record<Role, number> = {
      '村人': 0, '人狼': 0, '占い師': 0, '霊能者': 0, '狩人': 0, '狂人': 0,
    };
    config.forEach((r) => counts[r]++);
    setRoleCounts(counts);
  }, [playerCount]);

  const updateRoleCount = (role: Role, delta: number) => {
    AudioManager.playSE('click');
    setRoleCounts((prev) => ({ ...prev, [role]: Math.max(0, prev[role] + delta) }));
  };

  const totalRoles = Object.values(roleCounts).reduce((a, b) => a + b, 0);
  const isRoleCountValid = totalRoles === playerCount;

  const werewolvesCount = roleCounts['人狼'];
  const villagersCount = roleCounts['村人'] + roleCounts['占い師'] + roleCounts['霊能者'] + roleCounts['狩人'] + roleCounts['狂人'];
  const isGameBalanceValid = werewolvesCount > 0 && werewolvesCount < villagersCount;

  const canStart = isRoleCountValid && isGameBalanceValid;

  const handleStart = () => {
    if (!canStart) return;
    const rolesArray: Role[] = [];
    (Object.entries(roleCounts) as [Role, number][]).forEach(([role, count]) => {
      for (let i = 0; i < count; i++) rolesArray.push(role);
    });

    AudioManager.playSE('alert');
    AudioManager.speak('ゲームを開始します。順番に役職を確認してください。');

    onStart(playerCount, names.slice(0, playerCount), rolesArray);
  };

  return (
    <ScreenLayout title={<><span className="title-red"><R t="人狼" r="じんろう" /></span>ゲーム</>}>
      <div className="flex-grow flex flex-col space-y-6">
        <div className="bg-black/30 p-6 md:p-8 rounded-[32px] border border-white/10 text-left shrink-0 shadow-inner">
          <label className="flex items-center gap-3 text-2xl font-bold text-blue-300 mb-6 drop-shadow-md">
            <Users className="w-8 h-8" />
            <span><R t="遊" r="あそ" />ぶ<R t="人数" r="にんずう" />を<R t="選" r="えら" />んでね</span>
          </label>
          <div className="grid grid-cols-3 gap-4">
            {[4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
              <Button
                key={n}
                onClick={() => setPlayerCount(n)}
                variant={playerCount === n ? 'primary' : 'ghost'}
                // 320px 幅では 3列のセルが約 63px しかない。「10人（にん）」は
                // ふりがなのぶん横に広く、既定の余白と文字サイズだと2行に折れて
                // 下が欠けるので、狭い画面でだけ余白と文字を詰める。
                className="py-4 !px-1 sm:!px-4 text-xl sm:text-2xl whitespace-nowrap !rounded-2xl"
              >
                {n}<R t="人" r="にん" />
              </Button>
            ))}
          </div>
        </div>

        <div className="bg-black/30 p-6 md:p-8 rounded-[32px] border border-white/10 text-left shrink-0 shadow-inner">
          <label className="flex items-center gap-3 text-2xl font-bold text-blue-300 mb-6 drop-shadow-md">
            <VenetianMask className="w-8 h-8" />
            <span><R t="役職" r="やくしょく" />のカスタマイズ</span>
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {(Object.keys(ROLE_DETAILS) as Role[]).map((role) => (
              <div key={role} className="flex flex-col items-center bg-white/5 p-4 rounded-2xl border border-white/10 shadow-sm">
                <span className={`text-xl font-bold mb-3 ${ROLE_DETAILS[role].color}`}>
                  <R t={role} r={ROLE_DETAILS[role].ruby} />
                </span>
                <div className="flex items-center gap-4">
                  <button onClick={() => updateRoleCount(role, -1)} disabled={roleCounts[role] <= 0} className="w-10 h-10 rounded-full bg-rose-500/80 hover:bg-rose-400 font-bold text-2xl disabled:opacity-30 flex items-center justify-center transition-all" aria-label={`${role}を減らす`}>-</button>
                  <span className="text-3xl font-black w-8 text-center">{roleCounts[role]}</span>
                  <button onClick={() => updateRoleCount(role, 1)} disabled={totalRoles >= playerCount} className="w-10 h-10 rounded-full bg-blue-500/80 hover:bg-blue-400 font-bold text-2xl disabled:opacity-30 flex items-center justify-center transition-all" aria-label={`${role}を増やす`}>+</button>
                </div>
              </div>
            ))}
          </div>
          {!isRoleCountValid && (
            <p className="text-rose-400 mt-6 font-bold text-center text-lg animate-pulse">
              ※<R t="役職" r="やくしょく" />の<R t="合計" r="ごうけい" />（{totalRoles}<R t="人" r="にん" />）と<R t="遊" r="あそ" />ぶ<R t="人数" r="にんずう" />（{playerCount}<R t="人" r="にん" />）を<R t="合" r="あ" />わせてください
            </p>
          )}
          {isRoleCountValid && !isGameBalanceValid && (
            <p className="text-rose-400 mt-6 font-bold text-center text-lg animate-pulse">
              ※<R t="人狼" r="じんろう" />の<R t="数" r="かず" />は1<R t="人" r="ひとり" /><R t="以上" r="いじょう" />、かつ<R t="人狼" r="じんろう" />いがいの<R t="人数" r="にんずう" />より<R t="少" r="すく" />なくしてください
            </p>
          )}
        </div>

        <div className="bg-black/30 p-6 md:p-8 rounded-[32px] border border-white/10 text-left flex-grow shadow-inner">
          <p className="text-blue-200/70 font-bold mb-6 text-lg tracking-wide">（<R t="名前" r="なまえ" />は<R t="変" r="か" />えることもできます）</p>
          <div className="space-y-4">
            {names.slice(0, playerCount).map((name, i) => (
              <div key={i} className="flex items-center gap-4 group">
                <span className="shrink-0 w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center font-black text-xl text-white/80 group-focus-within:bg-blue-500/50 group-focus-within:border-blue-400 group-focus-within:text-white transition-all shadow-md">
                  {i + 1}
                </span>
                <input
                  type="text"
                  value={name}
                  maxLength={12}
                  aria-label={`プレイヤー${i + 1}の名前`}
                  onChange={(e) => {
                    const newNames = [...names];
                    newNames[i] = e.target.value;
                    setNames(newNames);
                  }}
                  className="w-full p-4 bg-black/50 border-2 border-white/10 rounded-2xl text-white text-2xl font-bold focus:border-blue-400 focus:bg-blue-900/20 outline-none transition-all shadow-inner"
                />
              </div>
            ))}
          </div>
        </div>

        {/* 開始ボタンは画面下端に貼り付けない（sticky にしない）。
            設定画面の下端に固定すると、スクロールの途中で人数ボタンや名前の
            入力欄の上に重なり、そちらを押したつもりが開始ボタンに吸われる。
            ページ自体がふつうにスクロールするようになったので、流れの中に置く。 */}
        <Button onClick={handleStart} variant="secondary" icon={<Play className="w-8 h-8" />} className="mt-2" disabled={!canStart}>
          ゲーム<R t="開始" r="かいし" />
        </Button>
      </div>
    </ScreenLayout>
  );
}

function RoleCheckPhase({ player, gameState, onNext }: { player: Player; gameState: GameState; onNext: () => void }) {
  const [showRole, setShowRole] = useState(false);

  if (!showRole) {
    return (
      <ScreenLayout title={<><R t="役職" r="やくしょく" />の<R t="確認" r="かくにん" /></>}>
        <div className="flex-grow flex flex-col justify-center space-y-12 my-auto">
          <div className="bg-gradient-to-br from-blue-900/60 to-indigo-900/60 border-l-[12px] border-blue-400 p-8 md:p-10 rounded-3xl text-left shadow-[0_20px_40px_rgba(0,0,0,0.5)]">
            <p className="text-3xl mb-6 font-bold tracking-wide drop-shadow-md">
              <span className="text-5xl text-blue-300 font-black">{player.name}</span> さんの<R t="番" r="ばん" />です。
            </p>
            <p className="text-2xl text-white/90 leading-relaxed font-bold">
              <R t="画面" r="がめん" />を<R t="見" r="み" />てください。<br />
              <span className="text-yellow-400 inline-block mt-2 px-4 py-2 bg-black/40 rounded-xl border border-yellow-400/30 shadow-inner">
                （ほかの<R t="人" r="ひと" />は<R t="見" r="み" />ないでね！）
              </span>
            </p>
          </div>
          <Button onClick={() => setShowRole(true)} variant="secondary" className="py-8 animate-pulseGlow">
            あなたの<R t="役職" r="やくしょく" />を<R t="見" r="み" />る
          </Button>
        </div>
      </ScreenLayout>
    );
  }

  const roleInfo = ROLE_DETAILS[player.role];
  const Icon = roleInfo.icon;

  let additionalInfo = null;
  if (player.role === '占い師' && gameState.seerFirstNightInfo?.seerId === player.id) {
    additionalInfo = (
      <p className="mt-6 p-5 bg-blue-900/60 border-2 border-blue-400 rounded-2xl text-xl text-left text-white w-full shadow-lg">
        あなたは、<strong>{gameState.seerFirstNightInfo.whitePlayerName}</strong>さんが<R t="村人" r="むらびと" />チームであることを<R t="知" r="し" />っています。
      </p>
    );
  }
  if (player.role === '人狼' && player.werewolfAllies && player.werewolfAllies.length > 0) {
    additionalInfo = (
      <p className="mt-6 p-5 bg-rose-900/60 border-2 border-rose-500 rounded-2xl text-xl text-left text-white w-full shadow-lg">
        あなたの<R t="仲間" r="なかま" />の<R t="人狼" r="じんろう" />は、<strong>{player.werewolfAllies.join('さん、')}</strong>さんです。
      </p>
    );
  }

  return (
    <ScreenLayout title={<>{player.name}さんの<R t="役職" r="やくしょく" /></>}>
      <div className="flex-grow flex flex-col justify-between">
        <div className={`${roleInfo.bg} border-[3px] p-8 md:p-10 rounded-[32px] shadow-[0_20px_40px_rgba(0,0,0,0.6)] flex flex-col items-center relative overflow-hidden`}>
          <div className="absolute inset-0 bg-white/5 backdrop-blur-[2px] z-0"></div>

          <div className="bg-black/60 p-6 rounded-full border-[4px] border-white/20 mb-8 shadow-[0_0_30px_rgba(255,255,255,0.2)] shrink-0 glow-box relative z-10">
            <Icon className={`w-24 h-24 ${roleInfo.color} drop-shadow-[0_0_15px_currentColor]`} />
          </div>

          <h3 className={`text-4xl font-black ${roleInfo.color} mb-8 shrink-0 relative z-10 drop-shadow-lg tracking-widest`}>
            あなたは「<R t={player.role} r={roleInfo.ruby} />」です
          </h3>

          <p className="text-left text-2xl text-white/95 leading-relaxed font-bold relative z-10 drop-shadow-md bg-black/30 p-6 rounded-2xl border border-white/10">
            {roleInfo.desc}
          </p>

          <div className="relative z-10 w-full">
            {additionalInfo}
          </div>
        </div>

        <div className="mt-8 shrink-0">
          <p className="text-2xl text-yellow-400 font-bold mb-6 drop-shadow-md tracking-wide">
            <R t="確認" r="かくにん" />したらボタンを<R t="押" r="お" />して、<R t="次" r="つぎ" />の<R t="人" r="ひと" />に<R t="渡" r="わた" />してね。
          </p>
          <Button onClick={onNext} variant="primary">
            <R t="確認" r="かくにん" />しました
          </Button>
        </div>
      </div>
    </ScreenLayout>
  );
}

function DayPhase({ gameState, onStartVote, onShowResult }: { gameState: GameState; onStartVote: () => void; onShowResult: () => void }) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    const timerId = setInterval(() => {
      setTimeLeft((t) => {
        const nextTime = t! - 1;
        if (nextTime === 0) {
          AudioManager.playSE('alert');
          AudioManager.speak('時間切れです。投票へ進んでください。');
        } else if (nextTime <= 5) {
          AudioManager.playSE('click');
        }
        return nextTime;
      });
    }, 1000);
    return () => clearInterval(timerId);
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString();
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const startTimer = (minutes: number) => {
    AudioManager.playSE('alert');
    AudioManager.speak('相談タイム、スタート！');
    setTimeLeft(minutes * 60);
  };

  return (
    <ScreenLayout title={<>{gameState.day}<R t="日目" r="にちめ" />の<R t="昼" r="ひる" /></>}>
      {gameState.gameMessage && (
        // aria-live: 画面を見ていない／読み上げを使う人にも、犠牲者や
        // 追放結果といった「状況が変わったこと」がその場で伝わるようにする
        <div role="status" aria-live="polite" className="bg-gradient-to-r from-blue-900/60 to-transparent border-l-[8px] border-blue-400 p-6 rounded-2xl text-left mb-8 text-2xl font-bold shrink-0 shadow-lg tracking-wide">
          {gameState.gameMessage}
        </div>
      )}

      <div className="bg-black/30 p-6 md:p-8 rounded-[32px] mb-8 flex-grow border border-white/10 shadow-inner">
        <h3 className="text-2xl font-bold text-blue-200/80 text-left border-b-2 border-white/20 pb-3 mb-6 tracking-widest">
          <R t="生" r="い" />きているプレイヤー
        </h3>
        <div className="flex flex-wrap gap-4">
          {gameState.players.filter((p) => p.isAlive).map((p) => (
            <div key={p.id} className="bg-white/10 px-5 py-3 rounded-xl font-bold text-xl border border-white/20 shadow-sm backdrop-blur-sm text-white drop-shadow-md">
              {p.name}
            </div>
          ))}
        </div>
      </div>

      {gameState.winner ? (
        <div className="shrink-0 mt-4">
          <p className="text-2xl text-yellow-400 font-bold mb-6 drop-shadow-md">ゲームの<R t="決着" r="けっちゃく" />がつきました！</p>
          <Button onClick={onShowResult} variant="secondary">
            <R t="最終結果" r="さいしゅうけっか" />を<R t="見" r="み" />る
          </Button>
        </div>
      ) : (
        <div className="bg-black/40 p-6 md:p-8 rounded-[32px] border border-white/10 shrink-0 shadow-lg">
          {timeLeft === null ? (
            <div className="space-y-8">
              <label className="block text-3xl font-bold text-blue-300 drop-shadow-md">
                <R t="相談" r="そうだん" />する<R t="時間" r="じかん" />を<R t="決" r="き" />めてね
              </label>
              <div className="grid grid-cols-3 gap-5">
                <Button onClick={() => startTimer(1)} variant="ghost" className="!bg-blue-900/40 !border-blue-500/50 !text-white hover:!bg-blue-800/60">1<R t="分" r="ぷん" /></Button>
                <Button onClick={() => startTimer(3)} variant="ghost" className="!bg-blue-900/40 !border-blue-500/50 !text-white hover:!bg-blue-800/60">3<R t="分" r="ぷん" /></Button>
                <Button onClick={() => startTimer(5)} variant="ghost" className="!bg-blue-900/40 !border-blue-500/50 !text-white hover:!bg-blue-800/60">5<R t="分" r="ふん" /></Button>
              </div>
            </div>
          ) : (
            <div className="space-y-10">
              <div className={`text-8xl md:text-[120px] font-black font-mono tracking-widest ${timeLeft <= 10 ? 'neon-timer-danger animate-pulse' : 'neon-timer'}`}>
                {timeLeft > 0 ? formatTime(timeLeft) : <div className="text-6xl md:text-8xl pt-4"><R t="時間切" r="じかんぎ" />れ！</div>}
              </div>
              <Button onClick={onStartVote} variant="danger" icon={<Vote className="w-8 h-8" />}>
                <R t="投票" r="とうひょう" />へ<R t="進" r="すす" />む
              </Button>
            </div>
          )}
        </div>
      )}
    </ScreenLayout>
  );
}

function VotePhase({ gameState, onVote }: { gameState: GameState; onVote: (id: number) => void }) {
  const voter = gameState.players.find((p) => p.id === gameState.currentVoterId);
  const targets = gameState.tieBreakVote
    ? gameState.players.filter((p) => gameState.voteCandidates.includes(p.id))
    : gameState.players.filter((p) => p.isAlive);

  if (!voter) return null;

  return (
    <ScreenLayout title={gameState.tieBreakVote ? <span className="title-red"><R t="決選投票" r="けっせんとうひょう" /></span> : <><R t="投票" r="とうひょう" /></>}>
      {gameState.gameMessage && (
        <div role="status" aria-live="polite" className="bg-rose-900/50 border-l-[8px] border-rose-500 p-6 rounded-2xl text-left mb-8 text-2xl font-bold text-white shrink-0 shadow-lg">
          {gameState.gameMessage}
        </div>
      )}

      <div className="bg-black/30 p-8 rounded-[32px] mb-8 shrink-0 border border-white/10 shadow-inner">
        <p className="text-3xl font-bold leading-relaxed">
          <span className="text-5xl text-blue-400 font-black drop-shadow-md">{voter.name}</span> さんの<R t="番" r="ばん" />です。<br />
          <span className="text-gray-300 mt-4 block text-2xl"><R t="追放" r="ついほう" />したい<R t="人" r="ひと" />を<R t="選" r="えら" />んでください。</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-5 flex-grow content-start">
        {targets.filter((t) => t.id !== voter.id).map((target) => (
          <button
            key={target.id}
            onClick={() => { AudioManager.init(); AudioManager.playSE('click'); onVote(target.id); }}
            className="btn-3d-base bg-gradient-to-br from-indigo-500 to-purple-700 shadow-[0_8px_0_#4338ca,0_15px_20px_rgba(0,0,0,0.4)] active:shadow-[0_0px_0_#4338ca] text-white font-bold text-2xl h-full min-h-[7rem] p-4 tracking-wide"
          >
            {target.name}
          </button>
        ))}
      </div>
    </ScreenLayout>
  );
}

function VoteResultPhase({ gameState, onNext }: { gameState: GameState; onNext: () => void }) {
  return (
    <ScreenLayout title={<><R t="投票結果" r="とうひょうけっか" /></>}>
      <div className="flex-grow flex flex-col justify-between">
        {gameState.voteResultData && (
          <div className="bg-black/30 p-6 md:p-8 rounded-[32px] mb-8 flex-grow border border-white/10 shadow-inner">
            <ul className="space-y-5 text-left">
              {gameState.voteResultData.map((result) => (
                <li key={result.name} className="flex justify-between items-center bg-white/10 p-5 rounded-2xl border border-white/20 shadow-md">
                  <span className="text-3xl font-bold text-white drop-shadow-sm">{result.name}</span>
                  <span className="font-black text-yellow-400 text-3xl drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]">{result.votes} <R t="票" r="ひょう" /></span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="shrink-0">
          <div role="status" aria-live="polite" className={`p-8 rounded-[32px] text-left mb-8 border-l-[12px] shadow-xl ${gameState.exiledPlayerId !== null ? 'bg-rose-900/50 border-rose-500 text-white' : 'bg-gray-800/80 border-gray-500'}`}>
            <p className="text-3xl font-bold leading-relaxed">{gameState.gameMessage}</p>
            {gameState.winner && (
              <p className="text-2xl text-yellow-400 mt-6 font-black tracking-wider">ゲームの<R t="決着" r="けっちゃく" />がつきました！</p>
            )}
          </div>

          <Button onClick={onNext} variant="primary" icon={gameState.winner ? undefined : <Moon className="w-8 h-8" />}>
            {gameState.winner ? <><R t="最終結果" r="さいしゅうけっか" />を<R t="見" r="み" />る</> : <><R t="夜" r="よる" />の<R t="行動" r="こうどう" />へ<R t="進" r="すす" />む</>}
          </Button>
        </div>
      </div>
    </ScreenLayout>
  );
}

function NightPhase({ player, gameState, onAction, onNext }: { player: Player; gameState: GameState; onAction: (a: string, id: number | null) => void; onNext: () => void }) {
  const [showAction, setShowAction] = useState(false);

  if (gameState.nightActionResult != null) {
    return (
      <ScreenLayout title={<><R t="行動結果" r="こうどうけっか" /></>}>
        <div className="flex flex-col justify-center h-full space-y-12 my-auto">
          <div role="status" aria-live="polite" className="bg-gradient-to-b from-blue-900/80 to-indigo-900/80 border-[4px] border-blue-400 p-10 rounded-[32px] text-center shadow-[0_0_40px_rgba(96,165,250,0.4)] text-3xl md:text-4xl font-bold leading-relaxed tracking-wide">
            {gameState.nightActionResult}
          </div>
          <p className="text-2xl text-yellow-400 font-bold drop-shadow-md tracking-wide"><R t="確認" r="かくにん" />したら<R t="次" r="つぎ" />の<R t="人" r="ひと" />に<R t="渡" r="わた" />してね。</p>
          <Button onClick={onNext} variant="primary" className="shrink-0 mt-4">OK</Button>
        </div>
      </ScreenLayout>
    );
  }

  if (!showAction) {
    return (
      <ScreenLayout title={<><R t="夜" r="よる" />が<R t="来" r="き" />ました</>}>
        <div className="flex-grow flex flex-col justify-center space-y-12 my-auto">
          <div className="bg-gradient-to-br from-indigo-900/60 to-purple-900/60 border-l-[12px] border-indigo-400 p-8 md:p-10 rounded-[32px] text-left shadow-[0_20px_40px_rgba(0,0,0,0.5)]">
            <p className="text-3xl mb-6 font-bold tracking-wide drop-shadow-md">
              <span className="text-5xl text-indigo-300 font-black">{player.name}</span> さんの<R t="番" r="ばん" />です。
            </p>
            <p className="text-2xl text-white/90 leading-relaxed font-bold">
              <R t="画面" r="がめん" />を<R t="見" r="み" />てください。<br />
              <span className="text-yellow-400 inline-block mt-4 px-4 py-2 bg-black/40 rounded-xl border border-yellow-400/30 shadow-inner">
                （ほかの<R t="人" r="ひと" />は<R t="見" r="み" />ないでね！）
              </span>
            </p>
          </div>
          <Button onClick={() => setShowAction(true)} variant="secondary" className="animate-pulseGlow shrink-0 mt-4" icon={<Moon className="w-8 h-8" />}>
            <R t="夜" r="よる" />の<R t="行動" r="こうどう" />をする
          </Button>
        </div>
      </ScreenLayout>
    );
  }

  const renderActionContent = () => {
    const targets = gameState.players.filter((p) => p.isAlive);
    const ActionButtons = ({ action, filterFn, color }: { action: string; filterFn: (p: Player) => boolean; color: string }) => {
      const bgMap: Record<string, string> = {
        purple: 'from-purple-500 to-fuchsia-700 shadow-[0_8px_0_#7e22ce,0_15px_20px_rgba(0,0,0,0.4)] active:shadow-[0_0px_0_#7e22ce]',
        rose: 'from-rose-500 to-red-700 shadow-[0_8px_0_#be123c,0_15px_20px_rgba(0,0,0,0.4)] active:shadow-[0_0px_0_#be123c]',
        emerald: 'from-emerald-500 to-teal-700 shadow-[0_8px_0_#047857,0_15px_20px_rgba(0,0,0,0.4)] active:shadow-[0_0px_0_#047857]',
      };
      return (
        <div className="grid grid-cols-2 gap-5 mt-8 flex-grow content-start">
          {targets.filter(filterFn).map((t) => (
            <button key={t.id} onClick={() => { AudioManager.init(); AudioManager.playSE('click'); onAction(action, t.id); }} className={`btn-3d-base bg-gradient-to-br ${bgMap[color] || bgMap.purple} text-white font-bold text-2xl h-full min-h-[7rem] p-4 tracking-wide`}>
              {t.name}
            </button>
          ))}
        </div>
      );
    };

    switch (player.role) {
      case '占い師':
        return (
          <>
            <div className="bg-purple-900/40 p-5 rounded-2xl border border-purple-500/50 shrink-0">
              <p className="text-3xl font-bold text-purple-200 drop-shadow-md"><R t="占" r="うらな" />いたい<R t="人" r="ひと" />を<R t="一人" r="ひとり" /><R t="選" r="えら" />んでね。</p>
            </div>
            <ActionButtons action="fortune-tell" filterFn={(p) => p.id !== player.id} color="purple" />
          </>
        );
      case '人狼':
        return (
          <>
            {gameState.werewolfChoiceId !== null && (
              <p className="p-5 bg-black/50 border-l-[8px] border-rose-500 mb-6 text-left text-rose-300 text-2xl font-bold shrink-0 shadow-inner rounded-r-2xl">
                <R t="仲間" r="なかま" />は<strong>{gameState.players.find((p) => p.id === gameState.werewolfChoiceId)?.name}</strong>さんを<R t="選" r="えら" />んでいます。
              </p>
            )}
            <div className="bg-rose-900/40 p-5 rounded-2xl border border-rose-500/50 shrink-0">
              <p className="text-3xl font-bold text-rose-200 drop-shadow-md"><R t="襲撃" r="しゅうげき" />する<R t="人" r="ひと" />を<R t="一人" r="ひとり" /><R t="選" r="えら" />んでね。</p>
            </div>
            <ActionButtons action="attack" filterFn={(p) => p.role !== '人狼'} color="rose" />
          </>
        );
      case '霊能者':
        return (
          <div className="space-y-12 my-auto w-full">
            <div className="glow-box">
              <Search className="w-32 h-32 mx-auto text-blue-400 drop-shadow-[0_0_20px_rgba(96,165,250,0.8)] float-icon" />
            </div>
            <p className="text-4xl font-bold text-blue-300 tracking-widest animate-pulse drop-shadow-lg"><R t="霊視" r="れいし" />しています...</p>
            <Button onClick={() => onAction('shaman', null)} variant="primary" className="mt-8"><R t="結果" r="けっか" />を<R t="見" r="み" />る</Button>
          </div>
        );
      case '狩人': {
        const guardables = targets.filter((p) => p.id !== player.id && p.id !== player.lastGuardedId);
        if (guardables.length > 0) {
          return (
            <>
              <div className="bg-emerald-900/40 p-5 rounded-2xl border border-emerald-500/50 shrink-0">
                <p className="text-3xl font-bold text-emerald-200 drop-shadow-md"><R t="今夜" r="こんや" />、<R t="人狼" r="じんろう" />から<R t="守" r="まも" />る<R t="人" r="ひと" />を<R t="選" r="えら" />んでね。</p>
              </div>
              <ActionButtons action="guard" filterFn={(p) => guardables.includes(p)} color="emerald" />
            </>
          );
        }
        return (
          <div className="space-y-12 my-auto w-full">
            <Shield className="w-32 h-32 mx-auto text-gray-500 opacity-50" />
            <p className="text-4xl font-bold text-gray-400 drop-shadow-md"><R t="守" r="まも" />れる<R t="人" r="ひと" />がいません。</p>
            <Button onClick={() => onAction('none', null)} variant="ghost" className="mt-8 !border-gray-500 !text-white">OK</Button>
          </div>
        );
      }
      default:
        return (
          <div className="space-y-12 my-auto w-full bg-black/30 p-10 rounded-[32px] border border-white/10 shadow-inner">
            <Moon className="w-24 h-24 mx-auto text-blue-300/50 animate-pulse" />
            <p className="text-3xl font-bold text-gray-300 leading-relaxed tracking-wide">
              あなたの<R t="夜" r="よる" />の<R t="行動" r="こうどう" />はありません。<br />
              <R t="朝" r="あさ" />になるまで<R t="待" r="ま" />ってね。
            </p>
            <Button onClick={() => onAction('none', null)} variant="primary" className="mt-8">OK</Button>
          </div>
        );
    }
  };

  return (
    <ScreenLayout title={<>{player.name}さんの<R t="行動" r="こうどう" /></>}>
      <div className="flex-grow flex flex-col justify-start w-full">
        {renderActionContent()}
      </div>
    </ScreenLayout>
  );
}

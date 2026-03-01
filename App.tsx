import React, { useState, useEffect } from 'react';
import { User, Skull, Eye, Search, Shield, VenetianMask, Play, RotateCcw, Timer, Moon, Sun, Vote, Users, MessageCircle, X, Sparkles, Volume2, VolumeX } from 'lucide-react';

// ==========================================
// 1. グローバルスタイル (リッチなUIアニメーション用)
// ==========================================
const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@700;900&display=swap');
  
  body {
    font-family: 'M PLUS Rounded 1c', sans-serif;
    background-color: #050510;
    color: #fff;
    overflow: hidden;
    user-select: none;
    -webkit-user-select: none;
  }

  /* 背景の宇宙・魔法的アニメーション */
  .bg-night {
    background: linear-gradient(135deg, #090a0f, #141b2d, #1a0b1f, #0d1b2a);
    background-size: 400% 400%;
    animation: gradientBG 15s ease infinite;
  }
  .bg-day {
    background: linear-gradient(135deg, #0ea5e9, #38bdf8, #7dd3fc, #bae6fd);
    background-size: 400% 400%;
    animation: gradientBG 15s ease infinite;
  }
  @keyframes gradientBG {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  .stars-overlay {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background-image: 
      radial-gradient(2px 2px at 20px 30px, #ffffff, rgba(0,0,0,0)),
      radial-gradient(2px 2px at 40px 70px, #ffffff, rgba(0,0,0,0)),
      radial-gradient(2.5px 2.5px at 150px 160px, #fde047, rgba(0,0,0,0)),
      radial-gradient(2px 2px at 90px 40px, #ffffff, rgba(0,0,0,0)),
      radial-gradient(1.5px 1.5px at 130px 80px, #ffffff, rgba(0,0,0,0)),
      radial-gradient(3px 3px at 200px 120px, #a5b4fc, rgba(0,0,0,0));
    background-repeat: repeat;
    background-size: 250px 250px;
    opacity: 0.4;
    animation: twinkle 5s infinite alternate ease-in-out;
    pointer-events: none;
  }
  @keyframes twinkle {
    0% { opacity: 0.2; transform: translateY(0); }
    100% { opacity: 0.6; transform: translateY(-10px); }
  }

  /* 雲のオーバーレイ (昼用) */
  .clouds-overlay {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background-image: 
      radial-gradient(circle at 15% 20%, rgba(255,255,255,0.4) 0%, transparent 40%),
      radial-gradient(circle at 85% 10%, rgba(255,255,255,0.3) 0%, transparent 50%),
      radial-gradient(circle at 50% 80%, rgba(255,255,255,0.2) 0%, transparent 60%);
    pointer-events: none;
    animation: floatClouds 20s infinite alternate ease-in-out;
  }
  @keyframes floatClouds {
    0% { transform: translate(0, 0) scale(1); }
    100% { transform: translate(20px, -10px) scale(1.05); }
  }

  /* 3Dボタン (商用ゲーム風) */
  .btn-3d-base {
    position: relative;
    border: none;
    border-radius: 24px;
    font-weight: 900;
    transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    letter-spacing: 1px;
  }
  .btn-3d-primary {
    background: linear-gradient(to bottom, #4facfe 0%, #00f2fe 100%);
    box-shadow: 0 8px 0 #0284c7, 0 15px 20px rgba(0,0,0,0.4);
    color: white;
    text-shadow: 0 2px 4px rgba(0,0,0,0.3);
  }
  .btn-3d-primary:active {
    transform: translateY(8px);
    box-shadow: 0 0px 0 #0284c7, 0 5px 10px rgba(0,0,0,0.4);
  }
  .btn-3d-primary:disabled {
    filter: grayscale(100%);
    opacity: 0.5;
    transform: translateY(8px);
    box-shadow: 0 0px 0 #0284c7;
    pointer-events: none;
  }

  .btn-3d-secondary {
    background: linear-gradient(to bottom, #fde047 0%, #f59e0b 100%);
    box-shadow: 0 8px 0 #b45309, 0 15px 20px rgba(0,0,0,0.4);
    color: #451a03;
  }
  .btn-3d-secondary:active {
    transform: translateY(8px);
    box-shadow: 0 0px 0 #b45309, 0 5px 10px rgba(0,0,0,0.4);
  }
  .btn-3d-secondary:disabled {
    filter: grayscale(100%);
    opacity: 0.5;
    transform: translateY(8px);
    box-shadow: 0 0px 0 #b45309;
    pointer-events: none;
  }

  .btn-3d-danger {
    background: linear-gradient(to bottom, #fb7185 0%, #e11d48 100%);
    box-shadow: 0 8px 0 #9f1239, 0 15px 20px rgba(0,0,0,0.4);
    color: white;
    text-shadow: 0 2px 4px rgba(0,0,0,0.3);
  }
  .btn-3d-danger:active {
    transform: translateY(8px);
    box-shadow: 0 0px 0 #9f1239, 0 5px 10px rgba(0,0,0,0.4);
  }

  .btn-3d-ghost {
    background: linear-gradient(to bottom, #374151 0%, #1f2937 100%);
    box-shadow: 0 8px 0 #111827, 0 10px 15px rgba(0,0,0,0.3);
    color: #9ca3af;
  }
  .btn-3d-ghost:active {
    transform: translateY(8px);
    box-shadow: 0 0px 0 #111827, 0 5px 10px rgba(0,0,0,0.3);
  }

  /* グラスモーフィズムパネル */
  .glass-panel {
    background: rgba(20, 25, 45, 0.55);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-top: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 30px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1);
    border-radius: 32px;
  }

  /* リッチなテキストエフェクト */
  .title-text {
    background: linear-gradient(to bottom, #ffffff, #a5b4fc);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    filter: drop-shadow(0 4px 6px rgba(0,0,0,0.5));
  }
  .title-red {
    background: linear-gradient(to bottom, #fca5a5, #ef4444);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    filter: drop-shadow(0 4px 6px rgba(0,0,0,0.5));
  }
  .neon-timer {
    text-shadow: 0 0 10px #fde047, 0 0 20px #f59e0b, 0 0 40px #d97706;
    color: #fff;
  }
  .neon-timer-danger {
    text-shadow: 0 0 10px #fca5a5, 0 0 20px #ef4444, 0 0 40px #b91c1c;
    color: #fff;
  }
  
  /* アニメーション群 */
  .animate-fade-in-up {
    animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(40px) scale(0.95); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .glow-box {
    position: relative;
    z-index: 1;
  }
  .glow-box::before {
    content: '';
    position: absolute;
    top: -50%; left: -50%; right: -50%; bottom: -50%;
    background: radial-gradient(circle, rgba(250,204,21,0.25) 0%, transparent 60%);
    z-index: -1;
    animation: pulseGlow 3s infinite alternate;
  }
  @keyframes pulseGlow {
    0% { transform: scale(0.8); opacity: 0.5; }
    100% { transform: scale(1.2); opacity: 1; }
  }

  .float-icon {
    animation: floating 3s ease-in-out infinite;
  }
  @keyframes floating {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }

  /* ルビの調整 */
  ruby {
    ruby-align: center;
  }
  rt {
    font-size: 0.55em;
    color: rgba(255,255,255,0.8);
    transform: translateY(-10%);
  }

  /* スクロールバーの非表示（スマホライク） */
  ::-webkit-scrollbar {
    width: 0px;
    background: transparent;
  }
`;

// ==========================================
// 2. 音声・SEマネージャー
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
      console.warn("Audio play failed", e);
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
// 3. 型定義・ゲームロジック
// ==========================================

type Role = '村人' | '人狼' | '占い師' | '霊能者' | '狩人' | '狂人';
type Phase = 'setup' | 'roleCheck' | 'day' | 'vote' | 'voteResult' | 'night' | 'result';

interface Player {
  id: number;
  name: string;
  role: Role;
  isAlive: boolean;
  votedBy: number[];
  voteTo: number | null;
  lastGuardedId: number | null;
  werewolfAllies?: string[];
}

interface GameState {
  players: Player[];
  playerCount: number;
  day: number;
  phase: Phase;
  currentTurnPlayerIndex: number;
  currentVoterId: number | null;
  exiledPlayerId: number | null;
  attackedPlayerId: number | null;
  guardedPlayerId: number | null;
  werewolfChoiceId: number | null;
  gameMessage: React.ReactNode;
  tieBreakVote: boolean;
  voteCandidates: number[];
  voteResultData: { name: string; votes: number }[] | null;
  seerFirstNightInfo: { seerId: number; whitePlayerName: string } | null;
  winner: '村人陣営' | '人狼陣営' | null;
  nightActionResult?: React.ReactNode | null;
}

const ROLE_CONFIGS: Record<number, Role[]> = {
  4: ['村人', '村人', '人狼', '占い師'],
  5: ['村人', '村人', '村人', '人狼', '占い師'],
  6: ['村人', '村人', '村人', '人狼', '人狼', '占い師'],
  7: ['村人', '村人', '村人', '村人', '人狼', '人狼', '占い師'],
  8: ['村人', '村人', '村人', '村人', '村人', '人狼', '人狼', '占い師'],
  9: ['村人', '村人', '村人', '村人', '村人', '人狼', '人狼', '占い師', '霊能者'],
  10: ['村人', '村人', '村人', '村人', '村人', '人狼', '人狼', '占い師', '霊能者', '狂人'],
  11: ['村人', '村人', '村人', '村人', '村人', '人狼', '人狼', '占い師', '霊能者', '狂人', '狩人'],
  12: ['村人', '村人', '村人', '村人', '村人', '村人', '人狼', '人狼', '占い師', '霊能者', '狂人', '狩人'],
};

function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

function createInitialState(playerCount: number, playerNames: string[], roles: Role[]): GameState {
  const shuffledRoles = shuffleArray(roles);

  const players: Player[] = playerNames.map((name, index) => ({
    id: index,
    name: name || `プレイヤー${index + 1}`,
    role: shuffledRoles[index],
    isAlive: true,
    votedBy: [],
    voteTo: null,
    lastGuardedId: null,
  }));

  const werewolfNames = players.filter(p => p.role === '人狼').map(p => p.name);
  players.forEach(p => {
    if (p.role === '人狼') {
      p.werewolfAllies = werewolfNames.filter(name => name !== p.name);
    }
  });

  let seerFirstNightInfo = null;
  const seer = players.find(p => p.role === '占い師');
  if (seer) {
    const villagerTeamRoles: Role[] = ['村人', '占い師', '霊能者', '狩人'];
    const whitePlayers = players.filter(p => p.id !== seer.id && villagerTeamRoles.includes(p.role));
    if (whitePlayers.length > 0) {
      const randomWhitePlayer = whitePlayers[Math.floor(Math.random() * whitePlayers.length)];
      seerFirstNightInfo = { seerId: seer.id, whitePlayerName: randomWhitePlayer.name };
    }
  }

  return {
    players,
    playerCount,
    day: 1,
    phase: 'roleCheck',
    currentTurnPlayerIndex: 0,
    currentVoterId: null,
    exiledPlayerId: null,
    attackedPlayerId: null,
    guardedPlayerId: null,
    werewolfChoiceId: null,
    gameMessage: '',
    tieBreakVote: false,
    voteCandidates: [],
    voteResultData: null,
    seerFirstNightInfo,
    winner: null,
    nightActionResult: null,
  };
}

function checkForWinner(state: GameState): '村人陣営' | '人狼陣営' | null {
  const alivePlayers = state.players.filter(p => p.isAlive);
  const aliveWerewolves = alivePlayers.filter(p => p.role === '人狼');
  const villagerTeamRoles: Role[] = ['村人', '占い師', '霊能者', '狩人'];
  const aliveVillagerTeam = alivePlayers.filter(p => villagerTeamRoles.includes(p.role));

  if (aliveWerewolves.length === 0) return '村人陣営';
  if (aliveWerewolves.length >= aliveVillagerTeam.length) return '人狼陣営';
  return null;
}

// ==========================================
// 4. UI部品（ルビ振り、ボタンなど）
// ==========================================

const R = ({ t, r }: { t: string; r: string }) => (
  <ruby>
    {t}
    <rt>{r}</rt>
  </ruby>
);

const ROLE_DETAILS: Record<Role, { icon: React.FC<any>; desc: React.ReactNode; color: string; ruby: string; bg: string }> = {
  '村人': { 
    icon: User, ruby: 'むらびと',
    desc: <><R t="特別" r="とくべつ"/>な<R t="能力" r="のうりょく"/>はありません。<R t="誰" r="だれ"/>が<R t="人狼" r="じんろう"/>か、みんなと<R t="相談" r="そうだん"/>して<R t="見" r="み"/>つけだしてください。</>, 
    color: 'text-cyan-400', bg: 'bg-cyan-900/40 border-cyan-500' 
  },
  '人狼': { 
    icon: Skull, ruby: 'じんろう',
    desc: <><R t="村人" r="むらびと"/>に<R t="正体" r="しょうたい"/>がバレないように、<R t="毎晩" r="まいばん"/>ひとりずつ<R t="村人" r="むらびと"/>を<R t="襲撃" r="しゅうげき"/>します。</>, 
    color: 'text-rose-500', bg: 'bg-rose-900/40 border-rose-500' 
  },
  '占い師': { 
    icon: Eye, ruby: 'うらないし',
    desc: <><R t="毎晩" r="まいばん"/>、<R t="誰" r="だれ"/>か１<R t="人" r="ひとり"/>を<R t="占" r="うらな"/>って、その<R t="人" r="ひと"/>が「<R t="人狼" r="じんろう"/>」かを知ることができます。</>, 
    color: 'text-purple-400', bg: 'bg-purple-900/40 border-purple-500' 
  },
  '霊能者': { 
    icon: Search, ruby: 'れいのうしゃ',
    desc: <><R t="昼" r="ひる"/>に<R t="追放" r="ついほう"/>された<R t="人" r="ひと"/>が、「<R t="人狼" r="じんろう"/>」だったかを<R t="知" r="し"/>ることができます。</>, 
    color: 'text-blue-400', bg: 'bg-blue-900/40 border-blue-500' 
  },
  '狩人': { 
    icon: Shield, ruby: 'かりうど',
    desc: <><R t="毎晩" r="まいばん"/>、<R t="誰" r="だれ"/>か１<R t="人" r="ひとり"/>を<R t="人狼" r="じんろう"/>の<R t="襲撃" r="しゅうげき"/>から<R t="守" r="まも"/>ることができます。</>, 
    color: 'text-emerald-400', bg: 'bg-emerald-900/40 border-emerald-500' 
  },
  '狂人': { 
    icon: VenetianMask, ruby: 'きょうじん',
    desc: <><R t="人狼" r="じんろう"/>の<R t="味方" r="みかた"/>です。<R t="占" r="うらな"/>われても「<R t="人狼" r="じんろう"/>ではない」と<R t="出" r="出"/>ます。<R t="人狼" r="じんろう"/>が<R t="勝" r="か"/>つように、<R t="嘘" r="うそ"/>をついてまどわせましょう。</>, 
    color: 'text-amber-400', bg: 'bg-amber-900/40 border-amber-500' 
  },
};

// --- レイアウト部品 ---
function ScreenLayout({ title, children }: { title: React.ReactNode, children: React.ReactNode }) {
  return (
    <div className="glass-panel w-full max-w-2xl mx-auto flex flex-col flex-grow animate-fade-in-up mt-2 mb-4">
      {title && (
        <div className="bg-white/5 p-5 border-b border-white/10 shrink-0 rounded-t-[32px]">
          <h2 className="text-3xl font-bold text-center title-text tracking-wide">{title}</h2>
        </div>
      )}
      <div className="p-6 md:p-8 flex-grow flex flex-col text-center overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

function Button({ children, onClick, className = '', icon, variant = 'primary', disabled = false }: { children: React.ReactNode, onClick: () => void, className?: string, icon?: React.ReactNode, variant?: 'primary' | 'secondary' | 'danger' | 'ghost', disabled?: boolean }) {
  const variants = {
    primary: "btn-3d-primary",
    secondary: "btn-3d-secondary",
    danger: "btn-3d-danger",
    ghost: "btn-3d-ghost"
  };
  const handleClick = () => {
    AudioManager.init();
    if (!disabled) AudioManager.playSE('click');
    onClick();
  };
  return (
    <button onClick={handleClick} disabled={disabled} className={`btn-3d-base py-5 px-8 text-2xl w-full shrink-0 ${variants[variant]} ${className}`}>
      {icon && <span className="scale-125 drop-shadow-md">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}

// --- ヘッダー / フッター ---
function Header({ onOpenModal, isDayTime, isMuted, toggleMute }: { onOpenModal: () => void, isDayTime?: boolean | null, isMuted: boolean, toggleMute: () => void }) {
  return (
    <header className="flex justify-between items-center px-5 py-4 bg-gray-900/80 backdrop-blur-md border-b border-white/10 shrink-0 shadow-lg relative z-10">
      <div className="flex items-center gap-4">
        <button onClick={() => { AudioManager.init(); toggleMute(); AudioManager.playSE('click'); }} className="w-12 h-12 flex items-center justify-center bg-white/10 border border-white/20 rounded-full text-white hover:bg-white/20 transition-colors shadow-inner" aria-label="音声ON/OFF">
          {isMuted ? <VolumeX className="w-6 h-6 text-gray-400"/> : <Volume2 className="w-6 h-6 text-blue-300"/>}
        </button>
        <h1 className="text-3xl font-bold text-white tracking-wider flex items-center gap-2 drop-shadow-md hidden sm:flex">
          <span className="title-red"><R t="人狼" r="じんろう"/></span>ゲーム
          {isDayTime ? (
            <Sun className="w-8 h-8 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)] animate-pulseGlow" fill="currentColor" />
          ) : (
            <Moon className="w-8 h-8 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]" fill="currentColor" />
          )}
        </h1>
      </div>
      <button 
        onClick={() => { AudioManager.init(); AudioManager.playSE('click'); onOpenModal(); }} 
        className="flex justify-center items-center w-12 h-12 bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900 rounded-full font-black text-3xl shadow-[0_4px_0_#b45309,0_4px_10px_rgba(0,0,0,0.5)] active:translate-y-1 active:shadow-[0_0px_0_#b45309] transition-all"
        aria-label="あそびかた"
      >
        ？
      </button>
    </header>
  );
}

function Footer() {
  return (
    <footer className="text-center text-white/50 py-4 border-t border-white/10 bg-gray-900/80 backdrop-blur-md shrink-0 relative z-10">
      <small className="text-sm font-bold flex items-center justify-center gap-1 tracking-wider">
        © 2026 人狼ゲーム 
        <a href="https://note.com/cute_borage86" target="_blank" rel="noopener noreferrer" className="no-underline text-white/70 hover:text-white transition-colors ml-1">
          GIGA山
        </a>
      </small>
    </footer>
  );
}

// --- あそびかたモーダル ---
function HowToPlayModal({ onClose }: { onClose: () => void }) {
  const steps = [
    {
      icon: <Users className="w-10 h-10 text-cyan-400" />,
      title: <><R t="役職" r="やくしょく"/>の<R t="確認" r="かくにん"/></>,
      desc: <>じゅんばんにタブレットをまわして、じぶんの<R t="役職" r="やくしょく"/>（むらびと、じんろうなど）を<R t="確認" r="かくにん"/>します。ほかの<R t="人" r="ひと"/>には<R t="見" r="み"/>せないでね！</>
    },
    {
      icon: <MessageCircle className="w-10 h-10 text-yellow-400" />,
      title: <><R t="昼" r="ひる"/>の<R t="話" r="はな"/>し<R t="合" r="あ"/>い</>,
      desc: <>だれが<R t="人狼" r="じんろう"/>か、みんなで<R t="話" r="はな"/>し<R t="合" r="あ"/>って<R t="推理" r="すいり"/>します。<R t="人狼" r="じんろう"/>はウソをついて、みんなをだましましょう！</>
    },
    {
      icon: <Vote className="w-10 h-10 text-rose-400" />,
      title: <><R t="投票" r="とうひょう"/></>,
      desc: <><R t="話" r="はな"/>し<R t="合" r="あ"/>いが<R t="終" r="お"/>わったら、<R t="人狼" r="じんろう"/>だと<R t="思" r="おも"/>う<R t="人" r="ひと"/>を1<R t="人" r="ひとり"/><R t="選" r="えら"/>んで<R t="追放" r="ついほう"/>します。</>
    },
    {
      icon: <Moon className="w-10 h-10 text-indigo-400" fill="currentColor"/>,
      title: <><R t="夜" r="よる"/>の<R t="行動" r="こうどう"/></>,
      desc: <><R t="人狼" r="じんろう"/>は<R t="村人" r="むらびと"/>を<R t="襲撃" r="しゅうげき"/>し、<R t="占" r="うらな"/>い<R t="師" r="し"/>は<R t="誰" r="だれ"/>かを<R t="占" r="うらな"/>うなど、<R t="特別" r="とくべつ"/>な<R t="力" r="ちから"/>を<R t="使" r="つか"/>います。</>
    },
    {
      icon: <Sparkles className="w-10 h-10 text-amber-400" fill="currentColor"/>,
      title: <><R t="決着" r="けっちゃく"/>がつくまで！</>,
      desc: <><R t="人狼" r="じんろう"/>をぜんいん<R t="追放" r="ついほう"/>するか、<R t="人狼" r="じんろう"/>の<R t="数" r="かず"/>が<R t="村人" r="むらびと"/>と<R t="同" r="おな"/>じになればゲーム<R t="終了" r="しゅうりょう"/>！</>
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-md">
      <div className="glass-panel w-full max-w-2xl max-h-[90vh] flex flex-col border-[3px] border-yellow-400/50 shadow-[0_0_50px_rgba(250,204,21,0.2)] overflow-hidden animate-fade-in-up rounded-[32px]">
        
        <div className="bg-white/10 border-b border-white/20 p-5 flex justify-between items-center shrink-0">
          <h2 className="text-3xl font-bold title-text flex items-center gap-3 drop-shadow-lg">
            <span className="bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900 rounded-full w-10 h-10 flex items-center justify-center text-2xl shadow-inner">？</span>
            あそびかた
          </h2>
          <button 
            onClick={() => { AudioManager.playSE('click'); onClose(); }} 
            className="w-12 h-12 bg-white/10 hover:bg-rose-500/80 rounded-full flex items-center justify-center text-white font-bold transition-all shadow-md border border-white/20"
          >
            <X className="w-8 h-8"/>
          </button>
        </div>
        
        <div className="p-5 md:p-8 overflow-y-auto flex-grow space-y-5">
          {steps.map((step, index) => (
            <div key={index} className="flex gap-5 bg-black/40 p-5 rounded-2xl items-start border border-white/10 shadow-inner">
              <div className="shrink-0 bg-white/5 p-4 rounded-2xl border border-white/10 shadow-[0_4px_15px_rgba(0,0,0,0.5)]">
                {step.icon}
              </div>
              <div className="text-left flex-grow pt-1">
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2 tracking-wide">
                  <span className="text-yellow-400 text-2xl font-black">{index + 1}.</span> {step.title}
                </h3>
                <p className="text-gray-300 font-bold leading-relaxed text-lg">{step.desc}</p>
              </div>
            </div>
          ))}
          
          <Button onClick={onClose} variant="primary" className="mt-6">
            わかった！
          </Button>
        </div>
      </div>
    </div>
  );
}


// ==========================================
// 5. メインアプリケーション
// ==========================================

export default function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(AudioManager.isMuted);

  // favicon.png の設定処理
  useEffect(() => {
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = 'image/png';
    link.href = 'favicon.png';
  }, []);

  const isDayTime = gameState && ['day', 'vote', 'voteResult'].includes(gameState.phase);

  const updateState = (updater: (draft: GameState) => void | Partial<GameState>) => {
    setGameState(prev => {
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
          // 読み間違いを防ぐため「にちめ」とひらがなに修正
          AudioManager.speak(`${gameState.day}にちめの、昼になりました。話し合いを始めてください。`);
        }
        updateState(draft => {
          draft.currentTurnPlayerIndex++;
          if (draft.currentTurnPlayerIndex >= draft.playerCount) {
            draft.phase = 'day';
            draft.gameMessage = <>{draft.day}<R t="日目" r="にちめ"/>の<R t="昼" r="ひる"/>になりました。</>;
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
        updateState(draft => {
          draft.phase = 'vote';
          draft.players.forEach(p => { p.votedBy = []; p.voteTo = null; });
          draft.tieBreakVote = false;
          draft.voteCandidates = [];
          draft.gameMessage = <><R t="追放" r="ついほう"/>したい<R t="人" r="ひと"/>を<R t="選" r="えら"/>んでください。</>;
          const potentialVoters = draft.players.filter(p => p.isAlive);
          draft.currentVoterId = potentialVoters.length > 0 ? potentialVoters[0].id : null;
        });
      };
      return <DayPhase gameState={gameState} onStartVote={handleStartVote} onShowResult={() => updateState(d => { d.phase = 'result'; })} />;
    }
    if (gameState.phase === 'vote') {
      const handleVote = (targetId: number) => {
        updateState(draft => {
          const voter = draft.players.find(p => p.id === draft.currentVoterId);
          const target = draft.players.find(p => p.id === targetId);
          if (voter && target && voter.voteTo === null) {
            voter.voteTo = targetId;
            target.votedBy.push(voter.id);
          }

          const alivePlayers = draft.players.filter(p => p.isAlive);
          const potentialVoters = draft.tieBreakVote 
            ? alivePlayers.filter(p => !draft.voteCandidates.includes(p.id))
            : alivePlayers;

          const currentVoterIndex = draft.players.findIndex(p => p.id === draft.currentVoterId);
          let nextVoterId = null;
          for (let i = 1; i <= draft.players.length; i++) {
            const nextIndex = (currentVoterIndex + i) % draft.players.length;
            const nextPlayer = draft.players[nextIndex];
            if (potentialVoters.some(v => v.id === nextPlayer.id) && nextPlayer.voteTo === null) {
              nextVoterId = nextPlayer.id;
              break;
            }
          }

          if (nextVoterId !== null) {
            draft.currentVoterId = nextVoterId;
          } else {
            let maxVotes = 0;
            let exiledCandidates: number[] = [];
            const voteTargets = draft.tieBreakVote ? draft.players.filter(p => draft.voteCandidates.includes(p.id)) : alivePlayers;

            voteTargets.forEach(p => {
              if (p.votedBy.length > maxVotes) {
                maxVotes = p.votedBy.length;
                exiledCandidates = [p.id];
              } else if (p.votedBy.length === maxVotes && maxVotes > 0) {
                exiledCandidates.push(p.id);
              }
            });

            draft.voteResultData = alivePlayers.map(p => ({ name: p.name, votes: p.votedBy.length })).sort((a, b) => b.votes - a.votes);

            AudioManager.playSE('alert');

            if (exiledCandidates.length === 1) {
              const exiledId = exiledCandidates[0];
              draft.players.find(p => p.id === exiledId)!.isAlive = false;
              draft.exiledPlayerId = exiledId;
              const exiledName = draft.players.find(p => p.id === exiledId)!.name;
              draft.gameMessage = <>{exiledName}さんが<R t="追放" r="ついほう"/>されました。</>;
              const winner = checkForWinner(draft);
              if (winner) draft.winner = winner;
              draft.phase = 'voteResult';
              
              AudioManager.speak(winner 
                ? `${exiledName}さんが追放されました。ゲーム終了、${winner}の勝利です！` 
                : `${exiledName}さんが追放されました。`);

            } else if (exiledCandidates.length > 1) {
              if (voters.length === 0) {
                const exiledId = exiledCandidates[Math.floor(Math.random() * exiledCandidates.length)];
                draft.players.find(p => p.id === exiledId)!.isAlive = false;
                draft.exiledPlayerId = exiledId;
                const exiledName = draft.players.find(p => p.id === exiledId)!.name;
                draft.gameMessage = <><R t="決選投票" r="けっせんとうひょう"/>も<R t="同数" r="どうすう"/>だったため、ランダムで{exiledName}さんが<R t="追放" r="ついほう"/>されました。</>;
                const winner = checkForWinner(draft);
                if (winner) draft.winner = winner;
                draft.phase = 'voteResult';

                AudioManager.speak(winner 
                  ? `決選投票も同数でした。ランダムで${exiledName}さんが追放されました。ゲーム終了、${winner}の勝利です！`
                  : `決選投票も同数でした。ランダムで${exiledName}さんが追放されました。`);
              } else {
                draft.tieBreakVote = true;
                draft.voteCandidates = exiledCandidates;
                const names = exiledCandidates.map(id => draft.players.find(p => p.id === id)!.name).join('さんと');
                draft.gameMessage = <>{names}さんで<R t="決選投票" r="けっせんとうひょう"/>を<R t="行" r="おこな"/>います。</>;
                draft.players.forEach(p => { p.votedBy = []; p.voteTo = null; });
                draft.currentVoterId = voters[0].id;
                draft.phase = 'vote';
                
                AudioManager.speak(`決選投票を行います。対象者は、${names}さんです。`);
              }
            } else {
              draft.gameMessage = <><R t="追放" r="ついほう"/>される<R t="人" r="ひと"/>はいませんでした。</>;
              draft.exiledPlayerId = null;
              draft.phase = 'voteResult';
              AudioManager.speak('追放される人はいませんでした。');
            }
          }
        });
      };
      return <VotePhase gameState={gameState} onVote={handleVote} />;
    }
    if (gameState.phase === 'voteResult') {
      const handleNext = () => {
        if (gameState.winner) {
          updateState(d => { d.phase = 'result'; });
          AudioManager.playSE('alert');
          AudioManager.speak(`ゲーム終了！ ${gameState.winner} の勝利です！`);
        } else {
          updateState(d => {
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
      const alivePlayers = gameState.players.filter(p => p.isAlive);
      if (gameState.currentTurnPlayerIndex >= alivePlayers.length) {
        const handleMorning = () => {
          updateState(draft => {
            let victim = null;
            if (draft.attackedPlayerId !== null && draft.attackedPlayerId !== draft.guardedPlayerId) {
              victim = draft.players.find(p => p.id === draft.attackedPlayerId);
              if (victim) victim.isAlive = false;
            }
            draft.gameMessage = victim ? <><R t="昨夜" r="さくや"/>の<R t="犠牲者" r="ぎせいしゃ"/>は{victim.name}さんでした。</> : <><R t="昨夜" r="さくや"/>は<R t="誰" r="だれ"/>も<R t="襲撃" r="しゅうげき"/>されませんでした。</>;
            const hunter = draft.players.find(p => p.role === '狩人');
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
          <ScreenLayout title={<><R t="夜" r="よる"/>が<R t="明" r="あ"/>けました</>}>
            <div className="flex flex-col items-center justify-center space-y-12 my-auto">
              <div className="glow-box">
                <Sun className="w-40 h-40 text-yellow-400 drop-shadow-[0_0_20px_rgba(250,204,21,0.8)] float-icon" fill="currentColor"/>
              </div>
              <p className="text-3xl font-bold tracking-wide"><R t="全員" r="ぜんいん"/>の<R t="夜" r="よる"/>の<R t="行動" r="こうどう"/>が<R t="終" r="お"/>わりました。</p>
              <Button onClick={handleMorning} variant="primary" className="mt-8"><R t="昼" r="ひる"/>を<R t="迎" r="むか"/>える</Button>
            </div>
          </ScreenLayout>
        );
      }

      const currentPlayer = alivePlayers[gameState.currentTurnPlayerIndex];
      const handleAction = (action: string, targetId: number | null) => {
        updateState(draft => {
          if (action === 'fortune-tell' && targetId !== null) {
            const target = draft.players.find(p => p.id === targetId);
            const isWolf = target?.role === '人狼';
            draft.nightActionResult = <>{target!.name}さんは{isWolf ? <strong className="text-rose-400 drop-shadow-md"><R t="人狼" r="じんろう"/>です！</strong> : <span className="text-cyan-300"><R t="人狼" r="じんろう"/>ではありません。</span>}</>;
          } else if (action === 'attack' && targetId !== null) {
            const livingWerewolves = draft.players.filter(p => p.role === '人狼' && p.isAlive);
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
            const exiled = draft.players.find(p => p.id === draft.exiledPlayerId);
            if (exiled) {
              draft.nightActionResult = <>{exiled.name}さんは、{exiled.role === '人狼' ? <strong className="text-rose-400 drop-shadow-md"><R t="人狼" r="じんろう"/>でした！</strong> : <span className="text-cyan-300"><R t="人狼" r="じんろう"/>ではありませんでした。</span>}</>;
            } else {
              draft.nightActionResult = <><R t="昨夜" r="さくや"/>は<R t="追放" r="ついほう"/>された<R t="人" r="ひと"/>はいませんでした。</>;
            }
          } else {
            draft.currentTurnPlayerIndex++;
          }
        });
      };

      return <NightPhase key={currentPlayer.id} player={currentPlayer} gameState={gameState} onAction={handleAction} onNext={() => updateState(d => { d.nightActionResult = null; d.currentTurnPlayerIndex++; })} />;
    }
    if (gameState.phase === 'result') {
      return (
        <ScreenLayout title={<>ゲーム<R t="終了" r="しゅうりょう"/>！</>}>
          <div className="space-y-8 flex flex-col justify-center h-full">
            <div className="p-8 border-[3px] border-yellow-400/50 rounded-[32px] bg-yellow-900/30 shadow-[0_0_40px_rgba(250,204,21,0.3)] glow-box">
              <h3 className="text-4xl md:text-5xl font-black text-yellow-400 drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)] tracking-wider">
                <R t={gameState.winner!} r={gameState.winner === '村人陣営' ? 'むらびとじんえい' : 'じんろうじんえい'} />の<R t="勝利" r="しょうり"/>！
              </h3>
            </div>
            
            <div className="bg-black/30 p-6 rounded-3xl flex-grow overflow-y-auto border border-white/10 shadow-inner">
              <h3 className="text-2xl font-bold border-b-2 border-white/20 pb-4 mb-5 tracking-widest text-blue-200"><R t="全員" r="ぜんいん"/>の<R t="役職" r="やくしょく"/></h3>
              <ul className="space-y-4 text-left">
                {gameState.players.map(p => (
                  <li key={p.id} className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/10 shadow-sm">
                    <span className="text-2xl font-bold flex items-center gap-3">
                      {!p.isAlive && <Skull className="w-7 h-7 text-rose-500 drop-shadow-md"/>}
                      <span className={!p.isAlive ? "line-through text-white/40" : "text-white drop-shadow-md"}>{p.name}</span>
                    </span>
                    <span className={`text-2xl font-black ${ROLE_DETAILS[p.role].color} drop-shadow-md`}>
                      <R t={p.role} r={ROLE_DETAILS[p.role].ruby} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            
            <Button onClick={() => setGameState(null)} variant="primary" icon={<RotateCcw className="w-8 h-8"/>} className="mt-4">
              もう<R t="一度" r="いちど"/><R t="遊" r="あそ"/>ぶ
            </Button>
          </div>
        </ScreenLayout>
      );
    }
    return null;
  };

  return (
    <div className="relative flex flex-col h-[100dvh] font-sans">
      <style>{globalStyles}</style>
      
      {/* 背景のクロスフェードアニメーション */}
      <div className={`fixed inset-0 bg-night z-[-2] transition-opacity duration-1000 ${isDayTime ? 'opacity-0' : 'opacity-100'}`} />
      <div className={`fixed inset-0 bg-day z-[-2] transition-opacity duration-1000 ${isDayTime ? 'opacity-100' : 'opacity-0'}`} />
      <div className={`stars-overlay z-[-1] transition-opacity duration-1000 ${isDayTime ? 'opacity-0' : 'opacity-100'}`} />
      <div className={`clouds-overlay z-[-1] transition-opacity duration-1000 ${isDayTime ? 'opacity-100' : 'opacity-0'}`} />
      
      <Header onOpenModal={() => setIsModalOpen(true)} isDayTime={isDayTime} isMuted={isMuted} toggleMute={() => setIsMuted(AudioManager.toggleMute())} />
      
      <main className="flex-grow overflow-y-auto p-4 md:p-6 w-full flex flex-col items-center">
        {renderPhase()}
      </main>

      <Footer />

      {isModalOpen && <HowToPlayModal onClose={() => setIsModalOpen(false)} />}
    </div>
  );
}

// ==========================================
// 6. 各画面コンポーネント
// ==========================================

function SetupPhase({ onStart }: { onStart: (count: number, names: string[], roles: Role[]) => void }) {
  const [playerCount, setPlayerCount] = useState(4);
  const [names, setNames] = useState<string[]>(Array.from({length: 12}, (_, i) => `プレイヤー${i + 1}`));
  
  const [roleCounts, setRoleCounts] = useState<Record<Role, number>>({
    '村人': 2, '人狼': 1, '占い師': 1, '霊能者': 0, '狩人': 0, '狂人': 0
  });

  // 人数が変わった時に、デフォルトの役職構成をセットする
  useEffect(() => {
    const config = ROLE_CONFIGS[playerCount] || [];
    const counts: Record<Role, number> = {
      '村人': 0, '人狼': 0, '占い師': 0, '霊能者': 0, '狩人': 0, '狂人': 0
    };
    config.forEach(r => counts[r]++);
    setRoleCounts(counts);
  }, [playerCount]);

  const updateRoleCount = (role: Role, delta: number) => {
    AudioManager.playSE('click');
    setRoleCounts(prev => ({ ...prev, [role]: Math.max(0, prev[role] + delta) }));
  };

  const totalRoles = Object.values(roleCounts).reduce((a, b) => a + b, 0);
  const isRoleCountValid = totalRoles === playerCount;
  
  const werewolvesCount = roleCounts['人狼'];
  const villagersCount = roleCounts['村人'] + roleCounts['占い師'] + roleCounts['霊能者'] + roleCounts['狩人'];
  const isGameBalanceValid = werewolvesCount > 0 && werewolvesCount < villagersCount;

  const canStart = isRoleCountValid && isGameBalanceValid;

  const handleStart = () => {
    if (!canStart) return;
    const rolesArray: Role[] = [];
    (Object.entries(roleCounts) as [Role, number][]).forEach(([role, count]) => {
      for(let i=0; i<count; i++) rolesArray.push(role);
    });
    
    AudioManager.playSE('alert');
    AudioManager.speak('ゲームを開始します。順番に役職を確認してください。');
    
    onStart(playerCount, names.slice(0, playerCount), rolesArray);
  };

  return (
    <ScreenLayout title={<><span className="title-red"><R t="人狼" r="じんろう"/></span>ゲーム</>}>
      <div className="flex-grow flex flex-col space-y-6">
        <div className="bg-black/30 p-6 md:p-8 rounded-[32px] border border-white/10 text-left shrink-0 shadow-inner">
          <label className="flex items-center gap-3 text-2xl font-bold text-blue-300 mb-6 drop-shadow-md">
            <Users className="w-8 h-8" />
            <span><R t="遊" r="あそ"/>ぶ<R t="人数" r="にんずう"/>を<R t="選" r="えら"/>んでね</span>
          </label>
          <div className="grid grid-cols-3 gap-4">
            {[4,5,6,7,8,9,10,11,12].map(n => (
              <Button 
                key={n} 
                onClick={() => setPlayerCount(n)}
                variant={playerCount === n ? 'primary' : 'ghost'}
                className="py-4 text-2xl !rounded-2xl"
              >
                {n}<R t="人" r="にん"/>
              </Button>
            ))}
          </div>
        </div>

        <div className="bg-black/30 p-6 md:p-8 rounded-[32px] border border-white/10 text-left shrink-0 shadow-inner">
          <label className="flex items-center gap-3 text-2xl font-bold text-blue-300 mb-6 drop-shadow-md">
            <VenetianMask className="w-8 h-8" />
            <span><R t="役職" r="やくしょく"/>のカスタマイズ</span>
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {(Object.keys(ROLE_DETAILS) as Role[]).map(role => (
              <div key={role} className="flex flex-col items-center bg-white/5 p-4 rounded-2xl border border-white/10 shadow-sm">
                <span className={`text-xl font-bold mb-3 ${ROLE_DETAILS[role].color}`}>
                  <R t={role} r={ROLE_DETAILS[role].ruby}/>
                </span>
                <div className="flex items-center gap-4">
                  <button onClick={() => updateRoleCount(role, -1)} disabled={roleCounts[role] <= 0} className="w-10 h-10 rounded-full bg-rose-500/80 hover:bg-rose-400 font-bold text-2xl disabled:opacity-30 flex items-center justify-center transition-all">-</button>
                  <span className="text-3xl font-black w-8 text-center">{roleCounts[role]}</span>
                  <button onClick={() => updateRoleCount(role, 1)} disabled={totalRoles >= playerCount} className="w-10 h-10 rounded-full bg-blue-500/80 hover:bg-blue-400 font-bold text-2xl disabled:opacity-30 flex items-center justify-center transition-all">+</button>
                </div>
              </div>
            ))}
          </div>
          {!isRoleCountValid && (
             <p className="text-rose-400 mt-6 font-bold text-center text-lg animate-pulse">
               ※<R t="役職" r="やくしょく"/>の<R t="合計" r="ごうけい"/>（{totalRoles}<R t="人" r="にん"/>）と<R t="遊" r="あそ"/>ぶ<R t="人数" r="にんずう"/>（{playerCount}<R t="人" r="にん"/>）を<R t="合" r="あ"/>わせてください
             </p>
          )}
          {isRoleCountValid && !isGameBalanceValid && (
             <p className="text-rose-400 mt-6 font-bold text-center text-lg animate-pulse">
               ※<R t="人狼" r="じんろう"/>の<R t="数" r="かず"/>は1<R t="人" r="ひとり"/><R t="以上" r="いじょう"/>、かつ<R t="村人" r="むらびと"/>チームより<R t="少" r="すく"/>なくしてください
             </p>
          )}
        </div>

        <div className="bg-black/30 p-6 md:p-8 rounded-[32px] border border-white/10 text-left flex-grow overflow-y-auto min-h-[200px] shadow-inner">
          <p className="text-blue-200/70 font-bold mb-6 text-lg tracking-wide">（<R t="名前" r="なまえ"/>は<R t="変" r="か"/>えることもできます）</p>
          <div className="space-y-4">
            {names.slice(0, playerCount).map((name, i) => (
              <div key={i} className="flex items-center gap-4 group">
                <span className="shrink-0 w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center font-black text-xl text-white/80 group-focus-within:bg-blue-500/50 group-focus-within:border-blue-400 group-focus-within:text-white transition-all shadow-md">
                  {i+1}
                </span>
                <input 
                  type="text" 
                  value={name}
                  onChange={e => {
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

        <Button onClick={handleStart} variant="secondary" icon={<Play className="w-8 h-8"/>} className="mt-2" disabled={!canStart}>
          ゲーム<R t="開始" r="かいし"/>
        </Button>
      </div>
    </ScreenLayout>
  );
}

function RoleCheckPhase({ player, gameState, onNext }: { player: Player, gameState: GameState, onNext: () => void }) {
  const [showRole, setShowRole] = useState(false);

  if (!showRole) {
    return (
      <ScreenLayout title={<><R t="役職" r="やくしょく"/>の<R t="確認" r="かくにん"/></>}>
        <div className="flex-grow flex flex-col justify-center space-y-12 my-auto">
          <div className="bg-gradient-to-br from-blue-900/60 to-indigo-900/60 border-l-[12px] border-blue-400 p-8 md:p-10 rounded-3xl text-left shadow-[0_20px_40px_rgba(0,0,0,0.5)]">
            <p className="text-3xl mb-6 font-bold tracking-wide drop-shadow-md">
              <span className="text-5xl text-blue-300 font-black">{player.name}</span> さんの<R t="番" r="ばん"/>です。
            </p>
            <p className="text-2xl text-white/90 leading-relaxed font-bold">
              <R t="画面" r="がめん"/>を<R t="見" r="み"/>てください。<br/>
              <span className="text-yellow-400 inline-block mt-2 px-4 py-2 bg-black/40 rounded-xl border border-yellow-400/30 shadow-inner">
                （ほかの<R t="人" r="ひと"/>は<R t="見" r="み"/>ないでね！）
              </span>
            </p>
          </div>
          <Button onClick={() => setShowRole(true)} variant="secondary" className="py-8 animate-pulseGlow">
            あなたの<R t="役職" r="やくしょく"/>を<R t="見" r="み"/>る
          </Button>
        </div>
      </ScreenLayout>
    );
  }

  const roleInfo = ROLE_DETAILS[player.role];
  const Icon = roleInfo.icon;

  let additionalInfo = null;
  if (player.role === '占い師' && gameState.seerFirstNightInfo?.seerId === player.id) {
    additionalInfo = <p className="mt-6 p-5 bg-blue-900/60 border-2 border-blue-400 rounded-2xl text-xl text-left text-white w-full shadow-lg">
      あなたは、<strong>{gameState.seerFirstNightInfo.whitePlayerName}</strong>さんが<R t="村人" r="むらびと"/>チームであることを<R t="知" r="し"/>っています。
    </p>;
  }
  if (player.role === '人狼' && player.werewolfAllies && player.werewolfAllies.length > 0) {
    additionalInfo = <p className="mt-6 p-5 bg-rose-900/60 border-2 border-rose-500 rounded-2xl text-xl text-left text-white w-full shadow-lg">
      あなたの<R t="仲間" r="なかま"/>の<R t="人狼" r="じんろう"/>は、<strong>{player.werewolfAllies.join('さん、')}</strong>さんです。
    </p>;
  }

  return (
    <ScreenLayout title={<>{player.name}さんの<R t="役職" r="やくしょく"/></>}>
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
            <R t="確認" r="かくにん"/>したらボタンを<R t="押" r="お"/>して、<R t="次" r="つぎ"/>の<R t="人" r="ひと"/>に<R t="渡" r="わた"/>してね。
          </p>
          <Button onClick={onNext} variant="primary">
            <R t="確認" r="かくにん"/>しました
          </Button>
        </div>
      </div>
    </ScreenLayout>
  );
}

function DayPhase({ gameState, onStartVote, onShowResult }: { gameState: GameState, onStartVote: () => void, onShowResult: () => void }) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    const timerId = setInterval(() => {
      setTimeLeft(t => {
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

  return (
    <ScreenLayout title={<>{gameState.day}<R t="日目" r="にちめ"/>の<R t="昼" r="ひる"/></>}>
      {gameState.gameMessage && (
        <div className="bg-gradient-to-r from-blue-900/60 to-transparent border-l-[8px] border-blue-400 p-6 rounded-2xl text-left mb-8 text-2xl font-bold shrink-0 shadow-lg tracking-wide">
          {gameState.gameMessage}
        </div>
      )}

      <div className="bg-black/30 p-6 md:p-8 rounded-[32px] mb-8 flex-grow overflow-y-auto min-h-0 border border-white/10 shadow-inner">
        <h3 className="text-2xl font-bold text-blue-200/80 text-left border-b-2 border-white/20 pb-3 mb-6 tracking-widest">
          <R t="生" r="い"/>きているプレイヤー
        </h3>
        <div className="flex flex-wrap gap-4">
          {gameState.players.filter(p => p.isAlive).map(p => (
            <div key={p.id} className="bg-white/10 px-5 py-3 rounded-xl font-bold text-xl border border-white/20 shadow-sm backdrop-blur-sm text-white drop-shadow-md">
              {p.name}
            </div>
          ))}
        </div>
      </div>

      {gameState.winner ? (
        <div className="shrink-0 mt-4">
          <p className="text-2xl text-yellow-400 font-bold mb-6 drop-shadow-md animate-pulseGlow">ゲームの<R t="決着" r="けっちゃく"/>がつきました！</p>
          <Button onClick={onShowResult} variant="secondary">
            <R t="最終結果" r="さいしゅうけっか"/>を<R t="見" r="み"/>る
          </Button>
        </div>
      ) : (
        <div className="bg-black/40 p-6 md:p-8 rounded-[32px] border border-white/10 shrink-0 shadow-lg">
          {timeLeft === null ? (
            <div className="space-y-8">
              <label className="block text-3xl font-bold text-blue-300 drop-shadow-md">
                <R t="相談" r="そうだん"/>する<R t="時間" r="じかん"/>を<R t="決" r="き"/>めてね
              </label>
              <div className="grid grid-cols-3 gap-5">
                <Button onClick={() => { AudioManager.playSE('alert'); AudioManager.speak('相談タイム、スタート！'); setTimeLeft(1 * 60); }} variant="ghost" className="!bg-blue-900/40 !border-blue-500/50 !text-white hover:!bg-blue-800/60">1<R t="分" r="ぷん"/></Button>
                <Button onClick={() => { AudioManager.playSE('alert'); AudioManager.speak('相談タイム、スタート！'); setTimeLeft(3 * 60); }} variant="ghost" className="!bg-blue-900/40 !border-blue-500/50 !text-white hover:!bg-blue-800/60">3<R t="分" r="ぷん"/></Button>
                <Button onClick={() => { AudioManager.playSE('alert'); AudioManager.speak('相談タイム、スタート！'); setTimeLeft(5 * 60); }} variant="ghost" className="!bg-blue-900/40 !border-blue-500/50 !text-white hover:!bg-blue-800/60">5<R t="分" r="ふん"/></Button>
              </div>
            </div>
          ) : (
            <div className="space-y-10">
              <div className={`text-8xl md:text-[120px] font-black font-mono tracking-widest ${timeLeft <= 10 ? 'neon-timer-danger animate-pulse' : 'neon-timer'}`}>
                {timeLeft > 0 ? formatTime(timeLeft) : <div className="text-6xl md:text-8xl pt-4"><R t="時間切" r="じかんぎ"/>れ！</div>}
              </div>
              <Button onClick={onStartVote} variant="danger" icon={<Vote className="w-8 h-8"/>}>
                <R t="投票" r="とうひょう"/>へ<R t="進" r="すす"/>む
              </Button>
            </div>
          )}
        </div>
      )}
    </ScreenLayout>
  );
}

function VotePhase({ gameState, onVote }: { gameState: GameState, onVote: (id: number) => void }) {
  const voter = gameState.players.find(p => p.id === gameState.currentVoterId);
  const targets = gameState.tieBreakVote
    ? gameState.players.filter(p => gameState.voteCandidates.includes(p.id))
    : gameState.players.filter(p => p.isAlive);

  if (!voter) return null;

  return (
    <ScreenLayout title={gameState.tieBreakVote ? <span className="title-red"><R t="決選投票" r="けっせんとうひょう"/></span> : <><R t="投票" r="とうひょう"/></>}>
      {gameState.gameMessage && (
        <div className="bg-rose-900/50 border-l-[8px] border-rose-500 p-6 rounded-2xl text-left mb-8 text-2xl font-bold text-white shrink-0 shadow-lg">
          {gameState.gameMessage}
        </div>
      )}
      
      <div className="bg-black/30 p-8 rounded-[32px] mb-8 shrink-0 border border-white/10 shadow-inner">
        <p className="text-3xl font-bold leading-relaxed">
          <span className="text-5xl text-blue-400 font-black drop-shadow-md">{voter.name}</span> さんの<R t="番" r="ばん"/>です。<br/>
          <span className="text-gray-300 mt-4 block text-2xl"><R t="追放" r="ついほう"/>したい<R t="人" r="ひと"/>を<R t="選" r="えら"/>んでください。</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-5 flex-grow overflow-y-auto content-start">
        {targets.filter(t => t.id !== voter.id).map(target => (
          <button 
            key={target.id}
            onClick={() => { AudioManager.init(); AudioManager.playSE('click'); onVote(target.id); }}
            className="btn-3d-base bg-gradient-to-br from-indigo-500 to-purple-700 shadow-[0_8px_0_#4338ca,0_15px_20px_rgba(0,0,0,0.4)] active:shadow-[0_0px_0_#4338ca] text-white font-bold text-2xl h-full min-h-[120px] tracking-wide"
          >
            {target.name}
          </button>
        ))}
      </div>
    </ScreenLayout>
  );
}

function VoteResultPhase({ gameState, onNext }: { gameState: GameState, onNext: () => void }) {
  return (
    <ScreenLayout title={<><R t="投票結果" r="とうひょうけっか"/></>}>
      <div className="flex-grow flex flex-col justify-between">
        {gameState.voteResultData && (
          <div className="bg-black/30 p-6 md:p-8 rounded-[32px] mb-8 flex-grow overflow-y-auto border border-white/10 shadow-inner">
            <ul className="space-y-5 text-left">
              {gameState.voteResultData.map(result => (
                <li key={result.name} className="flex justify-between items-center bg-white/10 p-5 rounded-2xl border border-white/20 shadow-md">
                  <span className="text-3xl font-bold text-white drop-shadow-sm">{result.name}</span>
                  <span className="font-black text-yellow-400 text-3xl drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]">{result.votes} <R t="票" r="ひょう"/></span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="shrink-0">
          <div className={`p-8 rounded-[32px] text-left mb-8 border-l-[12px] shadow-xl ${gameState.exiledPlayerId !== null ? 'bg-rose-900/50 border-rose-500 text-white' : 'bg-gray-800/80 border-gray-500'}`}>
            <p className="text-3xl font-bold leading-relaxed">{gameState.gameMessage}</p>
            {gameState.winner && (
              <p className="text-2xl text-yellow-400 mt-6 animate-pulseGlow font-black tracking-wider">ゲームの<R t="決着" r="けっちゃく"/>がつきました！</p>
            )}
          </div>

          <Button onClick={onNext} variant="primary" icon={gameState.winner ? undefined : <Moon className="w-8 h-8"/>}>
            {gameState.winner ? <><R t="最終結果" r="さいしゅうけっか"/>を<R t="見" r="み"/>る</> : <><R t="夜" r="よる"/>の<R t="行動" r="こうどう"/>へ<R t="進" r="すす"/>む</>}
          </Button>
        </div>
      </div>
    </ScreenLayout>
  );
}

function NightPhase({ player, gameState, onAction, onNext }: { player: Player, gameState: GameState, onAction: (a: string, id: number | null) => void, onNext: () => void }) {
  const [showAction, setShowAction] = useState(false);

  if (gameState.nightActionResult !== null) {
    return (
      <ScreenLayout title={<><R t="行動結果" r="こうどうけっか"/></>}>
        <div className="flex flex-col justify-center h-full space-y-12 my-auto">
          <div className="bg-gradient-to-b from-blue-900/80 to-indigo-900/80 border-[4px] border-blue-400 p-10 rounded-[32px] text-center shadow-[0_0_40px_rgba(96,165,250,0.4)] text-3xl md:text-4xl font-bold leading-relaxed tracking-wide">
            {gameState.nightActionResult}
          </div>
          <p className="text-2xl text-yellow-400 font-bold drop-shadow-md tracking-wide"><R t="確認" r="かくにん"/>したら<R t="次" r="つぎ"/>の<R t="人" r="ひと"/>に<R t="渡" r="わた"/>してね。</p>
          <Button onClick={onNext} variant="primary" className="shrink-0 mt-4">OK</Button>
        </div>
      </ScreenLayout>
    );
  }

  if (!showAction) {
    return (
      <ScreenLayout title={<><R t="夜" r="よる"/>が<R t="来" r="き"/>ました</>}>
         <div className="flex-grow flex flex-col justify-center space-y-12 my-auto">
          <div className="bg-gradient-to-br from-indigo-900/60 to-purple-900/60 border-l-[12px] border-indigo-400 p-8 md:p-10 rounded-[32px] text-left shadow-[0_20px_40px_rgba(0,0,0,0.5)]">
            <p className="text-3xl mb-6 font-bold tracking-wide drop-shadow-md">
              <span className="text-5xl text-indigo-300 font-black">{player.name}</span> さんの<R t="番" r="ばん"/>です。
            </p>
            <p className="text-2xl text-white/90 leading-relaxed font-bold">
              <R t="画面" r="がめん"/>を<R t="見" r="み"/>てください。<br/>
              <span className="text-yellow-400 inline-block mt-4 px-4 py-2 bg-black/40 rounded-xl border border-yellow-400/30 shadow-inner">
                （ほかの<R t="人" r="ひと"/>は<R t="見" r="み"/>ないでね！）
              </span>
            </p>
          </div>
          <Button onClick={() => setShowAction(true)} variant="secondary" className="animate-pulseGlow shrink-0 mt-4" icon={<Moon className="w-8 h-8"/>}>
            <R t="夜" r="よる"/>の<R t="行動" r="こうどう"/>をする
          </Button>
        </div>
      </ScreenLayout>
    );
  }

  const renderActionContent = () => {
    const targets = gameState.players.filter(p => p.isAlive);
    const ActionButtons = ({ action, filterFn, color }: { action: string, filterFn: (p: Player) => boolean, color: string }) => {
      const bgMap: Record<string, string> = {
        purple: "from-purple-500 to-fuchsia-700 shadow-[0_8px_0_#7e22ce,0_15px_20px_rgba(0,0,0,0.4)] active:shadow-[0_0px_0_#7e22ce]",
        rose: "from-rose-500 to-red-700 shadow-[0_8px_0_#be123c,0_15px_20px_rgba(0,0,0,0.4)] active:shadow-[0_0px_0_#be123c]",
        emerald: "from-emerald-500 to-teal-700 shadow-[0_8px_0_#047857,0_15px_20px_rgba(0,0,0,0.4)] active:shadow-[0_0px_0_#047857]",
      };
      return (
        <div className="grid grid-cols-2 gap-5 mt-8 flex-grow overflow-y-auto content-start">
          {targets.filter(filterFn).map(t => (
            <button key={t.id} onClick={() => { AudioManager.init(); AudioManager.playSE('click'); onAction(action, t.id); }} className={`btn-3d-base bg-gradient-to-br ${bgMap[color] || bgMap.purple} text-white font-bold text-2xl h-full min-h-[120px] tracking-wide`}>
              {t.name}
            </button>
          ))}
        </div>
      )
    };

    switch (player.role) {
      case '占い師':
        return (
          <>
            <div className="bg-purple-900/40 p-5 rounded-2xl border border-purple-500/50 shrink-0">
              <p className="text-3xl font-bold text-purple-200 drop-shadow-md"><R t="占" r="うらな"/>いたい<R t="人" r="ひと"/>を<R t="一人" r="ひとり"/><R t="選" r="えら"/>んでね。</p>
            </div>
            <ActionButtons action="fortune-tell" filterFn={p => p.id !== player.id} color="purple" />
          </>
        );
      case '人狼':
        return (
          <>
            {gameState.werewolfChoiceId !== null && (
              <p className="p-5 bg-black/50 border-l-[8px] border-rose-500 mb-6 text-left text-rose-300 text-2xl font-bold shrink-0 shadow-inner">
                <R t="仲間" r="なかま"/>は<strong>{gameState.players.find(p => p.id === gameState.werewolfChoiceId)?.name}</strong>さんを<R t="選" r="えら"/>んでいます。
              </p>
            )}
            <div className="bg-rose-900/40 p-5 rounded-2xl border border-rose-500/50 shrink-0">
              <p className="text-3xl font-bold text-rose-200 drop-shadow-md"><R t="襲撃" r="しゅうげき"/>する<R t="人" r="ひと"/>を<R t="一人" r="ひとり"/><R t="選" r="えら"/>んでね。</p>
            </div>
            <ActionButtons action="attack" filterFn={p => p.role !== '人狼'} color="rose" />
          </>
        );
      case '霊能者':
        return (
          <div className="space-y-12 my-auto w-full">
            <div className="glow-box">
              <Search className="w-32 h-32 mx-auto text-blue-400 drop-shadow-[0_0_20px_rgba(96,165,250,0.8)] float-icon"/>
            </div>
            <p className="text-4xl font-bold text-blue-300 tracking-widest animate-pulse drop-shadow-lg"><R t="霊視" r="れいし"/>しています...</p>
            <Button onClick={() => onAction('shaman', null)} variant="primary" className="mt-8"><R t="結果" r="けっか"/>を<R t="見" r="み"/>る</Button>
          </div>
        );
      case '狩人':
        const guardables = targets.filter(p => p.id !== player.id && p.id !== player.lastGuardedId);
        if (guardables.length > 0) {
          return (
            <>
              <div className="bg-emerald-900/40 p-5 rounded-2xl border border-emerald-500/50 shrink-0">
                <p className="text-3xl font-bold text-emerald-200 drop-shadow-md"><R t="今夜" r="こんや"/>、<R t="人狼" r="じんろう"/>から<R t="守" r="まも"/>る<R t="人" r="ひと"/>を<R t="選" r="えら"/>んでね。</p>
              </div>
              <ActionButtons action="guard" filterFn={p => guardables.includes(p)} color="emerald" />
            </>
          );
        } else {
          return (
            <div className="space-y-12 my-auto w-full">
              <Shield className="w-32 h-32 mx-auto text-gray-500 opacity-50"/>
              <p className="text-4xl font-bold text-gray-400 drop-shadow-md"><R t="守" r="まも"/>れる<R t="人" r="ひと"/>がいません。</p>
              <Button onClick={() => onAction('none', null)} variant="ghost" className="mt-8 !border-gray-500 !text-white">OK</Button>
            </div>
          );
        }
      default:
        return (
          <div className="space-y-12 my-auto w-full bg-black/30 p-10 rounded-[32px] border border-white/10 shadow-inner">
            <Moon className="w-24 h-24 mx-auto text-blue-300/50 animate-pulse"/>
            <p className="text-3xl font-bold text-gray-300 leading-relaxed tracking-wide">
              あなたの<R t="夜" r="よる"/>の<R t="行動" r="こうどう"/>はありません。<br/>
              <R t="朝" r="あさ"/>になるまで<R t="待" r="ま"/>ってね。
            </p>
            <Button onClick={() => onAction('none', null)} variant="primary" className="mt-8">OK</Button>
          </div>
        );
    }
  };

  return (
    <ScreenLayout title={<>{player.name}さんの<R t="行動" r="こうどう"/></>}>
      <div className="flex-grow flex flex-col justify-start w-full">
        {renderActionContent()}
      </div>
    </ScreenLayout>
  );
}

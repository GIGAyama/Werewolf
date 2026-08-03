// ==========================================================================
// ゲームの中核ロジック（画面に依存しない部分）。
//
// App.tsx から切り出しているのは、テストを書けるようにするため。
// 役職の配り方と勝敗の判定を間違えると、授業中に「なぜか終わらない」
// 「勝っているはずなのに続く」といった形で表に出て、その場では直せない。
// ==========================================================================
import type { ReactNode } from 'react';

export type Role = '村人' | '人狼' | '占い師' | '霊能者' | '狩人' | '狂人';
export type Phase = 'setup' | 'roleCheck' | 'day' | 'vote' | 'voteResult' | 'night' | 'result';

export interface Player {
  id: number;
  name: string;
  role: Role;
  isAlive: boolean;
  votedBy: number[];
  voteTo: number | null;
  lastGuardedId: number | null;
  werewolfAllies?: string[];
}

export interface GameState {
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
  gameMessage: ReactNode;
  tieBreakVote: boolean;
  voteCandidates: number[];
  voteResultData: { name: string; votes: number }[] | null;
  seerFirstNightInfo: { seerId: number; whitePlayerName: string } | null;
  winner: '村人陣営' | '人狼陣営' | null;
  nightActionResult?: ReactNode | null;
}

// 村人陣営（＝人狼に襲撃・追放されうる「人間側」）の役職。
// 狂人は人狼陣営として勝敗を共にするが、占いは白・人数は人間として数える。
export const VILLAGER_TEAM_ROLES: Role[] = ['村人', '占い師', '霊能者', '狩人'];

export const ROLE_CONFIGS: Record<number, Role[]> = {
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

export function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export function createInitialState(
  playerCount: number,
  playerNames: string[],
  roles: Role[],
): GameState {
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

  const werewolfNames = players.filter((p) => p.role === '人狼').map((p) => p.name);
  players.forEach((p) => {
    if (p.role === '人狼') {
      p.werewolfAllies = werewolfNames.filter((name) => name !== p.name);
    }
  });

  let seerFirstNightInfo: GameState['seerFirstNightInfo'] = null;
  const seer = players.find((p) => p.role === '占い師');
  if (seer) {
    const whitePlayers = players.filter(
      (p) => p.id !== seer.id && VILLAGER_TEAM_ROLES.includes(p.role),
    );
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

export function checkForWinner(state: GameState): '村人陣営' | '人狼陣営' | null {
  const alivePlayers = state.players.filter((p) => p.isAlive);
  const aliveWerewolves = alivePlayers.filter((p) => p.role === '人狼');
  // 人狼以外は「人間の体」として数える（狂人も含む）。人狼が人間の数以上になったら人狼勝利。
  const aliveHumans = alivePlayers.filter((p) => p.role !== '人狼');

  if (aliveWerewolves.length === 0) return '村人陣営';
  if (aliveWerewolves.length >= aliveHumans.length) return '人狼陣営';
  return null;
}

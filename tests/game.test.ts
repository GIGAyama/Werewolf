// ==========================================================================
// ゲームの中核ロジックのテスト。
//
// ここが壊れると「なぜかゲームが終わらない」「勝っているはずなのに続く」
// という形で授業中に表に出て、その場では直せない。役職の配り方と
// 勝敗の判定だけは、必ず自動で確かめる。
// ==========================================================================
import { describe, it, expect } from 'vitest';
import {
  ROLE_CONFIGS,
  VILLAGER_TEAM_ROLES,
  shuffleArray,
  createInitialState,
  checkForWinner,
  type Role,
  type GameState,
  type Player,
} from '../src/game';

/** 役職の並びから、テスト用のゲーム状態を作る */
function stateOf(roles: Role[], aliveFlags?: boolean[]): GameState {
  const players: Player[] = roles.map((role, i) => ({
    id: i,
    name: `P${i + 1}`,
    role,
    isAlive: aliveFlags ? aliveFlags[i] : true,
    votedBy: [],
    voteTo: null,
    lastGuardedId: null,
  }));
  return { ...createInitialState(roles.length, [], []), players };
}

describe('ROLE_CONFIGS（人数ごとの既定の役職構成）', () => {
  it('4〜12人すべてが定義されている', () => {
    for (let n = 4; n <= 12; n++) {
      expect(ROLE_CONFIGS[n], `${n}人の構成`).toBeDefined();
    }
  });

  it('役職の数が、その人数とぴったり一致する', () => {
    for (let n = 4; n <= 12; n++) {
      expect(ROLE_CONFIGS[n].length, `${n}人の構成`).toBe(n);
    }
  });

  it('どの人数でも、人狼が1人以上いて、かつ人狼以外より少ない', () => {
    // ここが崩れると、始めた瞬間に勝敗が決まってしまう
    for (let n = 4; n <= 12; n++) {
      const wolves = ROLE_CONFIGS[n].filter((r) => r === '人狼').length;
      const others = n - wolves;
      expect(wolves, `${n}人の人狼数`).toBeGreaterThan(0);
      expect(wolves, `${n}人の人狼数`).toBeLessThan(others);
    }
  });

  it('どの人数でも、開始直後は勝敗がついていない', () => {
    for (let n = 4; n <= 12; n++) {
      expect(checkForWinner(stateOf(ROLE_CONFIGS[n])), `${n}人`).toBeNull();
    }
  });
});

describe('checkForWinner（勝敗の判定）', () => {
  it('人狼が全員いなくなったら村人陣営の勝ち', () => {
    const s = stateOf(['村人', '村人', '人狼', '占い師'], [true, true, false, true]);
    expect(checkForWinner(s)).toBe('村人陣営');
  });

  it('人狼の数が人間の数と同じになったら人狼陣営の勝ち', () => {
    // 生存: 村人1・人狼1 → 1 >= 1
    const s = stateOf(['村人', '村人', '人狼', '占い師'], [true, false, true, false]);
    expect(checkForWinner(s)).toBe('人狼陣営');
  });

  it('人狼のほうが多くなっても人狼陣営の勝ち', () => {
    const s = stateOf(['村人', '人狼', '人狼', '占い師'], [true, true, true, false]);
    expect(checkForWinner(s)).toBe('人狼陣営');
  });

  it('人狼が人間より少ないうちは、まだ決着しない', () => {
    const s = stateOf(['村人', '村人', '人狼', '占い師']);
    expect(checkForWinner(s)).toBeNull();
  });

  it('狂人は「人間の頭数」として数える（人狼陣営だが体は人間）', () => {
    // 生存: 狂人1・人狼1。狂人を人狼側に数えると 2>=0 で人狼勝ちになってしまうが、
    // 正しくは 1>=1 でやはり人狼勝ち。数え方の取り違えを固定するためのテスト。
    const s = stateOf(['狂人', '人狼', '村人', '村人'], [true, true, false, false]);
    expect(checkForWinner(s)).toBe('人狼陣営');

    // 生存: 狂人2・人狼1 → 人狼1 < 人間2 なので、まだ続く
    const s2 = stateOf(['狂人', '狂人', '人狼', '村人'], [true, true, true, false]);
    expect(checkForWinner(s2)).toBeNull();
  });

  it('狂人だけが残っても、人狼がいなければ村人陣営の勝ち', () => {
    const s = stateOf(['狂人', '人狼', '村人', '村人'], [true, false, true, true]);
    expect(checkForWinner(s)).toBe('村人陣営');
  });
});

describe('createInitialState（配役）', () => {
  const names = ['あ', 'い', 'う', 'え', 'お', 'か'];

  it('渡した役職が過不足なく全員に配られる', () => {
    const roles = ROLE_CONFIGS[6];
    const s = createInitialState(6, names, roles);
    expect(s.players).toHaveLength(6);
    expect([...s.players.map((p) => p.role)].sort()).toEqual([...roles].sort());
  });

  it('名前が空のときは「プレイヤーN」が入る', () => {
    const s = createInitialState(4, ['', 'いち', '', ''], ROLE_CONFIGS[4]);
    expect(s.players.map((p) => p.name)).toEqual([
      'プレイヤー1',
      'いち',
      'プレイヤー3',
      'プレイヤー4',
    ]);
  });

  it('人狼には、自分以外の人狼の名前だけが仲間として渡る', () => {
    const s = createInitialState(6, names, ROLE_CONFIGS[6]);
    const wolves = s.players.filter((p) => p.role === '人狼');
    expect(wolves.length).toBe(2);
    for (const w of wolves) {
      expect(w.werewolfAllies).toEqual(wolves.filter((o) => o.id !== w.id).map((o) => o.name));
      expect(w.werewolfAllies).not.toContain(w.name);
    }
  });

  it('人狼以外には仲間の情報を渡さない', () => {
    const s = createInitialState(6, names, ROLE_CONFIGS[6]);
    for (const p of s.players.filter((x) => x.role !== '人狼')) {
      expect(p.werewolfAllies).toBeUndefined();
    }
  });

  it('占い師の初日白は、自分以外の村人陣営から選ばれる（人狼・狂人は出ない）', () => {
    // ランダムなので、何度か回して一度も破れないことを確かめる
    for (let i = 0; i < 200; i++) {
      const s = createInitialState(10, [...names, 'き', 'く', 'け', 'こ'], ROLE_CONFIGS[10]);
      const info = s.seerFirstNightInfo;
      expect(info).not.toBeNull();
      const seer = s.players.find((p) => p.id === info!.seerId)!;
      expect(seer.role).toBe('占い師');
      const white = s.players.find((p) => p.name === info!.whitePlayerName)!;
      expect(white.id).not.toBe(seer.id);
      expect(VILLAGER_TEAM_ROLES).toContain(white.role);
    }
  });

  it('占い師がいない構成では、初日白の情報を作らない', () => {
    const s = createInitialState(4, names, ['村人', '村人', '村人', '人狼']);
    expect(s.seerFirstNightInfo).toBeNull();
  });

  it('全員が生きた状態で、1日目の役職確認から始まる', () => {
    const s = createInitialState(5, names, ROLE_CONFIGS[5]);
    expect(s.day).toBe(1);
    expect(s.phase).toBe('roleCheck');
    expect(s.winner).toBeNull();
    expect(s.players.every((p) => p.isAlive)).toBe(true);
  });
});

describe('shuffleArray', () => {
  it('元の配列を書き換えない', () => {
    const original = [1, 2, 3, 4, 5];
    const copy = [...original];
    shuffleArray(original);
    expect(original).toEqual(copy);
  });

  it('要素が増えも減りもしない', () => {
    const result = shuffleArray(['村人', '人狼', '占い師', '狩人']);
    expect([...result].sort()).toEqual(['人狼', '占い師', '村人', '狩人'].sort());
  });

  it('毎回同じ並びにはならない（配役が固定されていないこと）', () => {
    // 同じ並びが 30回続く確率は事実上ゼロ。固定されていたら必ず落ちる。
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) seen.add(shuffleArray(input).join(','));
    expect(seen.size).toBeGreaterThan(1);
  });
});

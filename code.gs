/**
 * @fileoverview 人狼ゲームのサーバーサイドロジックを管理します。
 * ゲームの状態管理、プレイヤーのアクション処理、ルールの適用などを行います。
 */

// PropertiesService を使って、ゲームのデータをプロジェクト内で永続的に保存します。
// これにより、ブラウザを閉じてもゲームの進行状況が消えません。
const scriptProperties = PropertiesService.getScriptProperties();

/**
 * WebアプリケーションにGETリクエスト（通常のアクセス）でアクセスされたときに実行されるメイン関数です。
 * ゲームを初期状態に戻し、メインのHTMLページを表示します。
 * @param {object} e - イベントオブジェクト（今回は未使用）。
 * @returns {HtmlOutput} 画面に表示するためのHTML。
 */
function doGet(e) {
  // 古いゲームデータを削除して、新しいゲームを始められるようにします。
  scriptProperties.deleteProperty('gameState');
  // 'index.html' ファイルをテンプレートとして読み込みます。
  const template = HtmlService.createTemplateFromFile('index');
  // スクリプト自身のURLをHTML側に渡します。
  // これにより、「もう一度遊ぶ」ボタンが正しく動作するようになります。
  template.scriptUrl = ScriptApp.getService().getUrl();
  // HTMLを生成して、タイトルやスマホ表示用の設定を追加して返します。
  return template.evaluate()
    .setTitle('人狼ゲーム')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

/**
 * HTMLファイルに別のHTMLファイル（この場合はCSSやJS）を埋め込むための関数です。
 * @param {string} filename - 埋め込むHTMLファイル名。
 * @returns {string} ファイルの中身のテキスト。
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * 現在のゲームの状態（データ）をPropertiesServiceから取得します。
 * @returns {object | null} ゲーム状態オブジェクト。データがない場合はnull。
 */
function getGameState() {
  const gameStateJSON = scriptProperties.getProperty('gameState');
  // JSON形式の文字列を、JavaScriptが扱えるオブジェクト形式に変換して返します。
  return gameStateJSON ? JSON.parse(gameStateJSON) : null;
}

/**
 * ゲームの状態（データ）をPropertiesServiceに保存します。
 * @param {object} gameState - 保存するゲーム状態オブジェクト。
 */
function saveGameState(gameState) {
  // JavaScriptオブジェクトを、保存に適したJSON形式の文字列に変換します。
  const gameStateJSON = JSON.stringify(gameState);
  scriptProperties.setProperty('gameState', gameStateJSON);
}

/**
 * ゲームを開始し、初期設定を行います。
 * プレイヤーに役職を割り振り、ゲームの最初の状態を作成します。
 * @param {number} playerCount - 参加プレイヤーの人数。
 * @param {string[]} playerNames - 参加プレイヤーの名前の配列。
 * @returns {object} 初期化されたゲーム状態オブジェクト。
 */
function startGame(playerCount, playerNames) {
  const roles = getRoleConfig(playerCount);
  const shuffledRoles = shuffleArray(roles);

  // 各プレイヤーの初期データを作成します。
  const players = playerNames.map((name, index) => ({
    id: index,
    name: name,
    role: shuffledRoles[index],
    isAlive: true, // 生きているか
    votedBy: [],   // このプレイヤーに投票した人のIDリスト
    voteTo: null,  // このプレイヤーが投票した相手のID
    lastGuardedId: null // 【狩人専用】前の夜に守った相手のID
  }));

  // --- ★改善点: 人狼がお互いを認識できるように、仲間の名前を教える ---
  // まず、このゲームに参加している人狼全員のリストを作る
  const werewolves = players.filter(p => p.role === '人狼');
  const werewolfNames = werewolves.map(p => p.name);

  // 各プレイヤーのデータに、仲間の人狼情報を追加する
  players.forEach(player => {
    // もしプレイヤーの役職が「人狼」だったら
    if (player.role === '人狼') {
      // 自分以外の仲間人狼の名前のリストを 'werewolfAllies' という項目に保存する
      player.werewolfAllies = werewolfNames.filter(name => name !== player.name);
    }
  });
  // --- 改善ここまで ---

  // 占い師がいる場合、初日の夜にランダムで「人狼ではない」と分かる情報を1つ与えます。（ゲームバランス調整のため）
  let seerFirstNightInfo = null;
  const seer = players.find(p => p.role === '占い師');
  if (seer) {
    // 村人チームの役職リスト
    const villagerTeamRoles = ['村人', '占い師', '霊能者', '狩人'];
    // 占い師以外の村人チームのプレイヤーを探す
    const whitePlayers = players.filter(p => p.id !== seer.id && villagerTeamRoles.includes(p.role));
    if (whitePlayers.length > 0) {
      // その中からランダムで1人選ぶ
      const randomWhitePlayer = whitePlayers[Math.floor(Math.random() * whitePlayers.length)];
      seerFirstNightInfo = {
        seerId: seer.id,
        whitePlayerName: randomWhitePlayer.name
      };
    }
  }

  // ゲーム全体の初期状態を定義します。
  const gameState = {
    players: players,
    playerCount: playerCount,
    day: 1, // ゲームの日数
    phase: 'roleCheck', // 現在のフェーズ (setup, roleCheck, day, vote, night, result)
    currentTurnPlayerIndex: 0, // 役職確認や夜の行動の順番を管理するインデックス
    currentVoterId: null, // 現在投票する人のID
    exiledPlayerId: null, // 昼に追放された人のID
    attackedPlayerId: null, // 夜に人狼に襲撃された人のID
    guardedPlayerId: null, // 夜に狩人に守られた人のID
    werewolfChoiceId: null, // (人狼が複数いる場合) 1人目の人狼が選んだ襲撃先のID
    gameMessage: '', // 画面に表示するメッセージ
    timerDuration: 5, // 相談時間のデフォルト値
    tieBreakVote: false, // 決選投票かどうか
    voteCandidates: [], // 決選投票の候補者IDリスト
    voteResultData: null, // 投票結果のデータ
    seerFirstNightInfo: seerFirstNightInfo, // 占い師の初日情報
    winner: null // 勝者が決まった場合に陣営名が入る ('村人陣営' or '人狼陣営')
  };

  saveGameState(gameState);
  return gameState;
}

/**
 * 役職確認フェーズで、次のプレイヤーに進めるための関数です。
 * 全員の確認が終わったら、昼フェーズに移行します。
 * @returns {object} 更新されたゲーム状態オブジェクト。
 */
function nextRoleCheck() {
  const gameState = getGameState();
  gameState.currentTurnPlayerIndex++;
  // 全員の確認が終わったかチェック
  if (gameState.currentTurnPlayerIndex >= gameState.playerCount) {
    gameState.phase = 'day'; // 昼フェーズへ
    gameState.gameMessage = `${gameState.day}日目の昼になりました。`;
    gameState.currentTurnPlayerIndex = 0;
  }
  saveGameState(gameState);
  return gameState;
}

/**
 * 投票フェーズを開始します。
 * 投票に関するデータをリセットします。
 * @returns {object} 更新されたゲーム状態オブジェクト。
 */
function startVotePhase() {
  const gameState = getGameState();
  gameState.phase = 'vote';
  // 投票データをリセット
  gameState.players.forEach(p => {
    p.votedBy = [];
    p.voteTo = null;
  });
  gameState.tieBreakVote = false;
  gameState.voteCandidates = [];
  gameState.gameMessage = '追放したい人に投票してください。';
  // 生きているプレイヤーの中から最初の投票者を探して設定
  gameState.currentVoterId = findNextVoter(gameState, -1)?.id ?? null;

  saveGameState(gameState);
  return gameState;
}

/**
 * プレイヤーからの投票を処理し、次のターンの状態を返します。
 * 全員の投票が終わったら、投票結果の集計処理に移ります。
 * @param {number} voterId - 投票したプレイヤーのID。
 * @param {number} targetId - 投票されたプレイヤーのID。
 * @returns {object} 更新されたゲーム状態オブジェクト。
 */
function submitVoteAndGetNextTurn(voterId, targetId) {
  let gameState = getGameState();
  const voter = gameState.players.find(p => p.id === voterId);
  const target = gameState.players.find(p => p.id === targetId);

  // 投票を記録（まだ投票していない場合のみ）
  if (voter && target && voter.voteTo === null) {
    voter.voteTo = targetId;
    target.votedBy.push(voterId);
  }

  // 次の投票者を探す
  const nextVoter = findNextVoter(gameState, voterId);

  if (nextVoter) {
    // まだ投票者がいる場合
    gameState.currentVoterId = nextVoter.id;
    saveGameState(gameState);
    return gameState;
  } else {
    // 全員の投票が終わったので、結果を処理
    return processVotes(gameState);
  }
}

/**
 * 投票結果画面から夜フェーズへ進むための関数です。
 * @returns {object} 更新されたゲーム状態オブジェクト。
 */
function acknowledgeVoteResultAndStartNight() {
  const gameState = getGameState();
  gameState.phase = 'night';
  gameState.currentTurnPlayerIndex = 0;
  // 夜の行動に関するデータをリセット
  gameState.guardedPlayerId = null;
  gameState.attackedPlayerId = null;
  gameState.werewolfChoiceId = null;
  saveGameState(gameState);
  return gameState;
}

// --- 内部ヘルパー関数 ---

/**
 * 次に投票するプレイヤーを探します。
 * @param {object} gameState - 現在のゲーム状態。
 * @param {number} lastVoterId - 最後に投票したプレイヤーのID。
 * @returns {object | null} 次の投票者オブジェクト。いない場合はnull。
 */
function findNextVoter(gameState, lastVoterId) {
  const potentialVoters = getPotentialVoters(gameState);
  if (!potentialVoters.length) return null;
  const lastPlayerIndex = gameState.players.findIndex(p => p.id === lastVoterId);
  // 最後の投票者の次の人から順番に探す
  for (let i = 1; i <= gameState.players.length; i++) {
    const nextIndex = (lastPlayerIndex + i) % gameState.players.length;
    const nextPlayer = gameState.players[nextIndex];
    // 投票権があり、まだ投票していない人かチェック
    const isPotentialVoter = potentialVoters.some(v => v.id === nextPlayer.id);
    if (isPotentialVoter && nextPlayer.voteTo === null) {
      return nextPlayer;
    }
  }
  return null;
}

/**
 * 現在の状況で投票権を持つプレイヤーのリストを取得します。
 * @param {object} gameState - 現在のゲーム状態。
 * @returns {object[]} 投票権を持つプレイヤーの配列。
 */
function getPotentialVoters(gameState) {
  const alivePlayers = gameState.players.filter(p => p.isAlive);
  // 決選投票の場合は、候補者以外が投票者になる
  return gameState.tieBreakVote
    ? alivePlayers.filter(p => !gameState.voteCandidates.includes(p.id))
    : alivePlayers;
}

/**
 * 全員の投票が集まった後に、結果を集計・処理する関数です。
 * この関数内で追放者決定直後に勝利判定が行われます。
 * @param {object} gameState - 現在のゲーム状態。
 * @returns {object} 更新されたゲーム状態オブジェクト。
 */
function processVotes(gameState) {
  const alivePlayers = gameState.players.filter(p => p.isAlive);
  let maxVotes = 0;
  let exiledCandidates = []; // 最多得票数の候補者リスト
  // 投票対象者（通常は全員、決選投票時は候補者のみ）
  const voteTargets = gameState.tieBreakVote
    ? gameState.players.filter(p => gameState.voteCandidates.includes(p.id))
    : alivePlayers;

  // 最多得票者を探す
  voteTargets.forEach(player => {
    const voteCount = player.votedBy.length;
    if (voteCount > maxVotes) {
      maxVotes = voteCount;
      exiledCandidates = [player.id];
    } else if (voteCount === maxVotes && maxVotes > 0) {
      exiledCandidates.push(player.id);
    }
  });
  // 投票結果の表示用データを作成
  gameState.voteResultData = alivePlayers.map(p => ({
    name: p.name,
    votes: p.votedBy.length
  })).sort((a, b) => b.votes - a.votes);

  if (exiledCandidates.length === 1) {
    // 最多得票者が1人の場合：そのプレイヤーを追放
    const exiledPlayerId = exiledCandidates[0];
    gameState.players.find(p => p.id === exiledPlayerId).isAlive = false;
    gameState.exiledPlayerId = exiledPlayerId;
    const exiledPlayerName = gameState.players.find(p => p.id === exiledPlayerId).name;
    gameState.gameMessage = `${exiledPlayerName}さんが追放されました。`;
    
    // 追放者が出た直後に勝利判定を実行
    const winner = checkForWinner(gameState);
    if (winner) {
      gameState.winner = winner;
      gameState.gameMessage = `${exiledPlayerName}さんが追放され、${winner}の勝利が決定しました！`;
    }
    gameState.phase = 'voteResult';

  } else if (exiledCandidates.length > 1) {
    // 最多得票者が複数の場合：決選投票へ
    const voters = alivePlayers.filter(p => !exiledCandidates.includes(p.id));
    
    // 決選投票の投票者がいない場合（例：3人で3人が候補者になった場合）はランダムで追放
    if (voters.length === 0) {
      const randomIndex = Math.floor(Math.random() * exiledCandidates.length);
      const exiledPlayerId = exiledCandidates[randomIndex];
      gameState.players.find(p => p.id === exiledPlayerId).isAlive = false;
      gameState.exiledPlayerId = exiledPlayerId;
      const exiledPlayerName = gameState.players.find(p => p.id === exiledPlayerId).name;
      gameState.gameMessage = `決選投票の結果、同数だったため、${exiledPlayerName}さんがランダムで追放されました。`;
      
      // ここでも勝利判定を実行
      const winner = checkForWinner(gameState);
      if (winner) {
          gameState.winner = winner;
          gameState.gameMessage = `ランダム追放の結果、${winner}の勝利が決定しました！`;
      }
      gameState.phase = 'voteResult';

    } else {
      // 決選投票を行う
      gameState.tieBreakVote = true;
      gameState.voteCandidates = exiledCandidates;
      const candidateNames = exiledCandidates.map(id => gameState.players.find(p => p.id === id).name).join('さんと');
      gameState.gameMessage = `${candidateNames}さんで決選投票を行います。`;
      gameState.phase = 'vote'; // 再度、投票フェーズへ
      // 投票データをリセット
      gameState.players.forEach(p => {
        p.votedBy = [];
        p.voteTo = null;
      });
      gameState.currentVoterId = findNextVoter(gameState, -1)?.id ?? null;
    }

  } else {
    // 最多得票者がいない場合（0票が最大）：誰も追放されない
    gameState.gameMessage = '追放される人はいませんでした。';
    gameState.exiledPlayerId = null;
    gameState.phase = 'voteResult';
  }

  saveGameState(gameState);
  return gameState;
}

// --- 夜フェーズ以降の関数 ---

/**
 * 各役職の夜の行動を処理します。
 * @param {string} action - 行動の種類 ('fortune-tell', 'attack', 'guard')。
 * @param {number} targetId - 行動の対象となるプレイヤーのID。
 * @returns {object} アクションの結果。
 */
function performNightAction(action, targetId) {
  const gameState = getGameState();
  let resultMessage = '';
  switch (action) {
    case 'fortune-tell':
      const targetPlayer = gameState.players.find(p => p.id === targetId);
      // 狂人は人狼ではないと判定
      const isWerewolf = targetPlayer.role === '人狼';
      resultMessage = isWerewolf ? `${targetPlayer.name}さんは人狼です。` : `${targetPlayer.name}さんは人狼ではありませんでした。`;
      break;
    case 'attack':
      // 人狼が複数いる場合、1人目の選択を保存し、2人目の選択で襲撃先を確定する
      const livingWerewolves = gameState.players.filter(p => p.role === '人狼' && p.isAlive);
      if (livingWerewolves.length > 1 && gameState.werewolfChoiceId === null) {
        gameState.werewolfChoiceId = targetId;
      } else {
        gameState.attackedPlayerId = targetId;
      }
      break;
    case 'guard':
      gameState.guardedPlayerId = targetId;
      break;
  }
  saveGameState(gameState);
  return { success: true, message: resultMessage };
}

/**
 * 霊能者の夜の行動の結果を返します。
 * @returns {string} 霊能結果のメッセージ。
 */
function getShamanResult() {
    const gameState = getGameState();
    const exiledPlayer = gameState.players.find(p => p.id === gameState.exiledPlayerId);

    if (exiledPlayer) {
        // 狂人は人狼ではないと判定
        const isWerewolf = exiledPlayer.role === '人狼';
        return `${exiledPlayer.name}さんは、${isWerewolf ? '人狼でした' : '人狼ではありませんでした'}。`;
    } else {
        return '昨夜は追放された人はいませんでした。';
    }
}

/**
 * 夜の行動フェーズで、次のプレイヤーのターンに進めます。
 * @returns {object} 更新されたゲーム状態オブジェクト。
 */
function nextNightTurn() {
  const gameState = getGameState();
  gameState.currentTurnPlayerIndex++;
  saveGameState(gameState);
  return gameState;
}

/**
 * 全員の夜の行動が終わった後、その結果を処理する関数です。
 * 襲撃の成否を判定し、勝者が決まったかを確認します。
 * @returns {object} 更新されたゲーム状態オブジェクト。
 */
function processNightResults() {
  const gameState = getGameState();
  const attackedId = gameState.attackedPlayerId;
  const guardedId = gameState.guardedPlayerId;
  let victim = null;

  // 襲撃が成功したか判定（襲撃対象がいて、かつ、守られていない場合）
  if (attackedId !== null && attackedId !== guardedId) {
    victim = gameState.players.find(p => p.id === attackedId);
    if (victim) {
      victim.isAlive = false;
      gameState.gameMessage = `昨夜の犠牲者は${victim.name}さんでした。`;
    }
  } else {
    gameState.gameMessage = '昨夜は誰も襲撃されませんでした。';
  }

  // 狩人の連続ガード禁止のため、この夜に守った相手を記録
  const hunter = gameState.players.find(p => p.role === '狩人');
  if (hunter) {
      hunter.lastGuardedId = guardedId;
  }

  // 勝利判定
  const winner = checkForWinner(gameState);
  if (winner) {
    gameState.winner = winner;
    // 勝者が決まった場合も、誰が犠牲になったかを表示するため、メッセージは上書きしない
    gameState.gameMessage += `\nそして、${winner}の勝利が決定しました！`;
  }
  // 次の日の昼フェーズへ移行
  gameState.day++;
  gameState.phase = 'day';
  gameState.currentTurnPlayerIndex = 0;

  saveGameState(gameState);
  return gameState;
}

/**
 * ゲームの勝者が決まったかどうかを判定します。
 * @param {object} gameState - 現在のゲーム状態。
 * @returns {string | null} 勝者チームの名前。まだ決まらない場合はnull。
 */
function checkForWinner(gameState) {
  const alivePlayers = gameState.players.filter(p => p.isAlive);
  const aliveWerewolves = alivePlayers.filter(p => p.role === '人狼');
  // 狂人は村人チームではないため、勝利条件の計算から除外
  const villagerTeamRoles = ['村人', '占い師', '霊能者', '狩人'];
  const aliveVillagerTeam = alivePlayers.filter(p => villagerTeamRoles.includes(p.role));

  // 人狼が全滅した場合 → 村人陣営の勝利
  if (aliveWerewolves.length === 0) return '村人陣営';
  // 生きている人狼の数が、生きている村人チームの数以上になった場合 → 人狼陣営の勝利
  if (aliveWerewolves.length >= aliveVillagerTeam.length) return '人狼陣営';
  return null; // まだ勝負はついていない
}

/**
 * 参加人数に応じた役職の構成を返します。
 * @param {number} count - プレイヤーの人数。
 * @returns {string[]} 役職名の配列。
 */
function getRoleConfig(count) {
  // 人数ごとの役職の組み合わせ
  const configs = {
    4:['村人','村人','人狼','占い師'],
    5:['村人','村人','村人','人狼','占い師'],
    6:['村人','村人','村人','人狼','人狼','占い師'],
    7:['村人','村人','村人','村人','人狼','人狼','占い師'],
    8:['村人','村人','村人','村人','村人','人狼','人狼','占い師'],
    9:['村人','村人','村人','村人','村人','人狼','人狼','占い師','霊能者'],
    10:['村人','村人','村人','村人','村人','人狼','人狼','占い師','霊能者','狂人'],
    11:['村人','村人','村人','村人','村人','人狼','人狼','占い師','霊能者','狂人','狩人'],
    12:['村人','村人','村人','村人','村人','村人','人狼','人狼','占い師','霊能者','狂人','狩人'],
  };
  return configs[count] || [];
}

/**
 * 配列の要素をランダムにシャッフルします。（Fisher-Yatesアルゴリズム）
 * @param {Array} array - シャッフルする配列。
 * @returns {Array} シャッフルされた新しい配列。
 */
function shuffleArray(array) {
  const newArray = array.slice(); // 元の配列をコピーして、影響を与えないようにする
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

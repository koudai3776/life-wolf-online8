'use strict';
/* ===== マス定義（楕円配置 x/y は背景画像上の % 座標） ===== */
const SQUARES = [
  {idx:0,  type:'start',  label:'START',     icon:'🏠', x:50, y:87},
  {idx:1,  type:'work',   label:'仕事マス',  icon:'💰', x:43, y:86},
  {idx:2,  type:'happen', label:'ハプニングマス', icon:'❓', x:35, y:84},
  {idx:3,  type:'work',   label:'仕事マス',  icon:'💰', x:29, y:80},
  {idx:4,  type:'fate',   label:'運命マス',  icon:'🎲', x:23, y:74},
  {idx:5,  type:'social', label:'社会マス',  icon:'🌍', x:19, y:68},
  {idx:6,  type:'bond',   label:'縁マス',    icon:'🤝', x:16, y:61},
  {idx:7,  type:'work',   label:'仕事マス',  icon:'💰', x:14, y:53},
  {idx:8,  type:'happen', label:'ハプニングマス', icon:'❓', x:14, y:45},
  {idx:9,  type:'work',   label:'仕事マス',  icon:'💰', x:16, y:37},
  {idx:10, type:'fate',   label:'運命マス',  icon:'🎲', x:19, y:30},
  {idx:11, type:'work',   label:'仕事マス',  icon:'💰', x:23, y:24},
  {idx:12, type:'social', label:'社会マス',  icon:'🌍', x:29, y:18},
  {idx:13, type:'bond',   label:'縁マス',    icon:'🤝', x:35, y:14},
  {idx:14, type:'work',   label:'仕事マス',  icon:'💰', x:43, y:12},
  {idx:15, type:'happen', label:'ハプニングマス', icon:'❓', x:50, y:11},
  {idx:16, type:'work',   label:'仕事マス',  icon:'💰', x:58, y:12},
  {idx:17, type:'fate',   label:'運命マス',  icon:'🎲', x:65, y:14},
  {idx:18, type:'work',   label:'仕事マス',  icon:'💰', x:71, y:18},
  {idx:19, type:'social', label:'社会マス',  icon:'🌍', x:77, y:24},
  {idx:20, type:'bond',   label:'縁マス',    icon:'🤝', x:81, y:30},
  {idx:21, type:'work',   label:'仕事マス',  icon:'💰', x:84, y:37},
  {idx:22, type:'happen', label:'ハプニングマス', icon:'❓', x:86, y:45},
  {idx:23, type:'work',   label:'仕事マス',  icon:'💰', x:86, y:53},
  {idx:24, type:'fate',   label:'運命マス',  icon:'🎲', x:84, y:61},
  {idx:25, type:'social', label:'社会マス',  icon:'🌍', x:81, y:68},
  {idx:26, type:'bond',   label:'縁マス',    icon:'🤝', x:77, y:74},
  {idx:27, type:'work',   label:'仕事マス',  icon:'💰', x:71, y:80},
  {idx:28, type:'happen', label:'ハプニングマス', icon:'❓', x:65, y:84},
  {idx:29, type:'goal',   label:'GOAL',      icon:'🏆', x:58, y:86},
];

const DICE_FACES = ['⚀','⚁','⚂','⚃','⚄','⚅'];

/* ===== 状態 ===== */
const G = {
  myId      : null,
  myName    : '',
  myRole    : 'villager',
  myRoleName: '市民',
  myRoleIcon  : '👤',
  myRoleColor : '#55aaff',
  myRoleDesc  : '',
  myRoleTeam  : 'village',
  myAbilityName: null,
  myAbilityDesc: null,
  roomId    : null,
  isHost    : false,
  battleType  : 'team',  // 'individual' | 'team'
  elimination : 'elim',  // 'elim' | 'survive'
  lwTimeConfig: { ability: 60, council: 90, vote: 60, wolf: 60 }, // 秒（0=無制限）
  lwMaxRounds : 10, // 3〜30
  players   : [],
  phase     : 'lobby',
  round     : 0,
  currentTurn: 0,
  myAsset   : 1000000,
  rolling   : false,
  councilMsgs : [],
  myVoted     : false,
  myVoteTargetId: null,
  voteProgress  : null,
  myAbilityLocked   : false,
  myAbilityTargetId : null,
  abilityMemo       : [],
  turnToken         : 0,
  abilityInfo : null,
  timerInterval: null,
};

/* ===== ボード画面 ⇄ フェーズ画面の切り替え ===== */
function showBoardView() {
  $('lw-view-board').style.display = '';
  $('lw-view-phase').style.display = 'none';
  $('lw-game-header').className = 'game-header';
  hideTimer();
  hideLwHostBtns();
}
function showPhaseView(phaseClass) {
  $('lw-view-board').style.display = 'none';
  $('lw-view-phase').style.display = '';
  $('lw-game-header').className = 'game-header ' + phaseClass;
}

/* ===== タイマー表示（フェーズ画面のカウントダウン） ===== */
function startTimerUI(seconds, color) {
  hideTimer();
  $('gh-timer-box').style.display = '';
  let remain = seconds;
  const fill = $('gh-timer-bar-fill');
  fill.style.background = color || '#7744cc';
  fill.style.width = '100%';
  $('gh-timer-text').textContent = remain + 's';
  G.timerInterval = setInterval(() => {
    remain--;
    if (remain < 0) { hideTimer(); return; }
    $('gh-timer-text').textContent = remain + 's';
    fill.style.width = (remain / seconds * 100) + '%';
    if (remain <= 5) fill.style.background = '#ee4444';
  }, 1000);
}
function hideTimer() {
  if (G.timerInterval) { clearInterval(G.timerInterval); G.timerInterval = null; }
  const box = $('gh-timer-box');
  if (box) box.style.display = 'none';
}

/* ===== ホスト専用：時間切れ前に次フェーズへ進むボタン（人狼ONLINE風） ===== */
function hideLwHostBtns() {
  const wrap = $('lw-host-btns');
  if (wrap) wrap.style.display = 'none';
}
function renderLwHostBtns() {
  const wrap = $('lw-host-btns');
  if (!wrap) return;
  if (!G.isHost) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'flex';
  $('lw-btn-ability-done').style.display = G.phase === 'ability' ? 'inline-block' : 'none';
  $('lw-btn-council-done').style.display = G.phase === 'council' ? 'inline-block' : 'none';
  $('lw-btn-vote-done').style.display    = G.phase === 'voting'  ? 'inline-block' : 'none';
  $('lw-btn-wolf-done').style.display    = G.phase === 'wolfAction' ? 'inline-block' : 'none';
}
function lwHostFinishAbility()    { socket.emit('lw:hostFinishAbility',    { roomId: G.roomId }); }
function lwHostFinishCouncil()    { socket.emit('lw:hostFinishCouncil',    { roomId: G.roomId }); }
function lwHostFinishVote()       { socket.emit('lw:hostFinishVote',       { roomId: G.roomId }); }
function lwHostFinishWolfAction() { socket.emit('lw:hostFinishWolfAction', { roomId: G.roomId }); }

const socket = io();
const $  = id => document.getElementById(id);
const fmt = n  => n.toLocaleString('ja-JP');

/* ===== ロビー UI ===== */
function setBattleType(t) {
  G.battleType = t;
  ['team','individual'].forEach(id => {
    const el = $('rm-'+id);
    if (el) el.classList.toggle('active', id === t);
  });
  if (G.isHost && G.roomId) {
    socket.emit('lw:setBattleType', { roomId: G.roomId, battleType: t });
  }
}

function setElimination(e) {
  G.elimination = e;
  ['elim','survive'].forEach(id => {
    const el = $('rm-'+id);
    if (el) el.classList.toggle('active', id === e);
  });
  if (G.isHost && G.roomId) {
    socket.emit('lw:setElimination', { roomId: G.roomId, elimination: e });
  }
}

/* ===== タイムリミット設定 ===== */
function setLwTimer(phase, seconds) {
  G.lwTimeConfig[phase] = seconds;
  renderLwTimerButtons();
  if (G.isHost && G.roomId) {
    socket.emit('lw:setTimers', { roomId: G.roomId, timeConfig: G.lwTimeConfig });
  }
}

function renderLwTimerButtons() {
  ['ability','council','vote','wolf'].forEach(phase => {
    const wrap = $('tcb-lw-' + phase);
    if (!wrap) return;
    wrap.querySelectorAll('.lw-tc-btn').forEach(btn => {
      btn.classList.toggle('sel', parseInt(btn.dataset.val) === G.lwTimeConfig[phase]);
    });
  });
}

function renderLwTimerView() {
  const el = $('rs-time-view-text');
  if (!el) return;
  const label = s => s === 0 ? '無制限' : s + '秒';
  el.innerHTML = [
    `🎴 能力フェーズ：${label(G.lwTimeConfig.ability)}`,
    `💬 会議フェーズ：${label(G.lwTimeConfig.council)}`,
    `🗳️ 投票フェーズ：${label(G.lwTimeConfig.vote)}`,
    `🐺 人狼行動フェーズ：${label(G.lwTimeConfig.wolf)}`,
  ].join('　');
}

/* ===== 最大ラウンド数設定（3〜30） ===== */
function changeMaxRounds(delta) {
  const next = Math.min(30, Math.max(3, G.lwMaxRounds + delta));
  if (next === G.lwMaxRounds) return;
  G.lwMaxRounds = next;
  renderLwRoundsVal();
  if (G.isHost && G.roomId) {
    socket.emit('lw:setRounds', { roomId: G.roomId, maxRounds: G.lwMaxRounds });
  }
}

function renderLwRoundsVal() {
  const el = $('rs-rounds-val');
  if (el) el.textContent = G.lwMaxRounds;
}

function renderLwRoundsView() {
  const el = $('rs-rounds-view-text');
  if (el) el.textContent = `${G.lwMaxRounds} ラウンド`;
}

/* ===== 非ホスト向け 対戦形式・脱落設定 表示 ===== */
function renderLwModeView() {
  const b = $('rs-battle-view-text');
  const e = $('rs-elim-view-text');
  if (b) b.textContent = G.battleType === 'individual' ? '🏆 個人戦（資産が一番多い人の勝利）' : '🐺 陣営戦（陣営の資産平均が多い方の勝利）';
  if (e) e.textContent = G.elimination === 'elim' ? '🔴 脱落あり（処刑されたら即終了）' : '🟡 脱落なし（資産半減して継続）';
}

function showErr(msg) {
  const e1 = $('lw-err');  if (e1) e1.textContent = msg;
  const e2 = $('room-err'); if (e2) e2.textContent = msg;
}

function createRoom() {
  const name = $('lw-name').value.trim();
  if (!name) { showErr('名前を入力してください'); return; }
  G.myName = name;
  socket.emit('lw:createRoom', { name });
}

function joinRoom() {
  const name   = $('lw-name').value.trim();
  const roomId = ($('lw-room-id').value || '').trim().toUpperCase();
  if (!name)   { showErr('名前を入力してください'); return; }
  if (!roomId) { showErr('ルームIDを入力してください'); return; }
  G.myName = name;
  socket.emit('lw:joinRoom', { name, roomId });
}

function copyRoomId() {
  navigator.clipboard.writeText(G.roomId).then(() => {
    const btn = document.querySelector('.rs-copy-btn');
    if (btn) { btn.textContent = '✅ コピー完了'; setTimeout(() => btn.textContent = '📋 コピー', 1500); }
  });
}

/* ===== ルーム設定画面 ===== */

/* 役職プール */
const LW_ROLE_IDS = ['werewolf','seer','detective','lawyer','guard','priest','scammer','gambler','spy','villager'];
G.rolePool = { werewolf:1, seer:0, detective:0, lawyer:0, guard:0, priest:0, scammer:0, gambler:0, spy:0, villager:0 };

function renderRoleCounters() {
  LW_ROLE_IDS.forEach(r => {
    const el = $('rc-'+r);
    if (el) el.textContent = G.rolePool[r] || 0;
  });
  // 選択合計 vs プレイヤー数
  const selected = Object.values(G.rolePool).reduce((a,b) => a+b, 0);
  const total    = G.players.length;
  const el = $('rs-role-count');
  if (el) el.textContent = `選択: ${selected} / ${total} プレイヤー`;
}

function changeRole(role, delta) {
  const max = 8;
  G.rolePool[role] = Math.max(0, Math.min(max, (G.rolePool[role] || 0) + delta));
  if (role === 'werewolf' && G.rolePool[role] < 1) G.rolePool[role] = 1; // 人狼は最低1
  renderRoleCounters();
}

function setRoleDefault() {
  const n = G.players.length;
  const empty = { werewolf:1, seer:0, detective:0, lawyer:0, guard:0, priest:0, scammer:0, gambler:0, spy:0, villager:0 };
  if      (n <= 3) G.rolePool = { ...empty };
  else if (n === 4) G.rolePool = { ...empty, seer:1 };
  else if (n === 5) G.rolePool = { ...empty, seer:1, detective:1 };
  else if (n === 6) G.rolePool = { ...empty, werewolf:2, seer:1, detective:1 };
  else if (n === 7) G.rolePool = { ...empty, werewolf:2, seer:1, detective:1, guard:1 };
  else              G.rolePool = { ...empty, werewolf:2, seer:1, detective:1, guard:1, lawyer:1 };
  renderRoleCounters();
}

function clearRoles() {
  G.rolePool = { werewolf:1, seer:0, detective:0, lawyer:0, guard:0, priest:0, scammer:0, gambler:0, spy:0, villager:0 };
  renderRoleCounters();
}

function toggleRoleSettings() {
  const body  = $('rs-accord-body');
  const arrow = $('rs-accord-arrow');
  const open  = body.style.display === 'none';
  body.style.display  = open ? '' : 'none';
  arrow.textContent   = open ? '▲' : '▼';
}

function addCpu() {
  socket.emit('lw:addCpu', { roomId: G.roomId });
}
function removeCpu() {
  socket.emit('lw:removeCpu', { roomId: G.roomId });
}

function startGame() {
  if (G.players.length < 3) {
    showErr('3人以上必要です（CPUを追加するか、プレイヤーの参加を待ってください）');
    return;
  }
  socket.emit('lw:startGame', { roomId: G.roomId, rolePool: G.rolePool, battleType: G.battleType, elimination: G.elimination, timeConfig: G.lwTimeConfig, maxRounds: G.lwMaxRounds });
}

/* ===== 画面切替 ===== */
function showScreen(id) {
  ['s-lobby','s-room','s-game'].forEach(s => $(s).style.display = s === id ? '' : 'none');
}

/* ルール設定画面（s-room）から、ルーム作成／参加画面（s-lobby）へ戻る。
   サーバー側のルーム参加状態もきれいにリセットするためページを再読み込みする。 */
function backToRoomSetup() {
  location.reload();
}

/* ===== ルームプレイヤーリスト描画 ===== */
function renderRoomPlayers(players) {
  $('room-players').innerHTML = players.map(p => `
    <div class="rs-player-row">
      <div class="rs-player-avatar" style="background:${p.color}">
        ${p.name.slice(0,1).toUpperCase()}
      </div>
      <span class="rs-player-name">${p.cpu ? '🤖 ' : ''}${p.name}</span>
      ${p.id === G.roomHostId ? '<span class="rs-player-badge">ホスト</span>' : ''}
      ${p.cpu ? '<span class="rs-player-cpu">CPU</span>' : ''}
    </div>`).join('');

  // ホストのみ：3人未満はボタンを無効化 & ラベルで人数不足を表示
  if (G.isHost) {
    const btn = $('btn-start');
    const enough = players.length >= 3;
    btn.disabled = !enough;
    btn.textContent = enough
      ? '▶ ゲーム開始'
      : `▶ ゲーム開始（あと${3 - players.length}人必要）`;
    btn.style.opacity = enough ? '' : '0.45';
    btn.style.cursor  = enough ? '' : 'not-allowed';
  }

  renderRoleCounters();
}

/* ===== ボード描画 ===== */
function buildBoard() {
  const board = $('lw-board');
  board.innerHTML = '';

  SQUARES.forEach(sq => {
    const cell = document.createElement('div');
    cell.id        = `sq-${sq.idx}`;
    cell.className = `sq sq-${sq.type}`;
    cell.style.left = `${sq.x}%`;
    cell.style.top  = `${sq.y}%`;
    cell.innerHTML = `
      <span class="sq-icon">${sq.icon}</span>
      <span class="sq-num">${sq.idx}</span>
      <div class="sq-tooltip">
        <div class="sq-label">${sq.label}</div>
        ${sq.sub ? `<div class="sq-sub">${sq.sub}</div>` : ''}
      </div>
      <div class="sq-pieces" id="pieces-${sq.idx}"></div>`;
    board.appendChild(cell);
  });
}

/* ===== コマ配置 ===== */
function renderPieces(players) {
  // 全コマをクリア
  SQUARES.forEach(sq => {
    const el = $(`pieces-${sq.idx}`);
    if (el) el.innerHTML = '';
  });

  players.forEach(p => {
    if (!p.alive && G.elimination === 'elim') return; // 脱落者のコマは表示しない
    const container = $(`pieces-${p.position}`);
    if (!container) return;
    const piece = document.createElement('div');
    piece.className = 'piece' + (p.id === G.players[G.currentTurn]?.id ? ' current-turn' : '');
    piece.id        = `piece-${p.id}`;
    piece.style.background = p.color;
    piece.title     = p.name;
    piece.textContent = p.name.charAt(0);
    container.appendChild(piece);
  });
}

/* ===== コマ移動アニメーション ===== */
async function animateMove(playerId, oldPos, newPos) {
  // 1マスずつ順番に移動するアニメーション
  const steps = ((newPos - oldPos + 30) % 30);
  for (let i = 1; i <= steps; i++) {
    const pos = (oldPos + i) % 30;
    // 旧マスから削除
    const prevPos = (oldPos + i - 1) % 30;
    const prevContainer = $(`pieces-${prevPos}`);
    if (prevContainer) {
      const oldPiece = prevContainer.querySelector(`#piece-${playerId}`);
      if (oldPiece) oldPiece.remove();
    }
    // 新マスに追加
    const container = $(`pieces-${pos}`);
    if (container) {
      const piece = document.createElement('div');
      piece.className  = 'piece moving';
      piece.id         = `piece-${playerId}`;
      const p = G.players.find(q => q.id === playerId);
      if (p) { piece.style.background = p.color; piece.textContent = p.name.charAt(0); }
      container.appendChild(piece);
    }
    await sleep(220);
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ===== ゲーム画面レンダリング ===== */
const phaseLabels = {
  roleReveal : '🎭 役職確認中',
  rolling    : '🎲 移動フェーズ',
  moving     : '🏃 移動中…',
  event      : '📋 イベント処理中',
  ability    : '🧠 能力使用フェーズ',
  council    : '🐺 会議フェーズ',
  voting     : '🗳 投票フェーズ',
  wolfAction : '🐺 人狼行動フェーズ',
  gameover   : '🏆 ゲーム終了',
};

/* 能力の種類ごとの表示設定（人狼ONLINEの夜フェーズ表示に準拠） */
/* 対戦形式×脱落設定ごとのルール説明文（ロビーで確定した組み合わせに応じて出し分け） */
const LW_RULES_TEXT = {
  team: {
    elim: '人狼全滅で村人陣営、人狼が村人陣営以上の人数になれば人狼陣営の勝利\n決着がつかなければ、規定ラウンド終了時に残っている陣営メンバーの平均資産が多い方が勝利',
    survive: '誰も脱落しないため、規定ラウンド終了時の陣営の平均資産（全員分）が多い方が勝利',
  },
  individual: {
    elim: '処刑された人は集計から除外されます。残り1人になった瞬間、その人の勝利で即終了\nそれ以外は規定ラウンド終了時、資産トップが勝利',
    survive: '処刑されても資産が半減して続行します。規定ラウンド終了時、資産トップが勝利',
  },
};

function lwBattleLabel() { return G.battleType === 'individual' ? '🏆 個人戦' : '🐺 陣営戦'; }
function lwElimLabel()   { return G.elimination === 'survive' ? '🟡 脱落なし' : '🔴 脱落あり'; }

/* ヘッダー右上のルールバッジ（常時表示・ホバーでルール説明） */
function renderLwRulesBadges() {
  const battleChip = $('gh-battle-chip');
  const elimChip    = $('gh-elim-chip');
  if (!battleChip || !elimChip) return;
  battleChip.textContent = lwBattleLabel();
  elimChip.textContent   = lwElimLabel();
  const ruleText = LW_RULES_TEXT[G.battleType] ? LW_RULES_TEXT[G.battleType][G.elimination] : '';
  battleChip.title = ruleText;
  elimChip.title    = ruleText;
}

const LW_ABILITY_UI = {
  divine: {
    icon: '🔮', question: '誰を占いますか？',
    actIcon: '🔮', actVerb: 'を占いました',
    btnLabel: '🔮 占う', doneLabel: '選択中',
    memo: '占い結果メモ',
  },
  inspectAsset: {
    icon: '🕵️', question: '誰を調べますか？',
    actIcon: '🕵️', actVerb: 'を調べました',
    btnLabel: '🕵️ 調べる', doneLabel: '選択中',
    memo: '調査結果メモ',
  },
  steal: {
    icon: '🐺', question: '誰を狙いますか？',
    actIcon: '🎯', actVerb: 'を狙っています',
    btnLabel: '🐺 狙う', doneLabel: '狙中',
  },
  guardExecution: {
    icon: '⚖️', question: '誰を弁護しますか？',
    actIcon: '⚖️', actVerb: 'を弁護しています',
    btnLabel: '⚖️ 弁護', doneLabel: '弁護中',
  },
  guardAssassination: {
    icon: '💂', question: '誰を護衛しますか？',
    actIcon: '💂', actVerb: 'を護衛しています',
    btnLabel: '💂 護衛', doneLabel: '護衛中',
  },
  gamble: {
    icon: '🎰', question: '誰に勝負を仕掛けますか？',
    actIcon: '🎰', actVerb: 'に勝負を仕掛けました',
    btnLabel: '🎰 賭ける', doneLabel: '賭け中',
  },
  disguise: {
    icon: '🎭', question: '',
    btnLabel: '🎭 偽装', doneLabel: '発動',
  },
};

function renderGameHeader() {
  $('g-round').textContent     = G.round;
  $('g-my-asset').textContent  = fmt(typeof G.myAsset === 'number' ? G.myAsset : 1000000);
  const cur = G.players[G.currentTurn];
  if (cur) $('g-turn-name').textContent = cur.name;
  $('g-phase').textContent = phaseLabels[G.phase] || G.phase;
}

/* 仲間の人狼かどうか（G.allies は人狼本人にしか届かないため、村人陣営では常に false） */
function isWolfAlly(playerId) {
  return !!(G.allies && G.allies.members && G.allies.members.some(m => m.id === playerId));
}

function renderPlayerList() {
  $('g-player-list').innerHTML = G.players.map((p, i) => {
    const isCur     = i === G.currentTurn;
    const isMe      = p.id === G.myId;
    const myAsset   = typeof G.myAsset === 'number' ? G.myAsset : 1000000;
    const isBankrupt = G.elimination === 'survive' && isMe && myAsset === 0;
    const isDead     = !p.alive;
    return `<div class="gp-row${isCur ? ' current' : ''}${isDead ? ' dead' : ''}${isBankrupt ? ' bankrupt' : ''}">
      <div class="gp-color" style="background:${p.color}"></div>
      <span class="gp-name">${p.name}${isWolfAlly(p.id) ? ' <span class="gp-wolf-icon" title="仲間の人狼">🐺</span>' : ''}${isMe ? ' <span style="color:#6655aa;font-size:10px">(自分)</span>' : ''}</span>
      <span class="gp-pos">Sq.${p.position}</span>
      ${isMe ? `<span class="gp-asset${isBankrupt ? ' bankrupt-text' : ''}">${isBankrupt ? '💸 破産' : fmt(myAsset) + '円'}</span>` : ''}
    </div>`;
  }).join('');
}

function renderAction() {
  const panel  = $('g-action');
  const cur    = G.players[G.currentTurn];
  const isMyTurn = cur && cur.id === G.myId;

  if (!isMyTurn || !cur?.alive) {
    panel.innerHTML = `<div class="action-idle">
      ${cur ? `<div style="margin-bottom:8px"><span style="color:${cur.color};font-weight:700">${cur.name}</span> の手番です</div>` : ''}
      ⏳ 他のプレイヤーの手番です…
    </div>`;
    return;
  }

  if (G.phase === 'event') {
    // イベントカードはsquareEventハンドラで表示済み。何もしない
    return;
  }

  if (G.phase === 'rolling') {
    panel.innerHTML = `
      <div class="dice-area">
        <div class="dice-hint">クリックしてサイコロを振る</div>
        <div class="dice" id="dice-el" onclick="rollDice()">🎲</div>
      </div>
      <button class="lw-action-btn primary" onclick="rollDice()">🎲 サイコロを振る！</button>`;
  } else if (G.phase === 'moving') {
    panel.innerHTML = `<div class="moving-indicator">🏃 移動中…</div>`;
  } else if (G.phase === 'waiting') {
    panel.innerHTML = `<div class="action-idle">⏳ 結果を確認中…</div>`;
  }
}

/* ===== ログ追加 ===== */
function addLog(text, cls = 'log-sys') {
  const el  = document.createElement('div');
  el.className    = `log-entry ${cls}`;
  el.textContent  = text;
  const log = $('g-log');
  log.appendChild(el);
  log.scrollTop   = log.scrollHeight;

  const plog = $('lwp-log');
  if (plog) {
    const el2 = document.createElement('div');
    el2.className   = 'le';
    el2.textContent = text;
    plog.appendChild(el2);
    plog.scrollTop  = plog.scrollHeight;
  }
}
function addLogSep(text) {
  const el  = document.createElement('div');
  el.className   = 'log-entry log-sep';
  el.textContent = `── ${text} ──`;
  const log = $('g-log');
  log.appendChild(el);
  log.scrollTop  = log.scrollHeight;

  const plog = $('lwp-log');
  if (plog) {
    const el2 = document.createElement('div');
    el2.className   = 'le';
    el2.textContent = `── ${text} ──`;
    plog.appendChild(el2);
    plog.scrollTop  = plog.scrollHeight;
  }
}

/* ===== フェーズ画面のプレイヤーリスト ===== */
function renderPhasePlayerList() {
  const el = $('lwp-player-list');
  if (!el) return;
  const voting    = G.phase === 'voting' && amIActive();
  const guarding  = G.phase === 'voting' && amIActive() && G.voteGuardInfo && G.voteGuardInfo.ability;
  const acting    = G.phase === 'ability' && G.abilityInfo && G.abilityInfo.ability && !G.myAbilityLocked;
  const wolfActing = G.phase === 'wolfAction' && G.wolfAbilityInfo && G.wolfAbilityInfo.ability && !G.myWolfAbilityLocked;
  const aCfg   = acting ? (LW_ABILITY_UI[G.abilityInfo.ability.id] || {}) : null;
  const wCfg   = wolfActing ? (LW_ABILITY_UI[G.wolfAbilityInfo.ability.id] || {}) : null;

  el.innerHTML = G.players.map(p => {
    const isMe = p.id === G.myId;
    let actionBtn = '';

    if (voting && !isMe && p.alive) {
      const selected = G.myVoted && G.myVoteTargetId === p.id;
      actionBtn += `<button class="lwp-vote-btn${selected ? ' voted' : ''}" onclick="castVote('${p.id}')">${selected ? '✅ 投票済' : '🗳️ 投票'}</button>`;
    }
    if (guarding && !isMe && p.alive) {
      const selected = G.myVoteGuardTargetId === p.id;
      actionBtn += `<button class="lwp-vote-btn guard${selected ? ' voted' : ''}" onclick="useVoteGuard('${p.id}')">${selected ? '✅ 護衛中' : '⚖️ 護衛'}</button>`;
    }
    if (acting) {
      const isValidTarget = G.abilityInfo.targets.some(t => t.id === p.id);
      const rowIsSelfSlot  = G.abilityInfo.selfTargetable && isMe;
      const rowIsOtherSlot = !G.abilityInfo.selfTargetable && !isMe;
      if (isValidTarget && (rowIsSelfSlot || rowIsOtherSlot)) {
        const selected = G.myAbilityTargetId === p.id;
        actionBtn += `<button class="lwp-vote-btn${selected ? ' voted' : ''}" onclick="useAbility('${p.id}')">${selected ? `✅ ${aCfg.doneLabel || '選択中'}` : (aCfg.btnLabel || '🎯 対象')}</button>`;
      }
    }
    if (wolfActing && !isMe) {
      const isValidTarget = G.wolfAbilityInfo.targets.some(t => t.id === p.id);
      if (isValidTarget) {
        const selected = G.myWolfAbilityTargetId === p.id;
        actionBtn += `<button class="lwp-vote-btn${selected ? ' voted' : ''}" onclick="useWolfAbility('${p.id}')">${selected ? `✅ ${wCfg.doneLabel || '選択中'}` : (wCfg.btnLabel || '🎯 対象')}</button>`;
      }
    }

    return `<div class="lwp-pc${!p.alive ? ' dead' : ''}${isMe ? ' me' : ''}">
      <div class="lwp-pc-dot" style="background:${p.color}"></div>
      <div style="flex:1;min-width:0">
        <div class="lwp-pc-name">${p.name}${isWolfAlly(p.id) ? ' <span class="gp-wolf-icon" title="仲間の人狼">🐺</span>' : ''}${isMe ? ' (自分)' : ''}${p.cpu ? ' 🤖' : ''}</div>
        <div class="lwp-pc-tag">${p.alive ? `Sq.${p.position}` : '脱落'}</div>
      </div>
      ${actionBtn}
    </div>`;
  }).join('');
}

/* ===== マスイベントカードを表示 ===== */
function showEventCard(playerName, ev, isMe) {
  const panel = $('g-action');
  // 社会マス（全員に影響）か、自分自身のイベントの時だけ金額を見せる。
  // それ以外（他人の個人イベント）は、どこに止まって何が起きたかは見せつつ、
  // 金額は伏せて「増えた/減った」の方向だけ見せる。
  const showAmount = isMe || ev.isAll;
  const amtText = !showAmount ? '' : ev.amount === 0 ? '±0円'
    : ev.amount > 0 ? `+${fmt(ev.amount)}円` : `${fmt(ev.amount)}円`;
  const amtColor = ev.amount > 0 ? '#55ee88' : ev.amount < 0 ? '#ff6060' : '#8898cc';

  // 方向表示（他人の個人イベント用）：direction は 'up' / 'down' / 'flat'
  const dirText  = ev.direction === 'up' ? '📈 資産が増加'
    : ev.direction === 'down' ? '📉 資産が減少' : '➖ 変化なし';
  const dirColor = ev.direction === 'up' ? '#55ee88' : ev.direction === 'down' ? '#ff6060' : '#8898cc';

  const bgColor  = {
    work:'#0a1220', social:'#0a1a10', happen:'#18100a',
    fate:'#1a1000', start:'#0d1a0d', goal:'#1a0d1a'
  }[ev.squareType] || '#0a0d1e';

  let html = `
    <div class="event-card" style="background:${bgColor}">
      <div class="event-icon">${ev.icon || '❓'}</div>
      <div class="event-title">${ev.name}</div>
      <div class="event-desc">${ev.isAll ? '👥 全員に影響！' : `${playerName}に発生`}</div>
      ${(isMe && ev.boosted) ? `<div style="text-align:center;font-size:11px;color:#ffcc55;margin-top:2px">📈 積立プランで1.5倍になりました</div>` : ''}
      ${showAmount
        ? `<div style="font-size:20px;font-weight:800;color:${amtColor};text-align:center;margin:8px 0">${amtText}</div>`
        : `<div style="font-size:16px;font-weight:700;color:${dirColor};text-align:center;margin:8px 0">${dirText}</div>`}
      <div class="event-desc">${ev.desc}</div>
    </div>`;

  if (isMe) {
    html += `<button class="lw-action-btn primary" style="margin-top:10px" onclick="ackEvent()">
      ✅ 確認して次へ
    </button>`;
  } else {
    html += `<div style="text-align:center;color:#4a5070;font-size:12px;margin-top:8px">
      手番プレイヤーの確認を待っています…
    </div>`;
  }

  panel.innerHTML = html;
}

/* ===== イベント確認ボタン ===== */
function ackEvent() {
  socket.emit('lw:eventAck', { roomId: G.roomId });
}

/* ===== STEP4 能力使用フェーズ UI（lwp-action に表示） ===== */
function renderAbilityPanel() {
  const panel = $('lwp-action');
  const info  = G.abilityInfo;
  if (!info) {
    panel.innerHTML = `<div class="ap-title lwp-title-ability">🧠 能力使用フェーズ</div>
      <div class="ap-info">他のプレイヤーが能力を使用中…</div>`;
    return;
  }
  if (!info.ability) {
    panel.innerHTML = `<div class="ap-title lwp-title-ability">🧠 能力使用フェーズ</div>
      <div class="ap-info">使用可能な能力がありません（クールタイム中 or 役職なし）</div>`;
    return;
  }

  const cfg    = LW_ABILITY_UI[info.ability.id] || {};
  const target = G.myAbilityTargetId ? G.players.find(p => p.id === G.myAbilityTargetId) : null;

  let memoHtml = '';
  if (cfg.memo && G.abilityMemo && G.abilityMemo.length) {
    memoHtml = `<div style="margin-top:8px"><b style="font-size:11px;color:#5060a0">${cfg.memo}</b>
      ${G.abilityMemo.map(m => `<div class="seer-row">${m}</div>`).join('')}</div>`;
  }

  // 占い師・探偵・詐欺師：一度選択したら確定（以降は左のボタンも消える）
  if (G.myAbilityLocked) {
    const doneLine = target
      ? `${cfg.actIcon || '🎯'} <b>${target.name}</b> ${cfg.actVerb || 'を対象にしました'}`
      : (info.selfTargetable ? `${cfg.icon || '🎯'} 発動しました` : '能力を使いませんでした');
    panel.innerHTML = `
      <div class="ap-title lwp-title-ability">${cfg.icon || '🎯'} ${info.ability.name}</div>
      <div class="ap-status">✅ ${doneLine}</div>
      ${memoHtml}
      <div class="ap-info" style="margin-top:6px">他のプレイヤーの完了を待っています…</div>`;
    return;
  }

  // 人狼・弁護士・警備員・ギャンブラー：制限時間内は何度でも選び直せる
  let statusLine;
  if (info.selfTargetable) {
    statusLine = G.myAbilityTargetId
      ? `${cfg.icon || '🎯'} 発動しました`
      : '← 下のボタンから発動してください';
  } else {
    statusLine = target
      ? `${cfg.actIcon || '🎯'} <b>${target.name}</b> ${cfg.actVerb || 'を対象にしました'}`
      : '← 左のプレイヤーを選んでください';
  }

  const changeHint = !info.lockable
    ? `<div class="ap-info" style="margin-top:6px">制限時間内なら対象を選び直せます</div>`
    : '';

  panel.innerHTML = `
    <div class="ap-title lwp-title-ability">${cfg.icon || '🎯'} ${info.ability.name}${cfg.question ? ` — ${cfg.question}` : ''}</div>
    <div class="ap-status">${statusLine}</div>
    ${memoHtml}
    ${changeHint}
    ${info.selfTargetable ? '<div class="ap-info">← 左のプレイヤー一覧、自分の行のボタンから発動できます</div>' : ''}
    <button class="lw-action-btn" style="margin-top:10px" onclick="skipAbility()">⏭ 能力を使わない</button>`;
}

function useAbility(targetId) {
  if (G.myAbilityLocked) return;
  G.myAbilityTargetId = targetId;
  if (G.abilityInfo && G.abilityInfo.lockable) G.myAbilityLocked = true;
  socket.emit('lw:useAbility', { roomId: G.roomId, targetId });
  renderAbilityPanel();
  renderPhasePlayerList();
}
function skipAbility() {
  if (G.myAbilityLocked) return;
  const wasLockable = G.abilityInfo && G.abilityInfo.lockable;
  G.myAbilityTargetId = null;
  if (wasLockable) G.myAbilityLocked = true;
  socket.emit('lw:skipAbility', { roomId: G.roomId });
  renderAbilityPanel();
  renderPhasePlayerList();
}

/* ===== 🐺 人狼行動フェーズ UI（投票フェーズの後。人狼/ギャンブラーの攻撃、警備員の護衛） ===== */
function renderWolfAbilityPanel() {
  const panel = $('lwp-action');
  const info  = G.wolfAbilityInfo;
  if (!info) {
    panel.innerHTML = `<div class="ap-title lwp-title-wolf">🐺 人狼行動フェーズ</div>
      <div class="ap-info">他のプレイヤーが行動中…</div>`;
    return;
  }
  if (!info.ability) {
    panel.innerHTML = `<div class="ap-title lwp-title-wolf">🐺 人狼行動フェーズ</div>
      <div class="ap-info">あなたが行動できる能力はありません（クールタイム中 or 対象の役職ではありません）</div>`;
    return;
  }

  const cfg    = LW_ABILITY_UI[info.ability.id] || {};
  const target = G.myWolfAbilityTargetId ? G.players.find(p => p.id === G.myWolfAbilityTargetId) : null;

  if (G.myWolfAbilityLocked) {
    const doneLine = target
      ? `${cfg.actIcon || '🎯'} <b>${target.name}</b> ${cfg.actVerb || 'を対象にしました'}`
      : '能力を使いませんでした';
    panel.innerHTML = `
      <div class="ap-title lwp-title-wolf">${cfg.icon || '🐺'} ${info.ability.name}</div>
      <div class="ap-status">✅ ${doneLine}</div>
      <div class="ap-info" style="margin-top:6px">他のプレイヤーの完了を待っています…</div>`;
    return;
  }

  const statusLine = target
    ? `${cfg.actIcon || '🎯'} <b>${target.name}</b> ${cfg.actVerb || 'を対象にしました'}`
    : '← 左のプレイヤーを選んでください';

  panel.innerHTML = `
    <div class="ap-title lwp-title-wolf">${cfg.icon || '🐺'} ${info.ability.name}${cfg.question ? ` — ${cfg.question}` : ''}</div>
    <div class="ap-status">${statusLine}</div>
    <div class="ap-info" style="margin-top:6px">制限時間内なら対象を選び直せます</div>
    <button class="lw-action-btn" style="margin-top:10px" onclick="skipWolfAbility()">⏭ 能力を使わない</button>`;
}

function useWolfAbility(targetId) {
  if (G.myWolfAbilityLocked) return;
  G.myWolfAbilityTargetId = targetId;
  socket.emit('lw:useWolfAbility', { roomId: G.roomId, targetId });
  renderWolfAbilityPanel();
  renderPhasePlayerList();
}
function skipWolfAbility() {
  if (G.myWolfAbilityLocked) return;
  G.myWolfAbilityTargetId = null;
  socket.emit('lw:skipWolfAbility', { roomId: G.roomId });
  renderWolfAbilityPanel();
  renderPhasePlayerList();
}

/* ===== 🛒 ショップ（能力フェーズ中に資産で購入→持ち物バッグへ。使うタイミングは自分で選べる） ===== */
const LW_SHOP_ITEMS = [
  { id: 'pickpocket',     name: 'スリ',           icon: '👛', price: 200000, desc: '指定した相手から資産の一部を盗む（資産ロックされていると失敗する）', needsTarget: true, category: 'black' },
  { id: 'voteBoost',      name: '票買収',         icon: '🗳️', price: 250000, desc: '次の投票で、自分の1票を2票分としてカウントする', category: 'black' },
  { id: 'voteShield',     name: '根回し',         icon: '🤝', price: 250000, desc: '次の投票で、自分への票を1票分減らす', category: 'black' },
  { id: 'forgedPassport', name: '偽造パスポート', icon: '🛂', price: 350000, desc: '次に占い師に占われても「市民」と判定される', category: 'black' },
  { id: 'binoculars',     name: '双眼鏡',         icon: '🔭', price: 500000, desc: '指定した相手の役職を知ることができる', needsTarget: true, category: 'item' },
  { id: 'assetLock',      name: '資産ロック',     icon: '🔒', price: 150000, desc: '次に他人から受けるスリを1回無効化する', category: 'item' },
  { id: 'charm',          name: 'お守り',         icon: '🍀', price: 400000, desc: '処刑されても1回だけ生還できる（脱落ありのみ）', elimOnly: true, category: 'item' },
  { id: 'savingsPlan',    name: '積立プラン',     icon: '💰', price: 100000, desc: '次に仕事マスに止まった時の収入を1.5倍にする', category: 'item' },
];
const LW_SHOP_CATEGORY_LABEL = { black: '🕶️ 闇市場', item: '🎒 アイテム', inventory: '🧳 持ち物バッグ' };

let G_shopCategory = null; // 現在開いているショップモーダルのカテゴリ（null=閉じている）

function toggleShopModal(category) {
  if (G_shopCategory === category) { closeShopModal(); return; }
  G_shopCategory = category;
  renderShopModal();
}
function closeShopModal() {
  G_shopCategory = null;
  const modal = $('lw-shop-modal');
  if (modal) modal.style.display = 'none';
  document.querySelectorAll('.gh-shop-btn').forEach(b => b.classList.remove('active'));
  const invChip = $('gh-inventory-chip'); if (invChip) invChip.classList.remove('active');
}

function renderShopModal() {
  const modal = $('lw-shop-modal');
  if (!modal || !G_shopCategory) return;

  document.querySelectorAll('.gh-shop-btn').forEach(b => b.classList.remove('active'));
  const invChip = $('gh-inventory-chip'); if (invChip) invChip.classList.remove('active');
  if (G_shopCategory === 'inventory') {
    if (invChip) invChip.classList.add('active');
  } else {
    const btnIdx = { black: 0, item: 1 }[G_shopCategory];
    const btns = document.querySelectorAll('.gh-shop-btn');
    if (btns[btnIdx]) btns[btnIdx].classList.add('active');
  }

  if (!G.myId) return;
  const me = (G.players || []).find(p => p.id === G.myId);
  const isActive = me && me.alive; // 脱落済みなら購入・使用不可

  let bodyHtml;
  if (G_shopCategory === 'inventory') {
    bodyHtml = renderInventoryBody(isActive);
  } else {
    bodyHtml = renderShopBuyBody(isActive);
  }

  modal.innerHTML = `
    <div class="lw-shop-modal-head">
      <div class="lw-shop-modal-title">${LW_SHOP_CATEGORY_LABEL[G_shopCategory]}</div>
      <button class="lw-shop-modal-close" onclick="closeShopModal()">✕</button>
    </div>
    ${bodyHtml}
    <div id="lwp-shop-result"></div>`;
  modal.style.display = 'block';
}

/* 闇市場／アイテム：購入のみ（対象選択は使う時にする） */
function renderShopBuyBody(isActive) {
  const usedUp = !!G.shopUsedThisRound;
  const visibleItems = LW_SHOP_ITEMS.filter(item =>
    item.category === G_shopCategory && (!item.elimOnly || G.elimination === 'elim'));

  const itemsHtml = visibleItems.map(item => {
    const affordable = isActive && !usedUp && typeof G.myAsset === 'number' && G.myAsset >= item.price;
    return `
      <div class="lwp-shop-item">
        <div class="lwp-shop-item-head">
          <div class="lwp-shop-item-name">${item.icon} ${item.name}</div>
          <div class="lwp-shop-item-price">${fmt(item.price)}円</div>
        </div>
        <div class="lwp-shop-item-desc">${item.desc}</div>
        <div class="lwp-shop-row">
          <button class="lwp-shop-buy-btn" ${affordable ? '' : 'disabled'} onclick="buyShopItem('${item.id}')">購入</button>
        </div>
      </div>`;
  }).join('');

  return (usedUp ? '<div class="lw-shop-modal-note">今ラウンドはすでに購入済みです（1ラウンド1回まで）</div>' : '') + itemsHtml;
}

/* 持ち物バッグ：購入済み・未使用のアイテムを、好きなタイミングで使う */
function renderInventoryBody(isActive) {
  const inv = G.myInventory || [];
  if (inv.length === 0) {
    return '<div class="lw-shop-modal-note">持ち物はありません。闇市場・アイテムで購入すると、ここに追加されます。</div>';
  }
  const targets = (G.players || []).filter(p => p.id !== G.myId && p.alive);

  // 同じアイテムをまとめて「所持数」として表示
  const counts = {};
  inv.forEach(id => { counts[id] = (counts[id] || 0) + 1; });

  const itemsHtml = Object.keys(counts).map(itemId => {
    const item = LW_SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return '';
    const count = counts[itemId];
    const canUse = isActive && (!item.needsTarget || targets.length > 0);
    const optionsHtml = targets.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    return `
      <div class="lwp-shop-item">
        <div class="lwp-shop-item-head">
          <div class="lwp-shop-item-name">${item.icon} ${item.name}</div>
          <div class="lwp-shop-item-price">所持数：${count}</div>
        </div>
        <div class="lwp-shop-item-desc">${item.desc}</div>
        <div class="lwp-shop-row">
          ${item.needsTarget ? `<select class="lwp-shop-select" id="lwp-inv-target-${item.id}" ${targets.length ? '' : 'disabled'}>
            ${targets.length ? optionsHtml : '<option>対象がいません</option>'}
          </select>` : ''}
          <button class="lwp-shop-buy-btn" ${canUse ? '' : 'disabled'} onclick="useShopItem('${item.id}')">使う</button>
        </div>
      </div>`;
  }).join('');

  return itemsHtml;
}

function buyShopItem(itemId) {
  const item = LW_SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) return;
  socket.emit('lw:buyItem', { roomId: G.roomId, itemId });
}

function useShopItem(itemId) {
  const item = LW_SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) return;
  let targetId = null;
  if (item.needsTarget) {
    const sel = $('lwp-inv-target-' + itemId);
    if (!sel || !sel.value) return;
    targetId = sel.value;
  }
  socket.emit('lw:useItem', { roomId: G.roomId, itemId, targetId });
}

/* ===== ③ 会話（会議）フェーズ UI ===== */
function renderCouncilPanel() {
  $('lwp-action').innerHTML = `
    <div class="ap-title lwp-title-council">🐺 会議フェーズ</div>
    <div class="ap-info">これまでの行動を振り返り、誰が人狼か話し合いましょう。</div>`;
}

function sendPhaseChat() {
  const input = $('lwp-chat-input');
  if (!input || !input.value.trim()) return;
  socket.emit('lw:phaseChat', { roomId: G.roomId, message: input.value.trim() });
  input.value = '';
}

/* 人狼行動フェーズは人狼陣営（人狼・ギャンブラー・詐欺師・スパイ）以外は発言できないため、
 * 入力欄を隠して代わりに注記を出す。それ以外のフェーズは通常通りチャット欄を表示する。 */
function updatePhaseChatAccess() {
  const row   = $('lwp-chat-row');
  const note  = $('lwp-chat-note');
  const input = $('lwp-chat-input');
  if (!row || !note) return;
  if (G.phase === 'wolfAction' && G.myRoleTeam !== 'wolf') {
    row.style.display  = 'none';
    note.style.display = '';
    note.textContent   = '🐺 人狼行動フェーズは人狼陣営だけがこっそり話せます';
  } else {
    row.style.display  = '';
    note.style.display = 'none';
    if (input) {
      const placeholders = {
        ability   : '✨ 能力を使用する相手を考えよう',
        wolfAction: '🐺 人狼仲間と作戦を立てよう',
        council   : '💬 みんなで話し合おう',
        voting    : '🗳️ 投票について発言しよう',
      };
      input.placeholder = placeholders[G.phase] || 'メッセージ…';
    }
  }
}

function addPhaseChatMsg(msg) {
  const box = $('lwp-chat-messages');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'lwp-cm' + (msg.isWolfChat ? ' lwp-cm-wolf' : '');
  el.innerHTML = `<span class="lwp-cm-name" style="color:${msg.color}">${msg.name}：</span>${escapeHtml(msg.message)}`;
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
}
/* チャット欄そのものに区切り線を書き込む（人狼ONLINEのaddSysChatと同一仕様）。
 * チャットは一切クリアされず、ゲーム開始からゲーム終了までずっと積み上がっていく。 */
function addPhaseChatSep(text) {
  const box = $('lwp-chat-messages');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'lwp-cm lwp-cm-sys';
  el.textContent = `── ${text} ──`;
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
}
function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

/* ===== 自分が活動中（生存/資産あり）かどうか（モードにより判定基準が異なる） ===== */
function amIActive() {
  if (G.elimination === 'survive') return G.myAsset > 0;
  const me = G.players.find(p => p.id === G.myId);
  return me ? me.alive : true;
}

/* ===== ④ 投票フェーズ UI ===== */
function renderVotePanel() {
  const panel = $('lwp-action');
  if (!amIActive()) {
    panel.innerHTML = `<div class="ap-title lwp-title-voting">🗳 投票フェーズ</div>
      <div class="ap-info">👻 あなたは脱落しているため投票できません。結果をお待ちください…</div>`;
    return;
  }
  const votedPlayer = G.myVoted && G.myVoteTargetId ? G.players.find(p => p.id === G.myVoteTargetId) : null;
  const voteStatus  = votedPlayer ? `<b>${votedPlayer.name}</b>` : (G.myVoted ? '<b>スキップ</b>' : '（未投票）');

  const cast   = G.voteProgress ? G.voteProgress.voted : 0;
  const total  = G.voteProgress ? G.voteProgress.total : G.players.filter(p => p.alive).length;
  const remain = Math.max(0, total - cast);

  // 弁護士：投票フェーズ中に並行して護衛先を選べる（人狼ONLINE方式）
  let guardHtml = '';
  if (G.voteGuardInfo && G.voteGuardInfo.ability) {
    const guardTarget = G.myVoteGuardTargetId ? G.players.find(p => p.id === G.myVoteGuardTargetId) : null;
    guardHtml = `
      <div class="lw-vote-guard-box">
        <div class="ap-title lwp-title-ability" style="font-size:14px">⚖️ ${G.voteGuardInfo.ability.name}（並行して選べます）</div>
        <div class="ap-info">${G.voteGuardInfo.ability.desc}</div>
        <div class="ap-status">護衛先：${guardTarget ? `<b>${guardTarget.name}</b>` : '（未選択）'}</div>
        <button class="lw-action-btn" style="margin-top:6px" onclick="skipVoteGuard()">⏭ 護衛しない</button>
      </div>`;
  }

  panel.innerHTML = `
    <div class="ap-title lwp-title-voting">🗳️ 投票フェーズ — 誰を処刑しますか？</div>
    <div class="ap-status">あなたの投票：${voteStatus}</div>
    <div class="ap-status" style="font-size:18px;font-weight:700;margin-top:6px">
      <span style="color:#f5a020">${cast}</span>
      <span style="color:#7080a0"> / ${total}票</span>
      <span style="color:#a0b0c0;font-size:13px;margin-left:8px">あと${remain}人</span>
    </div>
    <div class="ap-info" style="margin-top:10px">左のプレイヤー一覧から投票してください</div>
    <button class="lw-action-btn" style="margin-top:10px" onclick="castVote(null)">⏭ 投票をスキップ</button>
    ${guardHtml}`;
}

function castVote(targetId) {
  G.myVoted        = true;
  G.myVoteTargetId = targetId;
  socket.emit('lw:vote', { roomId: G.roomId, targetId });
  renderVotePanel();
  renderPhasePlayerList();
}

function useVoteGuard(targetId) {
  G.myVoteGuardTargetId = targetId;
  socket.emit('lw:useVoteGuard', { roomId: G.roomId, targetId });
  renderVotePanel();
  renderPhasePlayerList();
}
function skipVoteGuard() {
  G.myVoteGuardTargetId = null;
  socket.emit('lw:skipVoteGuard', { roomId: G.roomId });
  renderVotePanel();
  renderPhasePlayerList();
}

/* ===== ゲーム終了結果表示 ===== */
function showGameOver(results, info = {}) {
  const { teamWinner, reasonText, individualWinnerId } = info;

  const bannerHtml = teamWinner
    ? `<div class="gameover-banner ${teamWinner === 'wolf' ? 'gob-wolf' : 'gob-village'}">
         ${teamWinner === 'wolf' ? '🐺 人狼陣営の勝利！' : '🏘 村人陣営の勝利！'}
         <div class="gob-sub">${reasonText || ''}</div>
       </div>`
    : `<div class="gameover-banner gob-individual">
         🏆 個人戦勝利
         <div class="gob-sub">${reasonText || ''}</div>
       </div>`;

  const rowHtml = (p, rankLabel) => {
    const statusTag = p.active ? '' : (p.alive ? '（リタイア）' : `（脱落・${p.eliminatedSeq}人目）`);
    const isWinnerRow = G.battleType === 'team' ? (p.team === teamWinner) : (p.id === individualWinnerId);
    return `
    <div class="gameover-row${isWinnerRow ? ' winner' : ''}${rankLabel === undefined ? ' no-rank' : ''}">
      ${rankLabel !== undefined ? `<div class="gor-rank">${rankLabel}</div>` : ''}
      <div class="gor-icon">${p.roleIcon}</div>
      <div class="gor-name" style="color:${p.color}">${p.name}${statusTag}</div>
      <div class="gor-role">${p.roleName}</div>
      <div class="gor-asset">${fmt(p.asset)}円</div>
    </div>`;
  };

  let rowsHtml;
  if (G.battleType === 'team') {
    // 陣営戦：個人の資産順位はつけず、陣営ごとにグループ表示（勝った陣営を上に）
    const wolfList    = results.filter(p => p.team === 'wolf');
    const villageList = results.filter(p => p.team !== 'wolf');
    const groups = teamWinner === 'wolf'
      ? [['🐺 人狼陣営', wolfList], ['🏘 村人陣営', villageList]]
      : [['🏘 村人陣営', villageList], ['🐺 人狼陣営', wolfList]];
    rowsHtml = groups.map(([label, list]) => `
      <div class="gor-team-label">${label}</div>
      ${list.map(p => rowHtml(p)).join('')}
    `).join('');
  } else {
    // 個人戦：資産順位を表示
    rowsHtml = results.map((p, i) => rowHtml(p, i === 0 ? '🥇' : `#${i + 1}`)).join('');
  }

  $('gameover-list').innerHTML = bannerHtml + rowsHtml;
  $('gameover-modal').style.display = '';
}

/* ===== サイコロを振る ===== */
function rollDice() {
  if (G.rolling) return;
  const cur = G.players[G.currentTurn];
  if (!cur || cur.id !== G.myId) return;
  if (G.phase !== 'rolling') return;
  G.rolling = true;

  // ダイスアニメーション
  const diceEl = $('dice-el');
  if (diceEl) diceEl.classList.add('rolling');

  // サイコロアニメーション（見た目だけ）
  let count = 0;
  const interval = setInterval(() => {
    if (diceEl) diceEl.textContent = DICE_FACES[Math.floor(Math.random() * 6)];
    count++;
    if (count >= 8) {
      clearInterval(interval);
      if (diceEl) diceEl.classList.remove('rolling');
      // サーバーに実際のロールを依頼
      socket.emit('lw:rollDice', { roomId: G.roomId });
    }
  }, 80);
}

/* ===== Socket.IO イベント ===== */
socket.on('connect', () => { G.myId = socket.id; });

/* ルーム作成成功 */
socket.on('lw:roomCreated', ({ roomId, room }) => {
  G.roomId      = roomId;
  G.roomHostId  = room.host;
  G.isHost      = true;
  G.players     = room.players;
  G.battleType  = room.battleType  || 'team';
  G.elimination = room.elimination || 'elim';
  if (room.maxRounds) G.lwMaxRounds = room.maxRounds;

  $('room-code-display').textContent = roomId;

  // ホスト専用UI表示
  $('rs-cpu-row').style.display        = '';
  $('rs-role-section').style.display   = '';
  $('rs-battle-section').style.display = '';
  $('rs-elim-section').style.display   = '';
  $('rs-mode-view').style.display      = 'none';
  $('rs-rounds-section').style.display = '';
  $('rs-rounds-view').style.display    = 'none';
  $('rs-time-section').style.display  = '';
  $('rs-time-view').style.display     = 'none';
  $('btn-start').style.display        = '';
  $('waiting-msg').style.display      = 'none';

  setBattleType(G.battleType);
  setElimination(G.elimination);
  renderLwTimerButtons();
  renderLwRoundsVal();
  setRoleDefault();
  renderRoomPlayers(room.players);
  showScreen('s-room');
});

/* ルーム参加成功 */
socket.on('lw:roomJoined', ({ roomId, room }) => {
  G.roomId     = roomId;
  G.roomHostId = room.host;
  G.isHost     = false;
  G.players    = room.players;
  G.battleType  = room.battleType  || 'team';
  G.elimination = room.elimination || 'elim';
  if (room.timeConfig) G.lwTimeConfig = room.timeConfig;
  if (room.maxRounds) G.lwMaxRounds = room.maxRounds;

  $('room-code-display').textContent = roomId;

  // 非ホスト: 操作UI非表示
  $('rs-cpu-row').style.display        = 'none';
  $('rs-role-section').style.display   = 'none';
  $('rs-battle-section').style.display = 'none';
  $('rs-elim-section').style.display   = 'none';
  $('rs-mode-view').style.display      = '';
  renderLwModeView();
  $('rs-rounds-section').style.display = 'none';
  $('rs-rounds-view').style.display    = '';
  renderLwRoundsView();
  $('rs-time-section').style.display = 'none';
  $('rs-time-view').style.display    = '';
  renderLwTimerView();

  renderRoomPlayers(room.players);
  showScreen('s-room');
});

/* プレイヤー更新（誰かが入退室・CPU増減） */
socket.on('lw:roomUpdate', ({ room }) => {
  G.players     = room.players;
  G.battleType  = room.battleType  || G.battleType;
  G.elimination = room.elimination || G.elimination;
  if (room.timeConfig) G.lwTimeConfig = room.timeConfig;
  if (room.maxRounds) G.lwMaxRounds = room.maxRounds;
  if (!G.isHost) {
    renderLwModeView();
    renderLwTimerView();
    renderLwRoundsView();
  }
  renderRoomPlayers(room.players);
});

/* エラー */
socket.on('lw:error', ({ message }) => { showErr(message); });

/* ゲーム開始 */
socket.on('lw:gameStarted', ({ room }) => {
  G.players    = room.players;
  G.round      = room.round;
  G.currentTurn= room.currentTurn;
  G.phase      = 'roleReveal';
  G.battleType  = room.battleType  || G.battleType;
  G.elimination = room.elimination || G.elimination;

  showScreen('s-game');
  buildBoard();
  renderPieces(G.players);
  renderGameHeader();
  renderLwRulesBadges();
  renderPlayerList();
  // 役職モーダルを表示（lw:roleReveal で中身が入る）
  $('role-modal').style.display = '';
  // ルール確認モーダル・ゲームログは役職確認後に表示
});

/* 役職確認モーダルを開く */
socket.on('lw:roleReveal', (info) => {
  G.myRole        = info.role;
  G.myRoleName    = info.roleName;
  G.myRoleIcon    = info.roleIcon;
  G.myRoleColor   = info.roleColor;
  G.myRoleDesc    = info.roleDesc;
  G.myRoleTeam    = info.roleTeam;
  G.myAbilityName = info.abilityName;
  G.myAbilityDesc = info.abilityDesc;
  G.myAsset       = info.asset;
  G.myInventory   = [];
  G.allies        = null;
  renderRoleModalAllies();
  renderLwRoleBadge();

  const modal = $('role-modal');
  modal.style.display = '';

  // アイコン・名前
  $('rmc-icon').textContent  = info.roleIcon;
  $('rmc-name').textContent  = info.roleName;
  $('rmc-name').style.color  = info.roleColor;

  // 陣営バッジ
  const teamEl = $('rmc-team');
  teamEl.textContent  = info.roleTeam === 'wolf' ? '🐺 人狼陣営' : '👥 市民陣営';
  teamEl.className    = `rmc-team ${info.roleTeam === 'wolf' ? 'wolf' : 'village'}`;

  // 説明
  $('rmc-desc').textContent = info.roleDesc;

  // 能力
  if (info.abilityName) {
    $('rmc-ability').style.display     = '';
    $('rmc-ability-name').textContent  = `${info.abilityName}`;
    $('rmc-ability-desc').textContent  = info.abilityDesc;
  } else {
    $('rmc-ability').style.display = 'none';
  }

  // モーダルカード枠の色を陣営で変える
  $('role-modal-card').style.borderColor = info.roleColor + '66';
  $('role-modal-card').style.boxShadow   = `0 0 60px ${info.roleColor}33`;

  // カウントダウン開始
  let sec = 15;
  $('rmc-timer-count').textContent = sec;
  const timerInterval = setInterval(() => {
    sec--;
    if ($('rmc-timer-count')) $('rmc-timer-count').textContent = sec;
    if (sec <= 0) clearInterval(timerInterval);
  }, 1000);
});

/* 仲間の人狼情報（複数人狼のときのみ・人狼ONLINEと同一仕様） */
socket.on('lw:teamReveal', (data) => {
  G.allies = data;
  renderRoleModalAllies();
});

function renderRoleModalAllies() {
  const box = $('rmc-allies');
  if (!box) return;
  const members = (G.allies && G.allies.members) ? G.allies.members.filter(m => m.name !== G.myName) : [];
  if (members.length) {
    $('rmc-allies-names').textContent = members.map(m => m.name).join('、');
    box.style.display = '';
  } else {
    box.style.display = 'none';
  }
}

/* ===== 左上の役職バッジ（タップで役職説明を表示・人狼ONLINEと同一仕様） ===== */
const LW_ROLE_TO_ABILITY = {
  seer: 'divine', detective: 'inspectAsset', werewolf: 'steal',
  lawyer: 'guardExecution', guard: 'guardAssassination',
  scammer: 'disguise', gambler: 'gamble',
};

function renderLwRoleBadge() {
  const badge = $('gh-role-badge');
  if (!badge) return;
  badge.textContent = `${G.myRoleIcon || '❓'} ${G.myRoleName || '？'}`;
  badge.className = 'gh-role-badge' + (G.myRoleTeam === 'wolf' ? ' b-wolf' : '');
}

function toggleLwRoleTooltip() {
  const tip = $('lw-role-tooltip');
  if (!tip) return;
  if (tip.style.display === 'block') { tip.style.display = 'none'; return; }
  fillLwRoleTooltip();
  tip.style.display = 'block';
}

function fillLwRoleTooltip() {
  if (!G.myRoleName) return;
  $('lw-rt-icon').textContent = G.myRoleIcon || '❓';
  $('lw-rt-name').textContent = G.myRoleName || '不明';
  $('lw-rt-team').textContent = G.myRoleTeam === 'wolf' ? '🐺 人狼陣営' : '🏘 村人陣営';
  $('lw-rt-ability').textContent = G.myAbilityName ? `🎯 ${G.myAbilityName}` : '';
  $('lw-rt-desc').textContent = [G.myAbilityDesc, G.myRoleDesc].filter(Boolean).join('\n\n');

  const memo = $('lw-rt-memo'), list = $('lw-rt-memo-list');
  const abilityId = LW_ROLE_TO_ABILITY[G.myRole];
  const cfg = LW_ABILITY_UI[abilityId] || {};
  if (cfg.memo && G.abilityMemo && G.abilityMemo.length) {
    $('lw-rt-memo-label').textContent = cfg.memo;
    list.innerHTML = G.abilityMemo.map(m => `<div class="seer-row">${m}</div>`).join('');
    memo.style.display = 'block';
  } else {
    memo.style.display = 'none';
  }
}

/* クリック外でツールチップを閉じる */
document.addEventListener('click', (e) => {
  const tip = $('lw-role-tooltip'), badge = $('gh-role-badge');
  if (tip && badge && tip.style.display === 'block' && !tip.contains(e.target) && !badge.contains(e.target)) {
    tip.style.display = 'none';
  }
});

/* 役職確認ボタン */
function confirmRole() {
  $('rmc-btn').disabled = true;
  $('rmc-btn').textContent = '✅ 確認済み';
  socket.emit('lw:roleConfirm', { roomId: G.roomId });
}

/* 確認人数の途中経過 */
socket.on('lw:roleRevealProgress', ({ confirmed, total }) => {
  $('rmc-progress').textContent = `${confirmed} / ${total} 人が確認しました`;
});

/* 全員確認 → ルール確認モーダルへ */
socket.on('lw:allRoleConfirmed', () => {
  $('role-modal').style.display = 'none';
  fillRulesModal();
  $('rules-modal').style.display = '';
});

/* ルール確認モーダルの中身を今回の対戦形式・脱落設定に合わせて埋める */
function fillRulesModal() {
  $('rules-battle-title').textContent = `対戦形式：${lwBattleLabel()}`;
  $('rules-elim-title').textContent   = `脱落設定：${lwElimLabel()}`;
  $('rules-battle-desc').textContent  = (LW_RULES_TEXT[G.battleType] || {})[G.elimination] || '';
  $('rules-elim-desc').textContent    = G.elimination === 'survive'
    ? '処刑されても脱落せず、資産が半分になって続行します。'
    : '処刑されたら即座にゲームから脱落します。';
}

/* ルール確認モーダルを閉じてゲーム開始 */
function confirmRules() {
  $('rules-modal').style.display = 'none';
  G.phase = 'rolling';
  renderAction();
  addLogSep('ゲーム開始');
  addLog(`全員に初期資産 1,000,000円 が配布されました`, 'log-sys');
  addLog(`あなたの役職：${G.myRoleName}`, 'log-sys');
  addLog(`最初の手番: ${G.players[0]?.name}`, 'log-sys');
}

/* 手番更新 */
socket.on('lw:turnStart', ({ currentTurn, round, player }) => {
  G.turnToken   = (G.turnToken || 0) + 1; // 古いdiceResult処理が後から状態を上書きしないようにする識別子
  G.currentTurn = currentTurn;
  G.round       = round;
  G.phase       = 'rolling';
  G.rolling     = false;
  showBoardView();
  renderGameHeader();
  renderPlayerList();
  renderAction();
  addLog(`${player.name} の手番（ラウンド ${round}）`, 'log-sys');
});

/* サイコロ結果 */
socket.on('lw:diceResult', async ({ playerId, dice, moveResult }) => {
  const myToken = G.turnToken; // この時点の手番を記録しておく
  const p = G.players.find(q => q.id === playerId);
  addLog(`🎲 ${p?.name || '?'} → ${dice} の目`, 'log-sys');

  // ダイス表示更新
  const diceEl = $('dice-el');
  if (diceEl) diceEl.textContent = DICE_FACES[dice - 1];

  // バックグラウンドタブ等でこの処理が遅延している間に次の手番が始まっていたら、
  // 以降の画面更新（'moving'/'waiting'表示）は行わない（新しい状態を上書きしてしまうため）
  if (G.turnToken !== myToken) return;
  G.phase = 'moving';
  renderAction();

  // コマを1マスずつ動かすアニメーション
  if (moveResult) {
    await animateMove(playerId, moveResult.oldPos, moveResult.newPos);
    // ローカルのプレイヤー状態を更新
    const lp = G.players.find(q => q.id === playerId);
    if (lp) lp.position = moveResult.newPos;
    renderPieces(G.players);
    renderPlayerList();

    // マスイベントのログ表示
    const sq = SQUARES[moveResult.newPos];
    const logClass = {
      work:'log-work', fate:'log-fate', social:'log-social',
      bond:'log-bond', happen:'log-happen', start:'log-sys', goal:'log-sys'
    }[sq?.type] || 'log-sys';
    addLog(`${p?.name} が ${sq?.icon || ''} ${sq?.label || '?'} に止まりました`, logClass);
  }

  if (G.turnToken !== myToken) return; // アニメーション中に次の手番が始まっていないか再確認
  G.phase = 'waiting';
  renderAction();
});

/* ラウンド終了（全員の移動が完了） */
socket.on('lw:roundEnd', ({ round }) => {
  addLogSep(`ラウンド ${round} 終了 — 能力使用フェーズへ`);
});

/* マスイベント発生 */
socket.on('lw:squareEvent', ({ playerId, playerName, event: ev, room, myAsset, playerAssets }) => {
  // プレイヤー状態を更新
  G.players = room.players;
  G.phase = 'event';

  // 自分の資産を更新（playerAssets が来た場合は確実に自分のものを使う）
  if (playerAssets && G.myId in playerAssets) {
    G.myAsset = playerAssets[G.myId];
  } else if (playerId === G.myId && typeof myAsset === 'number') {
    G.myAsset = myAsset;
  }

  // ヘッダーとプレイヤー一覧を更新
  renderGameHeader();
  renderPlayerList();

  // イベントカードを表示
  const isMe = playerId === G.myId;
  showEventCard(playerName, ev, isMe);

  // ログに記録（他人の個人イベントは金額を伏せて方向だけ表示。社会マス・自分のイベントは金額も表示）
  const showAmount = isMe || ev.isAll;
  const amtText = !showAmount ? '' : ev.amount === 0 ? '±0円'
    : ev.amount > 0 ? `+${fmt(ev.amount)}円` : `${fmt(ev.amount)}円`;
  const dirText = ev.direction === 'up' ? '↑資産増加' : ev.direction === 'down' ? '↓資産減少' : '→変化なし';
  const logCls = {
    work:'log-work', social:'log-social', happen:'log-happen',
    fate:'log-fate', bond:'log-bond', start:'log-sys', goal:'log-sys'
  }[ev.squareType] || 'log-sys';

  if (ev.isAll) {
    addLog(`${ev.icon} 【社会イベント】${ev.name}  全員 ${amtText}`, logCls);
  } else {
    addLog(`${ev.icon} ${playerName}：${ev.name}  ${showAmount ? amtText : dirText}`, logCls);
  }
});

/* ===== STEP4 能力使用フェーズ（ラウンド全員同時・画面切替） ===== */
socket.on('lw:abilityPhaseStart', ({ round, duration }) => {
  G.phase = 'ability';
  G.abilityInfo = null;
  G.myAbilityLocked = false;
  G.myAbilityTargetId = null;
  hideTimer();
  showPhaseView('ph-ability');
  $('g-phase').textContent = phaseLabels.ability;
  renderPhasePlayerList();
  renderAbilityPanel();
  G.shopUsedThisRound = false;
  const shopBtns = $('gh-shop-btns'); if (shopBtns) shopBtns.style.display = 'flex';
  if (G_shopCategory) renderShopModal();
  renderLwHostBtns();
  updatePhaseChatAccess();
  addLogSep(`🧠 能力使用フェーズ（ラウンド${round}）`);
  addPhaseChatSep(`ラウンド${round} 能力使用フェーズ`);
  if (duration) startTimerUI(duration, '#9966dd');
});

/* 自分宛にだけ届く能力詳細 */
socket.on('lw:abilityPhase', (info) => {
  G.abilityInfo = info;
  if (G.phase === 'ability') {
    renderAbilityPanel();
    renderPhasePlayerList();
  }
});

/* 対象の選択・変更が確定した（本人のみ受信）。人狼ONLINEと同様に、押した瞬間ボタンの表示が変わる */
socket.on('lw:abilitySelected', ({ targetId, locked }) => {
  G.myAbilityTargetId = targetId;
  G.myAbilityLocked    = locked;
  if (G.phase === 'ability') {
    renderAbilityPanel();
    renderPhasePlayerList();
  }
});

/* ===== 🐺 人狼行動フェーズ（投票フェーズの後・毎ラウンド） ===== */
socket.on('lw:wolfPhaseStart', ({ round, duration }) => {
  G.phase = 'wolfAction';
  G.wolfAbilityInfo = null;
  G.myWolfAbilityLocked = false;
  G.myWolfAbilityTargetId = null;
  hideTimer();
  showPhaseView('ph-wolf');
  $('g-phase').textContent = phaseLabels.wolfAction;
  renderPhasePlayerList();
  renderWolfAbilityPanel();
  if (G_shopCategory === 'inventory') { renderShopModal(); } else { closeShopModal(); }
  const shopBtns = $('gh-shop-btns'); if (shopBtns) shopBtns.style.display = 'none';
  renderLwHostBtns();
  updatePhaseChatAccess();
  addLogSep(`🐺 人狼行動フェーズ（ラウンド${round}）`);
  addPhaseChatSep(`ラウンド${round} 人狼行動フェーズ`);
  if (duration) startTimerUI(duration, '#dd4444');
});

/* 自分宛にだけ届く人狼行動フェーズの詳細（対象の役職のみ受信） */
socket.on('lw:wolfPhase', (info) => {
  G.wolfAbilityInfo = info;
  if (G.phase === 'wolfAction') {
    renderWolfAbilityPanel();
    renderPhasePlayerList();
  }
});

socket.on('lw:wolfAbilitySelected', ({ targetId }) => {
  G.myWolfAbilityTargetId = targetId;
  if (G.phase === 'wolfAction') {
    renderWolfAbilityPanel();
    renderPhasePlayerList();
  }
});

/* ===== ⚖️ 弁護士：投票フェーズ中に並行して届く護衛先の詳細（本人のみ受信） ===== */
socket.on('lw:voteGuardPhase', (info) => {
  G.voteGuardInfo = info;
  G.myVoteGuardTargetId = null;
  if (G.phase === 'voting') {
    renderVotePanel();
    renderPhasePlayerList();
  }
});
socket.on('lw:voteGuardSelected', ({ targetId }) => {
  G.myVoteGuardTargetId = targetId;
  if (G.phase === 'voting') {
    renderVotePanel();
    renderPhasePlayerList();
  }
});

/* 能力使用結果（本人のみ受信） */
socket.on('lw:abilityResult', (result) => {
  if (typeof result.isWolf === 'boolean') {
    const label = result.isWolf ? '🐺 人狼' : '🕊️ 人狼ではない';
    addLog(`🔮 占い結果：${result.targetName} は「${label}」でした`, 'log-fate');
    G.abilityMemo.push(`${result.targetName}：${label}`);
  } else if (typeof result.revealAsset === 'number') {
    addLog(`🕵️ 調査結果：${result.targetName} の現在の資産は ${fmt(result.revealAsset)}円 でした`, 'log-fate');
    G.abilityMemo.push(`${result.targetName}：${fmt(result.revealAsset)}円`);
  } else if (result.protected) {
    addLog(`🛡 ${result.targetName} を今ラウンド守りました`, 'log-sys');
  } else if (result.disguised) {
    addLog(`🎭 次に占われた時、判定を「人狼ではない」と偽装します`, 'log-sys');
  } else if (result.win === true) {
    addLog(`🎰 賭けに成功：${result.targetName} から ${fmt(result.amount)}円 を奪いました`, 'log-wolf');
  } else if (result.win === false) {
    addLog(`🎰 賭けに失敗：${fmt(result.loss)}円 を失いました`, 'log-happen');
  } else if (result.blocked) {
    addLog(`🐺 暗殺失敗：${result.targetName} は護衛されていました`, 'log-wolf');
  } else if (typeof result.amount === 'number') {
    addLog(`🐺 暗殺成功：${result.targetName} から ${fmt(result.amount)}円 を奪いました`, 'log-wolf');
  }
  if (G.phase === 'ability') renderAbilityPanel();
  const tip = $('lw-role-tooltip');
  if (tip && tip.style.display === 'block') fillLwRoleTooltip();
});

/* 神父：処刑された直後、こっそり正体を教えてもらえる（本人のみ受信） */
socket.on('lw:priestReveal', ({ targetName, roleName, roleIcon, team }) => {
  addLog(`⛪ 懺悔：${targetName} の正体は「${roleIcon} ${roleName}」でした`, 'log-fate');
});

/* ショップ：アイテム購入結果（本人のみ受信。誰が何を買ったかは他人には非公開） */
socket.on('lw:itemResult', (result) => {
  if (result && result.error) {
    const msg = {
      insufficient_funds: '資産が足りません',
      invalid_target: '対象を選び直してください',
      invalid_actor: '今は行動できません',
      invalid_item: 'このルールでは利用できません',
      purchase_limit: '今ラウンドはすでに購入済みです（1ラウンド1回まで）',
      not_owned: 'そのアイテムは持っていません',
    }[result.error] || '操作に失敗しました';
    const box = $('lwp-shop-result');
    if (box) box.innerHTML = `<div class="lwp-shop-result err">❌ ${msg}</div>`;
    return;
  }
  if (typeof result.asset === 'number') G.myAsset = result.asset;
  if (Array.isArray(result.inventory)) G.myInventory = result.inventory;
  renderGameHeader();

  const box = $('lwp-shop-result');
  let msgHtml = '';

  if (result.purchased) {
    // 購入のみ（持ち物バッグに追加された。効果はまだ発動していない）
    G.shopUsedThisRound = true;
    addLog(`${result.itemIcon} ${result.itemName} を購入し、持ち物バッグに入れました`, 'log-sys');
    msgHtml = `✅ ${result.itemName} を購入しました（持ち物バッグから好きな時に使えます）`;
  } else if (result.revealRole) {
    addLog(`${result.itemIcon} ${result.itemName}：${result.targetName} の役職は「${result.revealRoleIcon} ${result.revealRole}」でした`, 'log-fate');
    msgHtml = `✅ ${result.targetName} の役職は「${result.revealRoleIcon} ${result.revealRole}」でした`;
  } else if (result.itemId === 'pickpocket') {
    if (result.blocked) {
      addLog(`${result.itemIcon} ${result.itemName}：${result.targetName} は資産ロックしていて失敗しました`, 'log-happen');
      msgHtml = `❌ ${result.targetName} は資産ロックしていて失敗しました`;
    } else {
      addLog(`${result.itemIcon} ${result.itemName}：${result.targetName} から ${fmt(result.amount)}円 盗みました`, 'log-wolf');
      msgHtml = `✅ ${result.targetName} から ${fmt(result.amount)}円 盗みました`;
    }
  } else if (result.selfEffect) {
    addLog(`${result.itemIcon} ${result.itemName} を使用しました`, 'log-sys');
    msgHtml = `✅ ${result.itemName} を使用しました（次に効果が発動します）`;
  }
  if (box && msgHtml) box.innerHTML = `<div class="lwp-shop-result">${msgHtml}</div>`;
  if (G_shopCategory) renderShopModal();
});

/* 誰かが能力を使った（公開・詳細は秘匿） */
socket.on('lw:abilityUsed', ({ playerName }) => {
  addLog(`🧠 ${playerName} が能力を使用しました`, 'log-sys');
});

/* 自分の資産が何者かに奪われた（暗殺の被害） */
socket.on('lw:assetStolen', ({ amount, asset }) => {
  G.myAsset = asset;
  renderGameHeader();
  renderPlayerList();
  addLog(`🌙 何者かに ${fmt(amount)}円 を奪われました…`, 'log-happen');
});

/* ===== ③ 会議フェーズ（画面切替・全員参加） ===== */
socket.on('lw:councilStart', ({ round, duration }) => {
  G.phase = 'council';
  hideTimer();
  showPhaseView('ph-council');
  $('g-phase').textContent = phaseLabels.council;
  renderPhasePlayerList();
  renderCouncilPanel();
  renderLwHostBtns();
  if (G_shopCategory === 'inventory') { renderShopModal(); } else { closeShopModal(); }
  const shopBtns = $('gh-shop-btns'); if (shopBtns) shopBtns.style.display = 'none';
  updatePhaseChatAccess();
  addLogSep(`🐺 会議フェーズ（ラウンド${round}）`);
  addPhaseChatSep(`ラウンド${round} 会議フェーズ`);
  if (duration) startTimerUI(duration, '#dd4444');
});

socket.on('lw:phaseChatMsg', (msg) => {
  addPhaseChatMsg(msg);
});

/* ===== ④ 投票フェーズ（画面切替・全員参加） ===== */
socket.on('lw:voteStart', ({ players, duration, round }) => {
  G.phase          = 'voting';
  G.myVoted        = false;
  G.myVoteTargetId = null;
  G.voteProgress   = { voted: 0, total: players ? players.length : G.players.filter(p => p.alive).length };
  G.voteGuardInfo       = null;
  G.myVoteGuardTargetId = null;
  hideTimer();
  $('g-phase').textContent = phaseLabels.voting;
  $('lw-game-header').className = 'game-header ph-voting';
  renderVotePanel();
  renderPhasePlayerList();
  renderLwHostBtns();
  if (G_shopCategory === 'inventory') { renderShopModal(); } else { closeShopModal(); }
  const shopBtns = $('gh-shop-btns'); if (shopBtns) shopBtns.style.display = 'none';
  updatePhaseChatAccess();
  addLogSep('🗳 投票フェーズ開始');
  addPhaseChatSep(`ラウンド${round} 投票フェーズ`);
  if (duration) startTimerUI(duration, '#dd9933');
});

socket.on('lw:voteProgress', ({ voted, total }) => {
  G.voteProgress = { voted, total };
  addLog(`🗳 投票状況：${voted} / ${total} 人`, 'log-sys');
  renderVotePanel();
});

/* 処刑による資産半減（脱落なしモード）を即座に画面へ反映 */
socket.on('lw:myAssetUpdate', ({ asset }) => {
  if (typeof asset === 'number') {
    G.myAsset = asset;
    renderGameHeader();
  }
});

socket.on('lw:voteResult', ({ executed, targetId, targetName, tally, elimination, blockedByLawyer, blockedByCharm, breakdown, room }) => {
  hideTimer();
  if (room) { G.players = room.players; renderPlayerList(); renderPhasePlayerList(); }

  // 投票内訳表示（誰が誰に投票したか・人狼ONLINEと同一仕様）
  if (breakdown && breakdown.length > 0) {
    addLog('━━ 投票内訳 ━━', 'log-sys');
    breakdown.forEach(({ targetName: tName, voters, count }) => {
      addLog(`　🗳️ ${tName}：${voters.join('、')}　(${count}票)`, 'log-wolf');
    });
  }

  if (executed) {
    const penalty = elimination === 'survive' ? '資産が半減しました' : '脱落しました';
    addLog(`⚖️ ${targetName} が最多票で処理対象に → ${penalty}`, 'log-wolf');
  } else if (blockedByLawyer) {
    addLog(`⚖️ ${targetName} が最多票でしたが、弁護士に守られて処刑を免れました！`, 'log-fate');
  } else if (blockedByCharm) {
    addLog(`🍀 ${targetName} が最多票でしたが、お守りの効果で処刑を免れました！`, 'log-fate');
  } else {
    addLog('⚖️ 投票がまとまらず、今回は処理なし', 'log-sys');
  }
  const blockedMsg = blockedByLawyer ? `${targetName} は処刑を免れました` : blockedByCharm ? `${targetName} はお守りで処刑を免れました` : '今回は処理なし';
  $('lwp-action').innerHTML = `<div class="ap-title lwp-title-voting">⚖️ 投票結果</div>
    <div class="ap-info">${executed ? `${targetName} が処理されました` : blockedMsg}</div>
    <div class="ap-info" style="margin-top:6px">次のラウンドへ進みます…</div>`;
});

/* ===== ⑥ ゲーム終了 ===== */
socket.on('lw:gameOver', ({ results, teamWinner, reason, reasonText, individualWinnerId }) => {
  G.phase = 'gameover';
  hideTimer();
  hideLwHostBtns();
  const emoji = teamWinner === 'wolf' ? '🐺' : teamWinner === 'village' ? '🏘' : '🏆';
  addLogSep(`${emoji} ゲーム終了！`);
  if (reasonText) addLog(reasonText, teamWinner === 'wolf' ? 'log-wolf' : 'log-sys');
  showGameOver(results, { teamWinner, reason, reasonText, individualWinnerId });
});

/* ===== 初期化 ===== */
showScreen('s-lobby');

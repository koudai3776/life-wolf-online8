/* ════════════════════════════════════════════════════════════════
   共通セットアップ
════════════════════════════════════════════════════════════════ */
const path       = require('path');
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const { v4: uuidv4 } = require('uuid');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });
app.use(cors());
app.use(express.static(path.join(__dirname, '../public')));




/* ════════════════════════════════════════════════════════════════
   🐺  人狼 ONLINE
════════════════════════════════════════════════════════════════ */
const GameEngine = require('./gameEngine');
const ROLES      = require('./roles');

/* ── ルーム管理 ── */
const rooms      = {};
const roomTimers = {};

/* ── ユーティリティ ── */
function genId()          { return Math.random().toString(36).substring(2, 8).toUpperCase(); }
function ri(id)           { return ROLES.find(r => r.id === id) || { id, name: id, team: 'village', icon: '❓' }; }
function isWolfRole(role) { return ['wolf', 'alpha', 'pup'].includes(role); }

function sanitize(room) {
    return {
        phase:      room.engine.phase,
        subphase:   room.subphase || 'night',
        round:      room.engine.round,
        players:    room.players.map(p => ({ id: p.id, name: p.name, cpu: p.cpu, alive: p.alive })),
        rolePool:   room.rolePool   || {},
        timeConfig: room.timeConfig || { night: 60, discuss: 90, vote: 30 },
    };
}

function broadcast(rid) {
    if (!rooms[rid]) return;
    io.to(rid).emit('updateRoom', { roomId: rid, room: sanitize(rooms[rid]) });
}

function voteTally(engine) {
    const t = {};
    Object.values(engine.votes).forEach(id => { t[id] = (t[id] || 0) + 1; });
    return t;
}

function gameOverPayload(room, winner) {
    const detail = room.engine.lastWinnerDetail;
    const specialName = (() => {
        if (winner === 'joker') {
            // 複数体いる場合に備え、実際に勝利条件（人狼に殺された）を満たした本人を優先参照
            return detail?.name ?? room.players.find(p => p.role === 'joker' && !p.alive)?.name;
        }
        if (winner === 'angel') {
            return detail?.name ?? room.players.find(p => p.role === 'angel' && !p.alive)?.name;
        }
        if (winner === 'wolf' && detail?.cause === 'saint') {
            return detail.name;
        }
        if (winner === 'lover') {
            const pairs = room.engine.getSurvivingLoverPairs();
            return pairs.map(([a, b]) => `${a.name}＆${b.name}`).join('、');
        }
    })();
    const cause = (winner === 'wolf' && detail?.cause === 'saint') ? 'saint' : undefined;
    return {
        winner, specialName, cause,
        players: room.players.map(p => {
            const r = ri(p.role);
            return { ...p, roleName: r.name, roleIcon: r.icon, team: r.team };
        }),
    };
}

function eventsToLogs(events) {
    return events.map(e => {
        switch (e.type) {
            case 'first_night_safe': return '🌙 初夜は平和でした。誰も死亡しませんでした';
            case 'night_kill':       return `🌙 ${e.name} が人狼に襲撃されました`;
            case 'fox_seer_kill':    return `🔮 ${e.name} が占いの影響で命を落としました`;
            case 'fox_immune':       return null;
            case 'cursed_wolf':      return `🧿 ${e.name} が人狼に変身しました！`;
            case 'joker_win':        return `🃏 ${e.name} が人狼に殺され、単独勝利！`;
            case 'pup_died':         return `🐶 子狼 ${e.name} が死亡。翌夜は追加で1人が襲われます！`;
            case 'pup_bonus_kill':   return `🐺 子狼の力で ${e.name} も犠牲に`;
            case 'executed':         return `⚖️ ${e.name} が処刑されました`;
            case 'saint_executed':   return `👸 聖女 ${e.name} が処刑！人狼陣営が即勝利！`;
            case 'angel_win':        return `⛩️ てるてる坊主 ${e.name} が1日目に処刑、単独勝利！`;
            case 'cat_drag':         return `🐱 猫又の道連れで ${e.name} も死亡`;
            case 'avenger_drag':     return `💀 復讐者の道連れで ${e.name} も死亡`;
            case 'no_execution':     return '⚖️ 本日の処刑なし';
            default:                 return null;
        }
    }).filter(Boolean);
}

/* ── タイマー管理 ── */
function clearRoomTimer(rid) {
    if (roomTimers[rid]) { clearTimeout(roomTimers[rid]); delete roomTimers[rid]; }
}

function startTimer(rid, seconds, callback) {
    clearRoomTimer(rid);
    // 0 = 無制限
    io.to(rid).emit('timerStart', { duration: seconds || 0, ts: Date.now() });
    if (seconds && seconds > 0) {
        roomTimers[rid] = setTimeout(() => { delete roomTimers[rid]; callback(); }, seconds * 1000);
    }
}

/* ── フェーズ遷移 ── */

/** 人狼陣営の人間プレイヤーに現在の襲撃タリーを送信 */
function broadcastWolfTally(room, rid) {
    const tally = room.engine.getAttackTally();
    room.players.filter(p => isWolfRole(p.role) && !p.cpu && p.alive).forEach(w => {
        io.to(w.id).emit('wolfTargetUpdate', { tally });
    });
}

/** 特定の人狼が誰を狙ったかをログとして仲間（人間）に通知 */
function notifyWolfTargetChange(room, wolfPlayer, targetPlayer) {
    const text = `🎯 ${wolfPlayer.name} は ${targetPlayer.name} を狙っています`;
    room.players.filter(p => isWolfRole(p.role) && !p.cpu && p.alive).forEach(w => {
        io.to(w.id).emit('wolfTargetLog', { text });
    });
}

/** 夜フェーズ開始 */
function phaseNight(rid) {
    const room = rooms[rid];
    if (!room) return;
    room.subphase = 'night';

    // CPU人狼は各自ランダムに襲撃先を選ぶ（1夜目は襲撃が無効なのでスキップ）
    if (room.engine.round > 1) {
        const cpuWolves = room.players.filter(p => p.cpu && isWolfRole(p.role) && p.alive);
        cpuWolves.forEach(cpu => {
            const tgts = room.players.filter(p => p.alive && !isWolfRole(p.role));
            if (tgts.length) {
                const t = tgts[Math.floor(Math.random() * tgts.length)];
                room.engine.nightAction('wolf', t.id, cpu.id);
                notifyWolfTargetChange(room, cpu, t);
            }
        });
    }

    io.to(rid).emit('nightStart', sanitize(room));
    if (room.engine.round > 1) broadcastWolfTally(room, rid);
    startTimer(rid, room.timeConfig?.night || 0, () => phaseFinishNight(rid));
}

/** 夜フェーズ終了 → 昼議論へ */
function phaseFinishNight(rid) {
    const room = rooms[rid];
    if (!room) return;
    clearRoomTimer(rid);

    // CPU狼の自動行動は phaseNight() 開始時にすでに実施済み

    const wasFirst        = room.engine.round === 1;
    const events          = room.engine.resolveNight();
    const logs            = eventsToLogs(events);
    const killedIds       = events.filter(e => ['night_kill', 'pup_bonus_kill', 'joker_win'].includes(e.type)).map(e => e.id);

     // startDay()でリセットされる前に、結果通知用の情報を確保しておく
    const resolvedAttack  = room.engine.lastResolvedAttack;
    const wasBlocked      = events.some(e => e.type === 'attack_blocked');

    // 即時勝利判定は startDay() が this.events をリセットする前に行う
    // （これを後回しにすると joker_win 等の夜間の即時勝利イベントが消えてしまうバグになる）
    const winner          = room.engine.checkWinner();

    room.engine.startDay();
    io.to(rid).emit('dayStart', { killedIds, logs, firstNightSafe: wasFirst, room: sanitize(room) });

    // ── 人狼陣営へ：襲撃が狩人に阻止されたことを個別通知（村側には一切知らせない） ──
    if (!wasFirst && wasBlocked) {
        room.players.filter(p => isWolfRole(p.role) && !p.cpu && p.alive).forEach(w => {
            io.to(w.id).emit('wolfTargetLog', { text: '襲撃を防がれました。' });
        });
    }

     // ── 人狼陣営へ：妖狐の不死で襲撃が無効化されたことを個別通知 ──
    const foxImmuneEvent = events.find(e => e.type === 'fox_immune');
    if (!wasFirst && foxImmuneEvent) {
        room.players.filter(p => isWolfRole(p.role) && !p.cpu && p.alive).forEach(w => {
            io.to(w.id).emit('wolfTargetLog', { text: '襲撃を防がれました。' });
        });
        // ── 妖狐本人へ：襲撃を受けたが無傷だったことを個別通知 ──
        const fox = room.players.find(p => p.id === foxImmuneEvent.id && !p.cpu);
        if (fox) {
            io.to(fox.id).emit('foxImmuneResult', { message: '🦊 襲撃を受けました。しかし、あなたは無傷でした。' });
        }
    }

    // ── 狩人へ：護衛の結果を個別通知（村側には一切知らせない。複数人いても各自の選択に基づいて個別に通知） ──
    if (!wasFirst) {
        room.players.filter(p => p.role === 'guard' && p.alive && !p.cpu).forEach(guard => {
            const myTarget = room.engine.nightActions.protectVotes[guard.id];
            if (!myTarget) return;// この狩人は今夜何もしていない
            const protectedPlayer = room.players.find(p => p.id === myTarget);
            if (!protectedPlayer) return;
            const succeeded = myTarget === resolvedAttack;
            const msg = succeeded
                ? `🛡️ ${protectedPlayer.name} を襲撃から守りました！`
                : '🛡️ 守った対象は襲撃されませんでした。';
            io.to(guard.id).emit('guardResult', { success: succeeded, message: msg });
        });
    }

    // 霊媒師通知（複数人いれば全員に個別通知）
    if (room.lastExecuted) {
        const r = ri(room.lastExecuted.role);
        room.players.filter(p => p.role === 'medium' && p.alive && !p.cpu).forEach(medium => {
            io.to(medium.id).emit('mediumResult', {
                name: room.lastExecuted.name, roleName: r.name, roleIcon: r.icon,
                isWolf: isWolfRole(room.lastExecuted.role),
            });
        });
        room.lastExecuted = null;
    }

    if (winner) { io.to(rid).emit('gameOver', gameOverPayload(room, winner)); return; }
    phaseDiscuss(rid);
}

/** 議論フェーズ */
function phaseDiscuss(rid) {
    const room = rooms[rid];
    if (!room) return;
    room.subphase = 'discuss';
    io.to(rid).emit('discussStart', sanitize(room));
    startTimer(rid, room.timeConfig?.discuss || 0, () => phaseVote(rid));
}

/** 投票フェーズ */
function phaseVote(rid) {
    const room = rooms[rid];
    if (!room) return;
    room.subphase   = 'vote';
    room.voteFinished = false; // 二重実行防止フラグをリセット

    // ── CPUは投票フェーズ開始時に即自動投票 ──
    room.players.filter(p => p.cpu && p.alive).forEach(cpu => {
        if (!room.engine.votes[cpu.id]) {
            const targets = room.players.filter(p => p.alive && p.id !== cpu.id);
            if (targets.length) {
                const t = targets[Math.floor(Math.random() * targets.length)];
                room.engine.vote(cpu.id, t.id);
            }
        }
    });

    io.to(rid).emit('votePhaseStart', sanitize(room));

     // CPU票込みの合計を即送信
    const cast  = Object.keys(room.engine.votes).length;
    const total = room.players.filter(p => p.alive).length;
    io.to(rid).emit('voteUpdate', { cast, total });

    startTimer(rid, room.timeConfig?.vote || 0, () => phaseFinishVote(rid));
}

/** 投票確定 → 次の夜へ */
function phaseFinishVote(rid) {
    const room = rooms[rid];
    if (!room || room.voteFinished) return; // 二重実行防止
    room.voteFinished = true;
    clearRoomTimer(rid);

    // 未投票の人間プレイヤーは自分自身に票を入れる（時間切れ・棄権扱い）
    room.players.filter(p => p.alive && !p.cpu).forEach(human => {
        if (!room.engine.votes[human.id]) room.engine.vote(human.id, human.id);
    });

    // CPU票はphaseVote開始時に投票済みのため、ここでは何もしない

    // ── 投票内訳収集（誰が誰に入れたか） ──
    const rawVotes  = room.engine.votes;
    const voteMap   = {};
    Object.entries(rawVotes).forEach(([fromId, toId]) => {
        const voter  = room.players.find(p => p.id === fromId);
        const target = room.players.find(p => p.id === toId);
        if (!voter || !target) return;
        if (!voteMap[target.name]) voteMap[target.name] = [];
        voteMap[target.name].push(voter.name + (voter.cpu ? ' 🤖' : ''));
    });
    const breakdown = Object.entries(voteMap)
        .sort(([, a], [, b]) => b.length - a.length)
        .map(([targetName, voters]) => ({ targetName, voters, count: voters.length }));

    const events = room.engine.executeVote();
    const logs   = eventsToLogs(events);

    const exEvent = events.find(e => e.type === 'executed');
    if (exEvent) {
        const exPlayer = room.players.find(p => p.id === exEvent.id);
        if (exPlayer) room.lastExecuted = exPlayer;
    }

    io.to(rid).emit('voteResult', { logs, breakdown, room: sanitize(room) });

    const winner = room.engine.checkWinner();
    if (winner) { io.to(rid).emit('gameOver', gameOverPayload(room, winner)); return; }

    room.engine.startNight();
    phaseNight(rid);
}




/* ════════════════════════════════════════════════════════════════
   🎲  LIFE WOLF
════════════════════════════════════════════════════════════════ */
const { LifeWolfRoom, ROLES: LW_ROLES, ITEMS: LW_ITEMS } = require('./lifeWolfEngine');

/* ── ルーム管理 ── */
const lwRooms = {};

function lwGenId() {
    const ch = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = '';
    for (let i = 0; i < 6; i++) id += ch[Math.floor(Math.random() * ch.length)];
    return lwRooms[id] ? lwGenId() : id;
}

/* ── フェーズ関数 ── */

/** 数値パース（人狼ONLINEと同一仕様：0 は「無制限」として有効な値、NaN のときだけ既定値） */
function lwParseSeconds(v, def) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n >= 0 ? n : def;
}

/** 最大ラウンド数パース（3〜30 の範囲にクランプ、NaN のときは既定値） */
function lwParseMaxRounds(v, def) {
    const n = parseInt(v, 10);
    if (!Number.isFinite(n)) return def;
    return Math.min(30, Math.max(3, n));
}

/** フェーズタイマー開始（人狼ONLINEの startTimer と同一仕様：0 = 無制限＝setTimeoutを張らない） */
function lwStartTimer(room, timerKey, seconds, callback) {
    if (room[timerKey]) { clearTimeout(room[timerKey]); room[timerKey] = null; }
    if (seconds && seconds > 0) {
        room[timerKey] = setTimeout(() => { room[timerKey] = null; callback(); }, seconds * 1000);
    }
}

/** サイコロ〜移動〜マスイベント処理（人間・CPU 両対応） */
function lwProcessTurn(room, roomId, playerId) {
    const cur = room.players.find(p => p.id === playerId);
    // 非活動プレイヤー（脱落・資産0でリタイア）に手番が回ってきた場合はゲームが停止しないよう
    // 自動的に次のプレイヤーへターンを進める（安全策）
    if (!cur || !room.isActive(cur)) { lwAdvanceTurn(room, roomId); return; }
    if (room.phase !== 'rolling') return;

    room.phase  = 'moving';
    const dice  = room.rollDice();
    const move  = room.movePlayer(playerId, dice);
    io.to('lw:' + roomId).emit('lw:diceResult', { playerId, dice, moveResult: move });

    const animMs = dice * 220 + 600;
    setTimeout(() => {
        if (!move) { lwAdvanceTurn(room, roomId); return; }

        const ev = room.processSquareEvent(move.squareType, playerId);
        if (!ev)  { lwAdvanceTurn(room, roomId); return; }

        room.phase = 'event';

        if (ev.isAll) {
            // 社会マス：全員に影響するイベントなので、金額・資産は全員に公開してよい
            io.to('lw:' + roomId).emit('lw:squareEvent', {
                playerId,
                playerName   : cur.name,
                event        : ev,
                room         : room.sanitize(),
                myAsset      : cur.asset,  // 手番プレイヤーの資産（後方互換）
                playerAssets : Object.fromEntries(room.players.map(p => [p.id, p.asset])),
            });
        } else {
            // 個人マス：どこに止まって何のイベントだったかは公開するが、増減額・資産は本人にしか見せない
            // ただし「増えたのか減ったのか」の方向だけは全員に見せる
            const publicEvent = { ...ev };
            publicEvent.direction = ev.amount > 0 ? 'up' : ev.amount < 0 ? 'down' : 'flat';
            delete publicEvent.amount;
            io.to('lw:' + roomId).except(playerId).emit('lw:squareEvent', {
                playerId,
                playerName : cur.name,
                event      : publicEvent,
                room       : room.sanitize(),
            });
            io.to(playerId).emit('lw:squareEvent', {
                playerId,
                playerName : cur.name,
                event      : ev,
                room       : room.sanitize(),
                myAsset    : cur.asset,
            });
        }
        
        // マスイベントで資産が変動した結果、陣営勝利条件を満たしていないか確認
        if (lwCheckWinner(room, roomId)) return;
        
        // CPUは5秒、人間は12秒で自動ターン終了（人間は ackEvent で早期終了可）
        const autoMs = cur.cpu ? 5000 : 12000;
        room._eventTimer = setTimeout(() => lwAdvanceTurn(room, roomId), autoMs);
    }, animMs);
}

/* ===== 🤖 CPU AI ヘルパー（人狼行動・投票・ショップ利用を、単純ランダムより賢く判断させる） ===== */

/** CPU用：資産が多い相手ほど選ばれやすくする（上位半分からランダム抽選） */
function lwCpuPickRichestPlayer(pool) {
    if (!pool.length) return null;
    const sorted = [...pool].sort((a, b) => b.asset - a.asset);
    const top = sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 2)));
    return top[Math.floor(Math.random() * top.length)];
}

/** CPU用（占い師/探偵）：まだ調べていない相手を優先して選ぶ */
function lwCpuPickInfoTarget(actor, pool) {
    if (!pool.length) return null;
    actor._cpuChecked = actor._cpuChecked || new Set();
    const unchecked = pool.filter(q => !actor._cpuChecked.has(q.id));
    const chosenPool = unchecked.length ? unchecked : pool;
    const t = chosenPool[Math.floor(Math.random() * chosenPool.length)];
    actor._cpuChecked.add(t.id);
    return t;
}

/** CPU用（投票）：すでに票が集まっている人に70%の確率で乗る（バンドワゴン） */
function lwCpuBandwagonPick(pool, votes) {
    if (!pool.length) return null;
    const tally = {};
    Object.values(votes || {}).forEach(id => { tally[id] = (tally[id] || 0) + 1; });
    const withVotes = pool.filter(p => tally[p.id]);
    if (withVotes.length && Math.random() < 0.7) {
        withVotes.sort((a, b) => (tally[b.id] || 0) - (tally[a.id] || 0));
        return withVotes[0];
    }
    return pool[Math.floor(Math.random() * pool.length)];
}

/** CPU用：ショップで資産に見合ったアイテムを買って、必要なら即座に使う（能力フェーズ中に一定確率で発動） */
function lwCpuTryShopping(room, roomId, cpu) {
    if (room.phase !== 'ability' || !room.isActive(cpu)) return;
    const affordable = Object.values(LW_ITEMS).filter(it =>
        (!it.elimOnly || room.elimination === 'elim') && cpu.asset >= it.price);
    if (!affordable.length) return;

    const item = affordable[Math.floor(Math.random() * affordable.length)];
    const buyResult = room.buyItem(cpu.id, item.id);
    if (!buyResult || buyResult.error) return;

    let targetId = null;
    if (item.id === 'binoculars' || item.id === 'pickpocket') {
        const targets = room.players.filter(p => room.isActive(p) && p.id !== cpu.id);
        const t = lwCpuPickRichestPlayer(targets);
        if (!t) return; // 対象がいなければ持ち物バッグに入れたまま次の機会に温存
        targetId = t.id;
    }
    room.useItem(cpu.id, item.id, targetId);
}

/** 能力使用フェーズ（ラウンド終了後・生存者全員が同時に）
 *  占い師・探偵・詐欺師など「情報・自己バフ系」の役職のみが対象。
 *  人狼・ギャンブラー・警備員は投票フェーズ後の「人狼行動フェーズ」で、
 *  弁護士は投票フェーズ中に、それぞれ別途行動する（人狼ONLINE方式）。 */
function lwRoundAbilityPhase(room, roomId) {
    if (room.phase === 'gameover' || room._lwFinalizing) return; // 勝利確定後の二重起動防止
    room.phase = 'ability';
    room.resetRoundProtections(); // 前ラウンドの弁護/護衛効果をクリア

    const INFO_ABILITIES = ['divine', 'inspectAsset', 'disguise'];
     // survive モードは破産プレイヤー(asset===0)を能力フェーズから除外
    const actors = room.players.filter(
        p => room.isActive(p) && INFO_ABILITIES.includes((LW_ROLES[p.role] || {}).ability) && p.abilityCooldown === 0
    );
    room._abilityActors = new Set(actors.map(p => p.id)); // このフェーズで行動できる人（フェーズ終了まで不変）
    room._abilityLocked = new Set();                      // 一度選択したら変更不可な役職が確定済みかどうか
    room._abilityQueue  = {};                              // actorId -> targetId（タイムアップ or ホスト操作でまとめて実行）

    const abilityDuration = room.lwTimeConfig ? room.lwTimeConfig.ability : 60;
    io.to('lw:' + roomId).emit('lw:abilityPhaseStart', { round: room.round, duration: abilityDuration });

    // クールダウンを1ターン分減らす（全員一律。人狼・警備員・弁護士など、このフェーズの対象外の役職のCTもここで減る）
    room.players.forEach(p => { if (p.abilityCooldown > 0) p.abilityCooldown--; });

    if (actors.length === 0) { lwAfterRoundAbility(room, roomId); return; }

    actors.forEach(p => {
        const def           = LW_ROLES[p.role];
        const selfTargetable = def.ability === 'disguise'; // 詐欺師の「偽装」は自分自身が対象
        // ターゲットも活動中のみ（自己対象アビリティは自分自身を候補に含める）
        const targets = room.players
            .filter(q => room.isActive(q) && (selfTargetable ? q.id === p.id : q.id !== p.id))
            .map(q => ({ id: q.id, name: q.name, color: q.color }));

        io.to(p.id).emit('lw:abilityPhase', {
            ability  : { id: def.ability, name: def.abilityName, desc: def.abilityDesc },
            cooldown : 0,
            targets,
            selfTargetable,
            lockable : !!def.lockable, // true: 一度選択したら変更不可／false: 制限時間内なら変更可能
        });

        if (p.cpu) {
            setTimeout(() => {
                if (!room._abilityActors || !room._abilityActors.has(p.id)) return;
                if (selfTargetable) {
                    lwQueueAbility(room, roomId, p.id, p.id);
                } else if (targets.length && Math.random() < 0.75) {
                    const t = lwCpuPickInfoTarget(p, targets);
                    if (t) lwQueueAbility(room, roomId, p.id, t.id);
                    else lwSkipAbility(room, roomId, p.id);
                } else {
                    lwSkipAbility(room, roomId, p.id);
                }
            }, 1000 + Math.random() * 1800);
        }
    });

    // CPUの経済行動：能力フェーズ中に一定確率でショップアイテムを購入し、必要なら即座に使う
    room.players.filter(p => p.cpu && room.isActive(p)).forEach(cpu => {
        if (Math.random() > 0.35) return; // 毎ラウンド35%の確率で行動
        setTimeout(() => lwCpuTryShopping(room, roomId, cpu), 500 + Math.random() * 2500);
    });

    lwStartTimer(room, '_abilityTimer', abilityDuration, () => lwForceAbilityPhase(room, roomId));
}

/** 能力フェーズを強制終了（時間切れ or ホストのスキップ・唯一の確定タイミング） */
function lwForceAbilityPhase(room, roomId) {
    if (room.phase !== 'ability') return;
    if (room._abilityTimer) { clearTimeout(room._abilityTimer); room._abilityTimer = null; }
    room._abilityActors = null;
    room._abilityLocked = null;
    lwResolveAllAbilities(room, roomId);
}

/** 能力の対象を選択/変更する。
 *  - lockable な役職（占い師・探偵・詐欺師）：一度選択したら以降は変更不可
 *  - それ以外（人狼・弁護士・警備員・ギャンブラー）：制限時間内なら何度でも選び直せる
 *  実際の効果適用はタイムアップ or ホストの操作でまとめて行う（lwResolveAllAbilities）。 */
function lwQueueAbility(room, roomId, actorId, targetId) {
    if (!room._abilityActors || !room._abilityActors.has(actorId)) return;
    if (room._abilityLocked && room._abilityLocked.has(actorId)) return; // 既に確定済み
    if (!room._abilityQueue) room._abilityQueue = {};
    room._abilityQueue[actorId] = targetId;

    const actor = room.players.find(p => p.id === actorId);
    const def   = actor && LW_ROLES[actor.role];
    const locked = !!(def && def.lockable);
    if (locked) room._abilityLocked.add(actorId);

    io.to(actorId).emit('lw:abilitySelected', { targetId, locked });
}

/** 能力を使わない（対象選択を解除する）。lockable な役職は以降選択不可になる。 */
function lwSkipAbility(room, roomId, actorId) {
    if (!room._abilityActors || !room._abilityActors.has(actorId)) return;
    if (room._abilityLocked && room._abilityLocked.has(actorId)) return; // 既に確定済み
    if (room._abilityQueue) delete room._abilityQueue[actorId];

    const actor = room.players.find(p => p.id === actorId);
    const def   = actor && LW_ROLES[actor.role];
    const locked = !!(def && def.lockable);
    if (locked) room._abilityLocked.add(actorId);

    io.to(actorId).emit('lw:abilitySelected', { targetId: null, locked });
}

/** 全員の能力提出が出揃った後、優先順位（護衛・偽装 → 攻撃系 → 情報系）にまとめて解決する。
 *  これにより「警備員の護衛」「弁護士の弁護」が、同ラウンドの人狼の暗殺より必ず先に適用される。 */
function lwResolveAllAbilities(room, roomId) {
    const queue = room._abilityQueue || {};
    room._abilityQueue = null;

    const entries = Object.entries(queue)
        .map(([actorId, targetId]) => ({ actorId, targetId, actor: room.players.find(p => p.id === actorId) }))
        .filter(e => e.actor)
        .sort((a, b) => (LW_ROLES[a.actor.role].resolveOrder || 9) - (LW_ROLES[b.actor.role].resolveOrder || 9));

    entries.forEach(({ actorId, targetId, actor }) => {
        const result = room.useAbility(actorId, targetId);
        if (result && !result.error) {
            io.to(actorId).emit('lw:abilityResult', result); // 結果は本人のみ

            // CPU占い師：人狼だと判明したら覚えておいて、投票の判断材料にする
            if (actor.cpu && typeof result.isWolf === 'boolean' && result.isWolf) {
                actor._cpuKnownWolves = actor._cpuKnownWolves || new Set();
                actor._cpuKnownWolves.add(targetId);
            }

            // 護衛/弁護/偽装は静かな効果なので全体ログには流さない（本人にのみ結果が届く）
            if (!['guardExecution', 'guardAssassination', 'disguise'].includes(LW_ROLES[actor.role].ability)) {
                io.to('lw:' + roomId).emit('lw:abilityUsed', { playerName: actor.name });
            }

            // 暗殺（資産を奪われた）場合は対象本人にだけ気づきを通知
            if (result.amount && LW_ROLES[actor.role].ability !== 'gamble') {
                const target = room.players.find(p => p.id === targetId);
                if (target) io.to(targetId).emit('lw:assetStolen', { amount: result.amount, asset: target.asset });
            }
        }
    });

    if (lwCheckWinner(room, roomId)) return;
    lwAfterRoundAbility(room, roomId);
}

function lwAfterRoundAbility(room, roomId) {
    if (room.phase !== 'ability') return; // 二重実行防止
    lwCouncilStart(room, roomId);
}

/** 会議フェーズ */
function lwCouncilStart(room, roomId) {
    room.phase = 'council';
    const councilDuration = room.lwTimeConfig ? room.lwTimeConfig.council : 90;
    io.to('lw:' + roomId).emit('lw:councilStart', { round: room.round, duration: councilDuration });
    lwStartTimer(room, '_councilTimer', councilDuration, () => lwVoteStart(room, roomId));
}

/** 投票フェーズ */
function lwVoteStart(room, roomId) {
    if (room._councilTimer) { clearTimeout(room._councilTimer); room._councilTimer = null; }
    room.phase = 'voting';
    room.votes = {};

    // survive モードは破産プレイヤーを投票から除外
    const active       = room.players.filter(p => room.isActive(p));
    const voteDuration = room.lwTimeConfig ? room.lwTimeConfig.vote : 60;
    io.to('lw:' + roomId).emit('lw:voteStart', {
        players  : active.map(p => ({ id: p.id, name: p.name, color: p.color })),
        duration : voteDuration,
        round    : room.round,
    });

     // CPUの投票：人狼陣営は仲間を避けてバンドワゴン、村人陣営は占いで判明した人狼を最優先、
     // それがなければバンドワゴン（＝会話の流れっぽく既に票が集まっている人に乗る）
    active.filter(p => p.cpu).forEach(cpu => {
        const others = active.filter(p => p.id !== cpu.id);
        if (!others.length) return;
        const myTeam = (LW_ROLES[cpu.role] || {}).team;
        let target;
        if (myTeam === 'wolf') {
            const nonAllies = others.filter(p => (LW_ROLES[p.role] || {}).team !== 'wolf');
            target = lwCpuBandwagonPick(nonAllies.length ? nonAllies : others, room.votes);
        } else {
            const known = cpu._cpuKnownWolves
                ? others.filter(p => cpu._cpuKnownWolves.has(p.id))
                : [];
            target = known.length ? known[0] : lwCpuBandwagonPick(others, room.votes);
        }
        if (target) room.votes[cpu.id] = target.id;
    });

    // CPUの投票を反映した初期の投票状況を通知（人間側のカウント表示をズレなく開始させる）
    io.to('lw:' + roomId).emit('lw:voteProgress', { voted: Object.keys(room.votes).length, total: active.length });

    // 弁護士：投票フェーズ中、誰か1人をこの回の処刑からこっそり守れる（人狼ONLINE方式。結果は本人にのみ）
    const lawyers = active.filter(p => (LW_ROLES[p.role] || {}).ability === 'guardExecution' && p.abilityCooldown === 0);
    room._voteGuardActors = new Set(lawyers.map(p => p.id));
    room._voteGuardQueue  = {};
    lawyers.forEach(p => {
        const def          = LW_ROLES[p.role];
        const targetPlayers = active.filter(q => q.id !== p.id);
        const targets       = targetPlayers.map(q => ({ id: q.id, name: q.name, color: q.color }));
        io.to(p.id).emit('lw:voteGuardPhase', {
            ability: { id: def.ability, name: def.abilityName, desc: def.abilityDesc },
            targets,
        });
        if (p.cpu) {
            setTimeout(() => {
                if (!room._voteGuardActors || !room._voteGuardActors.has(p.id)) return;
                if (targetPlayers.length && Math.random() < 0.7) {
                    const villagePool = targetPlayers.filter(q => (LW_ROLES[q.role] || {}).team !== 'wolf');
                    const t = lwCpuPickRichestPlayer(villagePool.length ? villagePool : targetPlayers);
                    if (t) room._voteGuardQueue[p.id] = t.id;
                }
            }, 800 + Math.random() * 1500);
        }
    });

    lwStartTimer(room, '_voteTimer', voteDuration, () => lwFinishVote(room, roomId));
}

/** 弁護士の護衛先を選択/変更する（投票フェーズ中、制限時間内なら何度でも選び直せる） */
function lwQueueVoteGuard(room, roomId, actorId, targetId) {
    if (!room._voteGuardActors || !room._voteGuardActors.has(actorId)) return;
    if (!room._voteGuardQueue) room._voteGuardQueue = {};
    room._voteGuardQueue[actorId] = targetId;
    io.to(actorId).emit('lw:voteGuardSelected', { targetId });
}

/** 弁護士が護衛を使わない（対象選択を解除する） */
function lwSkipVoteGuard(room, roomId, actorId) {
    if (!room._voteGuardActors || !room._voteGuardActors.has(actorId)) return;
    if (room._voteGuardQueue) delete room._voteGuardQueue[actorId];
    io.to(actorId).emit('lw:voteGuardSelected', { targetId: null });
}

/** 投票を記録する。全員が投票し終えても自動では次フェーズへ進まない
 *（タイムアップ or ホストが「投票を締め切る」を押した時のみ lwFinishVote で確定する） */
function lwSubmitVote(room, roomId, voterId, targetId) {
    if (room.phase !== 'voting') return;
    const voter = room.players.find(p => p.id === voterId);
    if (!voter || !room.isActive(voter)) return; // 非活動プレイヤーの投票を無効化
    if (targetId) {
        const target = room.players.find(p => p.id === targetId);
        if (!target) return;
    }
    room.votes[voterId] = targetId;
    const activeCount = room.players.filter(p => room.isActive(p)).length;
    io.to('lw:' + roomId).emit('lw:voteProgress', { voted: Object.keys(room.votes).length, total: activeCount });
}

function lwFinishVote(room, roomId) {
    // 二重発火防止（「全員投票完了」「タイマー満了」「ホスト強制終了」が
    // ほぼ同時に発生すると、これまでは投票結果が2回処理されてしまっていた）
    if (room.phase !== 'voting') return;
    room.phase = 'voteResolved';

    if (room._voteTimer) { clearTimeout(room._voteTimer); room._voteTimer = null; }

    // 弁護士の護衛選択を、投票集計より先に確定させる（静かな効果。結果は本人にのみ通知）
    const guardQueue = room._voteGuardQueue || {};
    room._voteGuardActors = null;
    room._voteGuardQueue  = null;
    Object.entries(guardQueue).forEach(([actorId, targetId]) => {
        const result = room.useAbility(actorId, targetId);
        if (result && !result.error) io.to(actorId).emit('lw:abilityResult', result);
    });

    const result = room.resolveVotes();
    room.votes = {}; // 集計済みの投票をクリア（次ラウンドまでの間の二重集計を防止）
    let payload;

    if (result) {
        const target = room.players.find(p => p.id === result.targetId);
        // 対象がまだ活動中の場合のみ実行（タイムラグで非活動になった場合はスキップ）
        if (target && room.isActive(target)) {
            if (target.protectedFromExecution) {
                // 弁護士に守られていて処刑を免れた
                payload = {
                    executed       : false,
                    blockedByLawyer: true,
                    targetName     : target.name,
                    breakdown      : result.breakdown,
                    room           : room.sanitize(),
                };
            } else if (target.charmActive) {
                // お守りを持っていて処刑を免れた（1回限りで消費）
                target.charmActive = false;
                payload = {
                    executed      : false,
                    blockedByCharm: true,
                    targetName    : target.name,
                    breakdown     : result.breakdown,
                    room          : room.sanitize(),
                };
            } else {
                room.executePlayer(result.targetId);

                // 資産半減（脱落なしモード）は即座に本人の画面へ反映させる
                if (!target.cpu) io.to(target.id).emit('lw:myAssetUpdate', { asset: target.asset });

                // 神父：処刑された直後、生存している神父にだけこっそり正体を教える
                const tDef = LW_ROLES[target.role] || LW_ROLES.villager;
                room.players
                    .filter(p => room.isActive(p) && p.role === 'priest' && !p.cpu)
                    .forEach(pr => io.to(pr.id).emit('lw:priestReveal', {
                        targetName: target.name, roleName: tDef.name, roleIcon: tDef.icon, team: tDef.team,
                    }));

                payload = {
                    executed   : true,
                    targetId   : result.targetId,
                    targetName : target.name,
                    tally      : result.tally,
                    breakdown  : result.breakdown,
                    elimination: room.elimination,
                    room       : room.sanitize(),
                };
            }
        } else {
            payload = { executed: false, breakdown: result.breakdown, room: room.sanitize() };
        }
    } else {
        payload = { executed: false, room: room.sanitize() };
    }

    io.to('lw:' + roomId).emit('lw:voteResult', payload);

     // 処刑/資産半減の結果、陣営勝利条件を満たしていないか確認
    if (lwCheckWinner(room, roomId)) return;

    // 投票終了 → 人狼行動フェーズへ（そちらの終了後に次ラウンド/ゲーム終了の判定を行う）
    setTimeout(() => lwWolfActionPhase(room, roomId), 1500);
}

/** 人狼行動フェーズの終了後、規定ラウンドに達していればゲーム終了、そうでなければ次ラウンドへ */
function lwAfterVotePhase(room, roomId) {
    if (room.round >= room.maxRounds) {
        setTimeout(() => lwEndGame(room, roomId), 1500);
    } else {
        setTimeout(() => {
            room.advanceRound(); // ここで初めてラウンド番号を進める
            lwStartRoundTurn(room, roomId);
        }, 1500);
    }
}

/** 人狼行動フェーズ（投票フェーズの直後・毎ラウンド）
 *  人狼・ギャンブラーが資産を狙い、警備員がそれを守る（人狼ONLINEの「夜」に相当）。 */
function lwWolfActionPhase(room, roomId) {
    if (room.phase === 'gameover' || room._lwFinalizing) return; // 勝利確定後の二重起動防止
    room.phase = 'wolfAction';

    const WOLF_ABILITIES = ['steal', 'gamble', 'guardAssassination'];
    const actors = room.players.filter(
        p => room.isActive(p) && WOLF_ABILITIES.includes((LW_ROLES[p.role] || {}).ability) && p.abilityCooldown === 0
    );
    room._wolfActors = new Set(actors.map(p => p.id));
    room._wolfLocked = new Set();
    room._wolfQueue  = {};

    const wolfDuration = room.lwTimeConfig ? (room.lwTimeConfig.wolf || 60) : 60;
    io.to('lw:' + roomId).emit('lw:wolfPhaseStart', { round: room.round, duration: wolfDuration });

    if (actors.length === 0) { lwResolveWolfPhase(room, roomId); return; }

    actors.forEach(p => {
        const def          = LW_ROLES[p.role];
        const targetPlayers = room.players.filter(q => room.isActive(q) && q.id !== p.id);
        const targets       = targetPlayers.map(q => ({ id: q.id, name: q.name, color: q.color }));

        io.to(p.id).emit('lw:wolfPhase', {
            ability : { id: def.ability, name: def.abilityName, desc: def.abilityDesc },
            targets,
        });

        if (p.cpu) {
            setTimeout(() => {
                if (!room._wolfActors || !room._wolfActors.has(p.id)) return;
                if (targetPlayers.length && Math.random() < 0.75) {
                    // 人狼/ギャンブラーは仲間を狙わない、警備員も仲間を守っても仕方ないので村人陣営を優先
                    const villagePool = targetPlayers.filter(q => (LW_ROLES[q.role] || {}).team !== 'wolf');
                    const pool = villagePool.length ? villagePool : targetPlayers;
                    const t = lwCpuPickRichestPlayer(pool);
                    if (t) lwQueueWolfAbility(room, roomId, p.id, t.id);
                    else lwSkipWolfAbility(room, roomId, p.id);
                } else {
                    lwSkipWolfAbility(room, roomId, p.id);
                }
            }, 1000 + Math.random() * 1800);
        }
    });

    lwStartTimer(room, '_wolfTimer', wolfDuration, () => lwForceWolfPhase(room, roomId));
}

/** 人狼行動フェーズを強制終了（時間切れ or ホストのスキップ） */
function lwForceWolfPhase(room, roomId) {
    if (room.phase !== 'wolfAction') return;
    if (room._wolfTimer) { clearTimeout(room._wolfTimer); room._wolfTimer = null; }
    room._wolfActors = null;
    room._wolfLocked = null;
    lwResolveWolfPhase(room, roomId);
}

/** 人狼行動フェーズの対象を選択/変更する（制限時間内なら何度でも選び直せる） */
function lwQueueWolfAbility(room, roomId, actorId, targetId) {
    if (!room._wolfActors || !room._wolfActors.has(actorId)) return;
    if (room._wolfLocked && room._wolfLocked.has(actorId)) return;
    if (!room._wolfQueue) room._wolfQueue = {};
    room._wolfQueue[actorId] = targetId;
    io.to(actorId).emit('lw:wolfAbilitySelected', { targetId });
}

/** 人狼行動フェーズで能力を使わない（対象選択を解除する） */
function lwSkipWolfAbility(room, roomId, actorId) {
    if (!room._wolfActors || !room._wolfActors.has(actorId)) return;
    if (room._wolfLocked && room._wolfLocked.has(actorId)) return;
    if (room._wolfQueue) delete room._wolfQueue[actorId];
    io.to(actorId).emit('lw:wolfAbilitySelected', { targetId: null });
}

/** 全員の行動が出揃った後、優先順位（警備員の護衛 → 人狼/ギャンブラーの攻撃）でまとめて解決する */
function lwResolveWolfPhase(room, roomId) {
    const queue = room._wolfQueue || {};
    room._wolfQueue = null;

    const entries = Object.entries(queue)
        .map(([actorId, targetId]) => ({ actorId, targetId, actor: room.players.find(p => p.id === actorId) }))
        .filter(e => e.actor)
        .sort((a, b) => (LW_ROLES[a.actor.role].resolveOrder || 9) - (LW_ROLES[b.actor.role].resolveOrder || 9));

    entries.forEach(({ actorId, targetId, actor }) => {
        const result = room.useAbility(actorId, targetId);
        if (result && !result.error) {
            io.to(actorId).emit('lw:abilityResult', result); // 結果は本人のみ

            // 警備員の護衛は静かな効果なので全体ログには流さない
            if (LW_ROLES[actor.role].ability !== 'guardAssassination') {
                io.to('lw:' + roomId).emit('lw:abilityUsed', { playerName: actor.name });
            }

            // 暗殺（資産を奪われた）場合は対象本人にだけ気づきを通知
            if (result.amount && LW_ROLES[actor.role].ability !== 'gamble') {
                const target = room.players.find(p => p.id === targetId);
                if (target) io.to(targetId).emit('lw:assetStolen', { amount: result.amount, asset: target.asset });
            }
        }
    });

    if (lwCheckWinner(room, roomId)) return;
    lwAfterVotePhase(room, roomId);
}

/* ── ゲーム終了 ── */

/** 3桁区切りの円表記 */
function lwFmtYen(n) { return Math.round(n).toLocaleString('ja-JP'); }

/** result: checkEarlyWinner() / checkTeamRoundLimitWinner() の戻り値、または個人戦の規定ラウンド終了結果、または null */
function lwFinalizeGame(room, roomId, result) {
    if (room.phase === 'gameover' || room._lwFinalizing) return;
    room._lwFinalizing = true;

      // 進行中の全タイマーを停止
    ['_eventTimer', '_abilityTimer', '_councilTimer', '_voteTimer', '_wolfTimer', '_roleRevealTimer'].forEach(k => {
        if (room[k]) { clearTimeout(room[k]); room[k] = null; }
    });

    room.phase = 'gameover';
    const results = room.finalResults();

    let teamWinner = null, individualWinnerId = null, reason = 'roundLimit', reasonText = '規定ラウンドが終了しました。';

    if (result && result.type === 'individual') {
        individualWinnerId = result.winnerId;
        reason = result.reason;
        const winnerPlayer = room.players.find(p => p.id === result.winnerId);
        const winnerName   = winnerPlayer ? winnerPlayer.name : '';
        reasonText = result.reason === 'lastStanding'
            ? `最後の1人になりました。${winnerName}の勝利です！`
            : `規定ラウンドが終了しました。${winnerName}の勝利です！`;
    } else if (result && result.type === 'team') {
        teamWinner = result.team;
        reason = result.reason;
        if (result.reason === 'wolf_wiped') {
            reasonText = '人狼が全員リタイアし、村人陣営の勝利です！';
        } else if (result.reason === 'parity') {
            reasonText = '人狼の生存人数が村人陣営と同数以上になり、人狼陣営の勝利です！';
        } else if (result.reason === 'assetAverage') {
            const winnerLabel = result.team === 'wolf' ? '人狼陣営' : '村人陣営';
            reasonText = `規定ラウンドが終了しました。陣営平均資産は 人狼陣営 ${lwFmtYen(result.wolfAvg)}円 / 村人陣営 ${lwFmtYen(result.villageAvg)}円 ── ${winnerLabel}の勝利です！`;
        } else if (result.reason === 'assetTie') {
            reasonText = `規定ラウンドが終了しました。陣営平均資産が同額（${lwFmtYen(result.wolfAvg)}円）のため引き分けです。`;
        }
    }

    io.to('lw:' + roomId).emit('lw:gameOver', {
        results,
        teamWinner,
        reason,
        reasonText,
        individualWinnerId,
    });
}

/** 陣営/個人の早期決着条件をチェックし、満たしていればゲームを終了する。終了した場合 true を返す */
function lwCheckWinner(room, roomId) {
    if (room.phase === 'gameover' || room._lwFinalizing) return true;
    const w = room.checkEarlyWinner();
    if (w) { lwFinalizeGame(room, roomId, w); return true; }
    return false;
}

/** 規定ラウンド終了時のゲーム終了処理。
 *  陣営戦：陣営の資産平均で陣営勝敗を判定。個人戦：資産トップが勝利。 */
function lwEndGame(room, roomId) {
    let result;
    if (room.battleType === 'team') {
        result = room.checkTeamRoundLimitWinner(); // 人狼が一人もいない構成では null
    } else {
        const winner = room.individualWinner();
        result = winner ? { type: 'individual', winnerId: winner.id, reason: 'roundLimit' } : null;
    }
    lwFinalizeGame(room, roomId, result);
}

/* ── ターン管理 ── */

function lwStartRoundTurn(room, roomId) {
    room.advanceToActivePlayer(); // 脱落/資産0で非活動になったプレイヤーの手番を飛ばす
    room.phase   = 'rolling';
    const next   = room.currentPlayer();
    io.to('lw:' + roomId).emit('lw:turnStart', { currentTurn: room.currentTurn, round: room.round, player: next });
    if (next && next.cpu) setTimeout(() => lwProcessTurn(room, roomId, next.id), 1200);
}

/** ターンを次へ進める。ラウンド終了なら能力→会議→投票フェーズへ */
function lwAdvanceTurn(room, roomId) {
    if (room.phase === 'advancing' || room.phase === 'gameover') return;
    room.phase  = 'advancing';
    const tr    = room.nextTurn();

    if (tr.roundEnd) {
        io.to('lw:' + roomId).emit('lw:roundEnd', { round: room.round });
        // 全員の移動が終わった → 能力フェーズ → 会議 → 投票 へ
        // （規定ラウンドの最終ラウンドであっても、能力/会議/投票フェーズは必ず行う。
        //   ゲーム終了判定は投票フェーズが終わった後に行う）
        setTimeout(() => lwRoundAbilityPhase(room, roomId), 1200);
    } else {
        lwStartRoundTurn(room, roomId);
    }
}




/* ════════════════════════════════════════════════════════════════
   Socket.IO 接続ハンドラ
════════════════════════════════════════════════════════════════ */
io.on('connection', socket => {
    console.log('接続:', socket.id);

    /* ----------------------------------------------------------------
       🐺  人狼 ONLINE ハンドラ
    ---------------------------------------------------------------- */

    /* ルーム作成 */
    socket.on('createRoom', name => {
        name = (name || '').trim();
        if (!name) { socket.emit('errorMessage', '名前を入力してください'); return; }
        const rid  = genId();
        const room = {
            host: socket.id, started: false, subphase: 'waiting', lastExecuted: null,
            players: [{ id: socket.id, name, cpu: false, alive: true, role: null }],
            engine: null, rolePool: {},
            timeConfig: { night: 60, discuss: 90, vote: 30 },
        };
        room.engine  = new GameEngine(room);
        rooms[rid]   = room;
        socket.join(rid);
        socket.roomId = rid;
        socket.emit('roomCreated', { roomId: rid, room: sanitize(room) });
    });

    /* ルーム参加 */
    socket.on('joinRoom', ({ roomId, playerName }) => {
        const room = rooms[roomId];
        if (!room)        { socket.emit('errorMessage', 'ルームが見つかりません'); return; }
        if (room.started) { socket.emit('errorMessage', 'ゲームはすでに開始されています'); return; }
        const name = (playerName || '').trim();
        if (room.players.find(p => p.name === name)) {
            socket.emit('errorMessage', 'その名前はすでに使われています'); return;
        }
        room.players.push({ id: socket.id, name, cpu: false, alive: true, role: null });
        socket.join(roomId);
        socket.roomId = roomId;
        socket.emit('joinedRoom', { roomId, room: sanitize(room) });
        broadcast(roomId);
    });

    /* CPU追加 / 削除 */
    socket.on('addCPU', rid => {
        const room = rooms[rid];
        if (!room || room.host !== socket.id) return;
        const n = room.players.filter(p => p.cpu).length + 1;
        room.players.push({ id: 'cpu_' + uuidv4(), name: 'CPU' + n, cpu: true, alive: true, role: null });
        broadcast(rid);
    });
    socket.on('removeCPU', rid => {
        const room = rooms[rid];
        if (!room || room.host !== socket.id) return;
        const cpus = room.players.filter(p => p.cpu);
        if (!cpus.length) return;
        room.players = room.players.filter(p => p.id !== cpus[cpus.length - 1].id);
        broadcast(rid);
    });

    /* 役職プール更新 */
    socket.on('setRoles', ({ roomId, rolePool }) => {
        const room = rooms[roomId];
        if (!room || room.host !== socket.id) return;
        room.rolePool = rolePool;
        io.to(roomId).emit('rolesUpdated', { rolePool });
    });

    /* タイマー設定更新 */
    socket.on('setTimers', ({ roomId, timeConfig }) => {
        const room = rooms[roomId];
        if (!room || room.host !== socket.id) return;
        room.timeConfig = timeConfig;
        broadcast(roomId); // 全員に設定を共有
    });

    socket.on('setInfoMode', ({ roomId, infoMode }) => {
        const room = rooms[roomId];
        if (!room || room.host !== socket.id) return;
        room.infoMode = infoMode || 'full';
        broadcast(roomId);
    });

    /* ゲーム開始 */
    socket.on('startGame', rid => {
        const room = rooms[rid];
        if (!room || room.host !== socket.id) return;
        if (room.players.length < 3) { socket.emit('errorMessage', '3人以上必要です'); return; }

        const pool  = room.rolePool || {};
        const total = Object.values(pool).reduce((s, n) => s + n, 0);
        if (total > 0 && total !== room.players.length) {
            socket.emit('errorMessage', `役職数(${total})とプレイヤー数(${room.players.length})が一致しません`); return;
        }
        if (total > 0 && !['wolf', 'alpha', 'pup'].some(id => pool[id] > 0)) {
            socket.emit('errorMessage', '人狼系の役職が必要です'); return;
        }
        if (pool.lover > 0 && pool.lover % 2 !== 0) {
            socket.emit('errorMessage', `恋人は2人1組で選択してください（現在${pool.lover}人）`); return;
        }
        if (pool.shared === 1) {
            socket.emit('errorMessage', '共有者は2人以上で選択してください（現在1人）'); return;
        }

        room.engine.startGame();
        room.started  = true;
        room.subphase = 'night';

         // 各プレイヤーに役職を個別送信
        room.players.forEach(p => {
            if (p.cpu) return;
            const r = ri(p.role);
            io.to(p.id).emit('yourRole', { role: p.role, roleName: r.name, roleIcon: r.icon, team: r.team, desc: r.desc });
        });

        // 狼チーム情報
        const wolves   = room.players.filter(p => isWolfRole(p.role));
        const wolfInfo = wolves.map(w => ({ id: w.id, name: w.name }));
        [...wolves, ...room.players.filter(p => p.role === 'fanatic')].forEach(p => {
            if (!p.cpu) io.to(p.id).emit('teamReveal', { type: 'wolf', members: wolfInfo });
        });

        // 妖狐チーム情報
        const foxes   = room.players.filter(p => p.role === 'fox');
        const foxInfo = foxes.map(f => ({ id: f.id, name: f.name }));
        [...foxes, ...room.players.filter(p => p.role === 'heretic')].forEach(p => {
            if (!p.cpu) io.to(p.id).emit('teamReveal', { type: 'fox', members: foxInfo });
        });

        // 共有者
        const shared = room.players.filter(p => p.role === 'shared');
        shared.forEach(p => {
            if (!p.cpu) io.to(p.id).emit('teamReveal', { type: 'shared', members: shared.map(s => ({ id: s.id, name: s.name })) });
        });

        // 恋人ペア
        const lovers = room.players.filter(p => p.role === 'lover');
        for (let i = 0; i + 1 < lovers.length; i += 2) {
            const pair = lovers.slice(i, i + 2).map(p => ({ id: p.id, name: p.name }));
            lovers.slice(i, i + 2).forEach(p => {
                if (!p.cpu) io.to(p.id).emit('teamReveal', { type: 'lover', members: pair });
            });
        }

        // 初期配役の集計（実際に割り当てられた役職から正確に集計。誰がどれかは含めない）
        const roleCounts  = {};
        room.players.forEach(p => { roleCounts[p.role] = (roleCounts[p.role] || 0) + 1; });
        const roleSummary = Object.entries(roleCounts).map(([id, count]) => {
            const r = ri(id);
            return { id, name: r.name, icon: r.icon, team: r.team, count };
        }).sort((a, b) => b.count - a.count); // 人数の多い順

        io.to(rid).emit('gameStarted', { ...sanitize(room), roleSummary, totalPlayers: room.players.length, infoMode: room.infoMode || 'full' });
        phaseNight(rid);
    });

    /* 夜の行動 */
    socket.on('nightAction', ({ roomId, targetId }) => {
        const room = rooms[roomId];
        if (!room) return;
        const me = room.players.find(p => p.id === socket.id);
        if (!me || !me.alive) return;
        const ok = room.engine.nightAction(me.role, targetId, socket.id);
         // 占い師：成功時のみ結果を返す（2回目以降は無視）
        if (me.role === 'seer' && ok) {
            const res = room.engine.getSeerResult(targetId);
            if (res) socket.emit('seerResult', res);
        }
         // 人狼系：仲間（人間）にタリーと「誰を狙ったか」のログを通知
        if (ok && isWolfRole(me.role) && room.engine.round > 1) {
            const target = room.players.find(p => p.id === targetId);
            if (target) { broadcastWolfTally(room, roomId); notifyWolfTargetChange(room, me, target); }
        }
    });

    /* 騎士の断罪 */
    socket.on('knightAccuse', ({ roomId, targetId }) => {
        const room = rooms[roomId];
        if (!room) return;
        const me = room.players.find(p => p.id === socket.id);
        if (!me || me.role !== 'knight' || !me.alive) return;
        const result = room.engine.knightAccuse(targetId, socket.id);
        if (!result.ok) { socket.emit('errorMessage', '断罪はすでに使用済みです'); return; }
        const logs = result.dead.map(p => result.result === 'wolf_died'
            ? `⚔️ ${result.targetName}は人狼でした！討伐成功`
            : `⚔️ ${result.targetName}は人狼ではありません。騎士 ${p.name} が死亡`);
        io.to(roomId).emit('knightResult', { result: result.result, dead: result.dead.map(p => p.id), logs, room: sanitize(room), accuserId: socket.id });
        const winner = room.engine.checkWinner();
        if (winner) io.to(roomId).emit('gameOver', gameOverPayload(room, winner));
    });

    /* 投票 */
    socket.on('vote', ({ roomId, targetId }) => {
        const room = rooms[roomId];
        if (!room) return;
        const me = room.players.find(p => p.id === socket.id);
        if (!me || !me.alive) return;
        if (room.subphase !== 'vote') return; // 投票フェーズ以外は無効
        room.engine.vote(socket.id, targetId);

        const castCount  = Object.keys(room.engine.votes).length;
        const aliveCount = room.players.filter(p => p.alive).length;
        // 誰が誰に入れたかは隠す。合計票数のみ送信
        io.to(roomId).emit('voteUpdate', { cast: castCount, total: aliveCount });
    });

    /* ホストによる手動フェーズ終了 */
    socket.on('finishNight',   rid => { if (rooms[rid]?.host === socket.id) phaseFinishNight(rid); });
    socket.on('finishDiscuss', rid => { if (rooms[rid]?.host === socket.id) phaseVote(rid); });
    socket.on('finishVote',    rid => { if (rooms[rid]?.host === socket.id) phaseFinishVote(rid); });

    /* チャット */
    socket.on('chat', ({ roomId, message }) => {
        const room = rooms[roomId];
        if (!room) return;
        const me = room.players.find(p => p.id === socket.id);
        if (!me || !me.alive) return;
        if (room.subphase === 'night') {
            if (!isWolfRole(me.role)) return;
            room.players.filter(p => isWolfRole(p.role) && !p.cpu)
                .forEach(w => io.to(w.id).emit('chat', { name: me.name, message, isWolfChat: true }));
        } else {
            io.to(roomId).emit('chat', { name: me.name, message, isWolfChat: false });
        }
    });

    /* 観戦チャット（死亡者専用 → 生存者には一切届かない） */
    socket.on('specChat', ({ roomId, message }) => {
        const room = rooms[roomId];
        if (!room) return;
        const me = room.players.find(p => p.id === socket.id);
        if (!me || me.alive || !message || !message.trim()) return; // 生存者・空メッセージは無視
        const msg = message.trim().slice(0, 200); // 長さ制限
        room.players
            .filter(p => !p.alive && !p.cpu)  // 死亡した人間プレイヤーのみに配信
            .forEach(p => io.to(p.id).emit('specChatMsg', { name: me.name, message: msg }));
    });

    /* ----------------------------------------------------------------
       🎲  LIFE WOLF ハンドラ
    ---------------------------------------------------------------- */

    /* ルーム作成 */
    socket.on('lw:createRoom', ({ name }) => {
        const roomId = lwGenId();
        const room   = new LifeWolfRoom(roomId, socket.id);
        room.battleType  = 'team';
        room.elimination = 'elim';
        room.addPlayer(socket.id, name);
        lwRooms[roomId] = room;
        socket.join('lw:' + roomId);
        socket.emit('lw:roomCreated', { roomId, room: room.sanitize() });
    });

    /* ルーム参加 */
    socket.on('lw:joinRoom', ({ name, roomId }) => {
        const room = lwRooms[roomId];
        if (!room)                    { socket.emit('lw:error', { message: '部屋が見つかりません' }); return; }
        if (room.started)             { socket.emit('lw:error', { message: 'すでに開始されています' }); return; }
        if (room.players.length >= 8) { socket.emit('lw:error', { message: '満員です（最大8人）' }); return; }
        const trimmedName = (name || '').trim();
        if (room.players.find(p => p.name === trimmedName)) {
            socket.emit('lw:error', { message: 'その名前はすでに使われています' }); return;
        }
        room.addPlayer(socket.id, name);
        socket.join('lw:' + roomId);
        socket.emit('lw:roomJoined', { roomId, room: room.sanitize() });
        socket.to('lw:' + roomId).emit('lw:roomUpdate', { room: room.sanitize() });
    });

    /* CPU追加 / 削除 */
    socket.on('lw:addCpu', ({ roomId }) => {
        const room = lwRooms[roomId];
        if (!room || room.host !== socket.id || room.started) return;
        if (room.players.length >= 8) { socket.emit('lw:error', { message: '満員です（最大8人）' }); return; }
        const cpuCount = room.players.filter(p => p.cpu).length;
        const cpuNames = ['CPU1', 'CPU2', 'CPU3', 'CPU4', 'CPU5', 'CPU6', 'CPU7'];
        room.addPlayer('cpu_' + Date.now(), cpuNames[cpuCount] || `CPU${cpuCount + 1}`, true);
        io.to('lw:' + roomId).emit('lw:roomUpdate', { room: room.sanitize() });
    });
    socket.on('lw:removeCpu', ({ roomId }) => {
        const room = lwRooms[roomId];
        if (!room || room.host !== socket.id || room.started) return;
        const cpus = room.players.filter(p => p.cpu);
        if (cpus.length === 0) return;
        room.players = room.players.filter(p => p.id !== cpus[cpus.length - 1].id);
        io.to('lw:' + roomId).emit('lw:roomUpdate', { room: room.sanitize() });
    });

    /* 対戦形式変更（ホストのみ・ルーム画面で変更） */
    socket.on('lw:setBattleType', ({ roomId, battleType }) => {
        const room = lwRooms[roomId];
        if (!room || room.host !== socket.id || room.started) return;
        if (battleType !== 'individual' && battleType !== 'team') return;
        room.battleType = battleType;
        io.to('lw:' + roomId).emit('lw:roomUpdate', { room: room.sanitize() });
    });

    /* 脱落設定変更（ホストのみ・ルーム画面で変更） */
    socket.on('lw:setElimination', ({ roomId, elimination }) => {
        const room = lwRooms[roomId];
        if (!room || room.host !== socket.id || room.started) return;
        if (elimination !== 'elim' && elimination !== 'survive') return;
        room.elimination = elimination;
        io.to('lw:' + roomId).emit('lw:roomUpdate', { room: room.sanitize() });
    });

    /* タイムリミット設定 */
    socket.on('lw:setTimers', ({ roomId, timeConfig }) => {
        const room = lwRooms[roomId];
        if (!room || room.host !== socket.id || room.started) return;
        room.lwTimeConfig = {
            ability : lwParseSeconds(timeConfig.ability, 60),
            council : lwParseSeconds(timeConfig.council, 90),
            vote    : lwParseSeconds(timeConfig.vote,    60),
            wolf    : lwParseSeconds(timeConfig.wolf,    60),
        };
        io.to('lw:' + roomId).emit('lw:roomUpdate', { room: room.sanitize() });
    });

    /* 最大ラウンド数設定（ホストのみ・ルーム画面で変更、3〜30） */
    socket.on('lw:setRounds', ({ roomId, maxRounds }) => {
        const room = lwRooms[roomId];
        if (!room || room.host !== socket.id || room.started) return;
        room.maxRounds = lwParseMaxRounds(maxRounds, room.maxRounds);
        io.to('lw:' + roomId).emit('lw:roomUpdate', { room: room.sanitize() });
    });

    /* ゲーム開始 */
    socket.on('lw:startGame', ({ roomId, rolePool, battleType, elimination, timeConfig, maxRounds }) => {
        const room = lwRooms[roomId];
        if (!room || room.host !== socket.id) return;
        if (room.players.length < 3) {
            socket.emit('lw:error', { message: '3人以上必要です（CPUを追加するか、プレイヤーの参加を待ってください）' });
            return;
        }
        
        // 役職構成のバリデーション（人狼ONLINEと同一仕様：
        //   選択数の合計がある場合のみ、プレイヤー数と一致するか／人狼陣営が含まれるかをチェック）
        const pool  = rolePool || {};
        const total = Object.values(pool).reduce((s, n) => s + (n || 0), 0);
        if (total > 0 && total !== room.players.length) {
            socket.emit('lw:error', { message: `役職数(${total})とプレイヤー数(${room.players.length})が一致しません` });
            return;
        }
        const wolfTeamCount = Object.keys(pool).reduce((s, r) => s + ((LW_ROLES[r] || {}).team === 'wolf' ? (pool[r] || 0) : 0), 0);
        if (total > 0 && wolfTeamCount === 0) {
            socket.emit('lw:error', { message: '人狼陣営の役職が必要です' });
            return;
        }

        // 対戦形式・脱落設定・役職プール・タイム設定・最大ラウンド数を反映
        if (battleType === 'individual' || battleType === 'team') room.battleType = battleType;
        if (elimination === 'elim' || elimination === 'survive') room.elimination = elimination;
        if (timeConfig) {
            room.lwTimeConfig = {
                ability : lwParseSeconds(timeConfig.ability, 60),
                council : lwParseSeconds(timeConfig.council, 90),
                vote    : lwParseSeconds(timeConfig.vote,    60),
                wolf    : lwParseSeconds(timeConfig.wolf,    60),
            };
        }
        if (maxRounds !== undefined) room.maxRounds = lwParseMaxRounds(maxRounds, room.maxRounds);
        room.assignRolesFromPool(rolePool || {});
        room.started        = true;
        room.phase          = 'roleReveal';
        room.round          = 1;
        room._roleConfirmed = new Set();

         // 全員にゲーム開始を通知（役職・資産情報は含まない）
        io.to('lw:' + roomId).emit('lw:gameStarted', { room: room.sanitize() });

        // 各プレイヤーに役職を個別送信
        room.players.forEach(p => {
            const info = room.privateInfo(p.id);
            if (info) io.to(p.id).emit('lw:roleReveal', info);
        });

        // 人狼陣営チーム情報（陣営が複数人の場合、互いの正体を教える。人狼ONLINEと同一仕様）
        const wolves   = room.players.filter(p => (LW_ROLES[p.role] || LW_ROLES.villager).team === 'wolf');
        const wolfInfo = wolves.map(w => ({ id: w.id, name: w.name }));
        wolves.forEach(p => {
            if (!p.cpu) io.to(p.id).emit('lw:teamReveal', { type: 'wolf', members: wolfInfo });
        });

        // 15秒で全員自動確認 → ゲーム開始
        room._roleRevealTimer = setTimeout(() => {
            if (room.phase !== 'roleReveal') return;
            room.phase = 'rolling';
            const cur  = room.currentPlayer();
            io.to('lw:' + roomId).emit('lw:allRoleConfirmed', {});
            io.to('lw:' + roomId).emit('lw:turnStart', { currentTurn: room.currentTurn, round: room.round, player: cur });
        }, 15000);
    });

    /* 役職確認ボタン */
    socket.on('lw:roleConfirm', ({ roomId }) => {
        const room = lwRooms[roomId];
        if (!room || room.phase !== 'roleReveal') return;
        room._roleConfirmed.add(socket.id);
        const humanCount = room.players.filter(p => !p.cpu).length;
        // 全員確認したら即開始
        if (room._roleConfirmed.size >= humanCount) {
            if (room._roleRevealTimer) { clearTimeout(room._roleRevealTimer); room._roleRevealTimer = null; }
            room.phase = 'rolling';
            const cur  = room.currentPlayer();
            io.to('lw:' + roomId).emit('lw:allRoleConfirmed', {});
            io.to('lw:' + roomId).emit('lw:turnStart', { currentTurn: room.currentTurn, round: room.round, player: cur });
        } else {
            // 途中経過を全員に通知
            io.to('lw:' + roomId).emit('lw:roleRevealProgress', {
                confirmed : room._roleConfirmed.size,
                total     : humanCount,
            });
        }
    });

    /* サイコロを振る */
    socket.on('lw:rollDice', ({ roomId }) => {
        const room = lwRooms[roomId];
        if (!room || !room.started) return;
        const cur = room.currentPlayer();
        if (!cur || cur.id !== socket.id || room.phase !== 'rolling') return;
        lwProcessTurn(room, roomId, socket.id);
    });

    /* イベント確認 */
    socket.on('lw:eventAck', ({ roomId }) => {
        const room = lwRooms[roomId];
        if (!room) return;
        const cur = room.currentPlayer();
        if (!cur || cur.id !== socket.id) return;
        if (room._eventTimer) { clearTimeout(room._eventTimer); room._eventTimer = null; }
        lwAdvanceTurn(room, roomId);
    });

    /* 能力使用（対象の選択・変更） */
    socket.on('lw:useAbility', ({ roomId, targetId }) => {
        const room = lwRooms[roomId];
        if (!room || room.phase !== 'ability') return;
        lwQueueAbility(room, roomId, socket.id, targetId);
    });

    /* ショップ：アイテム購入（能力フェーズ中のみ。持ち物バッグに追加されるだけで効果はまだ発動しない。誰が何を買ったかは非公開） */
    socket.on('lw:buyItem', ({ roomId, itemId }) => {
        const room = lwRooms[roomId];
        if (!room || room.phase !== 'ability') return;
        const result = room.buyItem(socket.id, itemId);
        socket.emit('lw:itemResult', result);
    });

    /* 持ち物バッグ：アイテムを使用して効果を発動（進行中のフェーズならいつでも可。結果は使用者にのみ通知） */
    socket.on('lw:useItem', ({ roomId, itemId, targetId }) => {
        const room = lwRooms[roomId];
        const usablePhases = ['rolling', 'moving', 'event', 'ability', 'council', 'voting', 'wolfAction'];
        if (!room || !usablePhases.includes(room.phase)) return;
        const result = room.useItem(socket.id, itemId, targetId);
        socket.emit('lw:itemResult', result);
    });

    /* 弁護士：投票フェーズ中の護衛選択 */
    socket.on('lw:useVoteGuard', ({ roomId, targetId }) => {
        const room = lwRooms[roomId];
        if (!room || room.phase !== 'voting') return;
        lwQueueVoteGuard(room, roomId, socket.id, targetId);
    });
    socket.on('lw:skipVoteGuard', ({ roomId }) => {
        const room = lwRooms[roomId];
        if (!room || room.phase !== 'voting') return;
        lwSkipVoteGuard(room, roomId, socket.id);
    });

    /* 人狼行動フェーズ：人狼/ギャンブラーの攻撃、警備員の護衛 */
    socket.on('lw:useWolfAbility', ({ roomId, targetId }) => {
        const room = lwRooms[roomId];
        if (!room || room.phase !== 'wolfAction') return;
        lwQueueWolfAbility(room, roomId, socket.id, targetId);
    });
    socket.on('lw:skipWolfAbility', ({ roomId }) => {
        const room = lwRooms[roomId];
        if (!room || room.phase !== 'wolfAction') return;
        lwSkipWolfAbility(room, roomId, socket.id);
    });

    /* 能力スキップ（対象選択の解除） */
    socket.on('lw:skipAbility', ({ roomId }) => {
        const room = lwRooms[roomId];
        if (!room || room.phase !== 'ability') return;
        lwSkipAbility(room, roomId, socket.id);
    });

    /* 投票 */
    socket.on('lw:vote', ({ roomId, targetId }) => {
        const room = lwRooms[roomId];
        if (!room) return;
        lwSubmitVote(room, roomId, socket.id, targetId);
    });

    /* フェーズチャット（能力・会議・投票・人狼行動フェーズ共通）
     * 人狼行動フェーズだけは特別扱い：人狼陣営(人狼・ギャンブラー・詐欺師・スパイ)にしか届かない、
     * 人狼ONLINEの「夜チャット」と同じ仕様のこっそりチャット。 */
    socket.on('lw:phaseChat', ({ roomId, message }) => {
        const room = lwRooms[roomId];
        if (!room || !['ability', 'council', 'voting', 'wolfAction'].includes(room.phase)) return;
        const me = room.players.find(p => p.id === socket.id);
        if (!me || !me.alive || !message || !message.trim()) return;
        const msg = message.trim().slice(0, 200);

        if (room.phase === 'wolfAction') {
            if ((LW_ROLES[me.role] || {}).team !== 'wolf') return; // 村人陣営はここでは発言できない
            room.players
                .filter(p => (LW_ROLES[p.role] || {}).team === 'wolf' && !p.cpu)
                .forEach(w => io.to(w.id).emit('lw:phaseChatMsg', { name: me.name, color: me.color, message: msg, isWolfChat: true }));
            return;
        }

        io.to('lw:' + roomId).emit('lw:phaseChatMsg', { name: me.name, color: me.color, message: msg });
    });

    /* ホスト専用：フェーズ強制終了 */
    socket.on('lw:hostFinishAbility', ({ roomId }) => {
        const room = lwRooms[roomId];
        if (!room || room.host !== socket.id || room.phase !== 'ability') return;
        if (room._abilityTimer) { clearTimeout(room._abilityTimer); room._abilityTimer = null; }
        lwForceAbilityPhase(room, roomId);
    });
    socket.on('lw:hostFinishCouncil', ({ roomId }) => {
        const room = lwRooms[roomId];
        if (!room || room.host !== socket.id || room.phase !== 'council') return;
        lwVoteStart(room, roomId);
    });
    socket.on('lw:hostFinishVote', ({ roomId }) => {
        const room = lwRooms[roomId];
        if (!room || room.host !== socket.id || room.phase !== 'voting') return;
        lwFinishVote(room, roomId);
    });
    socket.on('lw:hostFinishWolfAction', ({ roomId }) => {
        const room = lwRooms[roomId];
        if (!room || room.host !== socket.id || room.phase !== 'wolfAction') return;
        lwForceWolfPhase(room, roomId);
    });

    /* ----------------------------------------------------------------
       切断処理
    ---------------------------------------------------------------- */
    socket.on('disconnect', () => {
        // 人狼 ONLINE クリーンアップ
        for (const rid in rooms) {
            const room = rooms[rid];
            const idx  = room.players.findIndex(p => p.id === socket.id);
            if (idx === -1) continue;
            if (!room.started) {
                room.players.splice(idx, 1);
                if (room.players.filter(p => !p.cpu).length === 0) {
                    delete rooms[rid];
                    clearRoomTimer(rid);
                } else {
                    if (room.host === socket.id) {
                        const next = room.players.find(p => !p.cpu);
                        if (next) room.host = next.id;
                    }
                    broadcast(rid);
                }
            }
        }
        // LIFE WOLF クリーンアップ
        for (const rid in lwRooms) {
            const room = lwRooms[rid];
            const idx  = room.players.findIndex(p => p.id === socket.id);
            if (idx === -1) continue;
            if (!room.started) {
                room.players.splice(idx, 1);
                if (room.players.length === 0) {
                    delete lwRooms[rid];
                } else {
                    if (room.host === socket.id) room.host = room.players[0].id;
                    io.to('lw:' + rid).emit('lw:roomUpdate', { room: room.sanitize() });
                }
            }
        }
    });
});




/* ════════════════════════════════════════════════════════════════
   サーバー起動
════════════════════════════════════════════════════════════════ */
server.listen(3000, () => console.log('🐺 http://localhost:3000'));

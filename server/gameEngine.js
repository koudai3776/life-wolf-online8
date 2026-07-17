class GameEngine {
    constructor(room) {
        this.room  = room;
        this.phase = "waiting";
        this.round = 0;
        this.votes = {};
        this.nightActions = { attackVotes:{}, protectVotes:{}, divineTargets:[] };
        this.knightUsedBy    = new Set(); // 騎士ごとの使用済み管理（ゲーム全体で1回。夜ごとにはリセットしない）
        this.pupDiedThisNight = false; // 子狼が死んだフラグ
        this.extraAttackNext  = false; // 翌夜追加襲撃
        this.events = [];
    }

    /* ── 役職判定ヘルパー ── */
    isAttacker(role)  { return ["wolf","alpha","pup"].includes(role); }
    isWolfTeam(role)  { return ["wolf","alpha","pup","madman","fanatic"].includes(role); }
    isFoxTeam(role)   { return ["fox","heretic"].includes(role); }

    /* ── デフォルト役職構成 ── */
    defaultPool(n) {
        if (n<=3) return ["wolf","seer","villager"];
        if (n===4) return ["wolf","seer","guard","villager"];
        if (n===5) return ["wolf","seer","guard","villager","villager"];
        if (n===6) return ["wolf","wolf","seer","guard","villager","villager"];
        if (n===7) return ["wolf","wolf","seer","guard","medium","villager","villager"];
        const b=["wolf","wolf","wolf","seer","guard","medium","villager","villager","villager"];
        while(b.length<n) b.push("villager");
        return b.slice(0,n);
    }

    /* ── 役職割り当て ── */
    assignRoles() {
        const players = this.room.players;
        // room.rolePool が { id: count } 形式か配列かを許容
        let pool;
        if (Array.isArray(this.room.rolePool)) {
            pool = [...this.room.rolePool];
        } else if (this.room.rolePool && typeof this.room.rolePool === "object") {
            pool = Object.entries(this.room.rolePool)
                         .flatMap(([id,n]) => Array(n).fill(id));
        } else {
            pool = this.defaultPool(players.length);
        }
        while (pool.length < players.length) pool.push("villager");
        pool.splice(players.length);

        // Fisher-Yates シャッフル
        for (let i=pool.length-1; i>0; i--) {
            const j=Math.floor(Math.random()*(i+1));
            [pool[i],pool[j]]=[pool[j],pool[i]];
        }

        players.forEach((p,i) => { p.role=pool[i]; p.alive=true; p.loverId=null; });

        // 恋人ペア設定
        const lovers = players.filter(p=>p.role==="lover");
        for (let i=0; i+1<lovers.length; i+=2) {
            lovers[i].loverId   = lovers[i+1].id;
            lovers[i+1].loverId = lovers[i].id;
        }
    }

    startGame() {
        this.assignRoles();
        this.phase="night"; this.round=1; this.events=[];
        this._resetNight();
    }
    startDay()   { this.phase="day";   this.votes={}; this.events=[]; }
    startNight() { this.phase="night"; this.round++;  this.events=[]; this._resetNight(); }
    _resetNight(){
        this.nightActions = { attackVotes:{}, protectVotes:{}, divineTargets:[] };
        this.pupDiedThisNight = false;
        this.seerUsedBy = new Set(); // 占い師ごとの使用済み管理（1夜ごとにリセット）
    }

    vote(fromId, toId) { this.votes[fromId]=toId; }

    /* 役職から夜アクション種別を決定。占い師は1人につき1夜1回のみ。人狼系・狩人系は個別に記録（複数人いても独立して動作）。戻り値: 成功=true */
    nightAction(role, targetId, voterId) {
        if (role === "seer") {
            if (this.seerUsedBy.has(voterId)) return false; // この占い師は今夜すでに占い済み
            this.nightActions.divineTargets.push(targetId);
            this.seerUsedBy.add(voterId);
            return true;
        }
        if (this.isAttacker(role)) {
            this.nightActions.attackVotes[voterId] = targetId; // 仲間ごとの個別票
            return true;
        }
        if (role === "guard") {
            this.nightActions.protectVotes[voterId] = targetId; // 狩人ごとに独立して対象を選択
            return true;
        }
        return true;
    }

    /* 人狼陣営の襲撃先の票集計 {targetId: count} */
    getAttackTally() {
        const tally = {};
        Object.values(this.nightActions.attackVotes).forEach(id=>{
            tally[id] = (tally[id]||0)+1;
        });
        return tally;
    }

    /* 票数の多い順に襲撃先を決定（同数はランダム） */
    resolveAttackTarget() {
        const tally = this.getAttackTally();
        const ids = Object.keys(tally);
        if (!ids.length) return null;
        const max = Math.max(...Object.values(tally));
        const cands = ids.filter(id=>tally[id]===max);
        return cands[Math.floor(Math.random()*cands.length)];
    }

    /* 現在守られている対象のSet（狩人が複数人いれば全員分を合算） */
    getProtectedSet() {
        return new Set(Object.values(this.nightActions.protectVotes));
    }

    /* 騎士の断罪（昼） */
    knightAccuse(targetId, voterId) {
        if (this.knightUsedBy.has(voterId)) return {ok:false, reason:"already_used"};
        this.knightUsedBy.add(voterId);
        const target = this.room.players.find(p=>p.id===targetId);
        if (!target||!target.alive) return {ok:false, reason:"invalid"};

        if (this.isAttacker(target.role)) {
            const dead = this._kill(targetId);
            return {ok:true, result:"wolf_died", dead, targetName:target.name};
        } else {
            // 外れた場合は断罪した本人（その騎士）が死ぬ。他の騎士には影響しない
            const dead = this._kill(voterId);
            return {ok:true, result:"knight_died", dead, targetName:target.name};
        }
    }

    /* プレイヤーを殺す（恋人連鎖あり）→ 死者配列を返す */
    _kill(playerId) {
        const p = this.room.players.find(p=>p.id===playerId);
        if (!p||!p.alive) return [];
        p.alive=false;
        const dead=[p];
        if (p.loverId) {
            const lover = this.room.players.find(l=>l.id===p.loverId&&l.alive);
            if (lover) { lover.alive=false; dead.push(lover); }
        }
        return dead;
    }

    /* 夜の解決 */
    resolveNight() {
        this.events=[];
        const divineTargets = this.nightActions.divineTargets;
        const protectedSet  = this.getProtectedSet();
        const attack = this.resolveAttackTarget(); // 人狼陣営の多数決で決定

        // server.js側で「狩人/人狼への個別結果通知」を組み立てるために記録
        this.lastResolvedAttack = attack;
        this.lastProtectedSet   = protectedSet;

        // ── 1ターン目は全員安全（占い結果は届くが死者なし） ──
        if (this.round === 1) {
            this.events.push({type:"first_night_safe"});
            return this.events;
        }

        // ── 占い師の占い（2ターン目以降：妖狐死亡あり。複数人いれば全員分チェック） ──
        divineTargets.forEach(divineId=>{
            const t = this.room.players.find(p=>p.id===divineId);
            if (t&&t.alive&&t.role==="fox") {
                const dead = this._kill(divineId);
                dead.forEach(p=>this.events.push({type:"fox_seer_kill",id:p.id,name:p.name}));
            }
        });

        // ── 人狼の襲撃（守られている対象なら、狩人が何人いても阻止される） ──
        const isProtected = attack && protectedSet.has(attack);
        if (attack && isProtected) {
            // 狩人の護衛が成功し、襲撃が阻止された
            const t = this.room.players.find(p=>p.id===attack);
            if (t) this.events.push({type:"attack_blocked", id:t.id, name:t.name});
        } else if (attack && !isProtected) {
            const t = this.room.players.find(p=>p.id===attack);
            if (t&&t.alive) {
                if (t.role==="fox") {
                    // 妖狐は不死
                    this.events.push({type:"fox_immune",id:t.id});
                } else if (t.role==="cursed") {
                    // 呪い師は人狼に変身
                    t.role="wolf";
                    this.events.push({type:"cursed_wolf",id:t.id,name:t.name});
                } else {
                    const dead = this._kill(attack);
                    dead.forEach(p=>{
                        if (p.role==="joker") {
                            this.events.push({type:"joker_win",id:p.id,name:p.name});
                        } else if (p.role==="pup") {
                            this.events.push({type:"pup_died",id:p.id,name:p.name});
                            this.extraAttackNext=true;
                        } else {
                            this.events.push({type:"night_kill",id:p.id,name:p.name});
                        }
                    });
                }
            }
        }

        // ── 子狼特殊：翌夜追加自動襲撃 ──
        if (this.extraAttackNext) {
            this.extraAttackNext=false;
            const targets = this.room.players.filter(p=>p.alive&&!this.isAttacker(p.role));
            if (targets.length) {
                const t2 = targets[Math.floor(Math.random()*targets.length)];
                if (t2.id!==attack || targets.length===1) {
                    const dead2 = this._kill(t2.id);
                    dead2.forEach(p=>this.events.push({type:"pup_bonus_kill",id:p.id,name:p.name}));
                }
            }
        }

        return this.events;
    }

    /* 投票の処刑 */
    executeVote() {
        this.events=[];
        const aliveIds = this.room.players.filter(p=>p.alive).map(p=>p.id); // CPUも含む
        const tally={};
        for (const [from,to] of Object.entries(this.votes)) {
            if (aliveIds.includes(from)) tally[to]=(tally[to]||0)+1;
        }

        if (!Object.keys(tally).length) {
            this.events.push({type:"no_execution"}); return this.events;
        }
        const max  = Math.max(...Object.values(tally));
        const cands = Object.keys(tally).filter(id=>tally[id]===max);
        const exId  = cands[Math.floor(Math.random()*cands.length)];
        const ex    = this.room.players.find(p=>p.id===exId);
        if (!ex) return this.events;

        // 聖女 → 即狼勝利
        if (ex.role==="saint") {
            ex.alive=false;
            this.events.push({type:"saint_executed",id:ex.id,name:ex.name});
            this.events.push({type:"wolf_win_saint"});
            return this.events;
        }
        // てるてる坊主 → 1日目処刑で単独勝利
        if (ex.role==="angel"&&this.round===1) {
            ex.alive=false;
            this.events.push({type:"angel_win",id:ex.id,name:ex.name});
            return this.events;
        }

        // 通常処刑（恋人連鎖あり）
        const dead = this._kill(exId);
        dead.forEach(p=>this.events.push({type:"executed",id:p.id,name:p.name}));

        // 猫又 → 投票者を道連れ
        if (ex.role==="cat") {
            const voters = Object.entries(this.votes)
                .filter(([f,t])=>t===exId&&aliveIds.includes(f)).map(([f])=>f);
            if (voters.length) {
                const v = voters[Math.floor(Math.random()*voters.length)];
                const vp = this.room.players.find(p=>p.id===v&&p.alive);
                if (vp) {
                    const cd = this._kill(v);
                    cd.forEach(p=>this.events.push({type:"cat_drag",id:p.id,name:p.name}));
                }
            }
        }
        // 復讐者 → ランダム道連れ
        if (ex.role==="avenger") {
            const alive2 = this.room.players.filter(p=>p.alive&&p.id!==exId);
            if (alive2.length) {
                const v2=alive2[Math.floor(Math.random()*alive2.length)];
                const ad=this._kill(v2.id);
                ad.forEach(p=>this.events.push({type:"avenger_drag",id:p.id,name:p.name}));
            }
        }
        return this.events;
    }

    /* 占い結果：人狼かどうかの2択のみ
       大狼は「占いでは人狼ではないと出る」のが特徴のため除外。
       妖狐・狂人・狂信者・村人系は全て「人狼ではない」。 */
    getSeerResult(targetId) {
        const t = this.room.players.find(p=>p.id===targetId);
        if (!t) return null;
        const appearsAsWolf = ["wolf","pup"].includes(t.role); // alphaは含めない（変装）
        return { targetId, name:t.name, isWolf:appearsAsWolf };
    }

    /* 生存中の恋人ペア（両方aliveのペアのみ）を返す。複数ペアいる場合は全て返す */
    getSurvivingLoverPairs() {
        const lovers = this.room.players.filter(p=>p.role==="lover");
        const pairs=[]; const seen=new Set();
        lovers.forEach(p=>{
            if (seen.has(p.id)) return;
            const partner = this.room.players.find(q=>q.id===p.loverId);
            if (!partner) return;
            seen.add(p.id); seen.add(partner.id);
            if (p.alive && partner.alive) pairs.push([p,partner]);
        });
        return pairs;
    }

    /* 勝敗判定 */
    checkWinner() {
        let winner = null;
        this.lastWinnerDetail = null; // 即時勝利を起こした「本人」を正確に記録（複数体いる場合の誤帰属を防ぐ）

        const jokerWinEvent = this.events.find(e=>e.type==="joker_win");
        const angelWinEvent = this.events.find(e=>e.type==="angel_win");

        if (jokerWinEvent) {
            winner = "joker";
            this.lastWinnerDetail = { id:jokerWinEvent.id, name:jokerWinEvent.name };
        } else if (angelWinEvent) {
            winner = "angel";
            this.lastWinnerDetail = { id:angelWinEvent.id, name:angelWinEvent.name };
        } else if (this.events.find(e=>e.type==="wolf_win_saint")) {
            winner = "wolf";
            const saintEvent = this.events.find(e=>e.type==="saint_executed");
            if (saintEvent) {
                this.lastWinnerDetail = { id:saintEvent.id, name:saintEvent.name, cause:"saint" };
            }
        } else {
            const alive      = this.room.players.filter(p=>p.alive);
            const wolves     = alive.filter(p=>this.isAttacker(p.role));
            const foxes      = alive.filter(p=>p.role==="fox");
            const nonWolves  = alive.filter(p=>!this.isAttacker(p.role));

            if (wolves.length>0 && wolves.length>=nonWolves.length) winner = "wolf";
            else if (wolves.length===0) winner = foxes.length>0 ? "fox" : "village";
        }

        // 恋人陣営：ゲームが終了する瞬間にペアが2人とも生存していれば、
        // 他のどの陣営の勝利条件が成立していても恋人陣営の勝利で上書きする
        if (winner && this.getSurvivingLoverPairs().length > 0) {
            winner = "lover";
        }

        return winner;
    }
}

module.exports = GameEngine;

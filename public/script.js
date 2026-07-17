/* ══════════════════════════════════
   役職データ
══════════════════════════════════ */
const ROLES=[
  {id:"villager",name:"村人",    team:"village",icon:"🏘️",desc:"特殊能力なし。昼の議論で人狼を見つけよう。"},
  {id:"seer",    name:"占い師",  team:"village",icon:"🔮",desc:"毎夜1人を占い、人狼かどうかだけを知る（大狼・狂人・狂信者・妖狐は「人狼ではない」と出る）。妖狐を占うと、その妖狐はひそかに死亡する。"},
  {id:"medium",  name:"霊媒師",  team:"village",icon:"👁️",desc:"処刑された人の役職が夜明けにわかる。"},
  {id:"guard",   name:"狩人",    team:"village",icon:"🛡️",desc:"毎夜1人を狼の襲撃から守る。"},
  {id:"knight",  name:"騎士",    team:"village",icon:"⚔️",desc:"昼に1度だけ断罪できる。人狼なら討伐、外れなら自分が死亡。"},
  {id:"cat",     name:"猫又",    team:"village",icon:"🐱",desc:"投票で処刑されると投票者1人を道連れにする。"},
  {id:"shared",  name:"共有者",  team:"village",icon:"🤝",desc:"もう1人の共有者を知っている。2枚以上選択。"},
  {id:"cursed",  name:"呪い師",  team:"village",icon:"🧿",desc:"狼に噛まれると死なず人狼に変身する。"},
  {id:"wolf",    name:"人狼",    team:"wolf",   icon:"🐺",desc:"毎夜1人を襲撃。人狼同士はお互いを知っている。"},
  {id:"madman",  name:"狂人",    team:"wolf",   icon:"🤪",desc:"人狼陣営。仲間の人狼は知らない。占いでは「人狼ではない」と出る。"},
  {id:"fanatic", name:"狂信者",  team:"wolf",   icon:"😤",desc:"人狼が誰かを知っている。占いでは「人狼ではない」と出る。夜の行動なし。"},
  {id:"alpha",   name:"大狼",    team:"wolf",   icon:"🦁",desc:"占いでは「人狼ではない」と出る強力な人狼。毎夜1人を襲撃できる。"},
  {id:"pup",     name:"子狼",    team:"wolf",   icon:"🐶",desc:"通常の人狼。死亡した翌夜は追加で1人が自動的に襲われる。"},
  {id:"fox",     name:"妖狐",    team:"fox",    icon:"🦊",desc:"狼の襲撃無効。占いでは「人狼ではない」と出るが、占われるとひそかに死亡する。ゲーム終了時生存で勝利。"},
  {id:"heretic", name:"背徳者",  team:"fox",    icon:"🎭",desc:"妖狐と共に勝利。開始時に妖狐が誰かを知る。"},
  {id:"joker",   name:"ジョーカー",team:"other",icon:"🃏",desc:"狼に殺されると単独勝利。処刑されると負け。"},
  {id:"angel",   name:"てるてる坊主",team:"other",icon:"⛩️",desc:"1日目の投票で処刑されると単独勝利。それ以外は負け。"},
  {id:"lover",   name:"恋人",    team:"lover",icon:"💕",desc:"開始時にもう1人の恋人を知る。一方が死ぬと他方も死亡。ゲーム終了時にペアが2人とも生存していれば、他の陣営の勝利条件が成立していても恋人陣営が勝つ（複数ペアいる場合は生き残ったペアが勝利）。2枚以上選択。"},
  {id:"avenger", name:"復讐者",  team:"village",icon:"💀",desc:"投票で処刑されると他プレイヤー1人をランダムに道連れにする。"},
  {id:"saint",   name:"聖女",    team:"village",icon:"👸",desc:"投票で処刑されると人狼陣営が即勝利する。"}
];
const ROLE_MAP=Object.fromEntries(ROLES.map(r=>[r.id,r]));
const TEAM_COLORS={village:"b-village",wolf:"b-wolf",fox:"b-fox",other:"b-other",lover:"b-lover"};

/* ══════════════════════════════════
   状態
══════════════════════════════════ */
const G={
  myName:"",myRole:"",myRoleName:"",myRoleIcon:"",myTeam:"",myRoleDesc:"",
  roomId:"",isHost:false,
  subphase:"night",  // "night" | "discuss" | "vote"
  phase:"night",
  round:1,
  players:[],knightUsed:false,
  allies:{},
  myVote:null,myNightTarget:null,seerDivineUsed:false,
  seerResults:{},mediumPending:null,
  voteCast:0, voteTotal:0,  // 投票合計（誰が誰に投票したかは非公開）
  wolfTally:{},             // 人狼陣営専用：襲撃先ごとの票数（仲間内では公開）
  rolePool:{},
  timeConfig:{night:60,discuss:90,vote:30},
  infoMode:"full"   // "full" | "faction" | "hidden"
};

const socket=io();
const $=id=>document.getElementById(id);

/* ══════════════════════════════════
   タイマー
══════════════════════════════════ */
let _timerInterval=null, _timerEnd=0, _timerDur=0;

function startCountdown(duration, ts){
  stopCountdown();
  if(!duration||duration<=0){
    $("timer-box").style.display="none";
    return;
  }
  _timerDur=duration;
  _timerEnd=ts+duration*1000;
  $("timer-box").style.display="flex";
  _tick();
  _timerInterval=setInterval(_tick, 250);
}
function _tick(){
  const rem=Math.max(0,Math.ceil((_timerEnd-Date.now())/1000));
  $("timer-text").textContent=rem+"秒";
  const pct=_timerDur>0?rem/_timerDur:0;
  $("timer-bar-fill").style.width=(pct*100)+"%";
  $("timer-bar-fill").style.background=pct>0.5?"#27ae60":pct>0.25?"#f39c12":"#e74c3c";
  if(rem<=0) stopCountdown();
}
function stopCountdown(){
  if(_timerInterval){clearInterval(_timerInterval);_timerInterval=null;}
  $("timer-box").style.display="none";
}

/* ══════════════════════════════════
   画面切替
══════════════════════════════════ */
function showScreen(id){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  $(id).classList.add("active");
}
function showErr(id,msg){const e=$(id);if(e){e.textContent=msg;setTimeout(()=>e.textContent="",4000);}}

/* ══════════════════════════════════
   ログイン
══════════════════════════════════ */
function createRoom(){
  const n=$("inp-name").value.trim();
  if(!n){showErr("login-err","名前を入力してください");return;}
  G.myName=n; socket.emit("createRoom",n);
}
function joinRoom(){
  const n=$("inp-name").value.trim(),r=$("inp-room").value.trim().toUpperCase();
  if(!n||!r){showErr("login-err","名前とルームIDを入力してください");return;}
  G.myName=n; socket.emit("joinRoom",{playerName:n,roomId:r});
}

/* ══════════════════════════════════
   ロビー
══════════════════════════════════ */
function copyRoomId(){navigator.clipboard.writeText(G.roomId).catch(()=>{});alert("コピー: "+G.roomId);}
function addCPU(){socket.emit("addCPU",G.roomId);}
function removeCPU(){socket.emit("removeCPU",G.roomId);}
function startGame(){socket.emit("startGame",G.roomId);}

function renderLobby(room){
  $("lobby-rid").textContent=G.roomId;
  let h="";
  room.players.forEach(p=>{h+=`<div class="lobby-player">${p.cpu?"🤖":"😊"} <b>${p.name}</b></div>`;});
  $("lobby-players").innerHTML=h;
  $("lobby-host-area").style.display=G.isHost?"block":"none";
  $("rc-players").textContent=room.players.length;
  if(G.isHost) updateRoleSummary();
}

/* ── 役職設定 ── */
function toggleRoleConfig(){
  const b=$("role-config-body"),open=b.classList.toggle("open");
  $("role-config-toggle").textContent=open?"⚙️ 役職設定（クリックで閉じる）":"⚙️ 役職設定（クリックで開く）";
  if(open) renderRoleGrid();
}
function renderRoleGrid(){
  const teams=[
    {key:"village",label:"🏘️ 村人陣営",cls:"team-village"},
    {key:"wolf",   label:"🐺 人狼陣営",cls:"team-wolf"},
    {key:"fox",    label:"🦊 妖狐陣営",cls:"team-fox"},
    {key:"lover",  label:"💕 恋人陣営",cls:"team-lover"},
    {key:"other",  label:"✨ 第三陣営",cls:"team-other"}
  ];
  let h="";
  teams.forEach(({key,label,cls})=>{
    const list=ROLES.filter(r=>r.team===key);
    h+=`<div class="team-section"><div class="team-title ${cls}">${label}</div><div class="role-cards">`;
    list.forEach(r=>{
      const cnt=G.rolePool[r.id]||0;
      h+=`<div class="role-card">
        <div class="role-card-top"><span class="role-card-icon">${r.icon}</span>
          <span class="role-card-name">${r.name}</span></div>
        <div class="role-card-desc">${r.desc}</div>
        <div class="role-card-ctrl">
          <button onclick="chRole('${r.id}',-1)">－</button>
          <span class="role-card-count" id="rc-${r.id}">${cnt}</span>
          <button onclick="chRole('${r.id}',1)">＋</button>
        </div></div>`;
    });
    h+="</div></div>";
  });
  $("role-grid").innerHTML=h;
  updateRoleSummary();
}
function chRole(id,delta){
  const cur=G.rolePool[id]||0, next=Math.max(0,cur+delta);
  if(next===0) delete G.rolePool[id]; else G.rolePool[id]=next;
  const el=$("rc-"+id); if(el) el.textContent=next;
  updateRoleSummary();
  socket.emit("setRoles",{roomId:G.roomId,rolePool:G.rolePool});
}
function updateRoleSummary(){
  const total=Object.values(G.rolePool).reduce((s,n)=>s+n,0);
  const players=G.players.length;
  $("rc-total").textContent=total;
  const warn=$("rc-warn");
  const hasWolf=["wolf","alpha","pup"].some(id=>G.rolePool[id]>0);
  const loverOdd=(G.rolePool.lover>0)&&(G.rolePool.lover%2!==0);
  const sharedOne=G.rolePool.shared===1;
  if(total===0){warn.textContent="";warn.className="ok";}
  else if(total!==players){warn.textContent=` ⚠️ プレイヤー数と合っていません`;warn.className="ng";}
  else if(!hasWolf){warn.textContent=" ⚠️ 人狼系の役職が必要です";warn.className="ng";}
  else if(loverOdd){warn.textContent=` ⚠️ 恋人は2人1組で選択してください（現在${G.rolePool.lover}人）`;warn.className="ng";}
  else if(sharedOne){warn.textContent=" ⚠️ 共有者は2人以上で選択してください（現在1人）";warn.className="ng";}
  else{warn.textContent=" ✅ OK";warn.className="ok";}
}
function setDefaultRoles(){
  const n=G.players.length;
  if(n<=3)     G.rolePool={wolf:1,seer:1,villager:1};
  else if(n===4) G.rolePool={wolf:1,seer:1,guard:1,villager:1};
  else if(n===5) G.rolePool={wolf:1,seer:1,guard:1,villager:2};
  else if(n===6) G.rolePool={wolf:2,seer:1,guard:1,villager:2};
  else if(n===7) G.rolePool={wolf:2,seer:1,guard:1,medium:1,villager:2};
  else{ G.rolePool={wolf:3,seer:1,guard:1,medium:1}; G.rolePool.villager=Math.max(1,n-6); }
  socket.emit("setRoles",{roomId:G.roomId,rolePool:G.rolePool});
  renderRoleGrid();
}
function clearRoles(){ G.rolePool={}; socket.emit("setRoles",{roomId:G.roomId,rolePool:G.rolePool}); renderRoleGrid(); }

/* ── タイマー設定 ── */
function setTimer(phase, seconds){
  G.timeConfig[phase]=seconds;
  socket.emit("setTimers",{roomId:G.roomId,timeConfig:G.timeConfig});
  renderTimerButtons();
}
const INFO_MODE_HINTS={
  full:    "初心者向け：役職と人数が全員に見えます",
  faction: "経験者向け：陣営ごとの人数だけが見えます",
  hidden:  "上級者向け：役職情報は一切表示されません"
};
function setInfoMode(mode){
  G.infoMode=mode;
  socket.emit("setInfoMode",{roomId:G.roomId, infoMode:mode});
  const c=$("tcb-infomode"); if(!c) return;
  c.querySelectorAll(".tc-btn").forEach(btn=>{
    btn.classList.toggle("sel", btn.dataset.val===G.infoMode);
  });
  const hint=$("im-hint"); if(hint) hint.textContent=INFO_MODE_HINTS[mode]||"";
}
function renderTimerButtons(){
  ["night","discuss","vote"].forEach(phase=>{
    const c=$("tcb-"+phase); if(!c) return;
    c.querySelectorAll(".tc-btn").forEach(btn=>{
      btn.classList.toggle("sel", parseInt(btn.dataset.val)===G.timeConfig[phase]);
    });
  });
}

/* ══════════════════════════════════
   ゲーム画面
══════════════════════════════════ */
function myPlayer(){ return G.players.find(p=>p.name===G.myName); }
function isAlive()  { const m=myPlayer(); return m?m.alive:false; }
function isWolfRole(r){ return["wolf","alpha","pup"].includes(r); }

function updateGameScreen(){
  const sp=G.subphase; // "night" | "discuss" | "vote"
  const hdr=$("game-header");
  hdr.className=sp==="night"?"night":sp==="discuss"?"discuss":"vote";

  // 役職バッジ
  const badge=$("role-badge");
  badge.textContent=(G.myRoleIcon||"❓")+" "+(G.myRoleName||"？");
  badge.className="badge "+(TEAM_COLORS[G.myTeam]||"b-village");

  // フェーズ表示
  const pl=$("phase-label");
  if(sp==="night")   { pl.textContent=`🌙 第${G.round}夜`;         pl.className="night"; }
  if(sp==="discuss") { pl.textContent=`💬 第${G.round}日目 議論中`; pl.className="discuss"; }
  if(sp==="vote")    { pl.textContent=`🗳️ 第${G.round}日目 投票中`; pl.className="vote"; }

  // ホストボタン
  if(G.isHost){
    $("btn-fn").style.display=sp==="night"   ?"inline-block":"none";
    $("btn-fd").style.display=sp==="discuss" ?"inline-block":"none";
    $("btn-fv").style.display=sp==="vote"    ?"inline-block":"none";
  }

  // チャット
  const canChat=isAlive()&&(sp!=="night"||isWolfRole(G.myRole));
  $("chat-input").disabled=!canChat;
  $("btn-send").disabled=!canChat;
  document.querySelectorAll(".rxn-btn").forEach(b=>b.disabled=!canChat);
  $("chat-input").placeholder=
    sp==="night"   ? (isWolfRole(G.myRole)?"🐺 狼チャット（仲間のみ）":"💤 夜は眠っています…")
    :sp==="discuss"? (isAlive()?"💬 自由に話し合ってください":"💀 発言できません")
    :                (isAlive()?"🗳️ 投票フェーズです（チャット可）":"💀 発言できません");

  // 観戦チャット：死亡者のみ表示
  const dead=!isAlive();
  $("spec-bar").style.display=dead?"flex":"none";
  // リアクションバーと通常チャット行は死亡者には不要なので非表示（画面スペースを節約）
  $("reaction-bar").style.display=dead?"none":"flex";
  $("chat-row").style.display=dead?"none":"flex";

  renderPlayers();
  renderAction();
}

function renderPlayers(){
  const sp=G.subphase;
  const alive=isAlive();
  let h="";
  G.players.forEach(p=>{
    const isMe=p.name===G.myName, dead=!p.alive;
    const isWolfAlly=isWolfRole(G.myRole)&&isWolfRole(p.role)&&!isMe;
    const isAllyMember=G.allies.members&&G.allies.members.find(m=>m.id===p.id)&&!isMe;

    let btn="";
    if(alive&&!isMe&&!dead){
      if(sp==="night"){
        if(isWolfRole(G.myRole)&&!isWolfAlly&&G.round>1){
          const s=p.id===G.myNightTarget;
          const wc=G.wolfTally[p.id]||0;
          const wb=wc>0?`<span class="vbadge">${wc}</span>`:"";
          btn=`<button class="pb ${s?"sel-wolf":""}" onclick="doNight('${p.id}')">${s?"🎯狙中":"🗡️狙う"}${wb}</button>`;
        }else if(G.myRole==="seer"){
          if(G.seerDivineUsed){
            // 使用済み：対象だけ表示、他はボタンなし
            if(p.id===G.myNightTarget)
              btn=`<span class="pb sel-seer" style="opacity:.7;cursor:default">🔮占済</span>`;
          }else{
            const s=p.id===G.myNightTarget;
            btn=`<button class="pb ${s?"sel-seer":""}" onclick="doNight('${p.id}')">${s?"🔮選択中":"🔮占う"}</button>`;
          }
        }else if(G.myRole==="guard"&&G.round>1){
          const s=p.id===G.myNightTarget;
          btn=`<button class="pb ${s?"sel-guard":""}" onclick="doNight('${p.id}')">${s?"🛡️護中":"🛡️守る"}</button>`;
        }
      }else if(sp==="vote"){
        // 誰が何票か非公開：自分の投票先のみハイライト
        const vs=p.id===G.myVote;
        btn=`<button class="pb ${vs?"sel-vote":""}" onclick="doVote('${p.id}')">${vs?"✅ 投票済":"🗳️ 投票"}</button>`;
        if(G.myRole==="knight"&&!G.knightUsed)
          btn+=` <button class="pb acc" onclick="knightAccuse('${p.id}')">⚔️断罪</button>`;
      }else if(sp==="discuss"){
        // 議論中：騎士の断罪のみ（票数非表示）
        if(G.myRole==="knight"&&!G.knightUsed)
          btn=`<button class="pb acc" onclick="knightAccuse('${p.id}')">⚔️断罪</button>`;
      }
    }

    // タグ
    let tags="";
    if(isWolfAlly) tags+=`<span class="pc-tag" style="color:#ff8888">🐺仲間</span>`;
    else if(isAllyMember){
      const t=G.allies.type;
      const label={wolf:"🐺仲間",fox:"🦊仲間",shared:"🤝共有",lover:"💕恋人"}[t]||"仲間";
      tags+=`<span class="pc-tag" style="color:#88ccff">${label}</span>`;
    }
    if(G.myRole==="seer"&&G.seerResults[p.id]){
      const r=G.seerResults[p.id];
      const col=r.isWolf?"#ff7070":"#70e890";
      const lbl=r.isWolf?"🐺人狼":"⚪人狼でない";
      tags+=`<span class="pc-tag" style="color:${col}">${lbl}</span>`;
    }

    h+=`<div class="pc ${dead?"dead":""} ${isMe?"me":""}">
      <span class="pc-icon">${dead?"💀":p.cpu?"🤖":"😊"}</span>
      <div style="flex:1;min-width:0">
        <div class="pc-name ${dead?"dn":""}">${p.name}${isMe?` <small style="color:#5577ee">(自分)</small>`:""}</div>
        ${tags}
      </div>
      ${btn}</div>`;
  });
  $("players-list").innerHTML=h;
}

function renderAction(){
  const sp=G.subphase, r=G.myRole, panel=$("action-panel");
  if(!r){panel.innerHTML="";return;}

  // チーム情報ボックス
  let teamBox="";
  if(G.allies&&G.allies.members&&G.allies.members.length){
    const t=G.allies.type;
    const icons={wolf:"🐺",fox:"🦊",shared:"🤝",fanatic_wolf_reveal:"😤",heretic_fox_reveal:"🎭",lover:"💕"};
    const labels={wolf:"仲間の人狼",fox:"仲間の妖狐",shared:"共有者",
                  fanatic_wolf_reveal:"人狼（狂信者として把握）",heretic_fox_reveal:"妖狐（背徳者として把握）",lover:"恋人"};
    const members=G.allies.members.filter(m=>m.name!==G.myName).map(m=>m.name).join("、");
    if(members) teamBox=`<div class="team-reveal-box">${icons[t]||"👥"} ${labels[t]||"仲間"}：<b>${members}</b></div>`;
  }

  let h="";

  if(sp==="night"){
    const tgt=G.myNightTarget?G.players.find(p=>p.id===G.myNightTarget):null;
    if(!isAlive()){
      h=`<div class="ap-title ap-other">💀 あなたはすでに死亡しています</div>`;
    }else if(isWolfRole(r)&&G.round>1){
      h=`<div class="ap-title ap-wolf">🐺 夜の行動 — 誰を襲いますか？</div>
         ${teamBox}
         <div class="ap-status">${tgt?`🎯 <b>${tgt.name}</b> を狙っています`:"← 左のプレイヤーを選んでください"}</div>
         <div class="ap-info">💬 チャット欄で仲間の狼と話せます</div>`;
    }else if(r==="seer"){
      const res=Object.entries(G.seerResults).map(([id,sr])=>{
        const p=G.players.find(p=>p.id===id);if(!p)return"";
        const cls=sr.isWolf?"seer-wolf":"seer-vill";
        const lbl=sr.isWolf?"🐺 人狼でした":"⚪ 人狼ではありませんでした";
        return `<div class="seer-row ${cls}">${p.name}：${lbl}</div>`;
      }).join("");
      const tgt2=G.myNightTarget?G.players.find(p=>p.id===G.myNightTarget):null;
      h=`<div class="ap-title ap-seer">🔮 占い — 誰を占いますか？</div>
         <div class="ap-status">${tgt2?`🔮 <b>${tgt2.name}</b> を占いました`:"← 左のプレイヤーを選んでください"}</div>
         ${res?`<div style="margin-top:6px"><b style="font-size:11px;color:#5060a0">占い結果メモ</b>${res}</div>`:""}`;
    }else if(r==="guard"&&G.round>1){
      h=`<div class="ap-title ap-guard">🛡️ 護衛 — 誰を守りますか？</div>
         <div class="ap-status">${tgt?`🛡️ <b>${tgt.name}</b> を守っています`:"← 左のプレイヤーを選んでください"}</div>`;
    }else if(r==="fanatic"){
      h=`<div class="ap-title ap-wolf">😤 狂信者</div>${teamBox}
         <div class="ap-info">人狼陣営の一員です。夜の行動はできません。</div>`;
    }else if(r==="heretic"){
      h=`<div class="ap-title ap-fox" style="color:#ffc050">🎭 背徳者</div>${teamBox}
         <div class="ap-info">妖狐と共に勝利を目指しましょう。夜の行動はできません。</div>`;
    }else if(r==="medium"){
      h=`<div class="ap-title ap-medium">👁️ 霊媒師</div>
         <div class="ap-info">処刑された者の役職が夜明けにわかります。</div>
         <div class="ap-info" style="margin-top:4px">😴 夜明けをお待ちください…</div>`;
    }else{
      h=`<div class="ap-title ap-other">😴 夜が明けるのをお待ちください</div>
         ${teamBox}
         <div class="ap-info">${G.myRoleIcon||""} あなたの役職：<b>${G.myRoleName}</b></div>
         <div class="ap-info">${G.myRoleDesc||""}</div>`;
    }

  }else if(sp==="discuss"){
    h=`<div class="ap-title ap-discuss">💬 議論フェーズ — 自由に話し合ってください！</div>
       ${teamBox}
       <div class="ap-info">投票は次の投票フェーズで行います</div>`;
    if(r==="knight"&&!G.knightUsed)
      h+=`<div class="ap-info" style="color:#ffcc55">⚔️ 断罪（1回限り）：プレイヤー横のボタンで使用可</div>`;

  }else{
    // vote
    const tvt=G.myVote?G.players.find(p=>p.id===G.myVote):null;
    const al=G.players.filter(p=>p.alive).length;
    const cast=G.voteCast||0;
    const vtotal=G.voteTotal||al;
    const remain=vtotal-cast;
    h=`<div class="ap-title ap-day">🗳️ 投票フェーズ — 誰を処刑しますか？</div>
       ${teamBox}
       <div class="ap-status">あなたの投票：${tvt?`<b>${tvt.name}</b>`:"（未投票）"}</div>
       <div class="ap-status" style="font-size:18px;font-weight:700;margin-top:6px">
         <span style="color:#f5a020">${cast}</span>
         <span style="color:#7080a0"> / ${vtotal}票</span>
         <span style="color:#a0b0c0;font-size:13px;margin-left:8px">あと${remain}人</span>
       </div>`;
    if(r==="knight"&&!G.knightUsed)
      h+=`<div class="ap-info" style="color:#ffcc55">⚔️ 断罪（1回限り）も使用可能です</div>`;
    if(r==="knight"&&G.knightUsed)
      h+=`<div class="ap-info" style="color:#5060a0">⚔️ 断罪：使用済み</div>`;
  }

  panel.innerHTML=h;
}

/* ══════════════════════════════════
   ゲームアクション
══════════════════════════════════ */
function doNight(targetId){
  if(G.subphase!=="night"||!isAlive())return;
  if(G.myRole==="seer"&&G.seerDivineUsed)return; // 占い済み
  socket.emit("nightAction",{roomId:G.roomId,targetId});
  G.myNightTarget=targetId; renderPlayers(); renderAction();
}
function doVote(targetId){
  if(G.subphase!=="vote"||!isAlive())return;
  socket.emit("vote",{roomId:G.roomId,targetId});
  G.myVote=targetId; renderPlayers(); renderAction();
}
function knightAccuse(targetId){
  if(!isAlive()||G.knightUsed)return;
  const t=G.players.find(p=>p.id===targetId);
  if(!confirm(`本当に ${t?.name} を断罪しますか？\n人狼なら討伐成功。外れると自分が死亡します。`))return;
  socket.emit("knightAccuse",{roomId:G.roomId,targetId});
}
function sendChat(){
  const inp=$("chat-input"),msg=inp.value.trim();
  if(!msg||!isAlive())return;
  if(G.subphase==="night"&&!isWolfRole(G.myRole))return;
  socket.emit("chat",{roomId:G.roomId,message:msg}); inp.value="";
}

/* 観戦チャット（死亡者のみ送信可。生存者には届かない） */
function sendSpecChat(){
  const inp=$("spec-input"),msg=inp.value.trim();
  if(!msg||isAlive())return;
  socket.emit("specChat",{roomId:G.roomId,message:msg}); inp.value="";
}

/* 簡易リアクション（😀👍❗🤔😂など）。sendChatと同じ発言制限を流用 */
let _reactionCooldown=false;
function sendReaction(emoji){
  if(_reactionCooldown||!isAlive())return;
  if(G.subphase==="night"&&!isWolfRole(G.myRole))return;
  socket.emit("chat",{roomId:G.roomId,message:emoji});
  _reactionCooldown=true;
  setTimeout(()=>{_reactionCooldown=false;},800); // 連打防止
}

/* ══════════════════════════════════
   ログ / チャット
══════════════════════════════════ */
function addLog(text,cls=""){
  const el=document.createElement("div");
  el.className="le "+cls; el.textContent=text;
  $("game-logs").appendChild(el);
  $("log-area").scrollTop=$("log-area").scrollHeight;
}
const REACTION_EMOJIS=["😀","👍","❗","🤔","😂"];
function addChat(name,msg,isWolf){
  const el=document.createElement("div");
  el.className="cm "+(isWolf?"wolf-chat":"");
  if(REACTION_EMOJIS.includes((msg||"").trim())){
    // リアクション絵文字のみの場合は少し大きく・ポップアニメーション付きで表示
    el.appendChild(document.createTextNode((name||"")+"："));
    const span=document.createElement("span");
    span.className="rxn-pop";
    span.style.fontSize="19px";
    span.textContent=msg;
    el.appendChild(span);
  }else{
    el.textContent=(name||"")+"："+(msg||"");
  }
  $("chat-messages").appendChild(el);
  $("chat-messages").scrollTop=$("chat-messages").scrollHeight;
}
function addSysChat(text){
  const el=document.createElement("div");
  el.className="cm sys"; el.textContent=text;
  $("chat-messages").appendChild(el);
  $("chat-messages").scrollTop=$("chat-messages").scrollHeight;
}

/* ══════════════════════════════════
   ゲームオーバー
══════════════════════════════════ */
/* 役職説明ツールチップの表示/非表示 */
/* 役職ツールチップの中身を埋める（共通化）。showSeerHistory=trueなら占い結果メモも表示 */
function fillRoleTooltip(roleId, showSeerHistory){
  const role = ROLE_MAP[roleId];
  if(!role) return false;
  const teamLabels={village:"🏘️ 村人陣営",wolf:"🐺 人狼陣営",fox:"🦊 妖狐陣営",lover:"💕 恋人陣営",other:"✨ 第三陣営"};
  $("rt-icon").textContent = role.icon||"❓";
  $("rt-name").textContent = role.name||"不明";
  $("rt-team").textContent = teamLabels[role.team]||"";
  $("rt-desc").textContent = role.desc||"説明なし";

  const hist=$("rt-seer-history"), list=$("rt-seer-list");
  if(showSeerHistory && roleId==="seer" && Object.keys(G.seerResults).length>0){
    let h="";
    Object.entries(G.seerResults).forEach(([id,r])=>{
      const p=G.players.find(p=>p.id===id); if(!p) return;
      const col=r.isWolf?"#ff7070":"#70e890";
      const lbl=r.isWolf?"🐺 人狼でした":"⚪ 人狼ではありませんでした";
      h+=`<div style="font-size:12px;color:${col};margin:3px 0">${p.name}：${lbl}</div>`;
    });
    list.innerHTML=h; hist.style.display="block";
  } else {
    hist.style.display="none";
  }
  return true;
}

/* 左上の役職バッジ用：自分の役職＋（占い師なら）占い結果メモも表示 */
function toggleRoleTooltip(){
  const tip=$("role-tooltip");
  if(tip.style.display!=="none"){ tip.style.display="none"; return; }
  if(!fillRoleTooltip(G.myRole, true)) return;
  tip.style.display="block";
}

/* 配役一覧などにホバー／タップしたとき：その役職の一般的な説明だけを表示 */
function peekRoleInfo(roleId){
  if(!fillRoleTooltip(roleId, false)) return;
  $("role-tooltip").style.display="block";
}
function hideRolePeek(){
  $("role-tooltip").style.display="none";
}

/* クリック外でツールチップを閉じる */
document.addEventListener("click", e=>{
  const tip=$("role-tooltip"), badge=$("role-badge");
  if(tip && badge && !tip.contains(e.target) && !badge.contains(e.target)){
    tip.style.display="none";
  }
});

function showGameOver(data){
  const {winner,specialName,cause,players}=data;
  const titles={village:"🏘️ 村人陣営の勝利！",wolf:"🐺 人狼陣営の勝利！",
                fox:"🦊 妖狐の勝利！",joker:"🃏 ジョーカーの勝利！",angel:"⛩️ てるてる坊主の勝利！",
                lover:"💕 恋人陣営の勝利！"};
  const subs={village:"村人たちが人狼を全て退けました！",
              wolf: cause==="saint" ? `${specialName} が処刑されてしまった！聖女の力が失われ、人狼陣営が即勝利しました…` : "闇が村を飲み込みました…",
              fox:"狡猾な妖狐が生き延びました！",
              joker:`${specialName} が人狼に殺され、単独勝利しました！`,
              angel:`${specialName} が1日目に処刑され、単独勝利しました！`,
              lover:`${specialName} が最後まで生き残り、愛を成就させました！`};
  const cls={village:"wv",wolf:"ww",fox:"wf",joker:"wo",angel:"wo",lover:"wlv"};
  const wb=$("winner-banner");
  wb.textContent=titles[winner]||"ゲーム終了"; wb.className="winner-banner "+(cls[winner]||"");
  $("winner-sub").textContent=subs[winner]||"";
  let h=`<table class="rt"><tr><th>名前</th><th>役職</th><th>陣営</th><th>結果</th></tr>`;
  players.forEach(p=>{
    const row=p.role==="lover"?"row-lover":
              isWolfRole(p.role)?"row-wolf":["fox","heretic"].includes(p.role)?"row-fox":
              ["joker","angel"].includes(p.role)?"row-other":"row-village";
    h+=`<tr class="${row}"><td>${p.cpu?"🤖 ":""}${p.name}</td>
        <td>${p.roleIcon||""} ${p.roleName}</td><td>${p.team}</td>
        <td>${p.alive?"✅ 生存":"💀 死亡"}</td></tr>`;
  });
  h+="</table>";
  $("final-roles").innerHTML=h;
  stopCountdown();
  showScreen("s-gameover");
}

/* ══════════════════════════════════
   Socket.IO イベント
══════════════════════════════════ */
socket.on("roomCreated",d=>{
  G.roomId=d.roomId; G.isHost=true; G.players=d.room.players;
  if(d.room.timeConfig) G.timeConfig=d.room.timeConfig;
  showScreen("s-lobby"); renderLobby(d.room);
});
socket.on("joinedRoom",d=>{
  G.roomId=d.roomId; G.isHost=false; G.players=d.room.players;
  if(d.room.timeConfig) G.timeConfig=d.room.timeConfig;
  showScreen("s-lobby"); renderLobby(d.room);
});
socket.on("updateRoom",d=>{
  G.players=d.room.players;
  if(d.room.timeConfig){ G.timeConfig=d.room.timeConfig; renderTimerButtons(); }
  if($("s-lobby").classList.contains("active")) renderLobby(d.room);
});
socket.on("rolesUpdated",d=>{ if(!G.isHost) G.rolePool=d.rolePool; });
socket.on("errorMessage",msg=>{ ["login-err","lobby-err"].forEach(id=>{const e=$(id);if(e){e.textContent=msg;setTimeout(()=>e.textContent="",4000);}}); });

socket.on("yourRole",d=>{
  G.myRole=d.role; G.myRoleName=d.roleName; G.myRoleIcon=d.roleIcon; G.myTeam=d.team; G.myRoleDesc=d.desc||"";
});
socket.on("teamReveal",d=>{ G.allies=d; if($("s-game").classList.contains("active")) renderAction(); });

/* 陣営ごとの表示色（初期配役サマリー用） */
const TEAM_TEXT_COLORS={ village:"#70e890", wolf:"#ff7070", lover:"#ff8fc0", fox:"#ffd23f", other:"#cc99ff" };

/* 初期配役サマリーをチャット欄に表示（ゲーム開始時のみ・誰が何かは含めない） */
function addRoleSummaryBlock(roleSummary, total, infoMode){
  // hidden モード：何も表示しない
  if(infoMode==="hidden") return;

  const wrap=document.createElement("div");
  wrap.className="cm";
  wrap.style.margin="10px 0";

  const title=document.createElement("div");
  title.style.cssText="font-weight:700;font-size:14px;color:#e8eaf0;margin-bottom:4px";
  title.textContent="🎮 ゲーム開始！！";
  wrap.appendChild(title);

  const sub=document.createElement("div");
  sub.style.cssText="font-size:12px;color:#7080a0;margin-bottom:6px";
  sub.textContent=`${total}人中↓`;
  wrap.appendChild(sub);

  if(infoMode==="faction"){
    // 陣営ごとに集計して表示（役職名は出さない）
    const FACTION_LABELS={
      village:{label:"村人陣営", icon:"🏘️", color:TEAM_TEXT_COLORS.village},
      wolf:   {label:"人狼陣営", icon:"🐺", color:TEAM_TEXT_COLORS.wolf},
      fox:    {label:"妖狐陣営", icon:"🦊", color:TEAM_TEXT_COLORS.fox},
      lover:  {label:"恋人陣営", icon:"💕", color:TEAM_TEXT_COLORS.lover},
      other:  {label:"第三陣営", icon:"✨", color:TEAM_TEXT_COLORS.other},
    };
    const counts={};
    roleSummary.forEach(r=>{ counts[r.team]=(counts[r.team]||0)+r.count; });
    // 人数の多い順に並べて表示
    Object.entries(counts)
      .sort((a,b)=>b[1]-a[1])
      .forEach(([team,count])=>{
        const f=FACTION_LABELS[team]; if(!f) return;
        const row=document.createElement("div");
        row.style.cssText=`font-size:14px;font-weight:600;color:${f.color};line-height:1.6`;
        row.textContent=`${f.icon} ${f.label} ${count}人`;
        wrap.appendChild(row);
      });
  } else {
    // full モード（デフォルト）：役職ごとに表示 + ホバーで説明
    roleSummary.forEach(r=>{
      const row=document.createElement("div");
      row.className="rsb-row";
      row.style.color=TEAM_TEXT_COLORS[r.team]||"#a0b0c0";
      row.innerHTML=`<span>${r.icon} ${r.name} ${r.count}人</span><span class="rsb-info">ⓘ</span>`;
      row.addEventListener("mouseenter",()=>peekRoleInfo(r.id));
      row.addEventListener("mouseleave",hideRolePeek);
      row.addEventListener("click",e=>{ e.stopPropagation(); peekRoleInfo(r.id); });
      wrap.appendChild(row);
    });
  }

  $("chat-messages").appendChild(wrap);
  $("chat-messages").scrollTop=$("chat-messages").scrollHeight;
}

socket.on("gameStarted",room=>{
  G.phase=room.phase; G.subphase=room.subphase||"night"; G.round=room.round; G.players=room.players;
  G.myVote=null; G.myNightTarget=null; G.seerDivineUsed=false; G.seerResults={};
  G.mediumPending=null; G.voteCast=0; G.voteTotal=0; G.knightUsed=false; G.wolfTally={};
  const specBox=$("spec-messages"); if(specBox) specBox.innerHTML="";
  showScreen("s-game"); updateGameScreen();
  // 第1夜の表示は直後に発火するnightStartに任せる（重複防止）
  addLog("🎮 ゲーム開始！役職を確認してください","sys");
  if(room.roleSummary) addRoleSummaryBlock(room.roleSummary, room.totalPlayers||room.players.length, room.infoMode||"full");
});

socket.on("timerStart",({duration,ts})=>{
  startCountdown(duration,ts);
});

socket.on("nightStart",room=>{
  G.phase=room.phase; G.subphase="night"; G.round=room.round; G.players=room.players;
  G.myVote=null; G.myNightTarget=null; G.seerDivineUsed=false; G.voteCast=0; G.voteTotal=0; G.wolfTally={};
  updateGameScreen();
  addLog(`🌙 第${G.round}夜が始まりました`,"sys");
  addSysChat(`━━━━ 🌙 第${G.round}夜 ━━━━`);
});

/* 人狼陣営専用：襲撃先タリーの更新（仲間の人狼にのみ届く） */
socket.on("wolfTargetUpdate",d=>{
  G.wolfTally=d.tally||{};
  renderPlayers();
});

/* 人狼陣営専用：誰が誰を狙ったかのログ（仲間の人狼にのみ届く） */
socket.on("wolfTargetLog",d=>{
  addLog(d.text,"kill");
});

socket.on("dayStart",d=>{
  G.phase=d.room.phase; G.round=d.room.round; G.players=d.room.players;
  G.myVote=null; G.voteCast=0; G.voteTotal=0; G.subphase="discuss";
  updateGameScreen();
  if(d.firstNightSafe){
    addLog("🌙 初夜は平和でした。誰も死亡しませんでした。","sys");
  }else{
    (d.logs||[]).forEach(l=>addLog(l,l.includes("襲撃")?"kill":"sys"));
    if(!d.killedIds||!d.killedIds.length)
      addLog("🌅 夜が明けました。昨夜の犠牲者はいませんでした。","sys");
  }
  // subphase は discussStart / timerStart で更新されるが事前にセット済み
});

socket.on("discussStart",room=>{
  G.subphase="discuss";
  if(room){ G.players=room.players; }
  updateGameScreen();
  addSysChat(`━━━━ ☀️ 第${G.round}日目 議論フェーズ ━━━━`);
  addLog(`💬 第${G.round}日目の議論フェーズが始まりました`,"sys");
  // 霊媒師への結果通知：処刑→夜→朝（議論開始）のタイミングで表示
  if(G.mediumPending){
    const r=G.mediumPending;
    addLog(`👁️【霊媒結果】${r.name} は ${r.roleIcon} ${r.roleName} でした（${r.isWolf?"🐺人狼":"村人陣営"}）`,"sys");
    G.mediumPending=null;
  }
});

socket.on("votePhaseStart",room=>{
  G.subphase="vote";
  if(room){ G.players=room.players; }
  updateGameScreen();
  addSysChat("━━ 🗳️ 投票フェーズ開始 ━━");
  addLog("🗳️ 投票フェーズが始まりました！誰を処刑しますか？","sys");
});

socket.on("voteUpdate",d=>{
  G.voteCast=d.cast||0; G.voteTotal=d.total||0;
  renderPlayers(); renderAction();
});

socket.on("voteResult",d=>{
  G.players=d.room.players;
  // 投票内訳表示
  if(d.breakdown&&d.breakdown.length>0){
    addLog("━━ 投票内訳 ━━","sys");
    d.breakdown.forEach(({targetName,voters,count})=>{
      addLog(`  🗳️ ${targetName}：${voters.join("、")}  (${count}票)`,"exec");
    });
  }else{
    addLog("  票なし","sys");
  }
  (d.logs||[]).forEach(l=>addLog(l,"exec"));
  renderPlayers();
});

socket.on("seerResult",d=>{
  G.seerDivineUsed=true;  // 今夜の占いを使用済みにする
  G.seerResults[d.targetId]=d;
  const lbl=d.isWolf?"🐺 人狼":"⚪ 人狼ではない";
  addLog(`🔮【占い結果】${d.name} は ${lbl} でした`,"sys");
  renderAction();
});

/* 妖狐専用：襲撃を受けたが無傷だったことを個別通知（他には届かない） */
socket.on("foxImmuneResult",d=>{
  addLog(d.message,"sys");
});

socket.on("mediumResult",d=>{ G.mediumPending=d; });

/* 観戦チャット受信（死亡者のみ届く） */
socket.on("specChatMsg",d=>{
  const box=$("spec-messages"); if(!box) return;
  const el=document.createElement("div");
  el.className="spec-msg";
  el.innerHTML=`<span class="spec-name">👻 ${d.name}</span>：${d.message}`;
  box.appendChild(el);
  box.scrollTop=box.scrollHeight;
});

/* 狩人専用：護衛の結果（村側には届かない） */
socket.on("guardResult",d=>{
  addLog(d.message, d.success?"guard-ok":"sys");
});

socket.on("knightResult",d=>{
  G.players=d.room.players;
  if(d.dead) d.dead.forEach(id=>{ const p=G.players.find(p=>p.id===id); if(p) p.alive=false; });
  // 自分自身が断罪した場合のみ、自分のUI状態を「使用済み」にする（他の騎士には影響させない）
  if(d.accuserId===socket.id) G.knightUsed=true;
  (d.logs||[]).forEach(l=>addLog(l,"exec"));
  renderPlayers(); renderAction();
});

socket.on("chat",d=>addChat(d.name,d.message,d.isWolfChat));
socket.on("gameOver",d=>showGameOver(d));

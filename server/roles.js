/* 20役職の定義 */
module.exports = [
  /* ===== 村人陣営 ===== */
  {
    id:"villager", name:"村人",    team:"village", icon:"🏘️", color:"#4a8a6a",
    desc:"特殊能力はない普通の村人。昼の議論で人狼を見つけ出そう。",
    nightAction:null
  },
  {
    id:"seer",     name:"占い師",  team:"village", icon:"🔮", color:"#8855cc",
    desc:"毎夜1人を占い、人狼かどうかだけを知ることができる（大狼・狂人・狂信者・妖狐は「人狼ではない」と表示される）。妖狐を占うと、その妖狐はひそかに死亡する。",
    nightAction:"divine"
  },
  {
    id:"medium",   name:"霊媒師",  team:"village", icon:"👁️", color:"#5588cc",
    desc:"処刑されたプレイヤーの役職を自動的に知ることができる。夜明けに結果が届く。",
    nightAction:null
  },
  {
    id:"guard",    name:"狩人",    team:"village", icon:"🛡️", color:"#44aa66",
    desc:"毎夜1人を選び、その夜の人狼の襲撃から守ることができる。",
    nightAction:"protect"
  },
  {
    id:"knight",   name:"騎士",    team:"village", icon:"⚔️", color:"#886644",
    desc:"昼に1度だけ「断罪」できる。対象が人狼なら人狼が死亡。人狼でなければ自分が死亡。",
    nightAction:null, dayAction:"accuse"
  },
  {
    id:"cat",      name:"猫又",    team:"village", icon:"🐱", color:"#cc6688",
    desc:"投票で処刑されると、自分に投票したプレイヤーの中からランダムに1人を道連れにする。",
    nightAction:null
  },
  {
    id:"shared",   name:"共有者",  team:"village", icon:"🤝", color:"#6688aa",
    desc:"ゲーム開始時にもう1人の共有者が誰かを知ることができる。2枚以上選択すること。",
    nightAction:null
  },
  {
    id:"cursed",   name:"呪い師",  team:"village", icon:"🧿", color:"#aa4466",
    desc:"人狼に噛まれると死亡せず人狼に変身する。人狼は噛んだ相手が呪い師かどうかわからない。",
    nightAction:null
  },
  /* ===== 人狼陣営 ===== */
  {
    id:"wolf",     name:"人狼",    team:"wolf",    icon:"🐺", color:"#cc3333",
    desc:"毎夜1人を選んで襲撃する。人狼同士はお互いを知っている。",
    nightAction:"attack"
  },
  {
    id:"madman",   name:"狂人",    team:"wolf",    icon:"🤪", color:"#cc6633",
    desc:"人狼陣営だが仲間の人狼が誰かは知らない。占い師の結果では「人狼ではない」と表示される。人狼陣営が勝てば勝利。",
    nightAction:null
  },
  {
    id:"fanatic",  name:"狂信者",  team:"wolf",    icon:"😤", color:"#bb5522",
    desc:"人狼が誰かを知っている。占い師の結果では「人狼ではない」と表示される。夜の行動はできないが情報収集に長ける。",
    nightAction:null
  },
  {
    id:"alpha",    name:"大狼",    team:"wolf",    icon:"🦁", color:"#dd4444",
    desc:"占い師の結果では「人狼ではない」と表示される強力な人狼。人狼と同様に毎夜誰かを襲撃できる。",
    nightAction:"attack"
  },
  {
    id:"pup",      name:"子狼",    team:"wolf",    icon:"🐶", color:"#ee6655",
    desc:"普通の人狼として動く。子狼が死亡した翌夜は人狼陣営がさらに1人を追加で襲撃できる。",
    nightAction:"attack"
  },
  /* ===== 妖狐陣営 ===== */
  {
    id:"fox",      name:"妖狐",    team:"fox",     icon:"🦊", color:"#dd9933",
    desc:"人狼の襲撃を無効化する（不死）。占い師の結果には「人狼ではない」と表示されるが、占われると密かに死亡してしまう。ゲーム終了時に生存していれば勝利。",
    nightAction:null
  },
  {
    id:"heretic",  name:"背徳者",  team:"fox",     icon:"🎭", color:"#cc8822",
    desc:"妖狐と共に勝利する。ゲーム開始時に妖狐が誰かを知ることができる。",
    nightAction:null
  },
  /* ===== 第三陣営 ===== */
  {
    id:"joker",    name:"ジョーカー", team:"other", icon:"🃏", color:"#6644cc",
    desc:"人狼に殺されると単独勝利。投票で処刑されると負け。独自の勝利を目指せ。",
    nightAction:null
  },
  {
    id:"angel",    name:"てるてる坊主", team:"other", icon:"⛩️", color:"#cc44aa",
    desc:"最初の昼の投票で処刑されると単独勝利。それ以外の死に方では負け。1日目に処刑を狙え。",
    nightAction:null
  },
  {
    id:"lover",    name:"恋人",    team:"lover", icon:"💕", color:"#cc4477",
    desc:"ゲーム開始時にもう1人の恋人を知る。一方が死ぬと他方も道連れになる。2枚以上選択すること。ゲーム終了時に恋人ペアの2人がそろって生存していれば、他のどの陣営の勝利条件が満たされていても恋人陣営の勝利となる（複数ペアいる場合は最後まで生き残ったペアが勝利）。",
    nightAction:null
  },
  {
    id:"avenger",  name:"復讐者",  team:"village", icon:"💀", color:"#886600",
    desc:"投票で処刑されると、他のプレイヤーの中からランダムに1人を道連れにする。",
    nightAction:null
  },
  {
    id:"saint",    name:"聖女",    team:"village", icon:"👸", color:"#aaaa44",
    desc:"投票で処刑されると人狼陣営が即座に勝利する。村人は絶対に処刑してはいけない要注意人物。",
    nightAction:null
  }
];

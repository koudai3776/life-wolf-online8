'use strict';

/* ===== 30マスのボード定義（楕円配置・タイプのみ使用） ===== */
const SQUARES = [
  {idx:0,  type:'start',  label:'START'},
  {idx:1,  type:'work',   label:'仕事'},
  {idx:2,  type:'happen', label:'ハプニング'},
  {idx:3,  type:'work',   label:'仕事'},
  {idx:4,  type:'fate',   label:'運命'},
  {idx:5,  type:'social', label:'社会'},
  {idx:6,  type:'bond',   label:'縁'},
  {idx:7,  type:'work',   label:'仕事'},
  {idx:8,  type:'happen', label:'ハプニング'},
  {idx:9,  type:'work',   label:'仕事'},
  {idx:10, type:'fate',   label:'運命'},
  {idx:11, type:'work',   label:'仕事'},
  {idx:12, type:'social', label:'社会'},
  {idx:13, type:'bond',   label:'縁'},
  {idx:14, type:'work',   label:'仕事'},
  {idx:15, type:'happen', label:'ハプニング'},
  {idx:16, type:'work',   label:'仕事'},
  {idx:17, type:'fate',   label:'運命'},
  {idx:18, type:'work',   label:'仕事'},
  {idx:19, type:'social', label:'社会'},
  {idx:20, type:'bond',   label:'縁'},
  {idx:21, type:'work',   label:'仕事'},
  {idx:22, type:'happen', label:'ハプニング'},
  {idx:23, type:'work',   label:'仕事'},
  {idx:24, type:'fate',   label:'運命'},
  {idx:25, type:'social', label:'社会'},
  {idx:26, type:'bond',   label:'縁'},
  {idx:27, type:'work',   label:'仕事'},
  {idx:28, type:'happen', label:'ハプニング'},
  {idx:29, type:'goal',   label:'GOAL'},
];

/* ===== 役職定義 ===== */
const ROLES = {
  villager: {
    id          : 'villager',
    name        : '市民',
    team        : 'village',
    icon        : '👤',
    color       : '#55aaff',
    desc        : '平和な村人です。人狼を見つけて村を守りましょう！',
    ability     : null,
    abilityName : null,
    abilityDesc : null,
    cooldown    : 0,
  },
  werewolf: {
    id          : 'werewolf',
    name        : '人狼',
    team        : 'wolf',
    icon        : '🐺',
    color       : '#ee4444',
    desc        : '正体を隠しながら村人の資産を狙え！人狼仲間とは秘密裏に連携できる。',
    ability     : 'steal',
    abilityName : '暗殺',
    abilityDesc : '対象プレイヤーの資産の20%を奪う（2ターンCT）',
    cooldown    : 2,
    resolveOrder: 2,
    lockable    : false,
  },
  seer: {
    id          : 'seer',
    name        : '占い師',
    team        : 'village',
    icon        : '🔮',
    color       : '#cc55ee',
    desc        : '星の導きで人々の本質を見抜く。能力で誰かが人狼かどうかを判定できる。',
    ability     : 'divine',
    abilityName : '占い',
    abilityDesc : '対象プレイヤーが人狼かどうかを占う（2ターンCT）',
    cooldown    : 2,
    resolveOrder: 3,
    lockable    : true,
  },
  detective: {
    id          : 'detective',
    name        : '探偵',
    team        : 'village',
    icon        : '🕵️',
    color       : '#ffcc33',
    desc        : '鋭い洞察力で真実を追う。能力で誰かの現在の資産を調査できる。',
    ability     : 'inspectAsset',
    abilityName : '調査',
    abilityDesc : '対象プレイヤーの現在の資産を調査する（CTなし）',
    cooldown    : 0,
    resolveOrder: 3,
    lockable    : true,
  },
  lawyer: {
    id          : 'lawyer',
    name        : '弁護士',
    team        : 'village',
    icon        : '⚖️',
    color       : '#66ccaa',
    desc        : '法の力で無実の人を守る。能力で誰かを処刑（投票）から守れる。',
    ability     : 'guardExecution',
    abilityName : '弁護',
    abilityDesc : '対象プレイヤーをこのラウンドの処刑（投票）から守る（2ターンCT）',
    cooldown    : 2,
    resolveOrder: 1,
    lockable    : false,
  },
  guard: {
    id          : 'guard',
    name        : '警備員',
    team        : 'village',
    icon        : '💂',
    color       : '#7799dd',
    desc        : '鍛えた身体で村を守る。能力で誰かを人狼の暗殺から守れる。',
    ability     : 'guardAssassination',
    abilityName : '護衛',
    abilityDesc : '対象プレイヤーをこのラウンドの暗殺から守る（2ターンCT）',
    cooldown    : 2,
    resolveOrder: 1,
    lockable    : false,
  },
  priest: {
    id          : 'priest',
    name        : '神父',
    team        : 'village',
    icon        : '⛪',
    color       : '#ddccaa',
    desc        : '死者の声に耳を傾ける。処刑されたプレイヤーの正体を、こっそり教えてもらえる。',
    ability     : null,
    abilityName : null,
    abilityDesc : null,
    cooldown    : 0,
  },
  scammer: {
    id          : 'scammer',
    name        : '詐欺師',
    team        : 'wolf',
    icon        : '🎭',
    color       : '#bb6688',
    desc        : '嘘で塗り固めた正体を隠す。能力を使うと、次に占われた際の結果を偽装できる。',
    ability     : 'disguise',
    abilityName : '偽装',
    abilityDesc : '自分自身に使用。次に占われた時、判定が「人狼ではない」に偽装される（2ターンCT・使うと消費）',
    cooldown    : 2,
    resolveOrder: 1,
    lockable    : true,
  },
  gambler: {
    id          : 'gambler',
    name        : 'ギャンブラー',
    team        : 'wolf',
    icon        : '🎰',
    color       : '#dd8833',
    desc        : '一攫千金を狙う勝負師。能力は大きなリターンとリスクが半々。',
    ability     : 'gamble',
    abilityName : '賭け',
    abilityDesc : '対象プレイヤーに勝負を仕掛ける。50%で相手の資産30%を奪い、50%で自分の資産15%を失う（2ターンCT）',
    lockable    : false,
    cooldown    : 2,
    resolveOrder: 2,
  },
  spy: {
    id          : 'spy',
    name        : 'スパイ',
    team        : 'wolf',
    icon        : '🕶️',
    color       : '#557799',
    desc        : '完璧な潜入工作員。占い師に占われても常に「人狼ではない」としか判定されない。',
    ability     : null,
    abilityName : null,
    abilityDesc : null,
    cooldown    : 0,
  },
};

/* ===== ショップ・アイテム定義 =====
 * 能力フェーズ中に資産を使って購入できるアイテム。
 * needsTarget: true のものは対象プレイヤーを選んで購入する。
 * elimOnly   : true のものは「脱落あり」ルームでのみ購入できる。 */
const ITEMS = {
  binoculars: {
    id      : 'binoculars',
    name    : '双眼鏡',
    icon    : '🔭',
    price   : 500000,
    desc    : '指定した相手の役職を知ることができる',
  },
  pickpocket: {
    id      : 'pickpocket',
    name    : 'スリ',
    icon    : '👛',
    price   : 200000,
    desc    : '指定した相手から資産の一部を盗む（資産ロックされていると失敗する）',
  },
  assetLock: {
    id      : 'assetLock',
    name    : '資産ロック',
    icon    : '🔒',
    price   : 150000,
    desc    : '次に他人から受けるスリを1回無効化する',
  },
  charm: {
    id      : 'charm',
    name    : 'お守り',
    icon    : '🍀',
    price   : 400000,
    desc    : '処刑されても1回だけ生還できる（脱落ありルームのみ）',
    elimOnly: true,
  },
  savingsPlan: {
    id      : 'savingsPlan',
    name    : '積立プラン',
    icon    : '💰',
    price   : 100000,
    desc    : '次に仕事マスに止まった時の収入を1.5倍にする',
  },
  voteBoost: {
    id      : 'voteBoost',
    name    : '票買収',
    icon    : '🗳️',
    price   : 250000,
    desc    : '次の投票で、自分の1票を2票分としてカウントする',
  },
  voteShield: {
    id      : 'voteShield',
    name    : '根回し',
    icon    : '🤝',
    price   : 250000,
    desc    : '次の投票で、自分への票を1票分減らす',
  },
  forgedPassport: {
    id      : 'forgedPassport',
    name    : '偽造パスポート',
    icon    : '🛂',
    price   : 350000,
    desc    : '次に占い師に占われても「市民」と判定される',
  },
};

/* ===== プレイヤー数別・役職リスト ===== */
function buildRoleList(count) {
  if (count <= 2) return ['werewolf', 'villager'].slice(0, count);
  if (count === 3) return ['werewolf', 'seer', 'villager'];
  if (count === 4) return ['werewolf', 'seer', 'villager', 'villager'];
  if (count === 5) return ['werewolf', 'seer', 'detective', 'villager', 'villager'];
  if (count === 6) return ['werewolf', 'werewolf', 'seer', 'detective', 'villager', 'villager'];
  if (count === 7) return ['werewolf', 'werewolf', 'seer', 'detective', 'villager', 'villager', 'villager'];
  return           ['werewolf', 'werewolf', 'seer', 'detective', 'villager', 'villager', 'villager', 'villager'];
}

/* ===== マスイベントテーブル（役職テーマ対応版） ===== */
const EVENTS = {

  /* 💰 仕事マス：収入・キャリアイベント */
  work: [
    { name:'昇給！',            desc:'頑張りが上司に認められました！',                 amount:+150000, icon:'🎉' },
    { name:'ボーナス支給！',    desc:'今年の業績は過去最高でした！',                   amount:+200000, icon:'💴' },
    { name:'副業成功！',        desc:'コツコツ積み上げた努力が実りました！',           amount:+100000, icon:'📈' },
    { name:'株式投資成功！',    desc:'読みが的中！大きな利益を得ました',               amount:+250000, icon:'📊' },
    { name:'臨時収入！',        desc:'思いがけないところから収入が！',                 amount:+80000,  icon:'💫' },
    { name:'特許取得！',        desc:'あなたの発明が社会に認められました！',           amount:+300000, icon:'💡' },
    { name:'フリーランス成功！',desc:'独立して大きな案件を獲得しました！',             amount:+180000, icon:'🖥️' },
    { name:'不動産収入！',      desc:'所有物件の家賃収入が入りました！',               amount:+120000, icon:'🏠' },
    { name:'失業…',             desc:'急に職を失ってしまいました…',                   amount:-200000, icon:'😢' },
    { name:'減給…',             desc:'業績不振で給料が大幅ダウン…',                   amount:-100000, icon:'📉' },
    { name:'取引失敗…',         desc:'大切な契約が破談になりました…',                 amount:-150000, icon:'💸' },
    { name:'残業続きで体調不良',desc:'無理がたたって医療費がかかりました',             amount:-80000,  icon:'🏥' },
    { name:'投資失敗…',         desc:'見立てが大きく外れてしまいました…',             amount:-180000, icon:'📉' },
    { name:'リストラ対象に…',   desc:'会社の都合で職を失いました…',                   amount:-130000, icon:'🗂️' },
  ],

  /* 🌍 社会マス：全員に影響するイベント */
  social: [
    { name:'好景気到来！',      desc:'景気上昇の波に全員が乗りました！',               amount:+120000, icon:'🌟', all:true },
    { name:'株価暴騰！',        desc:'株式市場が急騰！全員が潤います！',               amount:+150000, icon:'🚀', all:true },
    { name:'村の祭り！',        desc:'お祭り効果で商売繁盛！全員が恩恵を受けました！', amount:+80000,  icon:'🎊', all:true },
    { name:'新技術普及！',      desc:'社会が大きく発展！全員に利益が！',               amount:+100000, icon:'💻', all:true },
    { name:'豊作の年！',        desc:'今年は恵みの年でした！全員に恩恵！',             amount:+90000,  icon:'🌾', all:true },
    { name:'観光ブーム！',      desc:'地域が活性化し全員が潤いました！',               amount:+70000,  icon:'🗺️', all:true },
    { name:'不況…',             desc:'景気後退で全員の資産が減りました…',             amount:-100000, icon:'😰', all:true },
    { name:'増税…',             desc:'税率アップで全員の負担が増えました',             amount:-80000,  icon:'🏛️', all:true },
    { name:'自然災害…',         desc:'大規模災害が発生しました…全員が被害を受けました',amount:-150000, icon:'🌊', all:true },
    { name:'疫病の流行…',       desc:'村に病が広まりました…全員が影響を受けました',   amount:-120000, icon:'😷', all:true },
    { name:'物価高騰…',         desc:'生活費が急上昇…全員の資産が目減りします',       amount:-90000,  icon:'🛒', all:true },
  ],

  /* ❓ ハプニングマス：予想外の出来事（人狼ミステリーテイスト） */
  happen: [
    { name:'急な出費！',        desc:'予想外の出費が発生しました…',                   amount:-80000,  icon:'💀' },
    { name:'車が故障…',         desc:'愛車が壊れて修理費がかかりました…',             amount:-100000, icon:'🔧' },
    { name:'入院…',             desc:'体調を崩して入院しました…',                     amount:-120000, icon:'🏥' },
    { name:'詐欺被害！',        desc:'巧みな嘘に騙されてしまいました…悔しい！',       amount:-200000, icon:'😱' },
    { name:'財布を紛失…',       desc:'うっかり財布を落としてしまいました',             amount:-50000,  icon:'👛' },
    { name:'宝くじ当選！',      desc:'奇跡！大当たりです！',                           amount:+300000, icon:'🎰' },
    { name:'拾得物のお礼！',    desc:'落とし物を届けたらお礼をもらいました',           amount:+30000,  icon:'🙏' },
    { name:'🌙 夜中に何者かが…',desc:'眠っている間に資産が消えていた…誰の仕業！？', amount:-150000, icon:'🌙' },
    { name:'📨 謎の封筒！',     desc:'差出人不明の封筒に大金が！一体誰が送ってきた…？',amount:+200000,icon:'📨' },
    { name:'🕵️ 情報が漏れた…', desc:'秘密を誰かに知られてしまった…痛手を受けた',   amount:-100000, icon:'🕵️' },
    { name:'👀 謎の目撃情報！', desc:'夜に怪しい人物を目撃し通報…お礼金をもらった！', amount:+50000,  icon:'👀' },
    { name:'🗝️ 隠し財産発見！', desc:'屋根裏から古い財産が見つかりました！',          amount:+160000, icon:'🗝️' },
    { name:'🔍 調査を依頼された',desc:'ある人物から秘密の調査を依頼され報酬をもらった',amount:+80000, icon:'🔍' },
    { name:'💣 罠にはまった…',  desc:'誰かに仕掛けられた罠で損害を受けた！',         amount:-130000, icon:'💣' },
  ],

  /* 🎲 運命マス：大きなランダムイベント */
  fate: [
    { name:'🌈 大逆転！',       desc:'まさかの大当たり！人生何があるかわからない！',   amount:+500000, icon:'🌈' },
    { name:'🍀 幸運の風！',     desc:'幸運が舞い込んできました！',                     amount:+200000, icon:'🍀' },
    { name:'🎁 棚からぼたもち！',desc:'何もしていないのに大きな幸運が！',             amount:+150000, icon:'🎁' },
    { name:'🤝 運命の出会い',   desc:'人生を変えるような出会いがありました',           amount:+100000, icon:'🤝' },
    { name:'✨ 小さな幸せ',     desc:'少しだけ運が向いてきました',                     amount:+50000,  icon:'✨' },
    { name:'😐 普通の一日',     desc:'特に何も起きませんでした',                       amount:0,       icon:'😐' },
    { name:'🍂 不運…',         desc:'ついてない一日でした…',                          amount:-50000,  icon:'🍂' },
    { name:'⚡ 天からの試練',   desc:'運命の悪戯…大きな損失です',                     amount:-300000, icon:'⚡' },
    { name:'💔 大損失…',       desc:'大きな損失を被りました…立て直せるか',            amount:-200000, icon:'💔' },
    { name:'💣 破産の危機！',   desc:'かなりの損失です…なんとか踏ん張れ！',           amount:-400000, icon:'💣' },
    { name:'🌟 二重の幸運！',   desc:'連続して良いことが起きました！',                 amount:+250000, icon:'🌟' },
  ],

  start: [
    { name:'スタートに戻った！', desc:'ひとまず安全地帯。周回ボーナス！', amount:+100000, icon:'🏠' },
  ],
  goal: [
    { name:'ゴール通過！', desc:'おめでとう！ゴールボーナス獲得！', amount:+300000, icon:'⭐' },
  ],

  /* 🤝 縁マス：人とのつながりに関するイベント */
  bond: [
    { name:'親友からの贈り物',     desc:'困っていたら友人が助けてくれました！',           amount:+120000, icon:'🎁' },
    { name:'人脈で大成功',         desc:'紹介してもらった仕事がうまくいきました！',       amount:+180000, icon:'🤝' },
    { name:'同窓会で再会',         desc:'懐かしい仲間と思い出話に花が咲きました',         amount:-30000,  icon:'🍻' },
    { name:'結婚式のご祝儀',       desc:'友人の晴れ舞台にお祝いを包みました',             amount:-80000,  icon:'💐' },
    { name:'恩人との出会い',       desc:'人生を変える出会いがありました！',               amount:+220000, icon:'✨' },
    { name:'人間関係のもつれ',     desc:'ちょっとしたすれ違いで気まずい雰囲気に…',       amount:-60000,  icon:'😟' },
    { name:'紹介料が入った',       desc:'知人を紹介したお礼をもらいました',               amount:+90000,  icon:'💌' },
    { name:'飲み会続きで出費',     desc:'お付き合いが続いて財布が軽くなりました',         amount:-50000,  icon:'🍶' },
    { name:'ビジネスパートナー発見', desc:'頼もしい仲間が見つかりました！',               amount:+150000, icon:'🤝' },
    { name:'裏切られた…',         desc:'信じていた人に裏切られてしまいました',           amount:-150000, icon:'💔' },
  ],
};

const PLAYER_COLORS = [
  '#ee5555','#55aaff','#55ee88','#ffcc33',
  '#cc55ee','#ff8833','#55dddd','#ff66aa',
];

class LifeWolfRoom {
  constructor(id, host) {
    this.id                  = id;
    this.host                = host;
    this.players             = [];
    this.started             = false;
    this.phase               = 'lobby';
    this.currentTurn         = 0;
    this.round               = 0;
    this.battleType          = 'team';  // 'individual'(個人戦) | 'team'(陣営戦)
    this.elimination         = 'elim';  // 'elim'(脱落あり) | 'survive'(脱落なし)
    this.maxRounds           = 10;
    this._eliminationSeq     = 0;   // 脱落順カウンター（脱落ありモードで処刑された順に採番）
    this.votes               = {};
    this._roleConfirmed      = new Set();
    this._roleRevealTimer    = null;
    this._eventTimer         = null;
  }

  addPlayer(id, name, cpu = false) {
    if (this.players.length >= 8) return false;
    const color = PLAYER_COLORS[this.players.length % PLAYER_COLORS.length];
    this.players.push({
      id,
      name,
      cpu,
      color,
      position        : 0,
      asset           : 1000000,
      alive           : true,
      role            : 'villager',
      abilityCooldown : 0,
      lastAction      : 'まだ行動していない',
      laps            : 0,
      // ショップアイテム用フラグ
      itemAssetLocked : false, // 資産ロック：次のスリを1回無効化
      charmActive     : false, // お守り：処刑を1回免れる
      workBoostActive : false, // 積立プラン：次の仕事マス収入を1.5倍
      voteBoost       : false, // 票買収：次の投票で自分の票を+1
      voteShield      : false, // 根回し：次の投票で自分への票を-1
      itemPurchasesThisRound: 0, // ショップ購入回数（1ラウンド1回まで）
      inventory       : [], // 持ち物バッグ（購入済み・未使用のアイテムID一覧）
    });
    return true;
  }

  /* ===== 役職をプールから配布（ホストが設定した構成で） ===== */
  assignRolesFromPool(pool) {
    const list = [];
    Object.keys(ROLES).filter(r => r !== 'villager').forEach(role => {
      const count = pool[role] || 0;
      for (let i = 0; i < count; i++) list.push(role);
    });
    while (list.length < this.players.length) list.push('villager');
    while (list.length > this.players.length) list.pop();
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    this.players.forEach((p, i) => {
      p.role                      = list[i] || 'villager';
      p.abilityCooldown           = 0;
      p.lastAction                = 'まだ行動していない';
      p.protectedFromExecution    = false;
      p.protectedFromAssassination= false;
      p.disguiseActive            = false;
      p.itemAssetLocked           = false;
      p.charmActive               = false;
      p.workBoostActive           = false;
      p.voteBoost                 = false;
      p.voteShield                = false;
      p.itemPurchasesThisRound    = 0;
      p.inventory                 = [];
      // CPUの記憶（前のゲームの情報が新しいゲームに引き継がれないようにする）
      p._cpuKnownWolves           = null;
      p._cpuChecked                = null;
    });
  }

  /* ===== 役職をランダム配布（プレイヤー数から自動計算） ===== */
  assignRoles() {
    const list = buildRoleList(this.players.length);
    // Fisher-Yates シャッフル
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    this.players.forEach((p, i) => {
      p.role           = list[i] || 'villager';
      p.abilityCooldown = 0;
      p.lastAction     = 'まだ行動していない';
    });
  }

  /* ===== 特定プレイヤーへの個人情報 ===== */
  privateInfo(playerId) {
    const p = this.players.find(q => q.id === playerId);
    if (!p) return null;
    const def = ROLES[p.role] || ROLES.villager;
    return {
      role            : p.role,
      roleName        : def.name,
      roleIcon        : def.icon,
      roleColor       : def.color,
      roleDesc        : def.desc,
      roleTeam        : def.team,
      abilityName     : def.abilityName,
      abilityDesc     : def.abilityDesc,
      abilityCooldown : p.abilityCooldown,
      asset           : p.asset,
    };
  }

  currentPlayer() {
    return this.players[this.currentTurn] || null;
  }

  rollDice() {
    return Math.floor(Math.random() * 6) + 1;
  }

  movePlayer(playerId, steps) {
    const p = this.players.find(q => q.id === playerId);
    if (!p) return null;
    const oldPos = p.position;
    const newPos = (p.position + steps) % 30;
    if (oldPos + steps >= 30) p.laps++;
    p.position   = newPos;
    const sq     = SQUARES[newPos];
    p.lastAction = `マス${newPos}（${sq.label}）に移動`;
    return { playerId, oldPos, newPos, steps, squareType: sq.type, squareLabel: sq.label };
  }

  processSquareEvent(squareType, playerId) {
    const list = EVENTS[squareType];
    if (!list || list.length === 0) return null;
    const ev    = list[Math.floor(Math.random() * list.length)];
    const isAll = !!ev.all;
    let amount  = ev.amount;
    let boosted = false;

    if (isAll) {
      this.players.forEach(p => {
        if (p.alive) p.asset = Math.max(0, p.asset + amount);
      });
    } else {
      const p = this.players.find(q => q.id === playerId);
      if (p) {
        // 積立プラン：次の仕事マスの収入（プラスの時のみ）を1.5倍にする（1回消費）
        if (squareType === 'work' && p.workBoostActive && amount > 0) {
          amount  = Math.round(amount * 1.5);
          boosted = true;
          p.workBoostActive = false;
        }
        p.asset = Math.max(0, p.asset + amount);
      }
    }
    return { ...ev, amount, boosted, squareType, playerId, isAll };
  }

  /* ===== 役職能力を使用 ===== */
  /* ===== ラウンド開始時に「処刑から守る」「暗殺から守る」の効果をリセット =====
     弁護士の弁護・警備員の護衛は、その回のラウンド限定の効果のため、
     新しいラウンドの能力フェーズが始まる前に必ずクリアする。 */
  resetRoundProtections() {
    this.players.forEach(p => {
      p.protectedFromExecution     = false;
      p.protectedFromAssassination = false;
    });
  }

  useAbility(actorId, targetId) {
    const actor = this.players.find(p => p.id === actorId);
    if (!actor || !actor.alive) return { error: 'invalid_actor' };
    const def = ROLES[actor.role] || ROLES.villager;
    if (!def.ability) return { error: 'no_ability' };
    if (actor.abilityCooldown > 0) return { error: 'cooldown' };

    // 詐欺師の「偽装」は自分自身に使う特殊なアビリティ
    const selfTargetable = def.ability === 'disguise';
    const target = this.players.find(p => p.id === targetId);
    if (!target || !target.alive) return { error: 'invalid_target' };
    if (!selfTargetable && target.id === actor.id) return { error: 'invalid_target' };
    if (selfTargetable && target.id !== actor.id) return { error: 'invalid_target' };

    actor.abilityCooldown = def.cooldown;
    let result = { abilityName: def.abilityName, targetId, targetName: target.name };

    if (def.ability === 'divine') {
      // スパイは常時、詐欺師は偽装発動中のみ「人狼ではない」と判定される（人狼ONLINEと同じ白黒判定）
      if (target.role === 'spy' || target.disguiseActive) {
        result.isWolf = false;
        target.disguiseActive = false; // 偽装は1回使うと消費される
      } else {
        result.isWolf = (ROLES[target.role] || ROLES.villager).team === 'wolf';
      }
    } else if (def.ability === 'inspectAsset') {
      result.revealAsset = target.asset;
    } else if (def.ability === 'steal') {
      if (target.protectedFromAssassination) {
        result.blocked = true; // 警備員に護衛されていて失敗
      } else {
        const amount = Math.round(target.asset * 0.2);
        target.asset = Math.max(0, target.asset - amount);
        actor.asset += amount;
        result.amount = amount;
      }
    } else if (def.ability === 'guardExecution') {
      target.protectedFromExecution = true;
      result.protected = true;
    } else if (def.ability === 'guardAssassination') {
      target.protectedFromAssassination = true;
      result.protected = true;
    } else if (def.ability === 'disguise') {
      actor.disguiseActive = true;
      result.disguised = true;
    } else if (def.ability === 'gamble') {
      if (Math.random() < 0.5) {
        const amount = Math.round(target.asset * 0.3);
        target.asset = Math.max(0, target.asset - amount);
        actor.asset += amount;
        result.amount = amount;
        result.win    = true;
      } else {
        const loss = Math.round(actor.asset * 0.15);
        actor.asset = Math.max(0, actor.asset - loss);
        result.loss = loss;
        result.win  = false;
      }
    }
    actor.lastAction = `${def.abilityName}を${selfTargetable ? '自分' : target.name}に使用`;
    return result;
  }

  /* ===== ショップ：アイテム購入（能力フェーズ中、資産を消費して持ち物バッグに追加。効果はまだ発動しない） ===== */
  buyItem(actorId, itemId) {
    const actor = this.players.find(p => p.id === actorId);
    if (!actor || !this.isActive(actor)) return { error: 'invalid_actor' };
    const item = ITEMS[itemId];
    if (!item) return { error: 'invalid_item' };
    if (item.elimOnly && this.elimination !== 'elim') return { error: 'invalid_item' };
    if (actor.asset < item.price) return { error: 'insufficient_funds' };
    if ((actor.itemPurchasesThisRound || 0) >= 1) return { error: 'purchase_limit' };

    actor.asset = Math.max(0, actor.asset - item.price);
    actor.itemPurchasesThisRound = (actor.itemPurchasesThisRound || 0) + 1;
    actor.inventory = actor.inventory || [];
    actor.inventory.push(itemId);

    return {
      itemId, itemName: item.name, itemIcon: item.icon,
      asset: actor.asset, inventory: actor.inventory.slice(), purchased: true,
    };
  }

  /* ===== 持ち物バッグ：アイテムを使用して効果を発動（能力フェーズ中、いつでも好きなタイミングで） ===== */
  useItem(actorId, itemId, targetId) {
    const actor = this.players.find(p => p.id === actorId);
    if (!actor || !this.isActive(actor)) return { error: 'invalid_actor' };
    const item = ITEMS[itemId];
    if (!item) return { error: 'invalid_item' };
    actor.inventory = actor.inventory || [];
    const idx = actor.inventory.indexOf(itemId);
    if (idx === -1) return { error: 'not_owned' };

    if (itemId === 'binoculars') {
      const target = this.players.find(p => p.id === targetId);
      if (!target || !this.isActive(target) || target.id === actor.id) {
        return { error: 'invalid_target' };
      }
      actor.inventory.splice(idx, 1);

      const result = {
        itemId, itemName: item.name, itemIcon: item.icon,
        targetId, targetName: target.name, inventory: actor.inventory.slice(),
      };
      // スパイは常時、詐欺師は偽装発動中のみ「市民」に見える（占い師と同じ仕様）
      if (target.role === 'spy' || target.disguiseActive) {
        result.revealRole     = ROLES.villager.name;
        result.revealRoleIcon = ROLES.villager.icon;
        target.disguiseActive = false;
      } else {
        const tDef = ROLES[target.role] || ROLES.villager;
        result.revealRole     = tDef.name;
        result.revealRoleIcon = tDef.icon;
      }
      return result;
    }

    if (itemId === 'pickpocket') {
      const target = this.players.find(p => p.id === targetId);
      if (!target || !this.isActive(target) || target.id === actor.id) {
        return { error: 'invalid_target' };
      }
      actor.inventory.splice(idx, 1);

      if (target.itemAssetLocked) {
        // 資産ロックで無効化された（ロックはここで消費）
        target.itemAssetLocked = false;
        return {
          itemId, itemName: item.name, itemIcon: item.icon,
          targetId, targetName: target.name, asset: actor.asset,
          inventory: actor.inventory.slice(), blocked: true,
        };
      }
      const amount = Math.round(target.asset * 0.15);
      target.asset = Math.max(0, target.asset - amount);
      actor.asset += amount;
      return {
        itemId, itemName: item.name, itemIcon: item.icon,
        targetId, targetName: target.name, asset: actor.asset,
        inventory: actor.inventory.slice(), amount,
      };
    }

    if (itemId === 'assetLock') {
      actor.inventory.splice(idx, 1);
      actor.itemAssetLocked = true;
      return { itemId, itemName: item.name, itemIcon: item.icon, inventory: actor.inventory.slice(), selfEffect: true };
    }

    if (itemId === 'charm') {
      actor.inventory.splice(idx, 1);
      actor.charmActive = true;
      return { itemId, itemName: item.name, itemIcon: item.icon, inventory: actor.inventory.slice(), selfEffect: true };
    }

    if (itemId === 'savingsPlan') {
      actor.inventory.splice(idx, 1);
      actor.workBoostActive = true;
      return { itemId, itemName: item.name, itemIcon: item.icon, inventory: actor.inventory.slice(), selfEffect: true };
    }

    if (itemId === 'voteBoost') {
      actor.inventory.splice(idx, 1);
      actor.voteBoost = true;
      return { itemId, itemName: item.name, itemIcon: item.icon, inventory: actor.inventory.slice(), selfEffect: true };
    }

    if (itemId === 'voteShield') {
      actor.inventory.splice(idx, 1);
      actor.voteShield = true;
      return { itemId, itemName: item.name, itemIcon: item.icon, inventory: actor.inventory.slice(), selfEffect: true };
    }

    if (itemId === 'forgedPassport') {
      actor.inventory.splice(idx, 1);
      actor.disguiseActive = true;
      return { itemId, itemName: item.name, itemIcon: item.icon, inventory: actor.inventory.slice(), selfEffect: true };
    }

    return { error: 'invalid_item' };
  }

  /* ===== 投票の集計（最多票・同数はランダム） =====
     票買収／根回しアイテムを使っていた場合はここで重み付けし、使用後は消費する。 */
  resolveVotes() {
    const tally = {};
    Object.entries(this.votes || {}).forEach(([voterId, targetId]) => {
      if (!targetId) return; // スキップ票は集計対象外
      const voter = this.players.find(p => p.id === voterId);
      const weight = (voter && voter.voteBoost) ? 2 : 1; // 票買収：自分の投票を+1
      tally[targetId] = (tally[targetId] || 0) + weight;
    });
    // 根回し：自分への投票を-1（0未満にはしない）
    this.players.forEach(p => {
      if (p.voteShield && tally[p.id]) {
        tally[p.id] = Math.max(0, tally[p.id] - 1);
      }
    });
    // 使用済みフラグを消費（1回限りの効果）
    this.players.forEach(p => { p.voteBoost = false; p.voteShield = false; });

    const entries = Object.entries(tally).filter(([, c]) => c > 0);
    if (entries.length === 0) return null;
    const max = Math.max(...entries.map(([, c]) => c));
    const top = entries.filter(([, c]) => c === max).map(([id]) => id);
    const targetId = top[Math.floor(Math.random() * top.length)];

    // 投票内訳（誰が誰に投票したか）を対象ごとにまとめる。人狼ONLINEと同一仕様。
    const voteMap = {};
    Object.entries(this.votes || {}).forEach(([fromId, toId]) => {
      const voter  = this.players.find(p => p.id === fromId);
      const target = this.players.find(p => p.id === toId);
      if (!voter || !target) return;
      if (!voteMap[target.name]) voteMap[target.name] = [];
      voteMap[target.name].push(voter.name + (voter.cpu ? ' 🤖' : ''));
    });
    const breakdown = Object.entries(voteMap)
      .sort(([, a], [, b]) => b.length - a.length)
      .map(([targetName, voters]) => ({ targetName, voters, count: voters.length }));

    return { targetId, tally, breakdown };
  }

  /* ===== 処刑処理（脱落設定によって挙動が変わる） ===== */
  executePlayer(playerId) {
    const p = this.players.find(q => q.id === playerId);
    if (!p) return null;
    if (this.elimination === 'survive') {
      p.asset = Math.floor(p.asset / 2);
    } else {
      p.alive = false;
      p.eliminatedSeq = ++this._eliminationSeq; // 何人目に脱落したか（最終結果の順位付けに使用）
    }
    return p;
  }

  /* ===== プレイヤーが「活動中」かどうか（脱落設定により判定方法が異なる） =====
     elim    : 生存している（alive === true）
     survive : 資産が0より大きい（資産0＝事実上のリタイア） */
  isActive(p) {
    if (this.elimination === 'survive') return p.asset > 0;
    return p.alive;
  }

  /* ===== 早期決着判定（脱落ありのときのみ・ゲーム中に毎回チェック） =====
     脱落なしは誰も脱落しないため、ここでは判定しない（規定ラウンド終了時のみ判定）。
     - 個人戦：生存者が1人になった瞬間、その人の勝利で即終了
     - 陣営戦：人狼が全滅した瞬間、村人陣営の勝利／
       　　　　人狼の生存人数が村人陣営の生存人数と同数以上になった瞬間、人狼陣営の勝利
       　　　　（同数以上＝以降の投票で村人側が数的に人狼を上回れなくなるため、その時点で決着とする）
       　　　　（人狼が一人もいない構成では陣営勝敗は発生しない）
     条件を満たさなければ null を返す（＝規定ラウンドまでプレイを続行） */
  checkEarlyWinner() {
    if (this.elimination !== 'elim') return null;

    if (this.battleType === 'individual') {
      const aliveList = this.players.filter(p => p.alive);
      if (aliveList.length === 1) {
        return { type: 'individual', winnerId: aliveList[0].id, reason: 'lastStanding' };
      }
      return null;
    }

    // 陣営戦
    const wolves = this.players.filter(p => (ROLES[p.role] || ROLES.villager).team === 'wolf');
    if (wolves.length === 0) return null;
    const aliveWolves  = wolves.filter(p => p.alive);
    const aliveVillage = this.players.filter(p => (ROLES[p.role] || ROLES.villager).team !== 'wolf' && p.alive);
    if (aliveWolves.length === 0) return { type: 'team', team: 'village', reason: 'wolf_wiped' };
    if (aliveWolves.length >= aliveVillage.length) return { type: 'team', team: 'wolf', reason: 'parity' };
    return null;
  }

  /* ===== 陣営別の資産平均（合計 ÷ 人数）＝人数差の影響を受けない指標 =====
     脱落あり：生存している陣営メンバーのみを対象に平均を取る
     脱落なし：誰も脱落しないため、陣営の全メンバーを対象に平均を取る */
  teamAssetAverages() {
    const wolves  = this.players.filter(p => (ROLES[p.role] || ROLES.villager).team === 'wolf');
    const village = this.players.filter(p => (ROLES[p.role] || ROLES.villager).team !== 'wolf');
    const pool    = arr => this.elimination === 'elim' ? arr.filter(p => p.alive) : arr;

    const wolvesPool  = pool(wolves);
    const villagePool = pool(village);
    const sum = arr => arr.reduce((s, p) => s + p.asset, 0);

    const wolfTotal    = sum(wolvesPool);
    const villageTotal = sum(villagePool);

    return {
      wolfTotal, villageTotal,
      wolfCount    : wolvesPool.length,
      villageCount : villagePool.length,
      wolfAvg      : wolvesPool.length  ? wolfTotal    / wolvesPool.length  : 0,
      villageAvg   : villagePool.length ? villageTotal / villagePool.length : 0,
    };
  }

  /* ===== 陣営勝利判定（規定ラウンド終了時・陣営戦専用） =====
     陣営の資産平均（合計÷人数）を比較。人数が少ない陣営が不利にならないようにするため。
     同額の場合は引き分け（team: null）。人狼陣営が一人もいない構成では陣営勝敗は発生しない（null）。 */
  checkTeamRoundLimitWinner() {
    const wolves = this.players.filter(p => (ROLES[p.role] || ROLES.villager).team === 'wolf');
    if (wolves.length === 0) return null;

    const avgs = this.teamAssetAverages();
    if (avgs.wolfAvg === avgs.villageAvg) {
      return { type: 'team', team: null, reason: 'assetTie', ...avgs };
    }
    return {
      type   : 'team',
      team   : avgs.wolfAvg > avgs.villageAvg ? 'wolf' : 'village',
      reason : 'assetAverage',
      ...avgs,
    };
  }

  /* ===== 規定ラウンド終了時の個人勝者 =====
     活動中のプレイヤーの中で資産最大の者。誰も活動中でなければ全員から選ぶ（保険） */
  individualWinner() {
    const pool = this.players.filter(p => this.isActive(p));
    const list = pool.length ? pool : this.players;
    return list.reduce((a, b) => (b.asset > a.asset ? b : a));
  }

  /* ===== ゲーム終了時の最終結果 =====
     脱落あり：生存者は資産降順で上位に並べ、脱落者は資産0表示で下位に。
              脱落者同士は「脱落が遅い人ほど上位」（＝最後まで粘った人が有利）。
     脱落なし：誰も脱落しないため、全員を資産降順で並べる（従来通り）。 */
  finalResults() {
    const mapped = this.players.map(p => {
      const def        = ROLES[p.role] || ROLES.villager;
      const eliminated = this.elimination === 'elim' && !p.alive;
      return {
        id: p.id, name: p.name, color: p.color,
        asset: eliminated ? 0 : p.asset,
        alive: p.alive, active: this.isActive(p),
        role: p.role, roleName: def.name, roleIcon: def.icon, team: def.team,
        eliminatedSeq: p.eliminatedSeq || 0,
      };
    });

    if (this.elimination !== 'elim') {
      return mapped.sort((a, b) => b.asset - a.asset);
    }

    const aliveList      = mapped.filter(p => p.alive).sort((a, b) => b.asset - a.asset);
    const eliminatedList = mapped.filter(p => !p.alive).sort((a, b) => b.eliminatedSeq - a.eliminatedSeq);
    return [...aliveList, ...eliminatedList];
  }

  nextTurn() {
    let next  = (this.currentTurn + 1) % this.players.length;
    let count = 0;
    // 脱落なし設定は資産0＝リタイア扱いで手番スキップ
    while (!this.isActive(this.players[next]) && count < this.players.length) {
      next = (next + 1) % this.players.length;
      count++;
    }
    const roundEnd = next <= this.currentTurn;
    this.currentTurn = next;
    if (roundEnd) {
      // ここではラウンド番号はまだ進めない（能力/会議/投票フェーズは「今終わったラウンド」の番号のまま行う）
      return { roundEnd: true, round: this.round };
    }
    return { roundEnd: false };
  }

  /** 投票フェーズが終わり、次のラウンドの移動フェーズを始める直前に呼ぶ。
   *  ここで初めてラウンド番号を1つ進める。 */
  advanceRound() {
    this.round++;
    // ショップのアイテム購入は1ラウンドにつき1回まで（新ラウンドでリセット）
    this.players.forEach(p => { p.itemPurchasesThisRound = 0; });
  }

  /* ===== currentTurn が非活動プレイヤー（脱落 / 資産0でリタイア）を指していたら、
     次の活動中プレイヤーまで進める =====
     nextTurn() は「今のターンの次」を計算する際に非活動プレイヤーを飛ばすが、
     ラウンドの節目（能力→会議→投票フェーズ）で誰かが新たに脱落した場合、
     既に確定していた次ラウンドの手番が脱落者を指したままになることがある。
     ラウンド開始直前に必ずこれを呼び、手番が有効なプレイヤーを指すことを保証する。
     全員が非活動な場合は何もしない（呼び出し側でゲーム終了処理が行われている想定）。 */
  advanceToActivePlayer() {
    let count = 0;
    while (!this.isActive(this.players[this.currentTurn]) && count < this.players.length) {
      this.currentTurn = (this.currentTurn + 1) % this.players.length;
      count++;
    }
  }

  /* 全員に見せる情報（役職・資産は隠す） */
  sanitize() {
    return {
      id          : this.id,
      host        : this.host,
      started     : this.started,
      phase       : this.phase,
      currentTurn : this.currentTurn,
      round       : this.round,
      battleType  : this.battleType,
      elimination : this.elimination,
      maxRounds   : this.maxRounds,
      timeConfig  : this.lwTimeConfig || { ability:60, council:90, vote:60, wolf:60 },
      players     : this.players.map(p => ({
        id       : p.id,
        name     : p.name,
        cpu      : p.cpu,
        color    : p.color,
        position : p.position,
        alive    : p.alive,
        laps     : p.laps,
        // role / asset / lastAction は送らない
      })),
    };
  }
}

module.exports = { LifeWolfRoom, SQUARES, PLAYER_COLORS, ROLES, ITEMS };

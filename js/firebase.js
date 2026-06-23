// ╔══════════════════════════════════════════════════════════════════╗
// ║  firebase.js — Firebase 初始化、讀寫、即時監聽                      ║
// ║  所有其他模組透過全域變數 (mails, leaders...) 存取資料               ║
// ╚══════════════════════════════════════════════════════════════════╝

let ADMIN_PASSWORD_CURRENT = 'admin1234';

// ── Firebase 設定 ──────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyDsmqGFLsTYPkvpN6-P8duHWibHujiQ3U0",
  authDomain: "mail-test-7c8fa.firebaseapp.com",
  databaseURL: "https://mail-test-7c8fa-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "mail-test-7c8fa",
  storageBucket: "mail-test-7c8fa.firebasestorage.app",
  messagingSenderId: "586861783031",
  appId: "1:586861783031:web:2a9d36d10d712bd98db0f2"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ── 預設資料（Firebase 首次讀不到資料時套用）──────────
const DEFAULT_LEADERS = [
  { id:'A', name:'Gigi' },
  { id:'B', name:'Linda' },
  { id:'C', name:'Yoyo' },
  { id:'D', name:'Vgtb' },
  { id:'E', name:'傑瑞米' },
  { id:'F', name:'Ellen' },
  { id:'G', name:'Doris' },
];
const DEFAULT_DESIGNERS = [];
const DEFAULT_PROJECTS  = [];
const DEFAULT_LEVELS = ['A+/全站', 'A+/SCS', 'B+/SCS', 'A+/SPX賣版', 'A/全站', 'C/直播', 'C/SPX', 'E/SPX', 'E/MKT', 'E/社群', 'E/CSR', 'E/HR', 'E/IP', 'E/蝦大', 'E/好惠買', 'E/SCS', 'F/', '其他/game', '其他/Circle'];
const DEFAULT_CATEGORIES = ['MKT', 'SPX', 'CSR', 'IP', 'HR', 'OM', '蝦小編的店', 'Sea', 'SCS/蝦皮直營', '蝦大/線上', '蝦大/線下', '好惠買/線上', '好惠買/線下', 'JIT', 'ALL FMCG', 'HEALTH', 'HE', 'TKB', 'BEAUTY', 'HL', 'FB', 'PETS', 'ALL FS', 'WA', 'WACC', 'shoes', 'WB', 'MA', 'MBA', 'ALL EL', 'MG', '3C', 'NB', 'GAME', 'ALL LS', 'MO', 'LE', 'BOOKS', 'SO', 'TS', 'EE', 'CB', 'Cricle-FMCG-BEAUTY Shopee Premium', 'Cricle-FMCG-蝦皮超市', 'Cricle-FMCG-FB Coupang', 'Cricle-FMCG-TKB Coupang', 'Cricle-FMCG-TKB 蝦皮媽咪會員', 'Cricle-FMCG-HEALTH美妝保健館', 'Cricle-FMCG-HL 蝦皮家居L1 ', 'Cricle-FMCG-HL 寢具香氛館L2 ', 'Cricle-FMCG-HL 餐廚杯瓶館L2 ', 'Cricle-ALL LS-LE 文創+娛樂', 'Cricle-ALL LS-BOOKS 蝦皮書城', 'Cricle-ALL LS-T&S電子票券品牌館', 'Cricle-ALL LS-SO 戶外車用', 'Cricle-ALL LS-Shopee vita', 'Cricle-ALL EL-EL 3C家電館', 'Cricle-ALL EL-CB 海外購物節', 'Cricle-ALL EL-CB 品牌大店AD', 'Cricle-ALL EL-CB 正韓獨家品牌日', 'Cricle-MKT-蝦皮超便宜', 'Cricle-MKT-刷卡優惠 L1', 'Cricle-MKT-回饋攻略 L2', 'Cricle-MKT-蝦皮分潤', 'Cricle-MKT-蝦皮分潤EDM'];

// ── 本機狀態（從 Firebase 監聽更新）─────────────────
let mails          = [];
let leaders        = DEFAULT_LEADERS;
let designers      = DEFAULT_DESIGNERS;
let projects       = DEFAULT_PROJECTS;
let designers_meta = {};
let mailLevels     = [];
let mailCategories = [];
let leaves         = [];

// 身份（本機偏好，存 localStorage）
let curLeader  = localStorage.getItem('curLeader') || null;
let pendLeader = null, moMailId = null, perfMailId = null, leaveEditId = null;
let lsS='', lsSt='', lsDes='', lsPF='';
let perfPeriod    = 'week';
let weeklyPeriod  = 'week';
let leaveCalYear  = new Date().getFullYear();
let leaveCalMonth = new Date().getMonth();
let activeWeeklyGroup = null;
let dashP = 'week';

// Firebase 防迴圈 flag
let _writing = { mails:false, leaders:false, designers:false, projects:false, designers_meta:false, leaves:false, mail_levels:false, mail_categories:false };
let _skipNextDesMetaUpdate = false;

// 狀態對照表
const SL = {pending:'預先登記',wip:'內部反修中',done:'已完成',revision:'外部反修中',closed:'結案'};
const SB = {pending:'badge-pending',wip:'badge-wip',done:'badge-done',revision:'badge-revision',closed:'badge-closed'};

// ── 工具函式 ──────────────────────────────────────
const toast   = msg=>{ const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2200); };
const bHtml   = s=>`<span class="badge ${SB[s]}">${SL[s]}</span>`;
const dlH     = v=>v?'<span class="badge badge-miss">MISS</span>':'<span style="color:var(--text3);font-size:11px">—</span>';
const pill    = (v,t)=>!v?'<span class="zp">0</span>':t==='e'?`<span class="ep">${v}</span>`:`<span class="rp">${v}</span>`;
const isToday = s=>{
  if(!s) return false;
  const now = new Date();
  const localDate = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
  const mailDate = new Date(s);
  const mailLocal = mailDate.getFullYear()+'-'+String(mailDate.getMonth()+1).padStart(2,'0')+'-'+String(mailDate.getDate()).padStart(2,'0');
  return mailLocal === localDate;
};
const pastDue = m=>m.due_date&&m.due_date<new Date().toISOString().slice(0,10)&&m.status!=='closed';
const genId   = ()=>{
  const d=new Date();
  const localDate = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const localPrefix = localDate.replace(/-/g,'');
  const t = mails.filter(m => {
    if(!m || !m.created_at) return false;
    const md = new Date(m.created_at);
    const ms = md.getFullYear()+'-'+String(md.getMonth()+1).padStart(2,'0')+'-'+String(md.getDate()).padStart(2,'0');
    return ms === localDate;
  });
  return localPrefix+'-'+String(t.length+1).padStart(3,'0');
};
const lName       = id=>{ if(id==='__admin__')return'管理者'; const l=leaders.find(x=>x.id===id); return l?l.name:id||'—'; };
const pBundle     = name=>projects.find(p=>p.name===name)||null;
const totalH      = m=>+(((m.hours||0)+(m.revHours||0)+(m.commHours||0)+(m.meetHours||0)).toFixed(2));
const bundleTotal = p=>+(((p.hours||0)+(p.revHours||0)+(p.commHours||0)+(p.extRevHours||0)).toFixed(2));

// ══ FIREBASE 讀寫 ══════════════════════════════════

function fbWrite(table, data) {
  const safetyTables = ['leaders','designers','projects'];
  if(safetyTables.includes(table)){
    const isEmpty = Array.isArray(data) ? data.length===0 : !data || Object.keys(data).length===0;
    if(isEmpty){ console.warn(`fbWrite: blocked empty write to ${table}`); return; }
  }
  if (table === 'designers_meta') _skipNextDesMetaUpdate = true;
  _writing[table] = true;
  db.ref('tracker/' + table).set(data).then(() => {
    setTimeout(() => { _writing[table] = false; }, 500);
  }).catch(err => {
    _writing[table] = false;
    if (table === 'designers_meta') _skipNextDesMetaUpdate = false;
    console.error('Firebase 寫入失敗:', err);
    toast('⚠ 儲存失敗：' + err.message);
  });
}

function saveMails() {
  if(!mails || mails.length === 0) return;
  const updates = {};
  mails.forEach(m => {
    if(m && m.id) updates['tracker/mails/' + m.id] = m;
  });
  _writing.mails = true;
  db.ref().update(updates).then(() => {
    _mailsInitDone = true;
    setTimeout(() => { _writing.mails = false; }, 800);
  }).catch(err => {
    _writing.mails = false;
    console.error('mails 寫入失敗:', err);
    toast('⚠ 儲存失敗：' + err.message);
  });
}

function saveL()        { fbWrite('leaders',        leaders); }
function saveD()        { fbWrite('designers',      designers); }
function saveP()        { fbWrite('projects',       projects); }
function saveDesMeta(){
  const arr = designers.map(d => ({ leaderId: designers_meta[d]?.leaderId || '' }));
  fbWrite('designers_meta', arr);
}
function saveLeaves()      { fbWrite('leaves',          leaves); }
function saveLevels()      { fbWrite('mail_levels',     mailLevels); }
function saveCategories()  { fbWrite('mail_categories', mailCategories); }

// ══ FIREBASE 即時監聽 ══════════════════════════════

let _mailsInitDone  = false;
let _mailsInitTimer = null;

db.ref('tracker/mails').on('child_added', snap => {
  if(_writing.mails) return;
  const v = snap.val();
  if(!v || typeof v !== 'object') return;
  const mail = { ...v, id: v.id || snap.key };
  const idx = mails.findIndex(m => m.id === mail.id);
  if(idx >= 0) mails[idx] = mail; else mails.push(mail);
  if(!_mailsInitDone){
    clearTimeout(_mailsInitTimer);
    _mailsInitTimer = setTimeout(()=>{ _mailsInitDone = true; onMailsUpdated(); }, 200);
  } else {
    onMailsUpdated();
  }
});

db.ref('tracker/mails').on('child_changed', snap => {
  if(_writing.mails) return;
  const v = snap.val();
  if(!v || typeof v !== 'object') return;
  const mail = { ...v, id: v.id || snap.key };
  const idx = mails.findIndex(m => m.id === mail.id);
  if(idx >= 0) mails[idx] = mail; else mails.push(mail);
  onMailsUpdated();
});

db.ref('tracker/mails').on('child_removed', snap => {
  if(_writing.mails) return;
  mails = mails.filter(m => m.id !== snap.key);
  onMailsUpdated();
});

db.ref('tracker/leaders').on('value', snap => {
  if (_writing.leaders) return;
  const val = snap.val();
  if (val && Array.isArray(val) && val.length) {
    leaders = val.filter(Boolean);
  } else if (val && typeof val === 'object') {
    leaders = Object.values(val).filter(Boolean);
  } else {
    leaders = [...DEFAULT_LEADERS];
  }
  if (!leaders.length) leaders = [...DEFAULT_LEADERS];
  onLeadersUpdated();
});

db.ref('tracker/designers').on('value', snap => {
  if (_writing.designers) return;
  const val = snap.val();
  designers = val && Array.isArray(val) ? val : DEFAULT_DESIGNERS;
  onDesignersUpdated();
});

db.ref('tracker/projects').on('value', snap => {
  if (_writing.projects) return;
  const val = snap.val();
  projects = val && Array.isArray(val) ? val.map(p=>({
    defaultSubjects:[], extRevHours:0, meetHours:0, qty:0, level:'', group:'', pos:'', ...p
  })) : DEFAULT_PROJECTS;
  onProjectsUpdated();
});

db.ref('tracker/leaves').on('value', snap => {
  if (_writing.leaves) return;
  const val = snap.val();
  leaves = val ? (Array.isArray(val) ? val.filter(Boolean) : Object.values(val)) : [];
  onLeavesUpdated();
});

db.ref('tracker/designers_meta').on('value', snap => {
  if (_skipNextDesMetaUpdate) { _skipNextDesMetaUpdate = false; return; }
  if (_writing.designers_meta) return;
  const val = snap.val();
  designers_meta = {};
  if (Array.isArray(val)) {
    val.forEach((entry, i) => {
      if (designers[i] && entry?.leaderId) {
        designers_meta[designers[i]] = { leaderId: entry.leaderId };
      }
    });
  } else if (val && typeof val === 'object') {
    designers_meta = val;
  }
  onDesMetaUpdated();
});

db.ref('tracker/mail_levels').on('value', snap => {
  if (_writing.mail_levels) return;
  const val = snap.val();
  mailLevels = (val && Array.isArray(val)) ? val : [...DEFAULT_LEVELS];
  populateLevelCategorySelects();
  updateCatDatalist();
});

db.ref('tracker/mail_categories').on('value', snap => {
  if (_writing.mail_categories) return;
  const val = snap.val();
  mailCategories = (val && Array.isArray(val)) ? val : [...DEFAULT_CATEGORIES];
  populateLevelCategorySelects();
});

db.ref('.info/connected').on('value', snap => {
  const connected = snap.val();
  const dot   = document.getElementById('fb-dot');
  const label = document.getElementById('fb-label');
  if (!dot) return;
  dot.className     = 'fb-dot ' + (connected ? 'connected' : 'error');
  label.textContent = connected ? '即時同步中' : '連線中斷';
});

// ── 監聽 admin password（存在 Firebase settings）──────
db.ref('tracker/settings/admin_password').on('value', snap => {
  const val = snap.val();
  if (val) ADMIN_PASSWORD_CURRENT = val;
});

// ══ 資料更新回調 ══════════════════════════════════════
function onMailsUpdated() {
  updateWip();
  renderToday();
  const ap = document.querySelector('.page.active')?.id?.replace('page-','');
  if (ap === 'board')  renderKanban();
  if (ap === 'list')   renderList();
  if (ap === 'perf')   renderPerf();
  if (ap === 'weekly') renderWeekly();
}

function onLeadersUpdated() {
  renderLoginBtns();
  applyChip();
  const ap = document.querySelector('.page.active')?.id?.replace('page-','');
  if (ap === 'settings') renderSettings();
  if (ap === 'board')    renderKanban();
}

function onDesignersUpdated() {
  populateSelects();
  const ap = document.querySelector('.page.active')?.id?.replace('page-','');
  if (ap === 'settings') renderSettings();
}

function onProjectsUpdated() {
  populateSelects();
  const ap = document.querySelector('.page.active')?.id?.replace('page-','');
  if (ap === 'bundle') renderBundlePage('');
}

function onDesMetaUpdated() {
  const ap = document.querySelector('.page.active')?.id?.replace('page-','');
  if (ap === 'perf')   renderPerf();
  if (ap === 'weekly') renderWeekly();
}

function onLeavesUpdated() {
  const ap = document.querySelector('.page.active')?.id?.replace('page-','');
  if (ap === 'leave')  renderLeaveCalendar();
  if (ap === 'weekly') renderWeekly();
}

// Review-only service. All files, prices and receipts are demonstration data.
const period = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
export function quota(s) {
  const day = period(), month = day.slice(0, 7);
  if (s.day !== day) { s.day = day; s.dailyUsed = 0; }
  if (s.month !== month) { s.month = month; s.monthlyUsed = 0; }
  s.remaining = s.member ? Math.max(0, 10 - s.dailyUsed) : 0;
  s.monthlyRemaining = s.member ? Math.max(0, 100 - s.monthlyUsed) : 0;
  return { day: s.remaining, month: s.monthlyRemaining, available: Math.min(s.remaining, s.monthlyRemaining) };
}
export function initial(scenario = 'member', edition = 'points') {
  const member = scenario.startsWith('member'), day = period();
  const s = { scenario, edition, logged: scenario !== 'guest', member,
    balance: edition === 'quota' || scenario.includes('poor') ? 0 : 240, day, month: day.slice(0, 7),
    dailyUsed: scenario.startsWith('member-low') ? 9 : member && (scenario.includes('paid') || scenario.includes('poor')) ? 10 : 0,
    monthlyUsed: scenario === 'member-month' ? 100 : scenario.startsWith('member-low') ? 99 : 0,
    searchStatus: 'free', downloadStatus: 'success', authorized: false,
    orders: [], ledger: [], tasks: [], saved: [], counter: 0 };
  seedMembershipOrder(s);
  quota(s); return s;
}
export function seedMembershipOrder(s) {
  if (!s.member || s.orders.some(order => order.type === 'membership')) return;
  const paidAt = new Date().toISOString();
  s.orders.push({
    id: 'DEMO-MEMBER-001', type: 'membership', title: '月会员', amount: 30,
    status: 'paid', paidAt, createdAt: paidAt, fulfilled: true, example: true,
  });
}
export const manifest = () => [
  { id:'original-1', name:'整体.jpg', format:'JPG', bytes:1400000, thumbnail:'assets/collection-plate.jpg' },
  { id:'original-2', name:'侧面.jpg', format:'JPG', bytes:2000000, thumbnail:'assets/collection-vase.jpg' },
  { id:'original-3', name:'底部.jpg', format:'JPG', bytes:4200000, thumbnail:'assets/collection-plate.jpg' },
  { id:'original-4', name:'纹饰细节.tiff', format:'TIFF', bytes:10000000, thumbnail:'assets/collection-vase.jpg' },
  { id:'original-5', name:'高清原图.tiff', format:'TIFF', bytes:50000000, thumbnail:'assets/collection-plate.jpg' },
  { id:'original-6', name:'超大原图.tiff', format:'TIFF', bytes:52400000, thumbnail:'assets/collection-vase.jpg' },
];
export function imagePoints(bytes) {
  if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > 50000000) throw new Error('该图片超过 50MB 或大小无效，无法下载');
  return bytes < 2000000 ? 1 : bytes < 10000000 ? 2 : 5;
}
export function quote(s, ids = ['original-1','original-2']) {
  const limits = quota(s);
  if (s.downloadStatus === 'error') throw new Error('暂时无法获取下载信息，请重试');
  if (s.downloadStatus === 'empty') return { unavailable: '该藏品暂无可下载的图片' };
  if (s.downloadStatus === 'blocked') return { unavailable: '来源暂未开放这些图片的下载' };
  if (!ids.length || new Set(ids).size !== ids.length) throw new Error('请选择至少一张图片，且不可重复选择');
  const all = manifest();
  const selected = all.filter(file => ids.includes(file.id));
  if (selected.length !== ids.length) throw new Error('图片清单已更新，请重新选择');
  const freeCount = Math.min(limits.available, selected.length);
  const hasPoints = s.edition === 'points';
  const files = selected.map(file => {
    if (file.bytes > 50000000) throw new Error('单张超过 50MB，无法下载');
    return { ...file, rate: hasPoints ? imagePoints(file.bytes) : 0 };
  });
  // Highest point cost first; equal prices keep the collection's display order.
  const covered = new Set([...files].sort((a,b) => b.rate - a.rate).slice(0,freeCount).map(file => file.id));
  const lines = files.map(file => ({ ...file, covered: covered.has(file.id), cost: covered.has(file.id) ? 0 : file.rate }));
  const cost = lines.reduce((sum,file) => sum + file.cost,0);
  const bytes = files.reduce((sum,file) => sum + file.bytes,0);
  const blocked = hasPoints ? (availableBalance(s) < cost ? 'balance' : null) : (freeCount < files.length ? 'quota' : null);
  return { files:lines, size:(bytes/1000000).toFixed(2)+' MB', freeCount, cost, limits, blocked, affordable:!blocked };
}
export function availableBalance(s) {
  const pending = s.tasks.find(task => !task.debit && ['running','settling'].includes(task.status));
  return s.balance - (pending?.cost || 0);
}
export function sameQuote(a,b) {
  return !!b?.files && a.freeCount === b.freeCount && a.cost === b.cost &&
    a.files.length === b.files.length && a.files.every((file,i) =>
      file.id === b.files[i].id && file.covered === b.files[i].covered && file.cost === b.files[i].cost);
}
export function createTask(s,q,title,image) {
  if (!s.logged || !s.authorized || !q?.files?.length) throw new Error('请先完成登录、选图、授权及下载确认');
  if (s.tasks.some(task => ['running','settling'].includes(task.status))) throw new Error('已有下载正在处理，请先查看当前任务');
  const fresh = quote(s,q.files.map(file => file.id));
  if (!fresh.affordable || !sameQuote(q,fresh)) throw new Error('额度或费用已变化，请重新确认');
  const task = {
    id:'D'+(++s.counter), title, image, files:fresh.files.map(file => ({ ...file, done:false })),
    cost:fresh.cost, freeCount:fresh.freeCount, status:'running', percent:0, settled:false,
    time:new Date().toISOString(), failReason:'', scenario:s.downloadStatus,
  };
  debitTask(s,task);
  s.tasks.unshift(task);
  return task;
}
function debitTask(s,task) {
  const limits = quota(s);
  if (limits.available < task.freeCount) throw new Error('可用下载额度已变化，请重新确认');
  if (s.balance < task.cost) throw new Error('可用积分已变化，请重新确认');
  task.debit = { day:s.day, month:s.month };
  s.dailyUsed += task.freeCount;
  s.monthlyUsed += task.freeCount;
  if (task.cost) {
    s.balance -= task.cost;
    s.ledger.unshift({id:task.id,title:'图片下载 · '+(task.files.length-task.freeCount)+' 张',amount:-task.cost,time:new Date().toISOString()});
  }
  quota(s);
}
export function finishTask(s,task) {
  if (!s.tasks.includes(task)) throw new Error('任务不属于当前演示账号');
  if (task.settled) return false;
  if (!task.files.length || !task.files.every(file => file.done) || task.percent !== 100 || !['running','settling'].includes(task.status)) {
    throw new Error('所选图片尚未全部保存成功，无法结算');
  }
  // Previously saved tasks may have been created before charging at confirmation.
  if (!task.debit) debitTask(s,task);
  task.status='success';
  task.settled=true;
  task.completedAt=new Date().toISOString();
  return true;
}

const quotaDownloadLogPrefix = 'yuancang-quota-download-log:';
function downloadRecord(task, id) {
  const images = task.files.filter(file => file.done).map(file => ({
    id:file.id, name:file.name, savedAt:file.savedAt,
  }));
  const lastSavedAt = images.map(image => image.savedAt).filter(Boolean).sort().at(-1);
  return {
    id, userId:'YC-DEMO-001', userName:'元藏体验用户',
    time:lastSavedAt || task.completedAt || task.time, legacyTime:!lastSavedAt && !task.completedAt,
    collectionId:task.collectionId || '', collection:task.title,
    images,
  };
}

export function saveQuotaDownloadRecord(task) {
  const savedCount = task.files.filter(file => file.done).length;
  if (!savedCount || savedCount === task.loggedImageCount) return;
  const id = task.auditId || crypto.randomUUID();
  localStorage.setItem(quotaDownloadLogPrefix + id, JSON.stringify(downloadRecord(task, id)));
  task.auditId = id;
  task.loggedImageCount = savedCount;
}

export function readQuotaDownloadRecords() {
  const records = new Map();
  for (let i=0; i<localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(quotaDownloadLogPrefix)) continue;
    const record = JSON.parse(localStorage.getItem(key));
    if (record) records.set(record.id, record);
  }
  const saved = JSON.parse(localStorage.getItem('yuancang-review-download-quota'));
  for (const task of saved?.tasks || []) {
    if (!task.files.some(file => file.done)) continue;
    const id = task.auditId || `legacy-${task.id}-${task.time}`;
    if (!records.has(id)) records.set(id, downloadRecord(task, id));
  }
  return [...records.values()];
}
export function failTask(s,task,reason='部分所选图片下载失败',status='failed') {
  if (task.settled || !s.tasks.includes(task)) return;
  if (task.debit) {
    quota(s);
    if (s.day === task.debit.day) s.dailyUsed -= task.freeCount;
    if (s.month === task.debit.month) s.monthlyUsed -= task.freeCount;
    if (task.cost) {
      s.balance += task.cost;
      s.ledger = s.ledger.filter(entry => entry.id !== task.id);
    }
    delete task.debit;
    quota(s);
  }
  task.status=status;
  task.failReason=reason;
}
export function retryTask(s,t) {
  if (!s.tasks.includes(t)) throw new Error('任务不属于当前账号');
  if (!['failed','stopped'].includes(t.status)) return;
  if (s.tasks.some(o=>o!==t&&['running','settling'].includes(o.status))) throw new Error('请先完成当前下载任务');
  const fresh=quote(s,t.files.map(file => file.id));
  if (!fresh.affordable || !sameQuote(t,fresh)) throw new Error('额度或费用已变化，请重新发起下载确认');
  debitTask(s,t);
  t.status='running'; t.percent=Math.floor(t.files.filter(f=>f.done).length/t.files.length*90); t.scenario='success'; t.failReason='';
}
export function createOrder(s,type,amount,title) {
  if (!s.logged) throw new Error('请先登录');
  if (type === 'recharge' && s.edition === 'quota') throw new Error('当前版本仅提供会员订阅');
  if (!Number.isSafeInteger(amount) || amount<1 || !Number.isSafeInteger(amount*10)) throw new Error('请输入有效的整数金额');
  const o={id:'YC'+Date.now()+(++s.counter),type,amount,title,status:'pending',paidAt:null,createdAt:new Date().toISOString(),fulfilled:false};
  s.orders.unshift(o);return o;
}
export function payOrder(s,o,result) {
  if (o.fulfilled || o.status==='paid'&&result!=='success') return;
  if (result==='cancel'||result==='fail') { o.status=result==='cancel'?'cancelled':'failed';return; }
  o.status='paid'; o.paidAt ||= new Date().toISOString(); if(result==='delay')return;
  o.fulfilled=true;
  if(o.type==='recharge'){s.balance+=o.amount*10;s.ledger.unshift({id:o.id,title:'元藏积分充值',amount:o.amount*10,time:o.paidAt});}
  else { s.member=true; quota(s); }
}
export function searchEntitlement(s) {
  if(s.searchStatus==='error')throw new Error('暂时无法获取检索权益，请重试');
  if (s.searchStatus !== 'points') return 'free';
  if (s.edition === 'quota') return 'exhausted';
  return availableBalance(s) >= 1 ? 'confirm' : 'insufficient';
}
export function chargeSearch(s,key,query) {
  if(s.ledger.some(e=>e.id===key))return;
  if(s.edition === 'quota' || availableBalance(s) < 1) throw new Error('检索额度不足');
  s.balance--;s.ledger.unshift({id:key,title:'检索 · '+query,amount:-1,time:new Date().toISOString()});
}

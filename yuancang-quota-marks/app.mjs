import { initial, seedMembershipOrder, quota, manifest, quote, sameQuote, availableBalance, createTask, finishTask, failTask, retryTask, saveQuotaDownloadRecord, createOrder, payOrder, searchEntitlement, chargeSearch } from './model.mjs?v=5';
import { reviewScenes } from './review-scenes.mjs';

const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = (name, state='navy') => `<img class="icon" alt="" src="assets/icons/${name}-${state}.png">`;
const downloadIcon = `<svg class="download-symbol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/></svg>`;
const btn = (text, action, cls='primary', attrs='') => `<button class="${cls}" data-action="${action}" ${attrs}>${text}</button>`;
const kv = (label, value) => `<div class="kv"><span>${label}</span><span>${value}</span></div>`;
const fmt = n => Number(n).toLocaleString('zh-CN');
const date = d => d ? new Date(d).toLocaleString('zh-CN', {hour12:false}) : '—';
const orderNumber = order => order.id === 'DEMO-MEMBER-001' ? 'YC-MEMBER-001' : order.id;
const empty = (title, text, action='') => `<div class="empty">${icon('image')}<h3>${title}</h3><p class="caption">${text}</p>${action}</div>`;
const edition = document.documentElement.dataset.edition;
const hasPoints = edition === 'points';
const storageKey = 'yuancang-review-download-'+edition;
let s;
try { s = JSON.parse(localStorage.getItem(storageKey)); if (!s || s.edition !== edition || !Array.isArray(s.tasks)) s = initial('member',edition); } catch { s = initial('member',edition); }
seedMembershipOrder(s);
// A closed review tab interrupts simulated work; no background success or hidden debit.
for (const task of s.tasks) {
  if (task.status === 'running') failTask(s,task,'下载已中断','stopped');
}
const ui = { page:'home', stack:[], item:0, image:0, detailTab:'basic', query:'', queryDraft:'', source:'collection', searchCompleted:false, searchFee:0, noResults:false,
  selectedImages:[], confirmedQuote:null, recharge:10, agreement:false, plan:'monthly', ordersTab:'all', ledgerTab:'all', selectedOrder:null, selectedTask:null,
  modal:null, returnIntent:null, marksWall:null, filters:[], draftFilters:[], filterSection:'分类', filterQuery:'', zoom:1, savedScroll:0 };
const items = Array.from({length:8}, (_,i) => ({ id:'c'+(i+1), title:['花口青瓷盘','青瓷瓶','青釉刻花缠枝纹器','白釉器物'][i%4], image:`assets/collection-${i%2?'vase':'plate'}.jpg`, category:i%2?'瓷器':'瓷器', dynasty:'' }));
const current = () => items[ui.item] || items[0];
let workTimer=null, searchTimer=null, toastTimer=null, modalFocus=null;
const titles = {home:'元藏',list:'全球馆藏',archives:'宫廷档案',search:'搜索结果',detail:'藏品详情',viewer:'藏品大图',marks:'瓷器款识库',profile:'我的',benefits:'会员权益',membership:'我的会员',plans:'选择元藏会员',checkout:'确认会员订单',points:'元藏积分',recharge:'充值元藏积分',orders:'我的订单',payment:'支付结果',downloads:'下载记录',task:'下载详情',login:'登录元藏',agreement:'使用规则',library:'元藏图书馆',favorites:'我的收藏'};
const tabPages=['home','list','marks','archives','profile'];
const save=()=>{if(ui.reviewMode)return;try{localStorage.setItem(storageKey,JSON.stringify(s));}catch{}};
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2600);}
function navigate(page, replace=false){if(ui.modal) closeModal();if(!replace)ui.stack.push({page:ui.page,scroll:$('#screen').scrollTop});ui.page=page;render();$('#screen').scrollTop=0;}
function back(){if(ui.modal){closeModal();return;}const prev=ui.stack.pop();ui.page=prev?.page||'home';render();$('#screen').scrollTop=prev?.scroll||0;}
function ensureLogin(intent){if(s.logged)return true;ui.returnIntent=intent;navigate('login');return false;}
function navigateAccount(page){if(ensureLogin({kind:'page',page}))navigate(page);}
async function shareCollection(){
  const url=new URL(location.href);
  url.search='';
  url.searchParams.set('scene','detail');
  url.searchParams.set('item',ui.item);
  try{await navigator.clipboard.writeText(url.href);toast('已复制藏品链接');}
  catch{toast('无法复制链接，请重试');}
}
function marksFrame(){
  const params=new URLSearchParams({member:s.logged&&s.member?'1':'0',v:'4'});
  if(!hasPoints)params.set('manage','1');
  if(ui.marksFixture)params.set('preview','1');
  if(ui.marksWall)params.set('wall',ui.marksWall);
  return `<iframe class="marks-frame" src="marks/index.html?${esc(params)}" title="瓷器款识库"></iframe>`;
}
window.addEventListener('message',event=>{
  const origin=location.protocol==='file:'?'null':location.origin;
  if(ui.page!=='marks'||event.origin!==origin||event.source!==$('.marks-frame')?.contentWindow||event.data?.type!=='yuancang:marks-membership'||(s.logged&&s.member))return;
  const wall=event.data.wall;
  if(typeof wall!=='string'||!/^[a-z0-9-]{1,60}$/.test(wall))return;
  ui.marksWall=wall;
  const intent={kind:'marks',wall};
  if(ensureLogin(intent)){ui.returnIntent=intent;navigate('plans');}
});
function activeTask(){return s.tasks.find(t=>t.id===ui.selectedTask);}
function selectedOrder(){return s.orders.find(o=>o.id===ui.selectedOrder);}
function syncPanel(){
  $('#scenario').value=s.scenario;$('#search-state').value=s.searchStatus;$('#download-state').value=s.downloadStatus;
  $('#account-summary').innerHTML=kv('身份',s.logged?(s.member?'元藏会员':'普通用户'):'未登录')+(hasPoints?kv('可用积分',fmt(availableBalance(s))):'')+kv('免费下载剩余',s.remaining+' 张')+kv('本月免费剩余',s.monthlyRemaining+' 张')+kv('订单数',s.orders.length+' 笔');
  const summary = hasPoints ? '系统先用免费额度，超出的图片按张计费。' : '今日和本月额度同时生效，任一额度用完即暂停下载。';
  $('#inspector').textContent=summary;
}
function header(){return `<div class="app-nav"><div class="nav-left">${ui.page==='home'?'':btn(icon('back'),'back','icon-button','aria-label="返回"')}${!tabPages.includes(ui.page)?btn(icon('home'),'home','icon-button','aria-label="返回首页"'):''}</div><div class="nav-title">${titles[ui.page]}</div><div class="capsule" aria-hidden="true">··· ◉</div></div>`;}
function tabbar(){return tabPages.includes(ui.page)?[['home','home','首页'],['list','vase','馆藏'],['marks','trace','款识库'],['archives','archive','档案'],['profile','user','我的']].map(([p,i,t])=>btn(`<span class="icon-wrap">${icon(i,ui.page===p?'selected':'unselected')}</span>${t}`,p,ui.page===p?'active':'')).join(''):'';}
function render(){
  quota(s);
  $('#app-header').innerHTML=header();$('#tabbar').innerHTML=tabbar();
  $('#screen').innerHTML=pages[ui.page]();
  $('#review-links').innerHTML=[['home','01','原有首页'],['detail','02','藏品详情 · 图片下载'],['search','03','检索'],['profile','04','我的 · 账户入口'],['benefits','05','会员权益'],['marks','06','瓷器款识库'],...(hasPoints?[['points','07','积分中心与充值']]:[]),['downloads','08','下载记录'],['orders','09','我的订单']].map(([p,n,t])=>btn(`<small>${n}</small>${t}`,'review-page',ui.page===p?'selected':'',`data-page="${p}"`)).join('');
  syncPanel();save();
}
const searchForm=(value='',placeholder='搜索藏品与档案')=>`<form class="searchbar" id="search-form">${icon('search')}<input id="query" name="query" value="${esc(value)}" placeholder="${placeholder}" autocomplete="off" maxlength="120" aria-label="检索关键词"><button type="submit">搜索</button></form>`;
const tags=()=>ui.filters.length?`<div class="selected-tags">${ui.filters.map(t=>btn(`${esc(t)} ×`,'remove-filter','tag',`data-value="${esc(t)}"`)).join('')}</div>`:'';
function cards(){return `<div class="card-grid">${items.slice(0,ui.loaded||4).map((c,i)=>`<button class="collection-card" data-action="item" data-index="${i}"><div class="media"><img src="${c.image}" alt="${esc(c.title)}"></div><div class="body"><strong class="clamp2">${c.title}</strong><span class="tag">瓷器</span></div></button>`).join('')}</div>`;}
const benefitsRows=()=>[['藏品检索','有限结果','完整结果'],['藏品图片','预览图片','授权高清图'],['基本信息','摘要字段','完整资料'],['原始元数据','受限','可查看'],['档案与图书','摘要与简介','授权全文'],['款识库','每个图墙最多 20 个','完整浏览'],['每日免费图片','无免费额度','10 张'],['每月免费图片','无免费额度','最多 100 张'],...(hasPoints?[['额度外下载','按张计费','超出部分按张计费'],['额度外检索','1 积分 / 次','1 积分 / 次']]:[])].map(r=>`<div class="benefits-grid">${r.map(v=>`<span>${v}</span>`).join('')}</div>`).join('');
const menu=(label,action,extra='')=>btn(`<span>${label}</span><span class="row caption">${extra}${icon('chevron')}</span>`,action,'menu-row');
const pages={
marks:marksFrame,
home:()=>`<div class="page"><div class="row between"><strong class="heading">元藏</strong><span class="caption">全球博物馆通鉴</span></div><div class="hero" data-action="item" data-index="0" role="button" tabindex="0"><img src="${items[0].image}" alt="花口青瓷盘"><div class="hero-caption"><strong>花口青瓷盘</strong></div><div class="hero-dots"><i></i><i></i><i></i></div></div><div class="entries">${[['museum','全球馆藏','list'],['scroll','宫廷档案','archives'],['trace','瓷器款识库','marks'],['book','元藏图书馆','library']].map(([i,t,a])=>btn(`${icon(i)}<span>${t}</span>`,a,'entry')).join('')}</div>${searchForm()}<div class="words"><span class="micro">推荐词</span>${['青瓷','器形','纹饰'].map(w=>btn(w,'word','',`data-word="${w}"`)).join('')}</div><div class="value-card"><div class="value-top"><img src="assets/value-silhouettes.png" alt=""><div class="value-brand">元藏</div><div class="value-title">全球馆藏，<br>一处通览</div></div><div class="caption">看藏品 · 查档案 · 读专业图书</div></div><div class="panel member-card row between"><div class="flex"><h3>元藏会员</h3><p class="caption">高清大图 · 完整资料<br>每日免费 10 张 · 每月最多 100 张${hasPoints?'<br>超出免费额度后按张扣积分':''}</p></div>${btn('了解权益','benefits','secondary small')}</div></div>`,
list:()=>listPage(false),search:()=>listPage(true),archives:()=>listPage(false,true),
detail:()=>{const c=current();return `<div class="page"><div class="detail-photo small-gap"><img src="${ui.image===0?c.image:items[(ui.item+1)%8].image}" alt="${esc(c.title)}">${btn(`${icon('zoom','white')} 查看大图`,'viewer','button-with-icon')}</div><div class="thumbnails">${['整体','补充视图'].map((l,i)=>btn(`<img src="${i===0?c.image:items[(ui.item+1)%8].image}" alt=""><span>${l}</span>`,'thumb',`thumb ${ui.image===i?'selected':''}`,`data-index="${i}"`)).join('')}</div><h2 class="title">${c.title}</h2><div class="button-row gap">${btn(`${icon('bookmark',s.saved.includes(c.id)?'selected':'unselected')}${s.saved.includes(c.id)?'已收藏':'收藏'}`,'favorite','secondary button-with-icon')}${btn(`${icon('share')}分享`,'share','button-with-icon')}</div><button class="download-entry" data-action="download"><div class="row">${downloadIcon}<div><strong>图片下载</strong><div class="caption">选择需要的原始图片 · 单张不超过 50MB</div></div></div>${icon('chevron')}</button><div class="tabs">${btn('基本信息','detail-tab',ui.detailTab==='basic'?'active':'','data-tab="basic"')}${btn('元数据','detail-tab',ui.detailTab==='metadata'?'active':'','data-tab="metadata"')}</div>${ui.detailTab==='basic'?`<div class="fields">${kv('名称',esc(c.title))}${kv('分类','瓷器')}</div>`:s.member?`<div class="fields"><p class="caption">暂无原始元数据</p></div>`:gate('开通会员查看原始元数据')}<p class="caption gap">AI 辅助翻译内容请以原始元数据核对。</p></div>`;},
viewer:()=>`<div class="viewer"><div class="caption">${ui.image+1} / 2</div><div class="viewer-image"><img style="width:${ui.zoom*100}%" src="${ui.image===0?current().image:items[(ui.item+1)%8].image}" alt="藏品大图"></div><div>${btn('－','zoom-out')}${btn('复位','zoom-reset')}${btn('＋','zoom-in')}</div>${btn('上一张','prev-image')}${btn('下一张','next-image')}<p class="caption">缩放后可滑动查看</p></div>`,
profile:()=>`<div class="page">${s.logged?`<div class="panel row"><div class="avatar">${icon('user')}</div><div class="flex"><h3>元藏用户</h3><p class="caption">${s.member?'元藏会员':'注册用户'}</p></div>${btn(icon('chevron'),'membership','icon-button','aria-label="会员权益"')}</div>${hasPoints?`<div class="asset-card"><div class="row between"><span class="caption">我的元藏积分</span>${btn('充值','recharge','secondary small')}</div><div class="balance">${fmt(s.balance)} <small>积分</small></div>${btn('收支明细 ›','points','inline-link')}</div>`:''}<div class="panel gap">${menu('我的订单','orders',hasPoints?'会员订阅 · 积分充值':'会员订阅')}${menu('我的收藏','favorites',s.saved.length+' 项')}${menu('我的会员','membership')}</div>${btn('退出登录','logout','plain block gap')}`:`<div class="panel"><h2>欢迎来到元藏</h2><p class="caption gap">登录后保存收藏，管理${hasPoints?'下载、积分和订单':'下载和会员订单'}。</p>${btn('登录 / 注册','login','primary block gap')}</div>`}</div>`,
benefits:()=>`<div class="page"><div class="lead">元藏会员</div><p class="caption gap">从看见器物，到核对完整资料。</p><div class="panel gap"><div class="benefits-grid header"><span>权益</span><span>注册用户</span><span>元藏会员</span></div>${benefitsRows()}</div><div class="notice gap">会员每日可免费下载 10 张、每月最多 100 张。${hasPoints?'下载优先使用免费额度，超出部分按张扣积分。普通注册用户可使用积分下载。':'普通注册用户开通会员后可下载。今日或本月额度用完后，需等对应额度恢复。'}</div><p class="caption gap">图片与全文仍受来源授权范围限制。</p></div><div class="sticky-action">${btn(s.member?'查看我的会员':'查看会员套餐',s.member?'membership':'plans')}</div>`,
membership:()=>`<div class="page"><div class="panel"><span class="tag green">${s.member?'会员有效':'注册用户'}</span><div class="lead gap">${s.member?'我的元藏会员':'探索元藏会员'}</div><p class="caption small-gap">${s.member?'查看下载额度和会员权益':'订阅会员，获取完整资料与更多免费下载权益'}</p><div class="divider"></div></div><section class="panel gap" aria-label="下载额度"><div class="row between"><h3>下载额度</h3>${btn('使用规则','agreement','secondary small')}</div>${quotaCounts(s.remaining,s.monthlyRemaining)}${kv('会员额度上限','每日 10 张 / 每月 100 张')}<p class="caption gap">${quotaNotice()}</p></section><div class="panel gap">${menu('会员权益','benefits')}${menu('我的订单','orders')}${menu('下载记录','downloads')}${hasPoints?menu('积分充值','recharge'):''}</div></div><div class="sticky-action">${btn(s.member?'手动续费':'订阅会员','plans')}</div>`,
plans:()=>`<div class="page"><div class="lead">选择元藏会员</div>${[['monthly','月会员',30,'30 天'],['yearly','年会员',298,'365 天']].map(([id,title,price,duration])=>btn(`<div class="row between"><strong>${title}</strong><span class="circle-check">${ui.plan===id?'✓':''}</span></div><div class="plan-price">¥${price}</div><p class="caption">${duration} · 每日免费 10 张 · 每月最多 100 张<br>高清大图 · 完整资料 · 授权全文<br>款识库完整浏览</p>`,'plan',`panel plan ${ui.plan===id?'active':''}`,`data-value="${id}"`)).join('')}<p class="caption gap">${hasPoints?'下载先用免费额度，超出部分按张扣积分。':'日额度或月额度用完后，需等待对应额度恢复。'}</p>${btn('对比会员权益','benefits','plain block gap')}</div><div class="sticky-action">${btn('确认套餐，查看订单','checkout')}</div>`,
checkout:()=>`<div class="page"><h2>确认会员订单</h2><div class="panel gap">${kv('订阅套餐',ui.plan==='monthly'?'月会员':'年会员')}${kv('会员时长',ui.plan==='monthly'?'30 天':'365 天')}${kv('会员免费下载','每日 10 张 / 每月 100 张')}${kv('支付金额','¥'+(ui.plan==='monthly'?30:298))}</div><div class="notice gap">${hasPoints?'优先使用免费额度，超出的图片按张扣积分。':'点击确认下载时按张扣减日、月额度。'}</div></div><div class="sticky-action">${btn('确认支付 ¥'+(ui.plan==='monthly'?30:298),'pay-membership')}</div>`,
points:()=>`<div class="page"><div class="asset-card" style="margin-top:0"><div class="caption">可用元藏积分</div><div class="balance">${fmt(s.balance)}</div><div class="row between"><span class="caption">1 元 = 10 元藏积分</span>${btn('充值积分','recharge','primary small')}</div></div><div class="panel gap"><h3>积分可以做什么</h3><div class="divider"></div><div class="row"><span>${downloadIcon}</span><div><strong>下载藏品原图</strong><p class="caption">先使用免费额度，超出部分逐张计费</p></div></div><div class="row gap">${icon('search')}<div><strong>继续检索</strong><p class="caption">免费额度用完后，1 积分 / 次</p></div></div></div><div class="section-head"><h3>积分收支明细</h3>${btn('使用规则','agreement','inline-link')}</div><div class="tabs">${[['all','全部'],['in','收入'],['out','支出']].map(([t,n])=>btn(n,'ledger-tab',ui.ledgerTab===t?'active':'',`data-value="${t}"`)).join('')}</div>${ledger()}</div>`,
recharge:()=>`<div class="page"><div class="row between"><span class="caption">当前可用积分</span><strong>${fmt(s.balance)}</strong></div><div class="lead gap">充值元藏积分</div><p class="caption small-gap">1 元 = 10 积分 · 下载与检索均可使用</p><div class="recharge-grid">${[10,50,100].map(n=>btn(`<strong>¥${n}</strong><small>${fmt(n*10)} 积分</small>`,'amount',`recharge-choice ${ui.recharge===n&&!ui.custom?'active':''}`,`data-value="${n}"`)).join('')}</div><label class="input-label" for="custom-amount">自定义金额</label><div class="custom-amount"><strong>¥</strong><input id="custom-amount" inputmode="numeric" placeholder="请输入整数金额" value="${ui.custom?esc(ui.recharge):''}" aria-describedby="amount-error"></div><div id="amount-error" class="form-error" aria-live="polite"></div><div class="panel gap">${kv('到账积分','<strong id="credited-points">'+fmt(Number(ui.recharge)*10)+'</strong>')}${kv('支付金额','<strong id="pay-amount">¥'+esc(ui.recharge)+'</strong>')}</div><label class="agreement-check"><input type="checkbox" id="recharge-agreement" ${ui.agreement?'checked':''}><span>我已阅读并同意 <button type="button" data-action="recharge-rules">《元藏积分使用说明》</button></span></label><div class="notice gap">充值后积分到账。返回下载或检索时，仍会显示费用确认，不会自动扣除积分。</div></div><div class="sticky-action">${btn('确认充值 ¥'+esc(ui.recharge),'pay-recharge','primary',`id="recharge-submit" ${ui.agreement?'':'disabled'}`)}</div>`,
orders:()=>`<div class="page"><div class="tabs">${[['all','全部'],['membership','会员订阅'],...(hasPoints?[['recharge','积分充值']]:[])].map(([t,n])=>btn(n,'orders-tab',ui.ordersTab===t?'active':'',`data-value="${t}"`)).join('')}</div>${orderList()}</div>`,
payment:()=>paymentPage(),
downloads:()=>`<div class="page"><h2>下载记录</h2><p class="caption small-gap">查看每批图片的下载状态</p>${s.tasks.length?s.tasks.map(taskCard).join(''):empty('暂无下载记录','在藏品详情点击“图片下载”即可开始。',btn('浏览馆藏','list','secondary'))}</div>`,
task:()=>taskPage(),
login:()=>`<div class="page"><div class="lead gap">欢迎来到元藏</div><p class="caption gap">登录后可查看下载记录和${hasPoints?'积分与订单':'会员权益'}。</p><div class="panel gap"><div class="avatar">${icon('user')}</div><label class="agreement-check"><input type="checkbox" id="login-agreement"><span>我已阅读并同意用户协议与隐私说明</span></label>${btn('登录并继续','login-confirm','primary block gap','id="login-submit" disabled')}${btn('查看协议与隐私说明','login-rules','plain block small')}</div></div>`,
agreement:()=>`<div class="page"><h2>${hasPoints?'元藏积分与下载说明':'图片下载规则'}</h2>${rules()}</div>`,
library:()=>`<div class="page"><h2>元藏图书馆</h2>${empty('暂无可阅图书','请稍后再来查看。',btn('返回首页','home','secondary'))}</div>`,
favorites:()=>`<div class="page"><h2>我的收藏</h2>${s.saved.length?s.saved.map(id=>{const i=items.findIndex(c=>c.id===id);return btn(`<img class="task-thumb" src="${items[i].image}" alt=""><span class="flex">${esc(items[i].title)}</span>${icon('chevron')}`,'item','row block gap',`data-index="${i}"`);}).join(''):empty('暂无收藏','在藏品详情点击收藏，登录后即可保存。',btn('浏览馆藏','list','secondary'))}</div>`,
};
function gate(text){return `<div class="lock-gate">${icon('lock')}<strong>${text}</strong>${btn('查看会员权益','benefits','primary small')}</div>`;}
function listPage(isSearch=false,archives=false){
  const archive=archives||(isSearch&&ui.source==='archive');
  return `<div class="page">${searchForm(ui.queryDraft,isSearch?'搜索藏品与档案':archives?'搜索宫廷档案':'搜索全球馆藏')}${isSearch?`<div class="tabs gap">${btn('全球馆藏','source',ui.source==='collection'?'active':'','data-value="collection"')}${btn('宫廷档案','source',ui.source==='archive'?'active':'','data-value="archive"')}</div>`:''}<div class="filter-row">${(archive?['来源','年号']:['分类','朝代时期','国家/地区','馆藏机构']).map(t=>btn(`${t}⌄`,'filters','',`data-section="${t}"`)).join('')}</div>${tags()}<div class="results-note"><span>${ui.searchCompleted?(ui.noResults?'暂无匹配结果':`“${esc(ui.query||'筛选结果')}” · 检索结果`):'浏览全部'}</span><span>${ui.searchCompleted?(ui.searchFee?'本次已用 1 积分':'本次免费'):'默认浏览不扣费'}</span></div>${ui.searching?'<div class="loading-box"><div class="spinner"></div>正在检索，请稍候</div>':ui.noResults?empty('未找到相关内容','可以调整关键词或筛选条件后再试。',btn('重新搜索','focus-search','secondary')):archive?Array.from({length:3},(_,i)=>`<div class="panel archive-item"><span class="tag">宫廷档案</span><h3 class="gap">器物制作与陈设记录</h3><p>造办处活计档</p><p>${s.member?'暂无可阅正文。':'开通会员可查看已授权的档案全文。'}</p>${s.member?'':btn('查看会员权益','benefits','secondary small')}</div>`).join(''):cards()}${!ui.noResults&&!archive&&!ui.searching?btn((ui.loaded||4)<8?'继续加载 · 同次检索不重复扣费':'已展示全部结果','load-more','plain block gap',((ui.loaded||4)>=8?'disabled':'')):''}</div>`;
}
function ledger(){const rows=s.ledger.filter(e=>ui.ledgerTab==='all'||(ui.ledgerTab==='in'?e.amount>0:e.amount<0));return rows.length?rows.map(e=>`<div class="ledger-row"><div class="flex"><strong>${esc(e.title)}</strong><div class="caption">${date(e.time)}</div></div><div class="amount ${e.amount>0?'positive':''}">${e.amount>0?'+':''}${fmt(e.amount)}</div></div>`).join(''):empty('暂无积分记录','充值到账、积分下载与检索消费会显示在这里。');}
const orderStatus=o=>o.status==='paid'?(o.fulfilled?'已完成':o.type==='recharge'?'积分入账中':'会员开通中'):({pending:'待支付',failed:'支付失败',cancelled:'已取消'}[o.status]||'待确认');
function orderList(){const rows=s.orders.filter(o=>ui.ordersTab==='all'||o.type===ui.ordersTab);return rows.length?rows.map(o=>`<div class="order-card"><div class="row between"><div class="row"><h3>${o.type==='recharge'?'积分充值':esc(o.title)}</h3></div><span class="tag ${o.fulfilled?'green':'warn'}">${orderStatus(o)}</span></div><div class="divider"></div>${kv('付款时间',date(o.paidAt))}${kv(o.paidAt?'付款金额':'应付金额','¥'+fmt(o.amount))}${kv('消费行为',o.type==='recharge'?'充值 '+fmt(o.amount*10)+' 积分':'订阅'+esc(o.title))}${kv(o.type==='recharge'?'充值结果':'开通结果',o.fulfilled?(o.type==='recharge'?'已到账':'已开通'):o.paidAt?'处理中':'未'+(o.type==='recharge'?'充值':'开通'))}<p class="caption">订单号 ${esc(orderNumber(o))}</p>${btn('查看订单','order','',`data-id="${o.id}"`)}</div>`).join(''):empty('暂无订单',hasPoints?'订阅会员或充值积分后，可在这里查看。':'订阅会员后，可在这里查看。',`<div class="button-row gap">${btn('查看会员','benefits','secondary')}${hasPoints?btn('充值积分','recharge','primary'):''}</div>`);}
function paymentPage(){const o=selectedOrder();if(!o)return `<div class="page">${empty('订单不存在','请返回我的订单查看。',btn('我的订单','orders','secondary'))}</div>`;const done=o.fulfilled, processing=o.status==='paid'&&!done, bad=['failed','cancelled'].includes(o.status);return `<div class="page"><div class="result-mark ${bad?'error':done?'':'pending'}">${done?'✓':bad?'!':'…'}</div><h2 class="result-title">${orderStatus(o)}</h2><p class="result-description">${done?(o.type==='recharge'?`${fmt(o.amount*10)} 元藏积分已到账`:'元藏会员已开通'):processing?'付款已成功，请等待处理结果，无需重复支付':o.status==='pending'?'请完成支付':'本次未付款，可重新发起支付'}</p><div class="panel">${kv('消费行为',o.type==='recharge'?'元藏积分充值':esc(o.title))}${kv(o.paidAt?'付款金额':'应付金额','¥'+fmt(o.amount))}${kv('付款时间',date(o.paidAt))}${kv('订单号',esc(orderNumber(o)))}${kv(o.type==='recharge'?'充值结果':'开通结果',done?'已完成':processing?'处理中':'未完成')}</div>${processing?btn('刷新处理结果','refresh-order','primary block gap'):done?btn(ui.returnIntent?.kind==='download'?'返回下载确认':ui.returnIntent?.kind==='search'?'返回检索确认':o.type==='membership'&&ui.returnIntent?.kind==='marks'?'返回款识库':'完成，返回我的订单','return-source','primary block gap'):btn('重新支付','retry-payment','primary block gap')}${btn('查看我的订单','orders','secondary block gap')}${done&&hasPoints?btn('查看积分明细','points','plain block small'):''}</div>`;}
const statusName=t=>({running:'下载中',success:'已完成',failed:'下载失败',stopped:'已停止',settling:hasPoints?'费用确认中':'额度确认中'}[t.status]);
function taskCard(t){return `<div class="task-card"><div class="row"><img class="task-thumb" src="${t.image}" alt=""><div class="flex"><strong class="clamp2">${esc(t.title)}</strong><span class="caption">${date(t.time)}</span></div></div><div class="row between gap"><span class="tag ${t.status==='success'?'green':t.status==='failed'?'warn':''}">${statusName(t)}</span><span class="caption">${t.files.filter(f=>f.done).length}/${t.files.length} 张</span></div><p class="caption small-gap">${t.settled?(settledUsage(t)):t.status==='settling'?'下载已完成，正在结算':'所选图片尚未完成'}</p>${btn('查看任务','task','secondary block small gap',`data-id="${t.id}"`)}</div>`;}
function taskContent(t){const n=t.files.filter(f=>f.done).length;return `<div class="quote-object"><img src="${t.image}" alt=""><div class="flex"><strong>${esc(t.title)}</strong><p class="caption">所选图片 ${t.files.length} 张 · 原始文件</p></div></div><div class="row between gap"><div class="progress-number">${t.percent}<small>%</small></div><span class="tag ${t.status==='failed'?'warn':'green'}">${statusName(t)}</span></div><div class="progress-track" role="progressbar" aria-label="所选图片下载进度" aria-valuenow="${t.percent}" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill ${t.status==='failed'?'failed':''}" style="width:${t.percent}%"></div></div><div class="row between caption"><span>已保存 ${n}/${t.files.length} 张</span><span>${t.percent===98?'正在保存原文件':t.status==='running'?'正在下载原文件':''}</span></div>${t.files.map(f=>`<div class="file-row"><span class="file-format">${f.format}</span><div class="flex"><strong>${f.name}</strong><p class="caption">${(f.bytes/1000000).toFixed(2)} MB</p></div><span class="${f.done?'saved-label':'caption'}">${f.done?'已保存':t.status==='failed'?'未完成':t.status==='running'?'处理中':'未完成'}</span></div>`).join('')}<div class="notice gap">${t.settled?(`全部下载成功，${settledUsage(t)}。${quotaCounts(s.remaining,s.monthlyRemaining)}${t.cost?' 当前余额 '+fmt(s.balance)+' 积分。':''}`):t.status==='settling'?'图片已全部保存，正在结算。':t.status==='failed'||t.status==='stopped'?`${esc(t.failReason||'下载已停止')}。本次${t.cost?'扣除的积分已返还。':''}${t.freeCount?'下载额度已返还。':''}已保存的图片会保留。`:'本次下载已扣除相应权益。'}</div>`;}
function taskActions(t){return t.status==='running'?`<div class="button-row">${btn('停止下载','stop-task','secondary')}${btn('收起进度','hide-progress')}</div>`:t.status==='failed'||t.status==='stopped'?`<div class="button-row">${btn('查看记录','downloads','secondary')}${btn('重试未完成图片','retry-task')}</div>`:t.status==='settling'?btn('查询结算结果','settle-task','primary block'):`<div class="button-row">${btn('查看记录','downloads','secondary')}${btn('完成','finish-download')}</div>`;}
function taskPage(){const t=activeTask();return t?`<div class="page">${taskContent(t)}</div><div class="sticky-action">${taskActions(t)}</div>`:`<div class="page">${empty('暂无任务','请从下载记录打开任务。',btn('下载记录','downloads','secondary'))}</div>`;}
function settledUsage(task) {
  const uses = [];
  if (task.freeCount) uses.push(`使用 ${task.freeCount} 张免费额度`);
  if (task.cost) uses.push(`扣除 ${task.cost} 积分`);
  return uses.join('，');
}
function rules() {
  const pointsRules = `<div class="divider"></div><h3>积分下载与充值</h3>
    <p class="caption gap">系统先使用会员免费额度。超出的图片逐张计费：小于 2MB 为 1 积分，2MB 至不足 10MB 为 2 积分，10MB 至 50MB 为 5 积分。免费额度优先覆盖积分价较高的图片。</p>
    <p class="caption gap">1 元 = 10 元藏积分。余额不足时可充值，完成后回到下载确认。</p>
    <div class="divider"></div><h3>检索</h3><p class="caption gap">免费检索额度由系统判断，额度用完后 1 次检索使用 1 积分。</p>`;
  return `<div class="panel gap"><h3>会员下载额度</h3>
    <p class="caption gap">会员每日 10 张、每月最多 100 张，下载时同时扣减日、月额度。普通注册用户无免费额度。${hasPoints?'':'任一额度用完后，等待该额度恢复。'}</p>
    <p class="caption gap">每日 0 点、每月 1 日按北京时间重置。续费沿用当期已用额度。</p>
    ${hasPoints?pointsRules:''}<div class="divider"></div><h3>下载与保存</h3>
    <p class="caption gap">单张超过 50MB 暂不可下载。点击确认下载时扣除额度，失败或停止后返还。下载文件保留原格式，可能包含 TIFF。</p></div>`;
}
function quotaNotice() {
  if (!s.member) return hasPoints ? '普通注册用户可使用积分下载。开通会员可获得免费额度。' : '开通元藏会员后可下载图片。';
  if (!s.monthlyRemaining) return hasPoints ? '本月免费额度已用完，本次按张计费。' : '本月下载额度已用完，下月 1 日恢复。';
  if (!s.remaining) return hasPoints ? '今日免费额度已用完，本次按张计费。' : '今日下载额度已用完，明日 0 点恢复。';
  return hasPoints ? '优先使用免费额度，超出的图片按张扣积分。' : '请在今日和本月剩余额度内选图。';
}
function quotaCounts(day,month) {
  return `<div class="quota-counts"><span>本日剩余：<strong>${day}</strong> 张</span><span>本月剩余：<strong>${month}</strong> 张</span></div>`;
}
function selectionSheet() {
  const limits = quota(s);
  const selected = ui.selectedImages.length;
  const q = selected ? quote(s,ui.selectedImages) : null;
  const exhausted = !hasPoints && !limits.available;
  const images = manifest();
  const downloadableCount = images.filter(file => file.bytes <= 50000000).length;
  const thumbnails = images.map(file => {
    const oversized = file.bytes > 50000000;
    const checked = ui.selectedImages.includes(file.id);
    const disabled = oversized || exhausted;
    const line = q?.files?.find(item => item.id === file.id);
    const detail = oversized ? '超过 50MB，如需下载请联系我们' : hasPoints && line ? (line.covered ? '使用免费额度' : line.cost+' 积分') : '';
    return `<label class="pick-image ${disabled?'unavailable':''} ${checked?'checked':''}">
      <img src="${file.thumbnail}" alt="${file.name}缩略图" loading="lazy">
      <div class="pick-info"><strong>${file.name}</strong><span class="caption">${(file.bytes/1000000).toFixed(2)} MB · ${file.format}</span>${detail?`<span class="caption">${detail}</span>`:''}</div>
      <input type="checkbox" data-image-id="${file.id}" aria-label="选择${file.name}" ${checked?'checked':''} ${disabled?'disabled':''}>
    </label>`;
  }).join('');
  const body = `${hasPoints || !s.member ? `<div class="notice">${quotaNotice()}</div>` : ''}<div class="row between gap"><strong>藏品图片 · ${images.length} 张</strong>
    ${!exhausted && (hasPoints || limits.available >= downloadableCount)?btn('全选可下载图片','select-all','inline-link'):''}</div>
    <div class="image-picker">${thumbnails}</div>`;
  const overQuota = q?.blocked === 'quota';
  const message = overQuota ? `本次最多可下载 ${limits.available} 张，请减少选择。` : q?.blocked==='balance' ? '余额不足，继续后可充值。' : exhausted && s.member ? quotaNotice() : '';
  const covered = q?.freeCount || 0;
  const remaining = quotaCounts(limits.day-covered,limits.month-covered);
  const breakdown = hasPoints && q ? kv('使用免费额度 / 扣除积分',q.freeCount+' 张 / '+q.cost+' 积分') : '';
  const action = exhausted ? (s.member ? btn('我知道了','close','primary block') : btn('查看会员权益','benefits','primary block'))
    : btn('下一步 · '+selected+' 张','confirm-images','primary block',!q||overQuota?'disabled':'');
  const footer = `<div class="quota-summary"><div class="caption">${selected?'确认下载后预计剩余':'当前下载额度'}</div>${remaining}${breakdown}${message?`<p class="form-error" role="status">${message}</p>`:''}</div>${action}`;
  return sheet('选择下载图片',body,footer);
}
function confirmationSheet(q) {
  const n = q.files.length;
  const item = current();
  const heading = `<div class="quote-object"><img src="${item.image}" alt=""><div class="flex"><strong>${esc(item.title)}</strong><p class="caption">${q.size} · 原始文件</p></div></div>`;
  const counts = kv('本次下载',n+' 张') + kv('使用免费额度',q.freeCount+' 张') +
    '<div class="caption gap">确认下载后</div>' + quotaCounts(q.limits.day-q.freeCount,q.limits.month-q.freeCount);
  const payment = hasPoints && q.cost ? q.files.map(file => kv(esc(file.name),file.covered?'免费额度':file.cost+' 积分')).join('') +
    `<div class="quote-price"><span>本次扣除积分</span><strong>${q.cost}</strong></div>${kv('可用积分',fmt(availableBalance(s))+' 积分')}` : '';
  const footer = `<div class="button-row">${btn('返回选图','edit-images','secondary')}${btn('确认下载','confirm-download')}</div>`;
  return sheet('确认图片下载',heading+counts+payment+'<p class="caption gap">确认下载时扣除，失败或停止后返还。</p>',footer);
}

function openModal(type,payload={}){modalFocus=document.activeElement;ui.modal={type,...payload};renderModal();}
function closeModal(){ui.modal=null;$('#overlay-root').innerHTML='';$('#screen').inert=false;$('#tabbar').inert=false;$('#app-header').inert=false;if(modalFocus?.isConnected)modalFocus.focus();}
function sheet(title,body,footer,center=false){return `<div class="overlay ${center?'center':''}"><section class="${center?'modal':'sheet'}" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div class="sheet-header"><h2 id="dialog-title">${title}</h2>${btn(icon('close'),'close','icon-button','aria-label="关闭"')}</div><div class="sheet-body">${body}</div><div class="sheet-footer">${footer}</div></section></div>`;}
function renderModal(){
  const m=ui.modal;if(!m)return;let h='';const c=current();
  const previousScroll=$('.sheet-body')?.scrollTop||0;
  const focusedAction=$('#overlay-root')?.contains(document.activeElement)?document.activeElement.dataset.action:null;
  if(m.type==='permission')h=sheet('保存图片到手机',`<div class="authorization-symbol">${icon('image')}</div><p>为保存藏品图片，需要使用设备支持的相册或文件保存权限。</p><p class="caption gap">拒绝后，本次下载取消。</p>`,`<div class="button-row">${btn('拒绝','deny-permission','secondary')}${btn('允许并继续','allow-permission')}</div>`,true);
  if(m.type==='denied')h=sheet('未获得保存权限','<p>本次下载未开始。你可以在需要时开启保存权限，再返回下载。</p>',`<div class="button-row">${btn('取消','close','secondary')}${btn('开启权限','allow-permission')}</div>`,true);
  if(m.type==='loading')h=sheet('获取下载信息','<div class="loading-box"><div class="spinner"></div>正在确认图片清单、大小与费用…</div>',btn('取消','close','secondary block'));
  if(m.type==='download-error')h=sheet('暂时无法下载',`<p>${esc(m.message)}</p><p class="caption gap">下载尚未开始。</p>`,`<div class="button-row">${btn('取消','close','secondary')}${btn('重试','retry-quote')}</div>`,true);
  if(m.type==='unavailable')h=sheet('图片暂不可下载',`<p>${esc(m.message)}</p><p class="caption gap"></p>`,btn('我知道了','close','primary block'),true);
  if(m.type==='selection')h=selectionSheet();
  if(m.type==='quote')h=confirmationSheet(m.quote);
  if(m.type==='insufficient'){const isSearch=m.kind==='search',p=isSearch?1:m.quote.cost;h=sheet(isSearch?'检索积分不足':'下载积分不足',`<p>${isSearch?'免费检索额度已用完。':`本次选择 ${m.quote.files.length} 张，免费额度覆盖 ${m.quote.freeCount} 张。`}</p><div class="panel gap">${kv('本次所需',p+' 积分')}${kv('当前可用',s.balance+' 积分')}${kv('还需',Math.max(0,p-s.balance)+' 积分')}</div><p class="caption gap">充值比例为 1 元 = 10 积分，充值后返回确认，不自动下载或扣费。</p>`,`<div class="button-row">${!s.member?btn('查看会员','plans','secondary'):btn('取消','close','secondary')}${btn('充值积分','recharge')}</div>`,true);}
  if(m.type==='progress'){const t=activeTask();if(t)h=sheet('图片下载',taskContent(t),taskActions(t));}
  if(m.type==='search-confirm')h=sheet('使用积分检索',`<p>免费检索额度已用完，本次检索将使用 <strong>1 元藏积分</strong>。</p><div class="notice gap">${esc(ui.queryDraft||'当前筛选条件')}</div>${kv('当前可用',fmt(s.balance)+' 积分')}<p class="caption gap">同次检索翻页、切换馆藏与档案页签不重复扣费。不解锁会员全文或高清浏览权益。</p>`,`<div class="button-row">${btn('取消','close','secondary')}${btn('使用 1 积分检索','confirm-search')}</div>`,true);
  if(m.type==='search-exhausted')h=sheet('检索额度已用完','<p>请稍后再试。</p>',btn('我知道了','close','primary block'),true);
  if(m.type==='search-error')h=sheet('检索暂不可用','<p>暂时无法获取检索权益，请稍后重试。当前结果与筛选条件已保留。</p><p class="caption gap">本次未发起付费检索。</p>',`<div class="button-row">${btn('取消','close','secondary')}${btn('重试','retry-search')}</div>`,true);
  if(m.type==='payment'){const o=selectedOrder();h=sheet('确认支付',`<div class="lead gap">¥${fmt(o.amount)}</div><p class="caption">${o.type==='recharge'?'元藏积分充值 · '+fmt(o.amount*10)+' 积分':esc(o.title)}</p>`,`<div class="button-row">${btn('取消支付','payment-cancel','secondary')}${btn('立即支付','payment-success')}</div>${ui.reviewMode?`<div class="button-row small-gap">${btn('支付失败','payment-fail','plain small')}${btn('已付款，到账延迟','payment-delay','plain small')}</div>`:''}`,true);}
  if(m.type==='rules')h=sheet('元藏积分使用说明',rules(),btn('我已了解','close','primary block'));
  if(m.type==='login-rules')h=sheet('协议与隐私说明','<p>登录后可管理收藏、会员和下载记录。账户与下载状态保存在当前浏览器。</p>',btn('我已了解','close','primary block'));
  if(m.type==='filters')h=filterSheet();
  if(m.type==='member-gate')h=sheet('高清浏览需要会员','<p>开通会员可查看授权高清图片与原始元数据。</p>',`<div class="button-row">${btn('取消','close','secondary')}${btn('查看会员权益','benefits')}</div>`,true);
  $('#overlay-root').innerHTML=h;$('#screen').inert=true;$('#tabbar').inert=true;$('#app-header').inert=true;
  if(m.type==='progress'){
    if($('.sheet-body'))$('.sheet-body').scrollTop=previousScroll;
    const focusTarget=focusedAction?$('#overlay-root [data-action="'+focusedAction+'"]'):null;
    focusTarget?.focus({preventScroll:true});
  }else $('#overlay-root button')?.focus({preventScroll:true});
}
const filterData={'分类':['瓷器','书画','玉器','青铜器'],'朝代时期':['近现代','清','明','元','金','辽','宋','五代十国','唐','隋','魏晋南北朝','汉','秦','战国','春秋','周','商','夏','其他'],'国家/地区':['安和','北辰','东序','南溪','云岚'],'馆藏机构':['安和','北辰','东序','南溪','云岚'],'来源':['造办处活计档','清宫瓷器档','内务府奏销档'],'年号':['乾隆','雍正','康熙']};
function filterSheet(){const f=ui.filterSection,values=filterData[f]||filterData['分类'],alpha=['国家/地区','馆藏机构'].includes(f);const opt=v=>btn(`<span>${v}</span><input type="checkbox" tabindex="-1" ${ui.draftFilters.includes(v)?'checked':''} aria-hidden="true">`,'filter-option','check-option',`data-value="${v}"`);const letters=['A','B','D','N','Y'];return sheet('选择'+f,`${alpha?`<input id="filter-query" class="block" placeholder="搜索${f}" value="${esc(ui.filterQuery)}" aria-label="搜索筛选项"><div class="alphabet-list gap"><div class="alphabet-index">${letters.map(l=>btn(l,'letter','',`data-letter="${l}"`)).join('')}</div><div id="filter-options">${values.map((v,i)=>v.includes(ui.filterQuery)?`<div id="letter-${letters[i]}"><div class="letter-heading">${letters[i]}</div>${opt(v)}</div>`:'').join('')||'<p class="caption gap">暂无匹配选项</p>'}</div></div>`:`<div class="filter-options">${values.map(v=>btn(v,'filter-option',ui.draftFilters.includes(v)?'active':'',`data-value="${v}"`)).join('')}</div>`}<p class="caption gap">已选 ${ui.draftFilters.length} 项 · 确认后应用到检索条件</p>`,`<div class="button-row">${btn('重置本项','reset-filter','secondary')}${btn('查看结果','apply-filter')}</div>`);}

function beginDownload(){
  if(!ensureLogin({kind:'download'}))return;
  const running=s.tasks.find(t=>['running','settling'].includes(t.status));
  if(running){ui.selectedTask=running.id;openModal('progress');return;}
  ui.selectedImages=[];ui.confirmedQuote=null;loadQuote();
}
function loadQuote(){openModal('loading');setTimeout(()=>{if(ui.modal?.type!=='loading')return;try{const q=quote(s);if(q.unavailable)openModal('unavailable',{message:q.unavailable});else openModal('selection');}catch(e){openModal('download-error',{message:e.message});}},250);}
function confirmImages() {
  const q = quote(s,ui.selectedImages);
  if (q.unavailable) { openModal('unavailable',{message:q.unavailable}); return; }
  if (q.blocked==='quota') { openModal('selection'); return; }
  if (q.blocked==='balance') {
    ui.returnIntent={kind:'download',item:ui.item,images:[...ui.selectedImages]};
    openModal('insufficient',{kind:'download',quote:q});
    return;
  }
  ui.confirmedQuote=q;
  if (!s.authorized) { openModal('permission'); return; }
  openModal('quote',{quote:q});
}
function confirmDownload() {
  if (!s.authorized) { openModal('permission'); return; }
  startDownload();
}
function startDownload() {
  const fresh=quote(s,ui.selectedImages);
  if (!fresh.affordable || !ui.confirmedQuote || !sameQuote(ui.confirmedQuote,fresh)) {
    confirmImages();
    return;
  }
  const task=createTask(s,fresh,current().title,current().image);
  task.collectionId=current().id;
  ui.selectedTask=task.id;
  ui.returnIntent=null;
  openModal('progress');startTimer(task);save();syncPanel();
}
function markFileSaved(file) {
  if (file.done) return;
  file.done=true;
  file.savedAt=new Date().toISOString();
}
function startTimer(t){clearInterval(workTimer);workTimer=setInterval(()=>{
  if(t.status!=='running'){clearInterval(workTimer);return;}
  t.percent=Math.min(98,t.percent+7);t.files.forEach((f,i)=>{if(i<t.files.length-1 && t.percent>=(i+1)*90/t.files.length)markFileSaved(f);});
  if(t.percent>=70&&['partial','unsupported'].includes(t.scenario)){failTask(s,t,t.scenario==='unsupported'?'当前设备无法保存接口返回的原文件':'补充视图下载失败');clearInterval(workTimer);}
  else if(t.percent>=98){clearInterval(workTimer);setTimeout(()=>{if(t.status!=='running'||!s.tasks.includes(t))return;t.files.forEach(markFileSaved);t.percent=100;t.status='settling';if(t.scenario!=='settling')finishTask(s,t);updateTask(t);},650);}
  updateTask(t);
},230);}
function updateTask(task){
  if(task && !hasPoints){
    try{saveQuotaDownloadRecord(task);}catch{if(!task.auditError){task.auditError=true;toast('浏览器未能保存后台记录');}}
  }
  save();syncPanel();
  if(ui.modal?.type==='progress')renderModal();
  else if(ui.page==='task'||ui.page==='downloads')$('#screen').innerHTML=pages[ui.page]();
}
function submitSearch(){if(ui.searching)return;if(!ui.queryDraft.trim()&&!ui.filters.length){toast('请输入关键词或选择筛选条件');return;}if(!ensureLogin({kind:'search'}))return;try{const result=searchEntitlement(s);if(result==='free')runSearch(false);else if(result==='confirm')openModal('search-confirm');else if(result==='exhausted')openModal('search-exhausted');else{ui.returnIntent={kind:'search'};openModal('insufficient',{kind:'search'});}}catch{openModal('search-error');}}
function runSearch(paid){closeModal();if(ui.searching)return;ui.searching=true;const query=ui.queryDraft.trim()||ui.filters.join('、');const key='S'+Date.now();navigate('search',ui.page==='search');clearTimeout(searchTimer);searchTimer=setTimeout(()=>{try{if(paid)chargeSearch(s,key,query);ui.query=query;ui.searchCompleted=true;ui.noResults=s.searchStatus==='empty';ui.searchFee=paid?1:0;ui.loaded=4;ui.returnIntent=null;}catch(e){toast(e.message);}ui.searching=false;render();},500);}
function resetScenario(value){clearInterval(workTimer);clearTimeout(searchTimer);closeModal();s=initial(value,edition);ui.selectedTask=null;ui.selectedOrder=null;ui.returnIntent=null;ui.searching=false;ui.searchCompleted=false;ui.searchFee=0;ui.noResults=false;render();toast('已切换体验状态');}
function returnSource(){if(!selectedOrder()?.fulfilled){toast('请等待订单处理完成');return;}const intent=ui.returnIntent;if(intent?.kind==='download'){ui.item=intent.item;ui.selectedImages=intent.images;navigate('detail');confirmImages();}else if(intent?.kind==='search'){navigate('search');submitSearch();}else if(intent?.kind==='marks'&&selectedOrder().type==='membership'){ui.marksWall=intent.wall;ui.returnIntent=null;navigate('marks');}else navigate('orders');}
function validateAmount(){const value=String(ui.recharge),amount=Number(value);const valid=/^[1-9]\d*$/.test(value)&&Number.isSafeInteger(amount*10);if($('#amount-error'))$('#amount-error').textContent=valid?'':'请输入有效的正整数金额';if($('#credited-points'))$('#credited-points').textContent=valid?fmt(amount*10)+' 积分':'—';if($('#pay-amount'))$('#pay-amount').textContent=valid?'¥'+fmt(amount):'—';if($('#recharge-submit')){$('#recharge-submit').disabled=!valid||!ui.agreement;$('#recharge-submit').textContent=valid?'确认充值 ¥'+fmt(amount):'请输入充值金额';}return valid;}

const actions={
  back,home:()=>navigate('home'),list:()=>navigate('list'),archives:()=>navigate('archives'),profile:()=>navigate('profile'),marks:()=>{ui.marksWall=null;ui.marksFixture=false;navigate('marks');},library:()=>navigate('library'),
  'review-page':el=>{const p=el.dataset.page;if(['points','orders','downloads'].includes(p)){navigateAccount(p);return;}if(p==='search'){ui.queryDraft='青瓷';ui.query='青瓷';}navigate(p);},
  item:el=>{ui.item=Number(el.dataset.index||0);ui.image=0;ui.detailTab='basic';navigate('detail');},thumb:el=>{ui.image=Number(el.dataset.index);render();},
  viewer:()=>{if(!ensureLogin({kind:'viewer'}))return;if(!s.member){openModal('member-gate');return;}ui.zoom=1;navigate('viewer');},
  'zoom-in':()=>{ui.zoom=Math.min(3,ui.zoom+.5);render();},'zoom-out':()=>{ui.zoom=Math.max(1,ui.zoom-.5);render();},'zoom-reset':()=>{ui.zoom=1;render();},'prev-image':()=>{ui.image=1-ui.image;render();},'next-image':()=>{ui.image=1-ui.image;render();},
  'detail-tab':el=>{ui.detailTab=el.dataset.tab;render();},favorite:()=>{if(!ensureLogin({kind:'favorite'}))return;const id=current().id;s.saved=s.saved.includes(id)?s.saved.filter(x=>x!==id):[...s.saved,id];render();toast(s.saved.includes(id)?'已收藏':'已取消收藏');},share:shareCollection,favorites:()=>navigateAccount('favorites'),
  download:beginDownload,'confirm-images':confirmImages,'confirm-download':confirmDownload,'edit-images':()=>openModal('selection'),'select-all':()=>{const all=manifest().filter(f=>f.bytes<=50000000).map(f=>f.id);ui.selectedImages=ui.selectedImages.length===all.length?[]:all;renderModal();},'allow-permission':()=>{s.authorized=true;save();confirmImages();},'deny-permission':()=>{s.authorized=false;openModal('denied');},'retry-quote':loadQuote,
  'stop-task':()=>{const t=activeTask();if(t?.status==='running'){clearInterval(workTimer);failTask(s,t,'用户已停止下载','stopped');updateTask();}},
  'hide-progress':()=>{closeModal();toast('进度已收起，可在下载记录中查看');},'retry-task':()=>{const t=activeTask();retryTask(s,t);if(ui.page!=='task')openModal('progress');startTimer(t);updateTask();},
  'settle-task':()=>{const t=activeTask();finishTask(s,t);updateTask(t);},'finish-download':()=>{closeModal();if(ui.page==='task')navigate('detail');else render();},
  downloads:()=>navigateAccount('downloads'),task:el=>{ui.selectedTask=el.dataset.id;navigate('task');},
  points:()=>navigateAccount('points'),recharge:()=>{if(!hasPoints)return;ui.agreement=false;ui.custom=false;ui.recharge=10;navigateAccount('recharge');},
  amount:el=>{ui.recharge=Number(el.dataset.value);ui.custom=false;render();validateAmount();},'ledger-tab':el=>{ui.ledgerTab=el.dataset.value;render();},
  'pay-recharge':()=>{if(!validateAmount()||!ui.agreement)return;const o=createOrder(s,'recharge',Number(ui.recharge),'元藏积分充值');ui.selectedOrder=o.id;navigate('payment');openModal('payment');},
  benefits:()=>navigate('benefits'),membership:()=>navigateAccount('membership'),plans:()=>navigateAccount('plans'),plan:el=>{ui.plan=el.dataset.value;render();},checkout:()=>navigateAccount('checkout'),
  'pay-membership':()=>{const o=createOrder(s,'membership',ui.plan==='monthly'?30:298,ui.plan==='monthly'?'月会员':'年会员');ui.selectedOrder=o.id;navigate('payment');openModal('payment');},
  'payment-success':()=>completePayment('success'),'payment-fail':()=>completePayment('fail'),'payment-cancel':()=>completePayment('cancel'),'payment-delay':()=>completePayment('delay'),
  'retry-payment':()=>openModal('payment'),'refresh-order':()=>{payOrder(s,selectedOrder(),'success');render();toast('处理结果已更新');},'return-source':returnSource,
  orders:()=>navigateAccount('orders'),'orders-tab':el=>{ui.ordersTab=el.dataset.value;render();},order:el=>{ui.selectedOrder=el.dataset.id;navigate('payment');},
  close:()=>{if(ui.modal?.type==='payment'){completePayment('cancel');return;}closeModal();},
  'recharge-rules':()=>openModal('rules'),agreement:()=>navigate('agreement'),'login-rules':()=>openModal('login-rules'),
  login:()=>{ui.returnIntent={kind:'page',page:'profile'};navigate('login');},'login-confirm':()=>{if(!$('#login-agreement')?.checked)return;s.logged=true;const intent=ui.returnIntent;ui.returnIntent=null;save();if(intent?.kind==='download'){navigate('detail');beginDownload();}else if(intent?.kind==='search'){navigate('search');submitSearch();}else if(intent?.kind==='viewer'){navigate('detail');actions.viewer();}else if(intent?.kind==='favorite'){navigate('detail');actions.favorite();}else if(intent?.kind==='marks'){ui.returnIntent=intent;navigate('plans',true);}else navigate(intent?.page||'profile');},
  logout:()=>{if(s.tasks.some(t=>['running','settling'].includes(t.status))){toast('请先停止下载或确认任务结算');return;}s.logged=false;s.authorized=false;render();},
  word:el=>{ui.queryDraft=el.dataset.word;ui.source='collection';submitSearch();},'confirm-search':()=>runSearch(true),'retry-search':submitSearch,'focus-search':()=>$('#query')?.focus(),
  source:el=>{ui.source=el.dataset.value;render();},'load-more':()=>{ui.loaded=8;const top=$('#screen').scrollTop;render();$('#screen').scrollTop=top;},
  filters:el=>{ui.filterSection=el.dataset.section;ui.draftFilters=[...ui.filters];ui.filterQuery='';openModal('filters');},
  'filter-option':el=>{const v=el.dataset.value;ui.draftFilters=ui.draftFilters.includes(v)?ui.draftFilters.filter(x=>x!==v):[...ui.draftFilters,v];const scroll=$('.sheet-body')?.scrollTop;renderModal();if($('.sheet-body'))$('.sheet-body').scrollTop=scroll;},
  'reset-filter':()=>{ui.draftFilters=ui.draftFilters.filter(v=>!filterData[ui.filterSection].includes(v));renderModal();},
  'apply-filter':()=>{ui.filters=[...ui.draftFilters];closeModal();render();if(ui.filters.length||ui.queryDraft.trim())submitSearch();},
  'remove-filter':el=>{ui.filters=ui.filters.filter(x=>x!==el.dataset.value);render();if(ui.filters.length||ui.queryDraft.trim())submitSearch();else{ui.searchCompleted=false;ui.noResults=false;render();}},
  letter:el=>$('#letter-'+el.dataset.letter)?.scrollIntoView({block:'nearest'}),
  reset:()=>resetScenario($('#scenario').value),settings:()=>$('.review-panel').classList.toggle('mobile-open'),
};
function completePayment(result){const o=selectedOrder();if(!o)return;payOrder(s,o,result);closeModal();render();}
document.addEventListener('click',e=>{const el=e.target.closest('[data-action]');if(!el||el.disabled)return;e.preventDefault();try{actions[el.dataset.action]?.(el);save();syncPanel();}catch(error){toast(error.message||'操作未完成，请重试');}});
document.addEventListener('submit',e=>{if(e.target.id==='search-form'){e.preventDefault();ui.queryDraft=$('#query').value;submitSearch();}});
document.addEventListener('input',e=>{if(e.target.id==='query')ui.queryDraft=e.target.value;if(e.target.id==='custom-amount'){ui.custom=true;ui.recharge=e.target.value;document.querySelectorAll('.recharge-choice').forEach(el=>el.classList.remove('active'));validateAmount();}if(e.target.id==='filter-query'){ui.filterQuery=e.target.value;const cursor=e.target.selectionStart;renderModal();const input=$('#filter-query');input.focus();input.setSelectionRange(cursor,cursor);}});
document.addEventListener('change',e=>{if(e.target.dataset.imageId){const id=e.target.dataset.imageId;ui.selectedImages=e.target.checked?[...ui.selectedImages,id]:ui.selectedImages.filter(x=>x!==id);const top=$('.sheet-body')?.scrollTop||0;renderModal();if($('.sheet-body'))$('.sheet-body').scrollTop=top;}if(e.target.id==='scenario')resetScenario(e.target.value);if(e.target.id==='search-state'){s.searchStatus=e.target.value;save();toast('检索接口状态已切换');}if(e.target.id==='download-state'){s.downloadStatus=e.target.value;save();toast('新下载将使用该状态');}if(e.target.id==='recharge-agreement'){ui.agreement=e.target.checked;validateAmount();}if(e.target.id==='login-agreement')$('#login-submit').disabled=!e.target.checked;});
document.querySelectorAll('[data-width]').forEach(b=>b.addEventListener('click',()=>{document.documentElement.style.setProperty('--phone-width',b.dataset.width+'px');document.querySelectorAll('[data-width]').forEach(x=>x.classList.toggle('selected',x===b));}));
document.addEventListener('keydown',e=>{if(ui.modal){if(e.key==='Escape'){e.preventDefault();actions.close();}if(e.key==='Tab'){const focusable=[...$('#overlay-root').querySelectorAll('button:not([disabled]),input:not([disabled]),[tabindex="0"]')];const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}else if((e.key==='Enter'||e.key===' ')&&e.target.matches('[role="button"][data-action]')){e.preventDefault();e.target.click();}});
window.addEventListener('beforeunload',()=>save());

// Review presets only seed deterministic demo data; they never invoke real services.
function applyReviewScene(id) {
  const scene=editionScenes.find(v=>v.id===id);if(!scene)return;
  clearInterval(workTimer);clearTimeout(searchTimer);clearTimeout(toastTimer);$('#toast').classList.remove('show');closeModal();
  const c=scene.config;
  s=initial(c.scenario||'member',edition);
  s.authorized=true;
  ui.selectedImages=c.selected||['original-1','original-2'];
  ui.confirmedQuote=null;
  Object.assign(ui,{reviewMode:true,page:scene.page,stack:[],item:0,image:0,detailTab:'basic',searching:false,searchCompleted:false,searchFee:0,noResults:false,recharge:10,custom:false,agreement:false,ordersTab:'all',ledgerTab:'all',selectedOrder:null,selectedTask:null,returnIntent:null,marksWall:c.marksWall||null,marksFixture:!!c.marksWall});
  if(c.emptyQuery){ui.query='';ui.queryDraft='';}
  render();$('#screen').scrollTop=0;
  if(c.toast){toast(c.toast);if(document.body.classList.contains('capture-mode')){clearTimeout(toastTimer);document.body.classList.add('capture-toast');}}
  if(c.modal){if(c.modal==='filters'){ui.filterSection=c.filter;ui.draftFilters=[filterData[c.filter][0]];}
    if (c.modal==='quote' || c.modal==='insufficient') confirmImages();
    else openModal(c.modal,{message:c.message||'暂时无法获取下载信息，请重试'});
  }
  if(scene.page==='recharge')validateAmount();
  const select=$('#review-scene');if(select)select.value=id;
  const label=$('#capture-label');if(label)label.textContent=id+' · '+scene.title+'｜元藏 · 本期需求评审';
  document.title=id+' '+scene.title+' · 元藏评审';
  if(document.body.classList.contains('capture-mode'))requestAnimationFrame(()=>{
    const floating=$('#overlay-root .sheet')||$('#overlay-root .modal');
    if(floating){$('#phone').style.height=Math.max(896,Math.ceil(floating.scrollHeight+100))+'px';}
    document.body.dataset.captureReady='true';
  });
}
const editionScenes=reviewScenes.filter(scene=>!scene.edition||scene.edition===edition);
const sceneSelect=$('#review-scene');
if(sceneSelect){sceneSelect.innerHTML='<option value="">选择本期页面 / 弹窗状态</option>'+editionScenes.map(v=>`<option value="${v.id}">${v.id} · ${v.title}</option>`).join('');sceneSelect.addEventListener('change',e=>applyReviewScene(e.target.value));}
const reviewParams=new URLSearchParams(location.search);
if(reviewParams.has('capture')){
  document.body.classList.add('capture-mode');
  if(editionScenes.find(v=>v.id===reviewParams.get('scene'))?.config.modal)document.body.classList.add('capture-overlay');
  $('#phone').insertAdjacentHTML('beforebegin','<div id="capture-label"></div>');
}
if(reviewParams.has('scene')){
  applyReviewScene(reviewParams.get('scene'));
  const item=Number(reviewParams.get('item'));
  if(reviewParams.get('scene')==='detail'&&Number.isInteger(item)&&items[item]){ui.item=item;render();}
}else render();

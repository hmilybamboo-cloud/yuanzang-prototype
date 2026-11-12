const asset = (name) => `assets/met-${name}.webp`;

// Image/object pairs come from The Met Open Access. See assets/manifest.json.
const kangxiImages = [
  { id: 42229, mark: '42229-2', object: '42229-0', title: '瓶', english: 'Vase', number: '14.40.377' },
  { id: 42230, mark: '42230-2', object: '42230-0', title: '笔洗', english: 'Brush Washer', number: '14.40.385' },
  { id: 52049, mark: '52049-1', object: '52049-0', title: '瓶', english: 'Vase', number: '14.40.372', markDescription: '器底青花书「大清康熙年制」楷书六字二行款，官窑年号款。' },
  { id: 49349, mark: '49349-4', object: '49349-0', title: '笔洗', english: 'Brush Washer', number: '29.100.352' },
  { id: 42363, mark: '42363-1', object: '42363-0', title: '瓶', english: 'Vase', number: '50.145.286' },
  { id: 42232, mark: '42232-2', object: '42232-0', title: '瓶', english: 'Vase', number: '14.40.374' },
  { id: 51221, mark: '51221-1', object: '51221-0', title: '水盂', english: 'Water coupe', number: '91.1.407' },
  { id: 42422, mark: '42422-1', object: '42422-0', title: '水罐', english: 'Water Jar', number: '66.206.11' },
  { id: 42423, mark: '42423-1', object: '42423-0', title: '印泥盒', english: 'Box for seal paste', number: '66.206.17' },
];
const qianlongImages = [
  { id: 53774, mark: '53774-6', object: '53774-0', title: '九桃天球瓶', english: 'Vase with nine peaches', number: '17.120.193' },
];
const chenghuaImages = [
  { id: 42515, mark: '42515-5', object: '42515-0', title: '鸡缸杯', english: 'Chicken cup', number: '1987.85' },
];
const yongzhengImages = [
  { id: 49358, mark: '49358-1', object: '49358-0', title: '碗', english: 'Bowl', number: '09.194.23' },
];

// Reuse credited images to exercise the 20-entry boundary without inventing catalog records.
const kangxiDemoImages = Array.from({ length: 15 }, (_, index) => ({
  ...kangxiImages[index % kangxiImages.length], demo: index + 1,
}));

const variants = {
  'chenghua-six': { id: 'chenghua-six', dynasty: '明', reign: '成化', title: '大明成化年制六字款', type: '六字款', glyph: '大明成化年制', images: chenghuaImages },
  'kangxi-four': { id: 'kangxi-four', dynasty: '清', reign: '康熙', title: '康熙年制四字款', type: '四字款', glyph: '康熙年制', images: [] },
  'kangxi-imperial': { id: 'kangxi-imperial', dynasty: '清', reign: '康熙', title: '康熙御制四字款', type: '四字款', glyph: '康熙御制', images: [] },
  'kangxi-kaishu': { id: 'kangxi-kaishu', dynasty: '清', reign: '康熙', title: '大清康熙年制楷书款', type: '六字 · 楷书', glyph: '大清康熙年制', images: kangxiImages },
  'kangxi-zhuanshu': { id: 'kangxi-zhuanshu', dynasty: '清', reign: '康熙', title: '大清康熙年制篆书款', type: '六字 · 篆书', glyph: '大清康熙年制', images: [] },
  'yongzheng-six': { id: 'yongzheng-six', dynasty: '清', reign: '雍正', title: '大清雍正年制六字款', type: '六字款', glyph: '大清雍正年制', images: yongzhengImages },
  'qianlong-zhuanshu': { id: 'qianlong-zhuanshu', dynasty: '清', reign: '乾隆', title: '大清乾隆年制篆书款', type: '六字 · 篆书', glyph: '大清乾隆年制', images: qianlongImages },
};
const periods = [
  { dynasty: '明', english: 'MING', reigns: [{ name: '宣德', ids: [] }, { name: '成化', ids: ['chenghua-six'] }, { name: '万历', ids: [] }] },
  { dynasty: '清', english: 'QING', reigns: [{ name: '康熙', ids: ['kangxi-four', 'kangxi-imperial', 'kangxi-kaishu', 'kangxi-zhuanshu'] }, { name: '雍正', ids: ['yongzheng-six'] }, { name: '乾隆', ids: ['qianlong-zhuanshu'] }] },
];

const timeline = document.querySelector('#timeline');
const search = document.querySelector('#markSearch');
const detailContent = document.querySelector('#detailContent');
const listScroll = document.querySelector('#listScroll');
const detailScroll = document.querySelector('#detailScroll');
const viewer = document.querySelector('#imageViewer');
const objectSheet = document.querySelector('#objectSheet');
const objectCover = document.querySelector('#objectCover');
const params = new URLSearchParams(location.search);
const isMember = window.parent !== window && params.get('member') === '1';
const initialWall = params.get('wall');
const previewLimit = 20;
let selectedId = Object.hasOwn(variants, initialWall) ? initialWall : 'kangxi-kaishu';
let viewerIndex = 0;
let toastTimer;

function galleryImages(variant) {
  return variant.id === 'kangxi-kaishu' ? [...variant.images, ...kangxiDemoImages] : variant.images;
}

function viewableImages(variant = variants[selectedId]) {
  const images = galleryImages(variant);
  return isMember ? images : images.slice(0, previewLimit);
}

const demoLabel = (entry) => `演示款识 ${String(entry.demo).padStart(2, '0')}`;

function toast(message) {
  const el = document.querySelector('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

function sampleGlyph(text) {
  return `<span class="sample-glyph" aria-hidden="true">${[...text].map((char) => `<span>${char}</span>`).join('')}</span><span class="sample-note">字样示意</span>`;
}

function renderTimeline() {
  const query = search.value.trim().toLowerCase();
  let ordinal = 0;
  const groups = periods.map((group) => {
    const years = group.reigns.map((reign) => {
      ordinal += 1;
      const reignMatch = reign.name.includes(query);
      const visibleIds = query && !reignMatch ? reign.ids.filter((id) => variants[id].title.toLowerCase().includes(query) || variants[id].type.toLowerCase().includes(query)) : reign.ids;
      if (query && !reignMatch && !visibleIds.length) return '';
      const featuredId = visibleIds.find((id) => variants[id].images.length);
      const feature = featuredId ? variants[featuredId] : null;
      const featureImages = feature?.images.slice(0, 3) || [];
      const mosaic = feature ? `<button class="feature-variant ${featureImages.length === 1 ? 'single' : ''}" type="button" data-variant="${featuredId}" aria-label="查看${feature.title}"><span class="feature-mosaic">${featureImages.map((entry) => `<img src="${asset(entry.mark)}" alt="${entry.title}器底款" loading="lazy" />`).join('')}</span><span class="feature-caption"><span><small>MARK IMAGES / 馆藏图谱</small><strong>${feature.title}</strong><em>${feature.images.length} 幅真实馆藏图像</em></span><span class="feature-arrow" aria-hidden="true">↗</span></span></button>` : '';
      const otherIds = visibleIds.filter((id) => id !== featuredId);
      const cards = otherIds.map((id) => {
        const variant = variants[id];
        return `<button class="variant-card ${selectedId === id ? 'selected' : ''}" type="button" data-variant="${id}" aria-label="查看${variant.title}"><span class="variant-thumb">${sampleGlyph(variant.glyph)}</span><span class="variant-info"><strong>${variant.title}</strong><small>${variant.type} · 图像待收录</small></span><span class="next" aria-hidden="true">›</span></button>`;
      }).join('');
      const body = visibleIds.length ? `${mosaic}${otherIds.length ? `<div class="variant-section-label">同年号其他款式 <span>${otherIds.length}</span></div><div class="variant-list">${cards}</div>` : ''}` : '<p class="axis-empty">可核对图像整理中</p>';
      return `<section class="axis-year" data-year="${reign.name}" data-dynasty="${group.dynasty}"><div class="axis-node" aria-hidden="true"></div><div class="axis-year-head"><span>${String(ordinal).padStart(2, '0')} / ${group.english}</span><h3>${reign.name}<small>${reign.ids.length ? `${reign.ids.length} 类章款` : '待收录'}</small></h3></div><div class="axis-year-body">${body}</div></section>`;
    }).join('');
    return years ? `<section class="axis-era"><div class="axis-era-title"><b>${group.dynasty}代</b><span>${group.english} DYNASTY</span></div><div class="axis-era-years">${years}</div></section>` : '';
  }).join('');
  timeline.innerHTML = groups || '<div class="search-empty"><b>没有找到相关章款</b><span>试试搜索“康熙”“乾隆”或“楷书”。</span></div>';
  requestAnimationFrame(updateCoordinate);
}

function updateCoordinate() {
  const years = Array.from(timeline.querySelectorAll('.axis-year'));
  const label = document.querySelector('#coordinateText');
  if (!years.length) { label.textContent = '暂无结果'; return; }
  const guide = listScroll.getBoundingClientRect().top + 100;
  let current = years[0];
  years.forEach((year) => { if (year.getBoundingClientRect().top <= guide) current = year; });
  years.forEach((year) => year.classList.toggle('is-current', year === current));
  label.textContent = `${current.dataset.dynasty}代 · ${current.dataset.year}`;
}

function renderDetail() {
  const variant = variants[selectedId];
  const first = variant.images[0];
  const intro = `<section class="detail-intro"><div class="breadcrumb">瓷器章款 <span>›</span> ${variant.dynasty}代 <span>›</span> ${variant.reign}</div><h1>${variant.title}</h1><p>同一款式，在不同器物上留下各自的笔意与布局。</p><div class="fact-row"><span>${variant.dynasty} · ${variant.reign}</span><span>${variant.type}</span><span>${first ? `${variant.images.length} 幅图像` : '图像整理中'}</span></div></section>`;
  if (!first) {
    detailContent.innerHTML = intro + `<section class="detail-empty"><div class="empty-panel"><div class="empty-symbol">款</div><b>馆藏图像整理中</b><p>此款式的字样名称已列入时间索引。待可核对的器底图像入库后，在此展示图片墙及对应藏品。</p></div></section>`;
    return;
  }
  const images = viewableImages(variant);
  const isLimited = images.length < galleryImages(variant).length;
  const gallery = images.map((entry, index) => `<button class="gallery-item" type="button" data-image-index="${index}" aria-label="放大查看${entry.demo ? demoLabel(entry) : `${entry.title}的章款图像`}"><img src="${asset(entry.mark)}" alt="${entry.title}底部的款识图像" loading="lazy" /><span class="gallery-overlay"><strong>${String(index + 1).padStart(2, '0')}</strong><small>${entry.demo ? demoLabel(entry) : `${entry.title} · ${entry.number}`}</small></span></button>`).join('');
  const gate = isLimited ? `<section class="member-gate" aria-labelledby="memberGateTitle"><div><p>已展示前 ${previewLimit} 个款识</p><h3 id="memberGateTitle">开通会员，浏览更多内容</h3></div><a class="member-gate-action" href="../index.html?scene=plans">开通会员 <span aria-hidden="true">›</span></a></section>` : '';
  detailContent.innerHTML = intro + `<div class="gallery-head"><div><p>IMAGE WALL / 馆藏实图</p><h2>章款图墙</h2></div><small>${isLimited ? '预览 ' : ''}${images.length} 幅</small></div><p class="wall-intro">点击图像，放大查看款识并进入对应藏品。${variant.id === 'kangxi-kaishu' ? '<br>演示款识复用已有图像，仅用于体验浏览权限。' : ''}</p><div class="gallery-grid ${images.length === 1 ? 'one-image' : ''}">${gallery}</div><p class="detail-source">图像来源：<a href="https://www.metmuseum.org/art/collection/search/${first.id}" target="_blank" rel="noopener noreferrer">The Metropolitan Museum of Art</a>，Open Access / Public Domain。单凭款识字样不宜判断器物年代。</p>${gate}`;
}

function openViewer(index) {
  const images = viewableImages();
  if (!images[index]) return;
  viewerIndex = index;
  updateViewer();
  viewer.hidden = false;
  document.querySelector('#viewerClose').focus();
}
function updateViewer() {
  const variant = variants[selectedId];
  const images = viewableImages(variant);
  const entry = images[viewerIndex];
  document.querySelector('#viewerImage').src = asset(entry.mark);
  document.querySelector('#viewerImage').alt = `${entry.title}底部的「${variant.glyph}」款识`;
  document.querySelector('#viewerCount').textContent = `${String(viewerIndex + 1).padStart(2, '0')} / ${String(images.length).padStart(2, '0')}`;
  document.querySelector('#viewerCaption').textContent = entry.demo ? `${variant.glyph} · ${demoLabel(entry)}` : variant.glyph;
  const markType = variant.type.includes(' · ') ? `${variant.type.replace(' · ', '')}款` : variant.type;
  document.querySelector('#viewerDescription').textContent = entry.markDescription ?? `${entry.title}器底题「${variant.glyph}」，${markType}。`;
  document.querySelector('#viewerPrev').disabled = viewerIndex === 0;
  document.querySelector('#viewerNext').disabled = viewerIndex === images.length - 1;
}
function moveViewer(step) {
  const images = viewableImages();
  viewerIndex = Math.max(0, Math.min(images.length - 1, viewerIndex + step));
  updateViewer();
}
function closeViewer() {
  closeObject();
  viewer.hidden = true;
  detailContent.querySelector(`[data-image-index="${viewerIndex}"]`)?.focus();
}
function openObject() {
  const entry = viewableImages()[viewerIndex];
  document.querySelector('#objectContent').innerHTML = `<img class="object-image" src="${asset(entry.object)}" alt="${entry.title}的完整器物图像" /><h2 id="objectTitle">${entry.title}</h2><p class="object-subtitle">${entry.english} · 清代${variants[selectedId].reign}款器物</p><dl class="object-meta"><div><dt>馆藏机构</dt><dd>The Metropolitan Museum of Art</dd></div><div><dt>馆藏编号</dt><dd>${entry.number}</dd></div><div><dt>图像来源</dt><dd>Open Access / Public Domain</dd></div></dl><a class="object-source" href="https://www.metmuseum.org/art/collection/search/${entry.id}" target="_blank" rel="noopener noreferrer">查看原始馆藏记录 ↗</a>`;
  objectCover.hidden = false;
  objectSheet.hidden = false;
  document.querySelector('#closeObject').focus();
}
function closeObject() {
  objectCover.hidden = true;
  objectSheet.hidden = true;
  if (!viewer.hidden) document.querySelector('#openObject').focus();
}

timeline.addEventListener('click', (event) => {
  const variantButton = event.target.closest('[data-variant]');
  if (!variantButton) return;
  selectedId = variantButton.dataset.variant;
  renderTimeline();
  renderDetail();
  detailScroll.scrollTop = 0;
  document.body.classList.add('mode-detail');
});
search.addEventListener('input', renderTimeline);
listScroll.addEventListener('scroll', updateCoordinate, { passive: true });
detailContent.addEventListener('click', (event) => {
  const button = event.target.closest('[data-image-index]');
  if (button) openViewer(Number(button.dataset.imageIndex));
  if (event.target.closest('.member-gate-action') && window.parent !== window) {
    event.preventDefault();
    window.parent.postMessage({ type: 'yuancang:marks-membership', wall: selectedId }, location.protocol === 'file:' ? '*' : location.origin);
  }
});
document.querySelector('#detailBack').addEventListener('click', () => {
  document.body.classList.remove('mode-detail');
  timeline.querySelector(`[data-variant="${selectedId}"]`)?.focus();
});
document.querySelector('#detailShare').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    toast('已复制原型链接');
  } catch { toast('可通过浏览器分享此页面'); }
});
document.querySelectorAll('[data-toast]').forEach((button) => button.addEventListener('click', () => toast(button.dataset.toast)));
document.querySelector('#viewerClose').addEventListener('click', closeViewer);
document.querySelector('#viewerPrev').addEventListener('click', () => moveViewer(-1));
document.querySelector('#viewerNext').addEventListener('click', () => moveViewer(1));
document.querySelector('#openObject').addEventListener('click', (event) => { event.preventDefault(); openObject(); });
document.querySelector('#closeObject').addEventListener('click', closeObject);
objectCover.addEventListener('click', closeObject);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (!objectSheet.hidden) closeObject();
    else if (!viewer.hidden) closeViewer();
    else if (document.body.classList.contains('mode-detail')) document.body.classList.remove('mode-detail');
  }
  if (!viewer.hidden && objectSheet.hidden && event.key === 'ArrowLeft') moveViewer(-1);
  if (!viewer.hidden && objectSheet.hidden && event.key === 'ArrowRight') moveViewer(1);
});
let touchStartX = null;
viewer.addEventListener('touchstart', (event) => { touchStartX = event.touches[0]?.clientX ?? null; }, { passive: true });
viewer.addEventListener('touchend', (event) => {
  if (touchStartX === null || !objectSheet.hidden) return;
  const delta = (event.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
  if (Math.abs(delta) > 45) moveViewer(delta < 0 ? 1 : -1);
  touchStartX = null;
}, { passive: true });

renderTimeline();
renderDetail();
if (Object.hasOwn(variants, initialWall)) document.body.classList.add('mode-detail');

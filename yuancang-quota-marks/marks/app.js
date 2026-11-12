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
const isManaged = params.get('manage') === '1';
const initialWall = params.get('wall');
const previewLimit = 20;
const libraryMap = () => Object.fromEntries(loadLibraries(isManaged).map(library => [library.id, library]));
let variants = libraryMap();
let selectedId = Object.hasOwn(variants, initialWall) ? initialWall : Object.keys(variants)[0];
let viewerIndex = 0;
let toastTimer;

function viewableImages(variant = variants[selectedId]) {
  const images = variant?.images ?? [];
  return isMember ? images : images.slice(0, previewLimit);
}

const demoLabel = (entry) => `演示款识 ${String(entry.demo).padStart(2, '0')}`;
const imageSrc = value => markEscape(safeImageUrl(value));
const libraryLabel = library => `${library.images.filter(entry => !entry.demo).length} 幅图像`;

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
      const existingIds = reign.ids.filter(id => Object.hasOwn(variants, id));
      const visibleIds = query && !reignMatch ? existingIds.filter((id) => variants[id].title.toLowerCase().includes(query) || variants[id].type.toLowerCase().includes(query)) : existingIds;
      if (query && !reignMatch && !visibleIds.length) return '';
      const featuredId = visibleIds.find((id) => variants[id].cover || variants[id].images.length);
      const feature = featuredId ? variants[featuredId] : null;
      const featureImages = feature?.cover ? [feature.cover] : feature?.images.slice(0, 3).map(entry => entry.imageUrl) ?? [];
      const mosaic = feature ? `<button class="feature-variant ${featureImages.length === 1 ? 'single' : ''}" type="button" data-variant="${featuredId}" aria-label="查看${markEscape(feature.title)}"><span class="feature-mosaic">${featureImages.map(url => `<img src="${imageSrc(url)}" alt="" loading="lazy" />`).join('')}</span><span class="feature-caption"><span><small>MARK IMAGES / 馆藏图谱</small><strong>${markEscape(feature.title)}</strong><em>${libraryLabel(feature)}</em></span><span class="feature-arrow" aria-hidden="true">↗</span></span></button>` : '';
      const otherIds = visibleIds.filter((id) => id !== featuredId);
      const cards = otherIds.map((id) => {
        const variant = variants[id];
        return `<button class="variant-card ${selectedId === id ? 'selected' : ''}" type="button" data-variant="${id}" aria-label="查看${markEscape(variant.title)}"><span class="variant-thumb">${variant.cover ? `<img class="library-thumb" src="${imageSrc(variant.cover)}" alt="" loading="lazy">` : sampleGlyph(variant.glyph)}</span><span class="variant-info"><strong>${markEscape(variant.title)}</strong><small>${variant.type} · ${variant.images.length ? libraryLabel(variant) : '图像待收录'}</small></span><span class="next" aria-hidden="true">›</span></button>`;
      }).join('');
      const body = visibleIds.length ? `${mosaic}${otherIds.length ? `<div class="variant-section-label">同年号其他款式 <span>${otherIds.length}</span></div><div class="variant-list">${cards}</div>` : ''}` : '<p class="axis-empty">可核对图像整理中</p>';
      return `<section class="axis-year" data-year="${reign.name}" data-dynasty="${group.dynasty}"><div class="axis-node" aria-hidden="true"></div><div class="axis-year-head"><span>${String(ordinal).padStart(2, '0')} / ${group.english}</span><h3>${reign.name}<small>${existingIds.length ? `${existingIds.length} 类章款` : '待收录'}</small></h3></div><div class="axis-year-body">${body}</div></section>`;
    }).join('');
    return years ? `<section class="axis-era"><div class="axis-era-title"><b>${group.dynasty}代</b><span>${group.english} DYNASTY</span></div><div class="axis-era-years">${years}</div></section>` : '';
  }).join('');
  const extra = Object.values(variants).filter(library => !library.reign && (!query || library.title.toLowerCase().includes(query) || library.description.toLowerCase().includes(query)));
  const libraries = extra.length ? `<section class="managed-libraries"><h3>专题款识库</h3>${extra.map(library => `<button type="button" class="variant-card" data-variant="${markEscape(library.id)}"><span class="variant-thumb"><img class="library-thumb" src="${imageSrc(library.cover)}" alt="" loading="lazy"></span><span class="variant-info"><strong>${markEscape(library.title)}</strong><small>${libraryLabel(library)}</small></span><span class="next" aria-hidden="true">›</span></button>`).join('')}</section>` : '';
  timeline.innerHTML = libraries + groups || '<div class="search-empty"><b>没有找到相关章款</b><span>试试搜索“康熙”“乾隆”或“楷书”。</span></div>';
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
  if (!variant) { detailContent.innerHTML = ''; return; }
  const first = variant.images[0];
  const intro = `<section class="detail-intro"><div class="breadcrumb">瓷器章款${variant.reign ? ` <span>›</span> ${variant.dynasty}代 <span>›</span> ${variant.reign}` : ''}</div><h1>${markEscape(variant.title)}</h1><p>${markEscape(variant.description)}</p><div class="fact-row">${variant.reign ? `<span>${variant.dynasty} · ${variant.reign}</span><span>${variant.type}</span>` : ''}<span>${first ? libraryLabel(variant) : '图像整理中'}</span></div></section>`;
  if (!first) {
    detailContent.innerHTML = intro + `<section class="detail-empty"><div class="empty-panel"><div class="empty-symbol">款</div><b>馆藏图像整理中</b><p>此款式的字样名称已列入时间索引。待可核对的器底图像入库后，在此展示图片墙及对应藏品。</p></div></section>`;
    return;
  }
  const images = viewableImages(variant);
  const isLimited = images.length < variant.images.length;
  const gallery = images.map((entry, index) => `<button class="gallery-item" type="button" data-image-index="${index}" aria-label="放大查看${markEscape(entry.demo ? demoLabel(entry) : entry.markName)}"><img src="${imageSrc(entry.imageUrl)}" alt="${markEscape(entry.markName)}" loading="lazy" /><span class="gallery-overlay"><strong>${String(index + 1).padStart(2, '0')}</strong><small>${markEscape(entry.demo ? demoLabel(entry) : entry.title ? `${entry.title} · ${entry.number}` : entry.markName)}</small></span></button>`).join('');
  const gate = isLimited ? `<section class="member-gate" aria-labelledby="memberGateTitle"><div><p>已展示前 ${previewLimit} 个款识</p><h3 id="memberGateTitle">开通会员，浏览更多内容</h3></div><a class="member-gate-action" href="../index.html?scene=plans">开通会员 <span aria-hidden="true">›</span></a></section>` : '';
  const credit = first.object ? `<p class="detail-source">馆藏样例来源：<a href="https://www.metmuseum.org/art/collection/search/${Number(first.id)}" target="_blank" rel="noopener noreferrer">The Metropolitan Museum of Art</a>，Open Access / Public Domain。单凭款识字样不宜判断器物年代。</p>` : '';
  detailContent.innerHTML = intro + `<div class="gallery-head"><div><p>IMAGE WALL / 馆藏实图</p><h2>章款图墙</h2></div><small>${isLimited ? '预览 ' : ''}${images.length} 幅</small></div><p class="wall-intro">点击图像，放大查看款识并进入对应藏品。${images.some(entry => entry.demo) ? '<br>演示款识复用已有图像，仅用于体验浏览权限。' : ''}</p><div class="gallery-grid ${images.length === 1 ? 'one-image' : ''}">${gallery}</div>${credit}${gate}`;
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
  document.querySelector('#viewerImage').src = safeImageUrl(entry.imageUrl);
  document.querySelector('#viewerImage').alt = entry.markName;
  document.querySelector('#viewerCount').textContent = `${String(viewerIndex + 1).padStart(2, '0')} / ${String(images.length).padStart(2, '0')}`;
  document.querySelector('#viewerCaption').textContent = entry.demo ? `${entry.markName} · ${demoLabel(entry)}` : entry.markName;
  document.querySelector('#viewerDescription').textContent = entry.markDescription;
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
  const source = entry.object ? `<a class="object-source" href="https://www.metmuseum.org/art/collection/search/${Number(entry.id)}" target="_blank" rel="noopener noreferrer">查看原始馆藏记录 ↗</a>` : '';
  const image = entry.object ? `<img class="object-image" src="${imageSrc(asset(entry.object))}" alt="${markEscape(entry.title)}的完整器物图像" />` : '';
  document.querySelector('#objectContent').innerHTML = `${image}<h2 id="objectTitle">${markEscape(entry.title || '关联藏品')}</h2><dl class="object-meta"><div><dt>采集机构</dt><dd>${markEscape(entry.institution)}</dd></div><div><dt>藏品 ID</dt><dd>${markEscape(entry.collectionId)}</dd></div>${entry.number ? `<div><dt>馆藏编号</dt><dd>${markEscape(entry.number)}</dd></div>` : ''}</dl>${source}`;
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
window.addEventListener('storage', event => {
  if (!isManaged || event.key !== libraryStorageKey) return;
  if (!viewer.hidden) closeViewer();
  variants = libraryMap();
  if (!Object.hasOwn(variants, selectedId)) document.body.classList.remove('mode-detail');
  renderTimeline();
  renderDetail();
});

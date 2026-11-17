const periods = [
  { dynasty: '明', english: 'MING', reigns: ['宣德', '成化', '万历'] },
  { dynasty: '清', english: 'QING', reigns: ['康熙', '雍正', '乾隆'] },
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
function libraryMap() {
  const visible = loadLibraries(isManaged).filter(library => !library.hidden);
  const wall = visible.find(library => library.id === 'kangxi-kaishu');
  if (params.get('preview') === '1' && wall && wall.images.length < 24 && wall.images.length) {
    const images = wall.images.slice();
    while (wall.images.length < 24) wall.images.push(images[wall.images.length % images.length]);
  }
  return Object.fromEntries(visible.map(library => [library.id, library]));
}
let variants = libraryMap();
let selectedId = Object.hasOwn(variants, initialWall) ? initialWall : Object.keys(variants)[0];
let viewerIndex = 0;
let collectionQuery = '';
let toastTimer;

function viewableImages(variant = variants[selectedId]) {
  const images = variant?.images ?? [];
  return isMember ? images : images.slice(0, previewLimit);
}

const imageSrc = value => markEscape(safeImageUrl(value));
const coverSrc = value => markEscape(coverImageUrl(value));
const libraryLabel = library => `${library.images.length} 幅章款`;
const collectionName = entry => entry.collectionName?.trim() || entry.title || '';

function filteredImages(variant = variants[selectedId]) {
  const query = collectionQuery.trim().toLowerCase();
  const images = viewableImages(variant);
  return query ? images.filter(entry => collectionName(entry).toLowerCase().includes(query)) : images;
}

function toast(message) {
  const el = document.querySelector('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

function sampleGlyph(text) {
  return `<span class="sample-glyph" aria-hidden="true">${[...text].map(char => `<span>${markEscape(char)}</span>`).join('')}</span>`;
}

function libraryCard(library) {
  const images = (library.cover ? [library.cover] : library.images.slice(0, 3).map(entry => entry.imageUrl))
    .map(coverSrc).filter(Boolean);
  const cover = images.length ? images.map(src => `<img src="${src}" alt="" loading="lazy">`).join('')
    : `<span class="feature-placeholder">${sampleGlyph(library.glyph || library.reign || '款识')}</span>`;
  return `<button class="feature-variant ${images.length < 2 ? 'single' : ''} ${images.length === 2 ? 'double' : ''}" type="button" data-variant="${markEscape(library.id)}" aria-label="查看${markEscape(library.title)}">
    <span class="feature-mosaic">${cover}</span><span class="feature-caption"><span><small>MARK IMAGES / 馆藏图谱</small><strong>${markEscape(library.title)}</strong><em>${libraryLabel(library)}</em></span><span class="feature-arrow" aria-hidden="true">↗</span></span></button>`;
}

function renderTimeline() {
  const query = search.value.trim().toLowerCase();
  let ordinal = 0;
  const groups = periods.map((group) => {
    const years = group.reigns.map(reign => {
      ordinal += 1;
      const libraries = Object.values(variants).filter(library => library.dynasty === group.dynasty && library.reign === reign && matchesLibrary(library,query));
      if (!libraries.length) return '';
      const hasCover = library => Boolean(library.cover || library.images.length);
      libraries.sort((a,b) => Number(hasCover(b)) - Number(hasCover(a)));
      return `<section class="axis-year" data-year="${reign}" data-dynasty="${group.dynasty}"><div class="axis-node" aria-hidden="true"></div><div class="axis-year-head"><span>${String(ordinal).padStart(2, '0')} / ${group.english}</span><h3>${reign}</h3></div><div class="axis-year-body library-cards">${libraries.map(libraryCard).join('')}</div></section>`;
    }).join('');
    return years ? `<section class="axis-era"><div class="axis-era-title"><b>${group.dynasty}代</b><span>${group.english} DYNASTY</span></div><div class="axis-era-years">${years}</div></section>` : '';
  }).join('');
  const extra = Object.values(variants).filter(library => !periods.some(group => group.dynasty === library.dynasty && group.reigns.includes(library.reign)) && matchesLibrary(library,query));
  const libraries = extra.length ? `<section class="managed-libraries library-cards"><h3>专题款识库</h3>${extra.map(libraryCard).join('')}</section>` : '';
  timeline.innerHTML = libraries + groups || '<div class="search-empty"><b>没有找到相关章款</b><span>试试搜索“康熙”“乾隆”或“楷书”。</span></div>';
  requestAnimationFrame(updateCoordinate);
}

function matchesLibrary(library, query) {
  return !query || [library.title, library.type, library.dynasty, library.reign, library.description,
    `${library.dynasty || ''}${library.reign || ''}`].some(value => value?.toLowerCase().includes(query));
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
  const intro = `<section class="detail-intro"><div class="breadcrumb">瓷器章款${variant.reign ? ` <span>›</span> ${markEscape(variant.dynasty)}代 <span>›</span> ${markEscape(variant.reign)}` : ''}</div><h1>${markEscape(variant.title)}</h1><p>${markEscape(variant.description)}</p><div class="fact-row">${variant.reign ? `<span>${markEscape(variant.dynasty)} · ${markEscape(variant.reign)}</span>${variant.type ? '<span>'+markEscape(variant.type)+'</span>' : ''}` : ''}<span>${first ? libraryLabel(variant) : '图像整理中'}</span></div></section>`;
  if (!first) {
    detailContent.innerHTML = intro + `<section class="detail-empty"><div class="empty-panel"><div class="empty-symbol">款</div><b>馆藏图像整理中</b><p>此款式的字样名称已列入时间索引。待可核对的器底图像入库后，在此展示图片墙及对应藏品。</p></div></section>`;
    return;
  }
  detailContent.innerHTML = intro + `<div class="gallery-head"><div><p>IMAGE WALL / 馆藏实图</p><h2>章款图墙</h2></div></div><p class="wall-intro">点击图像，放大查看款识并进入对应藏品。</p>
    <div class="wall-search"><label class="search-box"><span class="search-icon" aria-hidden="true"></span><input id="collectionSearch" type="search" aria-label="请检索藏品名称" placeholder="请检索藏品名称" autocomplete="off" value="${markEscape(collectionQuery)}"></label></div><div id="wallResults"></div>`;
  renderWallResults(variant);
}

function renderWallResults(variant = variants[selectedId]) {
  const isLimited = viewableImages(variant).length < variant.images.length;
  const images = filteredImages(variant);
  const gallery = images.map((entry, index) => {
    const name = collectionName(entry) || '藏品名称待补充';
    return `<button class="gallery-item" type="button" data-image-index="${index}" aria-label="放大查看${markEscape(name)}的款识">
      <img src="${imageSrc(entry.imageUrl)}" alt="${markEscape(entry.markName)}" loading="lazy" />
      <span class="gallery-overlay"><strong>${String(index + 1).padStart(2, '0')}</strong><span class="gallery-meta"><b>${markEscape(name)}</b><small>帝王年号款</small></span></span></button>`;
  }).join('');
  const results = gallery ? `<div class="gallery-grid">${gallery}</div>` : '<div class="search-empty"><b>没有找到匹配的藏品</b><span>换个藏品名称试试。</span></div>';
  const gate = isLimited ? `<section class="member-gate" aria-labelledby="memberGateTitle"><div><p>已展示前 ${previewLimit} 个款识</p><h3 id="memberGateTitle">开通会员，浏览更多内容</h3></div><a class="member-gate-action" href="../index.html?scene=plans">开通会员 <span aria-hidden="true">›</span></a></section>` : '';
  const firstMet = images.find(entry => entry.object);
  const credit = firstMet ? `<p class="detail-source">图像来源：<a href="https://www.metmuseum.org/art/collection/search/${Number(firstMet.id)}" target="_blank" rel="noopener noreferrer">The Metropolitan Museum of Art</a>，Open Access / Public Domain。单凭款识字样不宜判断器物年代。</p>` : '';
  document.querySelector('#wallResults').innerHTML = `<p class="wall-count" role="status">${collectionQuery.trim() ? '找到 ' : isLimited ? '预览 ' : ''}${images.length} 幅章款</p>${results}${credit}${gate}`;
}

function openViewer(index) {
  const images = filteredImages();
  if (!images[index]) return;
  viewerIndex = index;
  updateViewer();
  viewer.hidden = false;
  document.querySelector('#viewerClose').focus();
}
function updateViewer() {
  const images = filteredImages();
  const entry = images[viewerIndex];
  document.querySelector('#viewerImage').src = safeImageUrl(entry.imageUrl);
  document.querySelector('#viewerImage').alt = entry.markName;
  document.querySelector('#viewerCount').textContent = `${String(viewerIndex + 1).padStart(2, '0')} / ${String(images.length).padStart(2, '0')}`;
  document.querySelector('#viewerCaption').textContent = entry.markName;
  document.querySelector('#viewerDescription').textContent = entry.markDescription;
  document.querySelector('#viewerPrev').disabled = viewerIndex === 0;
  document.querySelector('#viewerNext').disabled = viewerIndex === images.length - 1;
}
function moveViewer(step) {
  const images = filteredImages();
  viewerIndex = Math.max(0, Math.min(images.length - 1, viewerIndex + step));
  updateViewer();
}
function closeViewer() {
  closeObject();
  viewer.hidden = true;
  detailContent.querySelector(`[data-image-index="${viewerIndex}"]`)?.focus();
}
function openObject() {
  const entry = filteredImages()[viewerIndex];
  const source = entry.object ? `<a class="object-source" href="https://www.metmuseum.org/art/collection/search/${Number(entry.id)}" target="_blank" rel="noopener noreferrer">查看原始馆藏记录 ↗</a>` : '';
  const image = entry.object ? `<img class="object-image" src="${imageSrc(asset(entry.object))}" alt="${markEscape(entry.title)}的完整器物图像" />` : '';
  document.querySelector('#objectContent').innerHTML = `${image}<h2 id="objectTitle">${markEscape(collectionName(entry) || '关联藏品')}</h2><dl class="object-meta"><div><dt>采集机构</dt><dd>${markEscape(entry.institution)}</dd></div><div><dt>藏品 ID</dt><dd>${markEscape(entry.collectionId)}</dd></div>${entry.number ? `<div><dt>馆藏编号</dt><dd>${markEscape(entry.number)}</dd></div>` : ''}</dl>${source}`;
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
  collectionQuery = '';
  renderTimeline();
  renderDetail();
  detailScroll.scrollTop = 0;
  document.body.classList.add('mode-detail');
});
search.addEventListener('input', renderTimeline);
detailContent.addEventListener('input', event => {
  if (event.target.id !== 'collectionSearch') return;
  if (!viewer.hidden) closeViewer();
  collectionQuery = event.target.value;
  renderWallResults();
});
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
    toast('已复制链接');
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

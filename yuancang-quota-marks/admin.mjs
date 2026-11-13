import { readQuotaDownloadRecords } from './model.mjs?v=5';

const content = document.querySelector('#content');
const editor = document.querySelector('#editor');
const notice = document.querySelector('#notice');
const marksBase = new URL('marks/', location.href);
const text = markEscape;
const dateTime = new Intl.DateTimeFormat('zh-CN', {
  dateStyle:'medium', timeStyle:'medium', timeZone:'Asia/Shanghai', hourCycle:'h23',
});
const shanghaiDay = iso => new Date(Date.parse(iso) + 8 * 3600000).toISOString().slice(0, 10);
const filters = {user:'', from:'', to:'', keyword:''};
let noticeTimer;
let currentDialog;

const sampleDownloads = [
  {userId:'YC-DEMO-002', userName:'演示用户 A', collection:'花口青瓷盘（示例 1）', collectionId:'c1', names:['整体.jpg','底部.jpg']},
  {userId:'YC-DEMO-003', userName:'演示用户 B', collection:'青瓷瓶（示例 2）', collectionId:'c2', names:['侧面.jpg']},
  {userId:'YC-DEMO-002', userName:'演示用户 A', collection:'青瓷瓶（示例 2）', collectionId:'c2', names:['整体.jpg','纹饰细节.tiff']},
].map((record, index) => ({
  ...record, id:`DEMO-DOWNLOAD-${index + 1}`, time:new Date(Date.now() - (index + 1) * 6 * 3600000).toISOString(),
  images:record.names.map(name => ({name})), sample:true,
}));

if (['localhost','127.0.0.1'].includes(location.hostname)) {
  document.querySelector('#front-link').href = './index-quota.html';
}

function showNotice(message) {
  clearTimeout(noticeTimer);
  notice.textContent = message;
  noticeTimer = setTimeout(() => { notice.textContent = ''; }, 2800);
}

function imageAddress(value) {
  const valid = coverImageUrl(value);
  return valid ? new URL(valid, marksBase).href : '';
}

function thumb(value) {
  const src = imageAddress(value);
  return src ? `<img class="thumb" src="${text(src)}" alt="" loading="lazy">` : '<span class="thumb placeholder">暂无封面</span>';
}

function table(headers, rows) {
  return `<div class="table-scroll"><table><thead><tr>${headers.map(label => `<th scope="col">${label}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function empty(title, description) {
  return `<div class="empty"><h3>${title}</h3><p>${description}</p></div>`;
}

function downloads() {
  content.innerHTML = `<div class="page-head"><div><h1>图片下载记录</h1><p>查询成功下载的用户、时间和图片。时间按北京时间显示。</p></div></div>
    <section class="panel"><form class="filters" id="download-filter">
      <label>用户<input name="user" value="${text(filters.user)}" placeholder="用户名称或 ID"></label>
      <label>开始日期<input name="from" type="date" value="${text(filters.from)}"></label>
      <label>结束日期<input name="to" type="date" value="${text(filters.to)}"></label>
      <label>图片或藏品<input name="keyword" value="${text(filters.keyword)}" placeholder="文件名、图片 ID 或藏品"></label>
      <div class="actions"><button class="button primary">查询</button><button type="reset" class="button">重置</button></div>
    </form><div id="download-results" aria-live="polite"></div></section>`;
  const form = content.querySelector('form');
  form.elements.from.addEventListener('input', () => form.elements.to.setCustomValidity(''));
  form.elements.to.addEventListener('input', () => form.elements.to.setCustomValidity(''));
  form.addEventListener('submit', event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    if (values.from && values.to && values.from > values.to) {
      form.elements.to.setCustomValidity('结束日期不能早于开始日期');
      form.elements.to.reportValidity();
      return;
    }
    Object.assign(filters, values);
    downloadResults();
  });
  form.addEventListener('reset', event => {
    event.preventDefault();
    Object.assign(filters, {user:'', from:'', to:'', keyword:''});
    downloads();
    content.querySelector('input').focus();
  });
  downloadResults();
}

function downloadResults() {
  let records;
  try { records = [...readQuotaDownloadRecords(), ...sampleDownloads]; }
  catch { document.querySelector('#download-results').innerHTML = empty('暂时无法读取下载记录','请检查浏览器的本地存储设置后重新打开。'); return; }
  const user = filters.user.trim().toLowerCase();
  const keyword = filters.keyword.trim().toLowerCase();
  const results = records.filter(record => {
    const person = `${record.userName} ${record.userId}`.toLowerCase();
    const images = record.images.flatMap(image => [image.name, image.id]);
    const terms = [record.collection, record.collectionId, ...images].join(' ').toLowerCase();
    const inRange = record.images.some(image => {
      const day = shanghaiDay(image.savedAt || record.time);
      return (!filters.from || day >= filters.from) && (!filters.to || day <= filters.to);
    });
    return person.includes(user) && terms.includes(keyword) && inRange;
  }).sort((a,b) => Date.parse(b.time) - Date.parse(a.time));
  const rows = results.map(record => `<tr><td>${text(record.userName)}<small>${text(record.userId)}${record.sample ? ' · 示例' : ''}</small></td>
    <td class="nowrap">${dateTime.format(new Date(record.time))}${record.legacyTime ? '<small>发起时间（历史记录）</small>' : ''}</td>
    <td>${text(record.collection)}<small>${text(record.collectionId)}</small></td>
    <td class="row-images">${record.images.map(image => `<span>${text(image.name)}${image.id ? ` <small>${text(image.id)}${image.savedAt && image.savedAt !== record.time ? ` · ${dateTime.format(new Date(image.savedAt))}` : ''}</small>` : ''}</span>`).join('')}</td>
    <td>${record.images.length} 张</td></tr>`).join('');
  document.querySelector('#download-results').innerHTML = `<div class="section-head"><strong>查询结果</strong><span class="muted">${results.length} 条记录</span></div>${rows ? table(['下载用户','下载时间','对应藏品','已下载图片','数量'], rows) : empty('没有匹配的下载记录','调整用户、日期或图片关键词后再查询。')}`;
}

function libraryList(libraries) {
  const rows = libraries.map(library => `<tr><td>${thumb(library.cover || library.images[0]?.imageUrl)}</td><td><strong>${text(library.title)}</strong></td>
    <td>${text(library.dynasty || '—')} / ${text(library.reign || '—')}</td><td><span class="clamp" title="${text(library.description)}">${text(library.description)}</span></td><td>${library.images.length} 张</td>
    <td><span class="${library.hidden?'muted':'badge'}">${library.hidden?'已隐藏':'已显示'}</span></td>
    <td class="row-actions"><a class="text-btn" href="#libraries/${text(library.id)}">管理照片墙</a> <button class="text-btn" data-edit-library="${text(library.id)}">编辑</button><button class="text-btn" data-toggle-library="${text(library.id)}">${library.hidden?'显示':'隐藏'}</button><button class="text-btn danger" data-delete-library="${text(library.id)}">删除</button></td></tr>`).join('');
  content.innerHTML = `<div class="page-head"><div><h1>款识库管理</h1><p>新建款识库并设置封面、标题和说明，再添加照片墙图片。</p></div><button class="button primary" data-new-library>新建款识库</button></div>
    <section class="panel">${rows ? table(['封面','标题','朝代 / 年号','说明','照片墙','状态','操作'],rows) : empty('还没有款识库','新建款识库后即可添加照片墙。')}</section>`;
}

function photoWall(library) {
  const rows = library.images.map(image => `<tr><td><div class="image-field">${thumb(image.imageUrl)}<span class="url" title="${text(image.imageUrl)}">${text(image.imageUrl)}</span></div></td>
    <td>${text(image.institution)}<small>ID ${text(image.collectionId)}</small></td>
    <td>${text(image.markName)}${image.demo ? '<small>演示款识</small>' : ''}</td><td><span class="clamp" title="${text(image.markDescription)}">${text(image.markDescription)}</span></td>
    <td class="row-actions"><button class="text-btn" data-edit-image="${text(image.key)}">编辑</button><button class="text-btn danger" data-delete-image="${text(image.key)}">删除</button></td></tr>`).join('');
  content.innerHTML = `<a class="crumb" href="#libraries">‹ 返回款识库</a><div class="page-head"><div><h1>${text(library.title)}</h1><p>${text(library.description)}</p></div>
    <div class="actions"><button class="button" type="button" disabled aria-label="上传 Excel">上传 Excel</button><button class="button primary" data-new-image>添加图片</button></div></div><section class="panel"><div class="section-head"><h2>照片墙</h2><span class="muted">${library.images.length} 张图片</span></div>
    ${rows ? table(['图片地址','对应藏品','款识名称','款识说明','操作'],rows) : empty('照片墙暂无图片','添加图片并填写对应的采集机构和藏品 ID。')}</section>`;
}

function route() {
  const [page, libraryId] = location.hash.slice(1).split('/');
  return {page:page === 'libraries' ? 'libraries' : 'downloads', libraryId};
}

function render() {
  const {page, libraryId} = route();
  document.querySelectorAll('[data-nav]').forEach(link => {
    if (link.dataset.nav === page) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  });
  if (page === 'downloads') { downloads(); return; }
  const libraries = loadLibraries();
  const selected = libraries.find(library => library.id === libraryId);
  if (selected) photoWall(selected);
  else libraryList(libraries);
}

function field(label, name, value, options = {}) {
  const required = options.required === false ? '' : 'required';
  return `<label>${label}${options.multiline ? `<textarea name="${name}" maxlength="600" ${required}>${text(value)}</textarea>` : `<input name="${name}" value="${text(value)}" maxlength="${options.address ? 2048 : 120}" ${required} ${options.address ? 'placeholder="https://…" inputmode="url"' : ''}>`}</label>`;
}

function openEditor(title, body, confirm, submit) {
  currentDialog = submit;
  editor.innerHTML = `<form><header class="dialog-head"><h2 id="dialog-title">${title}</h2><button class="text-btn" type="button" data-close>关闭</button></header>
    <div class="dialog-body">${body}<p class="form-error" role="alert"></p></div>
    <footer class="dialog-foot"><button class="button" type="button" data-close>取消</button><button class="button primary" type="submit">${confirm}</button></footer></form>`;
  editor.showModal();
}

function persist(libraries) { localStorage.setItem(libraryStorageKey, JSON.stringify(libraries)); }

async function readCover(file) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
    throw new Error('请选择 8 MB 以内的 JPG、PNG 或 WebP 图片。');
  }
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error('无法读取图片，请重新选择。'); });
  try {
    const scale = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', .82);
  } finally { bitmap.close(); }
}

function editLibrary(library) {
  let uploadedCover = '';
  openEditor(library ? '编辑款识库' : '新建款识库', `${field('标题','title',library?.title)}<div class="form-row">${field('朝代','dynasty',library?.dynasty)}${field('年号','reign',library?.reign)}</div>
    <div class="upload-field"><strong>封面</strong><div class="actions"><span id="cover-preview">${thumb(library?.cover || library?.images[0]?.imageUrl)}</span><button class="button" type="button" data-pick-cover>上传图片</button></div><input id="cover-file" type="file" accept="image/jpeg,image/png,image/webp" aria-label="封面图片" hidden><small>支持 JPG、PNG、WebP，最大 8 MB</small></div>
    ${field('说明','description',library?.description,{multiline:true})}`, '保存', values => {
    const {title, description, reign} = values;
    const dynasty = values.dynasty.replace(/代$/,'');
    if (!title || !description || !dynasty || !reign) throw new Error('请填写标题、朝代、年号和说明。');
    if (!library && !uploadedCover) throw new Error('请上传封面图片。');
    const libraries = loadLibraries();
    const current = libraries.find(item => item.id === library?.id);
    if (library && !current) throw new Error('该款识库已删除。');
    const data = {title, description, dynasty, reign, cover:uploadedCover || current?.cover || ''};
    if (current) Object.assign(current, data);
    else libraries.push({id:`lib-${crypto.randomUUID()}`, ...data, images:[]});
    persist(libraries);
    return library ? '款识库已更新' : '款识库已创建，可以管理照片墙';
  });
  const input = editor.querySelector('#cover-file');
  editor.querySelector('[data-pick-cover]').addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    const submit = editor.querySelector('[type="submit"]');
    const error = editor.querySelector('.form-error');
    const preview = editor.querySelector('#cover-preview');
    submit.disabled = true;
    input.disabled = true;
    error.textContent = '';
    try { uploadedCover = await readCover(file); preview.innerHTML = thumb(uploadedCover); }
    catch (issue) { error.textContent = issue.message; }
    finally { submit.disabled = false; input.disabled = false; input.value = ''; }
  });
}

function toggleLibrary(id) {
  const libraries = loadLibraries();
  const library = libraries.find(item => item.id === id);
  if (!library) return;
  library.hidden = !library.hidden;
  try { persist(libraries); render(); showNotice(library.hidden ? '已从前台隐藏' : '已在前台显示'); }
  catch { showNotice('无法保存，请检查浏览器存储设置。'); }
}

function editImage(library, image) {
  openEditor(image ? '编辑照片墙图片' : '添加照片墙图片', `${field('图片地址','imageUrl',image?.imageUrl,{address:true})}<div class="form-row">
    ${field('采集机构','institution',image?.institution)}${field('藏品 ID','collectionId',image?.collectionId)}</div>
    ${field('款识名称','markName',image?.markName)}${field('款识说明','markDescription',image?.markDescription,{multiline:true})}`, '保存', values => {
    if (!Object.values(values).every(Boolean)) throw new Error('请填写全部图片字段。');
    const imageUrl = safeImageUrl(values.imageUrl);
    if (!imageUrl) throw new Error('请输入有效的图片地址。');
    const libraries = loadLibraries();
    const current = libraries.find(item => item.id === library.id);
    if (!current) throw new Error('该款识库已删除。');
    const index = current.images.findIndex(item => item.key === image?.key);
    if (image && index < 0) throw new Error('该图片已删除。');
    const existing = current.images[index];
    const sameCollection = existing?.institution === values.institution && existing.collectionId === values.collectionId;
    const linked = sameCollection ? existing : {};
    const next = {...linked, ...values, imageUrl, key:image?.key || crypto.randomUUID()};
    if (index < 0) current.images.push(next);
    else current.images[index] = next;
    persist(libraries);
    return image ? '图片已更新' : '图片已添加';
  });
}

function deleteEntry(library, image) {
  openEditor(image ? '删除照片墙图片' : '删除款识库', `<p>${image ? `删除「${text(image.markName)}」？` : `删除「${text(library.title)}」及其照片墙中的全部图片？`}</p>`, '确认删除', () => {
    const libraries = loadLibraries();
    if (image) {
      const selected = libraries.find(item => item.id === library.id);
      if (!selected) throw new Error('该款识库已删除。');
      selected.images = selected.images.filter(item => item.key !== image.key);
      persist(libraries);
      return '图片已删除';
    }
    persist(libraries.filter(item => item.id !== library.id));
    return '款识库已删除';
  });
}

editor.addEventListener('click', event => {
  if (event.target.closest('[data-close]')) editor.close();
});
editor.addEventListener('submit', event => {
  event.preventDefault();
  const values = Object.fromEntries([...new FormData(event.target)].map(([key,value]) => [key, value.trim()]));
  try {
    const message = currentDialog(values);
    editor.close();
    render();
    showNotice(message);
  } catch (error) {
    editor.querySelector('.form-error').textContent = error instanceof DOMException ? '无法保存。请检查浏览器的本地存储设置。' : error.message;
  }
});

content.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  const {newLibrary, editLibrary:editId, deleteLibrary:deleteId, toggleLibrary:toggleId, newImage, editImage:editKey, deleteImage:deleteKey} = button.dataset;
  if (toggleId) { toggleLibrary(toggleId); return; }
  const libraries = loadLibraries();
  if (newLibrary !== undefined) editLibrary();
  if (editId || deleteId) {
    const library = libraries.find(item => item.id === (editId || deleteId));
    if (library) editId ? editLibrary(library) : deleteEntry(library);
  }
  if (newImage !== undefined || editKey || deleteKey) {
    const library = libraries.find(item => item.id === route().libraryId);
    if (!library) { render(); return; }
    if (newImage !== undefined) { editImage(library); return; }
    const image = library.images.find(item => item.key === (editKey || deleteKey));
    if (image) editKey ? editImage(library,image) : deleteEntry(library,image);
  }
});

window.addEventListener('hashchange', () => { if (editor.open) editor.close(); render(); });
window.addEventListener('storage', event => {
  if (route().page === 'downloads' && event.key?.startsWith('yuancang-quota-download-log:')) downloadResults();
  if (!editor.open && route().page === 'libraries' && event.key === libraryStorageKey) render();
});
render();

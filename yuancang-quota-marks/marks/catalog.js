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

const baseVariants = {
  'chenghua-six': { id: 'chenghua-six', dynasty: '明', reign: '成化', title: '大明成化年制六字款', type: '六字款', glyph: '大明成化年制', images: chenghuaImages },
  'kangxi-four': { id: 'kangxi-four', dynasty: '清', reign: '康熙', title: '康熙年制四字款', type: '四字款', glyph: '康熙年制', images: [] },
  'kangxi-imperial': { id: 'kangxi-imperial', dynasty: '清', reign: '康熙', title: '康熙御制四字款', type: '四字款', glyph: '康熙御制', images: [] },
  'kangxi-kaishu': { id: 'kangxi-kaishu', dynasty: '清', reign: '康熙', title: '大清康熙年制楷书款', type: '六字 · 楷书', glyph: '大清康熙年制', images: kangxiImages },
  'kangxi-zhuanshu': { id: 'kangxi-zhuanshu', dynasty: '清', reign: '康熙', title: '大清康熙年制篆书款', type: '六字 · 篆书', glyph: '大清康熙年制', images: [] },
  'yongzheng-six': { id: 'yongzheng-six', dynasty: '清', reign: '雍正', title: '大清雍正年制六字款', type: '六字款', glyph: '大清雍正年制', images: yongzhengImages },
  'qianlong-zhuanshu': { id: 'qianlong-zhuanshu', dynasty: '清', reign: '乾隆', title: '大清乾隆年制篆书款', type: '六字 · 篆书', glyph: '大清乾隆年制', images: qianlongImages },
};

const previousLibraryStorageKey = 'yuancang-quota-mark-libraries-v1';
const libraryStorageKey = 'yuancang-quota-mark-libraries-v2';
const metInstitution = 'The Metropolitan Museum of Art';
const defaultLibraryDescription = '同一款式，在不同器物上留下各自的笔意与布局。';

// Only assign a frame when the mark and its surrounding area are visible.
const markFrames = {
  '42229-2':'无圈框', '42230-2':'无圈框', '52049-1':'无圈框',
  '42363-1':'无圈框', '42232-2':'无圈框', '42423-1':'无圈框',
  '42515-5':'双方框', '49358-1':'单圈',
};
const markScripts = Object.fromEntries([
  ...kangxiImages.map(entry => [entry.mark, '楷书']),
  ['42515-5','楷书'], ['49358-1','楷书'], ['53774-6','篆书'],
]);

function markTags(entry) {
  const originalPhoto = entry.mark && entry.imageUrl === asset(entry.mark);
  return [
    ['书体', entry.script || (originalPhoto && markScripts[entry.mark])],
    ['圈框', entry.frame || (originalPhoto && markFrames[entry.mark])],
    ['色彩', entry.color || (originalPhoto && Object.hasOwn(markScripts, entry.mark) ? '青花' : '')],
  ].filter(([, value]) => value);
}

function defaultLibraries() {
  return Object.values(baseVariants).map(variant => ({
    ...variant,
    cover: '',
    description: defaultLibraryDescription,
    images: variant.images.map((entry, index) => ({
      ...entry,
      key: `${variant.id}-${index + 1}`,
      imageUrl: asset(entry.mark),
      institution: metInstitution,
      collectionId: String(entry.id),
      markName: variant.glyph,
      markDescription: entry.markDescription ?? `${entry.title}器底题「${variant.glyph}」，${variant.type.replace(' · ', '')}${variant.type.includes(' · ') ? '款' : ''}。`,
    })),
  }));
}

// Table order supplies the initial sort order. Existing photo walls retain their IDs.
const quotaLibraryRows = [
  ['xuande-six','明','宣德',false,'大明宣德年制','宣德时期帝王年号款激增大多数为楷书也有与永乐一脉相承的篆书款。宣德时期的款识有六字款、四字款、六字二行楷书款有暗款、刻款和横款等等，遍及全身，写在口际、肩部、腰部、底部、器里中心等都有，较为复杂。'],
  ['xuande-four','明','宣德',true,'宣德年制','2'],
  ['chenghua-six','明','成化',false,'大明成化年制','进入成化朝瓷器风貌焕然一新与永、宣以来浑厚豪放的风格迥然不同。成化瓷最大成就尤以斗彩为最。成化朝长达二十三年但传世年号款书风相近似出自一个之手，是年款中较易认识和掌握，均写楷书款。'],
  ['hongzhi-six','明','弘治',false,'大明弘治年制','弘治官窑以"大明弘治年制"六字青花楷书款为主，四字"弘治年制"罕见。款作六字双行，书于器底，外围青花双圈。字体端严秀劲、笔画纤细，受馆阁体影响，"弘""治"二字写法极具时代特征。较之宣德款"遍及全身"，弘治款位置已明显收敛，基本固定底部，偶见口沿横款。'],
  ['zhengde-six','明','正德',false,'大明正德年制','正德六字、四字并行，四字款较弘治多见。仍以青花楷书双行、器底双圈为常。最大辨伪要点在"德"字："心"上常多一横，结构特殊；字体较弘治粗放劲健。除青花外亦有红彩款、刻款，位置偶及口际、肩部。'],
  ['zhengde-four','明','正德',false,'正德年制','正德六字、四字并行，四字款较弘治多见。仍以青花楷书双行、器底双圈为常。最大辨伪要点在"德"字："心"上常多一横，结构特殊；字体较弘治粗放劲健。除青花外亦有红彩款、刻款，位置偶及口际、肩部。'],
  ['jiajing-six','明','嘉靖',false,'大明嘉靖年制','六字双行青花楷书、器底双圈，同时盛行横款，书于口沿、肩部、盖面，这是嘉靖款识的显著变化。字体瘦长劲硬，馆阁体痕迹明显；工艺上红彩款、刻款亦有所见。'],
  ['jiajing-four','明','嘉靖',true,'嘉靖年制','5'],
  ['longqing-six','明','隆庆',true,'大明隆庆年造','3'],
  ['wanli-six','明','万历',false,'大明万历年制','六字青花楷书款为大宗，四字并行。六字双行、外围双圈，书于器底；横款较嘉靖更多，口沿、肩部、盖面均见，位置散布全身。字体端正规整、笔画较嘉靖稍粗，结构宽博。'],
  ['kangxi-kaishu','清','康熙',false,'大清康熙年制','康熙楷书款独步清代："大清康熙年制"六字双行青花楷书，外围双圈，书于器底，笔力遒劲、结构严谨，有"铁划银钩"之评。'],
  ['kangxi-imperial','清','康熙',false,'康熙御制','"康熙御制"为四字款，多用于珐琅彩等御用器，以蓝料或红料书写，楷书精整，外围方框或圆框。康熙早期亦有少量篆书款，未成主流；款位已基本固定器底。'],
  ['kangxi-four','清','康熙',true,'康熙年制','2'],
  ['yongzheng-six','清','雍正',false,'大清雍正年制楷书款','雍正一朝楷篆双轨，是款识史上的转折点。楷书款六字双行青花、器底双圈，字体秀劲工整'],
  ['yongzheng-zhuanshu','清','雍正',false,'大清雍正年制篆书款','雍正一朝楷篆双轨，是款识史上的转折点。篆书款多为六字三行方章式，铁线篆细劲均匀、结构谨严。"雍正年制"四字款楷、篆皆有，四字篆书方章尤具特色。'],
  ['yongzheng-imperial','清','雍正',false,'雍正御制','"雍正御制"多见于珐琅彩、斗彩御器，蓝料楷书。雍正款书法水准极高，篆书款自此成为后世典范。'],
  ['yongzheng-four','清','雍正',false,'雍正年制','"雍正年制"四字款楷、篆皆有，四字篆书方章尤具特色。'],
  ['qianlong-zhuanshu','清','乾隆',false,'大清乾隆年制篆书款','乾隆以篆书为主流："大清乾隆年制"六字三行篆书款最常见，青花书写、方章式，笔法圆润匀整；'],
  ['qianlong-kaishu','清','乾隆',false,'大清乾隆年制楷书款','乾隆以篆书为主流，楷书款少见'],
  ['qianlong-xingkai','清','乾隆',true,'大清乾隆年制行楷款',''],
];

function quotaDefaults(legacy) {
  const byId = new Map(legacy.map(library => [library.id, library]));
  return quotaLibraryRows.map(([id,dynasty,reign,hidden,title,description], index) => ({
    images:[], cover:'', glyph:title.replace(/(?:楷书|篆书|行楷)款$/, ''), ...byId.get(id),
    id, sortOrder:index + 1, dynasty, reign, hidden, title, description,
  }));
}

function withoutPreviewPhotos(libraries) {
  return libraries.map(library => ({...library, images:library.images.filter(entry => !entry.demo)}));
}

function mergePreviousLibraries(previous, legacy, current) {
  const legacyById = new Map(legacy.map(library => [library.id, library]));
  const currentById = new Map(current.map(library => [library.id, library]));
  const editable = ['title','description','dynasty','reign','cover','hidden','images'];
  const merged = withoutPreviewPhotos(previous).flatMap(library => {
    const before = legacyById.get(library.id);
    if (!before) return [library];
    const changed = editable.filter(field => field === 'hidden'
      ? Boolean(library.hidden) !== Boolean(before.hidden)
      : JSON.stringify(library[field]) !== JSON.stringify(before[field]));
    const next = currentById.get(library.id);
    if (!next) return changed.length ? [library] : [];
    return [{...next, ...Object.fromEntries(changed.map(field => [field,library[field]]))}];
  });
  return [...merged, ...current.filter(library => !legacyById.has(library.id))];
}

function compareLibraryOrder(a, b) {
  return (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER);
}

function loadLibraries(managed = true) {
  const legacy = defaultLibraries();
  if (!managed) return legacy;
  const current = quotaDefaults(legacy);
  try {
    const saved = JSON.parse(localStorage.getItem(libraryStorageKey));
    if (Array.isArray(saved)) return withoutPreviewPhotos(saved).sort(compareLibraryOrder);
    const previous = JSON.parse(localStorage.getItem(previousLibraryStorageKey));
    if (Array.isArray(previous)) return mergePreviousLibraries(previous,legacy,current).sort(compareLibraryOrder);
  } catch {}
  return current;
}

function coverImageUrl(value) {
  return /^data:image\/jpeg;base64,[a-z\d+/=]+$/i.test(value) ? value : safeImageUrl(value);
}

function safeImageUrl(value) {
  const input = String(value ?? '').trim();
  if (/^assets\/[\w-]+\.(?:png|jpe?g|webp|gif|avif)$/i.test(input)) return input;
  try {
    const url = new URL(input);
    if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) return url.href;
  } catch {}
  return '';
}

const markEscape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

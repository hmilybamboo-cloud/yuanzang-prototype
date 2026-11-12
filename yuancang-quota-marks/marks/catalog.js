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

const baseVariants = {
  'chenghua-six': { id: 'chenghua-six', dynasty: '明', reign: '成化', title: '大明成化年制六字款', type: '六字款', glyph: '大明成化年制', images: chenghuaImages },
  'kangxi-four': { id: 'kangxi-four', dynasty: '清', reign: '康熙', title: '康熙年制四字款', type: '四字款', glyph: '康熙年制', images: [] },
  'kangxi-imperial': { id: 'kangxi-imperial', dynasty: '清', reign: '康熙', title: '康熙御制四字款', type: '四字款', glyph: '康熙御制', images: [] },
  'kangxi-kaishu': { id: 'kangxi-kaishu', dynasty: '清', reign: '康熙', title: '大清康熙年制楷书款', type: '六字 · 楷书', glyph: '大清康熙年制', images: kangxiImages },
  'kangxi-zhuanshu': { id: 'kangxi-zhuanshu', dynasty: '清', reign: '康熙', title: '大清康熙年制篆书款', type: '六字 · 篆书', glyph: '大清康熙年制', images: [] },
  'yongzheng-six': { id: 'yongzheng-six', dynasty: '清', reign: '雍正', title: '大清雍正年制六字款', type: '六字款', glyph: '大清雍正年制', images: yongzhengImages },
  'qianlong-zhuanshu': { id: 'qianlong-zhuanshu', dynasty: '清', reign: '乾隆', title: '大清乾隆年制篆书款', type: '六字 · 篆书', glyph: '大清乾隆年制', images: qianlongImages },
};

const libraryStorageKey = 'yuancang-quota-mark-libraries-v1';
const metInstitution = 'The Metropolitan Museum of Art';
const defaultLibraryDescription = '同一款式，在不同器物上留下各自的笔意与布局。';

function defaultLibraries() {
  return Object.values(baseVariants).map(variant => ({
    ...variant,
    cover: '',
    description: defaultLibraryDescription,
    images: (variant.id === 'kangxi-kaishu' ? [...variant.images, ...kangxiDemoImages] : variant.images).map((entry, index) => ({
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

function loadLibraries(managed = true) {
  if (managed) {
    try {
      const saved = JSON.parse(localStorage.getItem(libraryStorageKey));
      if (Array.isArray(saved)) return saved;
    } catch {}
  }
  return defaultLibraries();
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

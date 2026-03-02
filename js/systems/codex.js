const TOPICS = [
  {
    id: 'morale',
    category: 'Battle',
    title: 'Morale & Routing',
    body: 'Morale düşerse birlikler shaken olur, çok düşerse rout ederek savaş dışına çıkar. Flank/rear vuruşları morale hasarını artırır.',
    tags: ['battle', 'morale'],
  },
  {
    id: 'flank',
    category: 'Battle',
    title: 'Flank & Rear',
    body: 'Yandan ve arkadan vurmak hasarı ve moral baskısını yükseltir. Ön cepheyi sabitleyip süvariyi yandan dolaştırmak etkilidir.',
    tags: ['battle', 'flank', 'positioning'],
  },
  {
    id: 'formations',
    category: 'Battle',
    title: 'Formations',
    body: 'Line dengeli, square anti-cavalry, wedge hücum, scatter ise menzilli birlikleri yayar. Deploy aşamasında 1-4 ile değiştir.',
    tags: ['battle', 'formation'],
  },
  {
    id: 'ranged',
    category: 'Battle',
    title: 'Ranged & Ammo',
    body: 'Okçu birliklerin menzil ve cooldown değerleri vardır; mühimmat bitince yakın dövüşe geçebilirler. X ile Hold Fire aç/kapat.',
    tags: ['battle', 'ranged', 'ammo'],
  },
  {
    id: 'counters',
    category: 'Battle',
    title: 'Unit Counters',
    body: 'Mızraklılar süvariye, hızlı süvari okçulara karşı avantaj alır. Karşı eşleşmeleri doğru seçmek ham hasardan daha değerlidir.',
    tags: ['battle', 'counter'],
  },
  {
    id: 'war-contracts',
    category: 'Campaign',
    title: 'Wars & Contracts',
    body: 'Sözleşmeler altın ve itibar sağlar. Uzayan savaşlar ticareti ve diplomatik ilişkileri etkiler; front hattına yakın şehirler daha risklidir.',
    tags: ['campaign', 'war', 'contracts'],
  },
  {
    id: 'diplomacy',
    category: 'Campaign',
    title: 'Diplomacy',
    body: 'İlişki puanı savaş/barış kararlarını etkiler. Truce satın alma kısa süreli güvenlik sağlar, ama ekonomik maliyeti yüksektir.',
    tags: ['campaign', 'diplomacy'],
  },
  {
    id: 'weather',
    category: 'Campaign',
    title: 'Weather',
    body: 'Hava durumu görsel katman ve atmosferi değiştirir. Gece/yağmur okunurluğu etkileyebilir; istersen ayarlardan kapatılabilir.',
    tags: ['weather', 'visual'],
  },
  {
    id: 'camera',
    category: 'Controls',
    title: 'Camera & Navigation',
    body: 'Mouse wheel ile zoom yap, F ile partiyi takip et, X/backspace ile mevcut hedefi iptal et. Battle camera shake ayarlardan kapatılabilir.',
    tags: ['camera', 'controls'],
  },
];

export function getCodexTopics() {
  return TOPICS.map((topic) => ({ ...topic, tags: [...(topic.tags || [])] }));
}

export function searchCodexTopics(query = '') {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return getCodexTopics();
  return getCodexTopics().filter((topic) => {
    const haystack = [topic.category, topic.title, topic.body, ...(topic.tags || [])].join(' ').toLowerCase();
    return haystack.includes(q);
  });
}

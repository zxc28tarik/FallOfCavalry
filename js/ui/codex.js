import { getCodexTopics, searchCodexTopics } from '../systems/codex.js';

export default class CodexUI {
  constructor({ onClose } = {}) {
    this.onClose = typeof onClose === 'function' ? onClose : null;
    this.dom = {};
    this.visible = false;
    this.activeTopicId = null;
  }

  bind() {
    if (this.dom.root) return;
    const root = document.createElement('div');
    root.className = 'modal-wrap hidden';
    root.id = 'codexOverlay';
    root.innerHTML = `
      <div class="modal-card max-w-4xl">
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="royal-font text-2xl font-extrabold">Codex / Reference</div>
            <div class="mt-1 text-sm opacity-85">Mekanik özeti ve kontroller.</div>
          </div>
          <button data-role="close" class="action-btn btn-dark">Kapat</button>
        </div>
        <div class="mt-3">
          <input data-role="search" class="w-full px-3 py-2 rounded bg-neutral-900 border border-neutral-700" placeholder="Ara: morale, flank, weather..." />
        </div>
        <div class="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div data-role="list" class="frame-dark p-3 text-sm max-h-[380px] overflow-auto"></div>
          <div data-role="detail" class="frame-dark p-3 text-sm leading-relaxed md:col-span-2">Bir konu seç.</div>
        </div>
      </div>
    `;
    document.body.appendChild(root);

    this.dom.root = root;
    this.dom.search = root.querySelector('[data-role="search"]');
    this.dom.list = root.querySelector('[data-role="list"]');
    this.dom.detail = root.querySelector('[data-role="detail"]');
    this.dom.close = root.querySelector('[data-role="close"]');

    this.dom.close?.addEventListener('click', () => this.hide());
    this.dom.search?.addEventListener('input', () => this.renderList(this.dom.search.value));
    this.dom.list?.addEventListener('click', (event) => {
      const btn = event.target.closest?.('[data-topic-id]');
      if (!btn) return;
      this.activeTopicId = btn.dataset.topicId;
      this.renderList(this.dom.search.value);
      this.renderDetail();
    });

    const allTopics = getCodexTopics();
    this.activeTopicId = allTopics[0]?.id || null;
    this.renderList('');
    this.renderDetail();
  }

  renderList(query = '') {
    const topics = searchCodexTopics(query);
    this.dom.list.innerHTML = topics.map((topic) => {
      const active = topic.id === this.activeTopicId;
      return `<button data-topic-id="${topic.id}" class="w-full text-left mb-2 px-2 py-1 rounded ${active ? 'bg-neutral-700' : 'bg-neutral-800'}">${topic.title}<div class="text-xs opacity-70">${topic.category}</div></button>`;
    }).join('') || '<div class="opacity-70">Sonuç yok.</div>';
    if (!topics.some((topic) => topic.id === this.activeTopicId)) this.activeTopicId = topics[0]?.id || null;
  }

  renderDetail() {
    const topic = getCodexTopics().find((item) => item.id === this.activeTopicId);
    if (!topic) {
      this.dom.detail.textContent = 'Bir konu seç.';
      return;
    }
    this.dom.detail.innerHTML = `
      <div class="text-xs uppercase opacity-70">${topic.category}</div>
      <div class="royal-font text-xl mt-1">${topic.title}</div>
      <div class="mt-3">${topic.body}</div>
      <div class="mt-3 text-xs opacity-70">Tags: ${(topic.tags || []).join(', ')}</div>
    `;
  }

  show() {
    this.bind();
    this.visible = true;
    this.dom.root?.classList.remove('hidden');
  }

  hide() {
    this.visible = false;
    this.dom.root?.classList.add('hidden');
    this.onClose?.();
  }

  toggle() {
    if (this.visible) this.hide();
    else this.show();
  }
}

export class QuestCompletionOverlay {
  constructor({ modeManager = null, questManager = null } = {}) {
    this.modeManager = modeManager;
    this.questManager = questManager;
    this.root = null;
  }

  bind({ root = null } = {}) {
    this.root = root || this.createRoot();
    return this;
  }

  createRoot() {
    if (typeof document === 'undefined') return null;
    const root = document.createElement('div');
    root.id = 'questCompletionOverlay';
    root.className = 'quest-completion-overlay hidden';
    document.body.appendChild(root);
    return root;
  }

  show(payload = {}) {
    if (!this.root) this.bind();
    if (!this.root) return false;
    this.root.replaceChildren();
    this.root.classList.remove('hidden');

    const panel = document.createElement('div');
    panel.className = 'quest-completion-panel';
    const title = document.createElement('h2');
    title.textContent = payload.title || 'Quest';
    panel.appendChild(title);

    const list = document.createElement('div');
    list.className = 'quest-completion-paths';
    for (const path of (payload.paths || [])) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = path.label || path.id;
      button.disabled = !path.available;
      button.className = path.available ? 'quest-path' : 'quest-path locked';
      if (!path.available && path.reasonIfLocked) button.title = path.reasonIfLocked;
      button.addEventListener('click', () => {
        if (!path.available) return;
        this.questManager?.completeQuest?.(payload.questId, path.id);
        this.modeManager?.popOverlay?.();
        this.hide();
      });
      list.appendChild(button);
      if (!path.available && path.reasonIfLocked) {
        const reason = document.createElement('small');
        reason.textContent = path.reasonIfLocked;
        list.appendChild(reason);
      }
    }
    panel.appendChild(list);
    this.root.appendChild(panel);
    return true;
  }

  hide() {
    this.root?.classList?.add('hidden');
  }
}

export default QuestCompletionOverlay;

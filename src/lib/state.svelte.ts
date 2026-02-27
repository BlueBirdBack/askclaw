import type { Lang, Model, ChatMessage, DisplayMessage, Attachment, PendingFile } from './types';

class ChatState {
  lang: Lang = $state((localStorage.getItem('askclaw_lang') as Lang) || 'zh');
  model: Model = $state('openclaw:main');
  messages: DisplayMessage[] = $state([]);
  history: ChatMessage[] = $state([]);
  uploading: boolean = $state(false);
  streaming: boolean = $state(false);
  username: string = $state('web');
  currentChatId: string | null = $state(null);
  pendingFiles: PendingFile[] = $state([]);
  warningDismissed: boolean = $state(localStorage.getItem('askclaw_warning_dismissed') === '1');

  get hasMessages(): boolean {
    return this.messages.length > 0;
  }

  setLang(lang: Lang) {
    this.lang = lang;
    localStorage.setItem('askclaw_lang', lang);
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.title = 'Ask Claw';
  }

  toggleLang() {
    this.setLang(this.lang === 'zh' ? 'en' : 'zh');
  }

  dismissWarning() {
    this.warningDismissed = true;
    localStorage.setItem('askclaw_warning_dismissed', '1');
  }

  showWarning() {
    this.warningDismissed = false;
    localStorage.removeItem('askclaw_warning_dismissed');
  }

  newChat() {
    this.messages = [];
    this.history = [];
    this.currentChatId = null;
    this.clearPendingFiles();
  }

  addUserMessage(content: string, attachments?: Attachment[]) {
    this.messages.push({ role: 'user', content, attachments });
    this.history.push({ role: 'user', content });
  }

  addAssistantPlaceholder() {
    this.messages.push({ role: 'assistant', content: '' });
  }

  updateLastAssistant(content: string) {
    const last = this.messages[this.messages.length - 1];
    if (last && last.role === 'assistant') {
      last.content = content;
    }
  }

  finalizeAssistant(content: string) {
    this.history.push({ role: 'assistant', content });
  }

  removeLastAssistant() {
    if (this.messages.length && this.messages[this.messages.length - 1].role === 'assistant') {
      this.messages.pop();
    }
  }

  addError(content: string) {
    this.messages.push({ role: 'error', content });
  }

  rollbackLastUser() {
    if (this.history.length && this.history[this.history.length - 1].role === 'user') {
      this.history.pop();
    }
  }

  clearPendingFiles() {
    for (const pf of this.pendingFiles) {
      if (pf.isImage) URL.revokeObjectURL(pf.previewUrl);
    }
    this.pendingFiles = [];
  }
}

export const chatState = new ChatState();

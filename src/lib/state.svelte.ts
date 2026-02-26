import type { Lang, Model, ChatMessage, DisplayMessage } from './types';

class ChatState {
  lang: Lang = $state((localStorage.getItem('askclaw_lang') as Lang) || 'zh');
  model: Model = $state('openclaw:main');
  messages: DisplayMessage[] = $state([]);
  history: ChatMessage[] = $state([]);
  streaming: boolean = $state(false);
  username: string = $state('web');
  currentChatId: string | null = $state(null);

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

  newChat() {
    this.messages = [];
    this.history = [];
    this.currentChatId = null;
  }

  addUserMessage(content: string) {
    this.messages.push({ role: 'user', content });
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
}

export const chatState = new ChatState();

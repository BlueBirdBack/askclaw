export type Lang = 'zh' | 'en';

export type Model = string;

export interface ModelInfo {
  id: string;
  model: string;
  name: string;
}

export interface Attachment {
  id: string;
  filename: string;
  content_type: string;
  size: number;
  url: string;
}

export interface PendingFile {
  id: string;
  file: File;
  previewUrl: string;
  isImage: boolean;
  ready?: Promise<void>;
}

export type ContentBlock =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; source: { type: 'base64'; media_type: string; data: string } };

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

export interface DisplayMessage {
  role: 'user' | 'assistant' | 'error';
  content: string;
  attachments?: Attachment[];
}

export interface I18nStrings {
  title: string;
  newChat: string;
  welcomeTitle: string;
  welcomeDesc: string;
  placeholder: string;
  langSwitch: string;
  errRestart: string;
  errRate: string;
  errGeneric: string;
  errNetwork: string;
  noResponse: string;
  warning: string;
  tosLink: string;
  tosTitle: string;
  tosClose: string;
  tosBody: string;
  copied: string;
  exportChat: string;
  changePassword: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  passwordChanged: string;
  passwordMismatch: string;
  passwordWrong: string;
  passwordError: string;
  attachFile: string;
  removeFile: string;
  uploadFailed: string;
  fileTooLarge: string;
  tooManyFiles: string;
  unsupportedType: string;
  settings: string;
  chatHistory: string;
  searchChats: string;
  noChats: string;
  deleteChat: string;
  confirmDelete: string;
  untitled: string;
}

export interface SearchResult {
  chat_id: string;
  chat_title: string;
  message_id: number;
  role: string;
  snippet: string;
}

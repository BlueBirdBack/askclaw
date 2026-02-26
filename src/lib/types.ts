export type Lang = 'zh' | 'en';

export type Model = 'openclaw:main' | 'openclaw:opus';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface DisplayMessage {
  role: 'user' | 'assistant' | 'error';
  content: string;
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
}

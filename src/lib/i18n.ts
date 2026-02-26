import type { Lang, I18nStrings } from './types';

const strings: Record<Lang, I18nStrings> = {
  zh: {
    title: 'OpenClaw',
    newChat: '新对话',
    welcomeTitle: '有什么想问的？',
    welcomeDesc: '在下方输入消息开始对话。',
    placeholder: '随便问点什么...',
    langSwitch: 'EN',
    errRestart: 'Claw 正在重启，请稍后再试。',
    errRate: '请求太频繁，请稍等。',
    errGeneric: '出错了 ({code})，请重试。',
    errNetwork: '连接失败，请检查网络。',
    noResponse: '无回复',
  },
  en: {
    title: 'Ask Claw',
    newChat: 'New chat',
    welcomeTitle: 'Ask Claw anything',
    welcomeDesc: 'Type a message below to get started.',
    placeholder: 'Ask anything...',
    langSwitch: '中文',
    errRestart: 'Claw is restarting. Try again in a moment.',
    errRate: 'Too many requests. Please wait a bit.',
    errGeneric: 'Error ({code}). Please try again.',
    errNetwork: 'Connection failed. Check your network.',
    noResponse: 'No response',
  },
};

export function t(lang: Lang, key: keyof I18nStrings): string {
  return strings[lang][key];
}

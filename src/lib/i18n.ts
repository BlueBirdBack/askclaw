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
    warning: '请勿上传敏感信息，务必进行数据脱敏！',
    tosLink: '使用条款',
    tosTitle: '使用条款',
    tosClose: '关闭',
    tosBody: `本服务由 OpenClaw 提供，使用前请仔细阅读以下条款：

1. 禁止上传敏感信息：请勿在对话中输入任何个人隐私、商业机密、密码、密钥或其他敏感数据。

2. 数据脱敏要求：如需讨论涉及真实数据的问题，请务必先对数据进行脱敏处理，移除所有可识别信息。

3. 无保证声明：本服务按"现状"提供，不对回答的准确性、完整性或适用性作任何保证。

4. 对话记录：为改善服务质量，系统可能会记录对话内容。请勿发送任何您不希望被记录的信息。

5. 用户责任：您对使用本服务的行为及其后果承担全部责任。因违反上述条款造成的任何损失，服务提供方概不负责。

继续使用本服务即表示您已阅读、理解并同意以上条款。`,
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
    warning: 'Do not upload sensitive data. Always anonymize before sending!',
    tosLink: 'Terms of Service',
    tosTitle: 'Terms of Service',
    tosClose: 'Close',
    tosBody: `This service is provided by OpenClaw. Please read the following terms carefully before use:

1. No Sensitive Data: Do not enter any personal information, trade secrets, passwords, API keys, or other sensitive data in conversations.

2. Data Anonymization Required: If you need to discuss real data, you must anonymize it first and remove all identifiable information.

3. No Guarantees: This service is provided "as is" with no guarantees regarding the accuracy, completeness, or suitability of responses.

4. Conversation Logging: Conversations may be logged to improve service quality. Do not send any information you would not want recorded.

5. User Responsibility: You are solely responsible for your use of this service and its consequences. The service provider is not liable for any losses resulting from violation of these terms.

By continuing to use this service, you acknowledge that you have read, understood, and agreed to these terms.`,
  },
};

export function t(lang: Lang, key: keyof I18nStrings): string {
  return strings[lang][key];
}

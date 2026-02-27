import { describe, it, expect } from 'vitest';
import { t } from './i18n';

describe('i18n', () => {
  it('returns expected Chinese string for title', () => {
    expect(t('zh', 'title')).toBe('Ask Claw');
  });

  it('returns correct English string for attachFile', () => {
    expect(t('en', 'attachFile')).toBe('Attach file');
  });
});

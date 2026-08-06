import { describe, expect, it } from 'vitest';
import { isSafeExternalUrl, isTrustedRendererUrl, resolveAppAsset } from '../src/main/security';

describe('Electron 安全边界', () => {
  it('只允许 https 外链', () => {
    expect(isSafeExternalUrl('https://example.com/docs')).toBe(true);
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
  });

  it('只信任应用协议和精确开发源', () => {
    expect(isTrustedRendererUrl('app://bundle/index.html')).toBe(true);
    expect(isTrustedRendererUrl('http://127.0.0.1:5173/', 'http://127.0.0.1:5173')).toBe(true);
    expect(isTrustedRendererUrl('http://localhost:5173/', 'http://127.0.0.1:5173')).toBe(false);
  });

  it('拒绝 app 协议目录穿越', () => {
    expect(() => resolveAppAsset('C:\\app\\renderer', 'app://bundle/%2e%2e%2fsecret.txt')).toThrow();
  });
});

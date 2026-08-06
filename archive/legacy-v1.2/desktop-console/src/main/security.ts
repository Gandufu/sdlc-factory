import path from 'node:path';

export const isSafeExternalUrl = (rawUrl: string): boolean => {
  try {
    return new URL(rawUrl).protocol === 'https:';
  } catch {
    return false;
  }
};

export const isTrustedRendererUrl = (rawUrl: string, developmentServerUrl?: string): boolean => {
  try {
    const candidate = new URL(rawUrl);
    if (candidate.protocol === 'app:' && candidate.host === 'bundle') return true;
    return Boolean(developmentServerUrl && candidate.origin === new URL(developmentServerUrl).origin);
  } catch {
    return false;
  }
};

export const resolveAppAsset = (rendererRoot: string, rawUrl: string): string => {
  const url = new URL(rawUrl);
  if (url.protocol !== 'app:' || url.host !== 'bundle') throw new Error('不受信任的 app 协议来源');
  const root = path.resolve(rendererRoot);
  const candidate = path.resolve(root, decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html');
  const relative = path.relative(root, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('app 协议路径越界');
  return candidate;
};

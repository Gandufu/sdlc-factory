import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// 每个用例后卸载 React 树，避免导航状态和重复元素泄漏到下一用例。
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

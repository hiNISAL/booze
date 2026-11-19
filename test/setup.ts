import { beforeEach, vi } from 'vitest';

// src 里 fillUrl 留了一个 console.log，每个请求都会打印。
// 这里统一静音，同时让测试可以断言它是否被调用。
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

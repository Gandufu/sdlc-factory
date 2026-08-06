import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { OpenCodeHostAdapter, type HostRuntimeFactory } from '../src/adapter.js';

test('固定模型和 variant，并在返回后清理 Session 与 Server', async () => {
  const calls: Array<{ name: string; value?: unknown }> = [];
  const runtimeFactory: HostRuntimeFactory = async () => ({
    client: {
      global: { health: async () => ({ data: { healthy: true, version: '1.18.14' } }) },
      session: {
        create: async (value) => { calls.push({ name: 'create', value }); return { data: { id: 'SES-1' } }; },
        prompt: async (value) => {
          calls.push({ name: 'prompt', value });
          return { data: { info: {
            providerID: 'openai', modelID: 'gpt-5.6-luna', variant: 'max',
            finish: 'stop', cost: 0.1, tokens: { input: 10, output: 2, reasoning: 3 },
          }, parts: [{ type: 'text', text: 'OK' }] } };
        },
        delete: async (value) => { calls.push({ name: 'delete', value }); return { data: true }; },
      },
    },
    server: { close: () => calls.push({ name: 'close' }) },
  });

  const result = await new OpenCodeHostAdapter(runtimeFactory).invoke({
    invocationId: 'INV-1',
    directory: path.resolve('.'),
    objective: 'Return OK',
    modelRef: 'openai/gpt-5.6-luna#max',
  });

  const prompt = calls.find((call) => call.name === 'prompt')?.value as { model: unknown; variant: string };
  assert.deepEqual(prompt.model, { providerID: 'openai', modelID: 'gpt-5.6-luna' });
  assert.equal(prompt.variant, 'max');
  assert.equal(result.text, 'OK');
  assert.deepEqual(calls.map((call) => call.name), ['create', 'prompt', 'delete', 'close']);
});

test('拒绝没有 variant 的可变模型引用', async () => {
  const adapter = new OpenCodeHostAdapter(async () => { throw new Error('不应启动 runtime'); });
  await assert.rejects(() => adapter.invoke({
    invocationId: 'INV-2', directory: path.resolve('.'), objective: 'noop', modelRef: 'openai/gpt-5.6-luna',
  }), /provider\/model#variant/);
});

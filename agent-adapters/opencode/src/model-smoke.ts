import { randomUUID } from 'node:crypto';
import { OpenCodeHostAdapter, DEFAULT_MODEL_REF } from './adapter.js';

const marker = `FACTORY-LUNA-${randomUUID()}`;
const result = await new OpenCodeHostAdapter().invoke({
  invocationId: `INV-${randomUUID()}`,
  directory: process.cwd(),
  modelRef: DEFAULT_MODEL_REF,
  objective: `Do not call tools. Reply with exactly this marker and nothing else: ${marker}`,
});

if (result.text !== marker) throw new Error(`模型响应不符合 Smoke 合同：${result.text}`);
process.stdout.write(`${JSON.stringify({
  modelRef: result.modelRef,
  hostVersion: result.hostVersion,
  sdkVersion: result.sdkVersion,
  finish: result.finish,
  tokens: result.tokens,
  cost: result.cost,
  responseMatched: true,
})}\n`);

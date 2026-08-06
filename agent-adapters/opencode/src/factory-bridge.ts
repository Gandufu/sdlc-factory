import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { Ajv2020, type ValidateFunction } from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import { DEFAULT_MODEL_REF, OpenCodeHostAdapter } from './adapter.js';

type RenderedMessage = { role: 'SYSTEM' | 'USER' | 'ASSISTANT'; content: string };
type AgentInvocation = {
  protocol_version: string;
  invocation_id: string;
  run_id: string;
  attempt_id: string;
  host_adapter: { id: string; adapter_version: string; host_version: string; sdk_version?: string };
  objective: string;
  context_manifest_ref: { ref: string; content_hash: string };
  rendered_messages: RenderedMessage[];
  output_contract: { schema_id: string; schema_version: string; content_hash: string; validation_retry_limit: number };
  created_at: string;
};

const directory = path.resolve(requiredArgument('--directory'));
const contractsRoot = path.resolve(requiredArgument('--contracts-root'));
const invocationSchemaText = await readFile(path.join(contractsRoot, 'agent-invocation.schema.json'), 'utf8');
const handoffSchemaText = await readFile(path.join(contractsRoot, 'handoff.schema.json'), 'utf8');
const invocationSchema = JSON.parse(invocationSchemaText) as Record<string, unknown>;
const handoffSchema = JSON.parse(handoffSchemaText) as Record<string, unknown>;
const invocation = JSON.parse(await readStandardInput()) as AgentInvocation;

const ajv = new Ajv2020({ allErrors: true, strict: true });
(addFormatsModule as unknown as (target: Ajv2020) => Ajv2020)(ajv);
validateOrThrow(ajv.compile(invocationSchema), invocation, 'AgentInvocation');
verifyOutputContract(invocation, handoffSchema, handoffSchemaText);

const assistantMessages = invocation.rendered_messages.filter((message) => message.role === 'ASSISTANT');
if (assistantMessages.length > 0) throw new Error('当前 OpenCode Bridge 不接受 ASSISTANT 历史消息');
const system = invocation.rendered_messages.filter((message) => message.role === 'SYSTEM')
  .map((message) => message.content).join('\n\n') || undefined;
const userParts = invocation.rendered_messages.filter((message) => message.role === 'USER')
  .map((message) => ({ type: 'text' as const, text: message.content }));
if (userParts.length === 0) throw new Error('OpenCode Bridge 至少需要一条 USER 消息');

const handoffId = `HND-${randomUUID().replaceAll('-', '').toUpperCase()}`;
const submittedAt = new Date().toISOString();
const boundSchema = structuredClone(handoffSchema) as { properties: Record<string, Record<string, unknown>> };
boundSchema.properties.handoff_id.const = handoffId;
boundSchema.properties.run_id.const = invocation.run_id;
boundSchema.properties.role.const = 'CODER';
boundSchema.properties.submitted_at.const = submittedAt;

const result = await new OpenCodeHostAdapter().invoke({
  invocationId: invocation.invocation_id,
  directory,
  objective: invocation.objective,
  modelRef: DEFAULT_MODEL_REF,
  system,
  parts: userParts,
  outputFormat: {
    type: 'json_schema',
    schema: boundSchema,
    retryCount: invocation.output_contract.validation_retry_limit,
  },
});

if (!isRecord(result.structured)) throw new Error('OpenCode 没有返回 Handoff 对象');
// 身份、关联和时间属于 Factory/Adapter 事实，不能由模型决定或复述。
const handoff: Record<string, unknown> = {
  ...result.structured,
  protocol_version: '1.0',
  handoff_id: handoffId,
  run_id: invocation.run_id,
  role: 'CODER',
  submitted_at: submittedAt,
};
validateOrThrow(ajv.compile(handoffSchema), handoff, 'Handoff');

process.stdout.write(`${JSON.stringify({
  protocol_version: '1.0',
  invocation_id: invocation.invocation_id,
  model_ref: result.modelRef,
  host_version: result.hostVersion,
  sdk_version: result.sdkVersion,
  host_session_id: result.sessionId,
  finish: result.finish,
  usage: {
    input_tokens: result.tokens.input,
    output_tokens: result.tokens.output,
    cost_usd: result.cost,
    host_calls: 1,
  },
  handoff,
})}\n`);

function requiredArgument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`缺少参数 ${name}`);
  return value;
}

async function readStandardInput(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  const value = Buffer.concat(chunks).toString('utf8').trim();
  if (!value) throw new Error('标准输入中没有 AgentInvocation JSON');
  return value;
}

function validateOrThrow(validate: ValidateFunction, value: unknown, label: string): void {
  if (!validate(value)) throw new Error(`${label} Schema 校验失败：${ajv.errorsText(validate.errors)}`);
}

function verifyOutputContract(invocation: AgentInvocation, schema: Record<string, unknown>, text: string): void {
  const contract = invocation.output_contract;
  const hash = `sha256:${createHash('sha256').update(text).digest('hex')}`;
  if (contract.schema_id !== schema.$id || contract.schema_version !== '1.0.0' || contract.content_hash !== hash) {
    throw new Error('AgentInvocation 的 output_contract 与本地 Handoff Schema 不一致');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

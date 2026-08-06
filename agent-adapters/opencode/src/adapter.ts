import path from 'node:path';
import { createOpencode } from '@opencode-ai/sdk/v2';

export const SDK_VERSION = '1.18.14';
export const DEFAULT_MODEL_REF = 'openai/gpt-5.6-luna#max';

export type HostInvocation = {
  invocationId: string;
  directory: string;
  objective: string;
  modelRef: string;
};

export type OpenCodeInvocationResult = {
  invocationId: string;
  sessionId: string;
  hostVersion: string;
  sdkVersion: string;
  modelRef: string;
  finish: string;
  text: string;
  cost: number;
  tokens: { input: number; output: number; reasoning: number };
};

type SdkResponse<T> = { data?: T };

type SdkRuntime = {
  client: {
    global: { health(options: { throwOnError: true }): Promise<SdkResponse<{ healthy: true; version: string }>> };
    session: {
      create(parameters: unknown, options: { throwOnError: true }): Promise<SdkResponse<{ id: string }>>;
      prompt(parameters: unknown, options: { throwOnError: true }): Promise<SdkResponse<{
        info: {
          error?: unknown;
          finish?: string;
          providerID: string;
          modelID: string;
          variant?: string;
          cost: number;
          tokens: { input: number; output: number; reasoning: number };
        };
        parts: Array<{ type: string; text?: string }>;
      }>>;
      delete(parameters: unknown, options: { throwOnError: true }): Promise<SdkResponse<boolean>>;
    };
  };
  server: { close(): void };
};

export type HostRuntimeFactory = () => Promise<SdkRuntime>;

const defaultRuntimeFactory: HostRuntimeFactory = async () => createOpencode({
  hostname: '127.0.0.1',
  port: 0,
  timeout: 15_000,
  config: { logLevel: 'ERROR' },
}) as unknown as SdkRuntime;

/** 把 OpenCode SDK、Server 生命周期和响应结构封装在一个 invoke 接口之后。 */
export class OpenCodeHostAdapter {
  constructor(private readonly runtimeFactory: HostRuntimeFactory = defaultRuntimeFactory) {}

  async invoke(invocation: HostInvocation): Promise<OpenCodeInvocationResult> {
    const model = parseModelRef(invocation.modelRef);
    if (!invocation.invocationId.trim()) throw new Error('invocationId 不能为空');
    if (!invocation.objective.trim()) throw new Error('objective 不能为空');
    if (!path.isAbsolute(invocation.directory)) throw new Error('directory 必须是绝对路径');

    const runtime = await this.runtimeFactory();
    let sessionId: string | undefined;
    try {
      const health = required('OpenCode health', await runtime.client.global.health({ throwOnError: true }));
      if (health.version !== SDK_VERSION) {
        throw new Error(`OpenCode Host ${health.version} 与 SDK ${SDK_VERSION} 不兼容`);
      }

      const session = required('OpenCode session', await runtime.client.session.create({
        directory: invocation.directory,
        title: `sdlc-factory:${invocation.invocationId}`,
        model: { id: model.modelId, providerID: model.providerId, variant: model.variant },
        permission: [{ permission: '*', pattern: '*', action: 'deny' }],
      }, { throwOnError: true }));
      sessionId = session.id;

      const response = required('OpenCode prompt', await runtime.client.session.prompt({
        sessionID: sessionId,
        directory: invocation.directory,
        model: { providerID: model.providerId, modelID: model.modelId },
        variant: model.variant,
        tools: { bash: false, edit: false, write: false, patch: false },
        parts: [{ type: 'text', text: invocation.objective }],
      }, { throwOnError: true }));
      if (response.info.error) throw new Error(`OpenCode 模型执行失败：${JSON.stringify(response.info.error)}`);
      if (response.info.providerID !== model.providerId || response.info.modelID !== model.modelId
          || response.info.variant !== model.variant) {
        throw new Error(`OpenCode 实际模型与固定绑定不一致：${response.info.providerID}/${response.info.modelID}#${response.info.variant ?? 'none'}`);
      }
      const text = response.parts.filter((part) => part.type === 'text').map((part) => part.text ?? '').join('\n').trim();
      if (!text) throw new Error('OpenCode 模型没有返回文本结果');

      return {
        invocationId: invocation.invocationId,
        sessionId,
        hostVersion: health.version,
        sdkVersion: SDK_VERSION,
        modelRef: invocation.modelRef,
        finish: response.info.finish ?? 'unknown',
        text,
        cost: response.info.cost,
        tokens: response.info.tokens,
      };
    } finally {
      try {
        if (sessionId) await runtime.client.session.delete({ sessionID: sessionId, directory: invocation.directory }, { throwOnError: true });
      } finally {
        runtime.server.close();
      }
    }
  }
}

const parseModelRef = (modelRef: string): { providerId: string; modelId: string; variant: string } => {
  const match = /^([^/#]+)\/([^#]+)#([^#]+)$/.exec(modelRef);
  if (!match) throw new Error('modelRef 必须使用 provider/model#variant 格式');
  return { providerId: match[1], modelId: match[2], variant: match[3] };
};

const required = <T>(label: string, response: SdkResponse<T>): T => {
  if (response.data === undefined) throw new Error(`${label} 没有返回 data`);
  return response.data;
};

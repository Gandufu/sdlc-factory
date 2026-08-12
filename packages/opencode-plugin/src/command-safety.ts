const SENSITIVE_FLAG = /^(?:--?|\/)(?:access[-_]?token|api[-_]?key|apikey|authorization|credential|password|secret|token)(?:=|$)/iu;
const SENSITIVE_HEADER = /(?:authorization\s*:\s*(?:bearer|basic)|\bbearer\s+\S+)/iu;
const SENSITIVE_QUERY_KEY = /^(?:access_token|api_key|apikey|authorization|credential|password|secret|token)$/iu;

export function assertSafeCommandArguments(arguments_: string[]): void {
  for (const argument of arguments_) {
    if (SENSITIVE_FLAG.test(argument) || SENSITIVE_HEADER.test(argument) || hasSensitiveUrlParameter(argument)) {
      throw new Error("受控命令参数不能包含密码、令牌、认证头或敏感查询参数；请改用环境变量或密钥引用");
    }
  }
}

export function safeCommandArguments(arguments_: string[]): string[] {
  let redactNext = false;
  return arguments_.map((argument) => {
    if (redactNext) {
      redactNext = false;
      return "[REDACTED]";
    }
    if (SENSITIVE_FLAG.test(argument)) {
      redactNext = !argument.includes("=");
      return argument.includes("=") ? `${argument.slice(0, argument.indexOf("=") + 1)}[REDACTED]` : argument;
    }
    if (SENSITIVE_HEADER.test(argument)) return "[REDACTED AUTHORIZATION]";
    return redactSensitiveUrlParameters(argument);
  });
}

function hasSensitiveUrlParameter(value: string): boolean {
  try {
    const parsed = new URL(value);
    return [...parsed.searchParams.keys()].some((key) => SENSITIVE_QUERY_KEY.test(key));
  } catch {
    return false;
  }
}

function redactSensitiveUrlParameters(value: string): string {
  try {
    const parsed = new URL(value);
    let changed = false;
    for (const key of parsed.searchParams.keys()) {
      if (!SENSITIVE_QUERY_KEY.test(key)) continue;
      parsed.searchParams.set(key, "[REDACTED]");
      changed = true;
    }
    return changed ? parsed.toString() : value;
  } catch {
    return value;
  }
}

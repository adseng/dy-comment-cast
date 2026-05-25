export interface DebugConfig {
  debugMessages: boolean;
  debugMethods: Set<string>;
  debugPayloadHex: boolean;
}

export function createDebugConfig(env: NodeJS.ProcessEnv): DebugConfig {
  const methods = (env.DEBUG_METHODS ?? '')
    .split(',')
    .map((method) => method.trim())
    .filter(Boolean);

  return {
    debugMessages: env.DEBUG_MESSAGES === '1',
    debugMethods: new Set(methods),
    debugPayloadHex: env.DEBUG_PAYLOAD_HEX === '1',
  };
}

function toHex(payload: Uint8Array, limit = 64): string {
  return Buffer.from(payload.slice(0, limit)).toString('hex');
}

export function formatDebugMessage(
  method: string,
  payload: Uint8Array,
  config: DebugConfig,
): string | null {
  const shouldPrint = config.debugMessages || config.debugMethods.has(method);
  if (!shouldPrint) return null;

  if (config.debugPayloadHex && config.debugMethods.has(method)) {
    return `[调试消息] ${method} payload=${toHex(payload)}`;
  }

  return `[未处理消息] ${method}`;
}


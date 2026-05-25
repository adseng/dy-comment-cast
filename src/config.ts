import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local'), override: true });

function requireEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`缺少环境变量 ${key}，请在 .env 或 .env.local 中配置`);
  }
  return value;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key]?.trim() || fallback;
}

export const appConfig = {
  // live.douyin.com/452550646709 末尾数字为 LIVE_ID（web_rid）
  liveId: requireEnv('LIVE_ID'),
  webcastWsHost: optionalEnv('WEBCAST_WS_HOST', 'webcast100-ws-web-lq.douyin.com'),
  webcastSdkVersion: optionalEnv('WEBCAST_SDK_VERSION', '1.0.14-beta.0'),
  reconnectDelayMs: Number(optionalEnv('RECONNECT_DELAY_MS', '3000')),
  heartbeatIntervalMs: Number(optionalEnv('HEARTBEAT_INTERVAL_MS', '5000')),
  staleTimeoutMs: Number(optionalEnv('STALE_TIMEOUT_MS', '45000')),
  userAgent: optionalEnv(
    'USER_AGENT',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  ),
};

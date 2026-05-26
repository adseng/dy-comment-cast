import { gunzipSync } from 'zlib';
import WebSocket from 'ws';
import { appConfig } from './config';
import { formatDanmakuEvent } from './events';
import { parseMessage } from './message-parser';
import { encodeMessage, protoTypes } from './proto';
import { resolveRoomContext, RoomContext } from './room';
import { generateSignature } from './signature';

let activeWs: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;
let watchdogTimer: NodeJS.Timeout | null = null;
let lastActivityAt = 0;

function buildWsUrl(context: RoomContext): string {
  const now = Date.now();
  const wrds = `${now}${Math.floor(Math.random() * 1_000_000)}`;

  const params = new URLSearchParams({
    app_name: 'douyin_web',
    version_code: '180800',
    webcast_sdk_version: appConfig.webcastSdkVersion,
    update_version_code: appConfig.webcastSdkVersion,
    compress: 'gzip',
    device_platform: 'web',
    cookie_enabled: 'true',
    screen_width: '1920',
    screen_height: '1080',
    browser_language: 'zh-CN',
    browser_platform: 'Win32',
    browser_name: 'Mozilla',
    browser_version:
      '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    browser_online: 'true',
    tz_name: 'Asia/Shanghai',
    cursor: `d-1_u-1_fh-${context.userUniqueId}_t-${now}_r-1`,
    internal_ext: [
      'internal_src:dim',
      `wss_push_room_id:${context.roomId}`,
      `wss_push_did:${context.userUniqueId}`,
      `first_req_ms:${now}`,
      `fetch_time:${now}`,
      'seq:1',
      `wss_info:0-${now}-0-0`,
      `wrds_v:${wrds}`,
    ].join('|'),
    host: 'https://live.douyin.com',
    aid: '6383',
    live_id: '1',
    did_rule: '3',
    endpoint: 'live_pc',
    support_wrds: '1',
    user_unique_id: context.userUniqueId,
    im_path: '/webcast/im/fetch/',
    identity: 'audience',
    need_persist_msg_count: '15',
    room_id: context.roomId,
    heartbeatDuration: '0',
  });

  const base = `wss://${appConfig.webcastWsHost}/webcast/im/push/v2/?${params.toString()}`;
  const signature = generateSignature(base, appConfig.userAgent);
  return `${base}&signature=${encodeURIComponent(signature)}`;
}

function decodePushFrame(data: Buffer) {
  const frame = protoTypes.PushFrame.decode(data);
  if (!frame.payload || frame.payload.length === 0) return null;

  const payload = gunzipSync(frame.payload);
  const response = protoTypes.Response.decode(payload);
  return { frame, response };
}

function handleMessages(response: ReturnType<typeof protoTypes.Response.decode>): void {
  for (const message of response.messages ?? []) {
    if (!message.payload || !message.method) continue;

    try {
      const event = parseMessage(message.method, message.payload);
      if (!event) continue;

      const formatted = formatDanmakuEvent(event);
      if (formatted) {
        console.log(formatted);
      }
    } catch (err) {
      console.error(
        `消息解析失败：${message.method}`,
        err instanceof Error ? err.message : err,
      );
    }
  }
}

function sendAck(
  ws: WebSocket,
  frame: ReturnType<typeof protoTypes.PushFrame.decode>,
  internalExt?: string,
): void {
  const ack = encodeMessage(
    protoTypes.PushFrame,
    protoTypes.PushFrame.create({
      logId: frame.logId,
      payloadType: 'ack',
      payload: Buffer.from(internalExt ?? '', 'utf8'),
    }),
  );
  ws.send(ack);
}

function sendHeartbeat(ws: WebSocket): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  const heartbeat = encodeMessage(
    protoTypes.PushFrame,
    protoTypes.PushFrame.create({ payloadType: 'hb' }),
  );
  ws.send(heartbeat);
}

function startHeartbeat(ws: WebSocket): void {
  stopHeartbeat();
  sendHeartbeat(ws);
  heartbeatTimer = setInterval(() => sendHeartbeat(ws), appConfig.heartbeatIntervalMs);
}

function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function startWatchdog(onStale: () => void): void {
  stopWatchdog();
  lastActivityAt = Date.now();
  watchdogTimer = setInterval(() => {
    if (Date.now() - lastActivityAt > appConfig.staleTimeoutMs) {
      console.log('长时间未收到消息，正在重连...');
      onStale();
    }
  }, 5000);
}

function stopWatchdog(): void {
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
  }
}

function clearReconnectTimer(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function closeActiveWs(): void {
  if (!activeWs) return;
  activeWs.removeAllListeners();
  if (activeWs.readyState === WebSocket.OPEN || activeWs.readyState === WebSocket.CONNECTING) {
    activeWs.close();
  }
  activeWs = null;
}

function scheduleReconnect(): void {
  clearReconnectTimer();
  reconnectTimer = setTimeout(() => {
    startDanmaku().catch((err) => console.error('重连失败', err));
  }, appConfig.reconnectDelayMs);
}

function forceReconnect(): void {
  closeActiveWs();
  stopHeartbeat();
  stopWatchdog();
  scheduleReconnect();
}

export async function startDanmaku(): Promise<void> {
  clearReconnectTimer();
  closeActiveWs();

  const roomContext = await resolveRoomContext(appConfig.liveId);
  const wsUrl = buildWsUrl(roomContext);

  console.log(`直播间：${roomContext.title}（room_id=${roomContext.roomId}）`);
  console.log(`状态：${roomContext.isLive ? '直播中' : '未开播或已结束'}`);
  console.log('连接弹幕服务器...');

  const ws = new WebSocket(wsUrl, {
    headers: {
      'User-Agent': appConfig.userAgent,
      Origin: 'https://live.douyin.com',
      Cookie: `ttwid=${roomContext.ttwid}`,
    },
  });
  activeWs = ws;

  ws.on('open', () => {
    console.log('✅ 抖音弹幕连接成功');
    console.log('等待弹幕、礼物、点赞、进场、关注或房间统计...');
    startHeartbeat(ws);
    startWatchdog(() => forceReconnect());
  });

  ws.on('message', (data: Buffer) => {
    try {
      const decoded = decodePushFrame(data);

      if (!decoded) return;

      lastActivityAt = Date.now();

      if (decoded.response.needAck) {
        sendAck(ws, decoded.frame, decoded.response.internalExt);
      }
      handleMessages(decoded.response);
    } catch (err) {
      console.error('消息解析失败', err instanceof Error ? err.message : err);
    }
  });

  ws.on('close', () => {
    if (activeWs !== ws) return;
    activeWs = null;
    stopHeartbeat();
    stopWatchdog();
    console.log('❌ 连接断开，尝试重连...');
    scheduleReconnect();
  });

  ws.on('error', (err) => {
    console.error('WS 错误', err.message);
  });
}

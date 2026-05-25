import axios, { AxiosInstance } from 'axios';
import { appConfig } from './config';

export interface RoomContext {
  liveId: string;
  roomId: string;
  userUniqueId: string;
  ttwid: string;
  title: string;
  isLive: boolean;
}

interface RoomMetadata {
  roomId?: string;
  title?: string;
  isLive?: boolean;
}

function randomMsToken(length = 107): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let token = '';
  for (let i = 0; i < length; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

function extractCookie(setCookie: string[] | undefined, name: string): string {
  if (!setCookie) return '';
  const match = setCookie.join('; ').match(new RegExp(`${name}=([^;]+)`));
  return match?.[1] ?? '';
}

function parseByPatterns(html: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function decodeJsonString(value: string): string {
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return value;
  }
}

function parseRoomId(html: string): string {
  const roomId = parseByPatterns(html, [
    /roomId\\":\\"(\d+)\\"/,
    /"roomId":"(\d+)"/,
  ]);
  if (!roomId) {
    throw new Error('页面中未找到 roomId，请确认 LIVE_ID 是否正确且直播间可访问');
  }
  return roomId;
}

let sessionDeviceId: string | null = null;

function parseUserUniqueId(html: string): string {
  return parseByPatterns(html, [
    /user_unique_id\\":\\"(\d+)\\"/,
    /"user_unique_id":"(\d+)"/,
  ]) ?? String(7300000000000000000 + Math.floor(Math.random() * 1e14));
}

function getSessionDeviceId(html: string): string {
  if (!sessionDeviceId) {
    sessionDeviceId = parseUserUniqueId(html);
  }
  return sessionDeviceId;
}

export function resetSessionDeviceId(): void {
  sessionDeviceId = null;
}

export function parseRoomTitle(html: string): string {
  const title = parseByPatterns(html, [
    /"room"\s*:\s*\{[^{}]*"id_str"\s*:\s*"\d+"[^{}]*"title"\s*:\s*"([^"]+)"/,
    /"room"\\:\s*\{[^{}]*"id_str"\\:\\"?\d+\\"?[^{}]*"title"\\:\\"([^\\"]+)\\"/,
    /"roomInfo"\s*:\s*\{[^{}]*"title"\s*:\s*"([^"]+)"/,
    /"roomInfo"\\:\s*\{[^{}]*"title"\\:\\"([^\\"]+)\\"/,
  ]);
  return title ? decodeJsonString(title) : '未知直播间';
}

function parseIsLive(html: string): boolean {
  const liveStatus = parseByPatterns(html, [
    /liveStatus\\":\\"([^\\"]+)\\"/,
    /"liveStatus":"([^"]+)"/,
  ]);
  return liveStatus === 'normal';
}

function isLiveStatus(value: unknown): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (value === 'normal') return true;
  if (typeof value === 'number') return value === 2 || value === 4;
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (normalized === 'normal') return true;
    return normalized === '2' || normalized === '4';
  }
  return undefined;
}

export function parseRoomMetadataFromEnterResponse(data: unknown): RoomMetadata {
  const payload = data as {
    data?: {
      data?: Array<{
        id_str?: string;
        id?: string | number;
        title?: string;
        status?: string | number;
      }>;
      room?: {
        id_str?: string;
        id?: string | number;
        title?: string;
        status?: string | number;
      };
      room_status?: string | number;
    };
  };

  const room = payload.data?.data?.[0] ?? payload.data?.room;
  if (!room) return {};

  return {
    roomId: room.id_str ?? (room.id ? String(room.id) : undefined),
    title: room.title,
    isLive: isLiveStatus(payload.data?.room_status) ?? isLiveStatus(room.status),
  };
}

async function fetchRoomMetadata(
  session: AxiosInstance,
  liveId: string,
  ttwid: string,
): Promise<RoomMetadata> {
  const params = new URLSearchParams({
    aid: '6383',
    app_name: 'douyin_web',
    live_id: '1',
    device_platform: 'web',
    language: 'zh-CN',
    enter_from: 'web_live',
    cookie_enabled: 'true',
    screen_width: '1920',
    screen_height: '1080',
    browser_language: 'zh-CN',
    browser_platform: 'Win32',
    browser_name: 'Mozilla',
    browser_version: appConfig.userAgent,
    browser_online: 'true',
    tz_name: 'Asia/Shanghai',
    web_rid: liveId,
  });

  const response = await session.get(`https://live.douyin.com/webcast/room/web/enter/?${params.toString()}`, {
    headers: {
      Referer: `https://live.douyin.com/${liveId}`,
      Cookie: `ttwid=${ttwid}`,
    },
  });

  return parseRoomMetadataFromEnterResponse(response.data);
}

export async function resolveRoomContext(liveId: string): Promise<RoomContext> {
  const session: AxiosInstance = axios.create({
    headers: { 'User-Agent': appConfig.userAgent },
  });

  const home = await session.get('https://live.douyin.com/');
  const ttwid = extractCookie(home.headers['set-cookie'], 'ttwid');
  if (!ttwid) {
    throw new Error('获取 ttwid 失败，请稍后重试');
  }

  const page = await session.get(`https://live.douyin.com/${liveId}`, {
    headers: {
      Cookie: `ttwid=${ttwid}; msToken=${randomMsToken()}; __ac_nonce=0123407cc00a9e438deb4`,
    },
  });

  const html = page.data as string;
  const metadata = await fetchRoomMetadata(session, liveId, ttwid).catch((): RoomMetadata => ({}));

  return {
    liveId,
    roomId: metadata.roomId ?? parseRoomId(html),
    userUniqueId: getSessionDeviceId(html),
    ttwid,
    title: metadata.title ?? parseRoomTitle(html),
    isLive: metadata.isLive ?? parseIsLive(html),
  };
}

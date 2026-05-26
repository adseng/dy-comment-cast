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
  roomId: string;
  title: string;
  isLive: boolean;
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


function getSessionDeviceId(html: string): string {
  return String(7300000000000000000 + Math.floor(Math.random() * 1e14));
}

interface WebcastRoomWebEnterResponse {
  data: {
    data: {
      id_str: string;
      status: number;
      status_str: string;
      title: string;
      user_count_str: string;
      mosaic_status_str: string;
      admin_user_ids_str: string[];
      live_room_mode: number;
    }[];
    enter_room_id: string;
    user: {
      id_str: string;
      nickname: string;
      avatar_thumb: {
        url_list: string[];
      }
    };
    enter_mode: number;
    room_status: string;

  }
}

export function parseRoomMetadataFromEnterResponse(data: WebcastRoomWebEnterResponse): RoomMetadata | null {

  if (data == null) {
    return null;
  }
  const payload = data
  return {
    roomId: payload.data.enter_room_id,
    title: payload.data.data[0].title,
    isLive: payload.data.data[0].user_count_str === '0' ? false : true,
  }
}

async function fetchRoomMetadata(
  session: AxiosInstance,
  liveId: string,
  ttwid: string,
): Promise<RoomMetadata | null> {
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
    throw new Error('获取 ttwid 失败');
  }

  const page = await session.get(`https://live.douyin.com/${liveId}`, {
    headers: {
      Cookie: `ttwid=${ttwid}; msToken=${randomMsToken()}; __ac_nonce=0123407cc00a9e438deb4`,
    },
  });

  const html = page.data as string;
  const metadata = await fetchRoomMetadata(session, liveId, ttwid);
  if (metadata == null) {
    throw new Error('获取直播间信息失败');
  }

  return {
    liveId,
    roomId: metadata.roomId,
    userUniqueId: getSessionDeviceId(html),
    ttwid,
    title: metadata.title,
    isLive: metadata.isLive,
  };
}

import { DanmakuEvent } from './events';
import { decodePayload, protoTypes } from './proto';

type UserLike = {
  nickName?: string;
  nickname?: string;
};

type MessagePayload = {
  user?: UserLike;
  content?: string;
  gift?: { name?: string };
  comboCount?: unknown;
  repeatCount?: unknown;
  totalCount?: unknown;
  count?: unknown;
  memberCount?: unknown;
  followCount?: unknown;
  displayShort?: string;
  displayMiddle?: string;
  displayLong?: string;
  total?: unknown;
  totalUser?: unknown;
  totalUserStr?: string;
  totalStr?: string;
  popularity?: unknown;
  popStr?: string;
  onlineUserForAnchor?: string;
  totalPvForAnchor?: string;
  status?: number;
};

function valueToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'object' && 'toString' in value && typeof value.toString === 'function') {
    return value.toString();
  }
  return '';
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const text = valueToString(value).trim();
    if (text) return text;
  }
  return '';
}

function userName(user: UserLike | undefined): string {
  return firstText(user?.nickName, user?.nickname, '未知用户');
}

function decodeCorePayload(method: string, payload: Uint8Array): MessagePayload | null {
  switch (method) {
    case 'WebcastChatMessage':
      return decodePayload(protoTypes.ChatMessage, payload) as MessagePayload;
    case 'WebcastGiftMessage':
      return decodePayload(protoTypes.GiftMessage, payload) as MessagePayload;
    case 'WebcastLikeMessage':
      return decodePayload(protoTypes.LikeMessage, payload) as MessagePayload;
    case 'WebcastChatLikeMessage':
      return decodePayload(protoTypes.ChatLikeMessage, payload) as MessagePayload;
    case 'WebcastMemberMessage':
      return decodePayload(protoTypes.MemberMessage, payload) as MessagePayload;
    case 'WebcastSocialMessage':
      return decodePayload(protoTypes.SocialMessage, payload) as MessagePayload;
    case 'WebcastFansclubMessage':
      return decodePayload(protoTypes.FansclubMessage, payload) as MessagePayload;
    case 'WebcastRoomStatsMessage':
      return decodePayload(protoTypes.RoomStatsMessage, payload) as MessagePayload;
    case 'WebcastRoomUserSeqMessage':
      return decodePayload(protoTypes.RoomUserSeqMessage, payload) as MessagePayload;
    case 'WebcastControlMessage':
      return decodePayload(protoTypes.ControlMessage, payload) as MessagePayload;
    default:
      return null;
  }
}

export function parseMessage(method: string, payload: Uint8Array): DanmakuEvent | null {
  const message = decodeCorePayload(method, payload);
  if (!message) {
    console.log(`[未处理消息] ${method}`);
    return null;
  }

  switch (method) {
    case 'WebcastChatMessage': {
      const content = firstText(message.content);
      return content ? { type: 'chat', user: userName(message.user), content } : null;
    }
    case 'WebcastGiftMessage':
      return {
        type: 'gift',
        user: userName(message.user),
        gift: firstText(message.gift?.name, '未知礼物'),
        count: firstText(message.comboCount, message.repeatCount, message.totalCount, '1'),
      };
    case 'WebcastLikeMessage':
    case 'WebcastChatLikeMessage':
      if (!message.user && firstText(message.count) === '0') return null;
      return { type: 'like', user: userName(message.user), count: firstText(message.count, '1') };
    case 'WebcastMemberMessage':
      return { type: 'member', user: userName(message.user) };
    case 'WebcastSocialMessage':
      return { type: 'social', user: userName(message.user) };
    case 'WebcastFansclubMessage': {
      const content = firstText(message.content);
      return content ? { type: 'fansclub', user: userName(message.user), content } : null;
    }
    case 'WebcastRoomStatsMessage': {
      const display = firstText(message.displayShort, message.displayMiddle, message.displayLong, message.total);
      return display ? { type: 'roomStats', display } : null;
    }
    case 'WebcastRoomUserSeqMessage': {
      const current = firstText(message.onlineUserForAnchor, message.totalUser);
      const total = firstText(message.totalPvForAnchor, message.totalStr, message.totalUserStr);
      return current || total ? { type: 'roomStats', current, total } : null;
    }
    case 'WebcastControlMessage':
      return message.status === 3 ? { type: 'control', status: 3, message: '直播间已下播' } : null;
    default:
      return null;
  }
}


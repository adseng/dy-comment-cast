import path from 'path';
import protobuf from 'protobufjs';

const root = protobuf.loadSync(path.join(process.cwd(), 'proto/douyin.proto'));

function lookup<T extends protobuf.Type>(name: string): T {
  return root.lookupType(`douyin.${name}`) as T;
}

export const protoTypes = {
  PushFrame: lookup('PushFrame'),
  Response: lookup('Response'),
  Message: lookup('Message'),
  ChatMessage: lookup('ChatMessage'),
  GiftMessage: lookup('GiftMessage'),
  LikeMessage: lookup('LikeMessage'),
  ChatLikeMessage: lookup('ChatLikeMessage'),
  MemberMessage: lookup('MemberMessage'),
  SocialMessage: lookup('SocialMessage'),
  ControlMessage: lookup('ControlMessage'),
  FansclubMessage: lookup('FansclubMessage'),
  RoomStatsMessage: lookup('RoomStatsMessage'),
  RoomUserSeqMessage: lookup('RoomUserSeqMessage'),
};

export function decodePayload<T extends protobuf.Message>(type: protobuf.Type, payload: Uint8Array): T {
  return type.decode(payload) as T;
}

export function encodeMessage(type: protobuf.Type, payload: protobuf.Message): Uint8Array {
  return type.encode(payload).finish();
}

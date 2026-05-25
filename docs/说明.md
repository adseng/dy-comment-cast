# TypeScript 对接抖音直播 Webcast 弹幕

本项目使用 `ws + protobufjs + zlib` 连接抖音直播 Webcast WebSocket，解析弹幕、礼物、点赞、进场、关注、房间统计和粉丝团消息。

## 运行流程

```text
LIVE_ID
  -> src/room.ts              获取 roomId、标题、直播状态、ttwid、userUniqueId
  -> src/signature.ts         生成 WebSocket signature
  -> src/danmaku.ts           建立连接、解 PushFrame、回 ack、管理重连
  -> src/message-parser.ts    按 method 解析 payload
  -> src/events.ts            格式化输出
```

## 配置

复制 `.env.example` 为 `.env.local`，至少配置：

```env
LIVE_ID=你的抖音直播间 web_rid
```

`LIVE_ID` 是直播间链接末尾的 `web_rid`，例如：

```text
https://live.douyin.com/452550646709
```

常用可选项：

```env
WEBCAST_WS_HOST=webcast100-ws-web-lq.douyin.com
WEBCAST_SDK_VERSION=1.0.14-beta.0
RECONNECT_DELAY_MS=3000
HEARTBEAT_INTERVAL_MS=5000
STALE_TIMEOUT_MS=45000
USER_AGENT=Mozilla/5.0 ...
DEBUG_MESSAGES=1
DEBUG_METHODS=WebcastChatLikeMessage,WebcastRoomStatsMessage
DEBUG_PAYLOAD_HEX=1
```

## 启动

```bash
pnpm install
pnpm dev
```

正常输出示例：

```text
直播间：示例直播间（room_id=...）
状态：直播中
连接弹幕服务器...
✅ 抖音弹幕连接成功
等待弹幕、礼物、点赞、进场、关注或房间统计...
[弹幕] 张三：你好
[礼物] 李四 送出：小心心 x3
[点赞] 王五 x9
[进场] 赵六
[关注] 小明
[统计] 当前观看人数: 22164, 累计观看人数: 43.6万
[粉丝团] 恭喜 安好． 成为粉丝团第289687名成员
```

短时间没有 `[弹幕]` 不一定是异常。只要还能收到统计、点赞、进场等事件，说明 WebSocket 和 protobuf 解码链路仍然可用。

## 已支持消息

```text
WebcastChatMessage        -> chat
WebcastGiftMessage        -> gift
WebcastLikeMessage        -> like
WebcastChatLikeMessage    -> like
WebcastMemberMessage      -> member
WebcastSocialMessage      -> social
WebcastRoomStatsMessage   -> roomStats
WebcastRoomUserSeqMessage -> roomStats
WebcastFansclubMessage    -> fansclub
WebcastControlMessage     -> control
```

## 解码流程

WebSocket 收到的是 protobuf 二进制数据，不是 JSON：

1. 按 `PushFrame` 解码。
2. 对 `PushFrame.payload` 做 gzip 解压。
3. 按 `Response` 解码。
4. 遍历 `Response.messages`。
5. 按 `message.method` 选择对应业务 message 解码。
6. 转换为 `DanmakuEvent` 并输出。
7. 如果 `Response.needAck` 为 true，回发 ack。

## 调试

查看所有未覆盖 method：

```powershell
$env:DEBUG_MESSAGES='1'; pnpm dev
```

只看指定 method：

```powershell
$env:DEBUG_METHODS='WebcastChatLikeMessage,WebcastRoomStatsMessage'; pnpm dev
```

输出指定 method 的 payload 前 64 字节 hex：

```powershell
$env:DEBUG_METHODS='WebcastChatLikeMessage'; $env:DEBUG_PAYLOAD_HEX='1'; pnpm dev
```

示例：

```text
[未处理消息] WebcastResidentGuestMessage
[调试消息] WebcastChatLikeMessage payload=000102ff
```

调试输出不会打印 cookie、签名或完整 WebSocket URL。

## 常见问题

### 连接成功但没有弹幕

直播间没人发文本弹幕时正常。可用房间统计、点赞、进场等事件确认链路是否正常。

### 出现未处理消息

表示当前项目还没有覆盖该协议事件，不代表连接失败。支持新消息通常需要：

1. 在 `proto/douyin.proto` 增加对应 message 结构。
2. 在 `src/proto.ts` 暴露该类型。
3. 在 `src/message-parser.ts` 解析为 `DanmakuEvent`。

### PowerShell profile warning

如果终端出现 `Set-PSReadLineOption` warning，这是 PowerShell profile 输出能力问题，不影响程序运行。

## 验证

```bash
pnpm build
pnpm test
```

`pnpm test` 会先构建 TypeScript，再运行 Node 内置测试。

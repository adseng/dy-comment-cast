# dy-comment-cast

TypeScript 客户端，连接抖音直播 Webcast WebSocket，解析并输出弹幕、礼物、点赞、进场、关注、房间统计、粉丝团及下播事件。

技术栈：`ws` · `protobufjs` · `zlib` · `axios`

## 快速开始

```bash
pnpm install
cp .env.example .env.local   # 填入 LIVE_ID
pnpm dev
```

`LIVE_ID` 是直播间 URL 末尾的 `web_rid`，不是 `room_id`：

```text
https://live.douyin.com/452550646709
                      ^^^^^^^^^^^^
                      LIVE_ID
```

## 运行流程

```text
LIVE_ID
  -> room.ts           获取 ttwid、roomId、标题、直播状态
  -> signature.ts      用 lib/sign.js 生成 WebSocket signature
  -> danmaku.ts        建连、解 PushFrame、回 ack、心跳、超时重连
  -> message-parser.ts 按 method 解码 payload
  -> events.ts         格式化为控制台输出
```

连接建立后，WebSocket 二进制帧经 gzip 解压、protobuf 解码，再按 `message.method` 路由到对应业务类型。

## 项目结构

```text
src/
  main.ts              入口
  config.ts            环境变量
  room.ts              房间信息与 ttwid
  signature.ts         签名生成
  danmaku.ts           WebSocket 连接与重连
  message-parser.ts    消息解析
  events.ts            事件类型与输出格式
  proto.ts             protobuf 类型加载
proto/douyin.proto     协议定义
lib/sign.js            抖音签名算法（VM 执行）
```

## 配置

读取 `.env`，`.env.local` 覆盖同名项。必填项：

| 变量 | 说明 |
|------|------|
| `LIVE_ID` | 直播间 `web_rid` |

可选项（均有默认值，见 `src/config.ts`）：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `WEBCAST_WS_HOST` | `webcast100-ws-web-lq.douyin.com` | WebSocket 域名 |
| `WEBCAST_SDK_VERSION` | `1.0.14-beta.0` | SDK 版本 |
| `RECONNECT_DELAY_MS` | `3000` | 断线重连间隔（毫秒） |
| `HEARTBEAT_INTERVAL_MS` | `5000` | 心跳间隔（毫秒） |
| `STALE_TIMEOUT_MS` | `45000` | 无消息超时重连（毫秒） |
| `USER_AGENT` | Chrome 140 | 请求 User-Agent |

## 输出示例

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
直播间已下播
```

短时间没有 `[弹幕]` 不一定是异常；只要还能收到统计、点赞、进场等事件，说明连接和解码链路正常。

## 已支持消息

| method | 事件类型 | 输出前缀 |
|--------|----------|----------|
| `WebcastChatMessage` | chat | `[弹幕]` |
| `WebcastGiftMessage` | gift | `[礼物]` |
| `WebcastLikeMessage` | like | `[点赞]` |
| `WebcastChatLikeMessage` | like | `[点赞]` |
| `WebcastMemberMessage` | member | `[进场]` |
| `WebcastSocialMessage` | social | `[关注]` |
| `WebcastRoomStatsMessage` | roomStats | `[统计]` |
| `WebcastRoomUserSeqMessage` | roomStats | `[统计]` |
| `WebcastFansclubMessage` | fansclub | `[粉丝团]` |
| `WebcastControlMessage` | control | 下播提示 |

未覆盖的 method 会输出 `[未处理消息] <method>`，不代表连接失败。

## 解码流程

1. 按 `PushFrame` 解码 WebSocket 帧
2. 对 `payload` 做 gzip 解压
3. 按 `Response` 解码
4. 遍历 `messages`，按 `method` 选择业务 message 解码
5. 转换为 `DanmakuEvent` 并输出
6. 若 `needAck` 为 true，回发 ack

协议细节见 [docs/数据类型.md](docs/数据类型.md)。

## 扩展新消息类型

1. 在 `proto/douyin.proto` 添加 message 结构
2. 在 `src/proto.ts` 暴露该类型
3. 在 `src/message-parser.ts` 解码并映射为 `DanmakuEvent`
4. 在 `src/events.ts` 补充输出格式

## 常见问题

**连接成功但没有弹幕** — 直播间无人发文本弹幕时正常，可用统计、点赞、进场等事件确认链路。

**出现 `[未处理消息]`** — 协议中存在尚未实现的事件类型，按需按上方步骤扩展即可。

**PowerShell profile warning** — `Set-PSReadLineOption` 警告来自终端配置，不影响程序运行。

## 脚本

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 编译并启动 |
| `pnpm build` | 仅编译 TypeScript |
| `pnpm start` | 运行 `dist/main.js` |
| `pnpm test` | 编译后运行 Node 内置测试 |

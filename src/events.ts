export type DanmakuEvent =
  | { type: 'chat'; user: string; content: string }
  | { type: 'gift'; user: string; gift: string; count: string }
  | { type: 'like'; user: string; count: string }
  | { type: 'member'; user: string }
  | { type: 'social'; user: string }
  | { type: 'roomStats'; current?: string; total?: string; display?: string }
  | { type: 'fansclub'; user: string; content: string }
  | { type: 'control'; status: number; message: string };

export function formatDanmakuEvent(event: DanmakuEvent): string | null {
  switch (event.type) {
    case 'chat':
      return event.content ? `[弹幕] ${event.user}：${event.content}` : null;
    case 'gift':
      return `[礼物] ${event.user} 送出：${event.gift} x${event.count}`;
    case 'like':
      return `[点赞] ${event.user} x${event.count}`;
    case 'member':
      return `[进场] ${event.user}`;
    case 'social':
      return `[关注] ${event.user}`;
    case 'roomStats': {
      if (event.current && event.total) {
        return `[统计] 当前观看人数: ${event.current}, 累计观看人数: ${event.total}`;
      }
      const display = event.display ?? event.current ?? event.total;
      return display ? `[统计] ${display}` : null;
    }
    case 'fansclub':
      return event.content ? `[粉丝团] ${event.content}` : null;
    case 'control':
      return event.message;
  }
}


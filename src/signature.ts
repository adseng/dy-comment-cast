import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const SIGN_KEYS = [
  'live_id',
  'aid',
  'version_code',
  'webcast_sdk_version',
  'room_id',
  'sub_room_id',
  'sub_channel_id',
  'did_rule',
  'user_unique_id',
  'device_platform',
  'device_type',
  'ac',
  'identity',
] as const;

let signContext: vm.Context | null = null;

function getSignContext(userAgent: string): vm.Context {
  if (signContext) return signContext;

  const script = fs.readFileSync(path.join(process.cwd(), 'lib/sign.js'), 'utf8');
  const context: vm.Context = {
    document: {},
    window: {},
    navigator: { userAgent },
  };
  vm.createContext(context);
  vm.runInContext(script, context);
  signContext = context;
  return context;
}

export function generateSignature(wssUrl: string, userAgent: string): string {
  const query = new URL(wssUrl).searchParams;
  const param = SIGN_KEYS.map((key) => `${key}=${query.get(key) ?? ''}`).join(',');
  const md5 = crypto.createHash('md5').update(param).digest('hex');
  const context = getSignContext(userAgent);
  const getSign = context.get_sign as (value: string) => string;
  return getSign(md5);
}

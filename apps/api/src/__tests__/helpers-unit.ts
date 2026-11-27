import { sha256Hex } from '../common/utils/crypto';
import { deviceLabel as label } from '../auth/auth.types';

export const hashSecret = (v: string): string => sha256Hex(v);
export const deviceLabel = (ua: string | null): string | null => label(ua);

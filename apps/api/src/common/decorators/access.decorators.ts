import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';
export const SKIP_CSRF = 'skipCsrf';
export const ALLOW_PASSWORD_CHANGE = 'allowPasswordChange';

/** Route does not require an access token. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
/** Route accepts unsafe requests without the double-submit CSRF header (origin is still checked). */
export const SkipCsrf = () => SetMetadata(SKIP_CSRF, true);
/** Route stays reachable while the account must change its password. */
export const AllowPasswordChange = () => SetMetadata(ALLOW_PASSWORD_CHANGE, true);

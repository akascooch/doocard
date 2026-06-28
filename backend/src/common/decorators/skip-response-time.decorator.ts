import { SetMetadata } from '@nestjs/common';

export const SKIP_RESPONSE_TIME_KEY = 'skipResponseTime';

/** Skip X-Response-Time header (required for streamed/file downloads). */
export const SkipResponseTime = () => SetMetadata(SKIP_RESPONSE_TIME_KEY, true);

import {
  EdgeFunctionHttpError,
  EdgeFunctionRateLimitError,
  EdgeFunctionSubscriptionLockedError,
} from '../edgeFunctionClient';
import { showToast } from '../toast';
import { t } from '../i18n';

export function surfaceRenderEnqueueFailureToast(err: unknown): void {
  if (err instanceof EdgeFunctionRateLimitError) {
    showToast(
      'error',
      t('studio.enqueueFailed.rateLimit.title'),
      t('studio.enqueueFailed.rateLimit.body', { seconds: err.retryAfter }),
    );
    return;
  }
  if (err instanceof EdgeFunctionSubscriptionLockedError) {
    showToast(
      'error',
      t('studio.enqueueFailed.credits.title'),
      t('studio.enqueueFailed.credits.body'),
    );
    return;
  }
  if (err instanceof EdgeFunctionHttpError && err.status === 401) {
    showToast(
      'error',
      t('studio.enqueueFailed.auth.title'),
      t('studio.enqueueFailed.auth.body'),
    );
    return;
  }
  showToast(
    'error',
    t('studio.enqueueFailed.generic.title'),
    t('studio.enqueueFailed.generic.body'),
  );
}

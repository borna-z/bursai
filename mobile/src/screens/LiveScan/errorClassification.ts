// Maps thrown errors from each pipeline stage to a stable enum the UI uses to
// pick the right tile icon and (eventually) toast copy. Pure function — no
// side effects, no logging. Sentry capture happens in the caller so test
// scaffolding can stay simple.

import {
  EdgeFunctionHttpError,
  EdgeFunctionRateLimitError,
  EdgeFunctionSubscriptionLockedError,
} from '../../lib/edgeFunctionClient';
import type { PipelineErrorClass, PipelineStage } from './types';

export function classifyPipelineError(
  err: unknown,
  stage: PipelineStage,
): PipelineErrorClass {
  if (stage === 'compress') return 'compress_failed';
  if (stage === 'upload') return 'upload_failed';

  if (stage === 'analyze') {
    if (err instanceof EdgeFunctionRateLimitError) return 'analyze_rate_limit';
    if (err instanceof EdgeFunctionSubscriptionLockedError) return 'analyze_subscription';
    if (err instanceof EdgeFunctionHttpError) {
      if (err.status === 401) return 'analyze_auth';
      return 'analyze_http';
    }
    return 'analyze_unknown';
  }

  if (stage === 'persist') {
    if (err instanceof EdgeFunctionHttpError && err.status === 401) return 'auth_failed';
    return 'persist_failed';
  }

  return 'unknown';
}

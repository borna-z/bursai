import {
  EdgeFunctionHttpError,
  EdgeFunctionRateLimitError,
  EdgeFunctionSubscriptionLockedError,
} from '../../../lib/edgeFunctionClient';
import { classifyPipelineError } from '../errorClassification';

describe('classifyPipelineError', () => {
  it('classifies rate-limit', () => {
    expect(classifyPipelineError(new EdgeFunctionRateLimitError('analyze_garment', 30), 'analyze'))
      .toBe('analyze_rate_limit');
  });
  it('classifies subscription-locked as analyze_subscription', () => {
    expect(classifyPipelineError(new EdgeFunctionSubscriptionLockedError('analyze_garment'), 'analyze'))
      .toBe('analyze_subscription');
  });
  it('classifies 401 as analyze_auth', () => {
    expect(classifyPipelineError(new EdgeFunctionHttpError('analyze_garment', 401, ''), 'analyze'))
      .toBe('analyze_auth');
  });
  it('classifies generic 5xx as analyze_http', () => {
    expect(classifyPipelineError(new EdgeFunctionHttpError('analyze_garment', 502, ''), 'analyze'))
      .toBe('analyze_http');
  });
  it('classifies compress failure', () => {
    expect(classifyPipelineError(new Error('boom'), 'compress')).toBe('compress_failed');
  });
  it('classifies upload failure', () => {
    expect(classifyPipelineError(new Error('boom'), 'upload')).toBe('upload_failed');
  });
  it('falls back to persist_failed on persist stage', () => {
    expect(classifyPipelineError(new Error('weird'), 'persist')).toBe('persist_failed');
  });
});

// Audit issue #5 — guarantees that the PII scrubber strips auth headers,
// redacts sensitive keys, and trims event.user to the minimal pair.

import type { ErrorEvent } from '@sentry/react-native';

import { beforeSend } from '../sentryBeforeSend';

function makeEvent(partial: Partial<ErrorEvent>): ErrorEvent {
  return partial as ErrorEvent;
}

describe('beforeSend', () => {
  it('strips Authorization, authorization, Cookie, cookie, and X-API-Key headers', () => {
    const ev = beforeSend(
      makeEvent({
        request: {
          headers: {
            Authorization: 'Bearer abc',
            authorization: 'Bearer abc',
            Cookie: 'sid=1',
            cookie: 'sid=1',
            'X-API-Key': 'xyz',
            'x-api-key': 'xyz',
            'Content-Type': 'application/json',
          },
        },
      }),
    );
    const headers = ev?.request?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
    expect(headers.authorization).toBeUndefined();
    expect(headers.Cookie).toBeUndefined();
    expect(headers.cookie).toBeUndefined();
    expect(headers['X-API-Key']).toBeUndefined();
    expect(headers['x-api-key']).toBeUndefined();
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('redacts sensitive keys in extra (email/token/key/secret/password/stripe/payment)', () => {
    const ev = beforeSend(
      makeEvent({
        extra: {
          email: 'a@b.c',
          token: 'jwt-xyz',
          api_key: 'k',
          secret_value: 's',
          password: 'p',
          stripe_id: 'cus_1',
          payment_method: 'pm_1',
          unrelated: 42,
          count: 3,
        },
      }),
    );
    expect(ev?.extra).toEqual({
      email: '[REDACTED]',
      token: '[REDACTED]',
      api_key: '[REDACTED]',
      secret_value: '[REDACTED]',
      password: '[REDACTED]',
      stripe_id: '[REDACTED]',
      payment_method: '[REDACTED]',
      unrelated: 42,
      count: 3,
    });
  });

  it('redacts sensitive keys recursively in nested extra', () => {
    const ev = beforeSend(
      makeEvent({
        extra: {
          nested: { stripe_id: 'cus_1', detail: { token: 't' } },
          list: [{ email: 'x@y' }, { name: 'ok' }],
        },
      }),
    );
    expect(ev?.extra).toEqual({
      nested: { stripe_id: '[REDACTED]', detail: { token: '[REDACTED]' } },
      list: [{ email: '[REDACTED]' }, { name: 'ok' }],
    });
  });

  it('trims event.user to id + ip_address only', () => {
    const ev = beforeSend(
      makeEvent({
        user: {
          id: 'user-1',
          ip_address: '1.2.3.4',
          email: 'a@b.c',
          username: 'a',
          // Sentry types allow extra props
          name: 'Alice',
        } as unknown as ErrorEvent['user'],
      }),
    );
    expect(ev?.user).toEqual({ id: 'user-1', ip_address: '1.2.3.4' });
  });

  it('returns the event when there are no PII surfaces to scrub', () => {
    const ev = beforeSend(
      makeEvent({
        message: 'plain error',
        tags: { route: '/wardrobe' },
      }),
    );
    expect(ev?.message).toBe('plain error');
    expect(ev?.tags).toEqual({ route: '/wardrobe' });
  });
});

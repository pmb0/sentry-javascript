import { SEMANTIC_ATTRIBUTE_SENTRY_OP, SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN } from '@sentry/core';
import { addNonEnumerableProperty } from '@sentry/utils';
import type { InjectableTarget } from './types';

const sentryPatched = 'sentryPatched';

/**
 * Helper checking if a concrete target class is already patched.
 *
 * We already guard duplicate patching with isWrapped. However, isWrapped checks whether a file has been patched, whereas we use this check for concrete target classes.
 * This check might not be necessary, but better to play it safe.
 */
export function isPatched(target: InjectableTarget): boolean {
  if (target.sentryPatched) {
    return true;
  }

  addNonEnumerableProperty(target, sentryPatched, true);
  return false;
}

/**
 * Returns span options for nest middleware spans.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function getMiddlewareSpanOptions(target: InjectableTarget) {
  return {
    name: target.name,
    attributes: {
      [SEMANTIC_ATTRIBUTE_SENTRY_OP]: 'middleware.nestjs',
      [SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN]: 'auto.middleware.nestjs',
    },
  };
}

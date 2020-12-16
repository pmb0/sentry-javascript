import { Event, SentryRequest, Session } from '@sentry/types';
import { base64ToUnicode, logger } from '@sentry/utils';

import { API } from './api';

/**
 * Create a SentryRequest from an error, message, or transaction event.
 *
 * @param event The event to send
 * @param api Helper to provide the correct url for the request
 * @returns SentryRequest representing the event
 */
export function eventToSentryRequest(event: Event, api: API): SentryRequest {
  if (event.type === 'transaction') {
    return transactionToSentryRequest(event, api);
  }
  return {
    body: JSON.stringify(event),
    type: event.type || 'event',
    url: api.getStoreEndpointWithUrlEncodedAuth(),
  };
}

/**
 * Create a SentryRequest from a transaction event.
 *
 * Since we don't need to manipulate envelopes nor store them, there is no exported concept of an Envelope with
 * operations including serialization and deserialization. Instead, we only implement a minimal subset of the spec to
 * serialize events inline here. See https://develop.sentry.dev/sdk/envelopes/.
 *
 * @param event The transaction event to send
 * @param api Helper to provide the correct url for the request
 * @returns SentryRequest in envelope form
 */
export function transactionToSentryRequest(event: Event, api: API): SentryRequest {
  // pull our temporary values out of the tags, so they don't get sent to Sentry
  const {
    __sentry_samplingMethod: samplingMethod,
    __sentry_sampleRate: sampleRate,
    __sentry_tracestate: encodedTracestate,
    ...otherTags
  } = event.tags || {};
  event.tags = otherTags;

  // the tracestate is stored in bas64-encoded JSON, but envelope header values are expected to be full JS values,
  // so we have to decode and reinflate it
  let tracestate;
  try {
    tracestate = JSON.parse(base64ToUnicode(encodedTracestate as string));
  } catch (err) {
    logger.warn(err);
  }

  const envelopeHeaders = JSON.stringify({
    event_id: event.event_id,
    sent_at: new Date().toISOString(),
    ...(tracestate && { trace: tracestate }), // trace context for dynamic sampling on relay
  });

  const itemHeaders = JSON.stringify({
    type: event.type,

    // TODO: Right now, sampleRate will be undefined in the cases of inheritance and explicitly-set sampling decisions.
    sample_rates: [{ id: samplingMethod, rate: sampleRate }],

    // Note: `content_type` and `length` were left out on purpose. Here's a quick explanation of why, along with the
    // value to use if we ever decide to put them back in.
    //
    // `content_type`:
    // Assumed to be 'application/json' and not part of the current spec for transaction items. No point in bloating the
    // request body with it.
    //
    // would be:
    // content_type: 'application/json',
    //
    // `length`:
    // Optional and equal to the number of bytes in req.Body encoded as UTF-8. Since the server can figure this out and
    // would otherwise refuse events that report the length incorrectly, we decided not to send the length to avoid
    // problems related to reporting the wrong size and to reduce request body size.
    //
    // would be:
    // length: new TextEncoder().encode(req.body).length,
  });

  const req: SentryRequest = {
    // The trailing newline is optional; leave it off to avoid sending unnecessary bytes.
    // body: `${envelopeHeaders}\n${itemHeaders}\n${JSON.stringify(event)\n}`,
    body: `${envelopeHeaders}\n${itemHeaders}\n${JSON.stringify(event)}`,
    type: 'transaction',
    url: api.getEnvelopeEndpointWithUrlEncodedAuth(),
  };

  return req;
}

/**
 * Create a SentryRequest from a session event.
 *
 * @param event The session event to send
 * @param api Helper to provide the correct url for the request
 * @returns SentryRequest in envelope form
 */
export function sessionToSentryRequest(session: Session, api: API): SentryRequest {
  const envelopeHeaders = JSON.stringify({
    sent_at: new Date().toISOString(),
  });
  const itemHeaders = JSON.stringify({
    type: 'session',
  });

  return {
    body: `${envelopeHeaders}\n${itemHeaders}\n${JSON.stringify(session)}`,
    type: 'session',
    url: api.getEnvelopeEndpointWithUrlEncodedAuth(),
  };
}

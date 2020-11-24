import { Event, TransactionSamplingMethod } from '@sentry/types';

import { API } from '../../src/api';
import { eventToSentryRequest } from '../../src/request';

describe('eventToSentryRequest', () => {
  const api = new API('https://dogsarebadatkeepingsecrets@squirrelchasers.ingest.sentry.io/12312012');
  const event: Event = {
    contexts: { trace: { trace_id: '1231201211212012', span_id: '12261980', op: 'pageload' } },
    environment: 'dogpark',
    event_id: '0908201304152013',
    release: 'off.leash.park',
    spans: [],
    transaction: '/dogs/are/great/',
    type: 'transaction',
    user: { id: '1121', username: 'CharlieDog', ip_address: '11.21.20.12' },
  };

  it('injects correct data for error/message events', () => {
    const event = {
      event_id: '1231201211212012',
      exception: { values: [{ type: 'PuppyProblemsError', value: 'Charlie ate the flip-flops :-(' }] },
      user: { id: '1121', username: 'CharlieDog', ip_address: '11.21.20.12' },
    };

    const result = eventToSentryRequest(event, api);
    expect(result.type).toEqual('event');
    expect(result.url).toEqual(
      'https://squirrelchasers.ingest.sentry.io/api/12312012/store/?sentry_key=dogsarebadatkeepingsecrets&sentry_version=7',
    );
    expect(result.body).toEqual(JSON.stringify(event));
  });

  it('injects correct data for transaction events', () => {
    const eventId = '1231201211212012';
    const traceId = '0908201304152013';
    const event = {
      contexts: { trace: { trace_id: traceId, span_id: '12261980', op: 'pageload' } },
      environment: 'dogpark',
      event_id: eventId,
      release: 'off.leash.park',
      spans: [],
      transaction: '/dogs/are/great/',
      type: 'transaction',
      user: { id: '1121', username: 'CharlieDog', ip_address: '11.21.20.12' },
    };

    const result = eventToSentryRequest(event as Event, api);

    const [envelopeHeaderString, itemHeaderString, eventString] = result.body.split('\n');

    const envelope = {
      envelopeHeader: JSON.parse(envelopeHeaderString),
      itemHeader: JSON.parse(itemHeaderString),
      event: JSON.parse(eventString),
    };

    expect(result.type).toEqual('transaction');
    expect(result.url).toEqual(
      'https://squirrelchasers.ingest.sentry.io/api/12312012/envelope/?sentry_key=dogsarebadatkeepingsecrets&sentry_version=7',
    );
    expect(envelope.envelopeHeader).toEqual({
      event_id: eventId,
      sent_at: expect.any(String),
      trace: {
        environment: 'dogpark',
        public_key: 'dogsarebadatkeepingsecrets',
        release: 'off.leash.park',
        trace_id: traceId,
      },
    });
    expect(envelope.itemHeader).toEqual({
      type: 'transaction',
      sample_rates: expect.any(Array),
    });
    expect(envelope.event).toEqual(event);
  });

  [
    { method: TransactionSamplingMethod.Rate, rate: '0.1121', dog: 'Charlie' },
    { method: TransactionSamplingMethod.Sampler, rate: '0.1231', dog: 'Maisey' },
    { method: TransactionSamplingMethod.Inheritance, dog: 'Cory' },
    { method: TransactionSamplingMethod.Explicit, dog: 'Bodhi' },

    // this shouldn't ever happen (tags should always include at least the sampling method), but good to know that
    // things won't blow up if it does happen
    { dog: 'Lucy' },
  ].forEach(({ method, rate, dog }) => {
    it(`adds transaction sampling information to item header - ${method}, ${rate}, ${dog}`, () => {
      // TODO kmclb - once tag types are loosened, don't need to cast to string here
      event.tags = { __sentry_samplingMethod: String(method), __sentry_sampleRate: String(rate), dog };

      const result = eventToSentryRequest(event as Event, api);

      const [envelopeHeaderString, itemHeaderString, eventString] = result.body.split('\n');

      const envelope = {
        envelopeHeader: JSON.parse(envelopeHeaderString),
        itemHeader: JSON.parse(itemHeaderString),
        event: JSON.parse(eventString),
      };

      // the right stuff is added to the item header
      expect(envelope.itemHeader).toEqual({
        type: 'transaction',
        // TODO kmclb - once tag types are loosened, don't need to cast to string here
        sample_rates: [{ id: String(method), rate: String(rate) }],
      });

      // show that it pops the right tags and leaves the rest alone
      expect('__sentry_samplingMethod' in envelope.event.tags).toBe(false);
      expect('__sentry_sampleRate' in envelope.event.tags).toBe(false);
      expect('dog' in envelope.event.tags).toBe(true);
    });
  });
});

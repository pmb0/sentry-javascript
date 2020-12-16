import { Event, TransactionSamplingMethod } from '@sentry/types';
import { computeTracestate } from '@sentry/utils';

import { API } from '../../src/api';
import { eventToSentryRequest } from '../../src/request';

describe('eventToSentryRequest', () => {
  const public_key = 'dogsarebadatkeepingsecrets';
  const api = new API(`https://${public_key}@squirrelchasers.ingest.sentry.io/12312012`);

  const event_id = '1231201211212012';
  const trace_id = '0908201304152013';
  const environment = 'dogpark';
  const release = 'off.leash.park';

  const baseEvent: Event = {
    event_id,
    environment,
    release,
    contexts: { trace: { trace_id: trace_id, span_id: '12261980', op: 'ball.fetch' } },
    // TODO
    user: { id: '1121', username: 'CharlieDog', ip_address: '11.21.20.12' },
  };

  const errorEvent: Event = {
    ...baseEvent,
    exception: { values: [{ type: 'PuppyProblemsError', value: 'Charlie ate the flip-flops :-(' }] },
  };

  const tracestateObject = {
    trace_id,
    environment,
    release,
    public_key,
  };

  const transactionEvent: Event = {
    ...baseEvent,
    spans: [],
    tags: {
      dog: 'Charlie',
      __sentry_samplingMethod: TransactionSamplingMethod.Rate,
      __sentry_sampleRate: '.1121',
      __sentry_tracestate: computeTracestate(tracestateObject),
    },
    transaction: '/dogs/are/great/',
    type: 'transaction',
  };

  it('injects correct data for error/message events', () => {
    const event = { ...errorEvent };

    const result = eventToSentryRequest(event, api);

    expect(result.type).toEqual('event');
    expect(result.url).toEqual(
      'https://squirrelchasers.ingest.sentry.io/api/12312012/store/?sentry_key=dogsarebadatkeepingsecrets&sentry_version=7',
    );
    expect(result.body).toEqual(JSON.stringify(event));
  });

  it('injects correct data for transaction events', () => {
    const event = { ...transactionEvent };

    const result = eventToSentryRequest(event, api);

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
      event_id,
      sent_at: expect.any(String),
      trace: tracestateObject,
    });
    expect(envelope.itemHeader).toEqual({
      type: 'transaction',
      sample_rates: expect.any(Array),
    });
    expect(envelope.event).toEqual(event);
  });

  [
    // TODO kmclb - once tag types are loosened, don't need to cast rate and undefined to strings here
    { __sentry_samplingMethod: TransactionSamplingMethod.Rate, __sentry_sampleRate: '0.1121', dog: 'Charlie' },
    { __sentry_samplingMethod: TransactionSamplingMethod.Sampler, __sentry_sampleRate: '0.1231', dog: 'Maisey' },
    { __sentry_samplingMethod: TransactionSamplingMethod.Inheritance, __sentry_sampleRate: '', dog: 'Cory' },
    { __sentry_samplingMethod: TransactionSamplingMethod.Explicit, __sentry_sampleRate: '', dog: 'Bodhi' },

    // this shouldn't ever happen (tags should always include at least the sampling method), but good to know that
    // things won't blow up if it does happen
    { __sentry_samplingMethod: '', __sentry_sampleRate: '', dog: 'Lucy' },
  ].forEach(tags => {
    const { __sentry_samplingMethod: method, __sentry_sampleRate: rate, dog } = tags;

    it(`adds transaction sampling information to item header - ${method}, ${rate}, ${dog}`, () => {
      const event = {
        ...transactionEvent,
        tags,
      };

      const result = eventToSentryRequest(event, api);

      const itemHeaderJSON = result.body.split('\n')[1];
      const itemHeader = JSON.parse(itemHeaderJSON);

      expect(itemHeader).toEqual({
        type: 'transaction',
        // TODO kmclb - once tag types are loosened, don't need to cast to string here
        sample_rates: [{ id: String(method), rate: String(rate) }],
      });
    });
  });

  it('filters out temporary tags before sending (but leaves other tags alone)', () => {
    const event = { ...transactionEvent };

    const result = eventToSentryRequest(event, api);

    const eventString = result.body.split('\n')[2];
    const envelopeEvent = JSON.parse(eventString);
    const internalTags = Object.keys(envelopeEvent.tags).filter(tagName => tagName.startsWith('__sentry'));

    expect(internalTags).toEqual([]);
    expect('dog' in envelopeEvent.tags).toBe(true);
  });
});

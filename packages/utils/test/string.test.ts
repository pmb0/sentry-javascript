import { BASE64_REGEX, base64ToUnicode, isMatchingPattern, truncate, unicodeToBase64 } from '../src/string';

describe('truncate()', () => {
  test('it works as expected', () => {
    expect(truncate(null, 3)).toEqual(null);
    expect(truncate('lolol', 3)).toEqual('lol...');
    expect(truncate('lolol', 10)).toEqual('lolol');
    expect(truncate('1'.repeat(1000), 300)).toHaveLength(303);
    expect(truncate(new Array(1000).join('f'), 0)).toEqual(new Array(1000).join('f'));
    expect(truncate(new Array(1000).join('f'), 0)).toEqual(new Array(1000).join('f'));
  });
});

describe('isMatchingPattern()', () => {
  test('match using string substring', () => {
    expect(isMatchingPattern('foobar', 'foobar')).toEqual(true);
    expect(isMatchingPattern('foobar', 'foo')).toEqual(true);
    expect(isMatchingPattern('foobar', 'bar')).toEqual(true);
    expect(isMatchingPattern('foobar', 'nope')).toEqual(false);
  });

  test('match using regexp test', () => {
    expect(isMatchingPattern('foobar', /^foo/)).toEqual(true);
    expect(isMatchingPattern('foobar', /foo/)).toEqual(true);
    expect(isMatchingPattern('foobar', /b.{1}r/)).toEqual(true);
    expect(isMatchingPattern('foobar', /^foo$/)).toEqual(false);
  });

  test('should match empty pattern as true', () => {
    expect(isMatchingPattern('foo', '')).toEqual(true);
    expect(isMatchingPattern('bar', '')).toEqual(true);
    expect(isMatchingPattern('', '')).toEqual(true);
  });

  test('should bail out with false when given non-string value', () => {
    expect(isMatchingPattern(null, 'foo')).toEqual(false);
    expect(isMatchingPattern(undefined, 'foo')).toEqual(false);
    expect(isMatchingPattern({}, 'foo')).toEqual(false);
    expect(isMatchingPattern([], 'foo')).toEqual(false);
  });
});

describe('base64ToUnicode/unicodeToBase64', () => {
  const unicodeString = 'Dogs are great!';
  const base64String = 'RG9ncyBhcmUgZ3JlYXQh';

  test('converts to valid base64', () => {
    expect(BASE64_REGEX.test(unicodeToBase64(unicodeString))).toBe(true);
  });

  test('works as expected', () => {
    expect(unicodeToBase64(unicodeString)).toEqual(base64String);
    expect(base64ToUnicode(base64String)).toEqual(unicodeString);
  });

  test('conversion functions are inverses', () => {
    expect(base64ToUnicode(unicodeToBase64(unicodeString))).toEqual(unicodeString);
    expect(unicodeToBase64(base64ToUnicode(base64String))).toEqual(base64String);
  });

  test('can handle and preserve multi-byte characters in original string', () => {
    ['🐶', 'כלבים נהדרים!', 'Of margir hundar! Ég geri ráð fyrir að ég þurfi stærra rúm.'].forEach(orig => {
      expect(() => {
        unicodeToBase64(orig);
      }).not.toThrowError();
      expect(base64ToUnicode(unicodeToBase64(orig))).toEqual(orig);
    });
  });

  test('throws an error when given invalid input', () => {
    expect(() => {
      unicodeToBase64(null as any);
    }).toThrowError('Unable to convert to base64');
    expect(() => {
      unicodeToBase64(undefined as any);
    }).toThrowError('Unable to convert to base64');
    expect(() => {
      unicodeToBase64({} as any);
    }).toThrowError('Unable to convert to base64');

    expect(() => {
      base64ToUnicode(null as any);
    }).toThrowError('Unable to convert from base64');
    expect(() => {
      base64ToUnicode(undefined as any);
    }).toThrowError('Unable to convert from base64');
    expect(() => {
      base64ToUnicode({} as any);
    }).toThrowError('Unable to convert from base64');

    // Note that by design, in node base64 encoding and decoding will accept any string, whether or not it's valid
    // base64, by ignoring all invalid characters, including whitespace. Therefore, no wacky strings have been included
    // here because they don't actually error.
  });
});

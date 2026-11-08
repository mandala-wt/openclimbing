import { fetchText } from '../fetch';
import unfetch from 'isomorphic-unfetch';

jest.mock('isomorphic-unfetch', () => jest.fn());
const fetchMock = unfetch as unknown as jest.Mock;

const deferred = () => {
  let resolve: (value: unknown) => void = () => undefined;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

test('shares one request for the same URL while it is running', async () => {
  const pending = deferred();
  fetchMock.mockImplementation(() => pending.promise);
  const first = fetchText('https://example.test/catalog?inflight=1');
  const second = fetchText('https://example.test/catalog?inflight=1');
  pending.resolve({
    ok: true,
    status: 200,
    text: async () => 'catalog',
  });
  await expect(Promise.all([first, second])).resolves.toEqual([
    'catalog',
    'catalog',
  ]);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('a failed request is not kept, so the next call tries again', async () => {
  fetchMock.mockReset();
  fetchMock
    .mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Unavailable',
      text: async () => '',
    })
    .mockResolvedValueOnce({ ok: true, status: 200, text: async () => 'ok' });
  await expect(
    fetchText('https://example.test/catalog?inflight=2'),
  ).rejects.toThrow('503');
  await expect(
    fetchText('https://example.test/catalog?inflight=2'),
  ).resolves.toBe('ok');
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

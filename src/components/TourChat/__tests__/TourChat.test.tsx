import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Feature } from '../../../services/types';
import {
  FeatureContext,
  type FeatureContextType,
} from '../../utils/FeatureContext';
import { MapStateContext } from '../../utils/MapStateContext';
import { TourChat } from '../TourChat';

const originalFetch = global.fetch;
const originalEnabled = process.env.kletterglueckChatEnabled;
const fetchMock = jest.fn();

beforeEach(() => {
  process.env.kletterglueckChatEnabled = 'true';
  global.fetch = fetchMock;
  fetchMock.mockReset();
  Element.prototype.scrollIntoView = jest.fn();
});

afterEach(() => {
  global.fetch = originalFetch;
  if (originalEnabled === undefined)
    delete process.env.kletterglueckChatEnabled;
  else process.env.kletterglueckChatEnabled = originalEnabled;
});

const openChat = () => {
  render(<TourChat />);
  fireEvent.click(screen.getByRole('button', { name: 'Besprechen' }));
};

test('hidden when preview feature is disabled', () => {
  process.env.kletterglueckChatEnabled = 'false';
  render(<TourChat />);
  expect(screen.queryByRole('button', { name: 'Besprechen' })).toBeNull();
});

test('starts as an icon and opens a small field', () => {
  render(<TourChat />);
  expect(screen.getByRole('button', { name: 'Besprechen' })).toBeTruthy();
  expect(screen.queryByRole('textbox')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Besprechen' }));
  expect(screen.getByRole('textbox')).toBeTruthy();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
});

test('leaves the map interactive while the panel is open', () => {
  const onMarker = jest.fn();
  render(
    <div>
      <button type="button" onClick={onMarker}>
        Kartenmarker
      </button>
      <TourChat />
    </div>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Besprechen' }));
  const shell = screen.getByTestId('tour-help');
  expect(shell.style.pointerEvents).toBe('none');
  expect(shell.style.width).not.toBe('100vw');
  fireEvent.click(screen.getByRole('button', { name: 'Kartenmarker' }));
  expect(onMarker).toHaveBeenCalledTimes(1);
});

test('sends the question and the open view, then keeps the reply', async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ text: 'Den Knopf kleiner machen.' }),
  });
  render(
    <FeatureContext.Provider
      value={
        {
          feature: {
            osmMeta: { type: 'way', id: 9 },
            tags: { name: 'Norissteig', 'addr:city': 'Nürnberg' },
          },
        } as FeatureContextType
      }
    >
      <MapStateContext.Provider
        value={{ view: ['14', '49.450000', '11.070000'] } as never}
      >
        <TourChat />
      </MapStateContext.Provider>
    </FeatureContext.Provider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Besprechen' }));
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'Den Hinweis kleiner' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Senden' }));
  await screen.findByText('Den Knopf kleiner machen.');
  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(body.messages).toEqual([
    { role: 'user', content: 'Den Hinweis kleiner' },
  ]);
  expect(body.view).toEqual({
    label: 'Norissteig, Nürnberg',
    href: '/way/9',
    zoom: '14',
    lat: '49.450000',
    lon: '11.070000',
  });
});

test('keeps the question when the request fails', async () => {
  fetchMock.mockResolvedValue({
    ok: false,
    json: async () => ({ error: 'Budget erreicht' }),
  });
  openChat();
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'Meine Frage' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Senden' }));
  await screen.findByText('Budget erreicht');
  await waitFor(() =>
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe(
      'Meine Frage',
    ),
  );
});

test('does not send when only the selection changes', () => {
  const view = (feature: Partial<Feature> | null) => (
    <FeatureContext.Provider value={{ feature } as FeatureContextType}>
      <TourChat />
    </FeatureContext.Provider>
  );
  const { rerender } = render(view(null));
  fireEvent.click(screen.getByRole('button', { name: 'Besprechen' }));
  rerender(view({ tags: { name: 'Norissteig' } } as Partial<Feature>));
  expect(fetchMock).not.toHaveBeenCalled();
});

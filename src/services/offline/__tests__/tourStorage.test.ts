import { estimateTourSize } from '../tourStorage';

// Minimal mock feature
const mockFeature = {
  osmMeta: { type: 'way', id: 1156787758 },
  tags: { name: 'Norissteig', 'via_ferrata:scale': 'C' },
  center: [11.53, 49.54],
} as any;

describe('tourStorage', () => {
  it('estimates size without throwing', async () => {
    const size = await estimateTourSize(mockFeature);
    expect(size).toBeGreaterThan(0);
  });
});

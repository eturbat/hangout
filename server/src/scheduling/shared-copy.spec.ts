import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('code shared with the frontend', () => {
  it('hangout/src/lib/zoned-time.ts is an exact copy of this folder\'s zoned-time.ts', () => {
    const original = readFileSync(join(__dirname, 'zoned-time.ts'), 'utf8');
    const copy = readFileSync(join(__dirname, '../../../hangout/src/lib/zoned-time.ts'), 'utf8');
    // If this fails, edit the server file and run `npm run sync:shared` in hangout/.
    expect(copy).toBe(original);
  });
});

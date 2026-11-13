import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('accepts the right password and rejects a wrong one', async () => {
    const stored = await hashPassword('hunter2');
    await expect(verifyPassword('hunter2', stored)).resolves.toBe(true);
    await expect(verifyPassword('hunter3', stored)).resolves.toBe(false);
  });

  it('never stores the password itself, and salts each hash', async () => {
    const a = await hashPassword('hunter2');
    const b = await hashPassword('hunter2');
    expect(a).not.toContain('hunter2');
    expect(a).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(a).not.toBe(b);
  });

  it('rejects a malformed stored value instead of throwing', async () => {
    await expect(verifyPassword('hunter2', 'not-a-hash')).resolves.toBe(false);
  });
});

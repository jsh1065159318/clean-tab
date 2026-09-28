import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../../src/lib/password.js';

test('hashPassword 输出 scrypt 格式，且同一密码两次哈希不同', async () => {
  const first = await hashPassword('same-password');
  const second = await hashPassword('same-password');

  assert.match(first, /^scrypt\$16384\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
  assert.notEqual(first, second, '盐必须随机，两次哈希结果不能相同');
});

test('hashPassword 不把明文写入结果', async () => {
  const hash = await hashPassword('correct-horse-battery');
  assert.ok(!hash.includes('correct-horse-battery'));
});

test('verifyPassword 接受正确密码', async () => {
  const stored = await hashPassword('correct-horse-battery');
  assert.equal(await verifyPassword('correct-horse-battery', stored), true);
});

test('verifyPassword 拒绝错误密码', async () => {
  const stored = await hashPassword('correct-horse-battery');
  assert.equal(await verifyPassword('correct-horse-batter', stored), false);
  assert.equal(await verifyPassword('Correct-horse-battery', stored), false);
  assert.equal(await verifyPassword('', stored), false);
});

test('verifyPassword 对畸形或空值返回 false 而不抛错', async () => {
  const malformed = [
    '',
    'not-a-hash',
    'scrypt$1$2$3',
    'scrypt$$$$$',
    'bcrypt$16384$8$1$c2FsdA==$aGFzaA==',
    null,
    undefined,
    42,
    {},
  ];

  for (const stored of malformed) {
    assert.equal(
      await verifyPassword('anything', stored),
      false,
      `stored=${String(stored)} 时应返回 false`,
    );
  }
});

test('verifyPassword 对非字符串密码返回 false', async () => {
  const stored = await hashPassword('correct-horse-battery');
  for (const password of [null, undefined, 42, {}, []]) {
    assert.equal(await verifyPassword(password, stored), false);
  }
});

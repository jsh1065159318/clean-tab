import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HttpError, conflict, errorBody, readBearerToken } from '../../src/lib/http.js';

test('readBearerToken 解析标准与大小写变体', () => {
  assert.equal(readBearerToken('Bearer abc123'), 'abc123');
  assert.equal(readBearerToken('bearer abc123'), 'abc123');
  assert.equal(readBearerToken('  Bearer   abc123  '), 'abc123');
});

test('readBearerToken 对非法输入返回空串', () => {
  for (const header of [undefined, null, '', 'abc123', 'Bearer', 'Bearer   ', 'Basic abc123', 42]) {
    assert.equal(readBearerToken(header), '', `header=${String(header)}`);
  }
});

test('errorBody 保留 HttpError 的状态码与附加字段', () => {
  const error = new HttpError(409, 'CONFLICT', '冲突了', { remote: { id: 'r1' }, conflictId: 'c1' });
  const result = errorBody(error);

  assert.equal(result.status, 409);
  assert.equal(result.body.error, 'CONFLICT');
  assert.equal(result.body.message, '冲突了');
  assert.deepEqual(result.body.remote, { id: 'r1' });
  assert.equal(result.body.conflictId, 'c1');
});

test('errorBody 把未知异常折叠成 500，不泄露内部细节', () => {
  const result = errorBody(new Error('数据库密码是 hunter2'));

  assert.equal(result.status, 500);
  assert.equal(result.body.error, 'SERVER_ERROR');
  assert.ok(!result.body.message.includes('hunter2'));
});

test('conflict 在无 conflictId 时不写入该字段', () => {
  const withoutId = conflict('冲突', { id: 'r1' });
  assert.equal(withoutId.status, 409);
  assert.deepEqual(withoutId.extra, { remote: { id: 'r1' } });
  assert.equal('conflictId' in withoutId.extra, false);

  const withId = conflict('冲突', { id: 'r1' }, 'local-1');
  assert.deepEqual(withId.extra, { remote: { id: 'r1' }, conflictId: 'local-1' });
});

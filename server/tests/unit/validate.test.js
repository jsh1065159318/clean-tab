import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HttpError } from '../../src/lib/http.js';
import {
  isUuid,
  readArray,
  readBoolean,
  readEnum,
  readObject,
  readOptionalId,
  readString,
  readSubtasks,
  readTimestampOrNull,
  readVersion,
} from '../../src/lib/validate.js';

const expectValidationFailure = (fn, label) => {
  assert.throws(fn, error => {
    assert.ok(error instanceof HttpError, `${label}：应抛出 HttpError`);
    assert.equal(error.status, 400, label);
    assert.equal(error.code, 'VALIDATION_FAILED', label);
    return true;
  }, label);
};

test('isUuid 只接受合法 UUID', () => {
  assert.equal(isUuid('3f2504e0-4f89-41d3-9a0c-0305e82c3301'), true);
  assert.equal(isUuid('3F2504E0-4F89-41D3-9A0C-0305E82C3301'), true, '应忽略大小写');
  assert.equal(isUuid('3f2504e0-4f89-41d3-9a0c-0305e82c330'), false, '长度不足');
  assert.equal(isUuid('local-note'), false);
  assert.equal(isUuid(''), false);
  assert.equal(isUuid(null), false);
  assert.equal(isUuid(42), false);
});

test('readObject 只接受普通对象', () => {
  assert.deepEqual(readObject({ a: 1 }), { a: 1 });
  for (const value of [null, undefined, [], 'x', 42, true]) {
    expectValidationFailure(() => readObject(value), `readObject(${JSON.stringify(value)})`);
  }
});

test('readArray 只接受数组', () => {
  assert.deepEqual(readArray([], 'items'), []);
  assert.deepEqual(readArray([1, 2], 'items'), [1, 2]);
  for (const value of [null, undefined, {}, 'x']) {
    expectValidationFailure(() => readArray(value, 'items'), `readArray(${JSON.stringify(value)})`);
  }
});

test('readString 校验类型、长度并支持 trim', () => {
  assert.equal(readString('abc', '字段'), 'abc');
  assert.equal(readString('  abc  ', '字段', { trim: true }), 'abc');
  assert.equal(readString('', '字段'), '');

  expectValidationFailure(() => readString('', '字段', { min: 1 }), '低于最小长度');
  expectValidationFailure(() => readString('abc', '字段', { max: 2 }), '超过最大长度');
  expectValidationFailure(() => readString(42, '字段'), '非字符串');
  expectValidationFailure(() => readString(null, '字段'), 'null');

  // trim 后长度不足也应被拒绝。
  expectValidationFailure(() => readString('   ', '字段', { trim: true, min: 1 }), 'trim 后为空');
});

test('readBoolean 接受布尔值，缺失时回退默认值', () => {
  assert.equal(readBoolean(true, '字段', false), true);
  assert.equal(readBoolean(false, '字段', true), false);
  assert.equal(readBoolean(undefined, '字段', true), true);
  assert.equal(readBoolean(null, '字段', false), false);

  for (const value of ['true', 1, 0, {}]) {
    expectValidationFailure(() => readBoolean(value, '字段', false), `readBoolean(${JSON.stringify(value)})`);
  }
});

test('readEnum 限定取值并支持默认值', () => {
  assert.equal(readEnum('dark', '主题', ['light', 'dark', 'auto'], 'auto'), 'dark');
  assert.equal(readEnum(undefined, '主题', ['light', 'dark', 'auto'], 'auto'), 'auto');
  assert.equal(readEnum(null, '主题', ['light', 'dark'], 'light'), 'light');

  expectValidationFailure(() => readEnum('blue', '主题', ['light', 'dark'], 'auto'), '不在枚举内');
});

test('readVersion 只接受正整数', () => {
  assert.equal(readVersion(1), 1);
  assert.equal(readVersion(999), 999);

  for (const value of [0, -1, 1.5, '1', null, undefined, NaN, Infinity]) {
    assert.equal(readVersion(value), null, `readVersion(${String(value)}) 应为 null`);
  }
});

test('readTimestampOrNull 规范化时间并拒绝非法值', () => {
  assert.equal(readTimestampOrNull('2026-10-01T00:00:00.000Z', '截止时间'), '2026-10-01T00:00:00.000Z');
  assert.equal(readTimestampOrNull('', '截止时间'), null);
  assert.equal(readTimestampOrNull(null, '截止时间'), null);
  assert.equal(readTimestampOrNull(undefined, '截止时间'), null);

  expectValidationFailure(() => readTimestampOrNull('not-a-date', '截止时间'), '非法时间');
  expectValidationFailure(() => readTimestampOrNull(42, '截止时间'), '非字符串');
});

test('readOptionalId 对非 UUID 返回 null，交由数据库生成', () => {
  assert.equal(readOptionalId('3f2504e0-4f89-41d3-9a0c-0305e82c3301'), '3f2504e0-4f89-41d3-9a0c-0305e82c3301');
  assert.equal(readOptionalId('local-note'), null);
  assert.equal(readOptionalId(null), null);
  assert.equal(readOptionalId(undefined), null);
});

test('readSubtasks 规范化子任务并裁剪超长字段', () => {
  assert.deepEqual(readSubtasks(undefined, '子任务'), []);
  assert.deepEqual(readSubtasks(null, '子任务'), []);

  assert.deepEqual(
    readSubtasks([{ id: 's1', text: '写代码', done: true }], '子任务'),
    [{ id: 's1', text: '写代码', done: true }],
  );

  // 缺失字段回退为安全默认值。
  assert.deepEqual(readSubtasks([{}], '子任务'), [{ id: '', text: '', done: false }]);
  // done 只认严格 true。
  assert.deepEqual(readSubtasks([{ done: 'yes' }], '子任务')[0].done, false);

  const long = readSubtasks([{ id: 'a'.repeat(100), text: 'b'.repeat(600) }], '子任务')[0];
  assert.equal(long.id.length, 64);
  assert.equal(long.text.length, 500);

  expectValidationFailure(() => readSubtasks('x', '子任务'), '非数组');
  expectValidationFailure(() => readSubtasks([1], '子任务'), '数组元素非对象');
});

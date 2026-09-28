import { badRequest } from './http.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isUuid = value => typeof value === 'string' && UUID_PATTERN.test(value);

export const readObject = value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw badRequest('VALIDATION_FAILED', '请求体必须是 JSON 对象。');
  }
  return value;
};

export const readArray = (value, field) => {
  if (!Array.isArray(value)) throw badRequest('VALIDATION_FAILED', `${field} 必须是数组。`);
  return value;
};

export const readString = (value, field, { min = 0, max = Infinity, trim = false } = {}) => {
  if (typeof value !== 'string') throw badRequest('VALIDATION_FAILED', `${field} 必须是字符串。`);
  const text = trim ? value.trim() : value;
  if (text.length < min) throw badRequest('VALIDATION_FAILED', `${field} 至少需要 ${min} 个字符。`);
  if (text.length > max) throw badRequest('VALIDATION_FAILED', `${field} 不能超过 ${max} 个字符。`);
  return text;
};

export const readBoolean = (value, field, fallback) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'boolean') throw badRequest('VALIDATION_FAILED', `${field} 必须是布尔值。`);
  return value;
};

export const readEnum = (value, field, allowed, fallback) => {
  if (value === undefined || value === null) return fallback;
  if (!allowed.includes(value)) {
    throw badRequest('VALIDATION_FAILED', `${field} 只能是 ${allowed.join('、')} 之一。`);
  }
  return value;
};

export const readVersion = value => (Number.isInteger(value) && value > 0 ? value : null);

export const readTimestampOrNull = (value, field) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw badRequest('VALIDATION_FAILED', `${field} 必须是时间字符串。`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw badRequest('VALIDATION_FAILED', `${field} 不是合法的时间。`);
  return parsed.toISOString();
};

// 允许携带 id 的写入：id 缺失或非法时交给数据库生成。
export const readOptionalId = value => (isUuid(value) ? value : null);

export const readSubtasks = (value, field) => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw badRequest('VALIDATION_FAILED', `${field} 必须是数组。`);
  return value.map(item => {
    if (!item || typeof item !== 'object') {
      throw badRequest('VALIDATION_FAILED', `${field} 的每一项都必须是对象。`);
    }
    return {
      id: typeof item.id === 'string' ? item.id.slice(0, 64) : '',
      text: typeof item.text === 'string' ? item.text.slice(0, 500) : '',
      done: item.done === true,
    };
  });
};

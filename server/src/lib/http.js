export class HttpError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export const badRequest = (code, message) => new HttpError(400, code, message);
export const unauthorized = (message = '登录状态已失效，请重新登录。') => new HttpError(401, 'AUTH_REQUIRED', message);
export const forbidden = (message = '没有权限执行该操作。') => new HttpError(403, 'FORBIDDEN', message);
export const notFound = (message = '资源不存在。') => new HttpError(404, 'NOT_FOUND', message);
// conflictId 用于批量接口：客户端需要知道是哪一条发生冲突，
// 才能把远端内容与对应的本地条目配对，而不是整批都当作冲突。
export const conflict = (message, remote = null, conflictId = null) =>
  new HttpError(409, 'CONFLICT', message, conflictId ? { remote, conflictId } : { remote });

export const errorBody = error => {
  if (error instanceof HttpError) {
    return { status: error.status, body: { error: error.code, message: error.message, ...error.extra } };
  }
  console.error('未处理的服务端错误：', error);
  return { status: 500, body: { error: 'SERVER_ERROR', message: '服务端处理失败，请稍后重试。' } };
};

// 从 Authorization: Bearer <token> 中取出令牌。
export const readBearerToken = header => {
  if (typeof header !== 'string') return '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : '';
};

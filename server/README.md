# 清爽标签页同步后端

轻量同步后端，替代原 Supabase 依赖。技术栈刻意保持最小：**Node.js + Hono + PostgreSQL**，运行时依赖只有 3 个（`hono`、`@hono/node-server`、`pg`）。

## 为什么这样设计

- **依赖极少**：密码哈希用 Node 内置 `node:crypto` 的 scrypt，不引入 bcrypt/argon2 等需要编译的原生模块。
- **无长连接**：原 Supabase Realtime 的 WebSocket 在弱网下最易被中断，改为客户端轮询 `/workspace/revision`，失败可自愈。
- **单一数据入口**：本服务是唯一访问数据库的组件，归属校验在 API 层用 `user_id` 条件完成，不依赖 RLS 的会话变量注入。
- **乐观锁显式化**：版本号在 `UPDATE` 语句里 `version = version + 1`，不用触发器，便于阅读和测试。

## 环境要求

- Node.js 20.12 或更高版本（需要 `process.loadEnvFile`）
- PostgreSQL 13 或更高版本

## 本地启动

```sh
cd server
cp .env.example .env      # 按需修改 DATABASE_URL
npm install
npm run migrate           # 建表，可重复执行
npm run dev               # 监听 127.0.0.1:8787
```

验证：

```sh
curl http://127.0.0.1:8787/health
# {"ok":true,"time":"..."}
```

随后在项目根目录的 `.env.local` 中填写：

```sh
VITE_API_BASE_URL=http://127.0.0.1:8787
```

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | 监听地址。生产环境建议保持回环，由反向代理对外提供 HTTPS |
| `PORT` | `8787` | 监听端口 |
| `DATABASE_URL` | 无（必填） | PostgreSQL 连接串 |
| `DB_POOL_MAX` | `10` | 连接池上限 |
| `SESSION_DAYS` | `90` | 登录会话有效期（天） |
| `SIGNUP_ENABLED` | `true` | 设为 `false` 后 `/auth/signup` 返回 403，适合个人自用 |
| `CORS_ORIGINS` | 空 | 额外放行的来源，逗号分隔；填 `*` 放行全部 |

浏览器扩展页面的来源形如 `chrome-extension://<id>`、`moz-extension://<id>`，本地开发来源形如 `http://localhost:<port>`，这两类**默认已放行**，无需配置。

## 生产部署

推荐结构：**Nginx 终止 TLS → 本服务监听 127.0.0.1**。

1. 建立数据库与账号：

```sh
sudo -u postgres psql -c "create user clean_tab with password '强密码';"
sudo -u postgres psql -c "create database clean_tab owner clean_tab;"
```

2. 部署代码并安装依赖：

```sh
cd /opt/clean-tab/server
cp .env.example .env       # 填写 DATABASE_URL、SIGNUP_ENABLED 等
npm install --omit=dev
npm run migrate
```

3. 注册为 systemd 服务：参考 [`deploy/clean-tab-server.service`](deploy/clean-tab-server.service)，复制到 `/etc/systemd/system/` 后：

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now clean-tab-server
sudo systemctl status clean-tab-server
```

4. 配置反向代理：参考 [`deploy/nginx.conf.example`](deploy/nginx.conf.example)。Caddy 用户只需一行：

```txt
api.example.com {
  reverse_proxy 127.0.0.1:8787
}
```

5. 构建扩展时指定后端地址，CSP 与 `host_permissions` 会自动注入：

```sh
VITE_API_BASE_URL=https://api.example.com npm run build
```

> 注意：`vite.config.mjs` 会从 `VITE_API_BASE_URL` 推导 `connect-src` 与 `host_permissions`。
> 如果构建时没有设置该变量，扩展的 CSP 不会放行任何外部域名，登录与同步会被浏览器直接拦截。

## API 一览

所有 `/workspace` 接口都需要 `Authorization: Bearer <token>`，身份由令牌推导，请求体中的 `user_id` 会被忽略。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/health` | 健康检查 |
| `POST` | `/auth/signup` | 注册并直接返回会话 |
| `POST` | `/auth/login` | 登录 |
| `GET` | `/auth/me` | 校验令牌并返回当前用户 |
| `POST` | `/auth/logout` | 注销当前会话 |
| `GET` | `/workspace/settings` | 读取设置 |
| `PUT` | `/workspace/settings` | 写入设置（带 `version` 时走乐观锁） |
| `GET` | `/workspace/todos` | 任务列表（不含已软删除） |
| `POST` | `/workspace/todos/upsert` | 批量新增或更新 |
| `POST` | `/workspace/todos/delete` | 批量软删除 |
| `POST` | `/workspace/todos/conflict` | 创建冲突副本 |
| `GET` | `/workspace/notes` | 笔记列表 |
| `POST` | `/workspace/notes/upsert` | 批量新增或更新 |
| `POST` | `/workspace/notes/delete` | 批量删除 |
| `POST` | `/workspace/notes/conflict` | 创建冲突副本 |
| `GET` | `/workspace/bookmarks` | 快捷方式列表 |
| `POST` | `/workspace/bookmarks/upsert` | 批量新增或更新（下标写入 `sort_order`） |
| `POST` | `/workspace/bookmarks/delete` | 批量删除 |
| `GET` | `/workspace/revision` | 各资源变更版本串，供客户端轮询 |

### 错误约定

统一返回 `{ error, message }`：

| 状态码 | `error` | 场景 |
| --- | --- | --- |
| 400 | `VALIDATION_FAILED` | 参数不合法 |
| 400 | `email_exists` / `email_address_invalid` | 邮箱已注册 / 格式错误 |
| 401 | `AUTH_REQUIRED` | 缺少令牌或会话已过期 |
| 403 | `FORBIDDEN` | 注册被关闭 |
| 409 | `CONFLICT` | 乐观锁冲突，响应体额外带 `remote`（远端行）与 `conflictId`（冲突的条目 id） |
| 413 | `PAYLOAD_TOO_LARGE` | 请求体超过 2 MB |
| 500 | `SERVER_ERROR` | 服务端异常 |

`conflictId` 是为批量接口准备的：客户端需要知道是哪一条发生冲突，才能把远端内容与对应的本地条目配对，而不是把整批请求都当作冲突。

## 数据模型

单文件建表脚本 [`src/schema.sql`](src/schema.sql)，可重复执行。

- `users` — 账号，密码以 scrypt 存储
- `sessions` — 会话令牌，**只存 SHA-256 摘要**，数据库泄露时无法直接用于登录
- `user_settings` / `todos` / `notes` / `bookmarks` — 与扩展的数据结构一一对应

所有业务表都有 `version` 字段用于乐观锁。**该字段必须是 `integer` 而不是 `bigint`**：`node-postgres` 会把 `int8` 解析成字符串以避免精度丢失，而前端用 `Number.isInteger(version)` 判断是否携带版本号，返回字符串会让乐观锁静默失效。`schema.sql` 末尾有幂等的 `ALTER` 语句兼容早期建表。

## 运维

**备份**

```sh
pg_dump -Fc clean_tab > clean_tab-$(date +%F).dump
```

**恢复**

```sh
pg_restore -d clean_tab --clean --if-exists clean_tab-2026-09-28.dump
```

**查看日志**

```sh
sudo journalctl -u clean-tab-server -f
```

**升级**

```sh
cd /opt/clean-tab/server
git pull && npm install --omit=dev && npm run migrate
sudo systemctl restart clean-tab-server
```

过期会话由服务每 6 小时自动清理，无需人工干预。

## 安全说明

- 密码使用 scrypt（N=16384, r=8, p=1）加随机盐存储，不保存明文。
- 登录失败时对不存在的账号也执行一次哈希校验，避免通过响应时间探测邮箱是否注册。
- 会话令牌为 32 字节随机值，服务端只保存其 SHA-256 摘要。
- 请求体上限 2 MB，防止超大 payload。
- **务必通过 HTTPS 暴露服务**：令牌以 Bearer 形式传输，明文 HTTP 下会被中间人截获。
- 个人自用建议设置 `SIGNUP_ENABLED=false`，注册完账号后关闭注册入口。

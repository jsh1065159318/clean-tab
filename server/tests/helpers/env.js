// 必须在任何 src/ 模块被导入之前执行。
//
// src/env.js 在缺少 DATABASE_URL 时会在导入期直接抛错，这会让「没有数据库就跳过集成测试」
// 变成「测试文件加载失败」。这里补一个指向不可达地址的占位值，让模块能正常加载；
// 数据库是否真的可用，统一由 helpers/database.js 判断并决定跳过还是失败。
process.env.DATABASE_URL ||= 'postgres://unused:unused@127.0.0.1:1/unused';

export {};

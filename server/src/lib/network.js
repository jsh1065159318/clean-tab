import os from 'node:os';
import { env } from '../env.js';

// 仅列出可用于分享的局域网 IPv4 地址，跳过回环与 IPv6。
export const listLanAddresses = () => {
  const addresses = [];
  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family !== 'IPv4' || entry.internal) continue;
      addresses.push({ name, address: entry.address });
    }
  }
  return addresses;
};

// 服务是否监听在所有网卡上。只绑回环时，局域网内的其他人无法访问。
export const isPubliclyBound = () => {
  const host = env.host.toLowerCase();
  return host === '0.0.0.0' || host === '::' || host === '';
};

export const buildAccessUrls = () => {
  const urls = [`http://localhost:${env.port}`];
  if (isPubliclyBound()) {
    for (const { address } of listLanAddresses()) {
      urls.push(`http://${address}:${env.port}`);
    }
  }
  return urls;
};

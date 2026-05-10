export async function onRequest(context) {
  const { request } = context;

  // 1. 处理 CORS 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // 2. 只允许 POST 请求
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }

  try {
    // 3. 直接调用已验证可用的 Worker 地址（Cloudflare 内网优化访问）
    const workerUrl = 'https://law-game.terry-hao.workers.dev';
    const workerResp = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 如有需要，可带上认证头，但 Worker 已有 Origin 校验
      },
      body: request.body
    });

    // 4. 转发 Worker 的响应给前端
    const data = await workerResp.text();
    return new Response(data, {
      status: workerResp.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to connect to backend' }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

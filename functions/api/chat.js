export async function onRequest(context) {
  const { request, env } = context;

  // 只允许 POST
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // 通过 Service Binding 调用 Worker
  const workerResponse = await env.BACKEND.fetch(request.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: request.body
  });

  // 透传 Worker 的响应
  return new Response(workerResponse.body, {
    status: workerResponse.status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
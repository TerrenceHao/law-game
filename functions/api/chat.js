export async function onRequest(context) {
  const { request, env } = context;

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

  // 3. 检查环境变量
  const apiKey = env.SILICON_API_KEY;
  const systemPrompt = env.SYSTEM_PROMPT;
  if (!apiKey || !systemPrompt) {
    return new Response(JSON.stringify({ error: '服务端配置缺失' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  // 4. 解析用户发来的对话历史（不含 system 提示词）
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: '请求格式错误' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  const fullMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  // 5. 直接调用硅基流动 API
  try {
    const resp = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'Qwen/Qwen3.6-27B',
        messages: fullMessages,
        max_tokens: body.max_tokens || 80,
        temperature: 0.7,
        thinking: { type: 'disabled' }
      })
    });

    const data = await resp.text();
    return new Response(data, {
      status: resp.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: '调用AI服务失败' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

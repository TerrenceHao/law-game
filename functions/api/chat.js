export async function onRequest(context) {
  const { request, env } = context;

  // 1. 只允许 POST
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 2. 检查环境变量
  const apiKey = env.SILICON_API_KEY;
  const systemPrompt = env.SYSTEM_PROMPT;
  if (!apiKey || !systemPrompt) {
    return new Response(JSON.stringify({ error: '服务端配置缺失' }), { status: 500 });
  }

  // 3. 解析请求体
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: '请求格式错误' }), { status: 400 });
  }

  const { history = [], question = '' } = body;
  if (!question) {
    return new Response(JSON.stringify({ error: '问题不能为空' }), { status: 400 });
  }

  // 4. 构造完整的消息列表（加入 system prompt）
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: question }
  ];

  let aiReply = '';
  let gameOver = false;
  let endType = null; // 'judge' 或 'guess'

  // 5. 调用硅基流动
  try {
    const resp = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'Qwen/Qwen3.6-27B',
        messages: messages,
        max_tokens: history.length === 0 ? 200 : 80,
        temperature: 0.7,
        thinking: { type: 'disabled' }
      })
    });

    if (!resp.ok) {
      const errData = await resp.text();
      throw new Error(`API错误 ${resp.status}: ${errData}`);
    }

    const data = await resp.json();
    aiReply = data.choices?.[0]?.message?.content || '';
  } catch (e) {
    // 调用失败时，返回错误信息给前端
    aiReply = '调用AI服务失败，请稍后重试。';
  }

  // 6. 更新对话历史，并检查结束条件
  const newHistory = [
    ...history,
    { role: 'user', content: question },
    { role: 'assistant', content: aiReply }
  ];

  // 特殊指令优先判断
  if (question.trim() === '审判长，也就是我本人。') {
    gameOver = true;
    endType = 'judge';   // 当事人坦白
  } else if (aiReply.includes('对对对') || aiReply.includes('就是这个') || aiReply.includes('律师您太厉害了')) {
    gameOver = true;
    endType = 'guess';   // 律师猜中
  }

  // 7. 返回结果
  return new Response(JSON.stringify({
    history: newHistory,
    aiReply: aiReply,
    gameOver: gameOver,
    endType: endType
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

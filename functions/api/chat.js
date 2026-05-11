export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const apiKey = env.SILICON_API_KEY;
  const systemPrompt = env.SYSTEM_PROMPT;
  if (!apiKey || !systemPrompt) {
    return new Response(JSON.stringify({ error: '服务端配置缺失' }), { status: 500 });
  }

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

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history
  ];

  let aiReply = '';
  let gameOver = false;
  let endType = null;

  // 先判断审判长指令，即使后续API调用失败也要结束
 if (question.trim() === '审判长，也就是我本人。' || question.trim() === '审判长，也就是我本人') {
    gameOver = true;
    endType = 'judge';   // 当事人坦白
  }

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
    // 若API调用失败，根据情况返回不同提示
    if (gameOver) {
      aiReply = '好吧，我坦白……（因网络波动，坦白内容丢失，但询问结束）';
    } else {
      aiReply = '调用AI服务失败，请稍后重试。';
    }
  }

  // 如果不是审判长，但AI回复中有认输词，则标记猜中结束
  if (!gameOver && (
    aiReply.includes('对对对') ||
    aiReply.includes('就是这个') ||
    aiReply.includes('律师您太厉害了')
  )) {
    gameOver = true;
    endType = 'guess';   // 律师猜中
  }

  return new Response(JSON.stringify({
    aiReply,
    gameOver,
    endType
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

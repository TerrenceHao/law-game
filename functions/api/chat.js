export async function onRequest(context) {
  try {
    const { request, env } = context;

    // 1. 检查环境变量
    const apiKey = env.SILICON_API_KEY;
    const systemPrompt = env.SYSTEM_PROMPT;
    if (!apiKey || !systemPrompt) {
      return new Response('服务端配置缺失', { status: 500 });
    }

    // 2. 解析表单
    let userQuestion = '';
    let history = [];
    if (request.method === 'POST') {
      const formData = await request.formData();
      userQuestion = (formData.get('question') || '').trim();
      const rawHistory = formData.get('history') || '';
      if (rawHistory) {
        try { history = JSON.parse(rawHistory); } catch (e) {}
      }
    }

    // 3. 调用 AI，并更新历史
    let aiReply = '';
    let gameOver = false;
    if (userQuestion) {
      const messages = [
        { role: 'system', content: systemPrompt },   // ✅ 修正为 system
        ...history,
        { role: 'user', content: userQuestion }
      ];

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
        const data = await resp.json();
        aiReply = data.choices?.[0]?.message?.content || '';
        if (!aiReply) aiReply = '……（当事人沉默不语）'; // 防止空回复
        history.push({ role: 'user', content: userQuestion });
        history.push({ role: 'assistant', content: aiReply });
      } catch (e) {
        aiReply = '调用AI服务失败，请稍后重试。';
        history.push({ role: 'user', content: userQuestion });
        history.push({ role: 'assistant', content: aiReply });
      }

      // 4. 判断胜利条件
      if (userQuestion === '审判长，也就是我本人。') {
        gameOver = true;
      } else if (aiReply.includes('对对对') || aiReply.includes('就是这个') || aiReply.includes('律师您太厉害了')) {
        gameOver = true;
      }
    }

    // 5. 生成对话 HTML
    let chatHtml = '';
    for (const msg of history) {
      const role = msg.role === 'user' ? '⚖️ 律师' : '🧑‍🌾 当事人';
      chatHtml += `<div class="line"><strong>${role}：</strong>${escapeHtml(msg.content)}</div>`;
    }

    let inputHtml = '';
    if (gameOver) {
      const endType = (userQuestion === '审判长，也就是我本人。') ? '当事人坦白' : '律师猜中';
      chatHtml += `<div class="line" style="color:#947d56; text-align:center; margin:10px 0;"><em>—— ${endType}，询问结束 ——</em></div>`;
    } else {
      inputHtml = `
      <div class="input-area">
        <form method="POST" action="/api/chat" style="display:flex; width:100%;">
          <input type="hidden" name="history" value="${escapeHtml(JSON.stringify(history))}">
          <input type="text" name="question" placeholder="输入你的提问..." maxlength="400" autofocus>
          <button type="submit">发送</button>
        </form>
      </div>`;
    }

    // 6. 返回完整页面
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>民法猜谜</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; background: #f5f2eb; display: flex; justify-content: center; align-items: center; height: 100vh; padding: 16px; }
        .container { width: 100%; max-width: 750px; background: #fff; border: 1px solid #c0b7a8; display: flex; flex-direction: column; height: 90vh; }
        .header { padding: 14px 20px; border-bottom: 1px solid #d4ccc0; font-weight: bold; background: #faf8f4; }
        .log { flex: 1; overflow-y: auto; padding: 20px; line-height: 1.8; font-size: 0.95rem; }
        .line { margin-bottom: 8px; }
        .input-area { display: flex; padding: 10px 16px; border-top: 1px solid #d4ccc0; background: #faf8f4; }
        input[type="text"] { flex: 1; border: 1px solid #c0b7a8; padding: 10px; font-family: inherit; background: #fffefb; margin-right: 10px; }
        button { padding: 10px 24px; background: #5c4b31; color: white; border: none; font-weight: bold; cursor: pointer; }
    </style>
</head>
<body>
<div class="container">
    <div class="header">📋 民事纠纷当事人询问记录</div>
    <div class="log">
        ${chatHtml || '<div class="line" style="color:#947d56; text-align:center; margin:10px 0;"><em>当事人已到场，询问开始。</em></div>'}
    </div>
    ${inputHtml}
</div>
</body>
</html>`;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });

  } catch (err) {
    return new Response(`<html><body><h3>抱歉，页面遇到错误</h3><p>请稍后重试。</p></body></html>`, {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

function escapeHtml(text) {
  return (text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

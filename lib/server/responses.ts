export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : '服务器暂时无法处理该请求。';
  const status = message === '未获得有效的会话凭证。' ? 401
    : message === '参与者编号无效或尚未开放。' ? 403
    : message.includes('已被使用') || message.includes('版本冲突') ? 409
    : message.includes('格式') || message.includes('无效') ? 400
    : 503;
  return json({ ok: false, error: message }, status);
}

export async function sendTelegramMessage(
  token: string,
  chatId: string,
  text: string,
  parseMode?: 'HTML',
): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    // parse_mode is sent ONLY when requested: the plain-text default means
    // arbitrary text (e.g. failure alerts containing '<' or '&') can never
    // 400 on Telegram entity parsing.
    body: JSON.stringify({ chat_id: chatId, text, ...(parseMode ? { parse_mode: parseMode } : {}) }),
    // Fail fast instead of stalling the pipeline on a hung connection.
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    throw new Error(`Telegram sendMessage failed: ${res.status} ${await res.text()}`)
  }
}

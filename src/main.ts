import { runPipeline } from './pipeline.js'
import { sendTelegramMessage } from './telegram.js'

runPipeline().catch(async err => {
  console.error(err)
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (token && chatId) {
    try {
      await sendTelegramMessage(token, chatId, `mail-triage pipeline failed: ${String(err).slice(0, 500)}`)
    } catch (alertErr) {
      console.error('failed to send failure alert:', alertErr)
    }
  }
  process.exit(1)
})

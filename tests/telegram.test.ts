import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendTelegramMessage } from '../src/telegram.js'

describe('sendTelegramMessage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('POSTs the message with parse_mode when HTML is requested', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    await sendTelegramMessage('TOKEN', '42', '<b>hi</b>', 'HTML')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/botTOKEN/sendMessage')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ chat_id: '42', text: '<b>hi</b>', parse_mode: 'HTML' })
  })

  it('omits parse_mode entirely by default so arbitrary text cannot 400 on entity parsing', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    await sendTelegramMessage('TOKEN', '42', 'pipeline failed: Error <at line 3>')

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      chat_id: '42',
      text: 'pipeline failed: Error <at line 3>',
    })
  })

  it('rejects with status and response body when Telegram returns an error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "Bad Request: can't parse entities",
    }))

    await expect(sendTelegramMessage('TOKEN', '42', 'x')).rejects.toThrow(
      /400.*Bad Request: can't parse entities/,
    )
  })
})

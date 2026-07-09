import { createServer } from 'node:http'
import { google } from 'googleapis'
import { requireEnv } from '../src/env.js'

const PORT = 53682
const auth = new google.auth.OAuth2(
  requireEnv('GMAIL_CLIENT_ID'),
  requireEnv('GMAIL_CLIENT_SECRET'),
  `http://127.0.0.1:${PORT}/callback`,
)

const url = auth.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/gmail.modify'],
})

console.log('Open this URL in your browser:\n\n' + url + '\n\nWaiting for the callback...')

const server = createServer((req, res) => {
  void (async () => {
    const code = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`).searchParams.get('code')
    if (!code) {
      res.writeHead(400).end('missing code')
      return
    }
    const { tokens } = await auth.getToken(code)
    res.writeHead(200, { 'content-type': 'text/plain' }).end('Done. You can close this tab.')
    console.log('\nAdd this line to .env:\n\nGMAIL_REFRESH_TOKEN=' + tokens.refresh_token)
    server.close()
  })().catch(err => {
    res.writeHead(500).end('error, see terminal')
    console.error(err)
    server.close()
  })
})
server.listen(PORT)

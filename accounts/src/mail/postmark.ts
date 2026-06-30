/**
 * Postmark HTTP API adapter.
 *
 * Uses the Postmark REST endpoint directly (no SDK) so the only
 * runtime dependency is global `fetch` (Node 18+).
 * `fetchImpl` and `token` are injected for testability.
 */

const POSTMARK_API_URL = 'https://api.postmarkapp.com/email'
const FROM_ADDRESS     = 'noreply@doldenblick.de'
const MESSAGE_STREAM   = 'outbound'

export interface SendMagicLinkEmailOpts {
  /** Override fetch (e.g. a mock in tests). Defaults to global fetch. */
  fetchImpl?: typeof fetch
  /** Postmark server token. Defaults to POSTMARK_SERVER_API_TOKEN env var. */
  token?: string
}

/**
 * Sends the magic-link e-mail via Postmark.
 *
 * @param to    Recipient address (already normalised).
 * @param link  Full verification URL containing the raw token.
 * @param opts  Injectable fetch + Postmark token for testability.
 */
export async function sendMagicLinkEmail(
  to: string,
  link: string,
  opts: SendMagicLinkEmailOpts = {},
): Promise<void> {
  const {
    fetchImpl = fetch,
    token     = process.env.POSTMARK_SERVER_API_TOKEN ?? '',
  } = opts

  const res = await fetchImpl(POSTMARK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type':             'application/json',
      'Accept':                   'application/json',
      'X-Postmark-Server-Token':  token,
    },
    body: JSON.stringify({
      From:          FROM_ADDRESS,
      To:            to,
      Subject:       'Dein Anmeldelink für DoldenBlick',
      HtmlBody:      `<p>Klicke auf den folgenden Link, um dich anzumelden:</p><p><a href="${link}">${link}</a></p>`,
      TextBody:      `Dein Anmeldelink: ${link}`,
      MessageStream: MESSAGE_STREAM,
    }),
  })

  if (!res.ok) {
    // Do not include the link in the error — it contains the raw token.
    throw new Error(`Postmark-Fehler: HTTP ${res.status} ${res.statusText}`)
  }
}

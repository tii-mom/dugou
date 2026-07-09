export function getBearerToken(request: Request) {
  const header = request.headers.get('Authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || ''
}

export async function verifyAdminReviewToken(request: Request, env: CloudflareEnv) {
  const expected = env.ADMIN_REVIEW_TOKEN?.trim() || ''
  const actual = getBearerToken(request)

  if (!expected || !actual) return false

  const encoder = new TextEncoder()
  const expectedBytes = encoder.encode(expected)
  const actualBytes = encoder.encode(actual)
  if (expectedBytes.length !== actualBytes.length) return false

  let diff = 0
  for (let i = 0; i < expectedBytes.length; i += 1) {
    diff |= expectedBytes[i] ^ actualBytes[i]
  }
  return diff === 0
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number }

export const API_PATHS = {
  authTelegram: '/api/auth/telegram',
  meSession: '/api/me/session',
  lossProofUploadUrl: '/api/loss-proofs/upload-url',
  lossProofSubmit: '/api/loss-proofs/submit',
  lossProofCurrent: '/api/loss-proofs/current',
  community: '/api/community',
  honor: '/api/honor',
  depositCheck: '/api/deposits/check',
  unlockedClaim: '/api/claims/unlocked',
  inviteShare: '/api/invites/share',
  tokenSaleIntent: '/api/token-sale/intent',
} as const

type ApiRequestOptions = {
  method?: 'GET' | 'POST'
  body?: unknown
}

function cleanEnv(value: string | undefined) {
  return value?.trim() || ''
}

export function getApiBaseUrl() {
  return cleanEnv(process.env.NEXT_PUBLIC_API_BASE_URL).replace(/\/+$/, '')
}

export function isApiAdapterEnabled() {
  return cleanEnv(process.env.NEXT_PUBLIC_USE_API_ADAPTER) === 'true'
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<ApiResult<T>> {
  const baseUrl = getApiBaseUrl()

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: 'include',
    })

    if (!response.ok) {
      return { ok: false, error: `API request failed with ${response.status}.`, status: response.status }
    }

    return { ok: true, data: (await response.json()) as T }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'API request failed.',
    }
  }
}

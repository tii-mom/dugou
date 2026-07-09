import { getRequestContext } from '@cloudflare/next-on-pages'
export const runtime = 'edge'

type CloudflareHealthEnv = {
  DB?: {
    prepare: (query: string) => {
      run: () => Promise<unknown>
    }
  }
  LOSS_PROOFS?: {
    list: (options: { limit: number }) => Promise<unknown>
  }
  AI?: {
    run?: unknown
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export async function GET() {
  const result = {
    db: 'missing',
    r2: 'missing',
    ai: 'missing',
    status: 'error',
  }

  try {
    let context
    try {
      context = getRequestContext()
    } catch {}

    const env = (context?.env || {}) as CloudflareHealthEnv

    if (!env.DB && !env.LOSS_PROOFS) {
      return new Response(
        JSON.stringify({
          status: 'demo_fallback',
          message: 'No Cloudflare bindings found. Running in local dev fallback mode.',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Test D1 DB
    if (env.DB) {
      try {
        await env.DB.prepare('SELECT 1').run()
        result.db = 'ok'
      } catch (e: unknown) {
        result.db = `failed: ${getErrorMessage(e)}`
      }
    }

    // Test R2 LOSS_PROOFS
    if (env.LOSS_PROOFS) {
      try {
        await env.LOSS_PROOFS.list({ limit: 1 })
        result.r2 = 'ok'
      } catch (e: unknown) {
        result.r2 = `failed: ${getErrorMessage(e)}`
      }
    }

    // Test Workers AI
    if (env.AI) {
      if (typeof env.AI.run === 'function') {
        result.ai = 'ok'
      } else {
        result.ai = 'invalid_binding'
      }
    } else {
      result.ai = 'not_bound'
    }

    // AI is optional, but DB and R2 must succeed for status ok
    if (result.db === 'ok' && result.r2 === 'ok') {
      result.status = 'ok'
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify(result), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e: unknown) {
    return new Response(
      JSON.stringify({
        status: 'error',
        error: getErrorMessage(e),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

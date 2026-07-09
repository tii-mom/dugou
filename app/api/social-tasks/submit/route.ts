import { getRequestContext } from '@cloudflare/next-on-pages'
import { getSessionUser } from '@/lib/auth-server'
import { verifySocialTask } from '@/lib/agnes-ai'

export const runtime = 'edge'

const PLATFORM_DOMAINS: Record<string, string[]> = {
  telegram: ['t.me', 'telegram.me'],
  x: ['x.com', 'twitter.com'],
  binance_square: ['binance.com'],
  okx_planet: ['okx.com'],
}

const DIAO_KEYWORDS = ['diao', '赌狗也有春天', 'dawn is always ours']

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Normalize URL by parsing it, cleaning trailing slashes, and removing common tracking query parameters
function normalizeUrl(urlStr: string): string {
  const url = new URL(urlStr)
  url.hash = ''
  // Keep hostname lowercase
  const host = url.hostname.toLowerCase()
  url.hostname = host
  
  // Remove common marketing/tracking query parameters to prevent duplicates
  const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'spm', 's']
  trackingParams.forEach((param) => url.searchParams.delete(param))
  
  let result = url.toString()
  if (result.endsWith('/')) {
    result = result.substring(0, result.length - 1)
  }
  return result
}

// SSRF domain check: hostname must equal domain or end with .domain
function isValidDomain(host: string, platform: string): boolean {
  const allowed = PLATFORM_DOMAINS[platform]
  if (!allowed) return false
  const hostname = host.toLowerCase()
  return allowed.some((domain) => hostname === domain || hostname.endsWith('.' + domain))
}

// Parse platform post id from URL paths if possible
function extractPostId(urlStr: string): string | null {
  try {
    const url = new URL(urlStr)
    const pathParts = url.pathname.split('/').filter(Boolean)
    if (pathParts.length > 0) {
      return pathParts[pathParts.length - 1]
    }
  } catch {}
  return null
}

// Fetch URL with SSRF protection, redirection limit, timeout, and max 256KB payload
async function fetchSocialContent(
  urlStr: string,
  platform: string
): Promise<{ status: 'success' | 'failed'; title: string; text: string; error?: string }> {
  try {
    let currentUrl = urlStr
    let redirectCount = 0
    const maxRedirects = 3

    while (redirectCount <= maxRedirects) {
      const parsed = new URL(currentUrl)

      if (parsed.protocol !== 'https:') {
        return { status: 'failed', title: '', text: '', error: 'Only HTTPS protocol is allowed.' }
      }

      if (!isValidDomain(parsed.hostname, platform)) {
        return { status: 'failed', title: '', text: '', error: `SSRF Blocked: Hostname ${parsed.hostname} is not whitelisted for ${platform}.` }
      }

      // Check for private / loopback IP addresses in case they bypass hostname verification (in edge wrangler/cloudflare)
      const ipRegex = /^(?:127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[0-1])\.|169\.254\.)/
      if (ipRegex.test(parsed.hostname) || parsed.hostname === 'localhost') {
        return { status: 'failed', title: '', text: '', error: 'SSRF Blocked: Local and loopback hostnames are not permitted.' }
      }

      // Fetch with redirect: manual so we can manually validate domain whitelist on each hop
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 seconds timeout

      let res: Response
      try {
        res = await fetch(currentUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 DIAO-Verification/1.0',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          },
          redirect: 'manual',
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timeoutId)
      }

      // Handle redirects manually
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const location = res.headers.get('location')
        if (!location) {
          return { status: 'failed', title: '', text: '', error: `Redirect status ${res.status} missing location header.` }
        }
        const resolvedRedirect = new URL(location, currentUrl).toString()
        currentUrl = resolvedRedirect
        redirectCount++
        continue
      }

      if (!res.ok) {
        return { status: 'failed', title: '', text: '', error: `HTTP error ${res.status}` }
      }

      // Read response body up to 256KB (262144 bytes) to avoid memory exhaust
      const reader = res.body?.getReader()
      if (!reader) {
        return { status: 'failed', title: '', text: '', error: 'Response body is not readable.' }
      }

      let totalBytes = 0
      const chunks: Uint8Array[] = []
      const maxBytes = 256 * 1024

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          if (totalBytes + value.length > maxBytes) {
            // Cap at 256KB
            const sliced = value.slice(0, maxBytes - totalBytes)
            chunks.push(sliced)
            totalBytes += sliced.length
            break
          }
          chunks.push(value)
          totalBytes += value.length
        }
      }

      const merged = new Uint8Array(totalBytes)
      let offset = 0
      for (const chunk of chunks) {
        merged.set(chunk, offset)
        offset += chunk.length
      }

      const html = new TextDecoder('utf-8').decode(merged)

      // Simple regex parser for metadata
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
                        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i) ||
                        html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
      
      const bodyText = html.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
                           .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')
                           .replace(/<[^>]+>/g, ' ')
                           .replace(/\s+/g, ' ')
                           .trim()
                           .substring(0, 1000)

      const title = (titleMatch?.[1] || '').trim()
      const desc = (descMatch?.[1] || '').trim()
      const text = `${desc} ${bodyText}`.trim()

      return { status: 'success', title, text }
    }

    return { status: 'failed', title: '', text: '', error: 'Too many redirects.' }
  } catch (err) {
    return { status: 'failed', title: '', text: '', error: err instanceof Error ? err.message : String(err) }
  }
}

export async function POST(request: Request) {
  try {
    let context
    try {
      context = getRequestContext()
    } catch {}
    const env = (context?.env || {}) as CloudflareEnv
    const db = env.DB

    if (!db) {
      return json({ error: 'D1 DB binding is not configured.' }, 503)
    }

    // Verify session
    const user = await getSessionUser(request, db)
    if (!user) {
      return json({ error: 'Unauthorized.' }, 401)
    }

    const body = (await request.json()) as {
      platform?: string
      taskType?: string
      url?: string
    }
    const { platform, taskType, url } = body

    if (!platform || !taskType || !url) {
      return json({ error: 'Missing required parameters.' }, 400)
    }

    // Allow list platforms check
    const supportedPlatforms = ['telegram', 'x', 'binance_square', 'okx_planet']
    if (!supportedPlatforms.includes(platform)) {
      return json({ error: `Platform ${platform} is not supported.` }, 400)
    }

    // Verify HTTPS scheme
    if (!url.toLowerCase().startsWith('https://')) {
      return json({ error: 'Only HTTPS URLs are allowed.' }, 400)
    }

    // Normalize URL & platform post id
    let normalizedUrl = ''
    try {
      normalizedUrl = normalizeUrl(url)
    } catch {
      return json({ error: 'Invalid URL format.' }, 400)
    }

    const parsedNormalizedUrl = new URL(normalizedUrl)
    if (!isValidDomain(parsedNormalizedUrl.hostname, platform)) {
      return json({ error: `Hostname is not whitelisted for ${platform}.` }, 400)
    }

    const postId = extractPostId(normalizedUrl)

    // Check unique submission rule
    const existing = await db
      .prepare('SELECT id FROM social_task_submissions WHERE user_id = ? AND submitted_url_normalized = ?')
      .bind(user.id, normalizedUrl)
      .first()

    if (existing) {
      return json({ error: 'You have already submitted this link for validation.' }, 409)
    }

    // Fetch HTML post
    const fetchRes = await fetchSocialContent(normalizedUrl, platform)

    let hardRuleStatus: 'pass' | 'fail' = 'fail'
    let hardRuleReason = ''
    let status = 'pending_review'
    
    let aiProvider = null
    let aiModel = null
    let aiResultJson = null
    let aiSuggestedStatus = null
    let reviewStatusReason = ''

    if (fetchRes.status === 'success') {
      const combinedText = `${fetchRes.title} ${fetchRes.text}`.toLowerCase()
      const hasKeywords = DIAO_KEYWORDS.some((kw) => combinedText.includes(kw))

      if (!hasKeywords) {
        hardRuleStatus = 'fail'
        hardRuleReason = '链接页面内容中未检测到 DIAO 项目关联关键字。'
        status = 'rejected'
        reviewStatusReason = '硬规则校验不通过：未包含项目关键字。'
      } else {
        hardRuleStatus = 'pass'
        hardRuleReason = '已成功检测到项目关联关键字。'

        // Call Agnes AI if configured
        if (env.AGNES_AI_API_KEY?.trim()) {
          try {
            aiProvider = 'agnes-ai'
            aiModel = env.AGNES_AI_TASK_VERIFY_MODEL?.trim() || env.AGNES_AI_MODEL?.trim() || 'agnes-2.0-flash'
            
            const aiRes = await verifySocialTask(env, fetchRes.title, fetchRes.text, normalizedUrl)
            
            aiResultJson = JSON.stringify(aiRes)
            aiSuggestedStatus = aiRes.aiSuggestedStatus
            reviewStatusReason = aiRes.reason || '已通过 Agnes AI 验证，等待人工最终审核。'
          } catch (aiErr) {
            console.error('Agnes AI task verification failed:', aiErr)
            aiSuggestedStatus = 'pending_review'
            reviewStatusReason = 'Agnes AI 自动校验失败，已转入人工挂起审核。'
          }
        } else {
          reviewStatusReason = 'Agnes AI 未配置，已转入人工挂起审核。'
        }
      }
    } else {
      // Fetch failed, acknowledge and fallback to manual review
      hardRuleStatus = 'fail'
      hardRuleReason = `页面内容抓取失败: ${fetchRes.error || '未知错误'}`
      reviewStatusReason = `抓取内容失败（${fetchRes.error || '未知错误'}），需人工复核截图或链接。`
    }

    const uuid = crypto.randomUUID()
    const nowIso = new Date().toISOString()

    // Insert record
    await db
      .prepare(
        `INSERT INTO social_task_submissions (
          id, user_id, platform, task_type, submitted_url, submitted_url_normalized, platform_post_id,
          fetched_title, fetched_text, fetch_status, fetch_error,
          hard_rule_status, hard_rule_reason,
          ai_provider, ai_model, ai_result_json, ai_suggested_status,
          status, review_status_reason, reward_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'not_issued', ?, ?)`
      )
      .bind(
        uuid,
        user.id,
        platform,
        taskType,
        url,
        normalizedUrl,
        postId,
        fetchRes.title || null,
        fetchRes.text || null,
        fetchRes.status,
        fetchRes.error || null,
        hardRuleStatus,
        hardRuleReason,
        aiProvider,
        aiModel,
        aiResultJson,
        aiSuggestedStatus,
        status,
        reviewStatusReason,
        nowIso,
        nowIso
      )
      .run()

    return json({
      submission: {
        id: uuid,
        status,
        aiSuggestedStatus,
        reason: reviewStatusReason,
      },
    })
  } catch (e: unknown) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
}

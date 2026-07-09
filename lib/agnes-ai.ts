export interface AgnesLossAnalysis {
  amountUsd: number | null
  exchange: string
  confidence: number
  isLikelyTradingLossScreenshot: boolean
  riskFlags: string[]
  reason: string
}

export interface AgnesTaskVerification {
  aiSuggestedStatus: 'ai_passed' | 'rejected' | 'pending_review'
  reason: string
}

// Clean model string or return default
function getVerifyModel(env: CloudflareEnv) {
  return env.AGNES_AI_TASK_VERIFY_MODEL?.trim() || env.AGNES_AI_MODEL?.trim() || 'agnes-2.0-flash'
}

function getVisionModel(env: CloudflareEnv) {
  return env.AGNES_AI_VISION_MODEL?.trim() || env.AGNES_AI_MODEL?.trim() || 'agnes-2.0-flash'
}

// Timeout helper wrapping fetch
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 20000): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(id)
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

// Base chat completion request
export async function callAgnesChat(
  env: CloudflareEnv,
  messages: unknown[],
  model: string,
  responseFormatJson = false
): Promise<string> {
  const apiKey = env.AGNES_AI_API_KEY?.trim()
  const baseUrl = env.AGNES_AI_BASE_URL?.trim() || 'https://apihub.agnes-ai.com/v1'

  if (!apiKey) {
    throw new Error('Agnes AI API key is not configured.')
  }

  const payload: Record<string, unknown> = {
    model,
    messages,
  }

  if (responseFormatJson) {
    payload.response_format = { type: 'json_object' }
  }

  const res = await fetchWithTimeout(
    `${baseUrl}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    },
    20000
  )

  if (!res.ok) {
    const errorText = await res.text().catch(() => '')
    throw new Error(`Agnes API returned HTTP ${res.status}: ${errorText.slice(0, 500)}`)
  }

  const data = (await res.json()) as {
    choices?: Array<{
      message?: {
        content?: string
      }
    }>
  }

  const content = data.choices?.[0]?.message?.content
  if (content === undefined || content === null) {
    throw new Error('Agnes API response is missing choice message content.')
  }

  return content
}

// Clean markdown JSON code block formatting
export function cleanJsonBlock(text: string): string {
  let clean = text.trim()
  if (clean.startsWith('```json')) {
    clean = clean.substring(7)
  } else if (clean.startsWith('```')) {
    clean = clean.substring(3)
  }
  if (clean.endsWith('```')) {
    clean = clean.substring(0, clean.length - 3)
  }
  return clean.trim()
}

// Helper to check and map exchange platforms to whitelist
export function mapExchangeToWhitelist(exchangeName: string | undefined | null): string {
  if (!exchangeName) return 'Unknown'
  const whitelist = ['Binance', 'OKX', 'Bybit', 'Bitget', 'Gate', 'Hyperliquid', 'Other', 'Unknown']
  const matched = whitelist.find((ex) => ex.toLowerCase() === exchangeName.toLowerCase())
  return matched || 'Unknown'
}

// 1. Loss Screenshot Analyzer
export async function analyzeLossScreenshot(
  env: CloudflareEnv,
  imageBuffer: ArrayBuffer,
  mimeType: string
): Promise<AgnesLossAnalysis> {
  const base64 = arrayBufferToBase64(imageBuffer)
  const dataUrl = `data:${mimeType};base64,${base64}`
  const model = getVisionModel(env)

  const messages = [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `You are an expert auditor. Analyze this trading platform screenshot and extract the following:
1. "amountUsd" (number): The exact loss amount visible in USD. Return null if no clear loss value is found.
2. "exchange" (string): The platform name (e.g., "Binance", "OKX", "Bybit", "Bitget", "Gate", "Hyperliquid", "Other", or "Unknown").
3. "confidence" (number): A float confidence score from 0.0 to 1.0.
4. "isLikelyTradingLossScreenshot" (boolean): True if it is a genuine screen showing closed PnL or active contract loss.
5. "riskFlags" (array of strings): Flags like "cropped", "low_resolution", "photoshop_suspect" or empty array.
6. "reason" (string): Brief review notes outlining why it passed/failed.

You MUST respond strictly in a valid JSON object matching this schema:
{
  "amountUsd": 120.50,
  "exchange": "Binance",
  "confidence": 0.85,
  "isLikelyTradingLossScreenshot": true,
  "riskFlags": [],
  "reason": "..."
}`,
        },
        {
          type: 'image_url',
          image_url: {
            url: dataUrl,
          },
        },
      ],
    },
  ]

  const rawResult = await callAgnesChat(env, messages, model, true)
  const clean = cleanJsonBlock(rawResult)
  const parsed = JSON.parse(clean) as {
    amountUsd?: unknown
    exchange?: unknown
    confidence?: unknown
    isLikelyTradingLossScreenshot?: unknown
    riskFlags?: unknown
    reason?: unknown
  }

  // Range and whitelist sanitizations
  let amountUsd: number | null = null
  if (parsed.amountUsd !== undefined && parsed.amountUsd !== null) {
    const val = Number(parsed.amountUsd)
    if (Number.isFinite(val) && val > 0 && val < 10000000) {
      amountUsd = val
    }
  }

  const exchange = mapExchangeToWhitelist(parsed.exchange as string)

  let confidence = Number(parsed.confidence || 0)
  if (isNaN(confidence) || confidence < 0 || confidence > 1) {
    confidence = 0
  }

  const isLikelyTradingLossScreenshot = Boolean(parsed.isLikelyTradingLossScreenshot)
  const riskFlags = Array.isArray(parsed.riskFlags) ? parsed.riskFlags.map(String) : []
  const reason = String(parsed.reason || '')

  return {
    amountUsd,
    exchange,
    confidence,
    isLikelyTradingLossScreenshot,
    riskFlags,
    reason,
  }
}

// 2. Social Campaign Post Verifier
export async function verifySocialTask(
  env: CloudflareEnv,
  title: string,
  text: string,
  url: string
): Promise<AgnesTaskVerification> {
  const model = getVerifyModel(env)

  const messages = [
    {
      role: 'system',
      content: 'You are an automated campaign verification agent. Analyze post metadata and decide if it satisfies the promotion guidelines.',
    },
    {
      role: 'user',
      content: `Please evaluate this user social post for our "DIAO" token project:
- Title: "${title}"
- Content Text: "${text}"
- Submitted URL: "${url}"

Campaign guidelines:
- The user must promote the DIAO project.
- Evaluate the semantics and context.
- Output a JSON response suggesting the outcome status:
  - "ai_passed": Content is relevant, supportive, and aligns with promoting DIAO.
  - "rejected": Content is clearly unrelated, blank, spam, hostile, or irrelevant.
  - "pending_review": Ambiguous, missing information, or needs manual lookup.

You MUST respond strictly in a valid JSON object matching this schema:
{
  "aiSuggestedStatus": "ai_passed",
  "reason": "..."
}`,
    },
  ]

  const rawResult = await callAgnesChat(env, messages, model, true)
  const clean = cleanJsonBlock(rawResult)
  const parsed = JSON.parse(clean) as {
    aiSuggestedStatus?: unknown
    reason?: unknown
  }

  let aiSuggestedStatus: 'ai_passed' | 'rejected' | 'pending_review' = 'pending_review'
  const suggested = String(parsed.aiSuggestedStatus || '').toLowerCase()
  if (suggested === 'ai_passed') {
    aiSuggestedStatus = 'ai_passed'
  } else if (suggested === 'rejected') {
    aiSuggestedStatus = 'rejected'
  }

  return {
    aiSuggestedStatus,
    reason: String(parsed.reason || ''),
  }
}

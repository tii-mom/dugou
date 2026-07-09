import { getRequestContext } from '@cloudflare/next-on-pages'
import { getSessionUser } from '@/lib/auth-server'
import { type ExchangeSource } from '@/lib/business-types'
import { analyzeLossScreenshot } from '@/lib/agnes-ai'

export const runtime = 'edge'

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      objectKey?: string
      originalFileName?: string
    }
    const { objectKey, originalFileName } = body

    if (!objectKey || !originalFileName) {
      return new Response(JSON.stringify({ error: 'Missing required parameters.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    let context
    try {
      context = getRequestContext()
    } catch {}
    const env = (context?.env || {}) as CloudflareEnv
    const db = env.DB
    const r2 = env.LOSS_PROOFS
    const isProd = process.env.NODE_ENV === 'production' || Boolean(db)

    if (!r2 && isProd) {
      return new Response(JSON.stringify({ error: 'R2 bucket is not configured. Server refuses submits in production.' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const ai = env.AI

    let userId = 'mock-user-id'
    let claimRecord = null

    if (db) {
      const user = await getSessionUser(request, db)
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      userId = user.id

      // Verify ownership in database
      claimRecord = await db
        .prepare('SELECT * FROM loss_claims WHERE r2_object_key = ? AND user_id = ?')
        .bind(objectKey, userId)
        .first()

      if (!claimRecord) {
        return new Response(
          JSON.stringify({ error: 'Claim record not found or access denied.' }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      if (claimRecord.status !== 'not_submitted' && claimRecord.status !== 'uploaded') {
        return new Response(
          JSON.stringify({ error: 'Claim has already been submitted or is under review.' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }
    }

    let amountUsdCents: number | null = null
    let exchange: ExchangeSource = 'Unknown'
    let confidence = 0
    let ocrText = ''
    let reviewReason = '已提交亏损截图，等待人工审核确认。'
    let provider = ai ? 'cloudflare-workers-ai' : 'none'

    if (r2 && db) {
      try {
        const r2Obj = await r2.get(objectKey)
        if (r2Obj) {
          const buffer = await r2Obj.arrayBuffer()

          if (env.AGNES_AI_API_KEY?.trim()) {
            try {
              provider = 'agnes-ai'
              const agnesRes = await analyzeLossScreenshot(env, buffer, claimRecord?.file_mime || 'image/png')
              amountUsdCents = agnesRes.amountUsd !== null ? Math.round(agnesRes.amountUsd * 100) : null
              exchange = agnesRes.exchange as ExchangeSource
              confidence = agnesRes.confidence
              ocrText = JSON.stringify(agnesRes)
              reviewReason = agnesRes.reason || '已通过 Agnes AI 识别，等待人工审核确认。'
            } catch (agnesErr) {
              console.error('Agnes AI screenshot analysis failed, falling back to Workers AI:', agnesErr)
              await runWorkersAI(buffer)
            }
          } else {
            await runWorkersAI(buffer)
          }

          async function runWorkersAI(buf: ArrayBuffer) {
            if (!ai) {
              provider = 'none'
              return
            }
            provider = 'cloudflare-workers-ai'
            const u8Array = new Uint8Array(buf)
            const model = env.CLOUDFLARE_AI_MODEL || '@cf/llava-hf/llava-1.5-7b-hf'

            const aiResponse = await ai.run(model, {
              image: Array.from(u8Array),
              prompt:
                "Analyze this image and identify the loss amount in USD and exchange platform. Reply strictly in JSON format matching exactly: { \"amount\": 120.50, \"exchange\": \"Binance\" }. Use null if amount is missing and 'Unknown' if exchange is missing.",
            })

            ocrText = typeof aiResponse === 'string' ? aiResponse : JSON.stringify(aiResponse)

            try {
              let cleanText = ocrText.trim()
              if (cleanText.startsWith('```json')) {
                cleanText = cleanText.substring(7)
              } else if (cleanText.startsWith('```')) {
                cleanText = cleanText.substring(3)
              }
              if (cleanText.endsWith('```')) {
                cleanText = cleanText.substring(0, cleanText.length - 3)
              }
              cleanText = cleanText.trim()

              const data = JSON.parse(cleanText) as { amount?: unknown; exchange?: string }
              if (data.amount && !isNaN(Number(data.amount))) {
                amountUsdCents = Math.round(Number(data.amount) * 100)
                confidence = 0.82
                reviewReason = '已成功识别交易所来源和建议金额，正等待人工复核确认。'
              }
              if (data.exchange && typeof data.exchange === 'string') {
                const allowedExchanges = [
                  'Binance',
                  'OKX',
                  'Bybit',
                  'Bitget',
                  'Gate',
                  'Hyperliquid',
                  'Other',
                  'Unknown',
                ]
                const matched = allowedExchanges.find(
                  (ex) => ex.toLowerCase() === (data.exchange as string).toLowerCase()
                )
                exchange = (matched || 'Unknown') as ExchangeSource
              }
            } catch {
              // Regex parsing fallback
              const valMatch =
                ocrText.match(/(?:loss|deficit|amount)[\s\:\-\$]+([\d\.\,]+)/i) ||
                ocrText.match(/[\-\$]([\d\.\,]+)/)
              if (valMatch) {
                const num = parseFloat(valMatch[1].replace(/,/g, ''))
                if (!isNaN(num)) {
                  amountUsdCents = Math.round(num * 100)
                  confidence = 0.5
                  reviewReason = '通过文字匹配提取到建议金额，等待人工复核确认。'
                }
              }

              const exchanges = ['Binance', 'OKX', 'Bybit', 'Bitget', 'Gate', 'Hyperliquid']
              for (const ex of exchanges) {
                if (ocrText.toLowerCase().includes(ex.toLowerCase())) {
                  exchange = ex as ExchangeSource
                  break
                }
              }
            }
          }
        }
      } catch (aiErr: unknown) {
        console.error('OCR analysis failed:', aiErr)
        reviewReason = `OCR 自动解析出错: ${getErrorMessage(aiErr)}。等待人工介入审核。`
      }
    }

    const nowIso = new Date().toISOString()
    const finalStatus = 'pending_review' // Never automatically verified

    if (db && claimRecord) {
      await db
        .prepare(
          `UPDATE loss_claims 
           SET status = ?, amount_usd = ?, exchange = ?, exchange_confidence = ?, amount_confidence = ?, ocr_provider = ?, ocr_text = ?, review_status_reason = ?, updated_at = ?
           WHERE id = ?`
        )
        .bind(
          finalStatus,
          amountUsdCents,
          exchange,
          exchange ? 0.8 : 0,
          amountUsdCents ? confidence : 0,
          provider,
          ocrText,
          reviewReason,
          nowIso,
          claimRecord.id
        )
        .run()
    }

    // Convert internal cents to whole USD for contract response
    const displayAmountUsd = amountUsdCents !== null ? Math.floor(amountUsdCents / 100) : null

    return new Response(
      JSON.stringify({
        lossClaim: {
          status: finalStatus,
          amountUsd: displayAmountUsd,
          certificateNo: null,
          exchange,
          confidence,
          fileName: originalFileName,
          message: reviewReason,
          source: 'api',
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: getErrorMessage(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

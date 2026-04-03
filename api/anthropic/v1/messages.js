const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*")
}

async function readBodyString(req) {
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === "string" ? req.body : JSON.stringify(req.body)
  }
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks).toString("utf8")
}

export default async function handler(req, res) {
  setCors(res)

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")
    res.statusCode = 204
    res.end()
    return
  }

  if (req.method !== "POST") {
    res.statusCode = 405
    res.setHeader("Content-Type", "application/json")
    res.end(JSON.stringify({ error: "Method not allowed" }))
    return
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    res.statusCode = 500
    res.setHeader("Content-Type", "application/json")
    res.end(JSON.stringify({ error: "Server misconfiguration: missing ANTHROPIC_API_KEY" }))
    return
  }

  let bodyString
  try {
    bodyString = await readBodyString(req)
  } catch {
    res.statusCode = 400
    res.setHeader("Content-Type", "application/json")
    res.end(JSON.stringify({ error: "Invalid request body" }))
    return
  }

  try {
    const upstream = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: bodyString,
    })

    const text = await upstream.text()
    const ct = upstream.headers.get("content-type") || "application/json"

    res.statusCode = upstream.status
    res.setHeader("Content-Type", ct)
    res.end(text)
  } catch (err) {
    console.error("Anthropic proxy error:", err)
    res.statusCode = 502
    res.setHeader("Content-Type", "application/json")
    res.end(JSON.stringify({ error: "Upstream request failed" }))
  }
}

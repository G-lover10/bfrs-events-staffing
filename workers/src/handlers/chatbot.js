import { jsonResponse, errorJson } from "../lib/json.js";
import { verifyBearer, shadowOrEnforce } from "../lib/auth.js";

export default async function chatbot(request, env, ctx, origin) {
  if (env.ENABLE_CHATBOT === "false") {
    return errorJson(503, "Chatbot is disabled", env, origin);
  }

  const auth = await verifyBearer(request, env);
  const block = shadowOrEnforce(env, auth, "POST /chatbot");
  if (block) return errorJson(block.status, block.reason, env, origin);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return errorJson(400, "Invalid JSON", env, origin);
  }

  const { messages, system } = payload || {};
  if (!Array.isArray(messages)) {
    return errorJson(400, "messages must be an array", env, origin);
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      max_tokens: 400,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });

  const data = await res.json();
  return jsonResponse(res.status, data, env, origin);
}

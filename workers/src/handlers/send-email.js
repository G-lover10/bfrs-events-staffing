import { jsonResponse, errorJson } from "../lib/json.js";
import { verifyBearer, shadowOrEnforce } from "../lib/auth.js";

export default async function sendEmail(request, env, ctx, origin) {
  const auth = await verifyBearer(request, env);
  const block = shadowOrEnforce(env, auth, "POST /send-email");
  if (block) return errorJson(block.status, block.reason, env, origin);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return errorJson(400, "Invalid JSON", env, origin);
  }

  const { to, subject, html } = payload || {};
  if (!to || !subject || !html) {
    return errorJson(400, "to, subject, html are required", env, origin);
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.RESEND_KEY}`,
    },
    body: JSON.stringify({
      from: "BFRS Events <alerts@grabcalls.com>",
      to,
      subject,
      html,
    }),
  });

  const data = await res.json();
  return jsonResponse(res.status, data, env, origin);
}

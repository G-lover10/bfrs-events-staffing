const { corsHeaders, verifyUser } = require("./_security");

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin || event.headers?.Origin);

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const user = await verifyUser(event.headers?.authorization || event.headers?.Authorization);
  if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: "Unauthorized" }) };

  try {
    const payload = JSON.parse(event.body);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_KEY}`,
      },
      body: JSON.stringify({
        from: "BFRS Events <alerts@grabcalls.com>",
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      }),
    });
    const data = await res.json();
    return { statusCode: res.status, headers, body: JSON.stringify(data) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};

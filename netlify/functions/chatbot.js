const { corsHeaders, verifyUser } = require("./_security");

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin || event.headers?.Origin);

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const user = await verifyUser(event.headers?.authorization || event.headers?.Authorization);
  if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: "Unauthorized" }) };

  if (!process.env.GROQ_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: { message: "GROQ_KEY environment variable is not set in Netlify" } }),
    };
  }

  try {
    const { messages, system } = JSON.parse(event.body);
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        max_tokens: 400,
        messages: [{ role: "system", content: system }, ...messages],
      }),
    });
    const data = await res.json();
    return { statusCode: res.status, headers, body: JSON.stringify(data) };
  } catch (e) {
    console.error("chatbot failed:", e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: { message: "Internal error" } }) };
  }
};

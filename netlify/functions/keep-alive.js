const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  "https://tohhqssnngvavkkeqzfl.supabase.co",
  process.env.SUPABASE_SERVICE_KEY || "" + process.env.SUPABASE_SERVICE_KEY + ""
);

exports.handler = async (event) => {
  const key = event.queryStringParameters?.key;
  if (key !== "bfrs-keepalive-2026") {
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  }
  try {
    const { error } = await supabase.from("profiles").select("id").limit(1);
    if (error) throw error;
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alive: true, pinged: new Date().toISOString(), status: 200 }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ alive: false, error: e.message }),
    };
  }
};

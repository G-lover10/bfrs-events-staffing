import { preflightResponse } from "./lib/cors.js";
import { errorJson } from "./lib/json.js";
import chatbot from "./handlers/chatbot.js";
import sendEmail from "./handlers/send-email.js";
import keepAlive from "./handlers/keep-alive.js";
import payPeriodReport from "./handlers/pay-period-report.js";

const ROUTES = {
  "POST /chatbot": chatbot,
  "POST /send-email": sendEmail,
  "GET /keep-alive": keepAlive,
  "POST /pay-period-report": payPeriodReport,
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const method = request.method;

    if (method === "OPTIONS") return preflightResponse(env, origin);

    const route = `${method} ${url.pathname}`;
    const handler = ROUTES[route];

    if (!handler) {
      return errorJson(404, "Not Found", env, origin);
    }

    try {
      return await handler(request, env, ctx, origin);
    } catch (e) {
      console.error(`[${route}] ${e.message}`, e.stack);
      return errorJson(500, "Internal error", env, origin);
    }
  },
};

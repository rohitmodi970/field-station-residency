/**
 * TinyFish Web Agent — Luma Registration Module
 *
 * Sends a natural-language automation goal to the TinyFish SSE endpoint.
 * Returns a ReadableStream of SSE events for the caller to consume.
 *
 * Flow:
 *   1. Build a detailed goal prompt from the event URL + user profile.
 *   2. POST to TinyFish /v1/automation/run-sse with SSE streaming.
 *   3. Parse the SSE stream line-by-line.
 *   4. Yield structured events (STARTED, STREAMING_URL, PROGRESS, COMPLETE, ERROR).
 */

export interface AgentProfile {
  name: string;
  email: string;
  bio?: string;
  linkedin?: string;
  twitter?: string;
  company?: string;
  role?: string;
  phone?: string;
  website?: string;
  customAnswers?: Record<string, string>;
}

export interface AgentEvent {
  type:
    | "LOG"
    | "PROGRESS"
    | "STREAMING_URL"
    | "COMPLETE"
    | "ERROR";
  message: string;
  runId?: string;
  streamingUrl?: string;
  status?: "SUCCESS" | "FAILED";
  result?: Record<string, unknown> | null;
}

export interface TinyfishCompletionPayload {
  eventUrl: string;
  runId?: string;
  status: "SUCCESS" | "FAILED";
  message: string;
  result?: Record<string, unknown> | null;
  rawEvent?: Record<string, unknown>;
}

export interface TinyfishStreamHooks {
  onComplete?: (payload: TinyfishCompletionPayload) => void | Promise<void>;
}

const TINYFISH_API_URL = "https://agent.tinyfish.ai/v1/automation/run-sse";

/**
 * Build the natural-language goal the TinyFish agent will execute.
 */
export function buildGoal(profile: AgentProfile): string {
  const lines: string[] = [
    "You are an automated registration assistant. Follow these steps carefully:",
    "",
    "1. Look at the current page (a Luma event page).",
    "2. Find and click the main registration / RSVP / Attend button.",
    "   - It might say 'Register', 'RSVP', 'Request to Join', 'Attend', or similar.",
    "   - If there are multiple buttons, pick the primary one.",
    "3. A registration form should appear (either on the same page or a new one).",
    "4. Fill in all visible form fields using the profile data below.",
    "5. For any dropdown or select field, choose the closest matching option.",
    "6. Check any required checkboxes (terms / code of conduct).",
    "7. Do NOT check optional marketing / newsletter checkboxes unless they are required.",
    "8. After filling all fields, click the Submit / Register / Confirm button.",
    "9. Wait for a confirmation message or screen.",
    "10. Report the result: whether registration succeeded, failed, or hit a CAPTCHA.",
    "",
    "=== USER PROFILE DATA ===",
    `Full Name: ${profile.name}`,
    `Email: ${profile.email}`,
  ];

  if (profile.bio) lines.push(`Bio / About: ${profile.bio}`);
  if (profile.linkedin) lines.push(`LinkedIn: ${profile.linkedin}`);
  if (profile.twitter) lines.push(`Twitter / X: ${profile.twitter}`);
  if (profile.company) lines.push(`Company: ${profile.company}`);
  if (profile.role) lines.push(`Role / Title: ${profile.role}`);
  if (profile.phone) lines.push(`Phone: ${profile.phone}`);
  if (profile.website) lines.push(`Website: ${profile.website}`);

  if (profile.customAnswers && Object.keys(profile.customAnswers).length > 0) {
    lines.push("");
    lines.push("=== ADDITIONAL FORM ANSWERS ===");
    for (const [question, answer] of Object.entries(profile.customAnswers)) {
      lines.push(`Q: ${question}`);
      lines.push(`A: ${answer}`);
    }
  }

  lines.push("");
  lines.push("=== IMPORTANT RULES ===");
  lines.push("- If a CAPTCHA appears, STOP and report 'CAPTCHA_DETECTED'.");
  lines.push("- If a login wall appears, STOP and report 'LOGIN_REQUIRED'.");
  lines.push("- If the event is full / sold out, STOP and report 'EVENT_FULL'.");
  lines.push("- If registration is already closed, STOP and report 'REGISTRATION_CLOSED'.");
  lines.push("- Close any cookie banners or popups before interacting with the form.");
  lines.push("- Return the final result as JSON with keys: status, message, confirmationText");

  return lines.join("\n");
}

/**
 * Register for a Luma event using TinyFish Web Agent.
 * Returns a ReadableStream that yields newline-delimited JSON AgentEvents.
 */
export async function createRegistrationStream(
  eventUrl: string,
  profile: AgentProfile,
  hooks?: TinyfishStreamHooks,
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.TINYFISH_API_KEY;
  const encoder = new TextEncoder();

  const send = (event: AgentEvent): Uint8Array =>
    encoder.encode(`data: ${JSON.stringify(event)}\n\n`);

  if (!apiKey || apiKey === "your_tinyfish_api_key_here") {
    return new ReadableStream({
      start(controller) {
        controller.enqueue(
          send({
            type: "ERROR",
            message:
              "TinyFish API key is not configured. Set TINYFISH_API_KEY in your .env file.",
          }),
        );
        controller.close();
      },
    });
  }

  const goal = buildGoal(profile);

  // Kick off the TinyFish request
  let tfResponse: Response;
  try {
    tfResponse = await fetch(TINYFISH_API_URL, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: eventUrl,
        goal,
        browser_profile: "stealth",
        proxy_config: { enabled: true, country_code: "US" },
      }),
    });
  } catch (fetchErr: unknown) {
    const msg =
      fetchErr instanceof Error ? fetchErr.message : "Unknown network error";
    return new ReadableStream({
      start(controller) {
        controller.enqueue(
          send({ type: "ERROR", message: `Network error calling TinyFish: ${msg}` }),
        );
        controller.close();
      },
    });
  }

  if (!tfResponse.ok && !tfResponse.body) {
    const text = await tfResponse.text().catch(() => "Unknown error");
    return new ReadableStream({
      start(controller) {
        controller.enqueue(
          send({
            type: "ERROR",
            message: `TinyFish returned HTTP ${tfResponse.status}: ${text}`,
          }),
        );
        controller.close();
      },
    });
  }

  // Stream-transform TinyFish SSE → our AgentEvent SSE
  const tfReader = tfResponse.body!.getReader();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async start(controller) {
      // Initial preamble log events
      controller.enqueue(
        send({ type: "LOG", message: "Starting registration agent..." }),
      );
      controller.enqueue(
        send({ type: "LOG", message: `Target event: ${eventUrl}` }),
      );
      controller.enqueue(
        send({
          type: "LOG",
          message: `Registering as: ${profile.name} (${profile.email})`,
        }),
      );
      controller.enqueue(
        send({ type: "LOG", message: "Sending task to TinyFish Web Agent..." }),
      );

      let buffer = "";

      try {
        while (true) {
          const { done, value } = await tfReader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop()!;

          for (const part of parts) {
            for (const line of part.split("\n")) {
              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue;

              let event: Record<string, unknown>;
              try {
                event = JSON.parse(jsonStr);
              } catch {
                continue;
              }

              switch (event.type) {
                case "STARTED":
                  controller.enqueue(
                    send({
                      type: "LOG",
                      message: `Agent started (run: ${event.runId})`,
                      runId: event.runId as string,
                    }),
                  );
                  break;

                case "STREAMING_URL":
                  controller.enqueue(
                    send({
                      type: "STREAMING_URL",
                      message: "Live browser stream available",
                      streamingUrl: event.streamingUrl as string,
                      runId: event.runId as string,
                    }),
                  );
                  break;

                case "PROGRESS":
                  controller.enqueue(
                    send({
                      type: "PROGRESS",
                      message: (event.purpose as string) || "Working...",
                      runId: event.runId as string,
                    }),
                  );
                  break;

                case "COMPLETE":
                  if (event.status === "COMPLETED") {
                    const completionPayload: TinyfishCompletionPayload = {
                      eventUrl,
                      runId: event.runId as string,
                      status: "SUCCESS",
                      message: "Registration completed successfully!",
                      result: (event.resultJson as Record<string, unknown>) || null,
                      rawEvent: event,
                    };
                    controller.enqueue(
                      send({
                        type: "COMPLETE",
                        status: completionPayload.status,
                        message: completionPayload.message,
                        result: completionPayload.result,
                        runId: completionPayload.runId,
                      }),
                    );

                    if (hooks?.onComplete) {
                      Promise.resolve(hooks.onComplete(completionPayload)).catch((hookErr) => {
                        console.error("[TinyFish] onComplete hook failed:", hookErr);
                      });
                    }
                  } else {
                    const completionPayload: TinyfishCompletionPayload = {
                      eventUrl,
                      runId: event.runId as string,
                      status: "FAILED",
                      message:
                        (event.error as string) ||
                        (event.help_message as string) ||
                        `Agent finished with status: ${event.status}`,
                      result: (event.resultJson as Record<string, unknown>) || null,
                      rawEvent: event,
                    };
                    controller.enqueue(
                      send({
                        type: "COMPLETE",
                        status: completionPayload.status,
                        message: completionPayload.message,
                        result: completionPayload.result,
                        runId: completionPayload.runId,
                      }),
                    );

                    if (hooks?.onComplete) {
                      Promise.resolve(hooks.onComplete(completionPayload)).catch((hookErr) => {
                        console.error("[TinyFish] onComplete hook failed:", hookErr);
                      });
                    }
                  }
                  break;

                case "HEARTBEAT":
                  break;

                default:
                  controller.enqueue(
                    send({
                      type: "LOG",
                      message: `Agent event: ${event.type}`,
                    }),
                  );
              }
            }
          }
        }
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Stream reading error";
        controller.enqueue(
          send({ type: "ERROR", message: msg }),
        );
      } finally {
        controller.close();
      }
    },
  });
}

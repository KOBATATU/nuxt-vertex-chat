import { generateTextStream } from "~/src/features/server/repository/llm/gemini";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const userMessage = body.message;

  if (!userMessage || typeof userMessage !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage:
        'Invalid message: "message" field is required and must be a string.',
    });
  }

  try {
    const geminiStream = await generateTextStream(userMessage);

    const responseStream = new ReadableStream({
      async start(controller) {
        console.log("[API] Starting to stream response to client...");
        try {
          const result = [];
          for await (const chunk of geminiStream) {
            const text = chunk?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              // SSE 形式
              controller.enqueue(
                new TextEncoder().encode(
                  `data: ${JSON.stringify({ text })}\n\n`
                )
              );
            }
            result.push(text);
          }
          console.log(result.join(""));
          console.log("[API] Finished streaming response to client.");
          // {value: null, done: true }となる
          controller.close();
        } catch (error) {
          console.error("[API] Error while processing Gemini stream:", error);
          // throwされて外側でcatchされる．createErrorがresponseされる．`{done: true}`となる
          controller.error(
            new Error(
              "An error occurred while processing the AI response stream."
            )
          );
        }
      },
    });

    event.node.res.setHeader("Content-Type", "text/event-stream");
    event.node.res.setHeader("Connection", "keep-alive");
    event.node.res.statusCode = 200;
    return sendStream(event, responseStream);
  } catch (error: any) {
    console.error("[API] Handler Error:", error);
    const statusCode = error.statusCode || 500;
    const statusMessage =
      error.statusMessage || "An internal server error occurred.";
    throw createError({ statusCode, statusMessage });
  }
});

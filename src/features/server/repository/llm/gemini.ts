import { VertexAI, type BaseModelParams } from "@google-cloud/vertexai";

export function getModel(params?: BaseModelParams) {
  const runtimeConfig = useRuntimeConfig();
  const vertexAI = new VertexAI({
    project: runtimeConfig.GCP_PROJECT_ID,
    location: runtimeConfig.GCP_LOCATION,
  });
  const generativeModel = vertexAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    ...params,
  });
  return generativeModel;
}
export async function generateText(prompt: string) {
  const model = getModel();

  const resp = await model.generateContent(prompt);
  const contentResponse = resp.response;
  return JSON.stringify(contentResponse);
}

export async function generateTextStream(prompt: string) {
  try {
    const model = getModel();
    const result = await model.generateContentStream({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    console.log("Successfully initiated content stream.");
    return result.stream;
  } catch (error) {
    console.error("Error in generateTextStream:", error);

    throw createError({
      statusCode: 500,
      statusMessage: "Failed to generate content from AI model.",
    });
  }
}

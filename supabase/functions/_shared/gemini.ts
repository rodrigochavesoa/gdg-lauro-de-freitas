const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models";
const embeddingModel = Deno.env.get("GEMINI_EMBEDDING_MODEL") ?? "gemini-embedding-001";
const generationModel = Deno.env.get("GEMINI_GENERATION_MODEL") ?? "gemini-2.5-flash";

function apiKey() {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY não configurada.");
  return key;
}

async function request(path: string, body: unknown) {
  const response = await fetch(`${GEMINI_API}/${path}?key=${apiKey()}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Gemini respondeu ${response.status}: ${await response.text()}`);
  return response.json();
}

export async function enrichJob(job: { title: string; description: string; stack: string[] }) {
  const prompt = `Você é um recrutador técnico. Reescreva a vaga abaixo em português claro e inclusivo.
Retorne APENAS JSON válido no formato {"professional_description":"string","mandatory":["string"],"desirable":["string"],"suggested_stack":["string"]}.
Não invente benefícios, salário, senioridade ou tecnologias.
Título: ${job.title}
Stack declarada: ${job.stack.join(", ") || "não informada"}
Descrição: ${job.description}`;

  const data = await request(`${generationModel}:generateContent`, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
  });
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("O Gemini não retornou conteúdo para o enriquecimento.");
  return JSON.parse(text);
}

export async function embed(text: string, taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY") {
  const data = await request(`${embeddingModel}:embedContent`, {
    content: { parts: [{ text }] },
    taskType,
    outputDimensionality: 768,
  });
  const values = data.embedding?.values;
  if (!Array.isArray(values) || values.length !== 768) throw new Error("Embedding Gemini inválido ou com dimensionalidade diferente de 768.");
  return values;
}

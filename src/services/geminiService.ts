import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface PDVLaunch {
  Dia: string;
  Lç: string;
  Anv: string;
  "1P": string;
  "2P": string;
  MV: string;
  AD_DEST: string;
  EOBT: string;
  Missao: string;
}

export const extractPDVData = async (text: string): Promise<PDVLaunch[]> => {
  const systemInstruction = `
Você é um motor de extração de dados especializado nos Planos Diários de Voo (PDV) do 2º Batalhão de Aviação do Exército. Sua função é processar arquivos PDF (convertidos em texto) e converter as tabelas de lançamentos em dados estruturados.

REGRAS DE PROCESSAMENTO:
1. Lógica de Repetição: Aplique estas instruções a todo o texto, independentemente da data ou da quantidade de voos.
2. Escopo de Dados: Ignore seções de "Tripulação de Alerta", cabeçalhos ministeriais ou notas de rodapé. Foque apenas nas linhas que iniciam com um número de Lançamento (coluna "Lç") e possuam aeronave "EXB".
3. Mapeamento de Colunas: Extraia rigorosamente os seguintes campos para cada lançamento encontrado:
   - Dia: Data completa extraída do título da página (ex: 22 DE ABRIL DE 2026).
   - Lç: Número sequencial do lançamento.
   - Anv: Prefixo completo da aeronave (ex: EXB 4008).
   - 1P: Sigla do Primeiro Piloto.
   - 2P: Sigla do Segundo Piloto.
   - MV: Sigla do Mecânico de Voo.
   - AD DEST: Aeródromo de destino (ex: SBTA, SBUL, SBBH).
   - EOBT: Horário de acionamento no formato HHmMM (ex: 13H10).
   - Missão: Sigla da missão após a barra (ex: DVG, TRL, EXF, GUI). Se não houver barra, extraia o código de missão identificado.

FORMATO DE SAÍDA OBRIGATÓRIO:
Sempre responda apenas com o objeto JSON.
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text }] }],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              Dia: { type: Type.STRING },
              Lç: { type: Type.STRING },
              Anv: { type: Type.STRING },
              "1P": { type: Type.STRING },
              "2P": { type: Type.STRING },
              MV: { type: Type.STRING },
              AD_DEST: { type: Type.STRING },
              EOBT: { type: Type.STRING },
              Missao: { type: Type.STRING },
            },
            required: ["Dia", "Lç", "Anv", "1P", "2P", "MV", "AD_DEST", "EOBT", "Missao"],
          },
        },
      },
    });

    const result = JSON.parse(response.text || "[]");
    return result;
  } catch (error) {
    console.error("Erro na extração Gemini:", error);
    throw new Error("Falha ao processar PDV com IA.");
  }
};

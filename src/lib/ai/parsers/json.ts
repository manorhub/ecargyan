/**
 * Safe JSON Extractor & Schema Validator for AI Output
 */

export function extractJsonFromAiResponse<T = any>(text: string): T {
  if (!text) {
    throw new Error('AI returned empty response.');
  }

  let cleaned = text.trim();

  // 1. Extract markdown code fences: ```json ... ``` or ``` ... ```
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  } else {
    // 2. Search for outermost JSON object or array brackets
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    
    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      const lastBrace = cleaned.lastIndexOf('}');
      if (lastBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
      }
    } else if (firstBracket !== -1) {
      const lastBracket = cleaned.lastIndexOf(']');
      if (lastBracket !== -1 && lastBracket > firstBracket) {
        cleaned = cleaned.substring(firstBracket, lastBracket + 1);
      }
    }
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch (err: any) {
    // Attempt minor repair: remove trailing commas before closing braces/brackets
    const repaired = cleaned
      .replace(/,\s*([\}\]])/g, '$1')
      .replace(/[\u0000-\u001F]+/g, (match) => (match === '\n' || match === '\r' || match === '\t' ? match : ''));

    try {
      return JSON.parse(repaired) as T;
    } catch {
      throw new Error(`Failed to parse AI JSON response: ${err.message}. Raw: ${text.slice(0, 200)}...`);
    }
  }
}

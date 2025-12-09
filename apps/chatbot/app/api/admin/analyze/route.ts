import { createXai } from '@ai-sdk/xai';
import { generateText } from 'ai';
import fs from 'fs/promises';
import path from 'path';

export const runtime = 'node';

export async function POST(req: Request) {
  if (!process.env.XAI_API_KEY) {
    return new Response('Missing API key', { status: 500 });
  }

  try {
    // Read all traces
    const tracesDir = path.join(process.cwd(), 'data', 'traces');
    await fs.access(tracesDir);
    const files = await fs.readdir(tracesDir);
    const gradedTraces = [];
    for (const file of files.filter(f => f.endsWith('.json'))) {
      const filePath = path.join(tracesDir, file);
      const content = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(content);
      if (data.grade) {
        gradedTraces.push({
          sessionId: file.replace('.json', ''),
          grade: data.grade,
          feedback: data.grade.feedback,
          suggestions: data.grade.suggestions,
        });
      }
    }

    if (gradedTraces.length === 0) {
      return new Response(JSON.stringify({ error: 'No graded traces to analyze' }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    const xai = createXai({ apiKey: process.env.XAI_API_KEY });
    const model = xai('grok-beta');

    const numGraded = gradedTraces.length;
    const avgOverall = Math.round(gradedTraces.reduce((sum: number, t: any) => sum + t.grade.overall_score, 0) / numGraded);
    const avgCorrectness = Math.round(gradedTraces.reduce((sum: number, t: any) => sum + t.grade.correctness, 0) / numGraded);
    const avgEfficiency = Math.round(gradedTraces.reduce((sum: number, t: any) => sum + t.grade.efficiency, 0) / numGraded);

    // Collect sample feedbacks and suggestions
    const feedbacks = gradedTraces.slice(0, 5).map(t => t.feedback).join('\n\n'); // Top 5
    const suggestions = gradedTraces.flatMap(t => t.suggestions).slice(0, 10).join('\n'); // Unique-ish

    const analyzePrompt = `Analyze these aggregated grades and feedback from ${numGraded} chat traces for self-reinforcement.

Stats:
- Avg Overall: ${avgOverall}/10
- Avg Correctness: ${avgCorrectness}/10
- Avg Efficiency: ${avgEfficiency}/10

Sample Feedbacks:
${feedbacks}

Common Suggestions:
${suggestions}

Provide:
1. Key patterns/issues (e.g., low correctness in complex queries)
2. Suggested system prompt tweaks or improvements (e.g., add CoT for reasoning)
3. Actionable fixes for common failures
4. Overall recommendations for CX improvements

Respond in structured JSON:
{
  "patterns": ["issue1", "issue2"],
  "prompt_tweaks": ["tweak1", "tweak2"],
  "fixes": ["fix1"],
  "recommendations": "Summary"
}`;

    const { text: analysisText } = await generateText({
      model,
      prompt: analyzePrompt,
      maxTokens: 800,
    });

    let analysis;
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : analysisText;
      analysis = JSON.parse(jsonStr);
    } catch {
      analysis = { patterns: [], prompt_tweaks: [], fixes: [], recommendations: analysisText };
    }

    // Optionally save to data/analyze.json or something, but for now return

    return new Response(JSON.stringify(analysis), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Analyze error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
import { createXai } from '@ai-sdk/xai';
import { generateText } from 'ai';
import fs from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs'; // Required for fs access // Required for fs access

export async function POST(req: Request) {
  if (!process.env.XAI_API_KEY) {
    return new Response('Server configuration error: Missing API key', { status: 500 });
  }

  try {
    const body = await req.json();
    const { sessionId } = body;

    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Missing sessionId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const tracesDir = path.join(process.cwd(), 'data', 'traces');
    const filePath = path.join(tracesDir, `${sessionId}.json`);

    let trace;
    try {
      const data = await fs.readFile(filePath, 'utf8');
      trace = JSON.parse(data);
    } catch (err) {
      console.error('Trace file read error:', err);
      return new Response(JSON.stringify({ error: 'Trace not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const xai = createXai({
      apiKey: process.env.XAI_API_KEY,
    });
    const model = xai('grok-4-1-fast-non-reasoning'); // Use light model for grading

    const gradePrompt = `Analyze this chat trace and grade it:

- Correctness: 1-10 (how accurate/relevant responses are)
- Efficiency: 1-10 (tokens used, response length appropriateness)
- Overall score: 1-10 average
- Suggestions: Brief list of improvements or fixes
- Feedback: Summary of strengths/weaknesses

Trace JSON:
\`\`\`json
${JSON.stringify(trace, null, 2)}
\`\`\`

Respond ONLY with valid JSON object:
{
  "correctness": 5,
  "efficiency": 7,
  "overall_score": 6,
  "suggestions": ["Suggestion 1", "Suggestion 2"],
  "feedback": "Summary here"
}`;

    const { text: gradeText } = await generateText({
      model,
      prompt: gradePrompt,
    });

    let grade;
    try {
      // Extract JSON from response if wrapped in text
      const jsonMatch = gradeText.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : gradeText;
      grade = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error('Grade JSON parse error:', parseErr, gradeText);
      grade = {
        correctness: 0,
        efficiency: 0,
        overall_score: 0,
        suggestions: [],
        feedback: gradeText,
      };
    }

    // Update trace with grade
    trace.grade = {
      ...grade,
      gradedAt: new Date().toISOString(),
    };
    await fs.writeFile(filePath, JSON.stringify(trace, null, 2));

    console.log(`Graded session ${sessionId}:`, grade);

    return new Response(JSON.stringify(grade), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Grade API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
import fs from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';

interface TraceSummary {
  sessionId: string;
  timestamp?: string;
  grade?: {
    correctness: number;
    efficiency: number;
    overall_score: number;
    suggestions: string[];
    feedback: string;
    gradedAt?: string;
  } | null;
}

export async function GET() {
  const tracesDir = path.join(process.cwd(), 'data', 'traces');
  try {
    await fs.access(tracesDir);
    const files = await fs.readdir(tracesDir);
    const traces: TraceSummary[] = [];

    for (const file of files.filter(f => f.endsWith('.json'))) {
      const filePath = path.join(tracesDir, file);
      const content = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(content);
      const sessionId = file.replace('.json', '');
      traces.push({
        sessionId,
        timestamp: data.timestamp,
        grade: data.grade,
      });
    }

    traces.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

    return new Response(JSON.stringify(traces), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error reading traces:', error);
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
import fs from 'fs/promises';
import path from 'path';

export const runtime = 'node';

export async function GET(
  req: Request,
  { params }: { params: { sessionId: string } }
) {
  const { sessionId } = params;
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Missing sessionId' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const tracesDir = path.join(process.cwd(), 'data', 'traces');
  const filePath = path.join(tracesDir, `${sessionId}.json`);

  try {
    const content = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(content);
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error reading full trace:', error);
    return new Response(JSON.stringify({ error: 'Trace not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
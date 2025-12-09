import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
  const tracesDir = path.join(process.cwd(), '../../data/traces');
  try {
    const files = await fs.readdir(tracesDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    const stats = await Promise.all(
      jsonFiles.map(async (f) => {
        const filePath = path.join(tracesDir, f);
        const stat = await fs.stat(filePath).catch(() => null);
        return {
          filename: f,
          mtime: stat ? stat.mtime.toISOString() : new Date().toISOString(),
          size: stat ? stat.size : 0,
        };
      })
    );
    const traceFiles = stats
      .sort((a, b) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime())
      .slice(0, 100);
    return NextResponse.json({ traces: traceFiles, total: jsonFiles.length, dir: tracesDir });
  } catch (err: any) {
    console.error('Traces list error:', err);
    return NextResponse.json({ error: 'Failed to read traces', message: err.message }, { status: 500 });
  }
}

// Future: POST for bulk export, e.g. ?format=csv or zip
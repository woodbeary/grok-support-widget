import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

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

interface FullTrace extends TraceSummary {
  messages: any[];
  traces: any[];
  metadata?: any;
}

export default function AdminPage() {
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrace, setSelectedTrace] = useState<FullTrace | null>(null);
  const [viewingTrace, setViewingTrace] = useState<string | null>(null);
  const [grading, setGrading] = useState<string | null>(null);

  useEffect(() => {
    fetchTraces();
  }, []);

  const fetchTraces = async () => {
    try {
      const res = await fetch('/api/admin/traces');
      const data = await res.json();
      setTraces(data);
    } catch (error) {
      console.error('Failed to fetch traces:', error);
    } finally {
      setLoading(false);
    }
  };

  const gradeTrace = async (sessionId: string) => {
    setGrading(sessionId);
    try {
      const res = await fetch('/api/admin/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      if (res.ok) {
        const newGrade = await res.json();
        setTraces(prev => prev.map(t => 
          t.sessionId === sessionId 
            ? { ...t, grade: { ...newGrade, gradedAt: new Date().toISOString() } }
            : t
        ));
        alert('Graded successfully!');
      } else {
        const err = await res.json();
        alert(`Grading failed: ${err.error}`);
      }
    } catch (error) {
      alert('Error grading trace');
    } finally {
      setGrading(null);
    }
  };

  const viewFullTrace = async (sessionId: string) => {
    if (viewingTrace === sessionId) {
      setSelectedTrace(null);
      setViewingTrace(null);
      return;
    }
    try {
      const res = await fetch(`/api/admin/trace/${sessionId}`);
      if (res.ok) {
        const fullTrace = await res.json();
        setSelectedTrace(fullTrace);
      } else {
        alert('Failed to load trace details');
      }
      setViewingTrace(sessionId);
    } catch (error) {
      console.error('Failed to load full trace:', error);
      alert('Error loading trace');
    }
  };

  if (loading) {
    return <div className="container mx-auto p-4">Loading traces...</div>;
  }

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard for Histories/Traces & AI Grading</h1>
      <p className="text-muted-foreground mb-4">Local-only tool to review chat sessions, grade with Grok, aggregate for improvements.</p>
      
      {traces.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-center">No traces available. Implement milestone 6 to capture traces during chats.</p>
            <p className="text-sm text-muted-foreground mt-2">Check <code>data/traces/</code> directory.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Session List ({traces.length} traces)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell className="w-1/2">Session ID</TableCell>
                    <TableCell>Timestamp</TableCell>
                    <TableCell>Score</TableCell>
                    <TableCell className="text-right">Actions</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {traces.map((trace) => (
                    <TableRow key={trace.sessionId}>
                      <TableCell className="font-mono text-sm">{trace.sessionId}</TableCell>
                      <TableCell>{trace.timestamp ? new Date(trace.timestamp).toLocaleString() : 'N/A'}</TableCell>
                      <TableCell>
                        {trace.grade ? (
                          <Badge variant={trace.grade.overall_score >= 7 ? "default" : "secondary"}>
                            {trace.grade.overall_score}/10
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">Ungraded</span>
                        )}
                      </TableCell>
                      <TableCell className="space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => viewFullTrace(trace.sessionId)}
                        >
                          {viewingTrace === trace.sessionId ? 'Hide' : 'View'}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => gradeTrace(trace.sessionId)}
                          disabled={!!trace.grade || grading === trace.sessionId}
                          variant={trace.grade ? "secondary" : "default"}
                        >
                          {grading === trace.sessionId ? 'Grading...' : trace.grade ? 'Re-grade' : 'Grade'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Tree View for Selected Trace */}
          {selectedTrace && (
            <Card>
              <CardHeader>
                <CardTitle>Trace Details for {selectedTrace.sessionId}</CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" className="w-full">
                  <AccordionItem value="messages">
                    <AccordionTrigger>Messages History ({selectedTrace.messages?.length || 0})</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2">
                        {selectedTrace.messages?.map((msg: any, i: number) => (
                          <div key={i} className={`p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                            <strong className="text-sm capitalize">{msg.role}:</strong>
                            <p className="mt-1">{msg.content}</p>
                          </div>
                        )) || <p className="text-muted-foreground">No messages available</p>}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="traces">
                    <AccordionTrigger>LLM Traces & Decisions ({selectedTrace.traces?.length || 0})</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2">
                        {selectedTrace.traces?.map((tr: any, i: number) => (
                          <div key={i} className="p-3 bg-muted/50 rounded-lg">
                            <strong className="text-sm">{tr.type?.toUpperCase()} ({tr.model})</strong>
                            <p className="text-xs text-muted-foreground mt-1">Tokens: {tr.tokens || 'N/A'}</p>
                            <p className="text-xs mt-1">Input: {tr.input ? `${tr.input.substring(0, 100)}${tr.input.length > 100 ? '...' : ''}` : 'N/A'}</p>
                            <p className="text-xs">Output: {tr.output ? `${tr.output.substring(0, 100)}${tr.output.length > 100 ? '...' : ''}` : 'N/A'}</p>
                            <p className="text-xs text-muted-foreground">Time: {tr.timestamp}</p>
                          </div>
                        )) || <p className="text-muted-foreground">No traces available (awaiting milestone 6 full integration)</p>}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  {selectedTrace.grade && (
                    <AccordionItem value="grade">
                      <AccordionTrigger>AI Grade & Suggestions</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          <p><strong>Correctness:</strong> {selectedTrace.grade.correctness}/10</p>
                          <p><strong>Efficiency:</strong> {selectedTrace.grade.efficiency}/10</p>
                          <p><strong>Feedback:</strong> {selectedTrace.grade.feedback}</p>
                          <p><strong>Suggestions:</strong></p>
                          <ul>
                            {selectedTrace.grade.suggestions.map((s, i) => (
                              <li key={i} className="list-disc ml-4">{s}</li>
                            ))}
                          </ul>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}
                </Accordion>
              </CardContent>
            </Card>
          )}

          {/* TODO: Bulk grading, aggregates (avgs/failures), CSV export, auto-prompt tweaks */}
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <h2 className="font-semibold mb-2">Next Features</h2>
            <ul className="text-sm space-y-1">
              <li>• Bulk select & grade multiple traces</li>
              <li>• Aggregates: Average scores, common failures</li>
              <li>• CSV/JSON export</li>
              <li>• Self-reinforcement: Analyze feedback for prompt improvements</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
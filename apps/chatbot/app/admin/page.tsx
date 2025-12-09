import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';

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
  const [showLogin, setShowLogin] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [selectedTrace, setSelectedTrace] = useState<FullTrace | null>(null);
  const [viewingTrace, setViewingTrace] = useState<string | null>(null);
  const [grading, setGrading] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [analysis, setAnalysis] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    fetchTraces();
  }, []);

  const fetchTraces = async () => {
    try {
      const res = await fetch('/api/admin/traces');
      if (res.status === 401) {
        setShowLogin(true);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        throw new Error('Failed to fetch');
      }
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

  const bulkGrade = async (ids: string[]) => {
    const ungradedIds = ids.filter(id => !traces.find(t => t.sessionId === id)?.grade);
    if (ungradedIds.length === 0) {
      alert('No ungraded traces selected.');
      return;
    }
    if (!confirm(`Grade ${ungradedIds.length} ungraded traces? This will use API calls and may take time.`)) {
      return;
    }
    for (const id of ungradedIds) {
      await gradeTrace(id);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Rate limiting delay
    }
    setSelectedIds(new Set());
    // fetchTraces(); // Optional refresh
  };

  const exportCSV = () => {
    const headers = ['Session ID', 'Timestamp', 'Overall Score', 'Correctness', 'Efficiency', 'Feedback', 'Suggestions'];
    let csvContent = headers.join(',') + '\n';
    traces.forEach((trace) => {
      if (trace.grade) {
        const row = [
          trace.sessionId,
          `"${trace.timestamp || ''}"`,
          trace.grade.overall_score,
          trace.grade.correctness,
          trace.grade.efficiency,
          `"${(trace.grade.feedback || '').replace(/"/g, '""')}"`,
          `"${(trace.grade.suggestions?.join('; ') || '').replace(/"/g, '""')}"`
        ].join(',');
        csvContent += row + '\n';
      }
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `traces-grades-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const performAnalysis = async () => {
    const gradedCount = traces.filter(t => t.grade).length;
    if (gradedCount === 0) {
      alert('Need at least one graded trace for analysis.');
      return;
    }
    if (!confirm(`Analyze ${gradedCount} graded traces for self-reinforcement insights and prompt tweaks?`)) {
      return;
    }
    setAnalyzing(true);
    try {
      const res = await fetch('/api/admin/analyze', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setAnalysis(data);
        alert('Analysis complete! Check aggregates section.');
      } else {
        const err = await res.json();
        alert(`Analysis failed: ${err.error}`);
      }
    } catch (error) {
      console.error('Analysis error:', error);
      alert('Error performing analysis.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;
    setLoginError('');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        setShowLogin(false);
        await fetchTraces();
      } else {
        const err = await res.json();
        setLoginError(err.error || 'Login failed');
      }
    } catch (error) {
      setLoginError('Login request failed');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/login', { method: 'DELETE' });
    } catch (error) {
      console.error('Logout error:', error);
    }
    setShowLogin(true);
    setTraces([]);
    setSelectedIds(new Set());
    setAnalysis(null);
    setSelectedTrace(null);
    setLoginError('');
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

  if (showLogin) {
    return (
      <div className="container mx-auto p-4 max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Admin Login</CardTitle>
            <p className="text-sm text-muted-foreground">Access local dashboard for traces, grading, and self-reinforcement.</p>
          </CardHeader>
          <CardContent className="pt-0">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" name="username" defaultValue="admin" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" placeholder="login123" required />
              </div>
              {loginError && <p className="text-sm text-destructive small-caps">{loginError}</p>}
              <Button type="submit" className="w-full">Login</Button>
            </form>
            <p className="text-xs text-muted-foreground mt-4 text-center">
              Default: admin / login123 (set ADMIN_PASSWORD in .env.local)
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return <div className="container mx-auto p-4">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Admin Dashboard for Histories/Traces & AI Grading</h1>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          Logout
        </Button>
      </div>
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
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Session List ({traces.length} traces)</CardTitle>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={exportCSV}>
                  Export CSV
                </Button>
                {selectedIds.size > 0 && (
                  <Button 
                    size="sm" 
                    onClick={() => bulkGrade(Array.from(selectedIds))} 
                    variant="destructive"
                  >
                    Bulk Grade ({selectedIds.size})
                  </Button>
  
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox 
                        checked={selectedIds.size === traces.length && traces.length > 0}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedIds(new Set(traces.map(t => t.sessionId)));
                          } else {
                            setSelectedIds(new Set());
                          }
                        }}
                        aria-label="Select all traces"
                      />
                    </TableHead>
                    <TableHead className="min-w-[200px]">Session ID</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {traces.map((trace) => (
                    <TableRow key={trace.sessionId}>
                      <TableCell>
                        <Checkbox 
                          checked={selectedIds.has(trace.sessionId)}
                          onCheckedChange={(checked) => {
                            const newSet = new Set(selectedIds);
                            if (checked) {
                              newSet.add(trace.sessionId);
                            } else {
                              newSet.delete(trace.sessionId);
                            }
                            setSelectedIds(newSet);
                          }}
                          aria-label={`Select trace ${trace.sessionId}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">{trace.sessionId}</TableCell>
                      <TableCell>{trace.timestamp ? new Date(trace.timestamp).toLocaleString() : 'N/A'}</TableCell>
                      <TableCell>
                        {trace.grade ? (
                          <Badge variant={trace.grade.overall_score >= 7 ? "default" : "secondary"}>
                            {trace.grade.overall_score}/10
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">Ungraded</span>
          
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

          {/* Aggregates */}
          <Card className="mb-6">
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Aggregates & Stats</CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={performAnalysis}
                disabled={analyzing || traces.filter(t => t.grade).length === 0}
              >
                {analyzing ? 'Analyzing...' : 'Generate Insights'}
              </Button>
            </CardHeader>
            <CardContent className="p-6">
              {traces.filter(t => t.grade).length === 0 ? (
                <p className="text-muted-foreground">No graded traces yet. Grade some to see stats and enable self-reinforcement insights.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-primary">
                      {traces.filter(t => t.grade).length}/{traces.length}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">Graded Sessions</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-primary">
                      {Math.round(
                        traces.filter(t => t.grade).reduce((sum, t) => sum + (t.grade!.overall_score || 0), 0) / 
                        traces.filter(t => t.grade).length)
        
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">Avg Overall</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-primary">
                      {Math.round(
                        traces.filter(t => t.grade).reduce((sum, t) => sum + (t.grade!.correctness || 0), 0) / 
                        traces.filter(t => t.grade).length)
        
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">Avg Correctness</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-primary">
                      {Math.round(
                        traces.filter(t => t.grade).reduce((sum, t) => sum + (t.grade!.efficiency || 0), 0) / 
                        traces.filter(t => t.grade).length)
        
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">Avg Efficiency</p>
                  </div>
                </div>

                  <div className="mt-8 pt-6 border-t border-border">
                    <h3 className="text-lg font-semibold mb-4">Self-Reinforcement Analysis</h3>
                    <Accordion type="single" collapsible defaultValue="insights">
                      <AccordionItem value="insights">
                        <AccordionTrigger>View AI-Generated Insights</AccordionTrigger>
                        <AccordionContent className="space-y-4">
                          {analysis.patterns && analysis.patterns.length > 0 && (
                            <div>
                              <h4 className="font-medium mb-2">Detected Patterns/Issues:</h4>
                              <ul className="list-disc ml-6 space-y-1">
                                {analysis.patterns.map((pattern: string, idx: number) => (
                                  <li key={idx} className="text-sm">{pattern}</li>
                                ))}
                              </ul>
                            </div>
            
                          {analysis.prompt_tweaks && analysis.prompt_tweaks.length > 0 && (
                            <div>
                              <h4 className="font-medium mb-2">Suggested Prompt Tweaks:</h4>
                              <ul className="list-disc ml-6 space-y-1">
                                {analysis.prompt_tweaks.map((tweak: string, idx: number) => (
                                  <li key={idx} className="text-sm">{tweak}</li>
                                ))}
                              </ul>
                            </div>
            
                          {analysis.fixes && analysis.fixes.length > 0 && (
                            <div>
                              <h4 className="font-medium mb-2">Actionable Fixes:</h4>
                              <ul className="list-disc ml-6 space-y-1">
                                {analysis.fixes.map((fix: string, idx: number) => (
                                  <li key={idx} className="text-sm">{fix}</li>
                                ))}
                              </ul>
                            </div>
            
                          {analysis.recommendations && (
                            <div>
                              <h4 className="font-medium mb-2">Overall Recommendations:</h4>
                              <p className="text-sm">{analysis.recommendations}</p>
                            </div>
            
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
  

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
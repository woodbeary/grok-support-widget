'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { CSATChart } from '@/components/charts/CSATChart';
import { DeflectionChart } from '@/components/charts/DeflectionChart';
import { cn } from '@/lib/utils';
import { RefreshCw, FileText, BarChart3, CheckSquare, Search, Copy, CheckCircle2, ShieldCheck, Lock, Globe } from 'lucide-react';

// Types remain the same...
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
  hasTicket?: boolean;
}

interface FullTrace extends TraceSummary {
  messages: any[];
  steps?: any[];
  model?: string;
  modelId?: string;
  durationMs?: number;
  totalUsage?: number;
  finishReason?: string;
  traces: any[];
  metadata?: any;
}

export default function AdminPage() {
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Tab state
  const [activeTab, setActiveTab] = useState('list');

  // Grading state
  const [gradingInstruction, setGradingInstruction] = useState('');
  const [gradingSessionId, setGradingSessionId] = useState<string | null>(null);
  const [isGrading, setIsGrading] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [bulkGradingInstructions, setBulkGradingInstructions] = useState('');

  // Trace viewing state
  const [selectedTrace, setSelectedTrace] = useState<FullTrace | null>(null);
  const [viewTraceOpen, setViewTraceOpen] = useState(false);

  // Stats state
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);

  /* Bulk Grading Logic */
  const toggleSelectAll = () => {
    if (selectedSessions.size === traces.length) {
      setSelectedSessions(new Set());
    } else {
      setSelectedSessions(new Set(traces.map(t => t.sessionId)));
    }
  };

  const toggleSession = (id: string) => {
    const newSet = new Set(selectedSessions);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedSessions(newSet);
  };

  const handleBulkGrade = async () => {
    if (selectedSessions.size === 0) return;
    setIsGrading(true);
    // Grade sequentially to avoid rate limits
    for (const id of Array.from(selectedSessions)) {
      setGradingSessionId(id);
      try {
        await fetch('/api/admin/grade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: id, instructions: bulkGradingInstructions }),
        });
      } catch (e) {
        console.error(`Failed to grade ${id}`, e);
      }
    }
    await fetchTraces();
    setIsGrading(false);
    setGradingSessionId(null);
    setSelectedSessions(new Set());
  };

  useEffect(() => {
    fetchTraces();
  }, []);

  const fetchTraces = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/traces');
      if (res.status === 401) {
        setShowLogin(true);
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setTraces(data);
    } catch (error) {
      console.error('Failed to fetch traces:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const password = formData.get('password') as string;
    setLoginError('');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setShowLogin(false);
        fetchTraces();
      } else {
        const err = await res.json();
        setLoginError(err.error || 'Login failed');
      }
    } catch (error) {
      setLoginError('Login request failed');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/login', { method: 'DELETE' });
    setShowLogin(true);
    setTraces([]);
  };

  const viewFullTrace = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/admin/trace/${sessionId}`);
      if (res.ok) {
        const fullTrace = await res.json();
        setSelectedTrace(fullTrace);
        setViewTraceOpen(true);
      }
    } catch (error) {
      console.error('Failed to load trace:', error);
    }
  };

  const gradeTrace = async (sessionId: string) => {
    setGradingSessionId(sessionId);
    setIsGrading(true);

    // Default instruction if empty
    const instructions = gradingInstruction.trim() || undefined;

    try {
      const res = await fetch('/api/admin/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, instructions }),
      });

      if (res.ok) {
        const newGrade = await res.json();
        setTraces(prev => prev.map(t =>
          t.sessionId === sessionId
            ? { ...t, grade: { ...newGrade, gradedAt: new Date().toISOString() } }
            : t
        ));

        // Update selected trace if open
        if (selectedTrace?.sessionId === sessionId) {
          setSelectedTrace(prev => prev ? { ...prev, grade: { ...newGrade, gradedAt: new Date().toISOString() } } : null);
        }
      } else {
        alert('Grading failed. Check API logs.');
      }
    } catch (error) {
      console.error('Error grading:', error);
    } finally {
      setGradingSessionId(null);
      setIsGrading(false);
    }
  };

  const csatData = traces
    .filter(t => t.grade?.overall_score)
    .sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime())
    .map(t => ({
      sessionId: t.sessionId,
      score: t.grade!.overall_score,
      date: t.timestamp || new Date().toISOString(),
    }));

  const deflectionData = [
    { name: 'Automated', value: traces.length - traces.filter(t => t.hasTicket).length, color: '#10b981' },
    { name: 'Escalated', value: traces.filter(t => t.hasTicket).length, color: '#ef4444' },
  ];

  if (showLogin) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-[#0a0a0a] border-[#222]">
          <CardHeader>
            <CardTitle className="text-white">Admin Login</CardTitle>
            <CardDescription className="text-gray-400">Access grading dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Enter admin password"
                  className="bg-[#111] border-[#333] text-white"
                  required
                />
              </div>
              {loginError && <p className="text-sm text-red-500">{loginError}</p>}
              <Button type="submit" className="w-full bg-white text-black hover:bg-gray-200 cursor-pointer">Login</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-12">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
            <p className="text-gray-400 mt-1">Chat history analysis, grading, and metrics.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={fetchTraces} disabled={loading} className="border-[#333] hover:bg-[#222] text-white cursor-pointer">
              <RefreshCw className={cn("w-4 h-4 mr-2", loading ? "animate-spin" : "")} />
              Refresh
            </Button>
            <Button variant="ghost" onClick={handleLogout} className="text-gray-400 hover:text-white hover:bg-[#222] cursor-pointer">
              Logout
            </Button>
          </div>
        </div>

        {/* Tabs for Cleaner Layout */}
        <Tabs defaultValue="list" className="space-y-6" onValueChange={setActiveTab}>
          <TabsList className="bg-[#111] border border-[#222]">
            <TabsTrigger value="list" className="data-[state=active]:bg-[#222] cursor-pointer">Session List</TabsTrigger>
            <TabsTrigger value="stats" className="data-[state=active]:bg-[#222] cursor-pointer">Metrics & Aggregates</TabsTrigger>
          </TabsList>

          {/* LIST TAB */}
          <TabsContent value="list" className="space-y-4">
            <Card className="bg-[#0a0a0a] border-[#222]">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Recent Sessions
                </CardTitle>
              </CardHeader>
              {/* Bulk Actions Bar */}
              {selectedSessions.size > 0 && (
                <div className="flex items-center justify-between p-4 rounded-lg bg-[#1a1a1a] border border-[#333] animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-white">{selectedSessions.size} sessions selected</span>
                    <Input
                      placeholder="Bulk grading instructions (optional)..."
                      value={bulkGradingInstructions}
                      onChange={(e) => setBulkGradingInstructions(e.target.value)}
                      className="w-[300px] h-9 bg-[#111] border-[#333] text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedSessions(new Set())}
                      disabled={isGrading}
                      className="text-gray-400 hover:text-white cursor-pointer"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleBulkGrade}
                      disabled={isGrading}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                    >
                      {isGrading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <CheckSquare className="w-4 h-4 mr-2" />}
                      Grade Selected
                    </Button>
                  </div>
                </div>
              )}
              <CardContent>
                <div className="rounded-md border border-[#222]">
                  <Table>
                    <TableHeader className="bg-[#111]">
                      <TableRow className="border-[#222] hover:bg-[#111]">
                        <TableHead className="w-[50px] cursor-pointer" onClick={toggleSelectAll}>
                          <Checkbox
                            checked={traces.length > 0 && selectedSessions.size === traces.length}
                            onCheckedChange={toggleSelectAll}
                            className="border-[#444] data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 pointer-events-none"
                          />
                        </TableHead>
                        <TableHead className="text-gray-400">Session ID</TableHead>
                        <TableHead className="text-gray-400">Time</TableHead>
                        <TableHead className="text-gray-400">Status</TableHead>
                        <TableHead className="text-gray-400">Score</TableHead>
                        <TableHead className="text-right text-gray-400">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {traces.length === 0 ? (
                        <TableRow className="border-[#222]">
                          <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                            No sessions found. Start chatting to generate traces.
                          </TableCell>
                        </TableRow>
                      ) : (
                        traces.map((trace) => (
                          <TableRow
                            key={trace.sessionId}
                            className="border-[#222] hover:bg-[#111]/50 group cursor-pointer transition-colors"
                            onClick={(e) => {
                              // Prevent toggling when clicking "View & Grade" button
                              if ((e.target as HTMLElement).closest('button')) return;
                              toggleSession(trace.sessionId);
                            }}
                          >
                            <TableCell className="cursor-pointer">
                              <Checkbox
                                checked={selectedSessions.has(trace.sessionId)}
                                onCheckedChange={() => toggleSession(trace.sessionId)}
                                className="border-[#444] data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 pointer-events-none"
                              />
                            </TableCell>
                            <TableCell className="font-mono text-xs text-gray-300">
                              {trace.sessionId.slice(0, 12)}...
                            </TableCell>
                            <TableCell className="text-gray-400 text-sm">
                              {trace.timestamp ? new Date(trace.timestamp).toLocaleTimeString() : '-'}
                            </TableCell>
                            <TableCell>
                              {trace.hasTicket ? (
                                <Badge variant="destructive" className="bg-red-900/30 text-red-400 hover:bg-red-900/40 border-red-900/50">Escalated</Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/40 border-emerald-900/50">Automated</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {trace.grade ? (
                                <div className="flex items-center gap-2">
                                  <span className={cn(
                                    "font-bold",
                                    trace.grade.overall_score >= 8 ? "text-emerald-400" :
                                      trace.grade.overall_score >= 5 ? "text-yellow-400" : "text-red-400"
                                  )}>
                                    {trace.grade.overall_score}/10
                                  </span>
                                </div>
                              ) : (
                                <span className="text-gray-600 text-sm italic">Ungraded</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="secondary"
                                size="sm"
                                className="bg-[#222] text-white hover:bg-[#333] cursor-pointer"
                                onClick={() => viewFullTrace(trace.sessionId)}
                              >
                                View & Grade
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* STATS TAB */}
          <TabsContent value="stats" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="bg-[#111] border-[#222]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400">Security Status</CardTitle>
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-1">
                    <div className="text-xs text-emerald-400 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> API Key: Secure (Server-Side)
                    </div>
                    <div className="text-xs text-emerald-400 flex items-center gap-1">
                      <Globe className="w-3 h-3" /> CORS: {process.env.ALLOWED_ORIGINS ? 'Active' : 'Disabled'}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <CSATChart data={csatData} />
              <DeflectionChart data={deflectionData} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-[#0a0a0a] border-[#222] p-4 text-center">
                <div className="text-3xl font-bold text-white">{traces.length}</div>
                <div className="text-sm text-gray-500">Total Sessions</div>
              </Card>
              <Card className="bg-[#0a0a0a] border-[#222] p-4 text-center">
                <div className="text-3xl font-bold text-white">{traces.filter(t => t.grade).length}</div>
                <div className="text-sm text-gray-500">Graded</div>
              </Card>
              <Card className="bg-[#0a0a0a] border-[#222] p-4 text-center">
                <div className="text-3xl font-bold text-emerald-400">
                  {Math.round((traces.filter(t => !t.hasTicket).length / Math.max(traces.length, 1)) * 100)}%
                </div>
                <div className="text-sm text-gray-500">Deflection Rate</div>
              </Card>
              <Card className="bg-[#0a0a0a] border-[#222] p-4 text-center">
                <div className="text-3xl font-bold text-blue-400">
                  {traces.filter(t => t.grade).length > 0
                    ? (traces.filter(t => t.grade).reduce((sum, t) => sum + (t.grade!.overall_score || 0), 0) / traces.filter(t => t.grade).length).toFixed(1)
                    : '-'}
                </div>
                <div className="text-sm text-gray-500">Avg CSAT</div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* TRACE DETAILS & GRADING DIALOG */}
        <Dialog open={viewTraceOpen} onOpenChange={setViewTraceOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#0a0a0a] border-[#222] text-white">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Session Trace</span>
                <div className="flex items-center gap-2">
                  <a
                    href={`/api/admin/trace/${selectedTrace?.sessionId}`}
                    target="_blank"
                    className="text-xs font-mono text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <FileText className="w-3 h-3" />
                    View Raw JSON
                  </a>
                  <span className="font-mono text-sm text-gray-500">{selectedTrace?.sessionId}</span>
                </div>
              </DialogTitle>
              <DialogDescription className="text-gray-400">
                Review conversation history and apply AI grading.
              </DialogDescription>
            </DialogHeader>

            {selectedTrace && (
              <Tabs defaultValue="chat" className="mt-4">
                <TabsList className="bg-[#111] border border-[#222] w-full justify-start">
                  <TabsTrigger value="chat" className="data-[state=active]:bg-[#222] cursor-pointer">Conversation & Grading</TabsTrigger>
                  <TabsTrigger value="details" className="data-[state=active]:bg-[#222] cursor-pointer">Technical Details</TabsTrigger>
                </TabsList>

                <TabsContent value="chat" className="space-y-6 mt-4">
                  {/* Grading Controls */}
                  <div className="bg-[#111] p-4 rounded-lg border border-[#222] space-y-3">
                    <Label className="text-white font-medium">Auto-Grading Criteria (Custom Prompt)</Label>
                    <Textarea
                      placeholder="Enter specific grading instructions here (e.g., 'Focus on politeness', 'Check if they mentioned the refund policy'). Leave empty for default general grading."
                      value={gradingInstruction}
                      onChange={(e) => setGradingInstruction(e.target.value)}
                      className="bg-[#0a0a0a] border-[#333] text-white text-sm min-h-[80px]"
                    />
                    <div className="flex justify-end">
                      <Button
                        onClick={() => gradeTrace(selectedTrace.sessionId)}
                        disabled={isGrading}
                        className="bg-white text-black hover:bg-gray-200 cursor-pointer"
                      >
                        {isGrading && gradingSessionId === selectedTrace.sessionId ? 'Grading...' : 'Run Analysis'}
                      </Button>
                    </div>
                  </div>

                  {/* Grade Result */}
                  {selectedTrace.grade && (
                    <div className="bg-emerald-900/10 border border-emerald-900/30 p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-emerald-400 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" />
                          Analysis Results
                        </h3>
                        <span className="text-xs text-emerald-500/70">
                          Graded: {new Date(selectedTrace.grade.gradedAt || '').toLocaleString()}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                        <div className="bg-[#0a0a0a]/50 p-2 rounded">
                          <div className="text-2xl font-bold text-white">{selectedTrace.grade.overall_score}</div>
                          <div className="text-xs text-gray-400">Overall</div>
                        </div>
                        <div className="bg-[#0a0a0a]/50 p-2 rounded">
                          <div className="text-2xl font-bold text-white">{selectedTrace.grade.correctness}</div>
                          <div className="text-xs text-gray-400">Correctness</div>
                        </div>
                        <div className="bg-[#0a0a0a]/50 p-2 rounded">
                          <div className="text-2xl font-bold text-white">{selectedTrace.grade.efficiency}</div>
                          <div className="text-xs text-gray-400">Efficiency</div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <span className="text-xs uppercase text-gray-500 font-bold">Feedback</span>
                          <p className="text-sm text-gray-200 mt-1">{selectedTrace.grade.feedback}</p>
                        </div>
                        {selectedTrace.grade.suggestions && selectedTrace.grade.suggestions.length > 0 && (
                          <div>
                            <span className="text-xs uppercase text-gray-500 font-bold">Suggestions</span>
                            <ul className="text-sm text-gray-200 mt-1 list-disc list-inside">
                              {selectedTrace.grade.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Messages */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">Conversation History</h3>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                      {selectedTrace.messages?.map((msg: any, i: number) => {
                        const isUser = msg.role === 'user';
                        const content = msg.content || (msg.parts?.map((p: any) => p.text).join('')) || '';
                        if (!content) return null;

                        return (
                          <div key={i} className={cn("flex", isUser ? "justify-end" : "justify-start")}>
                            <div className={cn(
                              "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                              isUser
                                ? "bg-[#222] text-white rounded-br-none"
                                : "bg-[#111] text-gray-100 border border-[#333] rounded-bl-none"
                            )}>
                              <div className="font-semibold text-xs mb-1 opacity-50">{isUser ? 'User' : 'Assistant'}</div>
                              {content}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="details" className="space-y-6 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#111] p-4 rounded-lg border border-[#222]">
                      <h4 className="text-xs font-semibold text-gray-400 mb-2">METADATA</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-gray-500">Session ID</span> <span className="font-mono text-gray-300">{selectedTrace.sessionId}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Timestamp</span> <span className="text-gray-300">{new Date(selectedTrace.timestamp || '').toLocaleString()}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Model</span> <span className="text-emerald-400">{selectedTrace.model || selectedTrace.modelId || 'N/A'}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Duration</span> <span className="text-gray-300">{selectedTrace.durationMs}ms</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Total Tokens</span> <span className="text-gray-300">{selectedTrace.totalUsage || '-'}</span></div>
                      </div>
                    </div>
                    <div className="bg-[#111] p-4 rounded-lg border border-[#222]">
                      <h4 className="text-xs font-semibold text-gray-400 mb-2">FINAL STATE</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-gray-500">Finish Reason</span> <span className="text-gray-300">{selectedTrace.finishReason || '-'}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Ticket Created?</span>
                          <span className={selectedTrace.hasTicket ? "text-red-400" : "text-emerald-400"}>
                            {selectedTrace.hasTicket ? 'Yes' : 'No'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">Execution Steps</h3>
                    {!selectedTrace.steps || selectedTrace.steps.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 bg-[#111] rounded-lg border border-[#222] border-dashed">
                        No granular step data found for this session.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedTrace.steps.map((step: any, i: number) => (
                          <div key={i} className="bg-[#111] border border-[#222] rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <Badge variant="outline" className="text-xs uppercase bg-[#222] text-gray-400 border-none">
                                {step.stepType || 'Step'} {i + 1}
                              </Badge>
                              <span className="text-xs text-gray-500 font-mono">
                                {step.usage ? `${step.usage.totalTokens} tokens` : ''}
                              </span>
                            </div>

                            {step.toolCalls?.map((tc: any, j: number) => (
                              <div key={j} className="mb-2 bg-[#0a0a0a] p-2 rounded border border-[#333]">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge className="bg-blue-900/20 text-blue-400 border-blue-900/50 text-[10px] px-1 py-0 h-5">TOOL CALL</Badge>
                                  <span className="font-mono text-xs text-blue-300">{tc.toolName}</span>
                                </div>
                                <pre className="text-[10px] text-gray-400 overflow-x-auto p-1 font-mono">
                                  {JSON.stringify(tc.args, null, 2)}
                                </pre>
                              </div>
                            ))}

                            {step.text && (
                              <div className="text-sm text-gray-300 pl-2 border-l-2 border-[#333]">
                                {step.text}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
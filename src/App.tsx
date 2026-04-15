/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { format, parseISO, differenceInSeconds } from 'date-fns';
import { 
  Clock, 
  Coffee, 
  Utensils, 
  LogOut, 
  Download, 
  Trash2, 
  Edit2, 
  Timer,
  History,
  LayoutDashboard
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Session = {
  id: number;
  date: string;
  clock_in: string | null;
  tea_out: string | null;
  tea_in: string | null;
  lunch_out: string | null;
  lunch_in: string | null;
  clock_out: string | null;
  total_hours: number;
  status: 'idle' | 'working' | 'on_tea' | 'on_lunch' | 'done';
};

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    fetchData();
    return () => clearInterval(timer);
  }, []);

  const fetchData = async () => {
    try {
      const [sessionsRes, currentRes] = await Promise.all([
        fetch('/api/sessions'),
        fetch('/api/sessions/current')
      ]);
      const sessionsData = await sessionsRes.json();
      const currentData = await currentRes.json();
      setSessions(sessionsData);
      setCurrentSession(currentData);
    } catch (error) {
      toast.error('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: string) => {
    if (isActionLoading) return;
    
    // Optimistic UI Update
    const previousSession = currentSession;
    const now = new Date().toISOString();
    
    setIsActionLoading(true);
    
    try {
      const res = await fetch('/api/sessions/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, timestamp: now })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setCurrentSession(data.status === 'done' ? null : data);
      fetchData(); // Refresh history
      toast.success(`${action.replace('_', ' ')} recorded`);
    } catch (error: any) {
      setCurrentSession(previousSession);
      toast.error(error.message || 'Action failed');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Permanently delete this session?')) return;
    try {
      setSessions(prev => prev.filter(s => s.id !== id)); // Optimistic delete
      await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
      toast.success('Session removed');
    } catch (error) {
      fetchData(); // Revert on failure
      toast.error('Delete failed');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSession) return;
    try {
      await fetch(`/api/sessions/${editingSession.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingSession)
      });
      setEditingSession(null);
      fetchData();
      toast.success('Changes saved');
    } catch (error) {
      toast.error('Update failed');
    }
  };

  const next = useMemo(() => {
    if (!currentSession) return { label: 'Clock In', action: 'clock_in', icon: Clock, color: 'bg-emerald-600 hover:bg-emerald-700' };
    if (!currentSession.tea_out) return { label: 'Tea Break Out', action: 'tea_out', icon: Coffee, color: 'bg-amber-600 hover:bg-amber-700' };
    if (!currentSession.tea_in) return { label: 'Back to Work', action: 'tea_in', icon: Timer, color: 'bg-emerald-600 hover:bg-emerald-700' };
    if (!currentSession.lunch_out) return { label: 'Lunch Break Out', action: 'lunch_out', icon: Utensils, color: 'bg-blue-600 hover:bg-blue-700' };
    if (!currentSession.lunch_in) return { label: 'Back to Work', action: 'lunch_in', icon: Timer, color: 'bg-emerald-600 hover:bg-emerald-700' };
    return { label: 'Clock Out', action: 'clock_out', icon: LogOut, color: 'bg-rose-600 hover:bg-rose-700' };
  }, [currentSession]);

  const formatTime = (iso: string | null) => {
    if (!iso) return '--:--';
    try {
      return format(parseISO(iso), 'HH:mm:ss');
    } catch {
      return '--:--';
    }
  };

  const calculateLiveDuration = () => {
    if (!currentSession?.clock_in) return '00:00:00';
    let seconds = differenceInSeconds(currentTime, parseISO(currentSession.clock_in));
    
    if (currentSession.lunch_out && currentSession.lunch_in) {
      seconds -= differenceInSeconds(parseISO(currentSession.lunch_in), parseISO(currentSession.lunch_out));
    } else if (currentSession.lunch_out) {
      seconds -= differenceInSeconds(currentTime, parseISO(currentSession.lunch_out));
    }

    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#F0F0EE] text-[#141414] font-sans selection:bg-[#141414] selection:text-white">
      <div className="max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-10 space-y-6 sm:space-y-10">
        
        {/* Responsive Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end border-b-2 border-[#141414] pb-6 gap-6">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-1"
          >
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest opacity-50">
              <LayoutDashboard size={14} />
              <span>Shift Management System</span>
            </div>
            <h1 className="text-4xl sm:text-6xl font-black tracking-tighter uppercase italic font-serif leading-none">
              TimeTrack Pro
            </h1>
            <p className="text-[10px] sm:text-xs font-mono opacity-40 uppercase tracking-tighter">
              62.171.158.235 • PORT 8502 • STABLE RELEASE
            </p>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-full sm:w-auto flex flex-row sm:flex-col justify-between items-center sm:items-end font-mono"
          >
            <div className="text-3xl sm:text-5xl font-bold tabular-nums tracking-tighter">
              {format(currentTime, 'HH:mm:ss')}
            </div>
            <div className="text-[10px] sm:text-xs opacity-50 uppercase font-bold tracking-widest text-right">
              {format(currentTime, 'EEEE, MMM do yyyy')}
            </div>
          </motion.div>
        </header>

        <main className="grid grid-cols-1 xl:grid-cols-12 gap-6 sm:gap-10">
          
          {/* Status Control - Sticky on Desktop */}
          <div className="xl:col-span-4 space-y-6">
            <Card className="border-2 border-[#141414] bg-white shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] rounded-none overflow-hidden sticky top-6">
              <CardHeader className="bg-[#141414] text-white py-3 px-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] font-bold">Active Session</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${currentSession ? 'bg-emerald-400 animate-pulse' : 'bg-gray-400'}`} />
                    <span className="text-[10px] font-mono uppercase">{currentSession?.status || 'IDLE'}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 sm:p-8 flex flex-col items-center gap-8">
                <div className="relative group">
                  <div className="absolute inset-0 bg-[#141414] rounded-full blur-2xl opacity-5 group-hover:opacity-10 transition-opacity" />
                  <div className="relative w-40 h-40 sm:w-56 sm:h-56 rounded-full border-4 border-[#141414] flex flex-col items-center justify-center bg-white z-10">
                    <span className="text-[10px] sm:text-xs uppercase font-mono font-bold opacity-30 mb-1">Shift Duration</span>
                    <span className="text-3xl sm:text-5xl font-black font-mono tabular-nums tracking-tighter">
                      {calculateLiveDuration()}
                    </span>
                    <div className="mt-4 flex gap-1">
                      {[1, 2, 3].map(i => (
                        <div key={i} className={`w-1 h-1 rounded-full ${currentSession ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="w-full space-y-3">
                  <Button 
                    disabled={isActionLoading}
                    className={`w-full h-16 sm:h-20 text-lg sm:text-xl font-black uppercase tracking-tighter rounded-none border-2 border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all ${next.color} text-white`}
                    onClick={() => handleAction(next.action)}
                  >
                    {isActionLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Processing...</span>
                      </div>
                    ) : (
                      <>
                        <next.icon className="mr-3 h-6 w-6 sm:h-8 sm:w-8" />
                        {next.label}
                      </>
                    )}
                  </Button>
                  
                  <AnimatePresence mode="wait">
                    {currentSession && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="grid grid-cols-1 gap-2 pt-4"
                      >
                        <div className="flex justify-between items-center p-3 bg-gray-50 border border-gray-100 font-mono text-[10px] sm:text-xs">
                          <span className="font-bold opacity-40">CLOCK IN</span>
                          <span className="font-black">{formatTime(currentSession.clock_in)}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col p-3 bg-gray-50 border border-gray-100 font-mono text-[10px]">
                            <span className="font-bold opacity-40 uppercase mb-1">Tea Break</span>
                            <span className="font-black truncate">{formatTime(currentSession.tea_out)} - {formatTime(currentSession.tea_in)}</span>
                          </div>
                          <div className="flex flex-col p-3 bg-gray-50 border border-gray-100 font-mono text-[10px]">
                            <span className="font-bold opacity-40 uppercase mb-1">Lunch Break</span>
                            <span className="font-black truncate">{formatTime(currentSession.lunch_out)} - {formatTime(currentSession.lunch_in)}</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* History - Responsive Table/Cards */}
          <div className="xl:col-span-8 space-y-6">
            <Card className="border-2 border-[#141414] bg-white shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] rounded-none overflow-hidden">
              <CardHeader className="border-b-2 border-[#141414] flex flex-row items-center justify-between p-4 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#141414] text-white">
                    <History size={18} />
                  </div>
                  <CardTitle className="text-sm sm:text-base uppercase font-black tracking-tighter">Shift History</CardTitle>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-2 border-[#141414] rounded-none font-mono text-[10px] font-bold hover:bg-[#141414] hover:text-white transition-colors" 
                  onClick={() => window.location.href = '/api/export'}
                >
                  <Download className="mr-2 h-3 w-3" />
                  EXPORT CSV
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-6 space-y-4">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="animate-pulse bg-gray-200 rounded h-12 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    {/* Desktop Table View */}
                    <div className="hidden md:block">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-b-2 border-[#141414] hover:bg-transparent">
                            <TableHead className="text-[10px] font-mono font-black uppercase py-4">Date</TableHead>
                            <TableHead className="text-[10px] font-mono font-black uppercase py-4">Shift Period</TableHead>
                            <TableHead className="text-[10px] font-mono font-black uppercase py-4">Lunch Break</TableHead>
                            <TableHead className="text-[10px] font-mono font-black uppercase py-4 text-right">Hours</TableHead>
                            <TableHead className="text-[10px] font-mono font-black uppercase py-4 text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sessions.map((s) => (
                            <TableRow key={s.id} className="border-b border-gray-100 hover:bg-[#141414] hover:text-white transition-colors group">
                              <TableCell className="font-mono text-xs font-bold">{s.date}</TableCell>
                              <TableCell className="font-mono text-[10px] opacity-70">
                                <span className="font-black">{formatTime(s.clock_in)}</span> 
                                <span className="mx-2 opacity-30">→</span> 
                                <span className="font-black">{formatTime(s.clock_out)}</span>
                              </TableCell>
                              <TableCell className="font-mono text-[10px] opacity-70">
                                {s.lunch_out ? (
                                  <span className="font-black">{formatTime(s.lunch_out)} - {formatTime(s.lunch_in)}</span>
                                ) : <span className="opacity-30">N/A</span>}
                              </TableCell>
                              <TableCell className="text-right font-black font-mono text-sm">
                                {s.total_hours.toFixed(2)}<span className="text-[10px] ml-0.5 opacity-50">H</span>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8 group-hover:text-white" onClick={() => setEditingSession(s)}>
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600 group-hover:text-rose-400" onClick={() => handleDelete(s.id)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden divide-y divide-gray-100">
                      {sessions.map((s) => (
                        <div key={s.id} className="p-4 space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="text-[10px] font-mono font-bold opacity-40 uppercase">{s.date}</div>
                              <div className="text-sm font-black font-mono">
                                {formatTime(s.clock_in)} - {formatTime(s.clock_out)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] font-mono font-bold opacity-40 uppercase">Total</div>
                              <div className="text-lg font-black font-mono leading-none">{s.total_hours.toFixed(2)}h</div>
                            </div>
                          </div>
                          <div className="flex justify-between items-center pt-2">
                            <div className="text-[10px] font-mono bg-gray-50 px-2 py-1 border border-gray-100">
                              LUNCH: {s.lunch_out ? `${formatTime(s.lunch_out)}-${formatTime(s.lunch_in)}` : 'N/A'}
                            </div>
                            <div className="flex gap-1">
                              <Button variant="outline" size="icon" className="h-8 w-8 border-[#141414] rounded-none" onClick={() => setEditingSession(s)}>
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="outline" size="icon" className="h-8 w-8 border-[#141414] text-rose-600 rounded-none" onClick={() => handleDelete(s.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {sessions.length === 0 && !loading && (
                      <div className="py-20 text-center space-y-2">
                        <div className="text-4xl opacity-10">∅</div>
                        <p className="text-xs font-mono uppercase opacity-30 font-bold">No records found in database</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* Edit Dialog - Responsive */}
      <Dialog open={!!editingSession} onOpenChange={(open) => !open && setEditingSession(null)}>
        <DialogContent className="border-4 border-[#141414] rounded-none sm:max-w-[500px] p-0 overflow-hidden">
          <DialogHeader className="bg-[#141414] text-white p-6">
            <DialogTitle className="font-serif italic text-3xl tracking-tighter">Edit Session</DialogTitle>
            <DialogDescription className="font-mono text-[10px] uppercase text-gray-400 font-bold tracking-widest">
              ID: {editingSession?.id} • DATE: {editingSession?.date}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[
                { label: 'Clock In', key: 'clock_in' },
                { label: 'Clock Out', key: 'clock_out' },
                { label: 'Tea Out', key: 'tea_out' },
                { label: 'Tea In', key: 'tea_in' },
                { label: 'Lunch Out', key: 'lunch_out' },
                { label: 'Lunch In', key: 'lunch_in' },
              ].map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label className="text-[10px] font-mono font-black uppercase opacity-40">{field.label}</Label>
                  <Input 
                    className="rounded-none border-2 border-[#141414] font-mono text-sm focus-visible:ring-0 focus-visible:border-emerald-500 transition-colors" 
                    value={(editingSession as any)?.[field.key] || ''} 
                    onChange={e => setEditingSession(prev => prev ? {...prev, [field.key]: e.target.value} : null)}
                  />
                </div>
              ))}
            </div>
            <DialogFooter className="pt-4 flex flex-col sm:flex-row gap-3">
              <Button 
                type="button" 
                variant="outline" 
                className="w-full sm:w-auto rounded-none border-2 border-[#141414] font-bold uppercase text-xs" 
                onClick={() => setEditingSession(null)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="w-full sm:w-auto rounded-none bg-[#141414] text-white hover:bg-[#333] font-bold uppercase text-xs"
              >
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Toaster position="bottom-right" closeButton richColors />
    </div>
  );
}

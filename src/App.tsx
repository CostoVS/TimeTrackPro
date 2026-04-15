/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { format, parseISO, differenceInSeconds, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, subMonths, subWeeks } from 'date-fns';
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
  LayoutDashboard,
  Plus,
  FileText,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileDown
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
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

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

type ViewMode = 'clock' | 'reports';
type Period = 'all' | 'today' | 'week' | 'month';

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('clock');
  const [filterPeriod, setFilterPeriod] = useState<Period>('all');
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [idToDelete, setIdToDelete] = useState<number | null>(null);

  const [manualSession, setManualSession] = useState<Partial<Session>>({
    date: format(new Date(), 'yyyy-MM-dd'),
    clock_in: '',
    clock_out: '',
    tea_out: '',
    tea_in: '',
    lunch_out: '',
    lunch_in: '',
    status: 'done'
  });

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
      fetchData();
      toast.success(`${action.replace('_', ' ')} recorded`);
    } catch (error: any) {
      toast.error(error.message || 'Action failed');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDelete = (id: number) => {
    setIdToDelete(id);
  };

  const confirmDelete = async () => {
    if (!idToDelete) return;
    const id = idToDelete;
    setIdToDelete(null);
    try {
      setSessions(prev => prev.filter(s => s.id !== id));
      const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      
      if (currentSession?.id === id) {
        setCurrentSession(null);
      }
      
      toast.success('Session removed');
    } catch (error) {
      fetchData();
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

  const handleAddManual = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manualSession)
      });
      setIsAddingManual(false);
      fetchData();
      toast.success('Manual entry added');
    } catch (error) {
      toast.error('Failed to add entry');
    }
  };

  const filteredSessions = useMemo(() => {
    const now = new Date();
    return sessions.filter(s => {
      const sDate = parseISO(s.date);
      if (filterPeriod === 'today') return format(sDate, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
      if (filterPeriod === 'week') return isWithinInterval(sDate, { start: startOfWeek(now), end: endOfWeek(now) });
      if (filterPeriod === 'month') return isWithinInterval(sDate, { start: startOfMonth(now), end: endOfMonth(now) });
      return true;
    });
  }, [sessions, filterPeriod]);

  const stats = useMemo(() => {
    const now = new Date();
    const today = sessions.filter(s => format(parseISO(s.date), 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd'));
    const week = sessions.filter(s => isWithinInterval(parseISO(s.date), { start: startOfWeek(now), end: endOfWeek(now) }));
    const month = sessions.filter(s => isWithinInterval(parseISO(s.date), { start: startOfMonth(now), end: endOfMonth(now) }));

    return {
      today: today.reduce((acc, s) => acc + s.total_hours, 0),
      week: week.reduce((acc, s) => acc + s.total_hours, 0),
      month: month.reduce((acc, s) => acc + s.total_hours, 0)
    };
  }, [sessions]);

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('TimeTrack Pro - Shift Report', 14, 22);
    doc.setFontSize(10);
    doc.text(`Generated on: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, 14, 30);
    doc.text(`Period: ${filterPeriod.toUpperCase()}`, 14, 35);

    const tableData = filteredSessions.map(s => [
      s.date,
      formatTime(s.clock_in),
      formatTime(s.clock_out),
      s.lunch_out ? `${formatTime(s.lunch_out)} - ${formatTime(s.lunch_in)}` : 'N/A',
      s.total_hours.toFixed(2)
    ]);

    (doc as any).autoTable({
      startY: 45,
      head: [['Date', 'Clock In', 'Clock Out', 'Lunch Break', 'Hours']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [20, 20, 20] },
      styles: { font: 'helvetica', fontSize: 9 }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 45;
    doc.setFontSize(12);
    doc.text(`Total Hours for Period: ${filteredSessions.reduce((acc, s) => acc + s.total_hours, 0).toFixed(2)}h`, 14, finalY + 15);

    doc.save(`timetrack_report_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return '--:--';
    try {
      const date = iso.includes('T') ? parseISO(iso) : parseISO(`${format(new Date(), 'yyyy-MM-dd')}T${iso}`);
      return format(date, 'HH:mm');
    } catch {
      return iso;
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

  const clockActions = [
    { label: 'Clock In', action: 'clock_in', icon: Clock, color: 'bg-emerald-600 hover:bg-emerald-700' },
    { label: 'Tea Out', action: 'tea_out', icon: Coffee, color: 'bg-amber-600 hover:bg-amber-700' },
    { label: 'Tea In', action: 'tea_in', icon: Timer, color: 'bg-emerald-500 hover:bg-emerald-600' },
    { label: 'Lunch Out', action: 'lunch_out', icon: Utensils, color: 'bg-blue-600 hover:bg-blue-700' },
    { label: 'Lunch In', action: 'lunch_in', icon: Timer, color: 'bg-blue-500 hover:bg-blue-600' },
    { label: 'Clock Out', action: 'clock_out', icon: LogOut, color: 'bg-rose-600 hover:bg-rose-700' },
  ];

  return (
    <div className="min-h-screen bg-[#F0F0EE] text-[#141414] font-sans selection:bg-[#141414] selection:text-white">
      <div className="max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-10 space-y-6 sm:space-y-10">
        
        {/* Responsive Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end border-b-2 border-[#141414] pb-6 gap-6">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest opacity-50">
              <LayoutDashboard size={14} />
              <span>Shift Management System</span>
            </div>
            <h1 className="text-4xl sm:text-6xl font-black tracking-tighter uppercase italic font-serif leading-none">
              TimeTrack Pro
            </h1>
            <div className="flex gap-4 mt-4">
              <button 
                onClick={() => setViewMode('clock')}
                className={`text-xs font-mono uppercase tracking-widest font-bold pb-1 border-b-2 transition-all ${viewMode === 'clock' ? 'border-[#141414] opacity-100' : 'border-transparent opacity-30 hover:opacity-60'}`}
              >
                Clocking
              </button>
              <button 
                onClick={() => setViewMode('reports')}
                className={`text-xs font-mono uppercase tracking-widest font-bold pb-1 border-b-2 transition-all ${viewMode === 'reports' ? 'border-[#141414] opacity-100' : 'border-transparent opacity-30 hover:opacity-60'}`}
              >
                Reports
              </button>
            </div>
          </motion.div>
          
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="w-full sm:w-auto flex flex-row sm:flex-col justify-between items-center sm:items-end font-mono">
            <div className="text-3xl sm:text-5xl font-bold tabular-nums tracking-tighter">
              {format(currentTime, 'HH:mm:ss')}
            </div>
            <div className="text-[10px] sm:text-xs opacity-50 uppercase font-bold tracking-widest text-right">
              {format(currentTime, 'EEEE, MMM do yyyy')}
            </div>
          </motion.div>
        </header>

        <main className="grid grid-cols-1 xl:grid-cols-12 gap-6 sm:gap-10">
          
          {viewMode === 'clock' ? (
            <>
              {/* Status Control */}
              <div className="xl:col-span-12 space-y-6">
                <Card className="border-2 border-[#141414] bg-white shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] rounded-none overflow-hidden">
                  <CardHeader className="bg-[#141414] text-white py-3 px-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-mono uppercase tracking-[0.2em] font-bold">Clocking Dashboard</span>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${currentSession ? 'bg-emerald-400 animate-pulse' : 'bg-gray-400'}`} />
                        <span className="text-[10px] font-mono uppercase">{currentSession?.status || 'IDLE'}</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 sm:p-8 space-y-8">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                      <div className="relative w-40 h-40 sm:w-48 sm:h-48 rounded-full border-4 border-[#141414] flex flex-col items-center justify-center bg-white z-10 shrink-0">
                        <span className="text-[10px] sm:text-xs uppercase font-mono font-bold opacity-30 mb-1">Shift Duration</span>
                        <span className="text-3xl sm:text-4xl font-black font-mono tabular-nums tracking-tighter">
                          {calculateLiveDuration()}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full">
                        {clockActions.map((btn) => (
                          <Button 
                            key={btn.action}
                            disabled={isActionLoading}
                            className={`h-20 sm:h-24 flex flex-col items-center justify-center gap-2 text-xs sm:text-sm font-black uppercase tracking-tighter rounded-none border-2 border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all ${btn.color} text-white`}
                            onClick={() => handleAction(btn.action)}
                          >
                            <btn.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                            <span>{btn.label}</span>
                          </Button>
                        ))}
                      </div>
                    </div>

                    {currentSession && (
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 pt-4 border-t border-gray-100">
                        {[
                          { label: 'IN', val: currentSession.clock_in },
                          { label: 'TEA OUT', val: currentSession.tea_out },
                          { label: 'TEA IN', val: currentSession.tea_in },
                          { label: 'LUNCH OUT', val: currentSession.lunch_out },
                          { label: 'LUNCH IN', val: currentSession.lunch_in },
                          { label: 'OUT', val: currentSession.clock_out },
                        ].map(item => (
                          <div key={item.label} className="flex flex-col p-2 bg-gray-50 border border-gray-100 font-mono text-[10px]">
                            <span className="font-bold opacity-40 uppercase mb-1">{item.label}</span>
                            <span className="font-black">{formatTime(item.val)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* History */}
              <div className="xl:col-span-12 space-y-6">
                <Card className="border-2 border-[#141414] bg-white shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] rounded-none overflow-hidden">
                  <CardHeader className="border-b-2 border-[#141414] flex flex-row items-center justify-between p-4 sm:p-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[#141414] text-white"><History size={18} /></div>
                      <CardTitle className="text-sm sm:text-base uppercase font-black tracking-tighter">Detailed History</CardTitle>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="border-2 border-[#141414] rounded-none font-mono text-[10px] font-bold" onClick={() => setIsAddingManual(true)}>
                        <Plus className="mr-2 h-3 w-3" /> ADD MANUAL
                      </Button>
                      <Button variant="outline" size="sm" className="border-2 border-[#141414] rounded-none font-mono text-[10px] font-bold" onClick={() => window.location.href = '/api/export'}>
                        <Download className="mr-2 h-3 w-3" /> CSV
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="flex gap-2 p-4 border-b border-gray-100 overflow-x-auto">
                      {(['all', 'today', 'week', 'month'] as Period[]).map(p => (
                        <Button 
                          key={p} 
                          variant={filterPeriod === p ? 'default' : 'ghost'} 
                          size="sm" 
                          className={`rounded-none font-mono text-[10px] uppercase font-bold ${filterPeriod === p ? 'bg-[#141414] text-white' : ''}`}
                          onClick={() => setFilterPeriod(p)}
                        >
                          {p}
                        </Button>
                      ))}
                    </div>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-b-2 border-[#141414] hover:bg-transparent">
                            <TableHead className="text-[10px] font-mono font-black uppercase py-4">Date</TableHead>
                            <TableHead className="text-[10px] font-mono font-black uppercase py-4">Clock In</TableHead>
                            <TableHead className="text-[10px] font-mono font-black uppercase py-4">Tea Break</TableHead>
                            <TableHead className="text-[10px] font-mono font-black uppercase py-4">Lunch Break</TableHead>
                            <TableHead className="text-[10px] font-mono font-black uppercase py-4">Clock Out</TableHead>
                            <TableHead className="text-[10px] font-mono font-black uppercase py-4 text-right">Total</TableHead>
                            <TableHead className="text-[10px] font-mono font-black uppercase py-4 text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredSessions.map((s) => (
                            <TableRow key={s.id} className="border-b border-gray-100 hover:bg-[#141414] hover:text-white transition-colors group">
                              <TableCell className="font-mono text-xs font-bold">{s.date}</TableCell>
                              <TableCell className="font-mono text-[10px] font-black">{formatTime(s.clock_in)}</TableCell>
                              <TableCell className="font-mono text-[10px]">
                                {s.tea_out ? `${formatTime(s.tea_out)} - ${formatTime(s.tea_in)}` : '--'}
                              </TableCell>
                              <TableCell className="font-mono text-[10px]">
                                {s.lunch_out ? `${formatTime(s.lunch_out)} - ${formatTime(s.lunch_in)}` : '--'}
                              </TableCell>
                              <TableCell className="font-mono text-[10px] font-black">{formatTime(s.clock_out)}</TableCell>
                              <TableCell className="text-right font-black font-mono text-sm">
                                {s.total_hours.toFixed(2)}h
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8 group-hover:text-white" onClick={() => setEditingSession(s)}><Edit2 className="h-3.5 w-3.5" /></Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600 group-hover:text-rose-400" onClick={() => handleDelete(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            /* Reports View */
            <div className="xl:col-span-12 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { label: 'Today', value: stats.today, icon: Clock, color: 'text-emerald-600' },
                  { label: 'This Week', value: stats.week, icon: Calendar, color: 'text-blue-600' },
                  { label: 'This Month', value: stats.month, icon: FileText, color: 'text-purple-600' }
                ].map(stat => (
                  <Card key={stat.label} className="border-2 border-[#141414] bg-white shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] rounded-none">
                    <CardContent className="p-6 flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-[10px] font-mono uppercase font-bold opacity-40">{stat.label}</p>
                        <p className="text-4xl font-black font-mono tracking-tighter">{stat.value.toFixed(1)}<span className="text-sm ml-1 opacity-30">HRS</span></p>
                      </div>
                      <stat.icon className={`h-10 w-10 ${stat.color} opacity-20`} />
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="border-2 border-[#141414] bg-white shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] rounded-none overflow-hidden">
                <CardHeader className="border-b-2 border-[#141414] flex flex-row items-center justify-between p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#141414] text-white"><FileText size={18} /></div>
                    <CardTitle className="text-base uppercase font-black tracking-tighter">Detailed Analysis</CardTitle>
                  </div>
                  <Button className="bg-[#141414] text-white rounded-none font-bold uppercase text-xs px-6" onClick={exportPDF}>
                    <FileDown className="mr-2 h-4 w-4" /> Download PDF
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b-2 border-[#141414] hover:bg-transparent">
                        <TableHead className="text-[10px] font-mono font-black uppercase py-4">Date</TableHead>
                        <TableHead className="text-[10px] font-mono font-black uppercase py-4">Clock In</TableHead>
                        <TableHead className="text-[10px] font-mono font-black uppercase py-4">Clock Out</TableHead>
                        <TableHead className="text-[10px] font-mono font-black uppercase py-4">Lunch</TableHead>
                        <TableHead className="text-[10px] font-mono font-black uppercase py-4 text-right">Total Hours</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSessions.map((s) => (
                        <TableRow key={s.id} className="border-b border-gray-100">
                          <TableCell className="font-mono text-xs font-bold">{s.date}</TableCell>
                          <TableCell className="font-mono text-xs">{formatTime(s.clock_in)}</TableCell>
                          <TableCell className="font-mono text-xs">{formatTime(s.clock_out)}</TableCell>
                          <TableCell className="font-mono text-xs opacity-50">{s.lunch_out ? `${formatTime(s.lunch_out)}-${formatTime(s.lunch_in)}` : 'N/A'}</TableCell>
                          <TableCell className="text-right font-black font-mono text-sm">{s.total_hours.toFixed(2)}h</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={idToDelete !== null} onOpenChange={(open) => !open && setIdToDelete(null)}>
        <DialogContent className="border-2 border-[#141414] rounded-none shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
          <DialogHeader>
            <DialogTitle className="uppercase font-black tracking-tighter">Confirm Deletion</DialogTitle>
            <DialogDescription className="font-mono text-xs">
              Are you sure you want to permanently delete this session? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="border-2 border-[#141414] rounded-none font-mono text-[10px] font-bold" onClick={() => setIdToDelete(null)}>
              CANCEL
            </Button>
            <Button variant="destructive" className="border-2 border-[#141414] rounded-none font-mono text-[10px] font-bold bg-rose-600 hover:bg-rose-700" onClick={confirmDelete}>
              DELETE PERMANENTLY
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Entry Dialog */}
      <Dialog open={isAddingManual} onOpenChange={setIsAddingManual}>
        <DialogContent className="border-4 border-[#141414] rounded-none sm:max-w-[500px] p-0 overflow-hidden">
          <DialogHeader className="bg-[#141414] text-white p-6">
            <DialogTitle className="font-serif italic text-3xl tracking-tighter">Manual Entry</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddManual} className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="sm:col-span-2 space-y-2">
                <Label className="text-[10px] font-mono font-black uppercase opacity-40">Date</Label>
                <Input type="date" className="rounded-none border-2 border-[#141414] font-mono" value={manualSession.date} onChange={e => setManualSession({...manualSession, date: e.target.value})} />
              </div>
              {['clock_in', 'clock_out', 'lunch_out', 'lunch_in'].map(key => (
                <div key={key} className="space-y-2">
                  <Label className="text-[10px] font-mono font-black uppercase opacity-40">{key.replace('_', ' ')}</Label>
                  <Input type="time" className="rounded-none border-2 border-[#141414] font-mono" value={(manualSession as any)[key]} onChange={e => setManualSession({...manualSession, [key]: e.target.value})} />
                </div>
              ))}
            </div>
            <DialogFooter className="pt-4"><Button type="submit" className="w-full rounded-none bg-[#141414] text-white font-bold uppercase text-xs">Add Record</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingSession} onOpenChange={(open) => !open && setEditingSession(null)}>
        <DialogContent className="border-4 border-[#141414] rounded-none sm:max-w-[500px] p-0 overflow-hidden">
          <DialogHeader className="bg-[#141414] text-white p-6">
            <DialogTitle className="font-serif italic text-3xl tracking-tighter">Edit Session</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="sm:col-span-2 space-y-2">
                <Label className="text-[10px] font-mono font-black uppercase opacity-40">Date (YYYY-MM-DD)</Label>
                <Input className="rounded-none border-2 border-[#141414] font-mono" value={editingSession?.date || ''} onChange={e => setEditingSession(prev => prev ? {...prev, date: e.target.value} : null)} />
              </div>
              {['clock_in', 'clock_out', 'lunch_out', 'lunch_in', 'tea_out', 'tea_in'].map((field) => (
                <div key={field} className="space-y-2">
                  <Label className="text-[10px] font-mono font-black uppercase opacity-40">{field.replace('_', ' ')}</Label>
                  <Input className="rounded-none border-2 border-[#141414] font-mono" value={(editingSession as any)?.[field] || ''} onChange={e => setEditingSession(prev => prev ? {...prev, [field]: e.target.value} : null)} />
                </div>
              ))}
            </div>
            <DialogFooter className="pt-4 flex gap-3">
              <Button type="button" variant="outline" className="w-full rounded-none border-2 border-[#141414]" onClick={() => setEditingSession(null)}>Cancel</Button>
              <Button type="submit" className="w-full rounded-none bg-[#141414] text-white">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Toaster position="bottom-right" closeButton richColors />
    </div>
  );
}

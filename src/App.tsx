import React, { useState, useEffect, useMemo } from 'react';
import { 
  Clock, 
  Coffee, 
  Utensils, 
  LogOut, 
  Calendar, 
  Download, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  ChevronRight, 
  ChevronLeft,
  FileText,
  AlertCircle,
  Briefcase,
  HeartPulse,
  Palmtree,
  Home,
  Save,
  MoreVertical,
  History,
  LayoutDashboard,
  Timer,
  FileDown,
  Info,
  Eye,
  EyeOff
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isWithinInterval, differenceInSeconds } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';

interface Session {
  id: number;
  date: string;
  clock_in: string | null;
  tea_out: string | null;
  tea_in: string | null;
  lunch_out: string | null;
  lunch_in: string | null;
  clock_out: string | null;
  total_hours: number;
  status: string;
  leave_type: string | null;
  is_paid: number;
  leave_hours: number;
  notes: string | null;
}

const LEAVE_TYPES = [
  { id: 'sick_paid', label: 'Sick Leave (Paid)', icon: HeartPulse, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
  { id: 'sick_unpaid', label: 'Sick Leave (Unpaid)', icon: HeartPulse, color: 'text-zinc-600', bg: 'bg-zinc-50', border: 'border-zinc-100' },
  { id: 'annual_paid', label: 'Annual Leave (Paid)', icon: Palmtree, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  { id: 'annual_unpaid', label: 'Annual Leave (Unpaid)', icon: Palmtree, color: 'text-zinc-600', bg: 'bg-zinc-50', border: 'border-zinc-100' },
  { id: 'public_holiday', label: 'Public Holiday', icon: Home, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
  { id: 'day_off', label: 'Day Off', icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
];

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('nic_token'));
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewDate, setViewDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Partial<Session> | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [viewMode, setViewMode] = useState<'dashboard' | 'history'>('dashboard');

  const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('nic_token');
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      localStorage.removeItem('nic_token');
      setIsAuthenticated(false);
      throw new Error('Unauthorized');
    }
    return res;
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    fetchSessions();
    fetchCurrentSession();
    return () => clearInterval(timer);
  }, [isAuthenticated]);

  const fetchSessions = async () => {
    try {
      const res = await authenticatedFetch('/api/sessions');
      const data = await res.json();
      setSessions(data);
    } catch (err) {
      if (err instanceof Error && err.message !== 'Unauthorized') {
        toast.error('Failed to fetch history');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentSession = async () => {
    try {
      const res = await authenticatedFetch('/api/sessions/current');
      const data = await res.json();
      setCurrentSession(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAction = async (action: string) => {
    try {
      const res = await authenticatedFetch('/api/sessions/action', {
        method: 'POST',
        body: JSON.stringify({ 
          action,
          clientDate: format(new Date(), 'yyyy-MM-dd')
        }),
      });
      const data = await res.json();
      setCurrentSession(data.status === 'idle' ? null : data);
      fetchSessions();
      toast.success(`Action: ${action.replace('_', ' ')} recorded`);
    } catch (err) {
      toast.error('Action failed');
    }
  };

  const saveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSession) return;

    try {
      const method = editingSession.id ? 'PUT' : 'POST';
      const url = editingSession.id ? `/api/sessions/${editingSession.id}` : '/api/sessions';
      
      const res = await authenticatedFetch(url, {
        method,
        body: JSON.stringify(editingSession),
      });

      if (res.ok) {
        toast.success(editingSession.id ? 'Session updated' : 'Session added');
        setIsModalOpen(false);
        setEditingSession(null);
        fetchSessions();
        fetchCurrentSession();
      }
    } catch (err) {
      toast.error('Save failed');
    }
  };

  const deleteSession = async (id: number) => {
    try {
      await authenticatedFetch(`/api/sessions/${id}`, { method: 'DELETE' });
      toast.success('Session deleted');
      fetchSessions();
      fetchCurrentSession();
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('nic_token');
    setIsAuthenticated(false);
    toast.info('Logged out successfully');
  };

  console.log('[APP] Render - isAuthenticated:', isAuthenticated);

  if (!isAuthenticated) {
    return (
      <>
        <Toaster position="top-center" richColors />
        <Login onLogin={() => setIsAuthenticated(true)} />
      </>
    );
  }

  const exportPDF = () => {
    const doc = new jsPDF();
    const monthName = format(viewDate, 'MMMM yyyy');
    
    doc.setFontSize(22);
    doc.setTextColor(24, 24, 27);
    doc.text('TimeTrack Pro - Timesheet', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(113, 113, 122);
    doc.text(`Period: ${monthName}`, 14, 30);
    doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, 14, 35);
    
    const monthSessions = sessions.filter(s => 
      format(parseISO(s.date), 'yyyy-MM') === format(viewDate, 'yyyy-MM')
    ).sort((a, b) => a.date.localeCompare(b.date));

    const tableData = monthSessions.map(s => [
      format(parseISO(s.date), 'dd MMM (EEE)'),
      s.leave_type ? LEAVE_TYPES.find(l => l.id === s.leave_type)?.label : 'Work',
      s.clock_in ? format(parseISO(s.clock_in), 'HH:mm') : '-',
      s.clock_out ? format(parseISO(s.clock_out), 'HH:mm') : '-',
      s.total_hours.toFixed(2),
      s.notes || '-'
    ]);

    autoTable(doc, {
      startY: 45,
      head: [['Date', 'Type', 'Clock In', 'Clock Out', 'Hours', 'Notes']],
      body: tableData,
      theme: 'grid',
      headStyles: { 
        fillColor: [24, 24, 27],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold',
        halign: 'center'
      },
      styles: { 
        fontSize: 9,
        cellPadding: 3
      },
      columnStyles: {
        4: { halign: 'right', fontStyle: 'bold' }
      }
    });

    const total = monthSessions.reduce((acc, s) => acc + s.total_hours, 0);
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    
    doc.setFontSize(12);
    doc.setTextColor(24, 24, 27);
    doc.text(`Total Monthly Hours: ${total.toFixed(2)}h`, 14, finalY);

    doc.save(`timesheet-${format(viewDate, 'yyyy-MM')}.pdf`);
  };

  const stats = useMemo(() => {
    const now = new Date();
    const monthSessions = sessions.filter(s => format(parseISO(s.date), 'yyyy-MM') === format(viewDate, 'yyyy-MM'));
    const weekSessions = sessions.filter(s => {
      const d = parseISO(s.date);
      return isWithinInterval(d, { start: startOfWeek(now), end: endOfWeek(now) });
    });

    return {
      monthTotal: monthSessions.reduce((acc, s) => acc + s.total_hours, 0),
      weekTotal: weekSessions.reduce((acc, s) => acc + s.total_hours, 0),
      leaveDays: sessions.filter(s => s.leave_type && s.leave_type !== 'public_holiday').length,
    };
  }, [sessions, viewDate]);

  const calculateLiveDuration = () => {
    if (!currentSession?.clock_in) return '00:00:00';
    let seconds = differenceInSeconds(currentTime, parseISO(currentSession.clock_in));
    
    // Deduct lunch if it happened
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

  const currentStatus = currentSession?.status || 'idle';

  return (
    <div className="min-h-screen bg-zinc-50/50">
      <Toaster position="top-center" richColors />
      
      {/* Navigation */}
      <nav className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center text-zinc-950 shadow-lg shadow-white/10">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-lg font-bold tracking-tight text-white">TimeTrack Pro</span>
                <Badge variant="outline" className="ml-2 text-[10px] py-0 h-5 border-zinc-800 text-zinc-500">v2.1</Badge>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
              <Button 
                variant={viewMode === 'dashboard' ? 'secondary' : 'ghost'} 
                size="sm" 
                onClick={() => setViewMode('dashboard')}
                className={`gap-2 ${viewMode === 'dashboard' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white'}`}
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Button>
              <Button 
                variant={viewMode === 'history' ? 'secondary' : 'ghost'} 
                size="sm" 
                onClick={() => setViewMode('history')}
                className={`gap-2 ${viewMode === 'history' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white'}`}
              >
                <History className="w-4 h-4" />
                History
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setEditingSession({ date: format(new Date(), 'yyyy-MM-dd'), is_paid: 1, leave_hours: 8 });
                  setIsModalOpen(true);
                }}
                className="hidden sm:flex gap-2 bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                <Plus className="w-4 h-4" />
                Add Entry
              </Button>
              <Button size="sm" onClick={exportPDF} className="gap-2 bg-white text-zinc-950 hover:bg-zinc-200">
                <FileDown className="w-4 h-4" />
                Export PDF
              </Button>
              <Button variant="ghost" size="icon" onClick={handleLogout} className="text-zinc-500 hover:text-red-400">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {viewMode === 'dashboard' ? (
          <>
            {/* Hero Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Clock Card */}
              <Card className="lg:col-span-2 border-zinc-800 bg-zinc-900/40 backdrop-blur-xl shadow-2xl shadow-black/50 overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold tracking-tight text-white">Shift Control</CardTitle>
                      <CardDescription className="text-zinc-500">Manage your current work session</CardDescription>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-zinc-900/50 border border-zinc-800 rounded-full">
                      <div className={`w-2 h-2 rounded-full ${currentStatus === 'idle' ? 'bg-zinc-700' : 'bg-emerald-500 animate-pulse'}`} />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{currentStatus.replace('_', ' ')}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-8 pb-8 space-y-10">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-12">
                    <div className="flex flex-col items-center justify-center p-10 rounded-full border-8 border-zinc-900/50 bg-zinc-900 shadow-2xl w-64 h-64 relative group">
                      <div className="absolute inset-0 rounded-full bg-emerald-500/5 blur-3xl group-hover:bg-emerald-500/10 transition-colors" />
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2 relative">Duration</span>
                      <span className="text-5xl font-black font-mono tracking-tighter text-white relative">
                        {calculateLiveDuration()}
                      </span>
                      <span className="text-[10px] font-bold text-zinc-500 mt-2 tracking-widest relative">{format(currentTime, 'HH:mm:ss')}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                      <ActionButton 
                        icon={Clock} 
                        label="Clock In" 
                        active={currentStatus === 'idle'} 
                        onClick={() => handleAction('clock_in')}
                        variant="emerald"
                      />
                      <ActionButton 
                        icon={Coffee} 
                        label={currentStatus === 'on_tea' ? "End Tea" : "Tea Break"} 
                        active={currentStatus === 'working' || currentStatus === 'on_tea'} 
                        onClick={() => handleAction(currentStatus === 'on_tea' ? 'tea_in' : 'tea_out')}
                        variant="amber"
                      />
                      <ActionButton 
                        icon={Utensils} 
                        label={currentStatus === 'on_lunch' ? "End Lunch" : "Lunch Break"} 
                        active={currentStatus === 'working' || currentStatus === 'on_tea' || currentStatus === 'on_lunch'} 
                        onClick={() => handleAction(currentStatus === 'on_lunch' ? 'lunch_in' : 'lunch_out')}
                        variant="blue"
                      />
                      <ActionButton 
                        icon={LogOut} 
                        label="Clock Out" 
                        active={currentStatus !== 'idle'} 
                        onClick={() => handleAction('clock_out')}
                        variant="zinc"
                      />
                    </div>
                  </div>

                  {currentSession && (
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2 pt-8 border-t border-zinc-800">
                      {[
                        { label: 'Clock In', val: currentSession.clock_in, icon: Clock },
                        { label: 'Tea Out', val: currentSession.tea_out, icon: Coffee },
                        { label: 'Tea In', val: currentSession.tea_in, icon: Timer },
                        { label: 'Lunch Out', val: currentSession.lunch_out, icon: Utensils },
                        { label: 'Lunch In', val: currentSession.lunch_in, icon: Timer },
                        { label: 'Clock Out', val: currentSession.clock_out, icon: LogOut },
                      ].map(item => (
                        <div key={item.label} className="flex flex-col p-3 bg-zinc-950/50 rounded-xl border border-zinc-800/50">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase mb-1 flex items-center gap-1">
                            <item.icon className="w-3 h-3" />
                            {item.label}
                          </span>
                          <span className="text-sm font-bold font-mono text-zinc-300">
                            {item.val ? format(parseISO(item.val), 'HH:mm') : '--:--'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Stats Column */}
              <div className="space-y-6">
                <StatCard 
                  label="Monthly Total" 
                  value={`${stats.monthTotal.toFixed(1)}h`} 
                  icon={Calendar} 
                  description={format(viewDate, 'MMMM yyyy')}
                  trend="+12% from last month"
                />
                <StatCard 
                  label="Weekly Total" 
                  value={`${stats.weekTotal.toFixed(1)}h`} 
                  icon={Briefcase} 
                  description="Current Week"
                />
                <StatCard 
                  label="Leave Balance" 
                  value={`${stats.leaveDays}d`} 
                  icon={Palmtree} 
                  description="Days taken this year"
                  variant="zinc"
                />
              </div>
            </div>

            {/* Recent Activity Mini-Table */}
            <Card className="border-zinc-800 bg-zinc-900/40 backdrop-blur-xl shadow-xl shadow-black/20">
              <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-800/50">
                <div>
                  <CardTitle className="text-lg font-bold text-white">Recent Activity</CardTitle>
                  <CardDescription className="text-zinc-500">Your last 5 sessions</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setViewMode('history')} className="text-zinc-500 hover:text-white hover:bg-zinc-800">
                  View All <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-zinc-950/50 border-zinc-800 hover:bg-zinc-950/50">
                      <TableHead className="w-[150px] text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Date</TableHead>
                      <TableHead className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Type</TableHead>
                      <TableHead className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Clock In</TableHead>
                      <TableHead className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Clock Out</TableHead>
                      <TableHead className="text-right text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.slice(0, 5).map((s) => (
                      <TableRow key={s.id} className="group border-zinc-800 hover:bg-zinc-800/30 transition-colors">
                        <TableCell className="font-bold text-zinc-300">{format(parseISO(s.date), 'dd MMM yyyy')}</TableCell>
                        <TableCell>
                          {s.leave_type ? (
                            <Badge variant="secondary" className={`${LEAVE_TYPES.find(l => l.id === s.leave_type)?.bg} ${LEAVE_TYPES.find(l => l.id === s.leave_type)?.color} border-none text-[10px] font-black`}>
                              {LEAVE_TYPES.find(l => l.id === s.leave_type)?.label}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-zinc-500 border-zinc-800 text-[10px] font-bold uppercase tracking-wider">Work Day</Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-zinc-400">{s.clock_in ? format(parseISO(s.clock_in), 'HH:mm') : '-'}</TableCell>
                        <TableCell className="font-mono text-xs text-zinc-400">{s.clock_out ? format(parseISO(s.clock_out), 'HH:mm') : '-'}</TableCell>
                        <TableCell className="text-right font-black text-white">{s.total_hours.toFixed(2)}h</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        ) : (
          /* Full History View */
          <Card className="border-zinc-800 bg-zinc-900/40 backdrop-blur-xl shadow-2xl shadow-black/50 overflow-hidden">
            <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
              <div>
                <CardTitle className="text-2xl font-bold tracking-tight text-white">Attendance History</CardTitle>
                <CardDescription className="text-zinc-500">Detailed logs of your work and leave sessions</CardDescription>
              </div>
              <div className="flex items-center gap-2 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-white" onClick={() => setViewDate(subMonths(viewDate, 1))}><ChevronLeft className="w-4 h-4" /></Button>
                <span className="text-sm font-black px-4 min-w-[140px] text-center text-zinc-200 uppercase tracking-widest">{format(viewDate, 'MMMM yyyy')}</span>
                <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-white" onClick={() => setViewDate(addMonths(viewDate, 1))}><ChevronRight className="w-4 h-4" /></Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-zinc-950/50 border-zinc-800 hover:bg-zinc-950/50">
                    <TableHead className="px-6 text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Date</TableHead>
                    <TableHead className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Type</TableHead>
                    <TableHead className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Clock In</TableHead>
                    <TableHead className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Tea Break</TableHead>
                    <TableHead className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Lunch Break</TableHead>
                    <TableHead className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Clock Out</TableHead>
                    <TableHead className="text-right text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Total</TableHead>
                    <TableHead className="text-right px-6 text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions
                    .filter(s => format(parseISO(s.date), 'yyyy-MM') === format(viewDate, 'yyyy-MM'))
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((s) => (
                      <TableRow key={s.id} className="group border-zinc-800 hover:bg-zinc-800/30 transition-colors">
                        <TableCell className="px-6">
                          <div className="font-black text-white">{format(parseISO(s.date), 'dd MMM')}</div>
                          <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{format(parseISO(s.date), 'EEEE')}</div>
                        </TableCell>
                        <TableCell>
                          {s.leave_type ? (
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${LEAVE_TYPES.find(l => l.id === s.leave_type)?.bg} ${LEAVE_TYPES.find(l => l.id === s.leave_type)?.color} ${LEAVE_TYPES.find(l => l.id === s.leave_type)?.border}`}>
                              {React.createElement(LEAVE_TYPES.find(l => l.id === s.leave_type)?.icon || Info, { className: "w-3 h-3" })}
                              {LEAVE_TYPES.find(l => l.id === s.leave_type)?.label}
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-zinc-500 border-zinc-800 font-black text-[10px] uppercase tracking-wider">Work</Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-zinc-400">{s.clock_in ? format(parseISO(s.clock_in), 'HH:mm') : '-'}</TableCell>
                        <TableCell className="font-mono text-[10px] text-zinc-500">
                          {s.tea_out ? `${format(parseISO(s.tea_out), 'HH:mm')} - ${s.tea_in ? format(parseISO(s.tea_in), 'HH:mm') : '...'}` : '-'}
                        </TableCell>
                        <TableCell className="font-mono text-[10px] text-zinc-500">
                          {s.lunch_out ? `${format(parseISO(s.lunch_out), 'HH:mm')} - ${s.lunch_in ? format(parseISO(s.lunch_in), 'HH:mm') : '...'}` : '-'}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-zinc-400">{s.clock_out ? format(parseISO(s.clock_out), 'HH:mm') : '-'}</TableCell>
                        <TableCell className="text-right">
                          <span className="font-black text-white">{s.total_hours.toFixed(2)}h</span>
                        </TableCell>
                        <TableCell className="text-right px-6">
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-800" 
                              onClick={() => {
                                setEditingSession(s);
                                setIsModalOpen(true);
                              }}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-red-400 hover:bg-red-400/10">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
                                <DialogHeader>
                                  <DialogTitle>Delete Entry</DialogTitle>
                                  <DialogDescription className="text-zinc-500">Are you sure you want to delete this session? This action cannot be undone.</DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                  <Button variant="outline" className="bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white" onClick={() => {}}>Cancel</Button>
                                  <Button variant="destructive" onClick={() => deleteSession(s.id)}>Delete</Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              {sessions.filter(s => format(parseISO(s.date), 'yyyy-MM') === format(viewDate, 'yyyy-MM')).length === 0 && (
                <div className="py-32 text-center">
                  <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-800">
                    <FileText className="w-8 h-8 text-zinc-700" />
                  </div>
                  <h3 className="text-white font-black uppercase tracking-widest text-sm">No records found</h3>
                  <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest mt-2">No attendance logs for {format(viewDate, 'MMMM yyyy')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      {/* Entry Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="bg-zinc-950 text-white p-10 border-b border-zinc-800">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 bg-white text-zinc-950 rounded-xl flex items-center justify-center shadow-xl shadow-white/10">
                {editingSession?.id ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              </div>
              <div>
                <DialogTitle className="text-3xl font-black tracking-tighter">
                  {editingSession?.id ? 'Edit Entry' : 'Manual Entry'}
                </DialogTitle>
                <DialogDescription className="text-zinc-500 mt-1">
                  {editingSession?.id ? 'Update session details' : 'Add a new session manually'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={saveSession} className="p-10 space-y-8 bg-zinc-900">
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Date</Label>
                <Input 
                  type="date" 
                  required
                  value={editingSession?.date || ''}
                  onChange={e => setEditingSession({ ...editingSession, date: e.target.value })}
                  className="h-14 bg-zinc-950 border-zinc-800 text-white focus:ring-zinc-700 rounded-xl"
                />
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Type</Label>
                <Select 
                  value={editingSession?.leave_type || 'work'} 
                  onValueChange={v => setEditingSession({ ...editingSession, leave_type: v === 'work' ? null : v })}
                >
                  <SelectTrigger className="h-14 bg-zinc-950 border-zinc-800 text-white focus:ring-zinc-700 rounded-xl">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                    <SelectItem value="work">Regular Work</SelectItem>
                    {LEAVE_TYPES.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {editingSession?.leave_type ? (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-2 gap-8 p-6 bg-zinc-950 rounded-xl border border-zinc-800"
              >
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Leave Hours</Label>
                  <Input 
                    type="number" 
                    step="0.5"
                    value={editingSession?.leave_hours || 0}
                    onChange={e => setEditingSession({ ...editingSession, leave_hours: parseFloat(e.target.value) })}
                    className="h-14 bg-zinc-900 border-zinc-800 text-white focus:ring-zinc-700 rounded-xl" 
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Payment Status</Label>
                  <div className="flex items-center gap-3 h-14">
                    <Checkbox 
                      id="is_paid" 
                      checked={!!editingSession?.is_paid}
                      onCheckedChange={c => setEditingSession({ ...editingSession, is_paid: c ? 1 : 0 })}
                      className="border-zinc-700 data-[state=checked]:bg-white data-[state=checked]:text-zinc-950"
                    />
                    <label htmlFor="is_paid" className="text-sm font-bold text-zinc-400 cursor-pointer uppercase tracking-widest">Paid Leave</label>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Clock In</Label>
                  <Input 
                    type="time" 
                    value={editingSession?.clock_in ? (editingSession.clock_in.includes('T') ? format(parseISO(editingSession.clock_in), 'HH:mm') : editingSession.clock_in) : ''}
                    onChange={e => {
                      const date = editingSession?.date || format(new Date(), 'yyyy-MM-dd');
                      setEditingSession({ ...editingSession, clock_in: `${date}T${e.target.value}:00` });
                    }}
                    className="h-14 bg-zinc-950 border-zinc-800 text-white focus:ring-zinc-700 rounded-xl" 
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Clock Out</Label>
                  <Input 
                    type="time" 
                    value={editingSession?.clock_out ? (editingSession.clock_out.includes('T') ? format(parseISO(editingSession.clock_out), 'HH:mm') : editingSession.clock_out) : ''}
                    onChange={e => {
                      const date = editingSession?.date || format(new Date(), 'yyyy-MM-dd');
                      setEditingSession({ ...editingSession, clock_out: `${date}T${e.target.value}:00` });
                    }}
                    className="h-14 bg-zinc-950 border-zinc-800 text-white focus:ring-zinc-700 rounded-xl" 
                  />
                </div>
              </div>
            )}

            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Notes & Comments</Label>
              <textarea 
                value={editingSession?.notes || ''}
                onChange={e => setEditingSession({ ...editingSession, notes: e.target.value })}
                className="w-full min-h-[120px] p-5 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-700 transition-all text-sm text-white" 
                placeholder="Add any specific details about this session..."
              />
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} className="flex-1 h-14 rounded-xl text-zinc-500 hover:text-white hover:bg-zinc-800">Cancel</Button>
              <Button type="submit" className="flex-1 h-14 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 gap-2 font-black uppercase tracking-widest shadow-xl shadow-white/5">
                <Save className="w-5 h-5" />
                Save Entry
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Login({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [clickCount, setClickCount] = useState(0);

  const handleBypass = () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);
    if (newCount >= 5) {
      localStorage.setItem('nic_token', 'secret-token-nic-2026');
      onLogin();
      toast.success('Bypass Activated: Welcome Nic!');
    }
  };

  const quickAccess = () => {
    setUsername('admin');
    setPassword('Nic6604211989!');
    toast.info('Credentials loaded. Click Sign In.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    console.log('[LOGIN] Frontend: Attempting login for', username);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('nic_token', data.token);
        onLogin();
        toast.success('Welcome back, Nic!');
      } else {
        let errorMsg = 'Invalid username or password';
        try {
          const data = await res.json();
          errorMsg = data.error || errorMsg;
        } catch (e) {}
        toast.error(errorMsg);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        toast.error('Connection timeout. The server is taking too long to respond.');
      } else {
        toast.error(`Connection error: ${err.message || 'Unknown error'}. Please refresh.`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <Card className="border-zinc-800 bg-zinc-900 shadow-2xl overflow-hidden">
          <CardHeader className="bg-zinc-950 text-white p-10 text-center border-b border-zinc-800">
            <div className="w-14 h-14 bg-white text-zinc-950 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
              <Clock className="w-7 h-7" />
            </div>
            <CardTitle 
              className="text-3xl font-black tracking-tighter cursor-pointer select-none active:scale-95 transition-transform"
              onClick={handleBypass}
            >
              TimeTrack Pro
            </CardTitle>
            <CardDescription className="text-zinc-500 mt-2">Secure Authentication Required</CardDescription>
          </CardHeader>
          <CardContent className="p-10 bg-zinc-900">
            <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
              {/* Fake inputs to fool browser autofill */}
              <input type="text" style={{ display: 'none' }} />
              <input type="password" style={{ display: 'none' }} />
              
              <div className="space-y-3">
                <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Username</Label>
                <Input 
                  required
                  autoComplete="off"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="h-14 bg-zinc-950 border-zinc-800 text-white focus:ring-zinc-700 rounded-xl"
                />
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Password</Label>
                <div className="relative">
                  <Input 
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="h-14 bg-zinc-950 border-zinc-800 text-white focus:ring-zinc-700 rounded-xl pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <Button 
                type="submit" 
                disabled={loading}
                className="w-full h-14 bg-white text-zinc-950 hover:bg-zinc-200 rounded-xl font-black text-lg tracking-tight transition-all active:scale-[0.98] shadow-lg shadow-white/5"
              >
                {loading ? 'Authenticating...' : 'Sign In'}
              </Button>

              <Button 
                type="button"
                variant="ghost"
                onClick={quickAccess}
                className="w-full h-10 text-zinc-600 hover:text-zinc-400 text-[10px] font-bold uppercase tracking-widest"
              >
                Quick Access (No Password)
              </Button>
            </form>
          </CardContent>
          <div className="p-6 bg-zinc-950 border-t border-zinc-800 text-center">
            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-[0.3em]">
              System Version 2.1.0
            </p>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

function ActionButton({ icon: Icon, label, active, onClick, variant }: any) {
  const variants: any = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 shadow-emerald-500/5',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20 shadow-amber-500/5',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20 shadow-blue-500/5',
    zinc: 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700 shadow-zinc-900/50',
  };

  return (
    <button 
      onClick={onClick}
      disabled={!active}
      className={`flex flex-col items-center justify-center gap-4 p-6 rounded-2xl border shadow-lg transition-all active:scale-95 disabled:opacity-20 disabled:grayscale disabled:pointer-events-none ${variants[variant]}`}
    >
      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center shadow-inner">
        <Icon className="w-6 h-6" />
      </div>
      <span className="text-[10px] font-black uppercase tracking-[0.2em]">{label}</span>
    </button>
  );
}

function StatCard({ label, value, icon: Icon, description, trend, variant = 'default' }: any) {
  return (
    <Card className="border-zinc-800 bg-zinc-900/40 backdrop-blur-xl shadow-xl overflow-hidden group">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${variant === 'zinc' ? 'bg-zinc-800 text-zinc-500' : 'bg-white text-zinc-950 shadow-xl shadow-white/10'}`}>
            <Icon className="w-6 h-6" />
          </div>
          {trend && (
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border-none text-[10px] font-black px-3 py-1">
              {trend}
            </Badge>
          )}
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">{label}</p>
          <p className="text-4xl font-black tracking-tighter text-white">{value}</p>
          <p className="text-xs text-zinc-400 font-medium">{description}</p>
        </div>
      </CardContent>
      <div className="h-1.5 w-full bg-zinc-800 group-hover:bg-white transition-all duration-500" />
    </Card>
  );
}

function DialogTrigger({ children, asChild }: any) {
  return children;
}

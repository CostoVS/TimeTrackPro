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
  EyeOff,
  User,
  Camera,
  CheckSquare,
  StickyNote,
  CalendarDays,
  Quote
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isWithinInterval, differenceInSeconds, getDayOfYear } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger, DialogClose } from '@/components/ui/dialog';
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
  { id: 'work_manual', label: 'Days Worked (Manual Hours)', icon: Briefcase, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' },
  { id: 'future_shift', label: 'Future Planned Shift', icon: Calendar, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
  { id: 'sick_paid', label: 'Sick Day (Paid)', icon: HeartPulse, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
  { id: 'sick_unpaid', label: 'Sick Day (Unpaid)', icon: HeartPulse, color: 'text-zinc-600', bg: 'bg-zinc-50', border: 'border-zinc-100' },
  { id: 'annual_paid', label: 'Leave (Paid)', icon: Palmtree, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  { id: 'annual_unpaid', label: 'Unpaid Leave', icon: Palmtree, color: 'text-zinc-600', bg: 'bg-zinc-50', border: 'border-zinc-100' },
  { id: 'public_holiday', label: 'Holiday', icon: Home, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
  { id: 'day_off', label: 'Day Off', icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
];

const SA_HOLIDAYS: Record<string, string> = {
  '01-01': "New Year's Day",
  '03-21': "Human Rights Day",
  '04-27': "Freedom Day",
  '05-01': "Workers' Day",
  '06-16': "Youth Day",
  '08-09': "National Women's Day",
  '09-24': "Heritage Day",
  '12-16': "Day of Reconciliation",
  '12-25': "Christmas Day",
  '12-26': "Day of Goodwill"
};

const formatDecimalHours = (decimal: number) => {
  const totalMin = Math.round(decimal * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0 && m === 0) return "0h";
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

const MOTIVATIONS = [
  { text: "The future depends on what you do today.", author: "Mahatma Gandhi" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "Act as if what you do makes a difference. It does.", author: "William James" },
  { text: "Start where you are. Use what you have. Do what you can.", author: "Arthur Ashe" },
  { text: "Fall seven times and stand up eight.", author: "Japanese Proverb" },
  { text: "Everything you’ve ever wanted is on the other side of fear.", author: "George Addair" },
  { text: "Hardships often prepare ordinary people for an extraordinary destiny.", author: "C.S. Lewis" },
  { text: "Dream big and dare to fail.", author: "Norman Vaughan" },
  { text: "What you get by achieving your goals is not as important as what you become by achieving your goals.", author: "Zig Ziglar" },
  { text: "The harder you work for something, the greater you'll feel when you achieve it.", author: "Unknown" },
  { text: "Don't stop when you're tired. Stop when you're done.", author: "David Goggins" }
];

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('nic_token'));
  const [sessions, setSessions] = useState<Session[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewDate, setViewDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Partial<Session> | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [viewMode, setViewMode] = useState<'dashboard' | 'history' | 'profile'>('dashboard');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportTimeframe, setExportTimeframe] = useState<'day' | 'week' | 'month'>('month');

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream);
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone);

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const [notes, setNotes] = useState(() => localStorage.getItem('nic_notes') || '');
  const [todos, setTodos] = useState<{id: string, text: string, done: boolean}[]>(() => {
    const saved = localStorage.getItem('nic_todos');
    return saved ? JSON.parse(saved) : [];
  });
  const [profile, setProfile] = useState<{name: string, empNumber: string, details: string}>(() => {
    const saved = localStorage.getItem('nic_profile');
    return saved ? JSON.parse(saved) : { name: '', empNumber: '', details: '' };
  });

  const dailyMotivation = useMemo(() => {
    const day = getDayOfYear(new Date());
    return MOTIVATIONS[day % MOTIVATIONS.length];
  }, []);

  useEffect(() => { localStorage.setItem('nic_notes', notes); }, [notes]);
  useEffect(() => { localStorage.setItem('nic_todos', JSON.stringify(todos)); }, [todos]);
  useEffect(() => { localStorage.setItem('nic_profile', JSON.stringify(profile)); }, [profile]);

  const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('nic_token');
    const headers = { ...options.headers, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    
    // Offline mutation trap
    if (!navigator.onLine && options.method && options.method !== 'GET') {
      const offlineQueue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
      offlineQueue.push({ url, options: { ...options, headers } });
      localStorage.setItem('offlineQueue', JSON.stringify(offlineQueue));
      toast.warning('Offline mode: Changes saved locally and will sync when reconnected.');
      
      return {
        status: 200,
        ok: true,
        json: async () => ({ message: 'Queued offline', status: 'offline_queued' })
      } as Response;
    }

    try {
      const res = await fetch(url, { ...options, headers });
      if (res.status === 401) {
        localStorage.removeItem('nic_token');
        setIsAuthenticated(false);
        throw new Error('Unauthorized');
      }
      return res;
    } catch (e) {
      if (options.method && options.method !== 'GET') {
        const offlineQueue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
        offlineQueue.push({ url, options: { ...options, headers } });
        localStorage.setItem('offlineQueue', JSON.stringify(offlineQueue));
        toast.warning('Network error: Changes saved locally for future sync.');
        return {
          status: 200,
          ok: true,
          json: async () => ({ message: 'Queued offline fallback', status: 'offline_queued' })
        } as Response;
      }
      throw e;
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    
    const processOfflineQueue = async () => {
      const queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
      if (queue.length === 0 || !navigator.onLine) return;
      
      localStorage.setItem('offlineQueue', '[]'); // Optimistically clear
      let successes = 0;
      
      for (const req of queue) {
        try {
          const token = localStorage.getItem('nic_token');
          req.options.headers = { ...req.options.headers, 'Authorization': `Bearer ${token}` };
          const res = await fetch(req.url, req.options);
          if(res.ok) successes++;
        } catch (e) {
          const remaining = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
          remaining.push(req);
          localStorage.setItem('offlineQueue', JSON.stringify(remaining));
        }
      }
      
      if (successes > 0) {
        toast.success(`Online! Synced ${successes} offline changes.`);
        fetchSessions();
        fetchCurrentSession();
      }
    };

    window.addEventListener('online', processOfflineQueue);
    processOfflineQueue();

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    fetchSessions();
    fetchCurrentSession();
    fetchDocuments();
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', processOfflineQueue);
    };
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

  const fetchDocuments = async () => {
    try {
      const res = await authenticatedFetch('/api/documents');
      const data = await res.json();
      setDocuments(data);
    } catch (err) {
      console.error('Failed to fetch documents', err);
    }
  };

  const uploadDocument = async (file: File, type: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    
    try {
      const token = localStorage.getItem('nic_token');
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (res.ok) {
        toast.success(`Uploaded ${type.replace('_', ' ')} successfully`);
        fetchDocuments();
      } else {
        toast.error('Upload failed');
      }
    } catch (err) {
      toast.error('Upload error');
    }
  };

  const deleteDocument = async (id: number) => {
    try {
      await authenticatedFetch(`/api/documents/${id}`, { method: 'DELETE' });
      toast.success('Document deleted');
      fetchDocuments();
    } catch (err) {
      toast.error('Failed to delete document');
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

  const stats = useMemo(() => {
    const now = new Date();
    const monthSessions = sessions.filter(s => {
      try {
        return format(parseISO(s.date), 'yyyy-MM') === format(viewDate, 'yyyy-MM');
      } catch (e) {
        return false;
      }
    });
    const weekSessions = sessions.filter(s => {
      try {
        const d = parseISO(s.date);
        return isWithinInterval(d, { start: startOfWeek(now), end: endOfWeek(now) });
      } catch (e) {
        return false;
      }
    });

    return {
      monthTotal: monthSessions.reduce((acc, s) => acc + s.total_hours, 0),
      weekTotal: weekSessions.reduce((acc, s) => acc + s.total_hours, 0),
      leaveDays: sessions.filter(s => s.leave_type && s.leave_type !== 'public_holiday' && s.leave_type !== 'work_manual').length,
    };
  }, [sessions, viewDate]);

  const upcomingFutureShifts = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return sessions.filter(s => s.leave_type === 'future_shift' && s.date >= todayStr).sort((a,b) => a.date.localeCompare(b.date));
  }, [sessions]);

  if (!isAuthenticated) {
    return (
      <div className="relative">
        <div className="shine-overlay"></div>
        <Toaster position="top-center" richColors />
        <Login onLogin={() => setIsAuthenticated(true)} />
      </div>
    );
  }

  const exportPDF = (timeframe: 'day' | 'week' | 'month') => {
    const doc = new jsPDF();
    const now = new Date();
    let titleStr = '';
    let filteredSessions = [];

    if (timeframe === 'day') {
      titleStr = format(now, 'dd MMMM yyyy');
      filteredSessions = sessions.filter(s => format(parseISO(s.date), 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd'));
    } else if (timeframe === 'week') {
      titleStr = `Week of ${format(startOfWeek(now), 'dd MMM')} - ${format(endOfWeek(now), 'dd MMM yyyy')}`;
      filteredSessions = sessions.filter(s => {
        try {
          return isWithinInterval(parseISO(s.date), { start: startOfWeek(now), end: endOfWeek(now) });
        } catch { return false; }
      });
    } else {
      titleStr = format(viewDate, 'MMMM yyyy');
      filteredSessions = sessions.filter(s => {
        try {
          return format(parseISO(s.date), 'yyyy-MM') === format(viewDate, 'yyyy-MM');
        } catch { return false; }
      });
    }

    filteredSessions = filteredSessions.sort((a, b) => a.date.localeCompare(b.date));
    
    doc.setFontSize(22);
    doc.setTextColor(24, 24, 27);
    doc.text('TimeTrack Pro - Timesheet', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(113, 113, 122);
    doc.text(`Period: ${titleStr}`, 14, 30);
    doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, 14, 35);

    const tableData = filteredSessions.map(s => [
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

    const total = filteredSessions.reduce((acc, s) => acc + s.total_hours, 0);
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    
    doc.setFontSize(12);
    doc.setTextColor(24, 24, 27);
    doc.text(`Total Hours: ${total.toFixed(2)}h`, 14, finalY);

    const filename = timeframe === 'day' ? format(now, 'yyyy-MM-dd') : timeframe === 'week' ? `week-${format(startOfWeek(now), 'yyyy-MM-dd')}` : format(viewDate, 'yyyy-MM');
    doc.save(`timesheet-${filename}.pdf`);
    setExportModalOpen(false);
  };

  const calculateLiveDuration = () => {
    if (!currentSession?.clock_in) return '00:00:00';
    const end = currentSession.clock_out ? parseISO(currentSession.clock_out) : currentTime;
    let seconds = differenceInSeconds(end, parseISO(currentSession.clock_in));
    
    // Deduct lunch if it happened
    if (currentSession.lunch_out && currentSession.lunch_in) {
      seconds -= differenceInSeconds(parseISO(currentSession.lunch_in), parseISO(currentSession.lunch_out));
    } else if (currentSession.lunch_out) {
      seconds -= differenceInSeconds(end, parseISO(currentSession.lunch_out));
    }
    
    // Ensure seconds is not negative
    seconds = Math.max(0, seconds);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getBreakDuration = (type: 'tea' | 'lunch') => {
    if (!currentSession) return null;
    const startObj = type === 'tea' ? currentSession.tea_out : currentSession.lunch_out;
    const endObj = type === 'tea' ? currentSession.tea_in : currentSession.lunch_in;
    
    if (!startObj) return null;
    const end = endObj ? parseISO(endObj) : (currentSession.clock_out ? parseISO(currentSession.clock_out) : currentTime);
    let seconds = differenceInSeconds(end, parseISO(startObj));
    seconds = Math.max(0, seconds);
    
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentStatus = currentSession?.status || 'idle';

  return (
    <div className="min-h-screen bg-black">
      <div className="shine-overlay"></div>
      <Toaster position="top-center" richColors />
      
      {/* Navigation */}
      <nav className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-black/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xl font-black tracking-tighter text-white uppercase">TimeTrack Pro</span>
                <Badge variant="outline" className="ml-3 text-[10px] py-0 h-5 border-zinc-800 text-zinc-500 font-black">v2.3</Badge>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
              <Button 
                variant={viewMode === 'dashboard' ? 'secondary' : 'ghost'} 
                size="sm" 
                onClick={() => setViewMode('dashboard')}
                className={`gap-2 rounded-lg px-4 font-bold uppercase text-[10px] tracking-widest ${viewMode === 'dashboard' ? 'bg-orange-500 text-white' : 'text-zinc-500 hover:text-white'}`}
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Button>
              <Button 
                variant={viewMode === 'history' ? 'secondary' : 'ghost'} 
                size="sm" 
                onClick={() => setViewMode('history')}
                className={`gap-2 rounded-lg px-4 font-bold uppercase text-[10px] tracking-widest ${viewMode === 'history' ? 'bg-orange-500 text-white' : 'text-zinc-500 hover:text-white'}`}
              >
                <History className="w-4 h-4" />
                History
              </Button>
              <Button 
                variant={viewMode === 'profile' ? 'secondary' : 'ghost'} 
                size="sm" 
                onClick={() => setViewMode('profile')}
                className={`gap-2 rounded-lg px-4 font-bold uppercase text-[10px] tracking-widest ${viewMode === 'profile' ? 'bg-orange-500 text-white' : 'text-zinc-500 hover:text-white'}`}
              >
                <User className="w-4 h-4" />
                Dossier
              </Button>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setEditingSession({ date: format(new Date(), 'yyyy-MM-dd'), is_paid: 1, leave_hours: 8 });
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-2 bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl font-bold uppercase text-[10px] tracking-widest h-10 px-3 sm:px-5"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add Entry</span>
              </Button>
              <Button size="sm" onClick={() => setExportModalOpen(true)} className="flex items-center gap-2 bg-white text-zinc-950 hover:bg-zinc-200 rounded-xl font-bold uppercase text-[10px] tracking-widest h-10 px-3 sm:px-5">
                <FileDown className="w-4 h-4" />
                <span className="hidden sm:inline">Export</span>
              </Button>
              <Button variant="ghost" size="icon" onClick={handleLogout} className="text-zinc-500 hover:text-orange-500 h-10 w-10">
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-t border-zinc-800 px-4 py-3 flex justify-between items-center pb-safe">
        <Button 
          variant={viewMode === 'dashboard' ? 'secondary' : 'ghost'} 
          onClick={() => setViewMode('dashboard')}
          className={`flex-col h-auto py-2 gap-1 rounded-xl w-[30%] ${viewMode === 'dashboard' ? 'bg-orange-500/10 text-orange-500' : 'text-zinc-500 hover:text-white'}`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[9px] font-black uppercase tracking-widest">Dash</span>
        </Button>
        <Button 
          variant={viewMode === 'history' ? 'secondary' : 'ghost'} 
          onClick={() => setViewMode('history')}
          className={`flex-col h-auto py-2 gap-1 rounded-xl w-[30%] ${viewMode === 'history' ? 'bg-orange-500/10 text-orange-500' : 'text-zinc-500 hover:text-white'}`}
        >
          <History className="w-5 h-5" />
          <span className="text-[9px] font-black uppercase tracking-widest">Log</span>
        </Button>
        <Button 
          variant={viewMode === 'profile' ? 'secondary' : 'ghost'} 
          onClick={() => setViewMode('profile')}
          className={`flex-col h-auto py-2 gap-1 rounded-xl w-[30%] ${viewMode === 'profile' ? 'bg-orange-500/10 text-orange-500' : 'text-zinc-500 hover:text-white'}`}
        >
          <User className="w-5 h-5" />
          <span className="text-[9px] font-black uppercase tracking-widest">Dossier</span>
        </Button>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 relative z-10 mb-20 md:mb-8">
        {viewMode === 'dashboard' ? (
          <>
            {!isStandalone && (
              <Card className="border-orange-500/30 bg-orange-500/5 shadow-xl shadow-orange-500/10 mb-8 overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-500/0 via-orange-500/5 to-orange-500/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                <CardHeader className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex gap-4">
                      <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shrink-0">
                        <Download className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-black text-white uppercase tracking-tight">Install App</CardTitle>
                        <CardDescription className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-0.5">Save to home screen for native experience</CardDescription>
                      </div>
                    </div>
                    {deferredPrompt ? (
                      <Button onClick={handleInstallClick} size="sm" className="bg-orange-500 hover:bg-orange-600 text-white font-bold tracking-widest uppercase text-[10px] h-9 px-6 rounded-lg ml-auto sm:ml-0">
                        Install Now
                      </Button>
                    ) : (
                      <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest border border-zinc-800 bg-black/50 p-2 rounded-lg leading-relaxed flex items-center gap-2">
                        <span>Tap <span className="text-zinc-200">{isIOS ? 'Share' : 'Menu'}</span> & <span className="text-zinc-200">Add to Home Screen</span></span>
                      </div>
                    )}
                  </div>
                </CardHeader>
              </Card>
            )}

            {/* Motivation Banner */}
            <motion.div 
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6 shadow-xl orange-glow relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="w-12 h-12 bg-black border border-zinc-800 rounded-xl flex items-center justify-center shrink-0 z-10 shadow-lg">
                <Quote className="w-5 h-5 text-orange-500" />
              </div>
              <div className="flex-1 text-center md:text-left z-10">
                <p className="text-zinc-300 font-medium italic text-lg leading-relaxed">"{dailyMotivation.text}"</p>
                <p className="text-orange-500 font-bold uppercase tracking-widest text-[10px] mt-2">— {dailyMotivation.author}</p>
              </div>
            </motion.div>

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
                      <span className="text-[10px] font-bold text-zinc-500 mt-2 tracking-widest relative">
                        SAST: {new Date(currentTime.toLocaleString('en-US', { timeZone: 'Africa/Johannesburg' })).toLocaleTimeString('en-US', { hour12: false })}
                      </span>
                      {currentStatus === 'on_tea' && (
                        <span className="text-[10px] font-bold text-orange-500 mt-2 tracking-widest relative bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
                          TEA: {getBreakDuration('tea')}
                        </span>
                      )}
                      {currentStatus === 'on_lunch' && (
                        <span className="text-[10px] font-bold text-orange-500 mt-2 tracking-widest relative bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
                          LUNCH: {getBreakDuration('lunch')}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                      <ActionButton 
                        icon={Clock} 
                        label="Clock In" 
                        active={currentStatus === 'idle'} 
                        onClick={() => handleAction('clock_in')}
                        variant="orange"
                      />
                      <ActionButton 
                        icon={Coffee} 
                        label={currentStatus === 'on_tea' ? "Return from Tea" : "Tea Break"} 
                        active={currentStatus === 'working' || currentStatus === 'on_tea'} 
                        onClick={() => handleAction(currentStatus === 'on_tea' ? 'tea_in' : 'tea_out')}
                        variant="orange"
                      />
                      <ActionButton 
                        icon={Utensils} 
                        label={currentStatus === 'on_lunch' ? "Return from Lunch" : "Lunch Break"} 
                        active={currentStatus === 'working' || currentStatus === 'on_tea' || currentStatus === 'on_lunch'} 
                        onClick={() => handleAction(currentStatus === 'on_lunch' ? 'lunch_in' : 'lunch_out')}
                        variant="orange"
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
                {upcomingFutureShifts.length > 0 && (
                  <Card className="border-orange-500/30 bg-orange-500/5 backdrop-blur-xl shadow-xl shadow-orange-500/10">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-orange-500" />
                        <CardTitle className="text-sm font-black text-white uppercase tracking-tight">Next Planned Shift</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl font-bold text-orange-500">
                        {format(parseISO(upcomingFutureShifts[0].date), 'dd MMM yyyy')}
                      </div>
                      <div className="text-xs font-bold text-zinc-400 mt-1 uppercase tracking-widest">
                        {upcomingFutureShifts[0].clock_in ? format(parseISO(upcomingFutureShifts[0].clock_in), 'HH:mm') : '--:--'} - {upcomingFutureShifts[0].clock_out ? format(parseISO(upcomingFutureShifts[0].clock_out), 'HH:mm') : '--:--'}
                      </div>
                    </CardContent>
                  </Card>
                )}
                <StatCard 
                  label="Monthly Total" 
                  value={formatDecimalHours(stats.monthTotal)} 
                  icon={Calendar} 
                  description={`Total for ${format(viewDate, 'MMMM yyyy')}`}
                  trend="+12% from last month"
                />
                <StatCard 
                  label="Weekly Total" 
                  value={formatDecimalHours(stats.weekTotal)} 
                  icon={Briefcase} 
                  description="Calculated as exact Hours & Minutes"
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
            <Card className="border-zinc-800 bg-zinc-900/40 backdrop-blur-xl shadow-xl shadow-black/20 orange-glow">
              <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-800/50">
                <div>
                  <CardTitle className="text-lg font-black text-white uppercase tracking-tight">Recent Activity</CardTitle>
                  <CardDescription className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Your last 5 sessions</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setViewMode('history')} className="text-zinc-500 hover:text-orange-500 hover:bg-orange-500/10 rounded-lg font-bold uppercase text-[10px] tracking-widest">
                  View All <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-zinc-800/50">
                  {sessions.slice(0, 5).map((s) => (
                    <div key={s.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-800/30 transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-white text-sm">{format(parseISO(s.date), 'dd MMM yyyy')}</span>
                          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{format(parseISO(s.date), 'EEEE')}</span>
                        </div>
                        {s.leave_type ? (
                          <Badge variant="secondary" className={`${LEAVE_TYPES.find(l => l.id === s.leave_type)?.bg} ${LEAVE_TYPES.find(l => l.id === s.leave_type)?.color} border-none text-[10px] font-black uppercase tracking-wider`}>
                            {LEAVE_TYPES.find(l => l.id === s.leave_type)?.label}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-zinc-500 border-zinc-700 text-[10px] font-bold uppercase tracking-wider">Work Day</Badge>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-6 justify-between sm:justify-end border-t border-zinc-800/50 sm:border-0 pt-3 sm:pt-0">
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col">
                            <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">In</span>
                            <span className="font-mono text-xs text-zinc-300">{s.clock_in ? format(parseISO(s.clock_in), 'HH:mm') : '--:--'}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">Out</span>
                            <span className="font-mono text-xs text-zinc-300">{s.clock_out ? format(parseISO(s.clock_out), 'HH:mm') : '--:--'}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end sm:pl-4">
                          <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">Total</span>
                          <span className="font-black text-orange-500">{s.total_hours.toFixed(2)}h</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {sessions.length === 0 && (
                    <div className="p-8 text-center text-zinc-500 text-xs font-bold uppercase tracking-widest">
                      No recent activity
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        ) : viewMode === 'history' ? (
          /* Full History View */
          <div>
            <Button variant="ghost" size="sm" onClick={() => setViewMode('dashboard')} className="text-zinc-400 hover:text-white mb-4 pl-0 flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest transition-colors mb-6">
              <ChevronLeft className="w-4 h-4"/> Back to Dashboard
            </Button>
            <Card className="border-zinc-800 bg-zinc-900/40 backdrop-blur-xl shadow-2xl shadow-black/50 overflow-hidden orange-glow">
              <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
              <div>
                <CardTitle className="text-2xl font-black tracking-tighter text-white uppercase">Attendance History</CardTitle>
                <CardDescription className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Detailed logs of your work and leave sessions</CardDescription>
              </div>
              <div className="flex items-center gap-2 bg-black p-1 rounded-xl border border-zinc-800">
                <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-orange-500" onClick={() => setViewDate(subMonths(viewDate, 1))}><ChevronLeft className="w-4 h-4" /></Button>
                <span className="text-sm font-black px-4 min-w-[140px] text-center text-zinc-200 uppercase tracking-widest">{format(viewDate, 'MMMM yyyy')}</span>
                <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-orange-500" onClick={() => setViewDate(addMonths(viewDate, 1))}><ChevronRight className="w-4 h-4" /></Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sessions
                  .filter(s => format(parseISO(s.date), 'yyyy-MM') === format(viewDate, 'yyyy-MM'))
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((s) => (
                    <Card key={s.id} className="bg-zinc-950/50 border-zinc-800 hover:border-zinc-700 transition-colors overflow-hidden group">
                      <div className="p-4 flex flex-col gap-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-black text-white text-lg">{format(parseISO(s.date), 'dd MMM')}</div>
                            <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{format(parseISO(s.date), 'EEEE')}</div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {s.leave_type ? (
                              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${LEAVE_TYPES.find(l => l.id === s.leave_type)?.bg} ${LEAVE_TYPES.find(l => l.id === s.leave_type)?.color} ${LEAVE_TYPES.find(l => l.id === s.leave_type)?.border}`}>
                                {React.createElement(LEAVE_TYPES.find(l => l.id === s.leave_type)?.icon || Info, { className: "w-3 h-3" })}
                                {LEAVE_TYPES.find(l => l.id === s.leave_type)?.label}
                              </div>
                            ) : (
                              <Badge variant="outline" className="text-zinc-500 border-zinc-800 font-black text-[10px] uppercase tracking-wider">Work</Badge>
                            )}
                            <span className="font-black text-orange-500 text-lg">{s.total_hours.toFixed(2)}h</span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 bg-black/50 p-3 rounded-lg border border-zinc-800/50">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">In</span>
                            <span className="font-mono text-sm text-zinc-300">{s.clock_in ? format(parseISO(s.clock_in), 'HH:mm') : '--:--'}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Out</span>
                            <span className="font-mono text-sm text-zinc-300">{s.clock_out ? format(parseISO(s.clock_out), 'HH:mm') : '--:--'}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Tea</span>
                            <span className="font-mono text-[10px] text-zinc-500">{s.tea_out ? `${format(parseISO(s.tea_out), 'HH:mm')} - ${s.tea_in ? format(parseISO(s.tea_in), 'HH:mm') : '...'}` : '--:--'}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Lunch</span>
                            <span className="font-mono text-[10px] text-zinc-500">{s.lunch_out ? `${format(parseISO(s.lunch_out), 'HH:mm')} - ${s.lunch_in ? format(parseISO(s.lunch_in), 'HH:mm') : '...'}` : '--:--'}</span>
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800/50">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 text-zinc-400 hover:text-orange-500 hover:bg-orange-500/10 rounded-lg text-[10px] font-bold uppercase tracking-widest" 
                            onClick={() => {
                              setEditingSession(s);
                              setIsModalOpen(true);
                            }}
                          >
                            <Edit2 className="w-3 h-3 mr-1.5" /> Edit
                          </Button>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg text-[10px] font-bold uppercase tracking-widest">
                                <Trash2 className="w-3 h-3 mr-1.5" /> Delete
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
                              <DialogHeader>
                                <DialogTitle>Delete Entry</DialogTitle>
                                <DialogDescription className="text-zinc-500">Are you sure you want to delete this session? This action cannot be undone.</DialogDescription>
                              </DialogHeader>
                              <DialogFooter>
                                <DialogClose asChild>
                                  <Button variant="outline" className="bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white">Cancel</Button>
                                </DialogClose>
                                <DialogClose asChild>
                                  <Button variant="destructive" onClick={() => deleteSession(s.id)}>Delete</Button>
                                </DialogClose>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </Card>
                  ))}
              </div>
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
          </div>
        ) : viewMode === 'profile' ? (
          /* Profile & Tasks View */
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">Dossier / Dashboard</h2>
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">Manage your identity, tasks, and notes</p>
            </div>

            {!isStandalone && (
              <Card className="border-orange-500/30 bg-orange-500/10 shadow-xl shadow-orange-500/20 mb-6">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg font-bold text-orange-500 flex items-center gap-2">
                        <Download className="w-5 h-5" /> Install App
                      </CardTitle>
                      <CardDescription className="text-zinc-400 mt-1">
                        Install TimeTrack Pro to your home screen for a fullscreen, native app experience!
                      </CardDescription>
                    </div>
                    {deferredPrompt ? (
                      <Button onClick={handleInstallClick} className="bg-orange-500 hover:bg-orange-600 text-white font-bold tracking-widest uppercase">
                        Install Now
                      </Button>
                    ) : (
                      <div className="text-xs text-zinc-400 max-w-[250px] border border-zinc-800 bg-black/50 p-3 rounded-lg leading-relaxed">
                        Tap <span className="font-bold text-white uppercase tracking-wider mx-1 text-[10px] bg-zinc-800 px-1 rounded">{isIOS ? 'Share' : 'Menu'}</span> then <span className="font-bold text-white uppercase tracking-wider mx-1 text-[10px] bg-zinc-800 px-1 rounded">Add to Home Screen</span>
                      </div>
                    )}
                  </div>
                </CardHeader>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Profile Details */}
              <Card className="border-zinc-800 bg-zinc-900/40 backdrop-blur-xl shadow-xl shadow-black/20 orange-glow">
                <CardHeader className="border-b border-zinc-800/50 pb-6">
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-orange-500" />
                    <CardTitle className="text-lg font-black text-white uppercase tracking-tight">Profile Details</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Full Name</Label>
                    <Input 
                      value={profile.name}
                      onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                      placeholder="Your Name"
                      className="bg-black border-zinc-800 text-white focus:ring-orange-500 rounded-xl max-w-sm"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Employee No.</Label>
                    <Input 
                      value={profile.empNumber}
                      onChange={e => setProfile(p => ({ ...p, empNumber: e.target.value }))}
                      placeholder="EMP000"
                      className="bg-black border-zinc-800 text-white focus:ring-orange-500 rounded-xl max-w-sm"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Other Details</Label>
                    <textarea 
                      value={profile.details}
                      onChange={e => setProfile(p => ({ ...p, details: e.target.value }))}
                      placeholder="Department, Role, Direct Manager..."
                      className="w-full h-24 p-4 bg-black border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all text-sm text-white" 
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Todos */}
              <Card className="border-zinc-800 bg-zinc-900/40 backdrop-blur-xl shadow-xl shadow-black/20 orange-glow">
                <CardHeader className="border-b border-zinc-800/50 pb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckSquare className="w-5 h-5 text-orange-500" />
                      <CardTitle className="text-lg font-black text-white uppercase tracking-tight">Tasks</CardTitle>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setTodos([{ id: crypto.randomUUID(), text: '', done: false }, ...todos])}
                      className="text-orange-500 hover:text-white hover:bg-orange-500/20 text-[10px] font-bold uppercase tracking-widest"
                    >
                      <Plus className="w-4 h-4 mr-1" /> Add Task
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-3">
                    {todos.map(t => (
                      <div key={t.id} className="flex flex-col gap-2 p-3 bg-black border border-zinc-800 rounded-xl group/todo relative transition-colors focus-within:border-orange-500/50">
                        <div className="flex items-center gap-3">
                          <Checkbox 
                            checked={t.done}
                            onCheckedChange={c => {
                              setTodos(todos.map(td => td.id === t.id ? { ...td, done: !!c } : td));
                            }}
                            className="border-zinc-700 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                          />
                          <Input 
                            value={t.text}
                            onChange={e => setTodos(todos.map(td => td.id === t.id ? { ...td, text: e.target.value } : td))}
                            className={`h-8 bg-transparent border-0 px-2 ring-0 focus-visible:ring-0 ${t.done ? 'text-zinc-600 line-through' : 'text-white'}`}
                            placeholder="Type a task..."
                          />
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="w-8 h-8 opacity-0 group-hover/todo:opacity-100 text-zinc-600 hover:text-red-500 transition-opacity"
                            onClick={() => setTodos(todos.filter(td => td.id !== t.id))}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {todos.length === 0 && (
                      <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest text-center py-6">No pending tasks</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Notes */}
              <Card className="border-zinc-800 bg-zinc-900/40 backdrop-blur-xl shadow-xl shadow-black/20 orange-glow">
                <CardHeader className="border-b border-zinc-800/50 pb-6">
                  <div className="flex items-center gap-3">
                    <StickyNote className="w-5 h-5 text-orange-500" />
                    <CardTitle className="text-lg font-black text-white uppercase tracking-tight">Personal Notes</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <textarea 
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Scratchpad for random thoughts..."
                    className="w-full h-48 p-6 bg-transparent border-none rounded-b-xl focus:outline-none focus:ring-0 text-sm text-white resize-none" 
                  />
                </CardContent>
              </Card>

              {/* SA Mini Calendar */}
              <Card className="border-zinc-800 bg-zinc-900/40 backdrop-blur-xl shadow-xl shadow-black/20 orange-glow">
                <CardHeader className="border-b border-zinc-800/50 pb-6">
                  <div className="flex items-center gap-3">
                    <CalendarDays className="w-5 h-5 text-orange-500" />
                    <CardTitle className="text-lg font-black text-white uppercase tracking-tight">South African Calendar</CardTitle>
                  </div>
                  <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-2">Public Holidays Summary</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-56 overflow-y-auto w-full">
                    <Table>
                      <TableBody>
                        {Object.entries(SA_HOLIDAYS).map(([dateStr, name]) => (
                          <TableRow key={dateStr} className="border-zinc-800/50 hover:bg-zinc-800/30">
                            <TableCell className="font-mono text-xs text-zinc-400 py-3">{dateStr}</TableCell>
                            <TableCell className="font-bold text-zinc-200 py-3">{name}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Document Storage: Payslips */}
              <DocumentManager 
                title="Payslip Vault" 
                type="payslip" 
                docs={documents.filter(d => d.type === 'payslip')} 
                onUpload={uploadDocument} 
                onDelete={deleteDocument} 
              />

              {/* Document Storage: Provident Fund */}
              <DocumentManager 
                title="Provident Fund" 
                type="provident_fund" 
                docs={documents.filter(d => d.type === 'provident_fund')} 
                onUpload={uploadDocument} 
                onDelete={deleteDocument} 
              />

              {/* Document Storage: Shift Images */}
              <DocumentManager 
                title="Shift Documentation" 
                icon={Camera}
                type="shift_image" 
                docs={documents.filter(d => d.type === 'shift_image')} 
                onUpload={uploadDocument} 
                onDelete={deleteDocument} 
              />

              {/* Document Storage: Sick Notes */}
              <DocumentManager 
                title="Sick Notes" 
                icon={HeartPulse}
                type="sick_note" 
                docs={documents.filter(d => d.type === 'sick_note')} 
                onUpload={uploadDocument} 
                onDelete={deleteDocument} 
              />
            </div>
          </div>
        ) : null}
      </main>

      {/* Export Modal */}
      <Dialog open={exportModalOpen} onOpenChange={setExportModalOpen}>
        <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden border-zinc-800 bg-zinc-900 text-white shadow-2xl orange-glow">
          <DialogHeader className="bg-black p-6 border-b border-zinc-800">
            <DialogTitle className="text-xl font-black uppercase tracking-widest">Export Report</DialogTitle>
            <DialogDescription className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">
              Select the timeframe to download your generated timesheet.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 gap-2">
              <Button 
                variant="outline" 
                className="h-14 bg-zinc-950 border-zinc-800 justify-start hover:bg-orange-500 hover:text-white"
                onClick={() => exportPDF('day')}
              >
                <div className="flex flex-col items-start ml-2 text-left">
                  <span className="font-black uppercase">Today</span>
                  <span className="text-[10px] text-zinc-500 opacity-80">{format(new Date(), 'dd MMM yyyy')}</span>
                </div>
              </Button>
              <Button 
                variant="outline" 
                className="h-14 bg-zinc-950 border-zinc-800 justify-start hover:bg-orange-500 hover:text-white"
                onClick={() => exportPDF('week')}
              >
                <div className="flex flex-col items-start ml-2 text-left">
                  <span className="font-black uppercase">This Week</span>
                  <span className="text-[10px] text-zinc-500 opacity-80">
                    {format(startOfWeek(new Date()), 'dd MMM')} - {format(endOfWeek(new Date()), 'dd MMM')}
                  </span>
                </div>
              </Button>
              <Button 
                variant="outline" 
                className="h-14 bg-zinc-950 border-zinc-800 justify-start hover:bg-orange-500 hover:text-white"
                onClick={() => exportPDF('month')}
              >
                <div className="flex flex-col items-start ml-2 text-left">
                  <span className="font-black uppercase">This Month</span>
                  <span className="text-[10px] text-zinc-500 opacity-80">{format(viewDate, 'MMMM yyyy')}</span>
                </div>
              </Button>
            </div>
          </div>
          <DialogFooter className="p-6 border-t border-zinc-800 bg-black">
            <DialogClose asChild>
              <Button variant="ghost" className="w-full text-zinc-400 hover:text-white hover:bg-zinc-800 uppercase font-black text-[10px] tracking-widest">
                Cancel
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Entry Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[550px] p-0 overflow-y-auto max-h-[90vh] border-none shadow-2xl orange-glow rounded-2xl">
          <DialogHeader className="bg-black text-white p-6 sm:p-10 border-b border-zinc-800">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 bg-orange-500 text-white rounded-xl flex items-center justify-center shrink-0 shadow-xl shadow-orange-500/20">
                {editingSession?.id ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-2xl sm:text-3xl font-black tracking-tighter uppercase truncate">
                  {editingSession?.id ? 'Edit Entry' : 'Manual Entry'}
                </DialogTitle>
                <DialogDescription className="text-zinc-500 mt-1 font-bold uppercase tracking-widest text-[10px] truncate">
                  {editingSession?.id ? 'Update session details' : 'Add a new session manually'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={saveSession} className="p-6 sm:p-10 space-y-6 bg-zinc-900">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Date</Label>
                <Input 
                  type="date" 
                  required
                  value={editingSession?.date || ''}
                  onChange={e => setEditingSession({ ...editingSession, date: e.target.value })}
                  className="h-14 bg-black border-zinc-800 text-white focus:ring-orange-500 focus:border-orange-500 rounded-xl w-full"
                />
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Type</Label>
                <Select 
                  value={editingSession?.leave_type || 'work'} 
                  onValueChange={v => setEditingSession({ ...editingSession, leave_type: v === 'work' ? null : v })}
                >
                  <SelectTrigger className="h-14 bg-black border-zinc-800 text-white focus:ring-orange-500 rounded-xl w-full">
                    <SelectValue placeholder="Select type" className="truncate" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 text-white max-h-[40vh] overflow-y-auto">
                    <SelectItem value="work">Regular Work Day</SelectItem>
                    {LEAVE_TYPES.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {editingSession?.leave_type && editingSession.leave_type !== 'future_shift' ? (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 bg-black rounded-xl border border-zinc-800"
              >
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Leave / Manual Hours</Label>
                  <Input 
                    type="number" 
                    step="0.5"
                    value={editingSession?.leave_hours || 0}
                    onChange={e => setEditingSession({ ...editingSession, leave_hours: parseFloat(e.target.value) })}
                    className="h-14 bg-zinc-900 border-zinc-800 text-white focus:ring-orange-500 rounded-xl w-full" 
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Payment Status</Label>
                  <div className="flex items-center gap-3 h-14 bg-zinc-900 rounded-xl px-4 border border-zinc-800">
                    <Checkbox 
                      id="is_paid" 
                      checked={!!editingSession?.is_paid}
                      onCheckedChange={c => setEditingSession({ ...editingSession, is_paid: c ? 1 : 0 })}
                      className="border-zinc-700 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                    />
                    <label htmlFor="is_paid" className="text-sm font-bold text-zinc-400 cursor-pointer uppercase tracking-widest shrink-0">Paid Leave</label>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                      {editingSession?.leave_type === 'future_shift' ? 'Shift Start' : 'Clock In'}
                    </Label>
                    <Input 
                      type="time" 
                      value={editingSession?.clock_in ? (editingSession.clock_in.includes('T') ? format(parseISO(editingSession.clock_in), 'HH:mm') : editingSession.clock_in) : ''}
                      onChange={e => {
                        const date = editingSession?.date || format(new Date(), 'yyyy-MM-dd');
                        setEditingSession({ ...editingSession, clock_in: `${date}T${e.target.value}:00` });
                      }}
                      className="h-14 bg-black border-zinc-800 text-white focus:ring-orange-500 rounded-xl w-full" 
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                      {editingSession?.leave_type === 'future_shift' ? 'Shift End' : 'Clock Out'}
                    </Label>
                    <Input 
                      type="time" 
                      value={editingSession?.clock_out ? (editingSession.clock_out.includes('T') ? format(parseISO(editingSession.clock_out), 'HH:mm') : editingSession.clock_out) : ''}
                      onChange={e => {
                        const date = editingSession?.date || format(new Date(), 'yyyy-MM-dd');
                        setEditingSession({ ...editingSession, clock_out: `${date}T${e.target.value}:00` });
                      }}
                      className="h-14 bg-black border-zinc-800 text-white focus:ring-orange-500 rounded-xl w-full" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 p-4 bg-black rounded-xl border border-zinc-800">
                  <div className="space-y-3">
                    <Label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Tea Out (Start)</Label>
                    <Input 
                      type="time" 
                      value={editingSession?.tea_out ? (editingSession.tea_out.includes('T') ? format(parseISO(editingSession.tea_out), 'HH:mm') : editingSession.tea_out) : ''}
                      onChange={e => {
                        const date = editingSession?.date || format(new Date(), 'yyyy-MM-dd');
                        setEditingSession({ ...editingSession, tea_out: e.target.value ? `${date}T${e.target.value}:00` : null });
                      }}
                      className="h-10 bg-zinc-900 border-zinc-800 text-white text-xs focus:ring-orange-500 rounded-lg w-full" 
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Tea In (End)</Label>
                    <Input 
                      type="time" 
                      value={editingSession?.tea_in ? (editingSession.tea_in.includes('T') ? format(parseISO(editingSession.tea_in), 'HH:mm') : editingSession.tea_in) : ''}
                      onChange={e => {
                        const date = editingSession?.date || format(new Date(), 'yyyy-MM-dd');
                        setEditingSession({ ...editingSession, tea_in: e.target.value ? `${date}T${e.target.value}:00` : null });
                      }}
                      className="h-10 bg-zinc-900 border-zinc-800 text-white text-xs focus:ring-orange-500 rounded-lg w-full" 
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Lunch Out (Start)</Label>
                    <Input 
                      type="time" 
                      value={editingSession?.lunch_out ? (editingSession.lunch_out.includes('T') ? format(parseISO(editingSession.lunch_out), 'HH:mm') : editingSession.lunch_out) : ''}
                      onChange={e => {
                        const date = editingSession?.date || format(new Date(), 'yyyy-MM-dd');
                        setEditingSession({ ...editingSession, lunch_out: e.target.value ? `${date}T${e.target.value}:00` : null });
                      }}
                      className="h-10 bg-zinc-900 border-zinc-800 text-white text-xs focus:ring-orange-500 rounded-lg w-full" 
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Lunch In (End)</Label>
                    <Input 
                      type="time" 
                      value={editingSession?.lunch_in ? (editingSession.lunch_in.includes('T') ? format(parseISO(editingSession.lunch_in), 'HH:mm') : editingSession.lunch_in) : ''}
                      onChange={e => {
                        const date = editingSession?.date || format(new Date(), 'yyyy-MM-dd');
                        setEditingSession({ ...editingSession, lunch_in: e.target.value ? `${date}T${e.target.value}:00` : null });
                      }}
                      className="h-10 bg-zinc-900 border-zinc-800 text-white text-xs focus:ring-orange-500 rounded-lg w-full" 
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Notes & Comments</Label>
              <textarea 
                value={editingSession?.notes || ''}
                onChange={e => setEditingSession({ ...editingSession, notes: e.target.value })}
                className="w-full min-h-[120px] p-5 bg-black border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all text-sm text-white" 
                placeholder="Add any specific details about this session..."
              />
            </div>

            <div className="flex gap-4 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} className="flex-1 h-14 rounded-xl text-zinc-500 hover:text-white hover:bg-zinc-800 font-bold uppercase tracking-widest shrink-0">Cancel</Button>
              <Button type="submit" className="flex-1 h-14 rounded-xl bg-orange-500 text-white hover:bg-orange-600 gap-2 font-black uppercase tracking-widest shadow-xl shadow-orange-500/20 shrink-0">
                <Save className="w-5 h-5 hidden sm:inline" />
                Save
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

  const [showDebug, setShowDebug] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoginError(null);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      console.log(`[LOGIN] Sending: User(${username.trim()}), PassLength(${password.trim().length})`);
      
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ username: username.trim(), password: password.trim() }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.error('[LOGIN] Expected JSON but got:', contentType, text.substring(0, 100));
        throw new Error(`Backend API is unreachable. The server might be starting up, or running in static mode. Please use the Force Bypass button below. Status: ${res.status}`);
      }

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('nic_token', data.token);
        onLogin();
        toast.success('Welcome back, Nic!');
      } else {
        let errorMsg = `Server returned status ${res.status}`;
        try {
          const data = await res.json();
          errorMsg = data.error || errorMsg;
        } catch (e) {}
        setLoginError(errorMsg);
        toast.error(errorMsg);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('[LOGIN] Exception:', err);
      
      let errMsg = err.message || 'Unknown error';
      if (err.name === 'AbortError') {
        errMsg = 'Connection timeout. The server is taking too long to respond. Is the Node server running?';
      } else if (err.message.includes('Failed to fetch')) {
        errMsg = 'Network error. The server might be down or blocking the request.';
      }
      
      setLoginError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Card className="border-zinc-800 bg-zinc-900 shadow-2xl overflow-hidden orange-glow">
          <CardHeader className="bg-black text-white p-10 text-center border-b border-zinc-800">
            <div className="w-16 h-16 bg-orange-500 text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-orange-500/20">
              <Clock className="w-8 h-8" />
            </div>
            <CardTitle className="text-3xl font-black tracking-tighter uppercase">TimeTrack Pro</CardTitle>
            <CardDescription className="text-zinc-500 mt-2 font-bold uppercase tracking-widest text-[10px]">Secure Authentication Required</CardDescription>
          </CardHeader>
          <CardContent className="p-10 bg-zinc-900">
            <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Username</Label>
                <Input 
                  required
                  autoComplete="off"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="h-14 bg-black border-zinc-800 text-white focus:ring-orange-500 focus:border-orange-500 rounded-xl"
                />
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Password</Label>
                <div className="relative">
                  <Input 
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="h-14 bg-black border-zinc-800 text-white focus:ring-orange-500 focus:border-orange-500 rounded-xl pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-orange-500 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <Button 
                type="submit" 
                disabled={loading}
                className="w-full h-14 bg-orange-500 text-white hover:bg-orange-600 rounded-xl font-black text-lg tracking-tight transition-all active:scale-[0.98] shadow-lg shadow-orange-500/20 uppercase"
              >
                {loading ? 'Authenticating...' : 'Sign In'}
              </Button>
            </form>

            {loginError && (
              <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-left">
                <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Login Failed</p>
                <p className="text-xs text-red-400 font-medium">{loginError}</p>
              </div>
            )}
          </CardContent>
          <div className="p-6 bg-black border-t border-zinc-800 text-center">
            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-[0.3em]">
              System Version 2.2.0
            </p>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

function ActionButton({ icon: Icon, label, active, onClick, variant }: any) {
  const variants: any = {
    orange: 'bg-orange-500/10 text-orange-500 border-orange-500/20 hover:bg-orange-500/20 shadow-orange-500/5',
    zinc: 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700 shadow-zinc-900/50',
  };

  return (
    <button 
      onClick={onClick}
      disabled={!active}
      className={`flex flex-col items-center justify-center gap-4 p-6 rounded-2xl border shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:grayscale-0 disabled:pointer-events-none ${variants[variant] || variants.zinc}`}
    >
      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center shadow-inner">
        <Icon className="w-6 h-6" />
      </div>
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-center">{label}</span>
    </button>
  );
}

function StatCard({ label, value, icon: Icon, description, trend, variant = 'default' }: any) {
  return (
    <Card className="border-zinc-800 bg-zinc-900/40 backdrop-blur-xl shadow-xl overflow-hidden group orange-glow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${variant === 'zinc' ? 'bg-zinc-800 text-zinc-500' : 'bg-orange-500 text-white shadow-xl shadow-orange-500/20'}`}>
            <Icon className="w-6 h-6" />
          </div>
          {trend && (
            <Badge variant="secondary" className="bg-orange-500/10 text-orange-500 border-none text-[10px] font-black px-3 py-1">
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
      <div className="h-1.5 w-full bg-zinc-800 group-hover:bg-orange-500 transition-all duration-500" />
    </Card>
  );
}

function DocumentManager({ title, type, docs, onUpload, onDelete, icon: Icon = FileText }: any) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const downloadFile = (id: number, name: string) => {
    const token = localStorage.getItem('nic_token');
    fetch(`/api/documents/${id}/download`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.blob())
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
  };

  return (
    <Card className="border-zinc-800 bg-zinc-900/40 backdrop-blur-xl shadow-xl shadow-black/20 orange-glow">
      <CardHeader className="border-b border-zinc-800/50 pb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon className="w-5 h-5 text-orange-500" />
            <CardTitle className="text-lg font-black text-white uppercase tracking-tight">{title}</CardTitle>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => fileInputRef.current?.click()}
            className="text-orange-500 hover:text-white hover:bg-orange-500/20 text-[10px] font-bold uppercase tracking-widest"
          >
            <Plus className="w-4 h-4 mr-1" /> Upload
          </Button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*,application/pdf,.csv,.doc,.docx,.xls,.xlsx"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file, type);
            }} 
          />
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-2">
          {docs.map((doc: any) => (
            <div key={doc.id} className="flex items-center justify-between p-3 bg-black rounded-xl border border-zinc-800 group transition-all hover:border-zinc-700">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center shrink-0 border border-zinc-800">
                  <FileDown className="w-4 h-4 text-zinc-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-zinc-300 truncate tracking-tight">{doc.original_name}</p>
                  <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest flex items-center gap-2">
                    {format(parseISO(doc.upload_date), 'dd MMM yyyy')}
                    <span className="w-1 h-1 rounded-full bg-zinc-800" />
                    {doc.mime_type?.split('/')[1]?.toUpperCase() || 'FILE'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="w-8 h-8 text-zinc-500 hover:text-orange-500 transition-colors"
                  onClick={() => {
                    const token = localStorage.getItem('nic_token');
                    window.open(`/api/documents/${doc.id}/view?token=${token}`, '_blank');
                  }}
                  title="View"
                >
                  <Eye className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="w-8 h-8 text-zinc-500 hover:text-orange-500 transition-colors"
                  onClick={() => downloadFile(doc.id, doc.original_name)}
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="w-8 h-8 text-zinc-500 hover:text-red-500 transition-colors"
                  onClick={() => onDelete(doc.id)}
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
          {docs.length === 0 && (
            <div className="py-8 text-center">
               <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest italic">No files in pool</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}


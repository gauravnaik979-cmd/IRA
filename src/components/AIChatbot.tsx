import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, Sparkles, User, Loader2, ArrowRight } from 'lucide-react';
import { Student, Attendance, LeaveRequest, MonthlyBill, Hostel } from '../types';

interface AIChatbotProps {
  students: Student[];
  attendance: Attendance[];
  leaves: LeaveRequest[];
  bills: MonthlyBill[];
  hostels?: Hostel[];
}

export default function AIChatbot({ students, attendance, leaves, bills, hostels = [] }: AIChatbotProps) {
  const [messages, setMessages] = useState<{ sender: 'user' | 'bot'; text: string; time: string }[]>([
    { 
      sender: 'bot', 
      text: "👋 Welcome to **IRA Hostel AI Intelligence Portal**. I am grounded to your active campus registry.\n\nAsk me anything! For example:\n* *'What is our hostel occupancy rates and bed availability?'*\n* *'Draft an urgent notice about water tank maintenance on Monday'*\n* *'Who is currently on approved leave or absent?'*\n* *'Analyze mess bill revenue for CS department'*", 
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input;
    setInput('');
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { sender: 'user', text: userText, time: timeStr }]);
    setLoading(true);

    // Compile simplified database snapshot as grounding context for Gemini
    const context = {
      summary: {
        totalStudents: students.length,
        hostelsCount: hostels.length,
        presentToday: students.filter(s => s.hostelStatus === 'present').length,
        absentToday: students.filter(s => s.hostelStatus === 'absent').length,
        onLeaveToday: students.filter(s => s.hostelStatus === 'leave').length,
        unpaidBillsCount: bills.filter(b => b.status === 'unpaid').length,
        paidBillsCount: bills.filter(b => b.status === 'paid').length,
        totalRevenueCollected: bills.filter(b => b.status === 'paid').reduce((acc, b) => acc + b.totalAmount, 0),
      },
      activeLeaves: leaves.map(l => ({
        student: l.studentName,
        roll: l.rollNumber,
        hostel: l.hostelName,
        room: l.roomNumber,
        dates: `${l.startDate} to ${l.endDate}`,
        status: l.status
      })),
      recentAbsentees: students.filter(s => s.hostelStatus === 'absent').map(s => ({
        name: s.name,
        roll: s.rollNumber,
        room: s.roomNumber
      })),
      mealPricing: {
        lunch: 35,
        dinner: 35,
        dailyTotal: 70
      }
    };

    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: userText,
          context: context
        })
      });

      const data = await response.json();
      setMessages(prev => [...prev, { 
        sender: 'bot', 
        text: data.text || "I am processing your query but experienced an empty response.", 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { 
        sender: 'bot', 
        text: "⚠️ **Connection Error**: Unable to contact server API. Please ensure your Express dev server is running properly on Port 3000.", 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const setSuggestedQuery = (query: string) => {
    setInput(query);
  };

  return (
    <div id="ai_assistant_panel" className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[600px] md:h-[650px] transition-all duration-300">
      {/* Header */}
      <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white shadow-sm animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="bg-white/15 p-2 rounded-xl backdrop-blur-md">
            <Sparkles className="w-5 h-5 text-slate-250 animate-pulse" />
          </div>
          <div>
            <h3 className="font-semibold text-base leading-tight">IRA Campus AI In-charge</h3>
            <p className="text-xs text-gray-400">Grounded Hostel Knowledge Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-350"></span>
          </span>
          <span className="text-[10px] uppercase font-mono tracking-wider text-gray-400">Live Agent</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-gray-50/50">
        {messages.map((m, i) => (
          <div key={`msg-${i}-${m.time}`} className={`flex gap-3 max-w-[85%] ${m.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
            <div className={`p-2 h-8 w-8 rounded-full shrink-0 flex items-center justify-center text-xs font-semibold shadow-sm ${m.sender === 'user' ? 'bg-slate-900 text-white' : 'bg-white text-slate-800 border border-slate-200'}`}>
              {m.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 text-slate-800" />}
            </div>
            <div className={`flex flex-col space-y-1`}>
              <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line shadow-sm border ${
                m.sender === 'user' 
                  ? 'bg-slate-900 text-white border-slate-950 rounded-tr-none font-medium' 
                  : 'bg-white text-gray-800 border-gray-100 rounded-tl-none'
              }`}>
                {m.text}
              </div>
              <span className={`text-[10px] text-gray-400 ${m.sender === 'user' ? 'text-right' : ''}`}>
                {m.time}
              </span>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3 max-w-[85%]">
            <div className="bg-white text-slate-800 border border-slate-200 p-2 h-8 w-8 rounded-full shrink-0 flex items-center justify-center shadow-sm">
              <Loader2 className="w-4 h-4 text-slate-800 animate-spin" />
            </div>
            <div className="rounded-2xl px-4 py-3 text-sm bg-white text-gray-400 border border-gray-100 rounded-tl-none shadow-sm flex items-center gap-2">
              <span>Grounded analysis in progress...</span>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Quick suggestions */}
      {messages.length === 1 && (
        <div className="px-6 py-2 bg-gray-50 border-t border-gray-100 flex flex-wrap gap-2">
          <button 
            id="suggest_opt_1"
            onClick={() => setSuggestedQuery("Give me a summary of today's attendance & absent rate")}
            className="text-xs bg-white border border-gray-200 text-gray-600 hover:text-slate-950 hover:border-slate-800 hover:font-bold rounded-full px-3 py-1.5 font-medium cursor-pointer transition-all">
            📊 Daily Summary
          </button>
          <button 
            id="suggest_opt_2"
            onClick={() => setSuggestedQuery("Draft an announcement for water maintenance this Monday")}
            className="text-xs bg-white border border-gray-200 text-gray-600 hover:text-slate-950 hover:border-slate-800 hover:font-bold rounded-full px-3 py-1.5 font-medium cursor-pointer transition-all">
            📢 Draft notice
          </button>
          <button 
            id="suggest_opt_3"
            onClick={() => setSuggestedQuery("Who is currently on approved leave?")}
            className="text-xs bg-white border border-gray-200 text-gray-600 hover:text-slate-950 hover:border-slate-800 hover:font-bold rounded-full px-3 py-1.5 font-medium cursor-pointer transition-all">
            🌴 Approved leaves
          </button>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-4 border-t border-gray-100 bg-white flex gap-2">
        <input
          id="ai_chat_input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask IRA AI (e.g., 'Draft maintenance schedule', 'Analyze bill statistics')..."
          className="flex-1 bg-gray-50 border border-gray-200 focus:border-slate-800 focus:ring-2 focus:ring-slate-100 rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
        />
        <button
          id="ai_chat_submit"
          type="submit"
          disabled={!input.trim() || loading}
          className="bg-slate-900 hover:bg-slate-850 text-white p-2.5 rounded-xl flex items-center justify-center cursor-pointer transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}

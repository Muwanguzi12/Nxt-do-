
import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types';

interface Message {
  role: 'user' | 'model';
  text: string;
  places?: any[];
}

interface AIConciergeProps {
  isOpen: boolean;
  onClose: () => void;
  nearbyHosts: User[];
  currentUser?: User | null;
}

const AIConcierge: React.FC<AIConciergeProps> = ({ isOpen, onClose, nearbyHosts, currentUser }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: "Hi! I'm your helper. I can help you find people nearby, suggest safe places to meet, or explain how payments keep you safe. How can I help?" }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);

    try {
      const trialsRemaining = currentUser?.freeTrialsRemaining || 0;
      const res = await fetch('/api/concierge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userMsg, trialsRemaining })
      });
      
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Server error');
      }

      setMessages(prev => [...prev, { role: 'model', text: data.text || "I'm here to help you stay safe." }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'model', text: "Connection lost. Try again." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-[200] bg-black/90 backdrop-blur-3xl flex flex-col max-w-md mx-auto border-x border-zinc-900 animate-in fade-in ${isOpen ? 'flex' : 'hidden'}`}>
      <div className="p-8 border-b border-zinc-900 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-[28px] bg-[#39FF14] flex items-center justify-center text-black shadow-lg relative">
            <i className="fas fa-robot text-3xl"></i>
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#39FF14] border-4 border-black rounded-full"></div>
          </div>
          <div>
            <h3 className="font-black text-lg uppercase text-white">Helper</h3>
            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Safe Helper</span>
          </div>
        </div>
        <button onClick={onClose} className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-500 active:scale-90 transition-transform">
          <i className="fas fa-times"></i>
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[85%] p-6 rounded-[36px] text-sm font-bold leading-relaxed ${msg.role === 'user' ? 'bg-[#39FF14] text-black rounded-tr-none shadow-lg' : 'bg-zinc-900 text-white border border-zinc-800 rounded-tl-none shadow-xl'}`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-zinc-900/50 px-6 py-3 rounded-full flex gap-1.5 items-center">
              <div className="w-1.5 h-1.5 bg-[#39FF14] rounded-full animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-[#39FF14] rounded-full animate-bounce [animation-delay:0.2s]"></div>
              <div className="w-1.5 h-1.5 bg-[#39FF14] rounded-full animate-bounce [animation-delay:0.4s]"></div>
            </div>
          </div>
        )}
      </div>

      <div className="p-8 bg-black/95 border-t border-zinc-900">
        <div className="flex items-center gap-4">
          <input 
            type="text" 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            onKeyPress={(e) => e.key === 'Enter' && handleSend()} 
            placeholder="Ask me anything..." 
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-full p-6 text-sm text-white outline-none focus:border-[#39FF14] transition-colors" 
          />
          <button 
            onClick={handleSend} 
            disabled={isTyping || !input.trim()} 
            className="w-16 h-16 bg-[#39FF14] rounded-full flex items-center justify-center text-black shadow-lg disabled:opacity-50 active:scale-90 transition-all"
          >
            <i className="fas fa-paper-plane"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIConcierge;

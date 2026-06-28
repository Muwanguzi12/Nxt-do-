
import React, { useState, useRef, useEffect } from 'react';
import { User, ChatThread, ChatMessage } from '../types';
import { GoogleGenAI } from "@google/genai";

interface ChatViewProps {
  host: User;
  thread?: ChatThread;
  onSendMessage: (text: string) => void;
  onReceiveMessage: (text: string) => void;
  onBack: () => void;
}

const ChatView: React.FC<ChatViewProps> = ({ host, thread, onSendMessage, onReceiveMessage, onBack }) => {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [thread?.messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userText = input;
    setInput('');
    onSendMessage(userText);
    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `You are simulating a person on an adult hookup app called NXT DO.
        Your Profile: Name: ${host.alias}, Category: ${host.category}, Age: ${host.age}, Bio: ${host.bio}.
        Interests: ${host.interests?.join(', ')}.
        The user said: "${userText}".
        Rules:
        1. Keep it brief and spicy but professional.
        2. Don't give out real locations yet, suggest meeting in a safe place.
        3. Mention your category: ${host.category}.
        4. Be flirtatious but safe.`,
        config: { thinkingConfig: { thinkingBudget: 0 } }
      });
      
      setTimeout(() => {
        onReceiveMessage(response.text || "Just saw this! What's up?");
        setIsTyping(false);
      }, 1500);
    } catch (e) {
      onReceiveMessage("Connecting...");
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-black animate-in slide-in-from-right duration-300">
      <div className="p-5 border-b border-zinc-900 bg-black/95 backdrop-blur-xl flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-zinc-500 hover:text-white"><i className="fas fa-chevron-left"></i></button>
          <div className="relative">
            <img src={host.photo} className="w-10 h-10 rounded-full border border-zinc-800" />
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#39FF14] rounded-full border-2 border-black"></div>
          </div>
          <div>
            <h3 className="font-black text-white uppercase tracking-tight text-sm">{host.alias}</h3>
            <span className="text-[9px] text-[#39FF14] font-bold uppercase tracking-widest">Active Now</span>
          </div>
        </div>
        <button className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 text-[#39FF14]"><i className="fas fa-phone"></i></button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {thread?.messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.senderId !== host.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-4 rounded-3xl text-sm font-bold ${
              msg.senderId !== host.id ? 'bg-[#39FF14] text-black rounded-tr-none' : 'bg-zinc-900 text-white rounded-tl-none border border-zinc-800'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-zinc-900/50 px-4 py-2 rounded-full flex gap-1 items-center">
              <div className="w-1.5 h-1.5 bg-[#39FF14] rounded-full animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-[#39FF14] rounded-full animate-bounce [animation-delay:0.2s]"></div>
              <div className="w-1.5 h-1.5 bg-[#39FF14] rounded-full animate-bounce [animation-delay:0.4s]"></div>
            </div>
          </div>
        )}
      </div>

      <div className="p-5 bg-black border-t border-zinc-900">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-full p-4 px-6 text-sm text-white focus:border-[#39FF14] outline-none"
          />
          <button onClick={handleSend} className="w-12 h-12 bg-[#39FF14] text-black rounded-full flex items-center justify-center shadow-lg">
            <i className="fas fa-paper-plane"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatView;

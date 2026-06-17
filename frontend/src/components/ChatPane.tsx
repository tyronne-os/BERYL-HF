import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Send, User, Bot, Paperclip, Mic, AtSign, Plus } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatPaneProps {
  model: string;
  isComputerUseEnabled: boolean;
  onArtifactCreated: (artifact: any) => void;
}

const SYSTEM_PROMPT = `You are the Beryl HF System Assistant, an elite AI orchestrator operating within the Dual-Panel HF Builder environment.
You have absolute awareness of the following local capabilities:
1. Compact Engine: 1-Bit model compression (BitNet 1.58b) and GGUF quantization routing.
2. Agent Studio: Visual multi-agent workflows, Model Context Protocol (MCP) servers, and local RAG vector databases.
3. Project Hub: Cross-platform workspace switching (Local, GitHub, Hugging Face), and API Key Vault.
4. Canvas Viewport: Immersive 66% live preview with responsive device toggles, history rollbacks, and a Monaco-style split-pane inspector.
5. Telemetry & CLI: Background AST semantic indexing, VRAM scaling, and terminal emulation.
When the user asks about what is possible or how to do things, reference these capabilities. Be concise, expert, and highly technical. You are directly connected to the Living Documentation.`;

const ChatPane: React.FC<ChatPaneProps> = ({ model, isComputerUseEnabled, onArtifactCreated }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      if (isComputerUseEnabled) {
        // Computer Use Path
        const response = await axios.post('http://127.0.0.1:8001/computer_use', {
          instruction: input
        });
        
        const assistantMsg: Message = { 
          role: 'assistant', 
          content: `**Computer Use Action Execution**\n\nModel Response: ${response.data.model_response}\n\nStatus: ${response.data.status}\nAction Executed: ${response.data.action_executed || 'None'}`
        };
        setMessages(prev => [...prev, assistantMsg]);
        setIsLoading(false);
        return;
      }

      // Normal Chat Path
      const response = await fetch('http://127.0.0.1:8001/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages, userMsg],
          stream: true
        })
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) {
                  assistantContent += data.content;
                  setMessages(prev => {
                    const newMsgs = [...prev];
                    newMsgs[newMsgs.length - 1].content = assistantContent;
                    return newMsgs;
                  });
                }
              } catch (e) {}
            }
          }
        }
      }

      // Check for artifacts after stream ends
      parseArtifacts(assistantContent);

    } catch (err) {
      console.error("Chat error", err);
    } finally {
      setIsLoading(false);
    }
  };

  const parseArtifacts = (content: string) => {
    // Simple regex to find html blocks as artifacts
    const htmlRegex = /```html\n([\s\S]*?)```/g;
    let match;
    while ((match = htmlRegex.exec(content)) !== null) {
      onArtifactCreated({
        type: 'html',
        content: match[1],
        title: 'HTML Preview'
      });
    }
    
    // Check for generic artifacts
    const artRegex = /<artifact title="([^"]+)">([\s\S]*?)<\/artifact>/g;
    while ((match = artRegex.exec(content)) !== null) {
        onArtifactCreated({
          type: 'generic',
          content: match[2],
          title: match[1]
        });
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 relative">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900/50">
         <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center">
           <Bot className="w-3 h-3 mr-1" />
           {isComputerUseEnabled ? 'Vision System Active' : 'Chat Context'}
         </span>
         <button className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded flex items-center space-x-1 transition-colors">
            <Plus className="w-3 h-3" />
            <span>Add Context</span>
         </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4 opacity-50">
             <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center">
                <Bot className="w-8 h-8" />
             </div>
             <p className="text-sm font-medium">Start building with {model.split('/').pop()}</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex space-x-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-blue-600' : 'bg-slate-700'}`}>
                {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
              </div>
              <div className={`p-3 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-100 border border-slate-700'}`}>
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        ))}
        {isLoading && messages[messages.length-1]?.role === 'user' && (
          <div className="flex justify-start">
            <div className="bg-slate-800 p-3 rounded-2xl border border-slate-700">
              <div className="flex space-x-1">
                <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 bg-slate-900 border-t border-slate-800 relative">
        {showMentionMenu && (
          <div className="absolute bottom-full left-4 mb-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-2 z-50">
             <div className="text-[10px] font-bold text-slate-500 uppercase px-2 mb-1">Select Agent</div>
             <button type="button" onClick={() => { setInput(input + 'UI Architect '); setShowMentionMenu(false); }} className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-700 text-xs font-medium">@UI Architect</button>
             <button type="button" onClick={() => { setInput(input + 'Backend Engineer '); setShowMentionMenu(false); }} className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-700 text-xs font-medium">@Backend Engineer</button>
          </div>
        )}

        {/* Attachment Zone Indicator */}
        <div className="absolute -top-6 left-6 right-6 h-6 flex items-center space-x-2 text-[10px] text-slate-500 font-bold opacity-0 hover:opacity-100 transition-opacity">
           <span>Drop files here to attach to context</span>
        </div>

        <div className="relative group bg-slate-800 border border-slate-700 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
          <textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (e.target.value.endsWith('@')) setShowMentionMenu(true);
              else setShowMentionMenu(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Ask anything or use @ to mention an agent..."
            className="w-full bg-transparent text-slate-100 px-4 py-3 pr-12 focus:outline-none resize-none min-h-[50px] max-h-40"
            rows={2}
          />
          <div className="bg-slate-900/50 px-2 py-1.5 border-t border-slate-700/50 flex items-center justify-between">
             <div className="flex items-center space-x-1">
               <button type="button" className="p-1 text-slate-400 hover:text-slate-100 transition-colors rounded hover:bg-slate-700" title="Attach Files">
                 <Paperclip className="w-4 h-4" />
               </button>
               <button type="button" className="p-1 text-slate-400 hover:text-slate-100 transition-colors rounded hover:bg-slate-700" title="Mention Agent">
                 <AtSign className="w-4 h-4" />
               </button>
               <button type="button" className="p-1 text-slate-400 hover:text-slate-100 transition-colors rounded hover:bg-slate-700" title="Voice Input">
                 <Mic className="w-4 h-4" />
               </button>
             </div>
             <button 
               type="submit" 
               disabled={isLoading}
               className={`p-1.5 rounded-lg transition-all flex items-center space-x-1 px-3 ${input.trim() ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
             >
               <span className="text-[10px] font-bold">SEND</span>
               <Send className="w-3 h-3" />
             </button>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between text-[9px] text-slate-500 uppercase tracking-widest font-bold px-2">
          <span>{model.split('/').pop()}</span>
          <span>{input.length} Chars</span>
        </div>
      </form>
    </div>
  );
};

export default ChatPane;

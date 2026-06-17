import React, { useState } from 'react';
import { Eye, Code, Maximize2, Download, Monitor, Tablet, Smartphone, History, Bug, Rocket, Terminal } from 'lucide-react';

interface CanvasPaneProps {
  artifact: any;
}

const CanvasPane: React.FC<CanvasPaneProps> = ({ artifact }) => {
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [viewportMode, setViewportMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);

  const getViewportClasses = () => {
    switch(viewportMode) {
      case 'tablet': return 'w-[768px] h-[1024px] mx-auto border-4 border-slate-800 rounded-3xl overflow-hidden shadow-2xl mt-4 shrink-0 transition-all duration-300';
      case 'mobile': return 'w-[375px] h-[812px] mx-auto border-[12px] border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl mt-4 shrink-0 transition-all duration-300';
      default: return 'w-full h-full border-0 transition-all duration-300';
    }
  };

  if (!artifact) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 space-y-4">
        <div className="w-20 h-20 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center">
          <Maximize2 className="w-8 h-8 opacity-20" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">Immersive Viewport</p>
          <p className="text-xs opacity-60">Your Live Refresh Preview Canvas</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 relative overflow-hidden">
      {/* Top Toolbar */}
      <div className="h-12 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 z-20">
        <div className="flex items-center space-x-1 bg-slate-800 rounded-lg p-0.5 border border-slate-700">
           <button onClick={() => setViewportMode('desktop')} className={`p-1.5 rounded-md transition-colors ${viewportMode === 'desktop' ? 'bg-slate-700 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}>
             <Monitor className="w-4 h-4" />
           </button>
           <button onClick={() => setViewportMode('tablet')} className={`p-1.5 rounded-md transition-colors ${viewportMode === 'tablet' ? 'bg-slate-700 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}>
             <Tablet className="w-4 h-4" />
           </button>
           <button onClick={() => setViewportMode('mobile')} className={`p-1.5 rounded-md transition-colors ${viewportMode === 'mobile' ? 'bg-slate-700 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}>
             <Smartphone className="w-4 h-4" />
           </button>
        </div>

        <div className="flex items-center space-x-2">
          <button className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-bold text-slate-300 transition-colors">
             <History className="w-3.5 h-3.5" />
             <span>v1.2</span>
          </button>
          <button 
            onClick={() => setIsOverlayOpen(!isOverlayOpen)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 border rounded-lg text-xs font-bold transition-all ${isOverlayOpen ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'}`}
          >
             <Code className="w-3.5 h-3.5" />
             <span>INSPECTOR</span>
          </button>
          <button className="flex items-center space-x-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 border border-green-500 rounded-lg text-xs font-bold text-white transition-colors shadow-[0_0_10px_rgba(22,163,74,0.3)]">
             <Rocket className="w-3.5 h-3.5" />
             <span>DEPLOY</span>
          </button>
        </div>
      </div>

      {/* Main Split Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Live Viewport */}
        <div className={`flex-1 flex flex-col bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxyZWN0IHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iIzBmMTExNyI+PC9yZWN0Pgo8Y2lyY2xlIGN4PSIyIiBjeT0iMiIgcj0iMSIgZmlsbD0iIzFlMjkyMyI+PC9jaXJjbGU+Cjwvc3ZnPg==')] overflow-auto`}>
          <div className={`flex-1 ${viewportMode !== 'desktop' ? 'py-8' : ''}`}>
            {artifact.type === 'html' ? (
              <iframe
                srcDoc={artifact.content}
                className={`bg-white ${getViewportClasses()}`}
                title="Preview"
                sandbox="allow-scripts allow-same-origin allow-popups"
              />
            ) : (
              <div className="p-12 text-slate-400 font-mono text-sm h-full flex items-center justify-center">
                 <div className="text-center bg-slate-900 border border-slate-800 p-8 rounded-2xl">
                    <Bug className="w-8 h-8 text-yellow-500 mx-auto mb-4" />
                    <p className="font-bold text-white mb-2">Non-renderable Artifact</p>
                    <p className="text-xs opacity-70">Open the Code Inspector to view raw contents.</p>
                 </div>
              </div>
            )}
          </div>
        </div>

        {/* Code Inspector Overlay (Escape Hatch) */}
        <div 
          className={`absolute inset-y-0 right-0 w-full md:w-[45%] bg-slate-900 border-l border-slate-700 z-30 transform transition-transform duration-300 ease-out shadow-2xl flex flex-col ${isOverlayOpen ? 'translate-x-0' : 'translate-x-full'}`}
        >
          <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950">
            <div className="flex items-center space-x-2">
              <Code className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-bold text-slate-200">Source Editor</span>
              <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest ml-2">READ-ONLY</span>
            </div>
            <div className="flex items-center space-x-2">
               <button className="p-1.5 hover:bg-slate-800 rounded-md text-slate-400 transition-colors">
                  <Download className="w-4 h-4" />
               </button>
               <button onClick={() => setIsOverlayOpen(false)} className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-md text-slate-400 transition-colors">
                  <Eye className="w-4 h-4" />
               </button>
            </div>
          </div>
          {/* Mockup of Monaco Editor */}
          <div className="flex-1 overflow-auto bg-[#1e1e1e] text-[#d4d4d4] font-mono text-[13px] leading-relaxed p-4">
             <div className="flex">
               <div className="w-8 select-none text-slate-600 text-right pr-4 border-r border-slate-700 mr-4">
                 {artifact.content.split('\n').map((_: any, i: number) => <div key={i}>{i + 1}</div>)}
               </div>
               <div className="flex-1 overflow-x-auto whitespace-pre">
                 <code>{artifact.content}</code>
               </div>
             </div>
          </div>
        </div>
      </div>

      {/* Bottom Console Drawer */}
      <div className={`border-t border-slate-800 bg-slate-950 transition-all duration-300 ease-in-out flex flex-col z-20 ${isConsoleOpen ? 'h-48' : 'h-8'}`}>
         <div 
           className="h-8 flex items-center justify-between px-4 cursor-pointer hover:bg-slate-900 transition-colors"
           onClick={() => setIsConsoleOpen(!isConsoleOpen)}
         >
           <div className="flex items-center space-x-2">
             <Terminal className="w-3.5 h-3.5 text-slate-400" />
             <span className="text-xs font-bold text-slate-300">Console Output</span>
           </div>
           <div className="flex items-center space-x-3 text-[10px] font-bold">
              <span className="text-red-400 flex items-center space-x-1"><Bug className="w-3 h-3" /><span>0</span></span>
              <span className="text-yellow-400">⚠ 0</span>
           </div>
         </div>
         {isConsoleOpen && (
           <div className="flex-1 p-3 overflow-y-auto font-mono text-xs text-slate-400 space-y-1">
              <div className="text-slate-500">[System] Vite Dev Server connected.</div>
              <div className="text-blue-400">[Info] Artifact rendered successfully.</div>
           </div>
         )}
      </div>
    </div>
  );
};

export default CanvasPane;

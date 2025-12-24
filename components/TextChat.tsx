
import React, { useState, useRef, useEffect } from 'react';
import {
  Send, User, Loader2, Plus, MessageSquare, X,
  PanelLeftClose, PanelLeft, Lightbulb,
  FileText, Paperclip, Trash2, BookOpen, Gavel,
  Layout, Search, Edit2, Scale, FileSignature
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import mermaid from 'mermaid';
import { SYSTEM_INSTRUCTION } from '../constants';

mermaid.initialize({
  startOnLoad: true,
  theme: 'neutral',
  securityLevel: 'loose',
  fontFamily: 'inherit'
});

const MermaidRenderer: React.FC<{ chart: string }> = ({ chart }) => {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    const render = async () => {
      const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
      try {
        const { svg } = await mermaid.render(id, chart);
        setSvg(svg);
      } catch (e) {
        console.error('Mermaid render error:', e);
      }
    };
    render();
  }, [chart]);

  return <div className="mt-4 mb-6 flex justify-center bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto" dangerouslySetInnerHTML={{ __html: svg }} />;
};
import { useChatStore } from '../hooks/useChatStore';

interface TextChatProps {
  courseContent: string;
  systemInstruction: string;
  apiKey: string;
  themeColor?: string;
}

interface AttachedFile {
  name: string;
  data: string;
  mimeType: string;
}

const colorMap: Record<string, { primary: string, hover: string, bg: string, text: string, border: string }> = {
  blue: { primary: 'bg-blue-700', hover: 'hover:bg-blue-800', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  emerald: { primary: 'bg-emerald-700', hover: 'hover:bg-emerald-800', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  indigo: { primary: 'bg-indigo-700', hover: 'hover:bg-indigo-800', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  rose: { primary: 'bg-[#ad5c51]', hover: 'hover:bg-[#914a41]', bg: 'bg-[#fff5f4]', text: 'text-[#ad5c51]', border: 'border-[#f2d8d5]' },
  amber: { primary: 'bg-amber-700', hover: 'hover:bg-amber-800', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
};

export const TextChat: React.FC<TextChatProps> = ({ courseContent, systemInstruction, apiKey, themeColor = 'blue' }) => {
  const {
    sessions,
    activeSessionId,
    setActiveSessionId,
    createNewSession,
    deleteSession,
    renameSession,
    addMessageToSession,
    activeSession
  } = useChatStore();

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const colors = colorMap[themeColor] || colorMap.blue;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages, isLoading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') {
      if (file) alert("Veuillez sélectionner un fichier PDF.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = (event.target?.result as string).split(',')[1];
      setAttachedFile({ name: file.name, data: base64Data, mimeType: file.type });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const sendMessage = async (overrideInput?: string) => {
    const textToSend = overrideInput !== undefined ? overrideInput : input;
    const text = textToSend.trim();
    if ((!text && !attachedFile) || isLoading || !activeSessionId) return;

    const displayMsgText = attachedFile ? `[Fichier joint : ${attachedFile.name}]\n${text}` : text;
    const messageFile = attachedFile ? { ...attachedFile } : undefined;

    addMessageToSession(activeSessionId, {
      role: 'user',
      text: displayMsgText,
      timestamp: new Date(),
      file: messageFile
    });

    setInput('');
    const currentFile = attachedFile;
    setAttachedFile(null);
    setIsLoading(true);

    try {
      const fullMessages = [
        ...(activeSession?.messages || []),
        { role: 'user', text: text, file: currentFile || undefined }
      ];

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: fullMessages,
          systemInstruction: systemInstruction || SYSTEM_INSTRUCTION,
          courseContent: courseContent
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur API');
      }

      const data = await response.json();
      addMessageToSession(activeSessionId, {
        role: 'model',
        text: data.text || "Je n'ai pas pu formuler de réponse.",
        timestamp: new Date()
      });
    } catch (error: any) {
      console.error(error);
      addMessageToSession(activeSessionId, {
        role: 'model',
        text: `Erreur : ${error.message || "Une erreur est survenue lors de la communication avec l'IA."}`,
        timestamp: new Date(),
        isError: true
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (action: string) => {
    let prompt = "";
    switch (action) {
      case 'explication': prompt = "Expliquez-moi simplement la notion suivante :"; break;
      case 'dissertation': prompt = "Propose-moi un sujet de dissertation et un plan détaillé (I. II.) basé sur un ou plusieurs thèmes du cours que je vais t'indiquer."; break;
      case 'cas': prompt = "Soumets-moi un petit cas pratique sur un ou plusieurs thèmes du cours que je vais t'indiquer."; break;
      case 'qcm': prompt = "Génère successivement un QCM de 3 questions sur un ou plusieurs thèmes du cours que je vais t'indiquer."; break;
      case 'vraifaux': prompt = "Propose-moi successivement 3 affirmations Vrai/Faux sur un ou plusieurs thèmes du cours que je vais t'indiquer."; break;
      case 'arretsdefin': prompt = "Listez les arrêts liés à des définitions, SVP."; break;
      case 'arretscles': prompt = "Listez les arrêts liés à des notions clés, SVP."; break;
    }
    if (prompt) sendMessage(prompt);
  };

  const saveRename = (e: any, id: string) => {
    e.stopPropagation();
    if (renameValue.trim()) renameSession(id, renameValue.trim());
    setEditingSessionId(null);
  };

  return (
    <div className="flex h-full max-w-6xl mx-auto w-full bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden relative">
      <div className={`absolute inset-y-0 left-0 z-30 flex flex-col w-72 bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-serif font-bold text-slate-700 dark:text-slate-200">Mes Révisions</h3>
            <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg"><PanelLeftClose size={20} /></button>
          </div>
          <button onClick={() => { createNewSession(); setIsSidebarOpen(false); }} className={`w-full flex items-center justify-center gap-2 px-4 py-3 ${colors.primary} text-white rounded-lg font-medium shadow-md transition-all active:scale-95`}><Plus size={18} /><span>Nouvelle Session</span></button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.map(session => (
            <div
              key={session.id}
              onClick={() => { setActiveSessionId(session.id); setIsSidebarOpen(false); }}
              className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-all ${activeSessionId === session.id ? 'bg-white dark:bg-slate-800 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-medium' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/50'}`}
            >
              <MessageSquare size={16} className="shrink-0" />
              {editingSessionId === session.id ? (
                <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveRename(e, session.id)} onBlur={e => saveRename(e, session.id)} onClick={e => e.stopPropagation()} className="flex-1 bg-slate-100 dark:bg-slate-700 px-1 rounded outline-none" />
              ) : (
                <span className="flex-1 truncate">{session.title}</span>
              )}
              <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={e => { e.stopPropagation(); setEditingSessionId(session.id); setRenameValue(session.title); }} className={`p-1 hover:${colors.text}`}><Edit2 size={14} /></button>
                <button onClick={e => deleteSession(session.id, e)} className="p-1 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 bg-slate-50/30 dark:bg-slate-950">
        <header className="p-2 md:p-4 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-10 shadow-sm shrink-0">
          <div className="flex items-center gap-1 md:gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="p-1.5 md:p-2 -ml-1 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Historique">
              <PanelLeft size={18} className="md:w-5 md:h-5" />
            </button>
            <span className="font-serif font-bold text-xs md:text-base text-slate-800 dark:text-white truncate max-w-[120px] md:max-w-none">
              {activeSession?.title || 'Session de Droit'}
            </span>
          </div>
          <button onClick={() => setIsHelpOpen(true)} className="p-1.5 md:p-2 text-slate-400 hover:text-amber-500 transition-all active:scale-90" title="Guide d'utilisation">
            <Lightbulb size={20} className="md:w-6 md:h-6" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-4 md:space-y-6">
          {activeSession?.messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-2 md:gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center ${msg.role === 'model' ? `${colors.primary} text-white shadow-md` : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                {msg.role === 'model' ? <Scale size={20} /> : <User size={20} />}
              </div>
              <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`px-4 py-3 md:px-5 md:py-3.5 rounded-2xl shadow-sm prose prose-sm md:prose-base max-w-full overflow-hidden
                     /* Espace entre paragraphes et hauteur de ligne accrue */
                      [&>p]:mb-5 leading-relaxed 
                      ${msg.role === 'user'
                    ? `${colors.primary} text-white rounded-tr-none prose-invert`
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-tl-none prose-slate dark:prose-invert'
                  }`}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                    components={{
                      ['qcm-option' as any]: ({ node, ...props }: any) => (
                        <button
                          onClick={() => {
                            const label = String(props.children);
                            const textToSend = (props.value && props.value !== label)
                              ? `${props.value}. ${label}`
                              : label;
                            sendMessage(textToSend);
                          }}
                          className={`block w-full text-left px-4 py-3 my-2 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-${themeColor === 'rose' ? '[#ad5c51]' : 'blue-500'} hover:bg-slate-50 dark:hover:bg-slate-900 transition-all font-medium text-sm group active:scale-[0.98] flex items-center`}
                        >
                          <div className={`flex-shrink-0 w-5 h-5 mr-4 rounded border-2 flex items-center justify-center transition-all ${themeColor === 'rose' ? 'group-hover:border-[#ad5c51]' : 'group-hover:border-blue-600'} border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800`}>
                            <div className={`w-2.5 h-2.5 rounded-sm scale-0 group-hover:scale-100 transition-transform ${themeColor === 'rose' ? 'bg-[#ad5c51]' : 'bg-blue-600'}`}></div>
                          </div>
                          <span className="flex-1">{props.children}</span>
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 ml-2 py-0.5 px-2 bg-slate-100 dark:bg-slate-800 rounded-md">Choix {props.value}</span>
                        </button>
                      ),
                      'div': ({ node, className, children, ...props }: any) => {
                        if (className === 'qcm-container') {
                          return <div className="mt-4 space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4 animate-in slide-in-from-bottom-2 duration-300 w-full">{children}</div>
                        }
                        return <div {...props} className={`${className} max-w-full overflow-hidden`}>{children}</div>
                      },
                      code: ({ node, inline, className, children, ...props }: any) => {
                        const match = /language-(\w+)/.exec(className || '');
                        if (!inline && match && match[1] === 'mermaid') {
                          return <MermaidRenderer chart={String(children).replace(/\n$/, '')} />;
                        }
                        return <code className={className} {...props}>{children}</code>;
                      },
                      table: ({ children }) => (
                        <div className="my-6 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                          <table className="w-full border-collapse bg-white dark:bg-slate-900 text-left text-sm">
                            {children}
                          </table>
                        </div>
                      ),
                      th: ({ children }) => (
                        <th className="bg-slate-50 dark:bg-slate-800/50 px-4 py-3 font-bold border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 uppercase tracking-wider text-[10px]">
                          {children}
                        </th>
                      ),
                      td: ({ children }) => (
                        <td className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 leading-relaxed">
                          {children}
                        </td>
                      )
                    } as any}
                  >
                    {msg.text}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-4">
              <div className={`w-10 h-10 rounded-full ${colors.primary} flex items-center justify-center text-white`}><Scale size={20} /></div>
              <div className="bg-white dark:bg-slate-800 px-5 py-3 rounded-2xl rounded-tl-none border border-slate-200 dark:border-slate-700">
                <Loader2 className={`animate-spin ${colors.text} inline-block mr-2`} size={16} />
                <span className="text-slate-500 text-sm italic">Analyse en cours...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
          {/* BOUTONS D'ACTIONS JURIDIQUES */}
          <div className="flex gap-2 mb-2 md:mb-4 overflow-x-auto pb-2 no-scrollbar px-1">
            <button onClick={() => handleQuickAction('explication')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 transition-all whitespace-nowrap"><Gavel size={14} /> Expliquez-moi...</button>
            <button onClick={() => handleQuickAction('dissertation')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 dark:bg-indigo-900/30 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-100 transition-all whitespace-nowrap"><Layout size={14} /> Plan Dissertation</button>
            <button onClick={() => handleQuickAction('cas')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:bg-emerald-100 transition-all whitespace-nowrap"><FileSignature size={14} /> Cas pratique</button>
            <button onClick={() => handleQuickAction('qcm')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-lg hover:bg-amber-100 transition-all whitespace-nowrap"><Search size={14} /> QCM</button>
            <button onClick={() => handleQuickAction('vraifaux')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 dark:bg-rose-900/30 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg hover:bg-rose-100 transition-all whitespace-nowrap"><BookOpen size={14} /> Vrai/Faux</button>
            <button onClick={() => handleQuickAction('arretsdefin')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-purple-700 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-100 transition-all whitespace-nowrap"><Gavel size={14} /> Arrêts & définitions</button>
            <button onClick={() => handleQuickAction('arretscles')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-cyan-700 bg-cyan-50 dark:bg-cyan-900/30 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 rounded-lg hover:bg-cyan-100 transition-all whitespace-nowrap"><Layout size={14} /> Arrêts & notions clés</button>
          </div>
          {attachedFile && (
            <div className={`mb-3 flex items-center gap-3 p-2.5 ${colors.bg} dark:bg-slate-800 ${colors.border} border rounded-xl animate-in fade-in`}>
              <FileText size={20} className="text-red-500" />
              <span className="text-xs font-bold truncate flex-1">{attachedFile.name}</span>
              <button onClick={() => setAttachedFile(null)} className="text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
            </div>
          )}
          <div className={`relative flex items-end gap-1 md:gap-2 bg-slate-50 dark:bg-slate-800/50 p-1.5 md:p-2 rounded-2xl border-2 border-slate-200 dark:border-slate-700 transition-all focus-within:ring-2 focus-within:ring-${themeColor === 'rose' ? '[#ad5c51]' : 'blue-500'}/10`}>
            <button onClick={() => fileInputRef.current?.click()} className={`p-2.5 md:p-3 text-slate-400 hover:${colors.text} hover:${colors.bg} dark:hover:bg-slate-900 rounded-xl transition-all`}><Paperclip size={20} className="md:w-6 md:h-6" /></button>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".pdf" className="hidden" />
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
              placeholder="Posez votre question..."
              className="flex-1 py-2.5 md:py-3 bg-transparent !border-none outline-none shadow-none focus:ring-0 resize-none text-slate-800 dark:text-white max-h-[150px] md:max-h-[200px] text-sm md:text-base px-1"
            />
            <button onClick={() => sendMessage()} disabled={(!input.trim() && !attachedFile) || isLoading} className={`p-2.5 md:p-3 ${colors.primary} text-white rounded-xl ${colors.hover} shadow-lg disabled:opacity-50 active:scale-95 transition-all flex-shrink-0`}><Send size={20} /></button>
          </div>
        </div>
      </div>
      {/* MODALE D'AIDE */}
      {
        isHelpOpen && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm transition-opacity">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90%] overflow-hidden border border-slate-200 dark:border-slate-700">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg">
                    <Lightbulb size={24} />
                  </div>
                  <h3 className="font-serif font-bold text-lg text-slate-800 dark:text-white">Guide de démarrage</h3>
                </div>
                <button onClick={() => setIsHelpOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-600 dark:text-slate-400">
                <section className="space-y-2">
                  <h4 className={`font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2`}>
                    <Paperclip size={18} className={colors.text} />
                    Analyse de Documents PDF
                  </h4>
                  <p>Utilisez le trombone de la zone de saisie pour joindre un document PDF au chat. L'IA analysera votre document PDF, puis répondra à vos demandes ou questions relativement à son contenu.</p>
                </section>

                <section className="space-y-2">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Layout size={18} className={colors.text} />
                    Actions rapides
                  </h4>
                  <p>Les boutons au-dessus de la zone de saisie permettent de générer instantanément un QUIZ, un cas pratique, un plan de dissertation, etc.</p>
                </section>

                <section className="space-y-2">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Edit2 size={18} className={colors.text} />
                    Historique Personnalisé
                  </h4>
                  <p>Renommez ou supprimer vos sessions de discussion dans la barre latérale pour mieux organiser vos thématiques (ex: "Police Administrative", "Recours pour Excès de Pouvoir").</p>
                </section>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
                <button onClick={() => setIsHelpOpen(false)} className={`w-full py-3 ${colors.primary} ${colors.hover} text-white rounded-xl font-bold shadow-md transition-all`}>Retourner au Chat</button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};


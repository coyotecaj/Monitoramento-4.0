import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Megaphone, 
  X, 
  Radio, 
  Plus
} from 'lucide-react';

const SUGGESTED_ANNOUNCEMENTS = [
  "Atenção! Lentidão reportada no trecho atual da viagem.",
  "Atenção! Favor entrar em contato imediato com a torre de controle.",
  "Alerta! Veículo identificado parado fora da área permitida.",
  "Aviso! Carga liberada para carregamento na origem."
];

export default function AIChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto focus when opening
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleSendAnnouncement = async () => {
    if (!message.trim() || isSending) return;

    setIsSending(true);
    setFeedback(null);

    try {
      const response = await fetch('/api/announce', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: message.trim() })
      });

      if (!response.ok) {
        throw new Error('Falha ao enviar transmissão');
      }

      setFeedback({ type: 'success', text: 'Aviso transmitido com sucesso para toda a empresa!' });
      setMessage('');
      
      // Auto-hide feedback and close popup after 2 seconds
      setTimeout(() => {
        setFeedback(null);
        setIsOpen(false);
      }, 2000);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Erro ao transmitir aviso.' });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendAnnouncement();
    }
  };

  const handleQuickSelect = (text: string) => {
    setMessage(text);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999]" id="voice-announcer-hub">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="absolute bottom-20 right-0 w-80 sm:w-96 bg-slate-950/95 border-2 border-sky-500/50 rounded-2xl p-4 shadow-2xl backdrop-blur-md overflow-hidden flex flex-col"
            id="voice-announcer-popup"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-sky-500/10 rounded-lg text-sky-400">
                  <Radio size={18} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-200">Rádio de Alerta Vocal</h3>
                  <p className="text-[10px] text-slate-400">Transmissão em tempo real para monitores</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content / Input */}
            <div className="py-4 space-y-4">
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Digite aqui o informativo ou aviso para ser ditado nas telas... ex: Atenção! Placa ABC 123 entrou na oficina."
                  className="w-full h-24 bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500/50 resize-none"
                  disabled={isSending}
                />
                <div className="absolute bottom-2 right-2 text-[9px] text-slate-500 font-mono">
                  {message.length} caracteres
                </div>
              </div>

              {/* Suggested Templates */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Atalhos rápidos:</span>
                <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {SUGGESTED_ANNOUNCEMENTS.map((tpl, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleQuickSelect(tpl)}
                      className="text-left text-[11px] bg-slate-900 hover:bg-slate-850 border border-slate-800/50 hover:border-slate-700 rounded-lg p-2 text-slate-300 hover:text-white transition truncate cursor-pointer flex items-center gap-2"
                    >
                      <Plus size={10} className="text-sky-400 shrink-0" />
                      <span className="truncate">{tpl}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Status Feedback */}
            {feedback && (
              <div className={`p-2 rounded-lg text-xs mb-3 text-center border ${
                feedback.type === 'success' 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}>
                {feedback.text}
              </div>
            )}

            {/* Footer / Submit */}
            <div className="flex items-center gap-2 pt-3 border-t border-slate-800/60">
              <button
                onClick={() => setMessage('')}
                className="text-xs text-slate-400 hover:text-slate-200 px-3 py-2 rounded-lg hover:bg-slate-900 transition cursor-pointer"
                disabled={isSending || !message}
              >
                Limpar
              </button>
              <button
                onClick={handleSendAnnouncement}
                disabled={isSending || !message.trim()}
                className="flex-1 bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white font-semibold text-xs px-4 py-2 rounded-lg shadow-md hover:shadow-lg disabled:shadow-none transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isSending ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
                    Transmitindo...
                  </>
                ) : (
                  <>
                    <Megaphone size={14} className="animate-bounce" />
                    Transmitir Aviso de Voz
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl cursor-pointer relative transition-colors duration-300 ${
          isOpen 
            ? 'bg-rose-600 hover:bg-rose-500 text-white' 
            : 'bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-white border-2 border-sky-400/20 shadow-sky-500/20'
        }`}
        id="voice-announcer-toggle"
        title="Rádio de Transmissão por Voz"
      >
        <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-sky-500 border border-slate-950"></span>
        </span>
        
        {isOpen ? (
          <X size={22} />
        ) : (
          <Megaphone size={22} />
        )}
      </motion.button>
    </div>
  );
}

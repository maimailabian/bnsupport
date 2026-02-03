
import React, { useState, useEffect, useRef } from 'react';
import { Message, SenderType } from '../types';
import { SendIcon, MessageSquareIcon, PaperclipIcon, MinusIcon, BinanceIconB, AdminAvatarIcon, XIcon } from './Icons';

const ChevronDownIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="6 9 12 15 18 9"></polyline></svg>
);

interface CustomerChatWidgetProps {
  onSendMessage: (text: string, file?: File) => void;
  onTyping: (text: string) => void;
  messages: Message[];
  isTyping?: boolean; // Customer typing state shown to admin (unused here mostly)
  embedded?: boolean; 
  isOpen?: boolean;
  onToggle?: () => void;
  adminNotes?: string; 
  adminTyping?: boolean; // Admin typing state shown to customer
}

const CustomerChatWidget: React.FC<CustomerChatWidgetProps> = ({ 
    onSendMessage, 
    onTyping,
    messages, 
    isTyping, 
    embedded = false,
    isOpen,
    onToggle,
    adminNotes,
    adminTyping
}) => {
  const [inputValue, setInputValue] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Audio Refs
  const incomingSoundRef = useRef<HTMLAudioElement | null>(null);
  const typingSoundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
      // Initialize Audio Objects
      incomingSoundRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3"); // Loud Ding
      typingSoundRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3"); // Key click
      
      if(incomingSoundRef.current) incomingSoundRef.current.volume = 1.0;
      if(typingSoundRef.current) typingSoundRef.current.volume = 0.5;
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          setSelectedFile(file);
          setFilePreview(URL.createObjectURL(file));
      }
  };

  const clearFile = () => {
      setSelectedFile(null);
      if (filePreview) URL.revokeObjectURL(filePreview);
      setFilePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = () => {
    if (inputValue.trim() || selectedFile) {
      onSendMessage(inputValue, selectedFile || undefined);
      setInputValue('');
      onTyping(''); 
      clearFile();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputValue(e.target.value); 
      onTyping(e.target.value);
      
      // Play typing sound effect
      if (typingSoundRef.current) {
          typingSoundRef.current.currentTime = 0;
          typingSoundRef.current.play().catch(() => {});
      }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSend();
      }
  };

  // Sound Effect for Incoming Admin Messages
  useEffect(() => {
      if (messages.length > 0) {
          const lastMsg = messages[messages.length - 1];
          if (lastMsg.sender === SenderType.ADMIN || lastMsg.sender === SenderType.BOT) {
              if (incomingSoundRef.current) {
                  incomingSoundRef.current.currentTime = 0;
                  incomingSoundRef.current.play().catch(e => console.log("Audio play blocked until interaction"));
              }
          }
      }
  }, [messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isOpen, adminTyping]);

  // CSS class cho cửa sổ chat popup
  const windowClass = `
      fixed z-[100] transition-all duration-300 ease-in-out shadow-2xl flex flex-col overflow-hidden bg-white dark:bg-[#1E2329]
      ${embedded ? 'relative w-full h-full' : 'bottom-0 right-0 md:bottom-6 md:right-6 w-full h-[100dvh] md:w-[400px] md:h-[600px] md:rounded-2xl border border-gray-200 dark:border-gray-800'}
      ${!embedded && !isOpen ? 'opacity-0 translate-y-10 pointer-events-none scale-95' : 'opacity-100 translate-y-0 scale-100'}
  `;

  if (!isOpen && !embedded) return null;

  return (
    <>
      {zoomedImage && (
          <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4" onClick={() => setZoomedImage(null)}>
              <button className="absolute top-4 right-4 text-white"><XIcon className="w-8 h-8" /></button>
              <img src={zoomedImage} alt="Zoomed" className="max-w-full max-h-full rounded-lg" />
          </div>
      )}

      <div className={windowClass}>
        {/* HEADER - Black Background like Binance */}
        <div className="bg-[#1E2329] p-4 flex items-center justify-between text-white shrink-0">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#FCD535] rounded-full flex items-center justify-center text-black">
                    <BinanceIconB className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="font-bold text-sm">Binance Support</h3>
                    <p className="text-xs text-gray-400">CS Agent • Online</p>
                </div>
            </div>
            {!embedded && (
                <div className="flex items-center gap-2">
                     <button onClick={onToggle} className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors">
                        <MinusIcon className="w-6 h-6" />
                    </button>
                </div>
            )}
        </div>

        {/* ADMIN NOTES (System Message) */}
        {adminNotes && (
          <div className="bg-[#FEF6D8] dark:bg-[#332A00] p-3 text-xs text-[#986E04] dark:text-[#FCD535] font-medium border-b border-[#FBE69E] dark:border-[#4D3F00] flex items-center gap-2">
            <BinanceIconB className="w-4 h-4 shrink-0" />
            <span>{adminNotes}</span>
          </div>
        )}

        {/* MESSAGES AREA */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#F5F5F5] dark:bg-[#0B0E11] space-y-4">
            {messages.length === 0 && (
                <div className="text-center mt-10">
                    <p className="text-sm text-gray-500">Welcome to Binance Support.</p>
                    <p className="text-xs text-gray-400 mt-1">Start chatting with us below.</p>
                </div>
            )}
            
            {messages.map((msg) => {
                const isCustomer = msg.sender === SenderType.CUSTOMER;
                return (
                    <div key={msg.id} className={`flex w-full ${isCustomer ? 'justify-end' : 'justify-start'}`}>
                        {!isCustomer && (
                            <div className="w-8 h-8 rounded-full bg-[#1E2329] flex items-center justify-center text-[#FCD535] mr-2 shrink-0 self-end mb-1">
                                <AdminAvatarIcon className="w-5 h-5" />
                            </div>
                        )}
                        <div className={`max-w-[80%] flex flex-col ${isCustomer ? 'items-end' : 'items-start'}`}>
                            <div className={`p-3 text-sm shadow-sm break-words relative group ${
                                isCustomer 
                                ? 'bg-[#FCD535] text-[#1E2329] rounded-2xl rounded-tr-sm' 
                                : 'bg-white dark:bg-[#1E2329] text-[#1E2329] dark:text-white border border-gray-200 dark:border-gray-700 rounded-2xl rounded-tl-sm'
                            }`}>
                                {msg.attachment && (
                                    <div className="mb-2 rounded-lg overflow-hidden">
                                        {msg.attachment.type === 'image' ? (
                                            <img src={msg.attachment.url} onClick={() => setZoomedImage(msg.attachment!.url)} className="max-w-full h-auto max-h-40 object-cover cursor-zoom-in" alt="att" />
                                        ) : (
                                            <video src={msg.attachment.url} controls className="max-w-full h-auto max-h-40" />
                                        )}
                                    </div>
                                )}
                                {msg.text}
                            </div>
                            <span className="text-[10px] text-gray-400 mt-1 px-1">
                                {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                        </div>
                    </div>
                )
            })}
             
             {/* ADMIN TYPING INDICATOR (3 DOTS) */}
             {adminTyping && (
                <div className="flex justify-start items-center gap-2">
                     <div className="w-8 h-8 rounded-full bg-[#1E2329] flex items-center justify-center text-[#FCD535]">
                         <AdminAvatarIcon className="w-5 h-5" />
                     </div>
                     <div className="bg-white dark:bg-[#1E2329] p-4 rounded-2xl rounded-tl-sm border border-gray-200 dark:border-gray-700 shadow-sm">
                         <div className="flex gap-1.5 h-3 items-center">
                             <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                             <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                             <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                         </div>
                     </div>
                </div>
             )}
            <div ref={messagesEndRef} />
        </div>

        {/* INPUT AREA */}
        <div className="p-3 bg-white dark:bg-[#1E2329] border-t border-gray-200 dark:border-gray-800">
             {filePreview && (
                <div className="flex items-center gap-2 mb-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    <img src={filePreview} className="w-10 h-10 object-cover rounded" alt="Preview" />
                    <span className="text-xs text-gray-500 truncate flex-1">{selectedFile?.name}</span>
                    <button onClick={clearFile} className="p-1 hover:bg-gray-200 rounded-full"><XIcon className="w-4 h-4" /></button>
                </div>
            )}
            <div className="flex items-end gap-2">
                <button onClick={() => fileInputRef.current?.click()} className="p-3 text-gray-400 hover:text-[#FCD535] transition-colors">
                    <PaperclipIcon className="w-6 h-6" />
                </button>
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} accept="image/*,video/*" />
                
                <textarea 
                    value={inputValue}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    className="flex-1 bg-gray-50 dark:bg-[#0B0E11] text-[#1E2329] dark:text-white rounded-xl p-3 text-sm outline-none focus:ring-1 focus:ring-[#FCD535] resize-none max-h-32"
                    rows={1}
                />
                
                <button 
                    onClick={handleSend}
                    disabled={!inputValue.trim() && !selectedFile}
                    className={`p-3 rounded-xl transition-all ${inputValue.trim() || selectedFile ? 'bg-[#FCD535] text-[#1E2329] shadow-md hover:bg-[#F0B90B]' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}
                >
                    <SendIcon className="w-6 h-6" />
                </button>
            </div>
        </div>
      </div>
    </>
  );
};

export default CustomerChatWidget;
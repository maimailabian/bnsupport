
import React, { useState, useEffect, useRef } from 'react';
import { Ticket, Message, SenderType, TicketStatus, CustomerProfile, TicketPost, PostComment, DefaultPostConfig } from '../types';
import { SendIcon, SearchIcon, UserIcon, XIcon, MessageSquareIcon, SettingsIcon, LayoutListIcon, PaperclipIcon, BinanceFullLogo, ShieldCheckIcon, BinanceIconB, AdminAvatarIcon, GlobeIcon, TicketIcon, LockIcon, ActivityIcon, BotIcon } from './Icons';
import { checkTelegramConnection, sendTelegramMessage, sendSimpleTelegramMessage } from '../services/telegramService';
import { analyzeDataForTelegram } from '../services/geminiService';

interface AdminDashboardProps {
  tickets: Ticket[];
  messages: Message[];
  onAdminSendMessage: (ticketId: string, text: string, file?: File) => void;
  currentTicketId: string | null;
  onSelectTicket: (id: string) => void;
  onSaveConfig: (botToken: string, groupId: string, sheetUrl: string, geminiApiKey: string, telegramUserId: string, supabaseUrl: string, supabaseKey: string) => void;
  onUpdateProfile: (ticketId: string, profile: Partial<CustomerProfile>) => void;
  onUpdateTicket: (ticketId: string, updates: Partial<Ticket>) => void;
  onAddPost: (ticketId: string, post: Omit<TicketPost, 'id' | 'timestamp' | 'comments'>) => void;
  onAddComment: (ticketId: string, postId: string, comment: Omit<PostComment, 'id' | 'timestamp'>) => void;
  onCreateTicket: (subject: string, description: string) => void; 
  onCloseTicket: (ticketId: string) => void;
  onApproveProfile: (ticketId: string) => void;
  onRejectProfile: (ticketId: string) => void;
  onFullCreateTicket?: (ticket: Ticket) => void; 
  initialConfig: { botToken: string, groupId: string, sheetUrl: string, geminiApiKey: string, telegramUserId: string, supabaseUrl?: string, supabaseKey?: string };
  isDarkMode: boolean;
  defaultPostConfig?: DefaultPostConfig;
  onSaveDefaultPost?: (config: DefaultPostConfig) => void;
  onAdminTyping?: (ticketId: string, isTyping: boolean) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  tickets, messages, onAdminSendMessage, currentTicketId, onSelectTicket, onUpdateTicket, onSaveConfig, onUpdateProfile, onApproveProfile, onRejectProfile, initialConfig, onFullCreateTicket, onAddPost,
  defaultPostConfig, onSaveDefaultPost, onAdminTyping, isDarkMode
}) => {
  const [activeTab, setActiveTab] = useState<'console' | 'tickets' | 'settings' | 'timeline' | 'traffic'>('console');
  // Ticket Filter State
  const [ticketFilter, setTicketFilter] = useState<'all' | 'unread' | 'open' | 'resolved'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const typingTimeoutRef = useRef<any>(null);
  
  const [showPostModal, setShowPostModal] = useState(false);
  const [postForm, setPostForm] = useState({ subject: '', content: '' });

  const [configForm, setConfigForm] = useState({
      botToken: initialConfig.botToken,
      groupId: initialConfig.groupId,
      sheetUrl: initialConfig.sheetUrl,
      geminiApiKey: initialConfig.geminiApiKey,
      telegramUserId: initialConfig.telegramUserId,
      supabaseUrl: initialConfig.supabaseUrl || '',
      supabaseKey: initialConfig.supabaseKey || ''
  });

  const [editProfileForm, setEditProfileForm] = useState<Partial<CustomerProfile>>({});
  const [adminNoteInput, setAdminNoteInput] = useState('');

  // Default Post Editing State
  const [defaultPostForm, setDefaultPostForm] = useState<DefaultPostConfig>({
      authorName: 'Binance Support',
      subject: '',
      content: '',
      image: ''
  });

  // Initialize form when defaultPostConfig changes
  useEffect(() => {
      if (defaultPostConfig) {
          setDefaultPostForm(defaultPostConfig);
      }
  }, [defaultPostConfig]);

  const [newTicketForm, setNewTicketForm] = useState({
      caseId: '',
      rawSheetData: '',
      result: ''
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const defaultPostImageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Moved up to avoid TDZ (Temporal Dead Zone) error in useEffect
  const activeTicket = tickets.find(t => t.id === currentTicketId);
  const activeMessages = messages.filter(m => m.ticketId === currentTicketId);

  // Filter and Sort Tickets Logic (Zendesk Style)
  const filteredTickets = tickets
    .filter(t => {
        if (t.status === TicketStatus.ARCHIVED) return false;
        const matchesSearch = t.customerName.toLowerCase().includes(searchQuery.toLowerCase()) || t.id.includes(searchQuery);
        if (!matchesSearch) return false;

        if (ticketFilter === 'unread') return t.unreadCount > 0;
        if (ticketFilter === 'open') return t.status === TicketStatus.OPEN;
        if (ticketFilter === 'resolved') return t.status === TicketStatus.RESOLVED;
        return true;
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const generateRandomCaseId = () => {
      const randomNum = Math.floor(100000 + Math.random() * 900000);
      setNewTicketForm(prev => ({ ...prev, caseId: `caseid-${randomNum}` }));
  };

  useEffect(() => {
      generateRandomCaseId();
  }, []);

  useEffect(() => {
    if (activeTicket) {
        setAdminNoteInput(activeTicket.adminNotes || '');
        setEditProfileForm(activeTicket.profile || {});
    }
  }, [currentTicketId, activeTicket]);

  useEffect(() => { 
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); 
  }, [activeMessages.length, currentTicketId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputText(e.target.value);
      if (currentTicketId && onAdminTyping) {
          onAdminTyping(currentTicketId, true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => {
              onAdminTyping(currentTicketId, false);
          }, 2000);
      }
  };

  const handleSend = () => {
    if ((inputText.trim() || selectedFile) && currentTicketId) {
      onAdminSendMessage(currentTicketId, inputText, selectedFile || undefined);
      setInputText('');
      setSelectedFile(null);
      setFilePreview(null);
      if (onAdminTyping) onAdminTyping(currentTicketId, false);
    }
  };

  const handleCreatePost = () => {
      if (!currentTicketId || !postForm.subject || !postForm.content) return;
      onAddPost(currentTicketId, {
          authorName: 'Binance Support',
          authorRole: 'admin',
          subject: postForm.subject,
          content: postForm.content
      });
      setShowPostModal(false);
      setPostForm({ subject: '', content: '' });
      alert("Đã đăng bài thành công!");
  };

  const handleLiveUpdateProfile = () => {
      if (currentTicketId && editProfileForm) {
          onUpdateProfile(currentTicketId, editProfileForm);
          if (editProfileForm.fullName) {
              onUpdateTicket(currentTicketId, { customerName: editProfileForm.fullName });
          }
          alert("Đã cập nhật thông tin khách hàng thành công!");
      }
  };

  // Helper to convert file to base64 for local storage persistence
  const handleDefaultPostImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          if (file.size > 2 * 1024 * 1024) {
              alert("Ảnh quá lớn! Vui lòng chọn ảnh < 2MB để lưu vào bộ nhớ trình duyệt.");
              return;
          }
          const reader = new FileReader();
          reader.onloadend = () => {
              setDefaultPostForm(prev => ({ ...prev, image: reader.result as string }));
          };
          reader.readAsDataURL(file);
      }
  };

  const handleSaveDefaultPostSubmit = () => {
      if (onSaveDefaultPost) {
          onSaveDefaultPost(defaultPostForm);
      }
  };

  // Helper to calculate duration
  const getDuration = (start?: Date, end?: Date) => {
      if (!start) return '--';
      const endTime = end || new Date();
      const diffMs = endTime.getTime() - new Date(start).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return "Vừa truy cập";
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      if (hours > 0) return `${hours}h ${mins}m`;
      return `${mins}m`;
  };

  // Country Flag Helper
  const getFlagUrl = (countryCode?: string) => {
      if (!countryCode) return null;
      return `https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`;
  };

  return (
    <div className={`h-full overflow-hidden ${isDarkMode ? 'dark bg-[#0B0E11] text-[#EAECEF]' : 'bg-gray-50 text-[#1E2329]'} font-sans flex flex-col md:flex-row`}>
      {/* SIDEBAR */}
      <div className="w-full md:w-16 lg:w-20 bg-[#1E2329] flex flex-row md:flex-col items-center py-4 md:py-6 gap-6 md:gap-8 z-50 shrink-0 overflow-x-auto md:overflow-visible border-r border-gray-800 md:h-full">
        <div className="w-8 h-8 md:w-10 md:h-10 text-[#FCD535] shrink-0 mb-0 md:mb-4 mx-4 md:mx-0">
          <BinanceIconB className="w-full h-full" />
        </div>
        
        <div className="flex flex-row md:flex-col gap-2 w-full px-2 md:px-0 justify-center">
            <button onClick={() => setActiveTab('console')} className={`p-3 rounded-xl transition-all ${activeTab === 'console' ? 'bg-[#2B3139] text-[#FCD535]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`} title="Dashboard">
                <LayoutListIcon className="w-6 h-6" />
            </button>
            <button onClick={() => setActiveTab('settings')} className={`p-3 rounded-xl transition-all ${activeTab === 'settings' ? 'bg-[#2B3139] text-[#FCD535]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`} title="Settings">
                <SettingsIcon className="w-6 h-6" />
            </button>
             <button onClick={() => setActiveTab('traffic')} className={`p-3 rounded-xl transition-all ${activeTab === 'traffic' ? 'bg-[#2B3139] text-[#FCD535]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`} title="Live Traffic">
                <GlobeIcon className="w-6 h-6" />
            </button>
        </div>
        
        <div className="mt-auto mb-4 hidden md:flex flex-col items-center gap-4">
             <div className="w-8 h-8 rounded-full bg-[#2B3139] flex items-center justify-center text-gray-400 text-xs font-bold border border-gray-700">A</div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* VIEW: SETTINGS */}
        {activeTab === 'settings' && (
            <div className="flex-1 p-6 lg:p-10 overflow-y-auto bg-[#0B0E11] text-white">
                <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
                    <SettingsIcon className="w-8 h-8 text-[#FCD535]" /> System Configuration
                </h2>

                <div className="max-w-4xl space-y-8 pb-20">
                     {/* TELEGRAM CONFIG */}
                     <div className="bg-[#1E2329] p-6 rounded-2xl border border-gray-800 shadow-lg">
                        <h3 className="text-lg font-bold mb-4 text-[#FCD535] border-b border-gray-700 pb-2">Telegram Integration</h3>
                        <div className="grid gap-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Bot Token</label>
                                <input className="w-full p-3 bg-[#0B0E11] border border-gray-700 rounded-lg focus:border-[#FCD535] outline-none transition-colors font-mono text-sm" value={configForm.botToken} onChange={e => setConfigForm({...configForm, botToken: e.target.value})} placeholder="123456:ABC-DEF..." />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Group ID (Admin Chat)</label>
                                    <input className="w-full p-3 bg-[#0B0E11] border border-gray-700 rounded-lg focus:border-[#FCD535] outline-none transition-colors font-mono text-sm" value={configForm.groupId} onChange={e => setConfigForm({...configForm, groupId: e.target.value})} placeholder="-100..." />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Telegram User ID (Reports)</label>
                                    <input className="w-full p-3 bg-[#0B0E11] border border-gray-700 rounded-lg focus:border-[#FCD535] outline-none transition-colors font-mono text-sm" value={configForm.telegramUserId} onChange={e => setConfigForm({...configForm, telegramUserId: e.target.value})} placeholder="user_id" />
                                </div>
                            </div>
                            <button onClick={() => checkTelegramConnection(configForm).then(r => alert(r.message))} className="px-4 py-2 bg-[#2B3139] hover:bg-[#333a42] text-white rounded-lg text-sm font-bold border border-gray-600 self-start">Test Telegram Connection</button>
                        </div>
                    </div>

                    {/* SUPABASE CONFIG (NEW) */}
                    <div className="bg-[#1E2329] p-6 rounded-2xl border border-gray-800 shadow-lg">
                        <h3 className="text-lg font-bold mb-4 text-[#44e0b3] border-b border-gray-700 pb-2">Supabase Database (Cloud Storage)</h3>
                         <p className="text-sm text-gray-400 mb-4">Kết nối Supabase để lưu trữ dữ liệu vĩnh viễn trên Cloud. Nếu để trống, hệ thống sẽ dùng LocalStorage (chỉ lưu trên trình duyệt).</p>
                        <div className="grid gap-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Supabase URL</label>
                                <input className="w-full p-3 bg-[#0B0E11] border border-gray-700 rounded-lg focus:border-[#44e0b3] outline-none transition-colors font-mono text-sm" value={configForm.supabaseUrl} onChange={e => setConfigForm({...configForm, supabaseUrl: e.target.value})} placeholder="https://xyz.supabase.co" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Supabase Anon Key</label>
                                <input type="password" className="w-full p-3 bg-[#0B0E11] border border-gray-700 rounded-lg focus:border-[#44e0b3] outline-none transition-colors font-mono text-sm" value={configForm.supabaseKey} onChange={e => setConfigForm({...configForm, supabaseKey: e.target.value})} placeholder="eyJhbG..." />
                            </div>
                        </div>
                    </div>

                    {/* AI & GOOGLE */}
                    <div className="bg-[#1E2329] p-6 rounded-2xl border border-gray-800 shadow-lg">
                        <h3 className="text-lg font-bold mb-4 text-[#FCD535] border-b border-gray-700 pb-2">Google & AI Integration</h3>
                        <div className="grid gap-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Google Gemini API Key</label>
                                <input type="password" className="w-full p-3 bg-[#0B0E11] border border-gray-700 rounded-lg focus:border-[#FCD535] outline-none transition-colors font-mono text-sm" value={configForm.geminiApiKey} onChange={e => setConfigForm({...configForm, geminiApiKey: e.target.value})} placeholder="AIza..." />
                            </div>
                             <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Google Sheet CSV URL (Optional)</label>
                                <input className="w-full p-3 bg-[#0B0E11] border border-gray-700 rounded-lg focus:border-[#FCD535] outline-none transition-colors font-mono text-sm" value={configForm.sheetUrl} onChange={e => setConfigForm({...configForm, sheetUrl: e.target.value})} placeholder="https://docs.google.com..." />
                            </div>
                        </div>
                    </div>
                    
                    {/* DEFAULT POST SETTINGS */}
                    <div className="bg-[#1E2329] p-6 rounded-2xl border border-gray-800 shadow-lg">
                        <h3 className="text-lg font-bold mb-4 text-[#FCD535] border-b border-gray-700 pb-2">Cấu hình Bài viết Mặc định</h3>
                        <div className="grid gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Tên hiển thị (Author Name)</label>
                                <input className="w-full p-3 bg-[#0B0E11] border border-gray-700 rounded-lg focus:border-[#FCD535] outline-none text-sm" value={defaultPostForm.authorName} onChange={e => setDefaultPostForm({...defaultPostForm, authorName: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Tiêu đề bài viết (Subject)</label>
                                <input className="w-full p-3 bg-[#0B0E11] border border-gray-700 rounded-lg focus:border-[#FCD535] outline-none text-sm" value={defaultPostForm.subject} onChange={e => setDefaultPostForm({...defaultPostForm, subject: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Nội dung bài viết (Content)</label>
                                <textarea className="w-full p-3 bg-[#0B0E11] border border-gray-700 rounded-lg focus:border-[#FCD535] outline-none text-sm h-24" value={defaultPostForm.content} onChange={e => setDefaultPostForm({...defaultPostForm, content: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Hình ảnh mặc định (Image)</label>
                                <input type="file" ref={defaultPostImageInputRef} className="hidden" onChange={handleDefaultPostImageUpload} accept="image/*" />
                                <div className="flex gap-4 items-center">
                                    <button onClick={() => defaultPostImageInputRef.current?.click()} className="px-4 py-2 bg-gray-700 rounded text-sm hover:bg-gray-600">Chọn ảnh</button>
                                    {defaultPostForm.image && <img src={defaultPostForm.image} alt="Preview" className="h-10 w-10 object-cover rounded" />}
                                    {defaultPostForm.image && <button onClick={() => setDefaultPostForm({...defaultPostForm, image: ''})} className="text-red-500 text-sm">Xóa</button>}
                                </div>
                            </div>
                             <button onClick={handleSaveDefaultPostSubmit} className="px-4 py-2 bg-[#FCD535] text-black font-bold rounded-lg hover:bg-[#F0B90B] self-start mt-2">Lưu cấu hình bài viết</button>
                        </div>
                    </div>

                    {/* ACTIONS */}
                    <div className="flex justify-end gap-4 pt-4 sticky bottom-0 bg-[#0B0E11] py-4 border-t border-gray-800">
                        <button onClick={() => setActiveTab('console')} className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg">Cancel</button>
                        <button onClick={() => onSaveConfig(configForm.botToken, configForm.groupId, configForm.sheetUrl, configForm.geminiApiKey, configForm.telegramUserId, configForm.supabaseUrl, configForm.supabaseKey)} className="px-8 py-3 bg-[#FCD535] hover:bg-[#F0B90B] text-black font-bold rounded-lg shadow-lg hover:shadow-xl transition-all">Save Configuration</button>
                    </div>
                </div>
            </div>
        )}

         {/* VIEW: LIVE TRAFFIC MONITOR */}
        {activeTab === 'traffic' && (
            <div className="flex-1 p-6 lg:p-10 overflow-y-auto bg-[#0B0E11] text-white">
                <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
                    <GlobeIcon className="w-8 h-8 text-[#FCD535]" /> Realtime Visitor Monitor
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                    {tickets.map(ticket => (
                        <div key={ticket.id} className="bg-[#1E2329] border border-gray-800 rounded-xl p-6 relative overflow-hidden group hover:border-[#FCD535] transition-colors cursor-pointer" onClick={() => { onSelectTicket(ticket.id); setActiveTab('console'); }}>
                             <div className="absolute top-0 right-0 p-4">
                                 {ticket.customerInfo?.countryCode ? (
                                     <img src={getFlagUrl(ticket.customerInfo.countryCode) || ''} alt={ticket.customerInfo.country} className="w-8 h-auto shadow-sm" title={ticket.customerInfo.country} />
                                 ) : (
                                     <GlobeIcon className="w-6 h-6 text-gray-600" />
                                 )}
                             </div>
                             
                             <div className="flex items-center gap-4 mb-4">
                                 <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${ticket.status === 'open' ? 'bg-green-500/20 text-green-500' : 'bg-gray-700 text-gray-400'}`}>
                                     {ticket.customerName.charAt(0).toUpperCase()}
                                 </div>
                                 <div>
                                     <h3 className="font-bold text-lg truncate max-w-[150px]">{ticket.customerName}</h3>
                                     <p className="text-xs text-gray-400 font-mono">ID: {ticket.id}</p>
                                 </div>
                             </div>

                             <div className="space-y-2 text-sm text-gray-400">
                                 <div className="flex justify-between">
                                     <span>Location:</span>
                                     <span className="text-white">{ticket.customerInfo?.city || 'Unknown'}, {ticket.customerInfo?.country || 'Unknown'}</span>
                                 </div>
                                 <div className="flex justify-between">
                                     <span>IP Address:</span>
                                     <span className="font-mono text-gray-500">{ticket.customerInfo?.ip || '---'}</span>
                                 </div>
                                 <div className="flex justify-between">
                                     <span>Platform:</span>
                                     <span className="text-white">{ticket.customerInfo?.os || 'Web'}</span>
                                 </div>
                                 <div className="flex justify-between">
                                     <span>Active:</span>
                                     <span className="text-[#FCD535]">{getDuration(ticket.updatedAt)} ago</span>
                                 </div>
                             </div>
                             
                             <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between items-center">
                                 <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${ticket.status === 'open' ? 'bg-green-900/50 text-green-400' : 'bg-gray-700 text-gray-400'}`}>{ticket.status}</span>
                                 {ticket.unreadCount > 0 && <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full animate-pulse">{ticket.unreadCount} new msg</span>}
                             </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* VIEW: CONSOLE (MESSAGES) */}
        {activeTab === 'console' && (
            <>
                {/* TICKET LIST */}
                <div className="w-full md:w-80 lg:w-96 bg-[#161A1E] border-r border-gray-800 flex flex-col shrink-0 z-30 h-full overflow-hidden">
                    <div className="p-4 border-b border-gray-800 shrink-0">
                        <h2 className="text-lg font-bold text-white mb-4 px-2">Inbox</h2>
                        <div className="relative mb-4">
                            <input 
                                className="w-full bg-[#2B3139] text-white rounded-lg pl-10 pr-4 py-2 text-sm outline-none focus:ring-1 focus:ring-[#FCD535]"
                                placeholder="Search case ID or name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <SearchIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                            {['all', 'unread', 'open', 'resolved'].map(f => (
                                <button 
                                    key={f}
                                    onClick={() => setTicketFilter(f as any)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize whitespace-nowrap transition-colors ${ticketFilter === f ? 'bg-[#FCD535] text-black' : 'bg-[#2B3139] text-gray-400 hover:bg-gray-700'}`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {filteredTickets.map(ticket => (
                            <div 
                                key={ticket.id}
                                onClick={() => onSelectTicket(ticket.id)}
                                className={`p-4 border-b border-gray-800 cursor-pointer transition-all hover:bg-[#2B3139] ${currentTicketId === ticket.id ? 'bg-[#2B3139] border-l-4 border-l-[#FCD535]' : 'border-l-4 border-l-transparent'}`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <div className="flex items-center gap-2">
                                        {ticket.customerInfo?.countryCode && <img src={getFlagUrl(ticket.customerInfo.countryCode) || ''} className="w-4 h-auto rounded-sm" alt="flag" />}
                                        <h3 className={`font-bold text-sm truncate max-w-[120px] ${ticket.unreadCount > 0 ? 'text-white' : 'text-gray-300'}`}>{ticket.customerName}</h3>
                                    </div>
                                    <span className="text-[10px] text-gray-500">{new Date(ticket.updatedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <p className="text-xs text-gray-400 truncate max-w-[180px]">{ticket.lastMessage || 'No messages yet'}</p>
                                    {ticket.unreadCount > 0 && (
                                        <span className="bg-[#FCD535] text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{ticket.unreadCount}</span>
                                    )}
                                </div>
                            </div>
                        ))}
                        {filteredTickets.length === 0 && (
                             <div className="p-8 text-center text-gray-500 text-sm">No tickets found</div>
                        )}
                    </div>
                </div>

                {/* CHAT AREA */}
                <div className="flex-1 flex flex-col bg-[#0B0E11] relative h-full overflow-hidden">
                    {activeTicket ? (
                        <>
                            {/* CHAT HEADER */}
                            <div className="h-16 px-6 border-b border-gray-800 flex justify-between items-center shrink-0 bg-[#1E2329]">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h2 className="font-bold text-white text-lg">{activeTicket.customerName}</h2>
                                        {activeTicket.customerInfo?.countryCode && (
                                            <span className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300 flex items-center gap-1">
                                                <img src={getFlagUrl(activeTicket.customerInfo.countryCode) || ''} className="w-4" alt="flag" />
                                                {activeTicket.customerInfo.countryCode}
                                            </span>
                                        )}
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${activeTicket.status === 'open' ? 'bg-green-900 text-green-400' : 'bg-gray-700 text-gray-400'}`}>{activeTicket.status}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 font-mono mt-0.5">Case ID: {activeTicket.id} • IP: {activeTicket.customerInfo?.ip}</p>
                                </div>
                                <div className="flex gap-2">
                                     <button onClick={() => setShowPostModal(true)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg" title="Create Post">
                                         <TicketIcon className="w-5 h-5" />
                                     </button>
                                     <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg" title="Archive">
                                         <XIcon className="w-5 h-5" />
                                     </button>
                                </div>
                            </div>

                            {/* CHAT MESSAGES */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {activeMessages.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-50">
                                        <MessageSquareIcon className="w-12 h-12 mb-2" />
                                        <p>No messages yet</p>
                                    </div>
                                )}
                                
                                {activeMessages.map(msg => {
                                    const isAdmin = msg.sender === SenderType.ADMIN || msg.sender === SenderType.BOT;
                                    return (
                                        <div key={msg.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                                            {!isAdmin && (
                                                <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center mr-2 text-xs text-white shrink-0">
                                                    {activeTicket.customerName.charAt(0)}
                                                </div>
                                            )}
                                            <div className={`max-w-[70%] ${isAdmin ? 'items-end' : 'items-start'} flex flex-col`}>
                                                <div className={`p-3 rounded-2xl text-sm ${isAdmin ? 'bg-[#FCD535] text-black rounded-tr-sm' : 'bg-[#2B3139] text-white border border-gray-700 rounded-tl-sm'}`}>
                                                    {msg.attachment && (
                                                        <div className="mb-2">
                                                            {msg.attachment.type === 'image' ? (
                                                                <img src={msg.attachment.url} className="max-w-full rounded-lg" alt="att" />
                                                            ) : (
                                                                <video src={msg.attachment.url} controls className="max-w-full rounded-lg" />
                                                            )}
                                                        </div>
                                                    )}
                                                    <p className="whitespace-pre-wrap">{msg.text}</p>
                                                </div>
                                                <span className="text-[10px] text-gray-500 mt-1 px-1">
                                                    {new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} • {isAdmin ? 'You' : 'Customer'}
                                                </span>
                                            </div>
                                            {isAdmin && (
                                                <div className="w-8 h-8 bg-[#2B3139] border border-gray-700 rounded-full flex items-center justify-center ml-2 text-[#FCD535] shrink-0">
                                                    <AdminAvatarIcon className="w-5 h-5" />
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* INPUT AREA */}
                            <div className="p-4 bg-[#1E2329] border-t border-gray-800 shrink-0">
                                {filePreview && (
                                    <div className="flex items-center gap-2 mb-2 p-2 bg-[#0B0E11] rounded border border-gray-700 w-fit">
                                        <img src={filePreview} className="w-8 h-8 object-cover rounded" alt="prev" />
                                        <span className="text-xs text-gray-400 max-w-[100px] truncate">{selectedFile?.name}</span>
                                        <button onClick={() => { setSelectedFile(null); setFilePreview(null); }} className="text-gray-500 hover:text-white"><XIcon className="w-4 h-4"/></button>
                                    </div>
                                )}
                                <div className="flex gap-2">
                                    <button onClick={() => fileInputRef.current?.click()} className="p-3 text-gray-400 hover:text-[#FCD535] hover:bg-[#2B3139] rounded-lg transition-colors">
                                        <PaperclipIcon className="w-6 h-6" />
                                    </button>
                                    <input type="file" ref={fileInputRef} className="hidden" onChange={e => {
                                        if (e.target.files?.[0]) {
                                            setSelectedFile(e.target.files[0]);
                                            setFilePreview(URL.createObjectURL(e.target.files[0]));
                                        }
                                    }} />
                                    
                                    <input 
                                        className="flex-1 bg-[#0B0E11] text-white rounded-lg px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-[#FCD535] border border-gray-800 focus:border-[#FCD535]"
                                        placeholder="Type your reply here..."
                                        value={inputText}
                                        onChange={handleInputChange}
                                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                                    />
                                    <button 
                                        onClick={handleSend}
                                        disabled={!inputText.trim() && !selectedFile}
                                        className={`p-3 rounded-lg font-bold transition-all ${inputText.trim() || selectedFile ? 'bg-[#FCD535] text-black hover:bg-[#F0B90B]' : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`}
                                    >
                                        <SendIcon className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-600">
                             <div className="w-20 h-20 bg-[#1E2329] rounded-full flex items-center justify-center mb-4">
                                 <BinanceIconB className="w-10 h-10 text-gray-500" />
                             </div>
                             <p>Select a ticket to start chatting</p>
                        </div>
                    )}
                </div>

                {/* RIGHT SIDEBAR (PROFILE & ACTIONS) */}
                {activeTicket && (
                    <div className="w-full md:w-80 border-l border-gray-800 bg-[#161A1E] flex flex-col shrink-0 h-full overflow-y-auto hidden lg:flex">
                        <div className="p-6 border-b border-gray-800 text-center shrink-0">
                            <div className="w-24 h-24 mx-auto bg-[#2B3139] rounded-full flex items-center justify-center text-3xl font-bold text-gray-500 mb-4 border-4 border-[#1E2329] relative">
                                {activeTicket.customerName.charAt(0)}
                                {activeTicket.profile?.fullName && <div className="absolute bottom-0 right-0 bg-green-500 w-6 h-6 rounded-full border-4 border-[#161A1E]" title="Verified"></div>}
                            </div>
                            <h2 className="text-xl font-bold text-white mb-1">{activeTicket.customerName}</h2>
                            <p className="text-sm text-gray-500">{activeTicket.profile?.email || 'No email provided'}</p>
                        </div>

                        {/* KYC / PROFILE SECTION */}
                        <div className="p-6 border-b border-gray-800">
                            <h3 className="text-xs font-bold text-gray-500 uppercase mb-4 flex items-center gap-2">
                                <ShieldCheckIcon className="w-4 h-4" /> Customer Profile (KYC)
                            </h3>
                            
                            {/* PENDING REQUEST */}
                            {activeTicket.pendingProfile ? (
                                <div className="bg-[#2B3139] rounded-lg p-4 border border-yellow-600/50 mb-4">
                                    <h4 className="text-[#FCD535] font-bold text-sm mb-2 flex items-center gap-2">⚠️ Yêu cầu cập nhật mới</h4>
                                    <div className="space-y-2 text-xs text-gray-300 mb-4">
                                        <p><span className="text-gray-500">Tên:</span> {activeTicket.pendingProfile.fullName}</p>
                                        <p><span className="text-gray-500">CCCD:</span> {activeTicket.pendingProfile.idCard}</p>
                                        <p><span className="text-gray-500">SĐT:</span> {activeTicket.pendingProfile.phone}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => onApproveProfile(activeTicket.id)} className="flex-1 py-2 bg-green-600 hover:bg-green-500 text-white rounded font-bold text-xs">Chấp thuận</button>
                                        <button onClick={() => onRejectProfile(activeTicket.id)} className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded font-bold text-xs">Từ chối</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="group">
                                        <label className="text-[10px] text-gray-500 uppercase font-bold">Full Name</label>
                                        <input className="w-full bg-transparent border-b border-gray-700 text-white text-sm py-1 focus:border-[#FCD535] outline-none" 
                                            value={editProfileForm.fullName || ''} 
                                            onChange={e => setEditProfileForm({...editProfileForm, fullName: e.target.value})} 
                                            placeholder="Empty"
                                        />
                                    </div>
                                    <div className="group">
                                        <label className="text-[10px] text-gray-500 uppercase font-bold">Email</label>
                                        <input className="w-full bg-transparent border-b border-gray-700 text-white text-sm py-1 focus:border-[#FCD535] outline-none" 
                                            value={editProfileForm.email || ''} 
                                            onChange={e => setEditProfileForm({...editProfileForm, email: e.target.value})} 
                                            placeholder="Empty"
                                        />
                                    </div>
                                    <div className="group">
                                        <label className="text-[10px] text-gray-500 uppercase font-bold">Phone</label>
                                        <input className="w-full bg-transparent border-b border-gray-700 text-white text-sm py-1 focus:border-[#FCD535] outline-none" 
                                            value={editProfileForm.phone || ''} 
                                            onChange={e => setEditProfileForm({...editProfileForm, phone: e.target.value})} 
                                            placeholder="Empty"
                                        />
                                    </div>
                                    <button onClick={handleLiveUpdateProfile} className="w-full py-2 bg-[#2B3139] hover:bg-[#353b44] text-[#FCD535] text-xs font-bold rounded border border-gray-700">
                                        Update Profile
                                    </button>
                                </div>
                            )}
                        </div>

                         {/* NOTES */}
                        <div className="p-6">
                            <h3 className="text-xs font-bold text-gray-500 uppercase mb-4">Admin Notes</h3>
                            <textarea 
                                className="w-full h-32 bg-[#0B0E11] border border-gray-700 rounded-lg p-3 text-sm text-white outline-none focus:border-[#FCD535] resize-none"
                                placeholder="Internal notes about this case..."
                                value={adminNoteInput}
                                onChange={e => setAdminNoteInput(e.target.value)}
                                onBlur={() => onUpdateTicket(activeTicket.id, { adminNotes: adminNoteInput })}
                            />
                        </div>
                    </div>
                )}
            </>
        )}

        {/* MODAL: CREATE POST */}
        {showPostModal && (
            <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
                <div className="bg-[#1E2329] w-full max-w-lg rounded-2xl border border-gray-700 shadow-2xl p-6">
                    <h3 className="text-xl font-bold text-white mb-6">Create New Support Post</h3>
                    <div className="space-y-4">
                         <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Subject</label>
                            <input className="w-full p-3 bg-[#0B0E11] border border-gray-700 rounded-lg text-white outline-none focus:border-[#FCD535]" 
                                value={postForm.subject} onChange={e => setPostForm({...postForm, subject: e.target.value})} placeholder="e.g., Account Verification Required" autoFocus
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Content</label>
                            <textarea className="w-full h-32 p-3 bg-[#0B0E11] border border-gray-700 rounded-lg text-white outline-none focus:border-[#FCD535] resize-none" 
                                value={postForm.content} onChange={e => setPostForm({...postForm, content: e.target.value})} placeholder="Write your announcement here..."
                            />
                        </div>
                        <div className="flex justify-end gap-3 mt-4">
                            <button onClick={() => setShowPostModal(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
                            <button onClick={handleCreatePost} className="px-6 py-2 bg-[#FCD535] text-black font-bold rounded-lg hover:bg-[#F0B90B]">Post to User</button>
                        </div>
                    </div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default AdminDashboard;

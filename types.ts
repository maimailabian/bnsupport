
export enum SenderType {
  CUSTOMER = 'customer',
  ADMIN = 'admin',
  BOT = 'bot'
}

export enum TicketStatus {
  OPEN = 'open',
  PENDING = 'pending',
  RESOLVED = 'resolved',
  ARCHIVED = 'archived'
}

export interface Message {
  id: string;
  ticketId: string;
  text: string;
  sender: SenderType;
  timestamp: Date;
  isTelegramSync?: boolean;
  telegramMessageId?: number;
  attachment?: {
    type: 'image' | 'video';
    url: string;
  };
}

export interface CustomerInfo {
  browser: string;
  os: string;
  device: string;
  ip?: string;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string; // Mới thêm: Mã quốc gia (VN, US...)
  isp?: string;
  lat?: number;
  long?: number;
}

export interface AccessLog {
    id: string;
    ticketId: string;
    ip: string;
    location: string;
    device: string;
    startTime: Date;
    lastActive: Date;
    duration: string; // Calculated string like "5m 30s"
}

export interface CustomerProfile {
  fullName: string;
  email: string;
  phone: string;
  trustedDevice: string;
  dob?: string;
  idCard?: string;
  idIssueDate?: string;
  address?: string;
}

export interface PostComment {
  id: string;
  authorName: string;
  authorRole: 'admin' | 'customer';
  content: string;
  image?: string; 
  timestamp: Date;
}

export interface TicketPost {
  id: string;
  authorName: string;
  authorRole: 'admin' | 'customer';
  subject: string;
  content: string;
  image?: string; 
  timestamp: Date;
  comments: PostComment[];
}

export interface DefaultPostConfig {
  authorName: string;
  subject: string;
  content: string;
  image?: string;
}

export interface Ticket {
  id: string;
  customerName: string;
  subject: string;
  description?: string; 
  featuredImage?: string; 
  posts: TicketPost[]; 
  priority: 'low' | 'medium' | 'high';
  status: TicketStatus;
  lastMessage: string;
  createdAt?: Date; // Added for duration tracking
  updatedAt: Date;
  telegramTopicId?: number; 
  unreadCount: number;
  customerInfo?: CustomerInfo;
  profile?: CustomerProfile;
  pendingProfile?: Partial<CustomerProfile>; 
  adminNotes?: string;
  typingPreview?: string; 
  adminTyping?: boolean; 
  rawSheetData?: string; 
}
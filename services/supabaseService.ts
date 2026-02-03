
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Ticket, Message } from '../types';

let supabaseInstance: SupabaseClient | null = null;

export const initSupabase = (url: string, key: string) => {
    if (!url || !key) return null;
    try {
        supabaseInstance = createClient(url, key);
        return supabaseInstance;
    } catch (e) {
        console.error("Supabase Init Error:", e);
        return null;
    }
};

export const getSupabase = () => supabaseInstance;

// --- TICKETS ---

export const syncTicketToSupabase = async (ticket: Ticket) => {
    const sb = getSupabase();
    if (!sb) return;

    // Convert Ticket object to match DB columns (snake_case)
    const payload = {
        id: ticket.id,
        customer_name: ticket.customerName,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        updated_at: ticket.updatedAt.toISOString(),
        customer_info: ticket.customerInfo,
        profile: ticket.profile,
        telegram_topic_id: ticket.telegramTopicId
    };

    const { error } = await sb.from('tickets').upsert(payload);
    if (error) console.error("Sync Ticket Error:", error);
};

export const fetchTicketsFromSupabase = async (): Promise<Ticket[]> => {
    const sb = getSupabase();
    if (!sb) return [];

    const { data, error } = await sb.from('tickets').select('*').order('updated_at', { ascending: false });
    if (error || !data) {
        console.error("Fetch Tickets Error:", error);
        return [];
    }

    return data.map((d: any) => ({
        id: d.id,
        customerName: d.customer_name,
        subject: d.subject,
        status: d.status,
        priority: d.priority,
        createdAt: d.created_at ? new Date(d.created_at) : new Date(),
        updatedAt: d.updated_at ? new Date(d.updated_at) : new Date(),
        unreadCount: 0, // Calculated client-side
        lastMessage: '', // Populated via message fetch or separate join
        customerInfo: d.customer_info,
        profile: d.profile,
        telegramTopicId: d.telegram_topic_id,
        posts: [] // Posts logic can be added later
    }));
};

// --- MESSAGES ---

export const syncMessageToSupabase = async (message: Message) => {
    const sb = getSupabase();
    if (!sb) return;

    const payload = {
        id: message.id,
        ticket_id: message.ticketId,
        text: message.text,
        sender: message.sender,
        timestamp: message.timestamp.toISOString(),
        attachment: message.attachment
    };

    const { error } = await sb.from('messages').upsert(payload);
    if (error) console.error("Sync Message Error:", error);
};

export const fetchMessagesFromSupabase = async (ticketId: string): Promise<Message[]> => {
    const sb = getSupabase();
    if (!sb) return [];

    const { data, error } = await sb.from('messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('timestamp', { ascending: true });
        
    if (error || !data) return [];

    return data.map((d: any) => ({
        id: d.id,
        ticketId: d.ticket_id,
        text: d.text,
        sender: d.sender,
        timestamp: new Date(d.timestamp),
        attachment: d.attachment
    }));
};

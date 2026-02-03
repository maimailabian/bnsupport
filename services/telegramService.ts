
// Dịch vụ giao tiếp với Telegram Bot API
const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

interface TelegramConfig {
  botToken: string;
  groupId: string;
}

// Lưu trữ offset để không lấy lại tin nhắn cũ khi polling
let lastUpdateId = 0;

/**
 * Helper: Parse JSON an toàn
 */
const safeParseJSON = async (response: Response) => {
    try {
        const text = await response.text();
        try { return JSON.parse(text); } catch (e) { return null; }
    } catch (e) { return null; }
};

export const checkTelegramConnection = async (config: TelegramConfig): Promise<{ success: boolean; message: string }> => {
  if (!config.botToken || !config.groupId) {
    return { success: false, message: 'Vui lòng nhập Token và Group ID' };
  }
  try {
    const meRes = await fetch(`${TELEGRAM_API_BASE}${config.botToken}/getMe`);
    const meData = await safeParseJSON(meRes);
    if (!meData || !meData.ok) return { success: false, message: `Token lỗi.` };

    const sendRes = await fetch(`${TELEGRAM_API_BASE}${config.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.groupId,
        text: `🔌 **System Connected**\nBot: @${meData.result.username}`,
        parse_mode: 'Markdown',
      }),
    });
    const sendData = await safeParseJSON(sendRes);
    return sendData && sendData.ok ? { success: true, message: 'Kết nối OK!' } : { success: false, message: `Lỗi gửi tin vào Group.` };
  } catch (error) {
    return { success: false, message: 'Lỗi mạng.' };
  }
};

export const createTelegramTopic = async (config: TelegramConfig, name: string): Promise<number | null> => {
  if (!config.botToken || !config.groupId) return null;
  try {
    const response = await fetch(`${TELEGRAM_API_BASE}${config.botToken}/createForumTopic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: config.groupId, name: name }),
    });
    const data = await safeParseJSON(response);
    if (data && data.ok && data.result) return data.result.message_thread_id;
    return null;
  } catch (error) { return null; }
};

export const sendTelegramMessage = async (config: TelegramConfig, topicId: number | null, text: string, senderName: string) => {
  if (!config.botToken || !config.groupId) return;
  try {
    let formattedText = `👤 *${senderName}:*\n${text}`;
    if (senderName === 'Hệ Thống') formattedText = text;
    
    const body: any = { chat_id: config.groupId, text: formattedText, parse_mode: 'Markdown' };
    if (topicId !== null) body.message_thread_id = topicId;

    await fetch(`${TELEGRAM_API_BASE}${config.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (error) { console.error('Error sending msg', error); }
};

// --- NEW FEATURE: CLOUD SYNC COMMAND ---
// Gửi lệnh đồng bộ dữ liệu (ẩn) qua Telegram
export const sendSystemSync = async (config: TelegramConfig, topicId: number, type: 'UPDATE_PROFILE' | 'APPROVE_KYC' | 'REJECT_KYC', data: any) => {
    if (!config.botToken || !config.groupId) return;
    try {
        // Format: ⚡CMD:TYPE|JSON_DATA
        const payload = `⚡CMD:${type}|${JSON.stringify(data)}`;
        
        await fetch(`${TELEGRAM_API_BASE}${config.botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: config.groupId,
                message_thread_id: topicId,
                text: payload,
            }),
        });
    } catch (error) { console.error('Error sending sync cmd', error); }
};

export const sendSimpleTelegramMessage = async (config: TelegramConfig, targetId: string, text: string) => {
    if (!config.botToken || !targetId) return;
    try {
        await fetch(`${TELEGRAM_API_BASE}${config.botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: targetId, text: text }),
        });
    } catch (error) { console.error('Error simple msg', error); }
};

export const sendTelegramMedia = async (config: TelegramConfig, topicId: number, file: File, caption: string, senderName: string) => {
    if (!config.botToken || !config.groupId) return;
    try {
        const formData = new FormData();
        formData.append('chat_id', config.groupId);
        formData.append('message_thread_id', topicId.toString());
        formData.append('caption', `👤 *${senderName}:*\n${caption || 'File attachment'}`);
        formData.append('parse_mode', 'Markdown');
        const endpoint = file.type.startsWith('video/') ? 'sendVideo' : 'sendPhoto';
        formData.append(file.type.startsWith('video/') ? 'video' : 'photo', file);

        await fetch(`${TELEGRAM_API_BASE}${config.botToken}/${endpoint}`, { method: 'POST', body: formData });
    } catch (error) { console.error('Error sending media', error); }
};

export const sendAdminReplyToTelegram = async (config: TelegramConfig, topicId: number, text: string, file?: File) => {
    if (!config.botToken || !config.groupId) return;
    try {
      if (file) {
          const formData = new FormData();
          formData.append('chat_id', config.groupId);
          formData.append('message_thread_id', topicId.toString());
          formData.append('caption', `🛡️ *Admin Support:*\n${text || 'File attachment'}`);
          formData.append('parse_mode', 'Markdown');
          const endpoint = file.type.startsWith('video/') ? 'sendVideo' : 'sendPhoto';
          formData.append(file.type.startsWith('video/') ? 'video' : 'photo', file);
          await fetch(`${TELEGRAM_API_BASE}${config.botToken}/${endpoint}`, { method: 'POST', body: formData });
      } 
      else if (text) {
          await fetch(`${TELEGRAM_API_BASE}${config.botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: config.groupId,
              message_thread_id: topicId,
              text: `🛡️ *Admin Support:*\n${text}`,
              parse_mode: 'Markdown',
            }),
          });
      }
    } catch (error) { console.error('Error admin reply', error); }
};

const getTelegramFileUrl = async (botToken: string, fileId: string): Promise<string | null> => {
    try {
        const res = await fetch(`${TELEGRAM_API_BASE}${botToken}/getFile?file_id=${fileId}`);
        const data = await safeParseJSON(res);
        if (data && data.ok && data.result.file_path) return `https://api.telegram.org/file/bot${botToken}/${data.result.file_path}`;
        return null;
    } catch (e) { return null; }
};

// Return type updated to include commands
export const getTelegramUpdates = async (config: TelegramConfig) => {
  if (!config.botToken) return [];
  const LONG_POLLING_TIMEOUT = 50; 
  
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), (LONG_POLLING_TIMEOUT + 5) * 1000);

    const response = await fetch(`${TELEGRAM_API_BASE}${config.botToken}/getUpdates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            offset: lastUpdateId + 1,
            timeout: LONG_POLLING_TIMEOUT,
            allowed_updates: ["message"]
        }),
        signal: controller.signal
    });
    
    clearTimeout(id);
    const data = await safeParseJSON(response);

    if (data && data.ok && data.result.length > 0) {
      const updates = data.result;
      lastUpdateId = updates[updates.length - 1].update_id;
      const processed = [];

      for (const u of updates) {
          const msg = u.message;
          if (!msg) continue;

          const msgChatId = msg.chat.id.toString();
          const configGroupId = config.groupId.toString();
          if (msgChatId !== configGroupId && msgChatId !== `-100${configGroupId.replace('-100', '')}`) continue;
          if (!msg.message_thread_id) continue; 
          if (msg.from.is_bot && !msg.text?.startsWith('⚡CMD:')) {
             // Skip normal bot messages unless it is a sync command
             if (!msg.text?.includes("KHÁCH HÀNG TRUY CẬP")) continue;
          }

          let text = msg.text || msg.caption || '';
          let attachment = undefined;
          let isCommand = false;
          let commandData = null;

          // DETECT SYSTEM COMMANDS
          if (text.startsWith('⚡CMD:')) {
              isCommand = true;
              try {
                  const parts = text.split('|');
                  const cmdType = parts[0].replace('⚡CMD:', '');
                  const cmdJson = parts.slice(1).join('|');
                  commandData = { type: cmdType, data: JSON.parse(cmdJson) };
              } catch(e) {}
          }

          if (msg.photo) {
              const largestPhoto = msg.photo[msg.photo.length - 1];
              const fileUrl = await getTelegramFileUrl(config.botToken, largestPhoto.file_id);
              if (fileUrl) { attachment = { type: 'image', url: fileUrl }; if (!text) text = '[Hình ảnh]'; }
          }
          else if (msg.video) {
               const fileUrl = await getTelegramFileUrl(config.botToken, msg.video.file_id);
               if (fileUrl) { attachment = { type: 'video', url: fileUrl }; if (!text) text = '[Video]'; }
          }
          else if (!text) continue;

          processed.push({
              id: msg.message_id, 
              text: text,
              topicId: msg.message_thread_id,
              senderName: msg.from.first_name,
              isBot: msg.from.is_bot, 
              timestamp: new Date(msg.date * 1000),
              attachment: attachment as any,
              isCommand: isCommand,
              commandData: commandData
          });
      }
      return processed;
    }
    return [];
  } catch (error: any) {
    if (error.name === 'AbortError') return [];
    if (error.message.includes('NetworkError') || error.message === 'Failed to fetch') {
        await new Promise(resolve => setTimeout(resolve, 5000));
        return [];
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
    return [];
  }
};

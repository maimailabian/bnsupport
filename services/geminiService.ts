
import { GoogleGenAI } from "@google/genai";
import { CustomerProfile } from "../types";

// Helper function để lấy instance AI với key động
const getAI = (apiKey?: string) => {
    // Ưu tiên Key từ giao diện -> Key trong localStorage -> Key môi trường
    const key = apiKey || (typeof localStorage !== 'undefined' ? localStorage.getItem('gemini_api_key') : null) || process.env.API_KEY;
    
    if (!key) {
        throw new Error("Vui lòng nhập Gemini API Key trong Cấu hình Admin.");
    }
    return new GoogleGenAI({ apiKey: key });
};

// Hàm phân tích dữ liệu thô để gửi báo cáo Telegram cá nhân
export const analyzeDataForTelegram = async (rawSheetData: string, caseLink: string, apiKey?: string): Promise<string> => {
    try {
        const ai = getAI(apiKey);
        const prompt = `
            Nhiệm vụ: Trích xuất thông tin từ dữ liệu thô và định dạng lại chính xác theo yêu cầu.
            
            Dữ liệu thô: "${rawSheetData}"
            Link hồ sơ: "${caseLink}"

            Yêu cầu định dạng đầu ra (TUYỆT ĐỐI KHÔNG thêm bất kỳ lời dẫn, không markdown, không dấu *, không json):
            Hãy xuất ra danh sách theo đúng thứ tự sau. Nếu thông tin nào không tìm thấy trong dữ liệu thô, hãy BỎ QUA dòng đó (không xuất dòng đó).

            1. [Họ và tên] (Chỉ ghi tên, KHÔNG ghi chữ "Họ tên:" ở trước)
            2. Email: [Giá trị email]
            3. Số điện thoại: [Giá trị SĐT]
            4. Ngày sinh: [Giá trị ngày sinh]
            5. CCCD số: [Giá trị số CCCD]
            6. Ngày cấp: [Giá trị ngày cấp]
            7. Địa chỉ: [Giá trị địa chỉ]
            8. Link: ${caseLink}

            Ví dụ kết quả mong muốn:
            Nguyễn Văn A
            Email: a@gmail.com
            Số điện thoại: 0909000111
            CCCD số: 0123456789
            Link: ${caseLink}
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-latest',
            contents: prompt,
        });

        return response.text ? response.text.trim() : "Không phân tích được dữ liệu.";
    } catch (error) {
        return `Lỗi phân tích AI.\nLink: ${caseLink}\nData: ${rawSheetData}`;
    }
};

// Thêm tham số apiKey vào các hàm
export const generateSmartReply = async (context: string, customerMessage: string, apiKey?: string): Promise<string> => {
  try {
    const ai = getAI(apiKey);
    const model = 'gemini-2.5-flash-latest'; // Sử dụng model nhanh cho chat
    const prompt = `
      Bạn là một trợ lý hỗ trợ khách hàng chuyên nghiệp, lịch sự và hữu ích.
      
      Ngữ cảnh cuộc trò chuyện:
      ${context}

      Tin nhắn gần nhất của khách hàng: "${customerMessage}"

      Hãy gợi ý một câu trả lời ngắn gọn, giải quyết vấn đề của khách hàng bằng tiếng Việt.
      Không cần chào hỏi lại nếu ngữ cảnh đã có chào hỏi.
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });

    return response.text || "Không thể tạo câu trả lời lúc này.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Xin lỗi, AI đang gặp sự cố kết nối hoặc thiếu API Key.";
  }
};

export const summarizeTicket = async (messages: string[], apiKey?: string): Promise<string> => {
    try {
        const ai = getAI(apiKey);
        const conversation = messages.join("\n");
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-latest',
            contents: `Tóm tắt ngắn gọn nội dung vấn đề của khách hàng dựa trên đoạn hội thoại sau:\n${conversation}`,
        });
        return response.text || "Không có nội dung.";
    } catch (error) {
        return "Lỗi tóm tắt.";
    }
}

export const generateTicketContent = async (rawSheetData: string, caseId: string, verificationLink?: string, apiKey?: string): Promise<{ subject: string, description: string, telegramMessage?: string }> => {
    try {
        const ai = getAI(apiKey);
        let prompt = "";
        if (verificationLink) {
            prompt = `
                Bạn là một AI quản trị viên.
                Dữ liệu khách hàng từ Sheet: "${rawSheetData}"
                Case ID: ${caseId}
                Link xác minh: "${verificationLink}"
                
                Nhiệm vụ: Trả về JSON thuần túy (không Markdown) với cấu trúc:
                {
                    "subject": "Tiêu đề ngắn gọn cho Ticket nội bộ",
                    "description": "Mô tả vấn đề để lưu vào hệ thống",
                    "telegramMessage": "Nội dung tin nhắn Telegram gửi vào nhóm Admin để báo cáo. Dùng Markdown. Bao gồm các thông tin quan trọng và Link xác minh."
                }
            `;
        } else {
             prompt = `
                Dữ liệu thô: "${rawSheetData}"
                Case ID: ${caseId}
                Trả về JSON { "subject": "...", "description": "...", "telegramMessage": "..." }
             `;
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-latest',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });
        
        const text = response.text || "{}";
        return JSON.parse(text);
    } catch (error) {
        console.error("Gemini Generate Ticket Error:", error);
        // Fallback data
        return {
            subject: `Case #${caseId}`,
            description: `Data: ${rawSheetData}`,
            telegramMessage: `⚠️ *New Case Created*\nID: \`${caseId}\`\nData: ${rawSheetData}\n[Link Verify](${verificationLink})`
        };
    }
};

// ĐỔI TÊN HÀM: personalizeBulkEmail -> personalizeBulkTelegram
export const personalizeBulkTelegram = async (rowData: string, messageTemplate: string, verificationLink: string, caseId: string, apiKey?: string): Promise<{ customerName: string, finalizedMessage: string }> => {
    try {
        const ai = getAI(apiKey);
        const prompt = `
            Dữ liệu dòng Excel: "${rowData}"
            Template Tin Nhắn Telegram gốc:
            """
            ${messageTemplate}
            """
            Link xác minh: "${verificationLink}"
            Mã hồ sơ: "${caseId}"
            
            Nhiệm vụ:
            1. Trích xuất Tên từ dữ liệu.
            2. Điền thông tin vào Template Tin Nhắn.
            3. Thay thế {name}, <thay-the-link>, <thay-the-thong-tin> bằng dữ liệu thật.
            4. Output định dạng Markdown Telegram (in đậm bằng **, code bằng \`).
            
            Trả về JSON thuần túy:
            {
                "name": "tên trích xuất được",
                "finalMessage": "Nội dung tin nhắn Telegram hoàn thiện (Markdown)"
            }
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-latest',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });

        const json = JSON.parse(response.text || "{}");
        return {
            customerName: json.name || "Khách hàng",
            finalizedMessage: json.finalMessage || messageTemplate
        };

    } catch (error) {
        console.error("Gemini Bulk Telegram Error:", error);
        const parts = rowData.split('|').map(s => s.trim());
        const name = parts[0] || "Khách hàng";
        
        let fallbackMsg = messageTemplate
            .replace(/{name}/g, name)
            .replace(/<thay-the-link>/g, verificationLink)
            .replace(/<thay-the-thong-tin>/g, rowData);
            
        return {
            customerName: name,
            finalizedMessage: fallbackMsg
        };
    }
};

export const generateSupportArticle = async (issue: string, context: string, caseId: string, apiKey?: string): Promise<string> => {
    try {
        const ai = getAI(apiKey);
        const prompt = `
            Viết một bài thông báo ngắn (style bài đăng Facebook/Forum) từ đội ngũ Binance Support gửi tới khách hàng.
            Vấn đề: ${issue}
            Case ID: ${caseId}
            Nội dung ngữ cảnh: ${context}
            
            Yêu cầu: Ngắn gọn, chuyên nghiệp, trấn an khách hàng, yêu cầu khách kiểm tra email để xác minh. Sử dụng emoji phù hợp.
        `;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-latest',
            contents: prompt,
        });
        return response.text || "Đã gửi thông báo hỗ trợ.";
    } catch (e) {
        return `🔔 Thông báo hỗ trợ Case #${caseId}\nChúng tôi đã gửi hướng dẫn xử lý qua Email. Vui lòng kiểm tra hộp thư đến hoặc mục Spam.`;
    }
};

export const extractProfileFromSheetData = async (rawSheetData: string, apiKey?: string): Promise<Partial<CustomerProfile> | null> => {
    try {
        const ai = getAI(apiKey);
        const prompt = `
            Phân tích dữ liệu thô này và trích xuất thông tin hồ sơ khách hàng thành JSON.
            Dữ liệu: "${rawSheetData}"
            Output JSON format: { "fullName": string, "email": string, "phone": string, "idCard": string, "address": string }
            Nếu không tìm thấy trường nào, để trống hoặc null.
        `;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-latest',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });
        return JSON.parse(response.text || "{}");
    } catch (e) {
        return null;
    }
}

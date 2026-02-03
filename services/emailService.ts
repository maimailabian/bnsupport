
// EmailConfig definition moved here as it was removed from global types
export interface EmailConfig {
    serviceId: string;
    templateId: string;
    publicKey: string;
}

interface EmailParams {
    to: string;
    subject: string;
    content: string; // HTML content
}

// Hàm gửi email THẬT qua EmailJS API
export const sendRealEmail = async (params: EmailParams, config: EmailConfig): Promise<boolean> => {
    const { serviceId, templateId, publicKey } = config;

    console.groupCollapsed(`%c[EMAIL API] Sending to ${params.to}...`, "color: #2196F3; font-weight: bold;");
    
    // 1. Validate Config
    if (!serviceId || !templateId || !publicKey) {
        console.error("❌ EmailJS Config Missing. Please check Admin Settings.");
        console.groupEnd();
        return false;
    }

    try {
        // 2. Prepare Payload
        // Lưu ý: Template trên EmailJS phải được cấu hình để nhận các biến: {{to_email}}, {{subject}}, {{content}}
        const templateParams = {
            to_email: params.to,
            subject: params.subject,
            content: params.content, // HTML String
            reply_to: 'support@binance.com' 
        };

        const payload = {
            service_id: serviceId,
            template_id: templateId,
            user_id: publicKey,
            template_params: templateParams
        };

        console.log("Payload:", payload);

        // 3. Call API
        const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
             console.log(`%c✅ Email sent successfully!`, "color: green; font-weight: bold;");
             console.groupEnd();
             return true;
        } else {
            const errorText = await response.text();
            console.error("❌ EmailJS API Error:", errorText);
            console.groupEnd();
            return false;
        }

    } catch (error) {
        console.error("❌ Network/Fetch Error:", error);
        console.groupEnd();
        return false;
    }
};

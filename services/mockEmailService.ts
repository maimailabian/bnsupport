// Dịch vụ giả lập gửi email
export const sendEmailToAdmin = (ticketId: string, subject: string, description: string, customerName: string) => {
    console.log(`%c[EMAIL SYSTEM] Sending Notification to Admin...`, "color: orange; font-weight: bold;");
    console.log(`To: support@binance-clone.com`);
    console.log(`Subject: [New Ticket #${ticketId}] ${subject}`);
    console.log(`Body: 
      Khách hàng: ${customerName}
      Vấn đề: ${description}
      Link quản trị: https://admin.binance-clone.com/tickets/${ticketId}
    `);
    
    // Giả lập độ trễ mạng
    return new Promise(resolve => setTimeout(resolve, 800));
};

export const sendEmailToCustomer = (ticketId: string, subject: string, customerEmail: string) => {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee;">
        <h2 style="color: #F0B90B;">Binance Support</h2>
        <p>Xin chào,</p>
        <p>Một ticket hỗ trợ mới đã được tạo cho bạn.</p>
        <p><strong>Mã Ticket:</strong> #${ticketId}</p>
        <p><strong>Tiêu đề:</strong> ${subject}</p>
        <br/>
        <a href="https://support.binance-clone.com/tickets/${ticketId}" style="background-color: #F0B90B; color: #000; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">Xem Ticket Ngay</a>
      </div>
    `;

    console.log(`%c[EMAIL SYSTEM] Sending Notification to Customer...`, "color: #00bcd4; font-weight: bold;");
    console.log(`To: ${customerEmail}`);
    console.log(`Subject: Ticket #${ticketId} Created`);
    console.log(`HTML Content:`, htmlContent);

    return new Promise(resolve => setTimeout(resolve, 800));
};
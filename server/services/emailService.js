import { Resend } from 'resend';

// Lazy initialization - only create Resend instance when needed
let resendInstance = null;

function getResendInstance() {
  if (!resendInstance && process.env.RESEND_API_KEY) {
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}

/**
 * Check if email service is configured
 */
export function isEmailServiceConfigured() {
  return !!process.env.RESEND_API_KEY;
}

/**
 * Generate HTML email template for packing slip request
 */
function generatePackingSlipEmailHTML({ deliveryNumber, expectedDate, customerName, isFollowUp }) {
  const subject = isFollowUp 
    ? `REMINDER: Packing Slip Request for Delivery ${deliveryNumber}`
    : `Packing Slip Request for Delivery ${deliveryNumber}`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #2c3e50; color: white; padding: 20px; text-align: center; }
    .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
    .details { background-color: white; padding: 15px; margin: 20px 0; border-left: 4px solid #3498db; }
    .detail-row { margin: 10px 0; }
    .label { font-weight: bold; color: #2c3e50; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    .button { display: inline-block; padding: 12px 24px; background-color: #3498db; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
    ${isFollowUp ? '.reminder { background-color: #e74c3c; color: white; padding: 10px; text-align: center; margin-bottom: 20px; border-radius: 4px; }' : ''}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Packing Slip Request</h1>
    </div>
    <div class="content">
      ${isFollowUp ? '<div class="reminder"><strong>⚠️ REMINDER</strong> - This is a follow-up request</div>' : ''}
      
      <p>Hello ${customerName || 'Valued Customer'},</p>
      
      <p>We are writing to request the packing slip for the following delivery:</p>
      
      <div class="details">
        <div class="detail-row">
          <span class="label">Delivery Number:</span> ${deliveryNumber}
        </div>
        <div class="detail-row">
          <span class="label">Expected Date:</span> ${expectedDate}
        </div>
        <div class="detail-row">
          <span class="label">Customer:</span> ${customerName || 'N/A'}
        </div>
      </div>
      
      <p><strong>Please provide the packing slip at your earliest convenience.</strong></p>
      
      <p>You can reply to this email with the packing slip attached, or contact us through your preferred method.</p>
      
      <p>Thank you for your cooperation!</p>
    </div>
    <div class="footer">
      <p>This is an automated message from the Warehouse Management System.</p>
      <p>If you have any questions, please contact our warehouse team.</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Send packing slip request email
 */
export async function sendPackingSlipRequest({ 
  to, 
  deliveryNumber, 
  expectedDate, 
  customerName,
  isFollowUp = false 
}) {
  // Check if email service is configured
  if (!isEmailServiceConfigured()) {
    console.error('[EmailService] RESEND_API_KEY not configured');
    throw new Error('Email service not configured. Please set RESEND_API_KEY environment variable.');
  }

  const resend = getResendInstance();
  if (!resend) {
    throw new Error('Failed to initialize email service');
  }

  const subject = isFollowUp 
    ? `REMINDER: Packing Slip Request for Delivery ${deliveryNumber}`
    : `Packing Slip Request for Delivery ${deliveryNumber}`;

  const html = generatePackingSlipEmailHTML({ 
    deliveryNumber, 
    expectedDate, 
    customerName,
    isFollowUp 
  });

  // Normalize 'to' to always be an array
  const recipients = Array.isArray(to) ? to : [to];

  try {
    console.log(`[EmailService] Sending ${isFollowUp ? 'follow-up' : 'initial'} packing slip request to ${recipients.length} recipient(s): ${recipients.join(', ')}`);
    console.log(`[EmailService] Using FROM: notification@yeswaylogistics.com`);
    
    const result = await resend.emails.send({
      from: 'Yesway Logistics <notification@yeswaylogistics.com>',
      replyTo: 'orders@yeswaylogistics.com',
      to: recipients,
      subject: subject,
      html: html,
    });

    console.log('[EmailService] Email sent successfully:', result);
    return result;
  } catch (error) {
    console.error('[EmailService] Failed to send email:', error);
    console.error('[EmailService] Error details:', JSON.stringify(error, null, 2));
    throw error;
  }
}

/**
 * Generic email sending function
 */
export async function sendEmail({ to, subject, html }) {
  if (!isEmailServiceConfigured()) {
    console.error('[EmailService] RESEND_API_KEY not configured');
    throw new Error('Email service not configured. Please set RESEND_API_KEY environment variable.');
  }

  const resend = getResendInstance();
  if (!resend) {
    throw new Error('Failed to initialize email service');
  }

  try {
    console.log(`[EmailService] Sending email to ${to}: ${subject}`);
    
    const result = await resend.emails.send({
      from: 'Yesway Logistics <notification@yeswaylogistics.com>',
      replyTo: 'orders@yeswaylogistics.com',
      to: [to],
      subject: subject,
      html: html,
    });

    console.log('[EmailService] Email sent successfully:', result);
    return result;
  } catch (error) {
    console.error('[EmailService] Failed to send email:', error);
    throw error;
  }
}
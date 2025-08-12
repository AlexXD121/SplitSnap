// Sharing Service - WhatsApp, Email, and link sharing

const supabaseService = require('./supabaseService');
const axios = require('axios');

class SharingService {
    constructor() {
        this.shareTypes = {
            EMAIL: 'email',
            WHATSAPP: 'whatsapp',
            LINK: 'link',
            SMS: 'sms'
        };
    }

    // Generate shareable link for receipt
    async generateShareableLink(receiptId, options = {}) {
        try {
            console.log('🔗 Generating shareable link for receipt:', receiptId);

            // Get receipt data
            const { data: receipt, error } = await supabaseService.supabase
                .from('receipts')
                .select('*')
                .eq('id', receiptId)
                .single();

            if (error) throw error;

            // Create share token (simple UUID for now)
            const shareToken = `share_${receiptId}_${Date.now()}`;
            
            // Store share record
            const shareRecord = {
                receipt_id: receiptId,
                share_method: this.shareTypes.LINK,
                recipient_info: {
                    shareToken,
                    expiresAt: options.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
                    allowEdit: options.allowEdit || false,
                    requireAuth: options.requireAuth || false
                },
                status: 'active'
            };

            const { data: shareData, error: shareError } = await supabaseService.supabase
                .from('receipt_shares')
                .insert([shareRecord])
                .select()
                .single();

            if (shareError) throw shareError;

            const baseUrl = process.env.BASE_URL || 'http://localhost:3002';
            const shareUrl = `${baseUrl}/shared/${shareToken}`;

            return {
                success: true,
                data: {
                    shareUrl,
                    shareToken,
                    expiresAt: shareRecord.recipient_info.expiresAt,
                    receipt: {
                        id: receipt.id,
                        merchant: receipt.merchant_name,
                        total: receipt.total_amount,
                        date: receipt.created_at
                    }
                }
            };

        } catch (error) {
            console.error('❌ Error generating shareable link:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Share receipt via WhatsApp
    async shareViaWhatsApp(receiptId, phoneNumbers, customMessage = null) {
        try {
            console.log('📱 Sharing receipt via WhatsApp to:', phoneNumbers);

            // Get receipt data
            const { data: receipt, error } = await supabaseService.supabase
                .from('receipts')
                .select('*')
                .eq('id', receiptId)
                .single();

            if (error) throw error;

            // Generate shareable link
            const linkResult = await this.generateShareableLink(receiptId);
            if (!linkResult.success) throw new Error('Failed to generate share link');

            // Format message
            const message = customMessage || this.formatWhatsAppMessage(receipt, linkResult.data.shareUrl);

            const results = [];

            for (const phoneNumber of phoneNumbers) {
                try {
                    // Create WhatsApp URL
                    const whatsappUrl = this.createWhatsAppUrl(phoneNumber, message);
                    
                    // Store share record
                    const shareRecord = {
                        receipt_id: receiptId,
                        share_method: this.shareTypes.WHATSAPP,
                        recipient_info: {
                            phoneNumber: phoneNumber,
                            message: message,
                            whatsappUrl: whatsappUrl
                        },
                        message: message,
                        status: 'pending'
                    };

                    const { data: shareData, error: shareError } = await supabaseService.supabase
                        .from('receipt_shares')
                        .insert([shareRecord])
                        .select()
                        .single();

                    if (shareError) throw shareError;

                    results.push({
                        phoneNumber,
                        whatsappUrl,
                        shareId: shareData.id,
                        success: true
                    });

                } catch (error) {
                    results.push({
                        phoneNumber,
                        success: false,
                        error: error.message
                    });
                }
            }

            return {
                success: true,
                data: {
                    results,
                    shareUrl: linkResult.data.shareUrl,
                    message
                }
            };

        } catch (error) {
            console.error('❌ Error sharing via WhatsApp:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Share bill split via WhatsApp
    async shareBillSplitViaWhatsApp(splitId, customMessage = null) {
        try {
            console.log('💰 Sharing bill split via WhatsApp:', splitId);

            // Get split data
            const { data: split, error } = await supabaseService.supabase
                .from('bill_splits')
                .select(`
                    *,
                    receipts(*),
                    split_participants(*)
                `)
                .eq('id', splitId)
                .single();

            if (error) throw error;

            const receipt = split.receipts;
            const participants = split.split_participants;

            // Generate split summary message
            const message = customMessage || this.formatSplitWhatsAppMessage(receipt, split, participants);

            const results = [];

            for (const participant of participants) {
                if (participant.phone) {
                    try {
                        const personalizedMessage = this.personalizeMessage(message, participant);
                        const whatsappUrl = this.createWhatsAppUrl(participant.phone, personalizedMessage);
                        
                        // Store share record
                        const shareRecord = {
                            receipt_id: receipt.id,
                            split_id: splitId,
                            share_method: this.shareTypes.WHATSAPP,
                            recipient_info: {
                                phoneNumber: participant.phone,
                                participantName: participant.name,
                                amount: participant.amount_owed
                            },
                            message: personalizedMessage,
                            status: 'pending'
                        };

                        const { data: shareData, error: shareError } = await supabaseService.supabase
                            .from('receipt_shares')
                            .insert([shareRecord])
                            .select()
                            .single();

                        if (shareError) throw shareError;

                        results.push({
                            participant: participant.name,
                            phoneNumber: participant.phone,
                            amount: participant.amount_owed,
                            whatsappUrl,
                            shareId: shareData.id,
                            success: true
                        });

                    } catch (error) {
                        results.push({
                            participant: participant.name,
                            phoneNumber: participant.phone,
                            success: false,
                            error: error.message
                        });
                    }
                }
            }

            return {
                success: true,
                data: {
                    results,
                    splitSummary: {
                        merchant: receipt.merchant_name,
                        total: receipt.total_amount,
                        participants: participants.length,
                        method: split.split_method
                    }
                }
            };

        } catch (error) {
            console.error('❌ Error sharing bill split via WhatsApp:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Share receipt via email
    async shareViaEmail(receiptId, emailAddresses, subject = null, customMessage = null) {
        try {
            console.log('📧 Sharing receipt via email to:', emailAddresses);

            // Get receipt data
            const { data: receipt, error } = await supabaseService.supabase
                .from('receipts')
                .select('*')
                .eq('id', receiptId)
                .single();

            if (error) throw error;

            // Generate shareable link
            const linkResult = await this.generateShareableLink(receiptId);
            if (!linkResult.success) throw new Error('Failed to generate share link');

            // Format email content
            const emailSubject = subject || `Receipt from ${receipt.merchant_name || 'Unknown Merchant'}`;
            const emailBody = customMessage || this.formatEmailMessage(receipt, linkResult.data.shareUrl);

            const results = [];

            for (const email of emailAddresses) {
                try {
                    // For now, we'll create a mailto link
                    // In production, you'd integrate with an email service like SendGrid, AWS SES, etc.
                    const mailtoUrl = this.createMailtoUrl(email, emailSubject, emailBody);
                    
                    // Store share record
                    const shareRecord = {
                        receipt_id: receiptId,
                        share_method: this.shareTypes.EMAIL,
                        recipient_info: {
                            email: email,
                            subject: emailSubject,
                            body: emailBody,
                            mailtoUrl: mailtoUrl
                        },
                        message: emailBody,
                        status: 'pending'
                    };

                    const { data: shareData, error: shareError } = await supabaseService.supabase
                        .from('receipt_shares')
                        .insert([shareRecord])
                        .select()
                        .single();

                    if (shareError) throw shareError;

                    results.push({
                        email,
                        mailtoUrl,
                        shareId: shareData.id,
                        success: true
                    });

                } catch (error) {
                    results.push({
                        email,
                        success: false,
                        error: error.message
                    });
                }
            }

            return {
                success: true,
                data: {
                    results,
                    shareUrl: linkResult.data.shareUrl,
                    subject: emailSubject,
                    message: emailBody
                }
            };

        } catch (error) {
            console.error('❌ Error sharing via email:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get shared receipt by token
    async getSharedReceipt(shareToken) {
        try {
            console.log('🔍 Getting shared receipt for token:', shareToken);

            // Get share record
            const { data: share, error: shareError } = await supabaseService.supabase
                .from('receipt_shares')
                .select(`
                    *,
                    receipts(*),
                    bill_splits(*)
                `)
                .eq('recipient_info->>shareToken', shareToken)
                .eq('status', 'active')
                .single();

            if (shareError) throw shareError;

            // Check if expired
            const expiresAt = new Date(share.recipient_info.expiresAt);
            if (expiresAt < new Date()) {
                throw new Error('Share link has expired');
            }

            return {
                success: true,
                data: {
                    receipt: share.receipts,
                    split: share.bill_splits,
                    shareInfo: {
                        expiresAt: share.recipient_info.expiresAt,
                        allowEdit: share.recipient_info.allowEdit,
                        requireAuth: share.recipient_info.requireAuth
                    }
                }
            };

        } catch (error) {
            console.error('❌ Error getting shared receipt:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Create WhatsApp URL
    createWhatsAppUrl(phoneNumber, message) {
        // Clean phone number
        const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
        const encodedMessage = encodeURIComponent(message);
        return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
    }

    // Create mailto URL
    createMailtoUrl(email, subject, body) {
        const encodedSubject = encodeURIComponent(subject);
        const encodedBody = encodeURIComponent(body);
        return `mailto:${email}?subject=${encodedSubject}&body=${encodedBody}`;
    }

    // Format WhatsApp message for receipt
    formatWhatsAppMessage(receipt, shareUrl) {
        const merchant = receipt.merchant_name || 'Unknown Merchant';
        const total = receipt.total_amount || 0;
        const currency = receipt.currency || 'INR';
        const date = new Date(receipt.created_at).toLocaleDateString();

        return `🧾 *Receipt Shared*

📍 *Merchant:* ${merchant}
💰 *Total:* ${currency} ${total}
📅 *Date:* ${date}

View full receipt: ${shareUrl}

_Shared via SplitSnap_`;
    }

    // Format WhatsApp message for bill split
    formatSplitWhatsAppMessage(receipt, split, participants) {
        const merchant = receipt.merchant_name || 'Unknown Merchant';
        const total = receipt.total_amount || 0;
        const currency = receipt.currency || 'INR';
        const participantCount = participants.length;

        let message = `💸 *Bill Split - ${split.split_name}*

📍 *Merchant:* ${merchant}
💰 *Total Amount:* ${currency} ${total}
👥 *Split among:* ${participantCount} people

*Individual Amounts:*\n`;

        participants.forEach(participant => {
            const amount = parseFloat(participant.amount_owed || 0).toFixed(2);
            message += `• ${participant.name}: ${currency} ${amount}\n`;
        });

        message += `\n_Split method: ${split.split_method.replace('_', ' ')}_
_Shared via SplitSnap_`;

        return message;
    }

    // Format email message
    formatEmailMessage(receipt, shareUrl) {
        const merchant = receipt.merchant_name || 'Unknown Merchant';
        const total = receipt.total_amount || 0;
        const currency = receipt.currency || 'INR';
        const date = new Date(receipt.created_at).toLocaleDateString();

        return `Hi,

I'm sharing a receipt with you:

Merchant: ${merchant}
Total Amount: ${currency} ${total}
Date: ${date}

You can view the full receipt details here: ${shareUrl}

Best regards,
Shared via SplitSnap`;
    }

    // Personalize message for individual participant
    personalizeMessage(message, participant) {
        const amount = parseFloat(participant.amount_owed || 0).toFixed(2);
        const personalizedMessage = `Hi ${participant.name}! 👋\n\n${message}\n\n*Your share: ₹${amount}*`;
        return personalizedMessage;
    }

    // Update share status
    async updateShareStatus(shareId, status, metadata = {}) {
        try {
            const updateData = {
                status,
                ...metadata
            };

            if (status === 'sent') {
                updateData.sent_at = new Date().toISOString();
            }

            const { data, error } = await supabaseService.supabase
                .from('receipt_shares')
                .update(updateData)
                .eq('id', shareId)
                .select()
                .single();

            if (error) throw error;

            return {
                success: true,
                data
            };

        } catch (error) {
            console.error('❌ Error updating share status:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get sharing history
    async getSharingHistory(receiptId = null, limit = 50) {
        try {
            let query = supabaseService.supabase
                .from('receipt_shares')
                .select(`
                    *,
                    receipts(merchant_name, total_amount, created_at)
                `)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (receiptId) {
                query = query.eq('receipt_id', receiptId);
            }

            const { data, error } = await query;
            if (error) throw error;

            return {
                success: true,
                data
            };

        } catch (error) {
            console.error('❌ Error getting sharing history:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Generate QR code for receipt sharing
    async generateQRCode(receiptId) {
        try {
            // Generate shareable link first
            const linkResult = await this.generateShareableLink(receiptId);
            if (!linkResult.success) throw new Error('Failed to generate share link');

            // For now, return the URL that can be used to generate QR code on frontend
            // In production, you might want to use a QR code generation service
            return {
                success: true,
                data: {
                    shareUrl: linkResult.data.shareUrl,
                    qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(linkResult.data.shareUrl)}`,
                    shareToken: linkResult.data.shareToken
                }
            };

        } catch (error) {
            console.error('❌ Error generating QR code:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new SharingService();
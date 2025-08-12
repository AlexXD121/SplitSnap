// UPI Payment Service - Generate UPI links and QR codes

const QRCode = require('qrcode');

class UPIService {
    constructor() {
        this.upiProtocol = 'upi://pay';
        this.supportedApps = [
            'phonepe', 'paytm', 'googlepay', 'bhim', 'amazonpay'
        ];
    }

    // Generate UPI payment link
    generateUPILink(paymentData) {
        try {
            const {
                recipientUPI,
                recipientName,
                amount,
                note = 'SplitSnap Bill Payment',
                transactionRef = null
            } = paymentData;

            // Validate UPI ID
            if (!this.validateUPIId(recipientUPI)) {
                throw new Error('Invalid UPI ID format');
            }

            // Validate amount
            if (!amount || amount <= 0) {
                throw new Error('Invalid payment amount');
            }

            // Build UPI URL parameters
            const params = new URLSearchParams({
                pa: recipientUPI,                    // Payee Address
                pn: recipientName || 'Recipient',   // Payee Name
                am: amount.toFixed(2),              // Amount
                cu: 'INR',                          // Currency
                tn: note                            // Transaction Note
            });

            // Add transaction reference if provided
            if (transactionRef) {
                params.append('tr', transactionRef);
            }

            const upiLink = `${this.upiProtocol}?${params.toString()}`;

            return {
                success: true,
                data: {
                    upiLink,
                    recipientUPI,
                    recipientName,
                    amount,
                    currency: 'INR',
                    note,
                    transactionRef
                }
            };

        } catch (error) {
            console.error('UPI link generation error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Generate QR code for UPI payment
    async generateQRCode(upiLink, options = {}) {
        try {
            const qrOptions = {
                type: 'image/png',
                quality: 0.92,
                margin: 1,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                },
                width: options.size || 256,
                ...options
            };

            const qrCodeDataURL = await QRCode.toDataURL(upiLink, qrOptions);

            return {
                success: true,
                data: {
                    qrCode: qrCodeDataURL,
                    format: 'data:image/png;base64',
                    size: qrOptions.width
                }
            };

        } catch (error) {
            console.error('QR code generation error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Generate payment package (UPI link + QR code)
    async generatePaymentPackage(paymentData, qrOptions = {}) {
        try {
            // Generate UPI link
            const linkResult = this.generateUPILink(paymentData);
            if (!linkResult.success) {
                return linkResult;
            }

            // Generate QR code
            const qrResult = await this.generateQRCode(linkResult.data.upiLink, qrOptions);
            if (!qrResult.success) {
                return qrResult;
            }

            return {
                success: true,
                data: {
                    ...linkResult.data,
                    qrCode: qrResult.data.qrCode,
                    qrSize: qrResult.data.size
                }
            };

        } catch (error) {
            console.error('Payment package generation error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Validate UPI ID format
    validateUPIId(upiId) {
        if (!upiId || typeof upiId !== 'string') {
            return false;
        }

        // UPI ID format: username@bank or mobile@bank
        const upiRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/;
        return upiRegex.test(upiId);
    }

    // Generate shareable payment message
    generateShareableMessage(paymentData, includeQR = false) {
        const { recipientName, amount, note, upiLink } = paymentData;

        let message = `💰 Payment Request\n\n`;
        message += `Pay to: ${recipientName}\n`;
        message += `Amount: ₹${amount.toFixed(2)}\n`;
        if (note) {
            message += `Note: ${note}\n`;
        }
        message += `\n🔗 Pay via UPI:\n${upiLink}\n\n`;
        message += `💡 Tap the link to open your UPI app\n`;
        message += `📱 Or scan the QR code to pay\n\n`;
        message += `Powered by SplitSnap`;

        return message;
    }

    // Generate WhatsApp share URL
    generateWhatsAppURL(paymentData, phoneNumber = null) {
        const message = this.generateShareableMessage(paymentData);
        const encodedMessage = encodeURIComponent(message);
        
        if (phoneNumber) {
            // Remove any non-digit characters and ensure it starts with country code
            const cleanPhone = phoneNumber.replace(/\D/g, '');
            const formattedPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
            return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
        } else {
            return `https://wa.me/?text=${encodedMessage}`;
        }
    }

    // Generate multiple payment links for bill split
    async generateSplitPayments(splitData, payerUPI) {
        try {
            const { participants, merchantName = 'Restaurant' } = splitData;
            const payments = [];

            for (const participant of participants) {
                if (participant.amount > 0) {
                    const paymentData = {
                        recipientUPI: payerUPI,
                        recipientName: 'Bill Payer',
                        amount: participant.amount,
                        note: `${merchantName} - ${participant.name}'s share`,
                        transactionRef: `SS${Date.now()}${Math.random().toString(36).substr(2, 4)}`
                    };

                    const paymentPackage = await this.generatePaymentPackage(paymentData);
                    
                    if (paymentPackage.success) {
                        payments.push({
                            participantName: participant.name,
                            participantId: participant.id,
                            ...paymentPackage.data,
                            whatsappURL: this.generateWhatsAppURL(paymentPackage.data)
                        });
                    }
                }
            }

            return {
                success: true,
                data: {
                    payments,
                    totalAmount: participants.reduce((sum, p) => sum + (p.amount || 0), 0),
                    payerUPI,
                    merchantName
                }
            };

        } catch (error) {
            console.error('Split payments generation error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get popular UPI apps for deep linking
    getUPIApps() {
        return [
            {
                name: 'PhonePe',
                packageName: 'com.phonepe.app',
                scheme: 'phonepe://',
                icon: '📱'
            },
            {
                name: 'Google Pay',
                packageName: 'com.google.android.apps.nfc.payment',
                scheme: 'tez://',
                icon: '💳'
            },
            {
                name: 'Paytm',
                packageName: 'net.one97.paytm',
                scheme: 'paytmmp://',
                icon: '💰'
            },
            {
                name: 'BHIM',
                packageName: 'in.org.npci.upiapp',
                scheme: 'bhim://',
                icon: '🏦'
            },
            {
                name: 'Amazon Pay',
                packageName: 'in.amazon.mShop.android.shopping',
                scheme: 'amazonpay://',
                icon: '📦'
            }
        ];
    }
}

module.exports = new UPIService();
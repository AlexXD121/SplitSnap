// SplitSnap Simple - Node.js Backend Server

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

// Import services
const ocrService = require('./services/ocrService');
const supabaseService = require('./services/supabaseService');
const billSplitService = require('./services/billSplitService');
const categoryService = require('./services/categoryService');
const analyticsService = require('./services/analyticsService');
const currencyService = require('./services/currencyService');
const sharingService = require('./services/sharingService');
const upiService = require('./services/upiService');

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(cors({
    origin: ['http://localhost:3002', 'http://127.0.0.1:3002', 'http://192.168.168.194:3002'],
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    }
});

// Routes

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'SplitSnap Backend',
        version: '1.0.0'
    });
});

// API test endpoint
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'API is working correctly',
        timestamp: new Date().toISOString(),
        availableEndpoints: [
            'GET /health',
            'GET /api/test',
            'GET /api/ocr/process (info)',
            'POST /api/ocr/process (process image)',
            'GET /api/receipts'
        ]
    });
});

// Debug middleware to log all requests
app.use('/api', (req, res, next) => {
    console.log(`📝 API Request: ${req.method} ${req.path}`, {
        headers: Object.keys(req.headers),
        body: req.method === 'POST' ? 'Has body' : 'No body',
        query: req.query
    });
    next();
});

// Test endpoint for OCR (GET request)
app.get('/api/ocr/process', (req, res) => {
    res.json({
        success: true,
        message: 'OCR endpoint is working. Use POST with image file to process.',
        endpoint: '/api/ocr/process',
        method: 'POST',
        contentType: 'multipart/form-data',
        requiredField: 'image'
    });
});

// OCR Processing endpoint
app.post('/api/ocr/process', upload.single('image'), async (req, res) => {
    try {
        console.log('OCR request received:', {
            hasFile: !!req.file,
            fileSize: req.file?.size,
            source: req.body.source
        });

        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No image file provided'
            });
        }

        // Process image with OCR
        const ocrResult = await ocrService.processImage(req.file.buffer, {
            filename: req.file.originalname,
            mimetype: req.file.mimetype,
            source: req.body.source
        });

        if (!ocrResult.success) {
            return res.status(500).json({
                success: false,
                error: ocrResult.error || 'OCR processing failed'
            });
        }

        // Auto-categorize the receipt
        const categoryResult = await categoryService.categorizeReceipt(ocrResult.data);
        ocrResult.data.categoryId = categoryResult.category.id;
        ocrResult.data.categoryName = categoryResult.category.name;
        ocrResult.data.categoryConfidence = categoryResult.confidence;

        // Save to Supabase with enhanced data
        try {
            const savedReceipt = await supabaseService.saveReceiptData({
                ocrData: ocrResult.data,
                metadata: {
                    source: req.body.source,
                    filename: req.file.originalname,
                    fileSize: req.file.size,
                    processedAt: new Date().toISOString()
                }
            });
            ocrResult.data.receiptId = savedReceipt.id;
        } catch (dbError) {
            console.warn('Failed to save to database:', dbError.message);
            // Continue without failing the request
        }

        res.json({
            success: true,
            data: {
                ...ocrResult.data,
                category: categoryResult.category,
                categoryConfidence: categoryResult.confidence
            }
        });

    } catch (error) {
        console.error('OCR processing error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});

// Get receipt history
app.get('/api/receipts', async (req, res) => {
    try {
        const { startDate, endDate, category, limit } = req.query;
        const receipts = await supabaseService.getReceiptHistory({
            startDate,
            endDate,
            category,
            limit: parseInt(limit) || 50
        });
        res.json({
            success: true,
            data: receipts
        });
    } catch (error) {
        console.error('Get receipts error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch receipts'
        });
    }
});

// Get single receipt
app.get('/api/receipts/:id', async (req, res) => {
    try {
        const receipt = await supabaseService.getReceiptById(req.params.id);
        res.json({
            success: true,
            data: receipt
        });
    } catch (error) {
        console.error('Get receipt error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch receipt'
        });
    }
});

// === BILL SPLITTING ENDPOINTS ===

// Create bill split
app.post('/api/splits', async (req, res) => {
    try {
        const { receiptId, splitData } = req.body;
        const result = await billSplitService.createSplit(receiptId, splitData);

        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('Create split error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create split'
        });
    }
});

// Get split details
app.get('/api/splits/:id', async (req, res) => {
    try {
        const result = await billSplitService.getSplit(req.params.id);

        if (result.success) {
            res.json(result);
        } else {
            res.status(404).json(result);
        }
    } catch (error) {
        console.error('Get split error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get split'
        });
    }
});

// Update payment status
app.patch('/api/splits/participants/:participantId/payment', async (req, res) => {
    try {
        const { status, paymentMethod } = req.body;
        const result = await billSplitService.updatePaymentStatus(
            req.params.participantId,
            status,
            paymentMethod
        );

        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('Update payment error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to update payment'
        });
    }
});

// Get user splits
app.get('/api/users/:userId/splits', async (req, res) => {
    try {
        const result = await billSplitService.getUserSplits(req.params.userId);

        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('Get user splits error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get user splits'
        });
    }
});

// === CATEGORY ENDPOINTS ===

// Get all categories
app.get('/api/categories', async (req, res) => {
    try {
        const result = await categoryService.getCategories();
        res.json(result);
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get categories'
        });
    }
});

// Create category
app.post('/api/categories', async (req, res) => {
    try {
        const result = await categoryService.createCategory(req.body);

        if (result.success) {
            res.status(201).json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('Create category error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create category'
        });
    }
});

// Get spending by category
app.get('/api/analytics/spending/categories', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const result = await categoryService.getSpendingByCategory(startDate, endDate);
        res.json(result);
    } catch (error) {
        console.error('Get category spending error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get category spending'
        });
    }
});

// === ANALYTICS ENDPOINTS ===

// Get comprehensive analytics
app.get('/api/analytics', async (req, res) => {
    try {
        const { startDate, endDate, userId } = req.query;
        const result = await analyticsService.generateSpendingAnalytics(
            startDate,
            endDate,
            userId
        );
        res.json(result);
    } catch (error) {
        console.error('Get analytics error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get analytics'
        });
    }
});

// Detect duplicate receipts
app.get('/api/analytics/duplicates', async (req, res) => {
    try {
        const result = await analyticsService.detectDuplicates();
        res.json(result);
    } catch (error) {
        console.error('Detect duplicates error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to detect duplicates'
        });
    }
});

// Get historical insights
app.get('/api/analytics/insights', async (req, res) => {
    try {
        const { userId, limit } = req.query;
        const result = await analyticsService.getHistoricalInsights(
            userId,
            parseInt(limit) || 10
        );
        res.json(result);
    } catch (error) {
        console.error('Get insights error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get insights'
        });
    }
});

// === CURRENCY ENDPOINTS ===

// Get supported currencies
app.get('/api/currencies', (req, res) => {
    const result = currencyService.getSupportedCurrencies();
    res.json(result);
});

// Convert currency
app.post('/api/currencies/convert', async (req, res) => {
    try {
        const { amount, fromCurrency, toCurrency } = req.body;
        const result = await currencyService.convertCurrency(amount, fromCurrency, toCurrency);
        res.json(result);
    } catch (error) {
        console.error('Currency conversion error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to convert currency'
        });
    }
});

// Convert receipt to different currency
app.post('/api/receipts/:id/convert', async (req, res) => {
    try {
        const { targetCurrency } = req.body;
        const result = await currencyService.convertReceipt(req.params.id, targetCurrency);
        res.json(result);
    } catch (error) {
        console.error('Receipt conversion error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to convert receipt'
        });
    }
});

// Get exchange rates
app.get('/api/currencies/rates/:baseCurrency', async (req, res) => {
    try {
        const { baseCurrency } = req.params;
        const { targets } = req.query;
        const targetCurrencies = targets ? targets.split(',') : ['USD', 'EUR', 'GBP'];

        const result = await currencyService.getMultipleRates(baseCurrency, targetCurrencies);
        res.json(result);
    } catch (error) {
        console.error('Get rates error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get exchange rates'
        });
    }
});

// === SHARING ENDPOINTS ===

// Generate shareable link
app.post('/api/receipts/:id/share/link', async (req, res) => {
    try {
        const result = await sharingService.generateShareableLink(req.params.id, req.body);
        res.json(result);
    } catch (error) {
        console.error('Generate share link error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate share link'
        });
    }
});

// Share via WhatsApp
app.post('/api/receipts/:id/share/whatsapp', async (req, res) => {
    try {
        const { phoneNumbers, customMessage } = req.body;
        const result = await sharingService.shareViaWhatsApp(
            req.params.id,
            phoneNumbers,
            customMessage
        );
        res.json(result);
    } catch (error) {
        console.error('WhatsApp share error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to share via WhatsApp'
        });
    }
});

// Share bill split via WhatsApp
app.post('/api/splits/:id/share/whatsapp', async (req, res) => {
    try {
        const { customMessage } = req.body;
        const result = await sharingService.shareBillSplitViaWhatsApp(
            req.params.id,
            customMessage
        );
        res.json(result);
    } catch (error) {
        console.error('Split WhatsApp share error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to share split via WhatsApp'
        });
    }
});

// Share via email
app.post('/api/receipts/:id/share/email', async (req, res) => {
    try {
        const { emailAddresses, subject, customMessage } = req.body;
        const result = await sharingService.shareViaEmail(
            req.params.id,
            emailAddresses,
            subject,
            customMessage
        );
        res.json(result);
    } catch (error) {
        console.error('Email share error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to share via email'
        });
    }
});

// Get shared receipt
app.get('/api/shared/:token', async (req, res) => {
    try {
        const result = await sharingService.getSharedReceipt(req.params.token);

        if (result.success) {
            res.json(result);
        } else {
            res.status(404).json(result);
        }
    } catch (error) {
        console.error('Get shared receipt error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get shared receipt'
        });
    }
});

// Generate QR code
app.post('/api/receipts/:id/qr', async (req, res) => {
    try {
        const result = await sharingService.generateQRCode(req.params.id);
        res.json(result);
    } catch (error) {
        console.error('Generate QR code error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate QR code'
        });
    }
});

// Get sharing history
app.get('/api/sharing/history', async (req, res) => {
    try {
        const { receiptId, limit } = req.query;
        const result = await sharingService.getSharingHistory(
            receiptId,
            parseInt(limit) || 50
        );
        res.json(result);
    } catch (error) {
        console.error('Get sharing history error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get sharing history'
        });
    }
});

// === UPI PAYMENT ENDPOINTS ===

// Generate UPI payment link
app.post('/api/upi/generate-link', async (req, res) => {
    try {
        const result = upiService.generateUPILink(req.body);
        res.json(result);
    } catch (error) {
        console.error('Generate UPI link error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate UPI link'
        });
    }
});

// Generate QR code for UPI payment
app.post('/api/upi/generate-qr', async (req, res) => {
    try {
        const { upiLink, size } = req.body;
        const result = await upiService.generateQRCode(upiLink, { size });
        res.json(result);
    } catch (error) {
        console.error('Generate QR code error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate QR code'
        });
    }
});

// Generate complete payment package (link + QR)
app.post('/api/upi/generate-payment', async (req, res) => {
    try {
        const { paymentData, qrOptions } = req.body;
        const result = await upiService.generatePaymentPackage(paymentData, qrOptions);
        res.json(result);
    } catch (error) {
        console.error('Generate payment package error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate payment package'
        });
    }
});

// Generate payments for bill split
app.post('/api/upi/generate-split-payments', async (req, res) => {
    try {
        const { splitData, payerUPI } = req.body;
        const result = await upiService.generateSplitPayments(splitData, payerUPI);
        res.json(result);
    } catch (error) {
        console.error('Generate split payments error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate split payments'
        });
    }
});

// Validate UPI ID
app.post('/api/upi/validate', (req, res) => {
    try {
        const { upiId } = req.body;
        const isValid = upiService.validateUPIId(upiId);
        res.json({
            success: true,
            data: {
                upiId,
                isValid,
                message: isValid ? 'Valid UPI ID' : 'Invalid UPI ID format'
            }
        });
    } catch (error) {
        console.error('UPI validation error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to validate UPI ID'
        });
    }
});

// Get supported UPI apps
app.get('/api/upi/apps', (req, res) => {
    try {
        const apps = upiService.getUPIApps();
        res.json({
            success: true,
            data: apps
        });
    } catch (error) {
        console.error('Get UPI apps error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get UPI apps'
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);

    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'File too large. Maximum size is 10MB.'
            });
        }
    }

    res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 SplitSnap Backend Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔍 OCR endpoint: http://localhost:${PORT}/api/ocr/process`);
    console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);

    // Test database connection
    supabaseService.testConnection()
        .then(() => console.log('✅ Database connection successful'))
        .catch(err => console.warn('⚠️  Database connection failed:', err.message));
});

module.exports = app;
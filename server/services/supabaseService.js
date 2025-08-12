// Supabase Service - Database operations

const { createClient } = require('@supabase/supabase-js');

class SupabaseService {
    constructor() {
        this.supabaseUrl = process.env.SUPABASE_URL;
        this.supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (!this.supabaseUrl || !this.supabaseKey) {
            console.warn('Supabase credentials not found. Database features will be disabled.');
            this.supabase = null;
            return;
        }

        try {
            this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
            console.log('Supabase client initialized');
        } catch (error) {
            console.error('Failed to initialize Supabase client:', error);
            this.supabase = null;
        }
    }

    async testConnection() {
        if (!this.supabase) {
            throw new Error('Supabase client not initialized');
        }

        try {
            // Test with expense_categories table since receipts now requires auth
            const { data, error } = await this.supabase
                .from('expense_categories')
                .select('count')
                .limit(1);

            if (error) throw error;
            
            // Also ensure we have a default user for testing
            await this.ensureDefaultUser();
            
            return true;
        } catch (error) {
            throw new Error(`Database connection test failed: ${error.message}`);
        }
    }

    async ensureDefaultUser() {
        try {
            // Check if default user exists in auth.users
            // For development, we'll create a simple workaround
            // In production, you'd use proper Supabase Auth
            
            const defaultUserId = '00000000-0000-0000-0000-000000000000';
            
            // Try to insert a test user record (this might fail if auth is strict)
            // This is just for development - in production use proper Supabase Auth
            console.log('Using default user ID for development:', defaultUserId);
            
        } catch (error) {
            console.warn('Could not ensure default user (this is expected in development):', error.message);
        }
    }

    async saveReceiptData(receiptData) {
        if (!this.supabase) {
            console.warn('Supabase client not available, skipping database save');
            return null;
        }

        try {
            // For now, we'll use a default user_id since we don't have auth implemented
            // In production, you'd get this from the authenticated user
            const defaultUserId = '00000000-0000-0000-0000-000000000000';
            
            // Map OCR method to valid enum values
            const mapOcrMethod = (method) => {
                const methodMap = {
                    'OCR.space API': 'ai',
                    'Tesseract.js': 'ai',
                    'Manual Entry': 'manual',
                    'unknown': 'ai'
                };
                return methodMap[method] || 'ai';
            };

            const receiptRecord = {
                user_id: defaultUserId, // TODO: Replace with actual authenticated user ID
                merchant_name: receiptData.ocrData.merchantInfo?.name || 'Unknown Merchant',
                merchant_address: receiptData.ocrData.merchantInfo?.address || null,
                merchant_phone: receiptData.ocrData.merchantInfo?.phone || null,
                items: receiptData.ocrData.items || [],
                subtotal: parseFloat(receiptData.ocrData.subtotal || 0),
                tax_amount: parseFloat(receiptData.ocrData.tax || 0),
                service_charge: parseFloat(receiptData.ocrData.serviceCharge || 0),
                total_amount: parseFloat(receiptData.ocrData.total || 0),
                raw_ocr_text: receiptData.ocrData.rawText || '',
                ocr_method: mapOcrMethod(receiptData.ocrData.ocrMethod),
                confidence_score: parseFloat(receiptData.ocrData.confidence || 0),
                metadata: {
                    ...receiptData.metadata,
                    receiptType: receiptData.ocrData.receiptType,
                    currency: receiptData.ocrData.currency || 'INR',
                    categoryId: receiptData.ocrData.categoryId,
                    categoryName: receiptData.ocrData.categoryName,
                    categoryConfidence: receiptData.ocrData.categoryConfidence
                }
            };

            const { data, error } = await this.supabase
                .from('receipts')
                .insert([receiptRecord])
                .select();

            if (error) throw error;

            console.log('Receipt data saved to database:', data[0]?.id);
            return data[0];

        } catch (error) {
            console.error('Failed to save receipt data:', error);
            throw error;
        }
    }

    async getReceiptHistory(options = {}) {
        if (!this.supabase) {
            throw new Error('Supabase client not available');
        }

        try {
            let query = this.supabase
                .from('receipts')
                .select('*')
                .order('created_at', { ascending: false });

            // Apply filters
            if (options.startDate) {
                query = query.gte('created_at', options.startDate);
            }
            if (options.endDate) {
                query = query.lte('created_at', options.endDate);
            }
            // Note: Category filtering now needs to be done on metadata->categoryName
            // since we're storing category info in metadata
            if (options.category) {
                query = query.eq('metadata->>categoryName', options.category);
            }
            if (options.limit) {
                query = query.limit(options.limit);
            } else {
                query = query.limit(50);
            }

            const { data, error } = await query;

            if (error) throw error;

            return data || [];

        } catch (error) {
            console.error('Failed to fetch receipt history:', error);
            throw error;
        }
    }

    async getReceiptById(id) {
        if (!this.supabase) {
            throw new Error('Supabase client not available');
        }

        try {
            const { data, error } = await this.supabase
                .from('receipts')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;

            return data;

        } catch (error) {
            console.error('Failed to fetch receipt:', error);
            throw error;
        }
    }

    async deleteReceipt(id) {
        if (!this.supabase) {
            throw new Error('Supabase client not available');
        }

        try {
            const { error } = await this.supabase
                .from('receipts')
                .delete()
                .eq('id', id);

            if (error) throw error;

            console.log('Receipt deleted:', id);
            return true;

        } catch (error) {
            console.error('Failed to delete receipt:', error);
            throw error;
        }
    }

    async getStats() {
        if (!this.supabase) {
            throw new Error('Supabase client not available');
        }

        try {
            // Get total receipts count
            const { count: totalReceipts, error: countError } = await this.supabase
                .from('receipts')
                .select('*', { count: 'exact', head: true });

            if (countError) throw countError;

            // Get total amount processed
            const { data: amountData, error: amountError } = await this.supabase
                .from('receipts')
                .select('total_amount');

            if (amountError) throw amountError;

            const totalAmount = amountData.reduce((sum, receipt) => sum + (receipt.total_amount || 0), 0);

            // Get receipts from last 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const { count: recentReceipts, error: recentError } = await this.supabase
                .from('receipts')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', thirtyDaysAgo.toISOString());

            if (recentError) throw recentError;

            return {
                totalReceipts: totalReceipts || 0,
                totalAmount: totalAmount || 0,
                recentReceipts: recentReceipts || 0,
                averageAmount: totalReceipts > 0 ? totalAmount / totalReceipts : 0
            };

        } catch (error) {
            console.error('Failed to fetch stats:', error);
            throw error;
        }
    }
}

module.exports = new SupabaseService();
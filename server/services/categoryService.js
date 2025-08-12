// Category Service - Auto-categorization and expense management

const supabaseService = require('./supabaseService');

class CategoryService {
    constructor() {
        this.categories = null;
        this.loadCategories();
    }

    // Load categories from database
    async loadCategories() {
        try {
            const { data, error } = await supabaseService.supabase
                .from('expense_categories')
                .select('*')
                .order('name');

            if (error) throw error;

            this.categories = data;
            console.log('📊 Loaded', data.length, 'expense categories');

        } catch (error) {
            console.error('❌ Error loading categories:', error);
            this.categories = [];
        }
    }

    // Auto-categorize a receipt based on merchant and items
    async categorizeReceipt(receiptData) {
        try {
            if (!this.categories || this.categories.length === 0) {
                await this.loadCategories();
            }

            const merchantName = (receiptData.merchantInfo?.name || '').toLowerCase();
            const items = receiptData.items || [];
            const receiptType = receiptData.receiptType || 'general';

            console.log('🔍 Auto-categorizing receipt:', {
                merchant: merchantName,
                type: receiptType,
                itemCount: items.length
            });

            let bestCategory = null;
            let bestScore = 0;

            // Score each category
            for (const category of this.categories) {
                let score = 0;
                const keywords = category.keywords || [];

                // Check merchant name against keywords
                keywords.forEach(keyword => {
                    if (merchantName.includes(keyword.toLowerCase())) {
                        score += 10;
                    }
                });

                // Check items against keywords
                items.forEach(item => {
                    const itemName = (item.name || '').toLowerCase();
                    keywords.forEach(keyword => {
                        if (itemName.includes(keyword.toLowerCase())) {
                            score += 5;
                        }
                    });
                });

                // Receipt type matching
                if (receiptType === 'transportation' && category.name === 'Transportation') {
                    score += 20;
                } else if (receiptType === 'restaurant' && category.name === 'Food & Dining') {
                    score += 20;
                } else if (receiptType === 'retail' && category.name === 'Shopping') {
                    score += 15;
                }

                // Special patterns
                if (merchantName.includes('restaurant') || merchantName.includes('cafe') || merchantName.includes('hotel')) {
                    if (category.name === 'Food & Dining') score += 15;
                }

                if (merchantName.includes('depot') || merchantName.includes('transport') || merchantName.includes('bus')) {
                    if (category.name === 'Transportation') score += 15;
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestCategory = category;
                }
            }

            // Default to 'Other' if no good match
            if (!bestCategory || bestScore < 5) {
                bestCategory = this.categories.find(c => c.name === 'Other') || this.categories[0];
            }

            console.log('✅ Categorized as:', bestCategory.name, 'with score:', bestScore);

            return {
                category: bestCategory,
                confidence: Math.min(bestScore / 20, 1), // Normalize to 0-1
                reasoning: this.generateCategoryReasoning(bestCategory, bestScore, merchantName, receiptType)
            };

        } catch (error) {
            console.error('❌ Error categorizing receipt:', error);
            return {
                category: { name: 'Other', color: '#64748B' },
                confidence: 0,
                reasoning: 'Auto-categorization failed'
            };
        }
    }

    // Generate reasoning for categorization
    generateCategoryReasoning(category, score, merchantName, receiptType) {
        const reasons = [];

        if (receiptType === 'transportation' && category.name === 'Transportation') {
            reasons.push('Detected as transportation receipt');
        } else if (receiptType === 'restaurant' && category.name === 'Food & Dining') {
            reasons.push('Detected as restaurant receipt');
        }

        if (merchantName.includes('restaurant') || merchantName.includes('cafe')) {
            reasons.push('Merchant appears to be food-related');
        }

        if (merchantName.includes('depot') || merchantName.includes('transport')) {
            reasons.push('Merchant appears to be transport-related');
        }

        if (score >= 15) {
            reasons.push('High keyword match confidence');
        } else if (score >= 10) {
            reasons.push('Moderate keyword match confidence');
        } else if (score < 5) {
            reasons.push('Low confidence - defaulted to Other');
        }

        return reasons.join(', ') || 'Based on content analysis';
    }

    // Get all categories
    async getCategories() {
        try {
            if (!this.categories) {
                await this.loadCategories();
            }

            return {
                success: true,
                data: this.categories
            };

        } catch (error) {
            console.error('❌ Error getting categories:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Create new category
    async createCategory(categoryData) {
        try {
            const { data, error } = await supabaseService.supabase
                .from('expense_categories')
                .insert([{
                    name: categoryData.name,
                    description: categoryData.description,
                    color: categoryData.color || '#3B82F6',
                    icon: categoryData.icon || 'tag',
                    keywords: categoryData.keywords || []
                }])
                .select()
                .single();

            if (error) throw error;

            // Reload categories
            await this.loadCategories();

            return {
                success: true,
                data
            };

        } catch (error) {
            console.error('❌ Error creating category:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Update category
    async updateCategory(categoryId, updates) {
        try {
            const { data, error } = await supabaseService.supabase
                .from('expense_categories')
                .update(updates)
                .eq('id', categoryId)
                .select()
                .single();

            if (error) throw error;

            // Reload categories
            await this.loadCategories();

            return {
                success: true,
                data
            };

        } catch (error) {
            console.error('❌ Error updating category:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get spending by category
    async getSpendingByCategory(startDate, endDate) {
        try {
            let query = supabaseService.supabase
                .from('receipts')
                .select(`
                    category,
                    total_amount,
                    created_at,
                    expense_categories(name, color, icon)
                `);

            if (startDate) {
                query = query.gte('created_at', startDate);
            }
            if (endDate) {
                query = query.lte('created_at', endDate);
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;

            // Group by category
            const categorySpending = {};
            let totalSpending = 0;

            data.forEach(receipt => {
                const category = receipt.category || 'Other';
                const amount = parseFloat(receipt.total_amount) || 0;

                if (!categorySpending[category]) {
                    categorySpending[category] = {
                        name: category,
                        total: 0,
                        count: 0,
                        color: receipt.expense_categories?.color || '#64748B',
                        icon: receipt.expense_categories?.icon || 'tag'
                    };
                }

                categorySpending[category].total += amount;
                categorySpending[category].count += 1;
                totalSpending += amount;
            });

            // Convert to array and add percentages
            const categoryArray = Object.values(categorySpending).map(cat => ({
                ...cat,
                percentage: totalSpending > 0 ? ((cat.total / totalSpending) * 100).toFixed(1) : 0
            })).sort((a, b) => b.total - a.total);

            return {
                success: true,
                data: {
                    categories: categoryArray,
                    totalSpending,
                    period: { startDate, endDate }
                }
            };

        } catch (error) {
            console.error('❌ Error getting category spending:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get category trends
    async getCategoryTrends(category, months = 6) {
        try {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setMonth(startDate.getMonth() - months);

            const { data, error } = await supabaseService.supabase
                .from('receipts')
                .select('total_amount, created_at')
                .eq('category', category)
                .gte('created_at', startDate.toISOString())
                .lte('created_at', endDate.toISOString())
                .order('created_at');

            if (error) throw error;

            // Group by month
            const monthlyData = {};
            data.forEach(receipt => {
                const date = new Date(receipt.created_at);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                
                if (!monthlyData[monthKey]) {
                    monthlyData[monthKey] = { total: 0, count: 0 };
                }
                
                monthlyData[monthKey].total += parseFloat(receipt.total_amount) || 0;
                monthlyData[monthKey].count += 1;
            });

            // Convert to array
            const trends = Object.entries(monthlyData).map(([month, data]) => ({
                month,
                total: data.total,
                count: data.count,
                average: data.count > 0 ? data.total / data.count : 0
            }));

            return {
                success: true,
                data: trends
            };

        } catch (error) {
            console.error('❌ Error getting category trends:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new CategoryService();
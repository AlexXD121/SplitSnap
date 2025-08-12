// Analytics Service - Spending insights and recommendations

const supabaseService = require('./supabaseService');

class AnalyticsService {
    constructor() {
        this.insightTypes = {
            MONTHLY_SUMMARY: 'monthly_summary',
            CATEGORY_TREND: 'category_trend',
            SPENDING_PATTERN: 'spending_pattern',
            DUPLICATE_DETECTION: 'duplicate_detection',
            BUDGET_ALERT: 'budget_alert'
        };
    }

    // Generate comprehensive spending analytics
    async generateSpendingAnalytics(startDate, endDate, userId = null) {
        try {
            console.log('📊 Generating spending analytics for period:', startDate, 'to', endDate);

            const analytics = {
                period: { startDate, endDate },
                summary: await this.getSpendingSummary(startDate, endDate),
                categoryBreakdown: await this.getCategoryBreakdown(startDate, endDate),
                trends: await this.getSpendingTrends(startDate, endDate),
                patterns: await this.getSpendingPatterns(startDate, endDate),
                recommendations: [],
                insights: []
            };

            // Generate insights and recommendations
            analytics.recommendations = await this.generateRecommendations(analytics);
            analytics.insights = await this.generateInsights(analytics);

            // Save insights to database
            await this.saveInsights(analytics, userId);

            return {
                success: true,
                data: analytics
            };

        } catch (error) {
            console.error('❌ Error generating analytics:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get spending summary
    async getSpendingSummary(startDate, endDate) {
        try {
            let query = supabaseService.supabase
                .from('receipts')
                .select('total_amount, created_at, receipt_type');

            if (startDate) query = query.gte('created_at', startDate);
            if (endDate) query = query.lte('created_at', endDate);

            const { data, error } = await query;
            if (error) throw error;

            const totalSpent = data.reduce((sum, receipt) => sum + parseFloat(receipt.total_amount || 0), 0);
            const totalTransactions = data.length;
            const averageTransaction = totalTransactions > 0 ? totalSpent / totalTransactions : 0;

            // Calculate daily average
            const daysDiff = startDate && endDate ? 
                Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) : 30;
            const dailyAverage = daysDiff > 0 ? totalSpent / daysDiff : 0;

            // Receipt type breakdown
            const typeBreakdown = {};
            data.forEach(receipt => {
                const type = receipt.receipt_type || 'general';
                typeBreakdown[type] = (typeBreakdown[type] || 0) + parseFloat(receipt.total_amount || 0);
            });

            return {
                totalSpent,
                totalTransactions,
                averageTransaction,
                dailyAverage,
                typeBreakdown
            };

        } catch (error) {
            console.error('❌ Error getting spending summary:', error);
            return {};
        }
    }

    // Get category breakdown
    async getCategoryBreakdown(startDate, endDate) {
        try {
            let query = supabaseService.supabase
                .from('receipts')
                .select(`
                    category,
                    total_amount,
                    created_at,
                    expense_categories(name, color, icon)
                `);

            if (startDate) query = query.gte('created_at', startDate);
            if (endDate) query = query.lte('created_at', endDate);

            const { data, error } = await query;
            if (error) throw error;

            const categoryData = {};
            let totalSpent = 0;

            data.forEach(receipt => {
                const category = receipt.category || 'Other';
                const amount = parseFloat(receipt.total_amount || 0);
                
                if (!categoryData[category]) {
                    categoryData[category] = {
                        name: category,
                        total: 0,
                        count: 0,
                        color: receipt.expense_categories?.color || '#64748B',
                        icon: receipt.expense_categories?.icon || 'tag',
                        transactions: []
                    };
                }

                categoryData[category].total += amount;
                categoryData[category].count += 1;
                categoryData[category].transactions.push({
                    amount,
                    date: receipt.created_at
                });
                totalSpent += amount;
            });

            // Add percentages and sort
            const categories = Object.values(categoryData).map(cat => ({
                ...cat,
                percentage: totalSpent > 0 ? ((cat.total / totalSpent) * 100).toFixed(1) : 0,
                average: cat.count > 0 ? cat.total / cat.count : 0
            })).sort((a, b) => b.total - a.total);

            return {
                categories,
                totalSpent
            };

        } catch (error) {
            console.error('❌ Error getting category breakdown:', error);
            return { categories: [], totalSpent: 0 };
        }
    }

    // Get spending trends
    async getSpendingTrends(startDate, endDate) {
        try {
            let query = supabaseService.supabase
                .from('receipts')
                .select('total_amount, created_at, category')
                .order('created_at');

            if (startDate) query = query.gte('created_at', startDate);
            if (endDate) query = query.lte('created_at', endDate);

            const { data, error } = await query;
            if (error) throw error;

            // Group by day
            const dailyData = {};
            data.forEach(receipt => {
                const date = new Date(receipt.created_at).toISOString().split('T')[0];
                if (!dailyData[date]) {
                    dailyData[date] = { total: 0, count: 0, categories: {} };
                }
                
                const amount = parseFloat(receipt.total_amount || 0);
                dailyData[date].total += amount;
                dailyData[date].count += 1;

                const category = receipt.category || 'Other';
                dailyData[date].categories[category] = (dailyData[date].categories[category] || 0) + amount;
            });

            // Convert to array and calculate moving averages
            const trends = Object.entries(dailyData).map(([date, data]) => ({
                date,
                total: data.total,
                count: data.count,
                average: data.count > 0 ? data.total / data.count : 0,
                categories: data.categories
            })).sort((a, b) => new Date(a.date) - new Date(b.date));

            // Calculate 7-day moving average
            trends.forEach((trend, index) => {
                const start = Math.max(0, index - 6);
                const window = trends.slice(start, index + 1);
                trend.movingAverage = window.reduce((sum, t) => sum + t.total, 0) / window.length;
            });

            return trends;

        } catch (error) {
            console.error('❌ Error getting spending trends:', error);
            return [];
        }
    }

    // Get spending patterns
    async getSpendingPatterns(startDate, endDate) {
        try {
            let query = supabaseService.supabase
                .from('receipts')
                .select('total_amount, created_at, merchant_name, category');

            if (startDate) query = query.gte('created_at', startDate);
            if (endDate) query = query.lte('created_at', endDate);

            const { data, error } = await query;
            if (error) throw error;

            const patterns = {
                dayOfWeek: {},
                hourOfDay: {},
                topMerchants: {},
                frequentAmounts: {},
                spendingHabits: []
            };

            data.forEach(receipt => {
                const date = new Date(receipt.created_at);
                const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
                const hour = date.getHours();
                const amount = parseFloat(receipt.total_amount || 0);
                const merchant = receipt.merchant_name || 'Unknown';

                // Day of week pattern
                patterns.dayOfWeek[dayOfWeek] = (patterns.dayOfWeek[dayOfWeek] || 0) + amount;

                // Hour of day pattern
                patterns.hourOfDay[hour] = (patterns.hourOfDay[hour] || 0) + amount;

                // Top merchants
                if (!patterns.topMerchants[merchant]) {
                    patterns.topMerchants[merchant] = { total: 0, count: 0 };
                }
                patterns.topMerchants[merchant].total += amount;
                patterns.topMerchants[merchant].count += 1;

                // Frequent amounts (rounded to nearest 10)
                const roundedAmount = Math.round(amount / 10) * 10;
                patterns.frequentAmounts[roundedAmount] = (patterns.frequentAmounts[roundedAmount] || 0) + 1;
            });

            // Convert to arrays and sort
            patterns.dayOfWeek = Object.entries(patterns.dayOfWeek)
                .map(([day, total]) => ({ day, total }))
                .sort((a, b) => b.total - a.total);

            patterns.hourOfDay = Object.entries(patterns.hourOfDay)
                .map(([hour, total]) => ({ hour: parseInt(hour), total }))
                .sort((a, b) => a.hour - b.hour);

            patterns.topMerchants = Object.entries(patterns.topMerchants)
                .map(([merchant, data]) => ({ merchant, ...data, average: data.total / data.count }))
                .sort((a, b) => b.total - a.total)
                .slice(0, 10);

            patterns.frequentAmounts = Object.entries(patterns.frequentAmounts)
                .map(([amount, count]) => ({ amount: parseInt(amount), count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);

            return patterns;

        } catch (error) {
            console.error('❌ Error getting spending patterns:', error);
            return {};
        }
    }

    // Generate recommendations
    async generateRecommendations(analytics) {
        const recommendations = [];

        try {
            const { summary, categoryBreakdown, patterns } = analytics;

            // High spending category recommendation
            if (categoryBreakdown.categories.length > 0) {
                const topCategory = categoryBreakdown.categories[0];
                if (topCategory.percentage > 40) {
                    recommendations.push({
                        type: 'spending_alert',
                        priority: 'high',
                        title: `High ${topCategory.name} Spending`,
                        message: `${topCategory.name} accounts for ${topCategory.percentage}% of your spending. Consider reviewing these expenses.`,
                        action: 'Review category details',
                        category: topCategory.name
                    });
                }
            }

            // Frequent merchant recommendation
            if (patterns.topMerchants && patterns.topMerchants.length > 0) {
                const topMerchant = patterns.topMerchants[0];
                if (topMerchant.count > 5) {
                    recommendations.push({
                        type: 'merchant_frequency',
                        priority: 'medium',
                        title: `Frequent visits to ${topMerchant.merchant}`,
                        message: `You've spent ₹${topMerchant.total.toFixed(2)} across ${topMerchant.count} visits. Average: ₹${topMerchant.average.toFixed(2)} per visit.`,
                        action: 'Consider loyalty programs or bulk purchases',
                        merchant: topMerchant.merchant
                    });
                }
            }

            // Daily spending recommendation
            if (summary.dailyAverage > 500) {
                recommendations.push({
                    type: 'daily_spending',
                    priority: 'medium',
                    title: 'High Daily Spending',
                    message: `Your daily average spending is ₹${summary.dailyAverage.toFixed(2)}. Consider setting a daily budget.`,
                    action: 'Set daily spending limit',
                    amount: summary.dailyAverage
                });
            }

            // Weekend vs weekday pattern
            if (patterns.dayOfWeek) {
                const weekendSpending = patterns.dayOfWeek
                    .filter(d => d.day === 'Saturday' || d.day === 'Sunday')
                    .reduce((sum, d) => sum + d.total, 0);
                
                const weekdaySpending = patterns.dayOfWeek
                    .filter(d => d.day !== 'Saturday' && d.day !== 'Sunday')
                    .reduce((sum, d) => sum + d.total, 0);

                if (weekendSpending > weekdaySpending * 0.4) {
                    recommendations.push({
                        type: 'weekend_spending',
                        priority: 'low',
                        title: 'Weekend Spending Pattern',
                        message: 'You tend to spend more on weekends. Plan weekend budgets in advance.',
                        action: 'Set weekend budget',
                        weekendTotal: weekendSpending,
                        weekdayTotal: weekdaySpending
                    });
                }
            }

        } catch (error) {
            console.error('❌ Error generating recommendations:', error);
        }

        return recommendations;
    }

    // Generate insights
    async generateInsights(analytics) {
        const insights = [];

        try {
            const { summary, categoryBreakdown, trends, patterns } = analytics;

            // Spending velocity insight
            if (trends.length > 7) {
                const recentWeek = trends.slice(-7);
                const previousWeek = trends.slice(-14, -7);
                
                const recentTotal = recentWeek.reduce((sum, t) => sum + t.total, 0);
                const previousTotal = previousWeek.reduce((sum, t) => sum + t.total, 0);
                
                if (previousTotal > 0) {
                    const change = ((recentTotal - previousTotal) / previousTotal) * 100;
                    insights.push({
                        type: 'spending_velocity',
                        title: 'Weekly Spending Change',
                        value: `${change > 0 ? '+' : ''}${change.toFixed(1)}%`,
                        description: `Your spending ${change > 0 ? 'increased' : 'decreased'} by ${Math.abs(change).toFixed(1)}% compared to last week`,
                        trend: change > 0 ? 'up' : 'down',
                        impact: Math.abs(change) > 20 ? 'high' : Math.abs(change) > 10 ? 'medium' : 'low'
                    });
                }
            }

            // Most expensive day insight
            if (trends.length > 0) {
                const maxSpendingDay = trends.reduce((max, day) => day.total > max.total ? day : max);
                insights.push({
                    type: 'peak_spending',
                    title: 'Highest Spending Day',
                    value: `₹${maxSpendingDay.total.toFixed(2)}`,
                    description: `Your highest spending day was ${new Date(maxSpendingDay.date).toLocaleDateString()}`,
                    date: maxSpendingDay.date,
                    impact: maxSpendingDay.total > summary.dailyAverage * 2 ? 'high' : 'medium'
                });
            }

            // Category diversity insight
            const activeCategories = categoryBreakdown.categories.filter(c => c.count > 0).length;
            insights.push({
                type: 'category_diversity',
                title: 'Spending Categories',
                value: activeCategories.toString(),
                description: `You spent across ${activeCategories} different categories`,
                impact: activeCategories > 5 ? 'high' : activeCategories > 3 ? 'medium' : 'low'
            });

            // Transaction frequency insight
            const avgTransactionsPerDay = summary.totalTransactions / (trends.length || 1);
            insights.push({
                type: 'transaction_frequency',
                title: 'Daily Transactions',
                value: avgTransactionsPerDay.toFixed(1),
                description: `You make an average of ${avgTransactionsPerDay.toFixed(1)} transactions per day`,
                impact: avgTransactionsPerDay > 3 ? 'high' : avgTransactionsPerDay > 1.5 ? 'medium' : 'low'
            });

        } catch (error) {
            console.error('❌ Error generating insights:', error);
        }

        return insights;
    }

    // Save insights to database
    async saveInsights(analytics, userId) {
        try {
            const insight = {
                user_id: userId || 'anonymous',
                insight_type: this.insightTypes.MONTHLY_SUMMARY,
                period_start: analytics.period.startDate,
                period_end: analytics.period.endDate,
                data: {
                    summary: analytics.summary,
                    recommendations: analytics.recommendations,
                    insights: analytics.insights,
                    generated_at: new Date().toISOString()
                }
            };

            const { error } = await supabaseService.supabase
                .from('spending_insights')
                .insert([insight]);

            if (error) throw error;

            console.log('💾 Saved spending insights to database');

        } catch (error) {
            console.error('❌ Error saving insights:', error);
        }
    }

    // Detect duplicate receipts
    async detectDuplicates() {
        try {
            const { data, error } = await supabaseService.supabase
                .from('receipts')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;

            const duplicates = [];
            const processed = new Set();

            for (let i = 0; i < data.length; i++) {
                if (processed.has(data[i].id)) continue;

                const receipt = data[i];
                const potentialDuplicates = [];

                for (let j = i + 1; j < data.length; j++) {
                    if (processed.has(data[j].id)) continue;

                    const other = data[j];
                    const similarity = this.calculateReceiptSimilarity(receipt, other);

                    if (similarity > 0.8) {
                        potentialDuplicates.push({
                            receipt: other,
                            similarity
                        });
                        processed.add(other.id);
                    }
                }

                if (potentialDuplicates.length > 0) {
                    duplicates.push({
                        original: receipt,
                        duplicates: potentialDuplicates
                    });
                    processed.add(receipt.id);
                }
            }

            return {
                success: true,
                data: duplicates
            };

        } catch (error) {
            console.error('❌ Error detecting duplicates:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Calculate similarity between two receipts
    calculateReceiptSimilarity(receipt1, receipt2) {
        let score = 0;
        let factors = 0;

        // Amount similarity (40% weight)
        const amount1 = parseFloat(receipt1.total_amount || 0);
        const amount2 = parseFloat(receipt2.total_amount || 0);
        if (amount1 > 0 && amount2 > 0) {
            const amountDiff = Math.abs(amount1 - amount2) / Math.max(amount1, amount2);
            score += (1 - amountDiff) * 0.4;
            factors += 0.4;
        }

        // Merchant similarity (30% weight)
        const merchant1 = (receipt1.merchant_name || '').toLowerCase();
        const merchant2 = (receipt2.merchant_name || '').toLowerCase();
        if (merchant1 && merchant2) {
            const merchantSimilarity = this.calculateStringSimilarity(merchant1, merchant2);
            score += merchantSimilarity * 0.3;
            factors += 0.3;
        }

        // Time proximity (20% weight)
        const time1 = new Date(receipt1.created_at);
        const time2 = new Date(receipt2.created_at);
        const timeDiff = Math.abs(time1 - time2) / (1000 * 60 * 60); // hours
        if (timeDiff < 24) {
            const timeScore = Math.max(0, 1 - (timeDiff / 24));
            score += timeScore * 0.2;
            factors += 0.2;
        }

        // Item similarity (10% weight)
        const items1 = receipt1.items || [];
        const items2 = receipt2.items || [];
        if (items1.length > 0 && items2.length > 0) {
            const itemSimilarity = this.calculateItemSimilarity(items1, items2);
            score += itemSimilarity * 0.1;
            factors += 0.1;
        }

        return factors > 0 ? score / factors : 0;
    }

    // Calculate string similarity
    calculateStringSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    // Calculate Levenshtein distance
    levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    // Calculate item similarity
    calculateItemSimilarity(items1, items2) {
        if (items1.length === 0 && items2.length === 0) return 1;
        if (items1.length === 0 || items2.length === 0) return 0;

        let matches = 0;
        const maxLength = Math.max(items1.length, items2.length);

        items1.forEach(item1 => {
            const bestMatch = items2.reduce((best, item2) => {
                const similarity = this.calculateStringSimilarity(
                    (item1.name || '').toLowerCase(),
                    (item2.name || '').toLowerCase()
                );
                return similarity > best ? similarity : best;
            }, 0);
            
            if (bestMatch > 0.7) matches++;
        });

        return matches / maxLength;
    }

    // Get historical insights
    async getHistoricalInsights(userId = null, limit = 10) {
        try {
            let query = supabaseService.supabase
                .from('spending_insights')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (userId) {
                query = query.eq('user_id', userId);
            }

            const { data, error } = await query;
            if (error) throw error;

            return {
                success: true,
                data
            };

        } catch (error) {
            console.error('❌ Error getting historical insights:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new AnalyticsService();
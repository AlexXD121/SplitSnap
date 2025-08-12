// Currency Service - Multi-currency support and conversion

const supabaseService = require('./supabaseService');
const axios = require('axios');

class CurrencyService {
    constructor() {
        this.supportedCurrencies = {
            'INR': { name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳' },
            'USD': { name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
            'EUR': { name: 'Euro', symbol: '€', flag: '🇪🇺' },
            'GBP': { name: 'British Pound', symbol: '£', flag: '🇬🇧' },
            'JPY': { name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵' },
            'AUD': { name: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺' },
            'CAD': { name: 'Canadian Dollar', symbol: 'C$', flag: '🇨🇦' },
            'SGD': { name: 'Singapore Dollar', symbol: 'S$', flag: '🇸🇬' },
            'AED': { name: 'UAE Dirham', symbol: 'د.إ', flag: '🇦🇪' },
            'SAR': { name: 'Saudi Riyal', symbol: 'ر.س', flag: '🇸🇦' }
        };
        
        this.exchangeRateAPI = 'https://api.exchangerate-api.com/v4/latest/';
        this.fallbackRates = null;
        this.lastUpdated = null;
    }

    // Get supported currencies
    getSupportedCurrencies() {
        return {
            success: true,
            data: Object.entries(this.supportedCurrencies).map(([code, info]) => ({
                code,
                ...info
            }))
        };
    }

    // Convert amount between currencies
    async convertCurrency(amount, fromCurrency, toCurrency) {
        try {
            console.log(`💱 Converting ${amount} ${fromCurrency} to ${toCurrency}`);

            if (fromCurrency === toCurrency) {
                return {
                    success: true,
                    data: {
                        originalAmount: amount,
                        convertedAmount: amount,
                        fromCurrency,
                        toCurrency,
                        rate: 1,
                        source: 'same_currency'
                    }
                };
            }

            // Get exchange rate
            const rate = await this.getExchangeRate(fromCurrency, toCurrency);
            if (!rate) {
                throw new Error(`Exchange rate not available for ${fromCurrency} to ${toCurrency}`);
            }

            const convertedAmount = amount * rate.rate;

            return {
                success: true,
                data: {
                    originalAmount: amount,
                    convertedAmount: Math.round(convertedAmount * 100) / 100,
                    fromCurrency,
                    toCurrency,
                    rate: rate.rate,
                    source: rate.source,
                    lastUpdated: rate.date
                }
            };

        } catch (error) {
            console.error('❌ Error converting currency:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get exchange rate between two currencies
    async getExchangeRate(fromCurrency, toCurrency) {
        try {
            // First try to get from database
            const dbRate = await this.getStoredRate(fromCurrency, toCurrency);
            if (dbRate && this.isRateRecent(dbRate.date)) {
                return {
                    rate: parseFloat(dbRate.rate),
                    source: 'database',
                    date: dbRate.date
                };
            }

            // Try to fetch from API
            const apiRate = await this.fetchRateFromAPI(fromCurrency, toCurrency);
            if (apiRate) {
                // Store in database
                await this.storeRate(fromCurrency, toCurrency, apiRate.rate);
                return {
                    rate: apiRate.rate,
                    source: 'api',
                    date: new Date().toISOString().split('T')[0]
                };
            }

            // Fallback to stored rates
            const fallbackRate = await this.getFallbackRate(fromCurrency, toCurrency);
            if (fallbackRate) {
                return {
                    rate: fallbackRate,
                    source: 'fallback',
                    date: 'static'
                };
            }

            return null;

        } catch (error) {
            console.error('❌ Error getting exchange rate:', error);
            return null;
        }
    }

    // Get stored rate from database
    async getStoredRate(fromCurrency, toCurrency) {
        try {
            const { data, error } = await supabaseService.supabase
                .from('currency_rates')
                .select('*')
                .eq('from_currency', fromCurrency)
                .eq('to_currency', toCurrency)
                .order('date', { ascending: false })
                .limit(1)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            return data;

        } catch (error) {
            console.error('❌ Error getting stored rate:', error);
            return null;
        }
    }

    // Check if rate is recent (within 24 hours)
    isRateRecent(dateString) {
        const rateDate = new Date(dateString);
        const now = new Date();
        const hoursDiff = (now - rateDate) / (1000 * 60 * 60);
        return hoursDiff < 24;
    }

    // Fetch rate from external API
    async fetchRateFromAPI(fromCurrency, toCurrency) {
        try {
            console.log(`🌐 Fetching ${fromCurrency} to ${toCurrency} rate from API`);

            const response = await axios.get(`${this.exchangeRateAPI}${fromCurrency}`, {
                timeout: 5000
            });

            if (response.data && response.data.rates && response.data.rates[toCurrency]) {
                return {
                    rate: response.data.rates[toCurrency],
                    source: 'exchangerate-api'
                };
            }

            return null;

        } catch (error) {
            console.warn('⚠️ API rate fetch failed:', error.message);
            return null;
        }
    }

    // Store rate in database
    async storeRate(fromCurrency, toCurrency, rate) {
        try {
            const { error } = await supabaseService.supabase
                .from('currency_rates')
                .upsert([{
                    from_currency: fromCurrency,
                    to_currency: toCurrency,
                    rate: rate,
                    date: new Date().toISOString().split('T')[0],
                    source: 'api'
                }], {
                    onConflict: 'from_currency,to_currency,date'
                });

            if (error) throw error;
            console.log(`💾 Stored rate: ${fromCurrency} to ${toCurrency} = ${rate}`);

        } catch (error) {
            console.error('❌ Error storing rate:', error);
        }
    }

    // Get fallback rate (hardcoded approximate rates)
    getFallbackRate(fromCurrency, toCurrency) {
        const fallbackRates = {
            'INR_USD': 0.012,
            'USD_INR': 83.25,
            'INR_EUR': 0.011,
            'EUR_INR': 90.15,
            'INR_GBP': 0.0095,
            'GBP_INR': 105.30,
            'USD_EUR': 0.92,
            'EUR_USD': 1.09,
            'USD_GBP': 0.79,
            'GBP_USD': 1.27,
            'INR_JPY': 1.8,
            'JPY_INR': 0.56,
            'INR_AUD': 0.018,
            'AUD_INR': 55.50,
            'INR_CAD': 0.016,
            'CAD_INR': 62.30,
            'INR_SGD': 0.016,
            'SGD_INR': 61.80,
            'INR_AED': 0.044,
            'AED_INR': 22.65,
            'INR_SAR': 0.045,
            'SAR_INR': 22.20
        };

        const key = `${fromCurrency}_${toCurrency}`;
        return fallbackRates[key] || null;
    }

    // Convert receipt to different currency
    async convertReceipt(receiptId, targetCurrency) {
        try {
            // Get receipt
            const { data: receipt, error } = await supabaseService.supabase
                .from('receipts')
                .select('*')
                .eq('id', receiptId)
                .single();

            if (error) throw error;

            const originalCurrency = receipt.currency || 'INR';
            
            if (originalCurrency === targetCurrency) {
                return {
                    success: true,
                    data: {
                        ...receipt,
                        converted: false,
                        message: 'Receipt is already in target currency'
                    }
                };
            }

            // Convert all amounts
            const conversions = await Promise.all([
                this.convertCurrency(parseFloat(receipt.subtotal || 0), originalCurrency, targetCurrency),
                this.convertCurrency(parseFloat(receipt.tax_amount || 0), originalCurrency, targetCurrency),
                this.convertCurrency(parseFloat(receipt.service_charge || 0), originalCurrency, targetCurrency),
                this.convertCurrency(parseFloat(receipt.total_amount || 0), originalCurrency, targetCurrency)
            ]);

            // Convert items
            const convertedItems = await Promise.all(
                (receipt.items || []).map(async (item) => {
                    const priceConversion = await this.convertCurrency(
                        parseFloat(item.price || 0), 
                        originalCurrency, 
                        targetCurrency
                    );
                    
                    return {
                        ...item,
                        price: priceConversion.success ? priceConversion.data.convertedAmount : item.price,
                        originalPrice: item.price,
                        originalCurrency
                    };
                })
            );

            const convertedReceipt = {
                ...receipt,
                subtotal: conversions[0].success ? conversions[0].data.convertedAmount : receipt.subtotal,
                tax_amount: conversions[1].success ? conversions[1].data.convertedAmount : receipt.tax_amount,
                service_charge: conversions[2].success ? conversions[2].data.convertedAmount : receipt.service_charge,
                total_amount: conversions[3].success ? conversions[3].data.convertedAmount : receipt.total_amount,
                currency: targetCurrency,
                items: convertedItems,
                conversion: {
                    originalCurrency,
                    targetCurrency,
                    rate: conversions[3].success ? conversions[3].data.rate : null,
                    convertedAt: new Date().toISOString(),
                    source: conversions[3].success ? conversions[3].data.source : null
                },
                converted: true
            };

            return {
                success: true,
                data: convertedReceipt
            };

        } catch (error) {
            console.error('❌ Error converting receipt:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get currency symbol
    getCurrencySymbol(currencyCode) {
        return this.supportedCurrencies[currencyCode]?.symbol || currencyCode;
    }

    // Format amount with currency
    formatAmount(amount, currencyCode) {
        const symbol = this.getCurrencySymbol(currencyCode);
        const formattedAmount = parseFloat(amount).toFixed(2);
        
        // Different formatting for different currencies
        switch (currencyCode) {
            case 'INR':
                return `₹${formattedAmount}`;
            case 'USD':
            case 'CAD':
            case 'AUD':
            case 'SGD':
                return `$${formattedAmount}`;
            case 'EUR':
                return `€${formattedAmount}`;
            case 'GBP':
                return `£${formattedAmount}`;
            case 'JPY':
                return `¥${Math.round(amount)}`;
            default:
                return `${symbol}${formattedAmount}`;
        }
    }

    // Get exchange rates for multiple currencies
    async getMultipleRates(baseCurrency, targetCurrencies) {
        try {
            const rates = {};
            
            for (const targetCurrency of targetCurrencies) {
                const rate = await this.getExchangeRate(baseCurrency, targetCurrency);
                if (rate) {
                    rates[targetCurrency] = {
                        rate: rate.rate,
                        source: rate.source,
                        lastUpdated: rate.date
                    };
                }
            }

            return {
                success: true,
                data: {
                    baseCurrency,
                    rates,
                    timestamp: new Date().toISOString()
                }
            };

        } catch (error) {
            console.error('❌ Error getting multiple rates:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Update all exchange rates
    async updateAllRates() {
        try {
            console.log('🔄 Updating all exchange rates...');
            
            const baseCurrencies = ['INR', 'USD', 'EUR'];
            const targetCurrencies = Object.keys(this.supportedCurrencies);
            let updated = 0;

            for (const base of baseCurrencies) {
                for (const target of targetCurrencies) {
                    if (base !== target) {
                        const rate = await this.fetchRateFromAPI(base, target);
                        if (rate) {
                            await this.storeRate(base, target, rate.rate);
                            updated++;
                        }
                        
                        // Small delay to avoid rate limiting
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                }
            }

            console.log(`✅ Updated ${updated} exchange rates`);
            return {
                success: true,
                data: {
                    updated,
                    timestamp: new Date().toISOString()
                }
            };

        } catch (error) {
            console.error('❌ Error updating rates:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new CurrencyService();
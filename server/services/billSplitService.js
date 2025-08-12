// Bill Splitting Service - Smart bill splitting with multiple methods

const supabaseService = require('./supabaseService');

class BillSplitService {
    constructor() {
        this.splitMethods = {
            EQUAL: 'equal',
            BY_ITEMS: 'by_items',
            CUSTOM: 'custom',
            PERCENTAGE: 'percentage'
        };
    }

    // Create a new bill split
    async createSplit(receiptId, splitData) {
        try {
            console.log('🔄 Creating bill split:', splitData);

            const split = {
                receipt_id: receiptId,
                split_name: splitData.name || 'Bill Split',
                split_method: splitData.method || this.splitMethods.EQUAL,
                total_people: splitData.participants.length,
                created_by: splitData.createdBy || 'Anonymous',
                split_data: {
                    participants: splitData.participants,
                    method: splitData.method,
                    customAmounts: splitData.customAmounts || {},
                    itemAssignments: splitData.itemAssignments || {}
                }
            };

            const { data, error } = await supabaseService.supabase
                .from('bill_splits')
                .insert([split])
                .select()
                .single();

            if (error) throw error;

            // Create participants
            await this.createParticipants(data.id, splitData.participants, splitData);

            // Calculate split amounts
            const calculatedSplit = await this.calculateSplit(data.id);

            console.log('✅ Bill split created successfully:', data.id);
            return {
                success: true,
                data: calculatedSplit
            };

        } catch (error) {
            console.error('❌ Error creating bill split:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Create participants for a split
    async createParticipants(splitId, participants, splitData) {
        const participantRecords = participants.map(participant => ({
            split_id: splitId,
            name: participant.name,
            email: participant.email || null,
            phone: participant.phone || null,
            items_assigned: participant.items || []
        }));

        const { error } = await supabaseService.supabase
            .from('split_participants')
            .insert(participantRecords);

        if (error) throw error;
    }

    // Calculate split amounts based on method
    async calculateSplit(splitId) {
        try {
            // Get split details
            const { data: split, error: splitError } = await supabaseService.supabase
                .from('bill_splits')
                .select(`
                    *,
                    receipts(*),
                    split_participants(*)
                `)
                .eq('id', splitId)
                .single();

            if (splitError) throw splitError;

            const receipt = split.receipts;
            const participants = split.split_participants;
            const method = split.split_method;

            let calculations = {};

            switch (method) {
                case this.splitMethods.EQUAL:
                    calculations = this.calculateEqualSplit(receipt, participants);
                    break;
                case this.splitMethods.BY_ITEMS:
                    calculations = this.calculateItemBasedSplit(receipt, participants);
                    break;
                case this.splitMethods.CUSTOM:
                    calculations = this.calculateCustomSplit(receipt, participants, split.split_data);
                    break;
                case this.splitMethods.PERCENTAGE:
                    calculations = this.calculatePercentageSplit(receipt, participants, split.split_data);
                    break;
                default:
                    calculations = this.calculateEqualSplit(receipt, participants);
            }

            // Update participant amounts
            await this.updateParticipantAmounts(participants, calculations);

            return {
                split,
                calculations,
                summary: this.generateSplitSummary(receipt, calculations)
            };

        } catch (error) {
            console.error('❌ Error calculating split:', error);
            throw error;
        }
    }

    // Equal split calculation
    calculateEqualSplit(receipt, participants) {
        const totalAmount = parseFloat(receipt.total_amount);
        const perPersonAmount = totalAmount / participants.length;

        const calculations = {};
        participants.forEach(participant => {
            calculations[participant.id] = {
                name: participant.name,
                amount: perPersonAmount,
                items: [],
                share: (perPersonAmount / totalAmount * 100).toFixed(1)
            };
        });

        return calculations;
    }

    // Item-based split calculation
    calculateItemBasedSplit(receipt, participants) {
        const items = receipt.items || [];
        const totalAmount = parseFloat(receipt.total_amount);
        const itemsTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        // Calculate tax and service charge ratio
        const taxRatio = itemsTotal > 0 ? totalAmount / itemsTotal : 1;

        const calculations = {};
        participants.forEach(participant => {
            calculations[participant.id] = {
                name: participant.name,
                amount: 0,
                items: [],
                share: 0
            };
        });

        // Assign items to participants
        participants.forEach(participant => {
            const assignedItems = participant.items_assigned || [];
            let participantTotal = 0;

            assignedItems.forEach(itemId => {
                const item = items.find(i => i.id === itemId || i.name === itemId);
                if (item) {
                    const itemCost = item.price * item.quantity;
                    participantTotal += itemCost;
                    calculations[participant.id].items.push({
                        name: item.name,
                        price: item.price,
                        quantity: item.quantity,
                        total: itemCost
                    });
                }
            });

            // Apply tax and service charge proportionally
            const finalAmount = participantTotal * taxRatio;
            calculations[participant.id].amount = finalAmount;
            calculations[participant.id].share = totalAmount > 0 ? (finalAmount / totalAmount * 100).toFixed(1) : 0;
        });

        return calculations;
    }

    // Custom amount split calculation
    calculateCustomSplit(receipt, participants, splitData) {
        const customAmounts = splitData.customAmounts || {};
        const calculations = {};

        participants.forEach(participant => {
            const customAmount = customAmounts[participant.id] || 0;
            calculations[participant.id] = {
                name: participant.name,
                amount: customAmount,
                items: [],
                share: receipt.total_amount > 0 ? (customAmount / receipt.total_amount * 100).toFixed(1) : 0
            };
        });

        return calculations;
    }

    // Percentage-based split calculation
    calculatePercentageSplit(receipt, participants, splitData) {
        const percentages = splitData.percentages || {};
        const totalAmount = parseFloat(receipt.total_amount);
        const calculations = {};

        participants.forEach(participant => {
            const percentage = percentages[participant.id] || 0;
            const amount = (totalAmount * percentage) / 100;
            
            calculations[participant.id] = {
                name: participant.name,
                amount: amount,
                items: [],
                share: percentage.toFixed(1)
            };
        });

        return calculations;
    }

    // Update participant amounts in database
    async updateParticipantAmounts(participants, calculations) {
        const updates = participants.map(participant => ({
            id: participant.id,
            amount_owed: calculations[participant.id]?.amount || 0
        }));

        for (const update of updates) {
            await supabaseService.supabase
                .from('split_participants')
                .update({ amount_owed: update.amount_owed })
                .eq('id', update.id);
        }
    }

    // Generate split summary
    generateSplitSummary(receipt, calculations) {
        const totalAmount = parseFloat(receipt.total_amount);
        const participantCount = Object.keys(calculations).length;
        const calculatedTotal = Object.values(calculations).reduce((sum, calc) => sum + calc.amount, 0);

        return {
            totalAmount,
            participantCount,
            calculatedTotal,
            difference: Math.abs(totalAmount - calculatedTotal),
            averagePerPerson: totalAmount / participantCount,
            currency: receipt.currency || 'INR'
        };
    }

    // Get split details
    async getSplit(splitId) {
        try {
            const { data, error } = await supabaseService.supabase
                .from('bill_splits')
                .select(`
                    *,
                    receipts(*),
                    split_participants(*)
                `)
                .eq('id', splitId)
                .single();

            if (error) throw error;

            return {
                success: true,
                data
            };

        } catch (error) {
            console.error('❌ Error getting split:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Update payment status
    async updatePaymentStatus(participantId, status, paymentMethod = null) {
        try {
            const updateData = {
                payment_status: status,
                payment_method: paymentMethod
            };

            if (status === 'paid') {
                updateData.payment_date = new Date().toISOString();
                
                // Get participant amount and update amount_paid
                const { data: participant } = await supabaseService.supabase
                    .from('split_participants')
                    .select('amount_owed')
                    .eq('id', participantId)
                    .single();

                if (participant) {
                    updateData.amount_paid = participant.amount_owed;
                }
            }

            const { data, error } = await supabaseService.supabase
                .from('split_participants')
                .update(updateData)
                .eq('id', participantId)
                .select()
                .single();

            if (error) throw error;

            return {
                success: true,
                data
            };

        } catch (error) {
            console.error('❌ Error updating payment status:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get user's splits
    async getUserSplits(userIdentifier) {
        try {
            const { data, error } = await supabaseService.supabase
                .from('bill_splits')
                .select(`
                    *,
                    receipts(merchant_name, total_amount, created_at),
                    split_participants(name, amount_owed, payment_status)
                `)
                .or(`created_by.eq.${userIdentifier},split_participants.name.eq.${userIdentifier}`)
                .order('created_at', { ascending: false });

            if (error) throw error;

            return {
                success: true,
                data
            };

        } catch (error) {
            console.error('❌ Error getting user splits:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new BillSplitService();
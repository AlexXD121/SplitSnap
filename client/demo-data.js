// Demo Data Service - Curated Indian Receipts

class DemoDataService {
    constructor() {
        this.demoReceipts = [
            {
                id: 'demo_restaurant_001',
                type: 'restaurant',
                merchantInfo: {
                    name: 'Spice Garden Restaurant',
                    address: 'MG Road, Bangalore',
                    phone: '080-12345678'
                },
                items: [
                    { name: 'Butter Chicken', price: 320, quantity: 1 },
                    { name: 'Dal Makhani', price: 280, quantity: 1 },
                    { name: 'Garlic Naan', price: 80, quantity: 2 },
                    { name: 'Jeera Rice', price: 150, quantity: 1 },
                    { name: 'Gulab Jamun', price: 120, quantity: 1 },
                    { name: 'Lassi', price: 90, quantity: 2 }
                ],
                subtotal: 1120,
                tax: 89.60, // 8% GST
                serviceCharge: 56, // 5% service charge
                total: 1265.60,
                currency: 'INR',
                date: '2024-01-15',
                ocrMethod: 'Demo Mode',
                confidence: 1.0,
                rawText: 'SPICE GARDEN RESTAURANT\nMG Road, Bangalore\nPhone: 080-12345678\n\nButter Chicken    ₹320.00\nDal Makhani      ₹280.00\nGarlic Naan (2)  ₹160.00\nJeera Rice       ₹150.00\nGulab Jamun      ₹120.00\nLassi (2)        ₹180.00\n\nSubtotal         ₹1120.00\nGST (8%)         ₹89.60\nService Charge   ₹56.00\nTOTAL           ₹1265.60\n\nThank you for dining with us!'
            },
            {
                id: 'demo_grocery_001',
                type: 'grocery',
                merchantInfo: {
                    name: 'Fresh Mart Supermarket',
                    address: 'Sector 18, Noida',
                    phone: '0120-9876543'
                },
                items: [
                    { name: 'Basmati Rice 5kg', price: 450, quantity: 1 },
                    { name: 'Toor Dal 1kg', price: 120, quantity: 1 },
                    { name: 'Cooking Oil 1L', price: 180, quantity: 1 },
                    { name: 'Onions 2kg', price: 60, quantity: 1 },
                    { name: 'Tomatoes 1kg', price: 40, quantity: 1 },
                    { name: 'Milk 1L', price: 55, quantity: 2 },
                    { name: 'Bread', price: 25, quantity: 1 },
                    { name: 'Eggs (12 pcs)', price: 72, quantity: 1 }
                ],
                subtotal: 1057,
                tax: 52.85, // 5% GST on some items
                serviceCharge: 0,
                total: 1109.85,
                currency: 'INR',
                date: '2024-01-14',
                ocrMethod: 'Demo Mode',
                confidence: 1.0,
                rawText: 'FRESH MART SUPERMARKET\nSector 18, Noida\nPhone: 0120-9876543\n\nBasmati Rice 5kg  ₹450.00\nToor Dal 1kg      ₹120.00\nCooking Oil 1L    ₹180.00\nOnions 2kg        ₹60.00\nTomatoes 1kg      ₹40.00\nMilk 1L (2)       ₹110.00\nBread             ₹25.00\nEggs (12 pcs)     ₹72.00\n\nSubtotal          ₹1057.00\nGST (5%)          ₹52.85\nTOTAL            ₹1109.85\n\nSave more with Fresh Mart!'
            },
            {
                id: 'demo_transport_001',
                type: 'transport',
                merchantInfo: {
                    name: 'GSRTC Ahmedabad Depot',
                    address: 'ST Bus Stand, Ahmedabad',
                    phone: '079-12345678'
                },
                items: [
                    { name: 'Ahmedabad to Mumbai Express', price: 450, quantity: 1 }
                ],
                subtotal: 450,
                tax: 0,
                serviceCharge: 0,
                total: 450,
                currency: 'INR',
                date: '2024-01-13',
                ocrMethod: 'Demo Mode',
                confidence: 1.0,
                rawText: 'G.S.R.T.C.\nAHMEDABAD DEPOT\nPhone: 079-12345678\n\n** PASSENGER TICKET **\nAHMEDABAD - MUMBAI CENTRAL\nTOT DISTANCE 525 KMS\n\nFARE: ₹450.00\nTOTAL: ₹450.00\n\nHAPPY JOURNEY'
            }
        ];

        this.demoMode = false;
        this.currentDemoIndex = 0;
    }

    isDemoMode() {
        return this.demoMode;
    }

    toggleDemoMode() {
        this.demoMode = !this.demoMode;
        console.log(`Demo mode ${this.demoMode ? 'enabled' : 'disabled'}`);
        
        // Show notification
        const message = this.demoMode ? 
            '🎭 Demo mode enabled - Perfect receipts ready!' : 
            '📷 Demo mode disabled - Live OCR active';
        
        this.showNotification(message);
        
        return this.demoMode;
    }

    enableDemoMode() {
        this.demoMode = true;
        this.showNotification('🎭 Demo mode enabled');
    }

    disableDemoMode() {
        this.demoMode = false;
        this.showNotification('📷 Demo mode disabled');
    }

    getDemoReceipt(type = null) {
        if (!this.demoMode) {
            return null;
        }

        if (type) {
            const receipt = this.demoReceipts.find(r => r.type === type);
            return receipt ? { ...receipt } : null;
        }

        // Cycle through demo receipts
        const receipt = this.demoReceipts[this.currentDemoIndex];
        this.currentDemoIndex = (this.currentDemoIndex + 1) % this.demoReceipts.length;
        
        return { ...receipt };
    }

    getRandomDemoReceipt() {
        if (!this.demoMode) {
            return null;
        }

        const randomIndex = Math.floor(Math.random() * this.demoReceipts.length);
        return { ...this.demoReceipts[randomIndex] };
    }

    getAllDemoReceipts() {
        return this.demoReceipts.map(receipt => ({ ...receipt }));
    }

    shouldUseDemoMode(ocrConfidence = 0) {
        // Auto-enable demo mode if OCR confidence is too low
        if (ocrConfidence < 0.6 && !this.demoMode) {
            console.log('🚨 Low OCR confidence detected, auto-enabling demo mode');
            this.enableDemoMode();
            return true;
        }
        
        return this.demoMode;
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'info' ? '#2196F3' : type === 'success' ? '#4CAF50' : '#F44336'};
            color: white;
            padding: 12px 20px;
            border-radius: 25px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1002;
            animation: slideDown 0.3s ease-out;
            font-weight: 500;
            font-size: 14px;
        `;
        notification.textContent = message;

        // Add slide down animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideDown {
                from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
                to { transform: translateX(-50%) translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
            style.remove();
        }, 3000);
    }
}

// Initialize demo service
window.demoService = new DemoDataService();

// Add keyboard shortcut for demo mode toggle
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        window.demoService.toggleDemoMode();
    }
});
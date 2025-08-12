-- SplitSnap Final Database Schema
-- Production-ready schema with proper constraints and security

-- Drop existing tables if they exist (use carefully in production)
DROP TABLE IF EXISTS public.spending_insights CASCADE;
DROP TABLE IF EXISTS public.receipt_shares CASCADE;
DROP TABLE IF EXISTS public.currency_rates CASCADE;
DROP TABLE IF EXISTS public.budgets CASCADE;
DROP TABLE IF EXISTS public.split_participants CASCADE;
DROP TABLE IF EXISTS public.bill_splits CASCADE;
DROP TABLE IF EXISTS public.receipts CASCADE;
DROP TABLE IF EXISTS public.expense_categories CASCADE;

-- Create a temporary users table for development (remove when using Supabase Auth)
CREATE TABLE IF NOT EXISTS public.temp_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default user for development
INSERT INTO public.temp_users (id, email, name) VALUES 
('00000000-0000-0000-0000-000000000000', 'dev@splitsnap.com', 'Development User')
ON CONFLICT (id) DO NOTHING;

-- 1. Expense Categories Table
CREATE TABLE public.expense_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#3B82F6',
    icon VARCHAR(50) DEFAULT 'receipt',
    keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Receipts Table (Modified to use temp_users for development)
CREATE TABLE public.receipts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.temp_users(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000000',
    merchant_name TEXT NOT NULL,
    merchant_address TEXT,
    merchant_phone TEXT,
    items JSONB DEFAULT '[]'::jsonb CHECK (jsonb_typeof(items) = 'array'),
    subtotal NUMERIC(12,2) CHECK (subtotal >= 0) DEFAULT 0,
    tax_amount NUMERIC(12,2) CHECK (tax_amount >= 0) DEFAULT 0,
    service_charge NUMERIC(12,2) CHECK (service_charge >= 0) DEFAULT 0,
    total_amount NUMERIC(12,2) CHECK (total_amount >= 0) DEFAULT 0,
    raw_ocr_text TEXT,
    ocr_method TEXT CHECK (ocr_method IN ('manual', 'ai', 'mobile_app', 'desktop_scan')) DEFAULT 'ai',
    confidence_score NUMERIC(3,2) CHECK (confidence_score BETWEEN 0 AND 1) DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_total_amount CHECK (total_amount = (subtotal + tax_amount + service_charge))
);

-- 3. Bill Splits Table
CREATE TABLE public.bill_splits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    receipt_id UUID REFERENCES public.receipts(id) ON DELETE CASCADE,
    split_name VARCHAR(100) NOT NULL,
    split_method VARCHAR(20) NOT NULL,
    total_people INTEGER NOT NULL DEFAULT 1,
    split_data JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES public.temp_users(id) DEFAULT '00000000-0000-0000-0000-000000000000',
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Split Participants Table
CREATE TABLE public.split_participants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    split_id UUID REFERENCES public.bill_splits(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    amount_owed NUMERIC(12,2) DEFAULT 0,
    amount_paid NUMERIC(12,2) DEFAULT 0,
    items_assigned JSONB DEFAULT '[]'::jsonb,
    payment_status VARCHAR(20) DEFAULT 'pending',
    payment_method VARCHAR(50),
    payment_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Budget Tracking Table
CREATE TABLE public.budgets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.temp_users(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000000',
    name VARCHAR(100) NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    period VARCHAR(20) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    current_spent NUMERIC(12,2) DEFAULT 0,
    alert_threshold NUMERIC(3,2) DEFAULT 0.8,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Currency Exchange Rates Table
CREATE TABLE public.currency_rates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    from_currency VARCHAR(3) NOT NULL,
    to_currency VARCHAR(3) NOT NULL,
    rate NUMERIC(10,6) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    source VARCHAR(50) DEFAULT 'manual',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(from_currency, to_currency, date)
);

-- 7. Receipt Sharing/Notifications Table
CREATE TABLE public.receipt_shares (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    receipt_id UUID REFERENCES public.receipts(id) ON DELETE CASCADE,
    split_id UUID REFERENCES public.bill_splits(id) ON DELETE CASCADE,
    share_method VARCHAR(20) NOT NULL,
    recipient_info JSONB NOT NULL,
    message TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Analytics/Insights Table
CREATE TABLE public.spending_insights (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.temp_users(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000000',
    insight_type VARCHAR(50) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Performance Indexes
CREATE INDEX idx_receipts_user_id ON public.receipts(user_id);
CREATE INDEX idx_receipts_created_at ON public.receipts(created_at DESC);
CREATE INDEX idx_receipts_merchant_name ON public.receipts(merchant_name);
CREATE INDEX idx_receipts_total_amount ON public.receipts(total_amount);
CREATE INDEX idx_receipts_merchant_name_search ON public.receipts USING gin(to_tsvector('english', merchant_name));
CREATE INDEX idx_bill_splits_receipt_id ON public.bill_splits(receipt_id);
CREATE INDEX idx_split_participants_split_id ON public.split_participants(split_id);
CREATE INDEX idx_budgets_category_id ON public.budgets(category_id);
CREATE INDEX idx_currency_rates_date ON public.currency_rates(date DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.split_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currency_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spending_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temp_users ENABLE ROW LEVEL SECURITY;

-- Permissive Policies for Development (replace with proper RLS in production)
CREATE POLICY "Allow all operations" ON public.receipts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON public.bill_splits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON public.split_participants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON public.expense_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON public.budgets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON public.currency_rates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON public.receipt_shares FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON public.spending_insights FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON public.temp_users FOR ALL USING (true) WITH CHECK (true);

-- Grant Permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

-- Update Timestamp Trigger Function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update Timestamp Triggers
CREATE TRIGGER update_receipts_updated_at 
    BEFORE UPDATE ON public.receipts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bill_splits_updated_at 
    BEFORE UPDATE ON public.bill_splits 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert Default Expense Categories
INSERT INTO public.expense_categories (name, description, color, icon, keywords) VALUES
('Food & Dining', 'Restaurants, cafes, food delivery', '#EF4444', 'utensils', ARRAY['restaurant', 'cafe', 'food', 'dining', 'meal', 'lunch', 'dinner', 'breakfast']),
('Transportation', 'Bus, train, taxi, fuel', '#3B82F6', 'car', ARRAY['bus', 'train', 'taxi', 'uber', 'ola', 'fuel', 'petrol', 'diesel', 'transport']),
('Shopping', 'Retail, groceries, clothing', '#10B981', 'shopping-bag', ARRAY['mall', 'store', 'shop', 'grocery', 'supermarket', 'clothing', 'retail']),
('Entertainment', 'Movies, games, events', '#8B5CF6', 'film', ARRAY['movie', 'cinema', 'game', 'entertainment', 'event', 'concert', 'show']),
('Healthcare', 'Medical, pharmacy, hospital', '#F59E0B', 'heart', ARRAY['hospital', 'clinic', 'pharmacy', 'medical', 'doctor', 'medicine', 'health']),
('Utilities', 'Bills, internet, phone', '#6B7280', 'zap', ARRAY['electricity', 'water', 'gas', 'internet', 'phone', 'utility', 'bill']),
('Education', 'Books, courses, fees', '#EC4899', 'book', ARRAY['school', 'college', 'university', 'book', 'course', 'education', 'fee']),
('Other', 'Miscellaneous expenses', '#64748B', 'more-horizontal', ARRAY[]::TEXT[])
ON CONFLICT (name) DO NOTHING;

-- Insert Sample Currency Rates
INSERT INTO public.currency_rates (from_currency, to_currency, rate) VALUES
('INR', 'USD', 0.012),
('USD', 'INR', 83.25),
('INR', 'EUR', 0.011),
('EUR', 'INR', 90.15),
('INR', 'GBP', 0.0095),
('GBP', 'INR', 105.30)
ON CONFLICT (from_currency, to_currency, date) DO NOTHING;

-- Helper function for inserting receipts with validation
CREATE OR REPLACE FUNCTION insert_receipt(
    p_user_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
    p_merchant_name TEXT DEFAULT 'Unknown Merchant',
    p_items JSONB DEFAULT '[]'::jsonb,
    p_subtotal NUMERIC DEFAULT 0,
    p_tax_amount NUMERIC DEFAULT 0,
    p_service_charge NUMERIC DEFAULT 0,
    p_total_amount NUMERIC DEFAULT 0,
    p_ocr_method TEXT DEFAULT 'ai',
    p_confidence_score NUMERIC DEFAULT 1.0,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_receipt_id UUID;
BEGIN
    -- Validate input
    IF p_total_amount != (p_subtotal + p_tax_amount + p_service_charge) THEN
        RAISE EXCEPTION 'Total amount does not match calculation: % != % + % + %', 
            p_total_amount, p_subtotal, p_tax_amount, p_service_charge;
    END IF;

    INSERT INTO public.receipts (
        user_id, merchant_name, items, subtotal, tax_amount, 
        service_charge, total_amount, ocr_method, confidence_score, metadata
    ) VALUES (
        p_user_id, p_merchant_name, p_items, p_subtotal, p_tax_amount,
        p_service_charge, p_total_amount, p_ocr_method, p_confidence_score, p_metadata
    )
    RETURNING id INTO v_receipt_id;

    RETURN v_receipt_id;
END;
$$;
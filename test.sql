-- Create enum type for currency units
CREATE TYPE currency_unit AS ENUM ('دلار', 'ریال', 'تومان');

-- Create invoices table
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    description TEXT NOT NULL,
    issued_by INTEGER NOT NULL,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount >= 0),
    units currency_unit NOT NULL,
    invoice_photo_path VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraint
    CONSTRAINT fk_issued_by
        FOREIGN KEY (issued_by)
        REFERENCES users(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

-- Optional: Create index for faster queries by issuer
CREATE INDEX idx_invoices_issued_by ON invoices(issued_by);

-- Optional: Create index for faster queries by creation date
CREATE INDEX idx_invoices_created_at ON invoices(created_at DESC);

-- Optional: Add trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
-- Enable the pgcrypto extension to generate UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create the employees table
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    department VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- The token will be a unique UUID for generating the QR code
    qr_token UUID UNIQUE DEFAULT gen_random_uuid()
);

-- Populate the database with some mock data
INSERT INTO employees (name, email, department) VALUES
('Alice Johnson', 'alice.j@example.com', 'Engineering'),
('Bob Smith', 'bob.s@example.com', 'Marketing'),
('Charlie Brown', 'charlie.b@example.com', 'Sales'),
('Diana Prince', 'diana.p@example.com', 'Human Resources');

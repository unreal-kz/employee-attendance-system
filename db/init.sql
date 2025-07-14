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

-- Create the attendance table
CREATE TABLE attendance (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    check_in_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    check_out_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('checked-in', 'checked-out')),
    notes TEXT
);

-- Indexes for performance
CREATE INDEX idx_attendance_employee_id ON attendance(employee_id);
CREATE INDEX idx_attendance_check_in_time ON attendance(check_in_time);


-- Populate the database with some mock data
INSERT INTO employees (name, email, department) VALUES
('Alice Johnson', 'alice.j@example.com', 'Engineering'),
('Bob Smith', 'bob.s@example.com', 'Marketing'),
('Charlie Brown', 'charlie.b@example.com', 'Sales'),
('Diana Prince', 'diana.p@example.com', 'Human Resources');

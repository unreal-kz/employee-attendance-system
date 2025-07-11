-- Employees table
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(128) NOT NULL,
    face_embedding BYTEA,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Attendance table
CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(64) REFERENCES employees(employee_id),
    checkin_time TIMESTAMP,
    checkout_time TIMESTAMP,
    verified BOOLEAN DEFAULT FALSE,
    method VARCHAR(32),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Logs table
CREATE TABLE IF NOT EXISTS logs (
    id SERIAL PRIMARY KEY,
    request JSONB,
    response JSONB,
    image_hash VARCHAR(128),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
); 
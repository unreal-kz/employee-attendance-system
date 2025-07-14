const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { body, param, validationResult } = require('express-validator');
const QRCode = require('qrcode');
const path = require('path');
const db = require('./db');

const app = express();
const port = process.env.PORT || 3000;

// Basic security headers without HSTS for HTTP development
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data:");
  next();
});

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, 'frontend')));

// Serve frontend app for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/index.html'));
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', error: 'Database connection failed' });
  }
});

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// QR code generation endpoint with token validation
app.get('/qr', async (req, res) => {
  try {
    const token = req.query.token;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Validate token format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token)) {
      return res.status(400).json({ error: 'Invalid token format' });
    }

    // Verify token exists in database
    const { rows } = await db.query('SELECT id, name FROM employees WHERE qr_token = $1 AND status = $2', [token, 'active']);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Invalid or inactive token' });
    }

    const employee = rows[0];

    // Generate QR code on server-side
    try {
      const qrCodeDataURL = await QRCode.toDataURL(token, {
        width: 256,
        errorCorrectionLevel: 'H',
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
          <title>Employee QR Code - ${employee.name}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                display: flex; 
                justify-content: center; 
                align-items: center; 
                height: 100vh; 
                margin: 0; 
                flex-direction: column; 
                background-color: #f5f5f5;
                padding: 20px;
                box-sizing: border-box;
              }
              .container {
                background: white;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                text-align: center;
                max-width: 400px;
                width: 100%;
              }
              h2 { 
                margin-bottom: 10px; 
                color: #333;
                font-size: 24px;
              }
              .employee-name {
                color: #666;
                margin-bottom: 20px;
                font-size: 16px;
              }
                .qr-code {
                margin: 20px 0;
              }
                .qr-code img {
                  border: 2px solid #eee;
                  border-radius: 8px;
                  padding: 10px;
                  background: white;
                }
              .footer {
                margin-top: 20px;
                font-size: 12px;
                color: #999;
              }
                .token-info {
                  margin-top: 15px;
                  font-size: 10px;
                  color: #ccc;
                  word-break: break-all;
                }
          </style>
      </head>
      <body>
          <div class="container">
              <h2>Attendance QR Code</h2>
              <div class="employee-name">${employee.name}</div>
                <div class="qr-code">
                    <img src="${qrCodeDataURL}" alt="QR Code for ${employee.name}" />
                </div>
              <div class="footer">Scan this code for attendance</div>
                <div class="token-info">Token: ${token}</div>
          </div>
        </body>
        </html>
      `);
    } catch (qrError) {
      console.error('Server-side QR generation error:', qrError);
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>QR Code Error</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { 
                  font-family: Arial, sans-serif; 
                  display: flex; 
                  justify-content: center; 
                  align-items: center; 
                  height: 100vh; 
                  margin: 0; 
                  background-color: #f5f5f5;
                }
                .error-container {
                  background: white;
                  padding: 30px;
                  border-radius: 10px;
                  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                  text-align: center;
                  max-width: 400px;
                }
            </style>
        </head>
        <body>
            <div class="error-container">
                <h2 style="color: red;">QR Code Generation Error</h2>
                <p>Unable to generate QR code for ${employee.name}</p>
                <p style="font-size: 12px; color: #666;">Error: ${qrError.message}</p>
            </div>
      </body>
      </html>
    `);
    }
  } catch (err) {
    console.error('QR generation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Employee management routes with validation

// Get all employees with pagination
app.get('/employees', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const countResult = await db.query('SELECT COUNT(*) FROM employees');
        const total = parseInt(countResult.rows[0].count);

        const { rows } = await db.query(
            'SELECT id, name, email, department, status, created_at FROM employees ORDER BY created_at DESC LIMIT $1 OFFSET $2',
            [limit, offset]
        );

        res.json({
            employees: rows,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('Get employees error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get a single employee
app.get('/employees/:id', 
    param('id').isInt().withMessage('Employee ID must be a valid integer'),
    handleValidationErrors,
    async (req, res) => {
        try {
            const { id } = req.params;
            const { rows } = await db.query('SELECT id, name, email, department, status, created_at FROM employees WHERE id = $1', [id]);
            if (rows.length === 0) {
                return res.status(404).json({ error: 'Employee not found' });
            }
            res.json(rows[0]);
        } catch (err) {
            console.error('Get employee error:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

// Create a new employee
app.post('/employees', [
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('department').optional().trim().isLength({ max: 100 }).withMessage('Department must be less than 100 characters'),
], handleValidationErrors, async (req, res) => {
    try {
        const { name, email, department } = req.body;
        
        const { rows } = await db.query(
            'INSERT INTO employees (name, email, department) VALUES ($1, $2, $3) RETURNING id, name, email, department, status, created_at',
            [name, email, department || null]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('Create employee error:', err);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'An employee with this email already exists' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update an employee
app.put('/employees/:id', [
    param('id').isInt().withMessage('Employee ID must be a valid integer'),
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('department').optional().trim().isLength({ max: 100 }).withMessage('Department must be less than 100 characters'),
    body('status').optional().isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
], handleValidationErrors, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, department, status } = req.body;
        
        const { rows } = await db.query(
            'UPDATE employees SET name = $1, email = $2, department = $3, status = $4 WHERE id = $5 RETURNING id, name, email, department, status, created_at',
            [name, email, department || null, status || 'active', id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        res.json(rows[0]);
    } catch (err) {
        console.error('Update employee error:', err);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'An employee with this email already exists' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete an employee (soft delete by setting status to inactive)
app.delete('/employees/:id', 
    param('id').isInt().withMessage('Employee ID must be a valid integer'),
    handleValidationErrors,
    async (req, res) => {
        try {
            const { id } = req.params;
            const { rows } = await db.query(
                'UPDATE employees SET status = $1 WHERE id = $2 RETURNING id',
                ['inactive', id]
            );
            
            if (rows.length === 0) {
                return res.status(404).json({ error: 'Employee not found' });
            }

            res.status(204).send();
        } catch (err) {
            console.error('Delete employee error:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

// Get QR token for employee (admin endpoint)
app.get('/employees/:id/qr-token', 
    param('id').isInt().withMessage('Employee ID must be a valid integer'),
    handleValidationErrors,
    async (req, res) => {
        try {
            const { id } = req.params;
            const { rows } = await db.query('SELECT qr_token FROM employees WHERE id = $1 AND status = $2', [id, 'active']);
            if (rows.length === 0) {
                return res.status(404).json({ error: 'Employee not found or inactive' });
            }
            res.json({ qr_token: rows[0].qr_token });
        } catch (err) {
            console.error('Get QR token error:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

// --- Attendance Routes ---

// Check-in an employee
app.post('/attendance/check-in', [
    body('token').isUUID().withMessage('A valid QR token is required'),
], handleValidationErrors, async (req, res) => {
    try {
        const { token } = req.body;

        // 1. Find the employee by QR token
        const employeeResult = await db.query('SELECT id FROM employees WHERE qr_token = $1 AND status = $2', [token, 'active']);
        if (employeeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Employee not found or is inactive' });
        }
        const employeeId = employeeResult.rows[0].id;

        // 2. Check if the employee is already checked in
        const lastAttendance = await db.query(
            'SELECT status FROM attendance WHERE employee_id = $1 ORDER BY check_in_time DESC LIMIT 1',
            [employeeId]
        );

        if (lastAttendance.rows.length > 0 && lastAttendance.rows[0].status === 'checked-in') {
            return res.status(409).json({ error: 'Employee is already checked in' });
        }

        // 3. Create a new check-in record
        const { rows } = await db.query(
            'INSERT INTO attendance (employee_id, status) VALUES ($1, $2) RETURNING *',
            [employeeId, 'checked-in']
        );

        res.status(201).json({ message: 'Check-in successful', attendance: rows[0] });

    } catch (err) {
        console.error('Check-in error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Check-out an employee
app.post('/attendance/check-out', [
    body('token').isUUID().withMessage('A valid QR token is required'),
    body('notes').optional().isString().trim(),
], handleValidationErrors, async (req, res) => {
    try {
        const { token, notes } = req.body;

        // 1. Find the employee by QR token
        const employeeResult = await db.query('SELECT id FROM employees WHERE qr_token = $1 AND status = $2', [token, 'active']);
        if (employeeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Employee not found or is inactive' });
        }
        const employeeId = employeeResult.rows[0].id;

        // 2. Find the last open check-in record for this employee
        const lastAttendanceResult = await db.query(
            'SELECT id, status FROM attendance WHERE employee_id = $1 AND status = $2 ORDER BY check_in_time DESC LIMIT 1',
            [employeeId, 'checked-in']
        );

        if (lastAttendanceResult.rows.length === 0) {
            return res.status(404).json({ error: 'No active check-in found for this employee' });
        }
        const attendanceId = lastAttendanceResult.rows[0].id;

        // 3. Update the record to check-out
        const { rows } = await db.query(
            'UPDATE attendance SET check_out_time = CURRENT_TIMESTAMP, status = $1, notes = $2 WHERE id = $3 RETURNING *',
            ['checked-out', notes || null, attendanceId]
        );

        res.status(200).json({ message: 'Check-out successful', attendance: rows[0] });

    } catch (err) {
        console.error('Check-out error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get attendance history for a specific employee
app.get('/employees/:id/attendance', [
    param('id').isInt().withMessage('Employee ID must be a valid integer'),
], handleValidationErrors, async (req, res) => {
    try {
        const { id } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 25;
        const offset = (page - 1) * limit;

        const countResult = await db.query('SELECT COUNT(*) FROM attendance WHERE employee_id = $1', [id]);
        const total = parseInt(countResult.rows[0].count);

        const { rows } = await db.query(
            'SELECT * FROM attendance WHERE employee_id = $1 ORDER BY check_in_time DESC LIMIT $2 OFFSET $3',
            [id, limit, offset]
        );
        
        res.json({
            attendance: rows,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('Get employee attendance error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all attendance records (admin view)
app.get('/attendance', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 25;
        const offset = (page - 1) * limit;

        const countResult = await db.query('SELECT COUNT(*) FROM attendance');
        const total = parseInt(countResult.rows[0].count);

        const { rows } = await db.query(
            `SELECT 
                a.id, a.employee_id, e.name as employee_name, e.email as employee_email, 
                a.check_in_time, a.check_out_time, a.status, a.notes
             FROM attendance a
             JOIN employees e ON a.employee_id = e.id
             ORDER BY a.check_in_time DESC 
             LIMIT $1 OFFSET $2`,
            [limit, offset]
        );
        
        res.json({
            attendance: rows,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('Get all attendance error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(port, '0.0.0.0', () => {
    console.log(`QR code service listening at http://0.0.0.0:${port}`);
    console.log(`External access: http://185.32.84.81:${port}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('Shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
}); 
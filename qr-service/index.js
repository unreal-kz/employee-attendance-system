const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { body, param, query, validationResult } = require('express-validator');
const QRCode = require('qrcode');
const path = require('path');
const db = require('./db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 3000;

// --- API Router ---
const apiRouter = express.Router();

// --- JWT Configuration ---
const JWT_SECRET = process.env.JWT_SECRET || 'your-default-super-secret-key-that-is-long';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

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

// --- API Routes ---
// All API routes are prefixed with /api
app.use('/api', apiRouter);

// Serve frontend app for root route and other client-side routes
app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/index.html'));
});

// --- Middleware Definitions ---

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (token == null) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Authorization middleware - checks for role
const authorizeRole = (role) => {
  return (req, res, next) => {
    if (req.user && req.user.role === role) {
      next();
    } else {
      res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }
  };
};


// --- API Route Definitions ---

// Health check endpoint
apiRouter.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', error: 'Database connection failed' });
  }
});

// --- Authentication Routes ---
// Login is public
apiRouter.post('/login',
  [
    body('username').notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  handleValidationErrors,
  async (req, res) => {
    const { username, password } = req.body;

    try {
      // Find user by username
      const userResult = await db.query(
        `SELECT u.id, u.username, u.password_hash, r.name as role 
         FROM users u 
         JOIN roles r ON u.role_id = r.id 
         WHERE u.username = $1 AND u.is_active = TRUE`,
        [username]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = userResult.rows[0];

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate JWT
      const token = jwt.sign(
        { userId: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      });

    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Employee management routes with validation
// All subsequent routes are protected
apiRouter.get('/employees', authenticateToken, authorizeRole('admin'), async (req, res) => {
    try {
        // Example of using authenticated user info
        console.log('Authenticated user accessing employees:', req.user);
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
apiRouter.get('/employees/:id', authenticateToken, authorizeRole('admin'), 
    [
        param('id').isInt({ min: 1 }).withMessage('Employee ID must be a positive integer')
    ],
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
apiRouter.post('/employees', authenticateToken, authorizeRole('admin'),
    [
        body('name').trim().notEmpty().withMessage('Name is required'),
        body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
        body('department').optional().trim().isLength({ max: 100 }).withMessage('Department must be less than 100 characters'),
    ],
    handleValidationErrors,
    async (req, res) => {
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
    }
);

// Update an employee
apiRouter.put('/employees/:id', authenticateToken, authorizeRole('admin'),
    [
        param('id').isInt({ min: 1 }).withMessage('Employee ID must be a positive integer'),
        body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
        body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
        body('department').optional().trim().isLength({ max: 100 }).withMessage('Department must be less than 100 characters'),
        body('status').optional().isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
    ],
    handleValidationErrors,
    async (req, res) => {
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
    }
);

// Delete an employee (soft delete by setting status to inactive)
apiRouter.delete('/employees/:id', authenticateToken, authorizeRole('admin'), 
    [
        param('id').isInt({ min: 1 }).withMessage('Employee ID must be a positive integer')
    ],
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

// Get employee details from a QR token
apiRouter.get('/qr-scan/:token', authenticateToken, 
    [
        param('token').isUUID().withMessage('A valid QR token is required.')
    ],
    handleValidationErrors,
    async (req, res) => {
        try {
            const { token } = req.params;
            const { rows } = await db.query(
                'SELECT id, name, email, department, status FROM employees WHERE qr_token = $1 AND status = $2',
                [token, 'active']
            );
            if (rows.length === 0) {
                return res.status(404).json({ error: 'Employee not found or is inactive' });
            }
            res.json(rows[0]);
        } catch (err) {
            console.error('QR scan error:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

// Get QR token for an employee
apiRouter.get('/employees/:id/qr-token', authenticateToken, authorizeRole('admin'), 
    [
        param('id').isInt({ min: 1 }).withMessage('Employee ID must be a positive integer')
    ],
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
apiRouter.post('/attendance/check-in', authenticateToken, authorizeRole('admin'), 
    [
        body('employee_id').isInt({ min: 1 }).withMessage('A valid employee ID is required.')
    ],
    handleValidationErrors,
    async (req, res) => {
        try {
            const { employee_id } = req.body;

            // 1. Find the employee by QR token
            const employeeResult = await db.query('SELECT id FROM employees WHERE id = $1 AND status = $2', [employee_id, 'active']);
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
    }
);

// Check-out an employee
apiRouter.post('/attendance/check-out', authenticateToken, authorizeRole('admin'), 
    [
        body('employee_id').isInt({ min: 1 }).withMessage('A valid employee ID is required.')
    ],
    handleValidationErrors,
    async (req, res) => {
        try {
            const { employee_id } = req.body;

            // 1. Find the employee by QR token
            const employeeResult = await db.query('SELECT id FROM employees WHERE id = $1 AND status = $2', [employee_id, 'active']);
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
                ['checked-out', null, attendanceId] // Assuming notes is optional, pass null if not provided
            );

            res.status(200).json({ message: 'Check-out successful', attendance: rows[0] });

        } catch (err) {
            console.error('Check-out error:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

// Get attendance history for a specific employee
apiRouter.get('/employees/:id/attendance', authenticateToken, authorizeRole('admin'), 
    [
        param('id').isInt({ min: 1 }).withMessage('Employee ID must be a positive integer')
    ],
    handleValidationErrors,
    async (req, res) => {
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
    }
);

// Get all attendance records (for dashboard)
apiRouter.get('/attendance', authenticateToken, authorizeRole('admin'), async (req, res) => {
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

// QR Code generation endpoint - this was missing!
apiRouter.get('/qr', [
    query('token').isUUID().withMessage('A valid QR token is required.')
], handleValidationErrors, async (req, res) => {
    try {
        const { token } = req.query;
        
        // Verify the token exists in the database
        const { rows } = await db.query(
            'SELECT id, name, email, department FROM employees WHERE qr_token = $1 AND status = $2',
            [token, 'active']
        );
        
        if (rows.length === 0) {
            return res.status(404).send(`
                <html>
                    <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                        <h2>❌ QR Code Not Found</h2>
                        <p>This QR code is invalid or the employee is inactive.</p>
                    </body>
                </html>
            `);
        }
        
        const employee = rows[0];
        
        // Generate QR code containing the token
        const qrDataUrl = await QRCode.toDataURL(token, {
            width: 200,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });
        
        // Return HTML page with QR code
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>QR Code - ${employee.name}</title>
                <meta charset="utf-8">
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        text-align: center;
                        padding: 20px;
                        background: #f8fafc;
                    }
                    .qr-container {
                        background: white;
                        border-radius: 12px;
                        padding: 30px;
                        max-width: 400px;
                        margin: 0 auto;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                    .employee-info {
                        margin-bottom: 20px;
                        color: #2d3748;
                    }
                    .qr-code {
                        margin: 20px 0;
                    }
                    .instructions {
                        color: #718096;
                        font-size: 14px;
                        margin-top: 20px;
                    }
                </style>
            </head>
            <body>
                <div class="qr-container">
                    <div class="employee-info">
                        <h2>${employee.name}</h2>
                        <p><strong>Department:</strong> ${employee.department}</p>
                        <p><strong>Email:</strong> ${employee.email}</p>
                    </div>
                    <div class="qr-code">
                        <img src="${qrDataUrl}" alt="QR Code for ${employee.name}" />
                    </div>
                    <div class="instructions">
                        <p>📱 Scan this QR code with the mobile app to track attendance</p>
                    </div>
                </div>
            </body>
            </html>
        `);
        
    } catch (err) {
        console.error('QR generation error:', err);
        res.status(500).send(`
            <html>
                <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                    <h2>❌ Error</h2>
                    <p>Failed to generate QR code. Please try again.</p>
                </body>
            </html>
        `);
    }
});

// Catch-all for API routes not found
apiRouter.use((req, res, next) => {
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
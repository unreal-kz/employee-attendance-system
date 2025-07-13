const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { body, param, validationResult } = require('express-validator');
const db = require('./db');

const app = express();
const port = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
    },
  },
}));

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
              #qrcode {
                margin: 20px 0;
              }
              .footer {
                margin-top: 20px;
                font-size: 12px;
                color: #999;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <h2>Attendance QR Code</h2>
              <div class="employee-name">${employee.name}</div>
              <canvas id="qrcode"></canvas>
              <div class="footer">Scan this code for attendance</div>
          </div>
          <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
          <script>
              const token = "${token}";
              if (token) {
                  QRCode.toCanvas(document.getElementById('qrcode'), token, { 
                    width: 256, 
                    errorCorrectionLevel: 'H',
                    color: {
                      dark: '#000000',
                      light: '#FFFFFF'
                    }
                  }, function (error) {
                      if (error) {
                        console.error(error);
                        document.getElementById('qrcode').innerHTML = '<p>Error generating QR code</p>';
                      }
                  });
              }
          </script>
      </body>
      </html>
    `);
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

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(port, () => {
    console.log(`QR code service listening at http://localhost:${port}`);
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
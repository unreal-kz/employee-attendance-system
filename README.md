# Employee Attendance System

A production-ready employee attendance system with QR code generation and management.

## Features

- ✅ **QR Code Generation**: Secure UUID-based QR codes for each employee
- ✅ **Employee Management**: Full CRUD operations with validation
- ✅ **Security**: Rate limiting, input validation, CORS, security headers
- ✅ **Database**: PostgreSQL with connection pooling
- ✅ **Containerized**: Docker & Docker Compose ready
- ✅ **Health Checks**: Built-in health monitoring
- ✅ **Pagination**: Efficient data retrieval
- ✅ **Soft Deletes**: Data preservation with status management

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Git

### 1. Clone and Setup
```bash
git clone <your-repo-url>
cd employee-attendance-system

# Create environment file
cp .env.example .env
# Edit .env with your preferred settings
```

### 2. Deploy
```bash
docker-compose up --build -d
```

### 3. Verify
```bash
# Check health
curl http://localhost:3000/health

# List employees
curl http://localhost:3000/employees
```

## API Endpoints

### Employee Management
- `GET /employees` - List employees (with pagination)
- `GET /employees/:id` - Get specific employee
- `POST /employees` - Create new employee
- `PUT /employees/:id` - Update employee
- `DELETE /employees/:id` - Soft delete employee
- `GET /employees/:id/qr-token` - Get employee's QR token

### QR Code Generation
- `GET /qr?token=<uuid>` - Generate QR code page

### System
- `GET /health` - Health check

## Environment Variables

```bash
# Application
PORT=3000
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

# Database
DB_HOST=db
DB_PORT=5432
POSTGRES_USER=attendance_user
POSTGRES_PASSWORD=secure_password_123
POSTGRES_DB=employee_attendance_db
```

## API Examples

### Create Employee
```bash
curl -X POST http://localhost:3000/employees \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "department": "Engineering"
  }'
```

### Get QR Token
```bash
curl http://localhost:3000/employees/1/qr-token
```

### Generate QR Code
```bash
curl "http://localhost:3000/qr?token=<uuid-from-above>"
```

## Security Features

- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Input Validation**: Comprehensive validation using express-validator
- **Security Headers**: Helmet.js for security headers
- **CORS Protection**: Configurable CORS settings
- **SQL Injection Protection**: Parameterized queries
- **XSS Protection**: Content Security Policy

## Production Deployment

### Cloud Server Setup
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Clone project
git clone <your-repo>
cd employee-attendance-system

# Setup environment
cp .env.example .env
# Edit .env with production values

# Deploy
docker-compose up --build -d
```

### Nginx Reverse Proxy (Optional)
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Monitoring

### Health Check
```bash
curl http://localhost:3000/health
```

### Logs
```bash
docker-compose logs -f
```

### Database Backup
```bash
docker-compose exec db pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup.sql
```

## Development

### Local Development
```bash
cd qr-service
npm install
npm run dev
```

### Database Migration
The database is automatically initialized with `db/init.sql` on first run.

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check if PostgreSQL container is running
   - Verify environment variables
   - Check network connectivity

2. **Port Already in Use**
   - Change PORT in .env file
   - Check for conflicting services

3. **Permission Denied**
   - Ensure Docker daemon is running
   - Check user permissions for Docker

### Reset Database
```bash
docker-compose down -v
docker-compose up --build -d
```

## License

MIT License 
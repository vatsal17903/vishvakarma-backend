# Backend Server

## Quick Start

```bash
# Install dependencies (first time only)
npm install

# Start development server
npm run dev

# Start production server
npm start
```

## Server Information

- **Port:** 3006
- **API Endpoint:** http://localhost:3006/api
- **Environment:** Configure in `.env` file

## Environment Variables

Make sure your `.env` file is configured:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=vishvakara
PORT=3006
SESSION_SECRET=your-secret-key-here
```

## Expected Output

When the server starts successfully, you should see:

```
✅ MySQL Database initialized successfully
🚀 Server running on http://localhost:3006
📁 API available at http://localhost:3006/api
```

## Troubleshooting

- **Database connection error:** Check your MySQL credentials in `.env`
- **Port already in use:** Change `PORT` in `.env` to another port
- **Missing dependencies:** Run `npm install`

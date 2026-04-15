# TimeTrack Pro - Deployment Guide

This application is built with a React frontend and an Express backend. It supports both SQLite (default) and PostgreSQL.

## Server Information
- **IP Address**: 62.171.158.235
- **Target Port**: 8502

## Deployment Options

### Option 1: Docker Compose (Recommended)
This is the easiest way to deploy the app along with a PostgreSQL database on your Contabo server.

1. **Clone the repository** to your server.
2. **Install Docker and Docker Compose** if not already installed.
3. **Run the following command**:
   ```bash
   docker-compose up -d
   ```

### Option 2: Manual Node.js Deployment
1. **Install Node.js 20+**.
2. **Install dependencies**: `npm install`
3. **Build the app**: `npm run build`
4. **Start the server**: `npm start`
   - To use Postgres, set the `DATABASE_URL` environment variable:
     `DATABASE_URL=postgres://user:password@localhost:5432/dbname npm start`

## Python Alternative
If you strictly require a Python implementation, I have included a `main.py` file that uses Streamlit. You can run it using:
```bash
pip install streamlit psycopg2-binary pandas
streamlit run main.py --server.port 8502
```

## Features
- **Sequential Workflow**: Clock In -> Tea Out -> Tea In -> Lunch Out -> Lunch In -> Clock Out.
- **Automatic Calculation**: Total hours calculated automatically (Total - Lunch). Tea breaks are not deducted.
- **Management**: Edit, Add, and Delete historical records.
- **Export**: Download your timesheet as a CSV file.

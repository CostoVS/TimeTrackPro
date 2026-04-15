# TimeTrack Pro - Deployment Guide

This application is a full-stack time management system built with React (Vite) and Node.js (Express). It is designed to run on your Contabo server at **port 8502**.

## Server Details
- **IP Address**: 62.171.158.235
- **Deployment Port**: 8502 (Host) -> 3000 (Container)

## Features
- **Flexible Clocking**: Independent buttons for Clock In, Tea Breaks, Lunch, and Clock Out. No forced sequence.
- **Reports & Analytics**: Dedicated reports page with Daily, Weekly, and Monthly hour calculations.
- **PDF Export**: Download professional timesheet reports for offline viewing.
- **Manual Management**: Add, Edit, and Delete any clocking record (including dates and specific times).
- **Responsive UI**: Optimized for mobile and desktop with a clean, technical aesthetic.

## Deployment Instructions

### 1. Clone the Repository
SSH into your Contabo server and run:
```bash
git clone https://github.com/CostoVS/TimeTrackPro.git
cd TimeTrackPro
```

### 2. Deploy with Docker (Recommended)
This method ensures the app runs in isolation and does not interfere with other applications on your server. It also sets up a PostgreSQL database automatically.

**Prerequisites**: Ensure `docker` and `docker-compose` are installed.

**Run the app**:
```bash
docker-compose up -d --build
```

The application will now be accessible at `http://62.171.158.235:8502`.

### 4. SSL & Domain Setup (HTTPS)
To secure your app with HTTPS on **masterchief.co.za**, follow these steps:

**A. Install Nginx and Certbot**:
```bash
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx -y
```

**B. Configure Nginx**:
Create a config file: `sudo nano /etc/nginx/sites-available/timetrack`
Paste this content (this sets the app to run on `masterchief.co.za/timetrack`):
```nginx
server {
    listen 80;
    server_name masterchief.co.za;

    location /timetrack/ {
        proxy_pass http://localhost:8502/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Ensure trailing slashes are handled
        proxy_redirect off;
    }
}
```

**C. Enable and Get SSL**:
```bash
sudo ln -s /etc/nginx/sites-available/timetrack /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
sudo certbot --nginx -d masterchief.co.za
```

### 5. Updating the App
When you push new changes to GitHub, pull them on your server and restart the container:
```bash
git pull origin main
docker-compose up -d --build
```

## Configuration
- **Port**: The app is configured in `docker-compose.yml` to map host port `8502` to container port `3000`.
- **Database**: By default, Docker Compose sets up a PostgreSQL instance. If you run the app without Docker, it will fallback to a local `database.sqlite` file.

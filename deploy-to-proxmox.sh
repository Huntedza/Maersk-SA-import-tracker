#!/bin/bash

# SA Inbound Tracker - Complete Proxmox LXC Deployment Script
# This script will install everything needed on your Debian LXC container

set -e  # Exit on any error

echo "🚢 SA Inbound Tracker - Proxmox LXC Deployment Script"
echo "=================================================="

# Configuration
APP_NAME="sa-tracker"
APP_DIR="/var/www/${APP_NAME}"
DOMAIN_NAME=""  # You'll set this during script run
API_PORT="3002"
NGINX_AVAILABLE="/etc/nginx/sites-available"
NGINX_ENABLED="/etc/nginx/sites-enabled"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${BLUE}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "Please run this script as root (use sudo)"
        exit 1
    fi
}

# Get user input
get_user_input() {
    echo ""
    echo "🔧 Configuration Setup"
    echo "====================="
    
    read -p "Enter your domain name (e.g., sa-tracker.yourdomain.com): " DOMAIN_NAME
    if [ -z "$DOMAIN_NAME" ]; then
        print_error "Domain name is required"
        exit 1
    fi
    
    read -p "Enter your Maersk API key: " MAERSK_API_KEY
    if [ -z "$MAERSK_API_KEY" ]; then
        print_warning "No API key provided. You can add it later in /var/www/sa-tracker/.env"
    fi
    
    echo ""
    echo "Configuration:"
    echo "- Domain: $DOMAIN_NAME"
    echo "- App directory: $APP_DIR"
    echo "- API Port: $API_PORT"
    echo ""
    read -p "Continue? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Deployment cancelled"
        exit 1
    fi
}

# Update system
update_system() {
    print_step "Updating system packages"
    apt update
    apt upgrade -y
    print_success "System updated"
}

# Install Node.js
install_nodejs() {
    print_step "Installing Node.js 18.x"
    
    # Check if Node.js is already installed
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_warning "Node.js already installed: $NODE_VERSION"
        
        # Check if version is acceptable (v16+)
        MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
        if [ "$MAJOR_VERSION" -ge 16 ]; then
            print_success "Node.js version is acceptable"
            return 0
        else
            print_warning "Node.js version is too old, updating..."
        fi
    fi
    
    # Install Node.js 18.x
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt install -y nodejs
    
    # Verify installation
    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    print_success "Node.js installed: $NODE_VERSION (npm: $NPM_VERSION)"
}

# Install PM2
install_pm2() {
    print_step "Installing PM2 process manager"
    
    if command -v pm2 &> /dev/null; then
        print_warning "PM2 already installed"
        return 0
    fi
    
    npm install -g pm2
    print_success "PM2 installed"
}

# Install Nginx
install_nginx() {
    print_step "Installing Nginx"
    
    if command -v nginx &> /dev/null; then
        print_warning "Nginx already installed"
    else
        apt install -y nginx
    fi
    
    # Enable and start nginx
    systemctl enable nginx
    systemctl start nginx
    print_success "Nginx installed and started"
}

# Install additional tools
install_tools() {
    print_step "Installing additional tools (git, curl, unzip, rsync)"
    apt install -y git curl unzip ufw rsync
    print_success "Additional tools installed"
}

# Setup application directory
setup_app_directory() {
    print_step "Setting up application directory"
    
    # Store the original directory where script was run from
    ORIGINAL_DIR="$(pwd)"
    
    # Create directory
    mkdir -p "$APP_DIR"
    
    # Check if we're already in the target directory
    if [ "$ORIGINAL_DIR" = "$APP_DIR" ]; then
        print_success "Already in target directory: $APP_DIR"
    else
        # If this script is being run from the project directory, copy files
        if [ -f "$ORIGINAL_DIR/package.json" ]; then
            print_step "Copying application files from $ORIGINAL_DIR to $APP_DIR"
            # Use rsync to avoid copying to same directory issues
            rsync -av --exclude='node_modules' --exclude='.git' "$ORIGINAL_DIR/" "$APP_DIR/"
        else
            print_warning "Application files not found in current directory"
            print_warning "You'll need to upload your SA Tracker files to $APP_DIR"
            echo ""
            echo "To upload files, you can:"
            echo "1. Use scp: scp -r sa-inbound-tracker/* root@your-lxc-ip:$APP_DIR/"
            echo "2. Use git: git clone your-repo $APP_DIR"
            echo "3. Use rsync: rsync -av sa-inbound-tracker/ root@your-lxc-ip:$APP_DIR/"
            echo ""
            read -p "Continue anyway? (y/n): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        fi
    fi
    
    # Change to app directory
    cd "$APP_DIR"
    
    # Set proper ownership
    chown -R www-data:www-data "$APP_DIR"
    print_success "Application directory setup complete"
}

# Install application dependencies
install_app_dependencies() {
    print_step "Installing application dependencies"
    
    cd "$APP_DIR"
    
    if [ ! -f "package.json" ]; then
        print_error "package.json not found. Please upload your application files first."
        exit 1
    fi
    
    # Install dependencies
    npm install --production
    print_success "Dependencies installed"
}

# Build React application
build_react_app() {
    print_step "Building React application"
    
    cd "$APP_DIR"
    
    # Create environment file
    cat > .env << EOF
REACT_APP_MAERSK_API_KEY=$MAERSK_API_KEY
REACT_APP_USE_MOCK_DATA=false
REACT_APP_LOG_API_REQUESTS=false
NODE_ENV=production
EOF
    
    # Build the React app
    npm run build
    print_success "React application built"
}

# Configure PM2
configure_pm2() {
    print_step "Configuring PM2"
    
    cd "$APP_DIR"
    
    # Create PM2 ecosystem file
    cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: '${APP_NAME}-api',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: '${API_PORT}'
    },
    error_file: '/var/log/pm2/${APP_NAME}-error.log',
    out_file: '/var/log/pm2/${APP_NAME}-out.log',
    log_file: '/var/log/pm2/${APP_NAME}-combined.log'
  }]
};
EOF
    
    # Create PM2 log directory
    mkdir -p /var/log/pm2
    chown -R www-data:www-data /var/log/pm2
    
    # Start application with PM2
    sudo -u www-data pm2 start ecosystem.config.js
    
    # Setup PM2 startup
    pm2 startup systemd -u www-data --hp /var/www
    sudo -u www-data pm2 save
    
    print_success "PM2 configured and application started"
}

# Configure Nginx
configure_nginx() {
    print_step "Configuring Nginx"
    
    # Create nginx configuration
    cat > "${NGINX_AVAILABLE}/${APP_NAME}" << EOF
server {
    listen 80;
    server_name ${DOMAIN_NAME};
    
    root ${APP_DIR}/build;
    index index.html;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript;
    
    # Handle React Router
    location / {
        try_files \$uri \$uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # API proxy
    location /api {
        proxy_pass http://localhost:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }
    
    # Security: deny access to sensitive files
    location ~ /\\.ht {
        deny all;
    }
    
    location ~ /\\.(git|env) {
        deny all;
    }
}
EOF
    
    # Enable site
    ln -sf "${NGINX_AVAILABLE}/${APP_NAME}" "${NGINX_ENABLED}/"
    
    # Remove default site if exists
    if [ -f "${NGINX_ENABLED}/default" ]; then
        rm "${NGINX_ENABLED}/default"
    fi
    
    # Test nginx configuration
    nginx -t
    
    # Reload nginx
    systemctl reload nginx
    
    print_success "Nginx configured"
}

# Setup firewall
setup_firewall() {
    print_step "Configuring UFW firewall"
    
    # Enable UFW
    ufw --force enable
    
    # Allow SSH (important!)
    ufw allow ssh
    
    # Allow HTTP and HTTPS
    ufw allow 80/tcp
    ufw allow 443/tcp
    
    # Show status
    ufw status
    
    print_success "Firewall configured"
}

# Setup SSL with Let's Encrypt (optional)
setup_ssl() {
    print_step "Setting up SSL certificate (Optional)"
    
    read -p "Do you want to install SSL certificate with Certbot? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Install certbot
        apt install -y certbot python3-certbot-nginx
        
        print_warning "SSL certificate setup will be completed after DNS is configured"
        print_warning "After pointing your domain to this server, run:"
        print_warning "certbot --nginx -d $DOMAIN_NAME"
    else
        print_warning "Skipping SSL setup. You can set it up later with Cloudflare"
    fi
}

# Final status check
final_status() {
    print_step "Final status check"
    
    echo ""
    echo "🔍 Service Status:"
    echo "=================="
    
    # Check PM2
    echo "PM2 Status:"
    sudo -u www-data pm2 list
    
    echo ""
    echo "Nginx Status:"
    systemctl status nginx --no-pager -l
    
    echo ""
    echo "🎉 Deployment Summary"
    echo "==================="
    echo "✅ Application deployed to: $APP_DIR"
    echo "✅ API running on port: $API_PORT"
    echo "✅ Nginx configured for: $DOMAIN_NAME"
    echo "✅ Background refresh service active (30 min intervals)"
    echo "✅ Firewall configured (ports 22, 80, 443)"
    echo ""
    echo "🌐 Next Steps:"
    echo "=============="
    echo "1. Point your domain ($DOMAIN_NAME) to this server's IP"
    echo "2. Configure Cloudflare DNS and proxy settings"
    echo "3. Test the application: http://$DOMAIN_NAME"
    echo "4. Monitor logs: sudo -u www-data pm2 logs"
    echo ""
    echo "📁 Important Files:"
    echo "=================="
    echo "- App directory: $APP_DIR"
    echo "- Environment: $APP_DIR/.env"
    echo "- Nginx config: ${NGINX_AVAILABLE}/${APP_NAME}"
    echo "- PM2 config: $APP_DIR/ecosystem.config.js"
    echo "- Logs: /var/log/pm2/"
    echo ""
    echo "🚀 Deployment completed successfully!"
}

# Main execution
main() {
    print_step "Starting SA Inbound Tracker deployment"
    
    check_root
    get_user_input
    update_system
    install_nodejs
    install_pm2
    install_nginx
    install_tools
    setup_app_directory
    install_app_dependencies
    build_react_app
    configure_pm2
    configure_nginx
    setup_firewall
    setup_ssl
    final_status
    
    print_success "🎊 All done! Your SA Inbound tracker is ready!"
}

# Run main function
main "$@"
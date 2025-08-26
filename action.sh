#!/system/bin/sh

# Enhanced Magisk/KernelSU Action Script for HDR WebUI
MODPATH="${0%/*}"
WEBUI_PATH="$MODPATH/webroot"
LOG_TAG="enable-hdr-oneplus13-webui"

# Function to display header
show_header() {
    echo "=================================================="
    echo "  OnePlus 13 HDR WebUI Management Tool"
    echo "  Version 2.0 - Enhanced Edition"
    echo "=================================================="
    echo ""
}

# Function to check WebUI integrity
check_webui_integrity() {
    local missing_files=""
    
    # Check critical WebUI files
    [ ! -f "$WEBUI_PATH/index.html" ] && missing_files="$missing_files index.html"
    [ ! -f "$WEBUI_PATH/scripts/main.js" ] && missing_files="$missing_files main.js"
    [ ! -f "$WEBUI_PATH/scripts/i18n.js" ] && missing_files="$missing_files i18n.js"
    [ ! -f "$WEBUI_PATH/scripts/assets/kernelsu.js" ] && missing_files="$missing_files kernelsu.js"
    
    if [ -n "$missing_files" ]; then
        echo "❌ WebUI integrity check failed!"
        echo "   Missing files:$missing_files"
        echo ""
        return 1
    else
        echo "✅ WebUI integrity check passed"
        echo ""
        return 0
    fi
}

# Function to show WebUI status
show_webui_status() {
    echo "📊 WebUI Status Information:"
    echo "   WebUI Path: $WEBUI_PATH"
    
    # Check if files exist and show sizes
    if [ -f "$MODPATH/appList.xml" ]; then
        local app_count=$(grep -c '<application name=' "$MODPATH/appList.xml" 2>/dev/null || echo "0")
        echo "   App List: $app_count apps configured"
    else
        echo "   App List: ❌ Not found"
    fi
    
    if [ -f "$MODPATH/app_cache.json" ]; then
        echo "   App Cache: ✅ Available"
    else
        echo "   App Cache: ❌ Not initialized"
    fi
    
    if [ -f "$MODPATH/webui.log" ]; then
        local log_size=$(stat -c%s "$MODPATH/webui.log" 2>/dev/null || echo "0")
        echo "   Log File: $(($log_size / 1024))KB"
    else
        echo "   Log File: No logs yet"
    fi
    echo ""
}

# Function to show access methods
show_access_methods() {
    echo "🔗 WebUI Access Methods:"
    echo ""
    echo "Method 1 - KernelSU WebUI (Recommended):"
    echo "  1. Install: KsuWebUI-1.0-34-release.apk"
    echo "  2. Grant ROOT permissions"
    echo "  3. Navigate to module WebUI section"
    echo ""
    echo "Method 2 - Manual File Access:"
    echo "  • Open: $WEBUI_PATH/index.html"
    echo "  • Use file manager with HTML viewer"
    echo ""
    echo "Method 3 - Built-in HTTP Server:"
    
    # Check if we can start HTTP server
    if command -v busybox >/dev/null 2>&1 && busybox httpd -h >/dev/null 2>&1; then
        echo "  • Run this script to start local server"
        echo "  • Access via http://127.0.0.1:8080"
    else
        echo "  • ❌ BusyBox HTTP server not available"
    fi
    echo ""
}

# Function to start HTTP server
start_http_server() {
    echo "🚀 Starting Built-in HTTP Server..."
    
    PORT=8080
    cd "$WEBUI_PATH" || exit 1
    
    # Check if port is already in use
    if netstat -ln 2>/dev/null | grep -q ":$PORT "; then
        echo "   Port $PORT is busy, trying $((PORT+1))..."
        PORT=$((PORT+1))
    fi
    
    # Start HTTP server in background
    busybox httpd -p $PORT -h "$WEBUI_PATH" -f &
    HTTP_PID=$!
    
    sleep 2
    
    # Verify server started
    if kill -0 $HTTP_PID 2>/dev/null; then
        echo "✅ HTTP Server started successfully!"
        echo ""
        echo "🌐 Access WebUI at: http://127.0.0.1:$PORT"
        echo "📁 Serving from: $WEBUI_PATH"
        echo "🔧 Process ID: $HTTP_PID"
        echo ""
        echo "📝 To stop the server later:"
        echo "   kill $HTTP_PID"
        echo ""
        echo "💡 The server will run until you kill it or reboot"
        
        # Log the server start
        log -t "$LOG_TAG" "HTTP server started on port $PORT (PID: $HTTP_PID)"
    else
        echo "❌ Failed to start HTTP server"
        exit 1
    fi
}

# Main execution
show_header

# Check if WebUI directory exists
if [ ! -d "$WEBUI_PATH" ]; then
    echo "❌ ERROR: WebUI directory not found!"
    echo "   Expected: $WEBUI_PATH"
    echo ""
    echo "🔧 Troubleshooting:"
    echo "   • Ensure module is properly installed"
    echo "   • Check if module directory is accessible"
    echo "   • Reinstall the module if necessary"
    exit 1
fi

# Perform integrity check
if ! check_webui_integrity; then
    echo "🔧 Troubleshooting:"
    echo "   • Reinstall the module to restore missing files"
    echo "   • Check storage permissions"
    exit 1
fi

# Show current status
show_webui_status

# Show access methods
show_access_methods

# Ask user what they want to do
echo "🎯 Available Actions:"
echo "   [1] Start built-in HTTP server"
echo "   [2] Show detailed file information"
echo "   [3] Test WebUI file permissions"
echo "   [4] Exit"
echo ""

# If busybox httpd is available, try to auto-start
if command -v busybox >/dev/null 2>&1 && busybox httpd -h >/dev/null 2>&1; then
    echo "🔄 Auto-starting HTTP server (Method 3)..."
    start_http_server
else
    echo "💡 Recommendation: Use Method 1 (KernelSU WebUI) for best experience"
    echo ""
    echo "📱 Enhanced WebUI Features (v2.0):"
    echo "   • Smart real-time search and filtering"
    echo "   • Persistent app name caching"
    echo "   • Batch select/deselect operations"
    echo "   • Optimized performance and loading"
    echo "   • Enhanced mobile-friendly interface"
    echo "   • Comprehensive error handling"
    echo ""
fi

echo "✨ WebUI setup completed!"
exit 0
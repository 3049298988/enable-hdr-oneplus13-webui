#!/system/bin/sh

# Magisk service script - runs after system boot
MODPATH="${0%/*}"
API=`getprop ro.build.version.sdk`

# Log service start
log -t "enable-hdr-oneplus13-webui" "Service started"

# Ensure webui directory permissions are correct
if [ -d "$MODPATH/webroot" ]; then
    # 设置目录权限
    chmod -R 755 "$MODPATH/webroot"
    # 确保所有JS文件可读
    find "$MODPATH/webroot" -name "*.js" -exec chmod 644 {} \;
    # 确保所有HTML/CSS文件可读
    find "$MODPATH/webroot" -name "*.html" -exec chmod 644 {} \;
    find "$MODPATH/webroot" -name "*.css" -exec chmod 644 {} \;
    
    log -t "enable-hdr-oneplus13-webui" "WebUI permissions set"
fi

# 设置 aapt 二进制文件的执行权限
if [ -d "$MODPATH/bin" ]; then
    # 设置bin目录权限
    chmod 755 "$MODPATH/bin"
    
    # 为所有架构的aapt设置执行权限
    for arch_dir in "$MODPATH/bin"/*; do
        if [ -d "$arch_dir" ]; then
            chmod 755 "$arch_dir"
            if [ -f "$arch_dir/aapt" ]; then
                chmod 755 "$arch_dir/aapt"
                log -t "enable-hdr-oneplus13-webui" "Set executable permission for $(basename "$arch_dir")/aapt"
            fi
        fi
    done
    
    log -t "enable-hdr-oneplus13-webui" "Binary permissions set"
fi

# 确保appList.xml存在且可读
if [ ! -f "$MODPATH/appList.xml" ]; then
    # 创建默认的appList.xml
    cat > "$MODPATH/appList.xml" << 'EOF'
<application name="com.netflix.mediaclient"></application>
<application name="com.google.android.youtube"></application>
<application name="org.videolan.vlc"></application>
<application name="com.android.chrome"></application>
EOF
    chmod 644 "$MODPATH/appList.xml"
    log -t "enable-hdr-oneplus13-webui" "Created default appList.xml"
fi

# 确保日志文件目录可写
touch "$MODPATH/webui.log" 2>/dev/null && rm -f "$MODPATH/webui.log" 2>/dev/null
if [ $? -eq 0 ]; then
    log -t "enable-hdr-oneplus13-webui" "Log directory is writable"
else
    log -t "enable-hdr-oneplus13-webui" "Warning: Log directory may not be writable"
fi

# Log WebUI access path for user reference
log -t "enable-hdr-oneplus13-webui" "WebUI available at: $MODPATH/webroot/"
log -t "enable-hdr-oneplus13-webui" "AppList at: $MODPATH/appList.xml"
log -t "enable-hdr-oneplus13-webui" "Binary tools at: $MODPATH/bin/"

exit 0
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

# Log WebUI access path for user reference
log -t "enable-hdr-oneplus13-webui" "WebUI available at: $MODPATH/webroot/"
log -t "enable-hdr-oneplus13-webui" "AppList at: $MODPATH/appList.xml"

exit 0
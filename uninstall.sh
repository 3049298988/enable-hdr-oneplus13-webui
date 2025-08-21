#!/system/bin/sh

# Cleanup script for module uninstallation
log -t "enable-hdr-oneplus13-webui" "Starting module cleanup"

# Remove temporary files (use specific pattern to avoid conflicts)
rm -rf /data/local/tmp/enable-hdr-oneplus13-webui*

# Remove any cached data
rm -rf /data/system/enable-hdr-oneplus13-webui*

# Clean up any leftover WebUI cache
rm -rf /data/data/*/cache/enable-hdr-oneplus13-webui* 2>/dev/null

log -t "enable-hdr-oneplus13-webui" "Module cleanup completed"
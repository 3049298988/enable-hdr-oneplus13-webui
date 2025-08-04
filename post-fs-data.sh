#!/system/bin/sh

# This script runs after filesystems are mounted.
# For simple file replacement, KernelSU's systemless overlay often handles it automatically.
# This script is primarily for advanced scenarios like setting specific permissions/contexts
# or if the default overlay doesn't work for a particular file.

MODPATH="${0%/*}" # Path to your module's directory

TARGET_FILE="/my_product/vendor/etc/multimedia_display_feature_config.xml"
MODULE_FILE="$MODPATH/multimedia_display_feature_config.xml"
APPLIST_FILE="$MODPATH/appList.xml"

# Ensure the target directory exists (KernelSU usually handles this)
# mkdir -p "$(dirname "$TARGET_FILE")"

# Apply correct permissions and SELinux context if necessary
# KernelSU often handles SELinux context inheritance, but sometimes manual intervention is needed.
# Get original context:
# ORIGINAL_CONTEXT=$(ls -Zd "$TARGET_FILE" 2>/dev/null | awk '{print $1}')
# if [ -n "$ORIGINAL_CONTEXT" ]; then
#     chcon "$ORIGINAL_CONTEXT" "$MODULE_FILE"
# fi
# chmod 0644 "$MODULE_FILE" # Set appropriate permissions

# If the simple systemless overlay isn't working for this specific file,
# you could try a bind mount here, but it's generally not recommended for single files
# as it's less "systemless" and can be more prone to issues.

awk '
  NR==FNR { newapps = newapps $0 "\n"; next }
  /<feature name="(OplusDolbyVision|HdrVision)"/ { in_block = 1 }
  in_block && /<application[^>]*\/>/ { next }
  in_block && /<application[^>]*><\/application>/ { next }
  in_block && /<\/feature>/ {
    printf "%s", newapps
    in_block = 0
  }
  { print }
' "$APPLIST_FILE" "$TARGET_FILE" > "$MODULE_FILE"

mount -o bind "$MODULE_FILE" "$TARGET_FILE"

# Log for debugging (optional)
log_file="/data/local/tmp/enable-hdr-oneplus13.txt"
echo "$(date): post-fs-data.sh executed for $TARGET_FILE" >> "$log_file"
echo "Module file exists: $(test -f "$MODULE_FILE" && echo "Yes" || echo "No")" >> "$log_file"
echo "Target file exists: $(test -f "$TARGET_FILE" && echo "Yes" || echo "No")" >> "$log_file"
echo "Target file content (first line): $(head -n 1 "$TARGET_FILE" 2>/dev/null)" >> "$log_file"

# Always exit successfully
exit 0
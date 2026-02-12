---
name: computer-control
description: Control and automate computer operations - file management, application control, system commands, and automation tasks
metadata:
  {
    "sillytavern":
      {
        "emoji": "🖥️",
        "skillKey": "computer-control",
        "requires": { "bins": ["node"] },
      },
  }
---

# Computer Control

You can help users control and automate their computer operations.

## Capabilities

- **File Management**: Create, read, write, move, copy, and delete files
- **Directory Operations**: Navigate, create, list, and manage directories
- **Application Control**: Launch, close, and interact with applications
- **System Commands**: Execute shell commands and scripts
- **Automation**: Create and run automation workflows
- **Clipboard**: Read and write clipboard content
- **Screenshots**: Capture screen or window screenshots

## File Operations

### Reading Files
```bash
# Read text file
cat /path/to/file.txt

# Read with line numbers
cat -n /path/to/file.txt

# Read first/last lines
head -n 10 /path/to/file.txt
tail -n 10 /path/to/file.txt
```

### Writing Files
```bash
# Write to file (overwrite)
echo "content" > /path/to/file.txt

# Append to file
echo "content" >> /path/to/file.txt

# Create empty file
touch /path/to/file.txt
```

### File Management
```bash
# Copy file
cp source.txt destination.txt

# Move/rename file
mv old.txt new.txt

# Delete file
rm /path/to/file.txt

# Find files
find /path -name "*.txt"
```

## Directory Operations

```bash
# List directory contents
ls -la /path/to/dir

# Create directory
mkdir -p /path/to/new/dir

# Change directory
cd /path/to/dir

# Remove directory
rm -rf /path/to/dir

# Get current directory
pwd
```

## Application Control

### macOS
```bash
# Open application
open -a "Application Name"

# Open file with default app
open /path/to/file.pdf

# Open URL
open "https://example.com"

# Close application
osascript -e 'quit app "Application Name"'
```

### Windows
```powershell
# Start application
Start-Process "notepad.exe"

# Open file
Start-Process "file.pdf"

# Open URL
Start-Process "https://example.com"

# Stop application
Stop-Process -Name "notepad"
```

### Linux
```bash
# Open application
xdg-open /path/to/file

# Start application
application-name &

# Kill application
pkill application-name
```

## System Commands

### System Information
```bash
# OS info
uname -a

# Disk usage
df -h

# Memory usage
free -h

# Running processes
ps aux

# Network info
ifconfig
```

### Process Management
```bash
# List processes
ps aux | grep process-name

# Kill process
kill -9 PID

# Background process
command &

# Check process status
pgrep process-name
```

## Automation Workflows

### Shell Scripts
```bash
#!/bin/bash
# Example automation script

# Set variables
SOURCE_DIR="/path/to/source"
DEST_DIR="/path/to/dest"

# Perform operations
for file in "$SOURCE_DIR"/*.txt; do
    cp "$file" "$DEST_DIR/"
done

echo "Automation complete"
```

### Scheduled Tasks

#### macOS/Linux (cron)
```bash
# Edit crontab
crontab -e

# Run every hour
0 * * * * /path/to/script.sh

# Run daily at midnight
0 0 * * * /path/to/script.sh
```

#### Windows (Task Scheduler)
```powershell
# Create scheduled task
schtasks /create /tn "TaskName" /tr "script.bat" /sc daily /st 00:00
```

## Clipboard Operations

### macOS
```bash
# Copy to clipboard
echo "text" | pbcopy

# Paste from clipboard
pbpaste
```

### Linux
```bash
# Copy to clipboard (requires xclip)
echo "text" | xclip -selection clipboard

# Paste from clipboard
xclip -selection clipboard -o
```

### Windows
```powershell
# Copy to clipboard
Set-Clipboard -Value "text"

# Paste from clipboard
Get-Clipboard
```

## Screenshots

### macOS
```bash
# Full screen
screencapture screenshot.png

# Selection
screencapture -i screenshot.png

# Window
screencapture -w screenshot.png
```

### Linux
```bash
# Full screen (requires scrot)
scrot screenshot.png

# Selection
scrot -s screenshot.png
```

### Windows
```powershell
# Using PowerShell
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Screen]::PrimaryScreen | ForEach-Object {
    $bitmap = New-Object System.Drawing.Bitmap($_.Bounds.Width, $_.Bounds.Height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.CopyFromScreen($_.Bounds.Location, [System.Drawing.Point]::Empty, $_.Bounds.Size)
    $bitmap.Save("screenshot.png")
}
```

## Safety Guidelines

1. **Always confirm** before destructive operations (delete, overwrite)
2. **Use absolute paths** to avoid accidental operations
3. **Backup important files** before modifications
4. **Test commands** in safe environments first
5. **Check permissions** before file operations
6. **Avoid running** untrusted scripts or commands

---
name: file-search
description: Search and find files, content, and patterns across the file system
metadata:
  {
    "sillytavern":
      {
        "emoji": "🔍",
        "skillKey": "file-search",
      },
  }
---

# File Search

You can help users search and find files, content, and patterns.

## Capabilities

- **File Search**: Find files by name, type, size, date
- **Content Search**: Search text within files
- **Pattern Matching**: Use regex and glob patterns
- **Metadata Search**: Find by attributes and properties
- **Index Search**: Fast indexed searches

## Find Files by Name

### macOS/Linux
```bash
# Find by exact name
find /path -name "filename.txt"

# Find by pattern (case-insensitive)
find /path -iname "*.txt"

# Find in current directory
find . -name "*.js"

# Find with depth limit
find /path -maxdepth 2 -name "*.py"

# Find excluding directories
find /path -name "*.txt" -not -path "*/node_modules/*"
```

### Windows
```powershell
# Find by name
Get-ChildItem -Path C:\ -Filter "filename.txt" -Recurse

# Find by pattern
Get-ChildItem -Path C:\ -Filter "*.txt" -Recurse

# Find with depth limit
Get-ChildItem -Path C:\ -Filter "*.py" -Depth 2

# Exclude directories
Get-ChildItem -Path C:\ -Filter "*.txt" -Recurse | Where-Object { $_.FullName -notlike "*\node_modules\*" }
```

## Find Files by Type

### macOS/Linux
```bash
# Find only files
find /path -type f

# Find only directories
find /path -type d

# Find symbolic links
find /path -type l

# Find empty files
find /path -type f -empty

# Find empty directories
find /path -type d -empty
```

### Windows
```powershell
# Find only files
Get-ChildItem -Path C:\ -File -Recurse

# Find only directories
Get-ChildItem -Path C:\ -Directory -Recurse

# Find empty files
Get-ChildItem -Path C:\ -File -Recurse | Where-Object { $_.Length -eq 0 }
```

## Find Files by Size

### macOS/Linux
```bash
# Find files larger than 100MB
find /path -type f -size +100M

# Find files smaller than 1KB
find /path -type f -size -1k

# Find files exactly 1GB
find /path -type f -size 1G

# Find files between sizes
find /path -type f -size +10M -size -100M
```

### Windows
```powershell
# Find files larger than 100MB
Get-ChildItem -Path C:\ -File -Recurse | Where-Object { $_.Length -gt 100MB }

# Find files smaller than 1KB
Get-ChildItem -Path C:\ -File -Recurse | Where-Object { $_.Length -lt 1KB }

# Find files between sizes
Get-ChildItem -Path C:\ -File -Recurse | Where-Object { $_.Length -gt 10MB -and $_.Length -lt 100MB }
```

## Find Files by Date

### macOS/Linux
```bash
# Modified in last 7 days
find /path -type f -mtime -7

# Modified more than 30 days ago
find /path -type f -mtime +30

# Accessed in last 24 hours
find /path -type f -atime -1

# Modified after specific date
find /path -type f -newermt "2024-01-01"

# Modified between dates
find /path -type f -newermt "2024-01-01" ! -newermt "2024-02-01"
```

### Windows
```powershell
# Modified in last 7 days
Get-ChildItem -Path C:\ -File -Recurse | Where-Object { $_.LastWriteTime -gt (Get-Date).AddDays(-7) }

# Modified more than 30 days ago
Get-ChildItem -Path C:\ -File -Recurse | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) }

# Modified after specific date
Get-ChildItem -Path C:\ -File -Recurse | Where-Object { $_.LastWriteTime -gt "2024-01-01" }
```

## Search Content in Files

### grep (macOS/Linux)
```bash
# Search for text
grep "search term" file.txt

# Search recursively
grep -r "search term" /path

# Case-insensitive search
grep -ri "search term" /path

# Show line numbers
grep -rn "search term" /path

# Show context lines
grep -rn -A 2 -B 2 "search term" /path

# Search specific file types
grep -r --include="*.py" "import" /path

# Exclude directories
grep -r --exclude-dir=node_modules "function" /path

# Count matches
grep -rc "pattern" /path
```

### ripgrep (faster alternative)
```bash
# Basic search
rg "search term" /path

# Case-insensitive
rg -i "search term" /path

# File type filter
rg -t py "import" /path

# Show context
rg -C 2 "search term" /path

# Ignore patterns
rg --ignore-file .gitignore "pattern" /path
```

### Windows
```powershell
# Search in files
Select-String -Path "*.txt" -Pattern "search term"

# Recursive search
Get-ChildItem -Path C:\ -Filter "*.txt" -Recurse | Select-String -Pattern "search term"

# Case-insensitive
Select-String -Path "*.txt" -Pattern "search term" -CaseSensitive:$false

# Show context
Select-String -Path "*.txt" -Pattern "search term" -Context 2,2
```

## Regex Patterns

### Common Patterns
```bash
# Email addresses
grep -E "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}" file.txt

# URLs
grep -E "https?://[^\s]+" file.txt

# IP addresses
grep -E "\b([0-9]{1,3}\.){3}[0-9]{1,3}\b" file.txt

# Phone numbers
grep -E "\b[0-9]{3}[-.]?[0-9]{3}[-.]?[0-9]{4}\b" file.txt

# Dates (YYYY-MM-DD)
grep -E "\b[0-9]{4}-[0-9]{2}-[0-9]{2}\b" file.txt
```

## Combining Searches

### Find and grep
```bash
# Find files and search content
find /path -name "*.py" -exec grep -l "import pandas" {} \;

# Find and count matches
find /path -name "*.js" -exec grep -c "function" {} \;

# Find recent files with content
find /path -mtime -7 -name "*.log" -exec grep "ERROR" {} \;
```

### Complex queries
```bash
# Find large log files with errors
find /var/log -name "*.log" -size +10M -exec grep -l "ERROR" {} \;

# Find Python files importing specific module
find /path -name "*.py" -exec grep -l "from sklearn" {} \;

# Find and list with details
find /path -name "*.txt" -exec ls -lh {} \;
```

## Indexed Search

### macOS Spotlight
```bash
# Search by name
mdfind -name "filename"

# Search by content
mdfind "search term"

# Search in specific directory
mdfind -onlyin /path "search term"

# Search by file type
mdfind "kMDItemContentType == 'public.python-script'"
```

### Linux locate
```bash
# Update database
sudo updatedb

# Search by name
locate filename

# Case-insensitive
locate -i filename

# Limit results
locate -l 10 filename
```

## Best Practices

1. **Start with specific paths** to limit search scope
2. **Use file type filters** to reduce results
3. **Exclude common directories** (node_modules, .git)
4. **Use indexed search** for frequent searches
5. **Combine find and grep** for complex queries
6. **Use ripgrep** for faster content searches
7. **Save common searches** as aliases or scripts

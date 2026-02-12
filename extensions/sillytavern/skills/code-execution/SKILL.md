---
name: code-execution
description: Execute code in various programming languages - Python, JavaScript, Shell, and more
metadata:
  {
    "sillytavern":
      {
        "emoji": "💻",
        "skillKey": "code-execution",
        "requires": { "anyBins": ["node", "python", "python3"] },
      },
  }
---

# Code Execution

You can help users execute code in various programming languages.

## Supported Languages

- **JavaScript/Node.js**: Server-side JavaScript execution
- **Python**: Data processing, scripting, automation
- **Shell/Bash**: System commands and scripts
- **PowerShell**: Windows automation

## JavaScript/Node.js

### Basic Execution
```javascript
// Simple script
console.log('Hello, World!');

// With variables
const name = 'User';
console.log(`Hello, ${name}!`);

// Async operations
const result = await fetch('https://api.example.com/data');
const data = await result.json();
console.log(data);
```

### File Operations
```javascript
const fs = require('fs').promises;

// Read file
const content = await fs.readFile('file.txt', 'utf-8');

// Write file
await fs.writeFile('output.txt', 'Hello World');

// List directory
const files = await fs.readdir('./');
console.log(files);
```

### HTTP Requests
```javascript
// GET request
const response = await fetch('https://api.example.com/data');
const data = await response.json();

// POST request
const result = await fetch('https://api.example.com/submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ key: 'value' })
});
```

## Python

### Basic Execution
```python
# Simple script
print('Hello, World!')

# With variables
name = 'User'
print(f'Hello, {name}!')

# List comprehension
numbers = [x * 2 for x in range(10)]
print(numbers)
```

### File Operations
```python
# Read file
with open('file.txt', 'r') as f:
    content = f.read()

# Write file
with open('output.txt', 'w') as f:
    f.write('Hello World')

# JSON handling
import json
with open('data.json', 'r') as f:
    data = json.load(f)
```

### Data Processing
```python
import pandas as pd

# Read CSV
df = pd.read_csv('data.csv')

# Basic analysis
print(df.describe())
print(df.head())

# Filter data
filtered = df[df['column'] > 100]

# Save results
filtered.to_csv('filtered.csv', index=False)
```

### HTTP Requests
```python
import requests

# GET request
response = requests.get('https://api.example.com/data')
data = response.json()

# POST request
result = requests.post(
    'https://api.example.com/submit',
    json={'key': 'value'}
)
```

## Shell/Bash

### Basic Commands
```bash
#!/bin/bash

# Variables
NAME="User"
echo "Hello, $NAME!"

# Command substitution
DATE=$(date +%Y-%m-%d)
echo "Today is $DATE"

# Conditionals
if [ -f "file.txt" ]; then
    echo "File exists"
else
    echo "File not found"
fi
```

### Loops
```bash
# For loop
for file in *.txt; do
    echo "Processing $file"
done

# While loop
count=0
while [ $count -lt 5 ]; do
    echo "Count: $count"
    ((count++))
done

# Read file line by line
while IFS= read -r line; do
    echo "$line"
done < file.txt
```

### Text Processing
```bash
# grep - search text
grep "pattern" file.txt

# sed - replace text
sed 's/old/new/g' file.txt

# awk - process columns
awk '{print $1, $3}' file.txt

# sort and unique
sort file.txt | uniq

# count lines/words
wc -l file.txt
```

## PowerShell

### Basic Commands
```powershell
# Variables
$Name = "User"
Write-Host "Hello, $Name!"

# Get date
$Date = Get-Date -Format "yyyy-MM-dd"
Write-Host "Today is $Date"

# Conditionals
if (Test-Path "file.txt") {
    Write-Host "File exists"
} else {
    Write-Host "File not found"
}
```

### File Operations
```powershell
# Read file
$content = Get-Content "file.txt"

# Write file
Set-Content -Path "output.txt" -Value "Hello World"

# List files
Get-ChildItem -Path ".\" -Filter "*.txt"

# Copy/Move files
Copy-Item "source.txt" "dest.txt"
Move-Item "old.txt" "new.txt"
```

### System Operations
```powershell
# Get processes
Get-Process | Where-Object { $_.CPU -gt 100 }

# Get services
Get-Service | Where-Object { $_.Status -eq "Running" }

# System info
Get-ComputerInfo | Select-Object OsName, OsVersion
```

## Execution Safety

### Sandboxing
- Execute code in isolated environments
- Limit file system access
- Restrict network access when needed
- Set execution timeouts

### Input Validation
```python
# Validate user input
import re

def validate_input(user_input):
    # Remove dangerous characters
    sanitized = re.sub(r'[;&|`$]', '', user_input)
    return sanitized
```

### Error Handling
```python
try:
    result = execute_code(code)
except SyntaxError as e:
    print(f"Syntax error: {e}")
except TimeoutError:
    print("Execution timed out")
except Exception as e:
    print(f"Error: {e}")
```

## Best Practices

1. **Validate all inputs** before execution
2. **Use timeouts** to prevent infinite loops
3. **Limit resource usage** (memory, CPU)
4. **Log all executions** for auditing
5. **Sandbox untrusted code** in containers
6. **Never execute** code from untrusted sources
7. **Review code** before execution
8. **Use virtual environments** for Python

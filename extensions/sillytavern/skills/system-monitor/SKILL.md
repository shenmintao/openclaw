---
name: system-monitor
description: Monitor system resources and performance - CPU, memory, disk, network, and process monitoring
metadata:
  {
    "sillytavern":
      {
        "emoji": "📊",
        "skillKey": "system-monitor",
      },
  }
---

# System Monitor

You can help users monitor system resources and performance.

## Capabilities

- **CPU Monitoring**: Usage, temperature, frequency
- **Memory Monitoring**: RAM usage, swap, available memory
- **Disk Monitoring**: Space usage, I/O, health
- **Network Monitoring**: Bandwidth, connections, latency
- **Process Monitoring**: Running processes, resource usage

## CPU Monitoring

### macOS
```bash
# CPU usage
top -l 1 | grep "CPU usage"

# CPU info
sysctl -n machdep.cpu.brand_string
sysctl -n hw.ncpu

# Per-core usage
top -l 1 -n 0 | grep "CPU"

# CPU temperature (requires osx-cpu-temp)
osx-cpu-temp
```

### Linux
```bash
# CPU usage
top -bn1 | grep "Cpu(s)"

# CPU info
cat /proc/cpuinfo | grep "model name" | head -1
nproc

# Per-core usage
mpstat -P ALL 1 1

# CPU temperature
cat /sys/class/thermal/thermal_zone*/temp
```

### Windows
```powershell
# CPU usage
Get-Counter '\Processor(_Total)\% Processor Time'

# CPU info
Get-WmiObject Win32_Processor | Select-Object Name, NumberOfCores

# Per-core usage
Get-Counter '\Processor(*)\% Processor Time'
```

## Memory Monitoring

### macOS
```bash
# Memory usage
vm_stat | perl -ne '/page size of (\d+)/ and $size=$1; /Pages\s+([^:]+)[^\d]+(\d+)/ and printf("%-16s % 16.2f MB\n", "$1:", $2 * $size / 1048576);'

# Simple memory info
top -l 1 | grep PhysMem

# Memory pressure
memory_pressure
```

### Linux
```bash
# Memory usage
free -h

# Detailed memory info
cat /proc/meminfo

# Memory usage percentage
free | grep Mem | awk '{print $3/$2 * 100.0}'
```

### Windows
```powershell
# Memory usage
Get-Process | Sort-Object WorkingSet -Descending | Select-Object -First 10 Name, @{N='Memory(MB)';E={$_.WorkingSet/1MB}}

# System memory
Get-WmiObject Win32_OperatingSystem | Select-Object TotalVisibleMemorySize, FreePhysicalMemory

# Memory percentage
$os = Get-WmiObject Win32_OperatingSystem
"{0:N2}%" -f (($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / $os.TotalVisibleMemorySize * 100)
```

## Disk Monitoring

### macOS/Linux
```bash
# Disk usage
df -h

# Disk usage by directory
du -sh /*

# Disk I/O
iostat -d 1 3

# Disk health (macOS)
diskutil info disk0 | grep SMART
```

### Windows
```powershell
# Disk usage
Get-WmiObject Win32_LogicalDisk | Select-Object DeviceID, @{N='Size(GB)';E={$_.Size/1GB}}, @{N='Free(GB)';E={$_.FreeSpace/1GB}}

# Disk I/O
Get-Counter '\PhysicalDisk(*)\Disk Reads/sec', '\PhysicalDisk(*)\Disk Writes/sec'

# Disk health
Get-PhysicalDisk | Select-Object FriendlyName, HealthStatus
```

## Network Monitoring

### macOS
```bash
# Network interfaces
ifconfig

# Active connections
netstat -an | grep ESTABLISHED

# Bandwidth usage
nettop -P -L 1

# DNS lookup
nslookup example.com

# Ping
ping -c 4 example.com
```

### Linux
```bash
# Network interfaces
ip addr

# Active connections
ss -tuln

# Bandwidth usage
iftop -t -s 1

# Network statistics
netstat -s

# Ping
ping -c 4 example.com
```

### Windows
```powershell
# Network interfaces
Get-NetAdapter | Select-Object Name, Status, LinkSpeed

# Active connections
Get-NetTCPConnection | Where-Object State -eq 'Established'

# Bandwidth usage
Get-Counter '\Network Interface(*)\Bytes Total/sec'

# Ping
Test-Connection example.com -Count 4
```

## Process Monitoring

### macOS/Linux
```bash
# Top processes by CPU
ps aux --sort=-%cpu | head -10

# Top processes by memory
ps aux --sort=-%mem | head -10

# Process tree
pstree

# Specific process
ps aux | grep process-name

# Real-time monitoring
top
htop  # if installed
```

### Windows
```powershell
# Top processes by CPU
Get-Process | Sort-Object CPU -Descending | Select-Object -First 10 Name, CPU

# Top processes by memory
Get-Process | Sort-Object WorkingSet -Descending | Select-Object -First 10 Name, @{N='Memory(MB)';E={$_.WorkingSet/1MB}}

# Process details
Get-Process -Name "process-name" | Format-List *

# Process tree
Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, Name
```

## Alerts and Thresholds

### CPU Alert
```bash
#!/bin/bash
CPU_THRESHOLD=80
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)

if (( $(echo "$CPU_USAGE > $CPU_THRESHOLD" | bc -l) )); then
    echo "ALERT: CPU usage is ${CPU_USAGE}%"
fi
```

### Memory Alert
```bash
#!/bin/bash
MEM_THRESHOLD=80
MEM_USAGE=$(free | grep Mem | awk '{print $3/$2 * 100.0}')

if (( $(echo "$MEM_USAGE > $MEM_THRESHOLD" | bc -l) )); then
    echo "ALERT: Memory usage is ${MEM_USAGE}%"
fi
```

### Disk Alert
```bash
#!/bin/bash
DISK_THRESHOLD=90
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | tr -d '%')

if [ "$DISK_USAGE" -gt "$DISK_THRESHOLD" ]; then
    echo "ALERT: Disk usage is ${DISK_USAGE}%"
fi
```

## Continuous Monitoring

### Using watch
```bash
# Monitor every 2 seconds
watch -n 2 'free -h'
watch -n 2 'df -h'
watch -n 2 'ps aux --sort=-%cpu | head -5'
```

### Logging
```bash
#!/bin/bash
LOG_FILE="/var/log/system-monitor.log"

while true; do
    echo "$(date): CPU: $(top -bn1 | grep 'Cpu(s)' | awk '{print $2}')" >> $LOG_FILE
    echo "$(date): MEM: $(free | grep Mem | awk '{print $3/$2 * 100.0}')%" >> $LOG_FILE
    sleep 60
done
```

## Best Practices

1. **Set appropriate thresholds** for your system
2. **Monitor trends** not just current values
3. **Use lightweight tools** for continuous monitoring
4. **Log historical data** for analysis
5. **Set up alerts** for critical thresholds
6. **Monitor during peak hours** for accurate baselines
7. **Consider resource overhead** of monitoring tools

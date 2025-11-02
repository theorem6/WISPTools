#!/usr/bin/env python3
import sys

# Read the backup server.js
with open('server.js.backup-20251022-033405', 'r') as f:
    lines = f.readlines()

# Add maintainAPI require after workOrderAPI (line 3)
lines.insert(3, "const maintainAPI = require('./maintain-api');\n")

# Find the line with /api/work-orders and add maintain route after it
for i, line in enumerate(lines):
    if "/api/work-orders" in line:
        lines.insert(i + 1, "app.use('/api/maintain', maintainAPI);\n")
        break

# Write the fixed server.js
with open('server.js', 'w') as f:
    f.writelines(lines)

print("✅ server.js updated successfully")


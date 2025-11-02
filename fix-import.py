#!/usr/bin/env python3
import sys

filename = sys.argv[1] if len(sys.argv) > 1 else 'customer-api.js'

with open(filename, 'r') as f:
    content = f.read()

# Replace the import
content = content.replace("require('../models/customer')", "require('./customer-schema')")

with open(filename, 'w') as f:
    f.write(content)

print(f"✅ Fixed {filename}")


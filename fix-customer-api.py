#!/usr/bin/env python3
import re

# Read the customer-api.js file
with open('customer-api.js', 'r') as f:
    content = f.read()

# Fix the import
content = re.sub(
    r"require\(['\"]\.\./models/customer['\"]\)",
    "require('./customer-schema')",
    content
)

# Update the POST route to include fullName generation
old_post = r"(router\.post\('/', async \(req, res\) => \{[^}]+)(const customer = new Customer\(\{[^}]+\}[^}]+\}\))"

def replace_post(match):
    route_start = match.group(1)
    customer_new = match.group(2)
    
    # Check if fullName generation already exists
    if 'fullName' in route_start and 'req.body.firstName' in route_start:
        return match.group(0)  # Already has fullName generation
    
    # Insert fullName generation before customer creation
    fullname_code = '''    // Generate fullName if not provided
    const fullName = req.body.fullName || `${req.body.firstName || ''} ${req.body.lastName || ''}`.trim();
    
    '''
    return route_start + fullname_code + customer_new

# Try to update the POST route
content_new = re.sub(
    r"(router\.post\('/', async \(req, res\) => \{[\s\S]+?const customer = new Customer\(\{[\s\S]+?\}\));",
    replace_post,
    content,
    count=1
)

# If that didn't work, do a simpler replacement
if content_new == content:
    # Find the POST route and add fullName
    pattern = r"(const customerId = `CUST-[^`]+`;)\s*(const customer = new Customer)"
    replacement = r"\1\n    \n    // Generate fullName if not provided\n    const fullName = req.body.fullName || `${req.body.firstName || ''} ${req.body.lastName || ''}`.trim();\n    \n\2"
    content_new = re.sub(pattern, replacement, content)
    
    # Update Customer constructor to include fullName
    pattern2 = r"(const customer = new Customer\(\{[\s\S]+?customerId[\s\S]+?\})"
    def add_fullname(match):
        customer_str = match.group(1)
        if 'fullName' not in customer_str:
            customer_str = customer_str.rstrip(')') + ',\n      fullName\n    )'
        return customer_str
    
    content_new = re.sub(pattern2, add_fullname, content_new)

# Write back
with open('customer-api.js', 'w') as f:
    f.write(content_new)

print("✅ Updated customer-api.js")


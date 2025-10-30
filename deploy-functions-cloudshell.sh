#!/bin/bash
# One-line deployment script for Google Cloud Shell
# Just copy and paste into Cloud Shell

cd ~ && git clone https://github.com/theorem6/lte-pci-mapper.git 2>/dev/null || (cd lte-pci-mapper && git pull origin main) && cd lte-pci-mapper/functions && npm install && npm run build && firebase deploy --only functions:hssProxy --project lte-pci-mapper-65450042-bbf71



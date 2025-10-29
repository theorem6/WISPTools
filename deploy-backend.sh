#!/bin/bash
cd /root/lte-pci-mapper
git fetch origin
git reset --hard origin/main
pm2 restart main-api
pm2 logs main-api --lines 10



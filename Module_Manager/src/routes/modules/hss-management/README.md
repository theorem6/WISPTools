# HSS & Subscriber Management Module

## Overview

Home Subscriber Server (HSS) and comprehensive subscriber management for LTE/5G networks.

## Features

- 👥 Subscriber management (IMSI, Ki, OPc)
- 📦 Subscriber groups organization
- 🚀 Bandwidth plans (speed tiers)
- 📱 IMEI tracking
- 🌐 Remote MME connections (S6a/Diameter)
- 📥 Bulk import/export
- 🔐 Enable/disable users
- 📊 Dashboard and statistics

## Backend API

HSS backend runs on your GCE instance (genieacs-backend) at:
- REST API: http://EXTERNAL_IP/api/hss/
- S6a Diameter: EXTERNAL_IP:3868

## Documentation

See project root:
- `FIREBASE_STUDIO_SIMPLE_SETUP.md` - Deployment guide
- `COMPLETE_AUTOMATED_SETUP.md` - Full setup
- `hss-module/README.md` - API documentation




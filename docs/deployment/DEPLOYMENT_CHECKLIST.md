# Deployment Checklist

## Backend Server Deployment

- [ ] Backup current files
- [ ] Copy updated files to server
- [ ] Verify file syntax
- [ ] Restart backend service
- [ ] Check service status
- [ ] Verify logs show no errors
- [ ] Test check-queued-commands script

## EPC Agent Deployment (User will handle)

- [ ] Download latest agent script
- [ ] Update on EPC device
- [ ] Restart check-in service
- [ ] Verify check-ins are working
- [ ] Check logs for result reporting

## Verification

- [ ] Commands are being marked as completed
- [ ] No duplicate update commands appearing
- [ ] Result reporting is working
- [ ] Check-in process is stable

## Files to Deploy

### Backend (Server):
1. `backend-services/routes/epc-checkin.js`
2. `backend-services/services/epc-checkin-service.js`
3. `backend-services/utils/epc-auto-update.js`
4. `backend-services/scripts/check-queued-commands.js` (new)

### Agent (EPC Device):
1. `backend-services/scripts/epc-checkin-agent.sh`

---

**Status**: Ready for deployment


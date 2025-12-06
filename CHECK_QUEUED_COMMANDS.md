# Check Queued EPC Commands

## Quick Check (MongoDB)

Connect to MongoDB and run:

```javascript
// Find all pending/sent update commands for a specific EPC
db.epccommands.find({
  epc_id: "EPC-CB4C5042",  // Replace with your EPC ID
  action: "update_scripts",
  status: { $in: ["pending", "sent"] }
}).sort({ created_at: -1 })

// Count them
db.epccommands.countDocuments({
  epc_id: "EPC-CB4C5042",
  action: "update_scripts",
  status: { $in: ["pending", "sent"] }
})

// Find ALL pending/sent commands (any type)
db.epccommands.find({
  epc_id: "EPC-CB4C5042",
  status: { $in: ["pending", "sent"] }
}).sort({ created_at: -1 })
```

## Check by Device Code

If you have the device code instead:

```javascript
// First find the EPC
var epc = db.remotepcs.findOne({ device_code: "YALNTFQC" })

// Then find commands
db.epccommands.find({
  epc_id: epc.epc_id,
  status: { $in: ["pending", "sent"] }
}).sort({ created_at: -1 })
```

## Clean Up Stuck Commands

If commands are stuck in 'sent' status (older than 10 minutes):

```javascript
// Find stuck commands
db.epccommands.find({
  epc_id: "EPC-CB4C5042",
  status: "sent",
  sent_at: { $lt: new Date(Date.now() - 600000) }  // 10 minutes ago
})

// Mark them as failed
db.epccommands.updateMany(
  {
    epc_id: "EPC-CB4C5042",
    status: "sent",
    sent_at: { $lt: new Date(Date.now() - 600000) }
  },
  {
    $set: {
      status: "failed",
      completed_at: new Date(),
      result: {
        success: false,
        error: "Command timed out - was stuck in sent status",
        exit_code: -1
      }
    }
  }
)
```

## Check All EPCs

To see all pending/sent commands across all EPCs:

```javascript
db.epccommands.find({
  status: { $in: ["pending", "sent"] }
}).sort({ created_at: -1 }).limit(20)
```

## Node.js Script to Check

Create a script to check programmatically:

```javascript
// check-queued-commands.js
const mongoose = require('mongoose');
const { EPCCommand, RemoteEPC } = require('./models/distributed-epc-schema');

async function checkQueuedCommands(epcIdOrDeviceCode) {
  await mongoose.connect(process.env.MONGODB_URI);
  
  // Find EPC
  let epc;
  if (epcIdOrDeviceCode.startsWith('EPC-')) {
    epc = await RemoteEPC.findOne({ epc_id: epcIdOrDeviceCode });
  } else {
    epc = await RemoteEPC.findOne({ device_code: epcIdOrDeviceCode.toUpperCase() });
  }
  
  if (!epc) {
    console.log('EPC not found');
    return;
  }
  
  // Find commands
  const commands = await EPCCommand.find({
    epc_id: epc.epc_id,
    status: { $in: ['pending', 'sent'] }
  }).sort({ created_at: -1 });
  
  console.log(`\nFound ${commands.length} queued command(s) for ${epc.epc_id}:`);
  console.log('='.repeat(60));
  
  commands.forEach(cmd => {
    console.log(`\nID: ${cmd._id}`);
    console.log(`Type: ${cmd.command_type} / ${cmd.action}`);
    console.log(`Status: ${cmd.status}`);
    console.log(`Created: ${cmd.created_at}`);
    if (cmd.sent_at) {
      console.log(`Sent: ${cmd.sent_at}`);
      const age = Math.floor((Date.now() - cmd.sent_at) / 1000 / 60);
      console.log(`Age: ${age} minutes`);
    }
  });
  
  // Count by type
  const updateCommands = commands.filter(c => c.action === 'update_scripts');
  console.log(`\n📊 Summary:`);
  console.log(`   Total queued: ${commands.length}`);
  console.log(`   Update commands: ${updateCommands.length}`);
  console.log(`   Pending: ${commands.filter(c => c.status === 'pending').length}`);
  console.log(`   Sent: ${commands.filter(c => c.status === 'sent').length}`);
  
  await mongoose.disconnect();
}

// Run
const epcId = process.argv[2] || 'EPC-CB4C5042';
checkQueuedCommands(epcId).catch(console.error);
```

Run it:
```bash
node check-queued-commands.js EPC-CB4C5042
# or
node check-queued-commands.js YALNTFQC
```

## Why Commands Keep Appearing

If you keep seeing new update commands, it could be:

1. **Commands not being marked as completed** - Result reporting is failing
2. **Auto-update check running before result is reported** - Race condition
3. **Script hash mismatch** - EPC reports different hash than server
4. **Multiple EPCs with same device code** - Database issue

## Fix: Clean Up and Prevent Duplicates

```javascript
// 1. Mark all old 'sent' commands as failed
db.epccommands.updateMany(
  {
    epc_id: "EPC-CB4C5042",
    status: "sent",
    sent_at: { $lt: new Date(Date.now() - 600000) }
  },
  {
    $set: {
      status: "failed",
      completed_at: new Date(),
      result: { success: false, error: "Stuck in sent status", exit_code: -1 }
    }
  }
)

// 2. Delete duplicate pending update commands (keep only the newest)
var duplicates = db.epccommands.find({
  epc_id: "EPC-CB4C5042",
  action: "update_scripts",
  status: "pending"
}).sort({ created_at: -1 }).toArray()

if (duplicates.length > 1) {
  // Keep the newest, delete the rest
  var toDelete = duplicates.slice(1).map(c => c._id)
  db.epccommands.deleteMany({ _id: { $in: toDelete } })
  print(`Deleted ${toDelete.length} duplicate update commands`)
}
```


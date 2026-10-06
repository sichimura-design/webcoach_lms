const {
  RDSClient,
  StopDBInstanceCommand,
  StartDBInstanceCommand,
  DescribeDBInstancesCommand,
} = require('@aws-sdk/client-rds');

const client = new RDSClient({});

exports.handler = async (event) => {
  const dbInstanceIdentifier = process.env.DB_INSTANCE_IDENTIFIER;
  const action = event && event.action;

  if (!dbInstanceIdentifier) {
    throw new Error('DB_INSTANCE_IDENTIFIER environment variable is required');
  }
  if (action !== 'stop' && action !== 'start') {
    throw new Error(`Invalid action: "${action}". Must be "stop" or "start".`);
  }

  const describeResult = await client.send(
    new DescribeDBInstancesCommand({ DBInstanceIdentifier: dbInstanceIdentifier })
  );
  const status = describeResult.DBInstances && describeResult.DBInstances[0]
    ? describeResult.DBInstances[0].DBInstanceStatus
    : undefined;

  if (action === 'stop') {
    if (status !== 'available') {
      console.log(`Skip stop: current status is "${status}", expected "available".`);
      return { action, dbInstanceIdentifier, skipped: true, status };
    }
    await client.send(new StopDBInstanceCommand({ DBInstanceIdentifier: dbInstanceIdentifier }));
    console.log(`Stop requested for ${dbInstanceIdentifier}`);
  } else {
    if (status !== 'stopped') {
      console.log(`Skip start: current status is "${status}", expected "stopped".`);
      return { action, dbInstanceIdentifier, skipped: true, status };
    }
    await client.send(new StartDBInstanceCommand({ DBInstanceIdentifier: dbInstanceIdentifier }));
    console.log(`Start requested for ${dbInstanceIdentifier}`);
  }

  return { action, dbInstanceIdentifier, skipped: false, previousStatus: status };
};

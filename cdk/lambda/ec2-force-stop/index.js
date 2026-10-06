const { EC2Client, StopInstancesCommand, DescribeInstancesCommand } = require('@aws-sdk/client-ec2');

const client = new EC2Client({});

exports.handler = async () => {
  const instanceId = process.env.INSTANCE_ID;
  if (!instanceId) {
    throw new Error('INSTANCE_ID environment variable is required');
  }

  const describeResult = await client.send(
    new DescribeInstancesCommand({ InstanceIds: [instanceId] })
  );
  const state = describeResult.Reservations
    && describeResult.Reservations[0]
    && describeResult.Reservations[0].Instances[0]
    && describeResult.Reservations[0].Instances[0].State.Name;

  if (state === 'stopped' || state === 'stopping' || state === 'terminated') {
    console.log(`Skip stop: current state is "${state}".`);
    return { instanceId, skipped: true, state };
  }

  await client.send(new StopInstancesCommand({ InstanceIds: [instanceId] }));
  console.log(`Stop requested for ${instanceId}`);
  return { instanceId, skipped: false, previousState: state };
};

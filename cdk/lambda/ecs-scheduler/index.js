const { ECSClient, DescribeServicesCommand, UpdateServiceCommand } = require('@aws-sdk/client-ecs');
const {
  AutoScalingClient,
  DescribeAutoScalingGroupsCommand,
  UpdateAutoScalingGroupCommand,
} = require('@aws-sdk/client-auto-scaling');

const ecs = new ECSClient({});
const asgClient = new AutoScalingClient({});

// The ECS EC2-capacity Auto Scaling Group's physical name is CDK-generated and not
// predictable ahead of deploy, so it's discovered at runtime via the
// "aws:cloudformation:stack-name" tag that CloudFormation automatically applies to it.
async function findAsgByStackTag(stackName) {
  let nextToken;
  do {
    const result = await asgClient.send(
      new DescribeAutoScalingGroupsCommand({ NextToken: nextToken })
    );
    for (const group of result.AutoScalingGroups || []) {
      const tag = (group.Tags || []).find(
        (t) => t.Key === 'aws:cloudformation:stack-name' && t.Value === stackName
      );
      if (tag) {
        return group;
      }
    }
    nextToken = result.NextToken;
  } while (nextToken);
  return null;
}

exports.handler = async (event) => {
  const clusterName = process.env.CLUSTER_NAME;
  const serviceName = process.env.SERVICE_NAME;
  const asgStackName = process.env.ASG_STACK_NAME;
  const serviceDesiredCount = parseInt(process.env.SERVICE_DESIRED_COUNT || '2', 10);
  const asgMinCapacity = parseInt(process.env.ASG_MIN_CAPACITY || '2', 10);
  const asgDesiredCapacity = parseInt(process.env.ASG_DESIRED_CAPACITY || '2', 10);
  const action = event && event.action;

  if (!clusterName || !serviceName || !asgStackName) {
    throw new Error('CLUSTER_NAME, SERVICE_NAME and ASG_STACK_NAME environment variables are required');
  }
  if (action !== 'stop' && action !== 'start') {
    throw new Error(`Invalid action: "${action}". Must be "stop" or "start".`);
  }

  const asg = await findAsgByStackTag(asgStackName);
  if (!asg) {
    throw new Error(`No Auto Scaling Group found tagged with aws:cloudformation:stack-name=${asgStackName}`);
  }

  const describeResult = await ecs.send(
    new DescribeServicesCommand({ cluster: clusterName, services: [serviceName] })
  );
  const service = describeResult.services && describeResult.services[0];
  const currentDesiredCount = service ? service.desiredCount : undefined;

  if (action === 'stop') {
    if (currentDesiredCount === 0 && asg.MinSize === 0 && asg.DesiredCapacity === 0) {
      console.log('Skip stop: service and ASG are already scaled to 0.');
      return { action, skipped: true };
    }

    // Scale the service down first so tasks drain out of the ALB target group
    // before the underlying EC2 capacity disappears.
    if (currentDesiredCount !== 0) {
      await ecs.send(new UpdateServiceCommand({ cluster: clusterName, service: serviceName, desiredCount: 0 }));
      console.log(`ECS service ${serviceName} desiredCount set to 0`);
    }

    if (asg.MinSize !== 0 || asg.DesiredCapacity !== 0) {
      await asgClient.send(
        new UpdateAutoScalingGroupCommand({
          AutoScalingGroupName: asg.AutoScalingGroupName,
          MinSize: 0,
          DesiredCapacity: 0,
        })
      );
      console.log(`ASG ${asg.AutoScalingGroupName} scaled to 0`);
    }

    return {
      action,
      skipped: false,
      previousDesiredCount: currentDesiredCount,
      previousAsgDesiredCapacity: asg.DesiredCapacity,
    };
  }

  // action === 'start': bring EC2 capacity up first so tasks have somewhere to land.
  if (
    currentDesiredCount === serviceDesiredCount &&
    asg.MinSize === asgMinCapacity &&
    asg.DesiredCapacity === asgDesiredCapacity
  ) {
    console.log('Skip start: service and ASG are already at target capacity.');
    return { action, skipped: true };
  }

  if (asg.MinSize !== asgMinCapacity || asg.DesiredCapacity !== asgDesiredCapacity) {
    await asgClient.send(
      new UpdateAutoScalingGroupCommand({
        AutoScalingGroupName: asg.AutoScalingGroupName,
        MinSize: asgMinCapacity,
        DesiredCapacity: asgDesiredCapacity,
      })
    );
    console.log(`ASG ${asg.AutoScalingGroupName} scaled to min=${asgMinCapacity} desired=${asgDesiredCapacity}`);
  }

  if (currentDesiredCount !== serviceDesiredCount) {
    await ecs.send(
      new UpdateServiceCommand({ cluster: clusterName, service: serviceName, desiredCount: serviceDesiredCount })
    );
    console.log(`ECS service ${serviceName} desiredCount set to ${serviceDesiredCount}`);
  }

  return {
    action,
    skipped: false,
    previousDesiredCount: currentDesiredCount,
    previousAsgDesiredCapacity: asg.DesiredCapacity,
  };
};

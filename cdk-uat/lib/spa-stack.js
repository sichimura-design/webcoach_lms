"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.UatSpaStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const s3deploy = __importStar(require("aws-cdk-lib/aws-s3-deployment"));
const cloudfront = __importStar(require("aws-cdk-lib/aws-cloudfront"));
const origins = __importStar(require("aws-cdk-lib/aws-cloudfront-origins"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
function buildContentAuthAsset(secret) {
    const template = fs.readFileSync(path.join(__dirname, '../lambda/content-auth/index.js'), 'utf8');
    const code = template.replace('__CONTENT_TOKEN_SECRET__', secret);
    const dir = path.join(os.tmpdir(), 'uat-moodle-content-auth');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.js'), code);
    return dir;
}
class UatSpaStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // --context contentTokenSecret=<secret> で渡す
        // 省略時は開発用デフォルト（本番環境では必ず指定すること）
        const contentTokenSecret = this.node.tryGetContext('contentTokenSecret') ?? 'uat-secret-change-me';
        const bucket = new s3.Bucket(this, 'SpaBucket', {
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
        });
        // Lambda@Edge: コンテンツ認証（html-content/*, course-images/* を保護）
        const authFunction = new cloudfront.experimental.EdgeFunction(this, 'ContentAuthFunction', {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset(buildContentAuthAsset(contentTokenSecret)),
            description: `Lambda@Edge: content auth for ${props.envName}`,
        });
        const contentAuthBehavior = {
            origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
            originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
            edgeLambdas: [
                {
                    functionVersion: authFunction.currentVersion,
                    eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
                },
            ],
        };
        const distribution = new cloudfront.Distribution(this, 'Distribution', {
            defaultBehavior: {
                origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
            },
            additionalBehaviors: {
                'html-content/*': contentAuthBehavior,
                'course-images/*': contentAuthBehavior,
            },
            defaultRootObject: 'index.html',
            errorResponses: [
                { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
                { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
            ],
        });
        new s3deploy.BucketDeployment(this, 'SpaDeployment', {
            sources: [s3deploy.Source.asset('../frontend/build')],
            destinationBucket: bucket,
            distribution,
            distributionPaths: ['/*'],
        });
        new cdk.CfnOutput(this, 'CloudFrontDomain', {
            value: distribution.distributionDomainName,
            description: 'CloudFront ドメイン (UAT フロントエンド URL)',
            exportName: `${props.envName}-CloudFrontDomain`,
        });
        new cdk.CfnOutput(this, 'BucketName', {
            value: bucket.bucketName,
            exportName: `${props.envName}-SpaBucketName`,
        });
        new cdk.CfnOutput(this, 'DistributionId', {
            value: distribution.distributionId,
            exportName: `${props.envName}-DistributionId`,
        });
    }
}
exports.UatSpaStack = UatSpaStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3BhLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic3BhLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQyx1REFBeUM7QUFDekMsd0VBQTBEO0FBQzFELHVFQUF5RDtBQUN6RCw0RUFBOEQ7QUFDOUQsK0RBQWlEO0FBRWpELHVDQUF5QjtBQUN6QiwyQ0FBNkI7QUFDN0IsdUNBQXlCO0FBRXpCLFNBQVMscUJBQXFCLENBQUMsTUFBYztJQUMzQyxNQUFNLFFBQVEsR0FBRyxFQUFFLENBQUMsWUFBWSxDQUM5QixJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxpQ0FBaUMsQ0FBQyxFQUN2RCxNQUFNLENBQ1AsQ0FBQztJQUNGLE1BQU0sSUFBSSxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUMsMEJBQTBCLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDbEUsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLEVBQUUseUJBQXlCLENBQUMsQ0FBQztJQUM5RCxFQUFFLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQ3ZDLEVBQUUsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsVUFBVSxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDbkQsT0FBTyxHQUFHLENBQUM7QUFDYixDQUFDO0FBTUQsTUFBYSxXQUFZLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDeEMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUF1QjtRQUMvRCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4Qiw0Q0FBNEM7UUFDNUMsK0JBQStCO1FBQy9CLE1BQU0sa0JBQWtCLEdBQ3RCLElB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QUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUU7WUFDcEMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxVQUFVO1lBQ3hCLFVBQVUsRUFBRSxHQUFHLEtBQUssQ0FBQyxPQUFPLGdCQUFnQjtTQUM3QyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO1lBQ3hDLEtBQUssRUFBRSxZQUFZLENBQUMsY0FBYztZQUNsQyxVQUFVLEVBQUUsR0FBRyxLQUFLLENBQUMsT0FBTyxpQkFBaUI7U0FDOUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBakZELGtDQWlGQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0ICogYXMgczNkZXBsb3kgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzLWRlcGxveW1lbnQnO1xuaW1wb3J0ICogYXMgY2xvdWRmcm9udCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udCc7XG5pbXBvcnQgKiBhcyBvcmlnaW5zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250LW9yaWdpbnMnO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0ICogYXMgb3MgZnJvbSAnb3MnO1xuXG5mdW5jdGlvbiBidWlsZENvbnRlbnRBdXRoQXNzZXQoc2VjcmV0OiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCB0ZW1wbGF0ZSA9IGZzLnJlYWRGaWxlU3luYyhcbiAgICBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vbGFtYmRhL2NvbnRlbnQtYXV0aC9pbmRleC5qcycpLFxuICAgICd1dGY4J1xuICApO1xuICBjb25zdCBjb2RlID0gdGVtcGxhdGUucmVwbGFjZSgnX19DT05URU5UX1RPS0VOX1NFQ1JFVF9fJywgc2VjcmV0KTtcbiAgY29uc3QgZGlyID0gcGF0aC5qb2luKG9zLnRtcGRpcigpLCAndWF0LW1vb2RsZS1jb250ZW50LWF1dGgnKTtcbiAgZnMubWtkaXJTeW5jKGRpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gIGZzLndyaXRlRmlsZVN5bmMocGF0aC5qb2luKGRpciwgJ2luZGV4LmpzJyksIGNvZGUpO1xuICByZXR1cm4gZGlyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFVhdFNwYVN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIHJlYWRvbmx5IGVudk5hbWU6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIFVhdFNwYVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFVhdFNwYVN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIC0tY29udGV4dCBjb250ZW50VG9rZW5TZWNyZXQ9PHNlY3JldD4g44Gn5rih44GZXG4gICAgLy8g55yB55Wl5pmC44Gv6ZaL55m655So44OH44OV44Kp44Or44OI77yI5pys55Wq55Kw5aKD44Gn44Gv5b+F44Ga5oyH5a6a44GZ44KL44GT44Go77yJXG4gICAgY29uc3QgY29udGVudFRva2VuU2VjcmV0OiBzdHJpbmcgPVxuICAgICAgdGhpcy5ub2RlLnRyeUdldENvbnRleHQoJ2NvbnRlbnRUb2tlblNlY3JldCcpID8/ICd1YXQtc2VjcmV0LWNoYW5nZS1tZSc7XG5cbiAgICBjb25zdCBidWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdTcGFCdWNrZXQnLCB7XG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IHRydWUsXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgIH0pO1xuXG4gICAgLy8gTGFtYmRhQEVkZ2U6IOOCs+ODs+ODhuODs+ODhOiqjeiovO+8iGh0bWwtY29udGVudC8qLCBjb3Vyc2UtaW1hZ2VzLyog44KS5L+d6K2377yJXG4gICAgY29uc3QgYXV0aEZ1bmN0aW9uID0gbmV3IGNsb3VkZnJvbnQuZXhwZXJpbWVudGFsLkVkZ2VGdW5jdGlvbihcbiAgICAgIHRoaXMsXG4gICAgICAnQ29udGVudEF1dGhGdW5jdGlvbicsXG4gICAgICB7XG4gICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxuICAgICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChidWlsZENvbnRlbnRBdXRoQXNzZXQoY29udGVudFRva2VuU2VjcmV0KSksXG4gICAgICAgIGRlc2NyaXB0aW9uOiBgTGFtYmRhQEVkZ2U6IGNvbnRlbnQgYXV0aCBmb3IgJHtwcm9wcy5lbnZOYW1lfWAsXG4gICAgICB9XG4gICAgKTtcblxuICAgIGNvbnN0IGNvbnRlbnRBdXRoQmVoYXZpb3I6IGNsb3VkZnJvbnQuQmVoYXZpb3JPcHRpb25zID0ge1xuICAgICAgb3JpZ2luOiBvcmlnaW5zLlMzQnVja2V0T3JpZ2luLndpdGhPcmlnaW5BY2Nlc3NDb250cm9sKGJ1Y2tldCksXG4gICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTogY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfRElTQUJMRUQsXG4gICAgICBvcmlnaW5SZXF1ZXN0UG9saWN5OiBjbG91ZGZyb250Lk9yaWdpblJlcXVlc3RQb2xpY3kuQ09SU19TM19PUklHSU4sXG4gICAgICBlZGdlTGFtYmRhczogW1xuICAgICAgICB7XG4gICAgICAgICAgZnVuY3Rpb25WZXJzaW9uOiBhdXRoRnVuY3Rpb24uY3VycmVudFZlcnNpb24sXG4gICAgICAgICAgZXZlbnRUeXBlOiBjbG91ZGZyb250LkxhbWJkYUVkZ2VFdmVudFR5cGUuVklFV0VSX1JFUVVFU1QsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH07XG5cbiAgICBjb25zdCBkaXN0cmlidXRpb24gPSBuZXcgY2xvdWRmcm9udC5EaXN0cmlidXRpb24odGhpcywgJ0Rpc3RyaWJ1dGlvbicsIHtcbiAgICAgIGRlZmF1bHRCZWhhdmlvcjoge1xuICAgICAgICBvcmlnaW46IG9yaWdpbnMuUzNCdWNrZXRPcmlnaW4ud2l0aE9yaWdpbkFjY2Vzc0NvbnRyb2woYnVja2V0KSxcbiAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6IGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfT1BUSU1JWkVELFxuICAgICAgfSxcbiAgICAgIGFkZGl0aW9uYWxCZWhhdmlvcnM6IHtcbiAgICAgICAgJ2h0bWwtY29udGVudC8qJzogY29udGVudEF1dGhCZWhhdmlvcixcbiAgICAgICAgJ2NvdXJzZS1pbWFnZXMvKic6IGNvbnRlbnRBdXRoQmVoYXZpb3IsXG4gICAgICB9LFxuICAgICAgZGVmYXVsdFJvb3RPYmplY3Q6ICdpbmRleC5odG1sJyxcbiAgICAgIGVycm9yUmVzcG9uc2VzOiBbXG4gICAgICAgIHsgaHR0cFN0YXR1czogNDAzLCByZXNwb25zZUh0dHBTdGF0dXM6IDIwMCwgcmVzcG9uc2VQYWdlUGF0aDogJy9pbmRleC5odG1sJyB9LFxuICAgICAgICB7IGh0dHBTdGF0dXM6IDQwNCwgcmVzcG9uc2VIdHRwU3RhdHVzOiAyMDAsIHJlc3BvbnNlUGFnZVBhdGg6ICcvaW5kZXguaHRtbCcgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICBuZXcgczNkZXBsb3kuQnVja2V0RGVwbG95bWVudCh0aGlzLCAnU3BhRGVwbG95bWVudCcsIHtcbiAgICAgIHNvdXJjZXM6IFtzM2RlcGxveS5Tb3VyY2UuYXNzZXQoJy4uL2Zyb250ZW5kL2J1aWxkJyldLFxuICAgICAgZGVzdGluYXRpb25CdWNrZXQ6IGJ1Y2tldCxcbiAgICAgIGRpc3RyaWJ1dGlvbixcbiAgICAgIGRpc3RyaWJ1dGlvblBhdGhzOiBbJy8qJ10sXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ2xvdWRGcm9udERvbWFpbicsIHtcbiAgICAgIHZhbHVlOiBkaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uRG9tYWluTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ2xvdWRGcm9udCDjg4njg6HjgqTjg7MgKFVBVCDjg5Xjg63jg7Pjg4jjgqjjg7Pjg4kgVVJMKScsXG4gICAgICBleHBvcnROYW1lOiBgJHtwcm9wcy5lbnZOYW1lfS1DbG91ZEZyb250RG9tYWluYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdCdWNrZXROYW1lJywge1xuICAgICAgdmFsdWU6IGJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgZXhwb3J0TmFtZTogYCR7cHJvcHMuZW52TmFtZX0tU3BhQnVja2V0TmFtZWAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRGlzdHJpYnV0aW9uSWQnLCB7XG4gICAgICB2YWx1ZTogZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbklkLFxuICAgICAgZXhwb3J0TmFtZTogYCR7cHJvcHMuZW52TmFtZX0tRGlzdHJpYnV0aW9uSWRgLFxuICAgIH0pO1xuICB9XG59XG4iXX0=
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
exports.UatEcrStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const ecr = __importStar(require("aws-cdk-lib/aws-ecr"));
class UatEcrStack extends cdk.Stack {
    nginxRepo;
    bffRepo;
    apiRepo;
    moodleRepo;
    constructor(scope, id, props) {
        super(scope, id, props);
        const { envName } = props;
        // ECR は環境をまたいで共有可能だが、UAT 用に独立させる
        this.nginxRepo = new ecr.Repository(this, 'NginxRepo', {
            repositoryName: `${envName}-moodle-nginx`,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            emptyOnDelete: true,
            lifecycleRules: [
                { maxImageCount: 10, description: 'Keep last 10 images' },
            ],
        });
        this.bffRepo = new ecr.Repository(this, 'BffRepo', {
            repositoryName: `${envName}-moodle-bff`,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            emptyOnDelete: true,
            lifecycleRules: [
                { maxImageCount: 10, description: 'Keep last 10 images' },
            ],
        });
        this.apiRepo = new ecr.Repository(this, 'ApiRepo', {
            repositoryName: `${envName}-moodle-api`,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            emptyOnDelete: true,
            lifecycleRules: [
                { maxImageCount: 10, description: 'Keep last 10 images' },
            ],
        });
        this.moodleRepo = new ecr.Repository(this, 'MoodleRepo', {
            repositoryName: `${envName}-moodle-app`,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            emptyOnDelete: true,
            lifecycleRules: [
                { maxImageCount: 10, description: 'Keep last 10 images' },
            ],
        });
        // Outputs (docker push 時に使用)
        new cdk.CfnOutput(this, 'NginxRepoUri', {
            value: this.nginxRepo.repositoryUri,
            exportName: `${envName}-NginxRepoUri`,
        });
        new cdk.CfnOutput(this, 'BffRepoUri', {
            value: this.bffRepo.repositoryUri,
            exportName: `${envName}-BffRepoUri`,
        });
        new cdk.CfnOutput(this, 'ApiRepoUri', {
            value: this.apiRepo.repositoryUri,
            exportName: `${envName}-ApiRepoUri`,
        });
        new cdk.CfnOutput(this, 'MoodleRepoUri', {
            value: this.moodleRepo.repositoryUri,
            exportName: `${envName}-MoodleRepoUri`,
        });
    }
}
exports.UatEcrStack = UatEcrStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWNyLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZWNyLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQyx5REFBMkM7QUFPM0MsTUFBYSxXQUFZLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDeEIsU0FBUyxDQUFpQjtJQUMxQixPQUFPLENBQWlCO0lBQ3hCLE9BQU8sQ0FBaUI7SUFDeEIsVUFBVSxDQUFpQjtJQUUzQyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXVCO1FBQy9ELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sRUFBRSxPQUFPLEVBQUUsR0FBRyxLQUFLLENBQUM7UUFFMUIsaUNBQWlDO1FBQ2pDLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxHQUFHLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxXQUFXLEVBQUU7WUFDckQsY0FBYyxFQUFFLEdBQUcsT0FBTyxlQUFlO1lBQ3pDLGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87WUFDeEMsYUFBYSxFQUFFLElBQUk7WUFDbkIsY0FBYyxFQUFFO2dCQUNkLEVBQUUsYUFBYSxFQUFFLEVBQUUsRUFBRSxXQUFXLEVBQUUscUJBQXFCLEVBQUU7YUFDMUQ7U0FDRixDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksR0FBRyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsU0FBUyxFQUFFO1lBQ2pELGNBQWMsRUFBRSxHQUFHLE9BQU8sYUFBYTtZQUN2QyxhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxPQUFPO1lBQ3hDLGFBQWEsRUFBRSxJQUFJO1lBQ25CLGNBQWMsRUFBRTtnQkFDZCxFQUFFLGFBQWEsRUFBRSxFQUFFLEVBQUUsV0FBVyxFQUFFLHFCQUFxQixFQUFFO2FBQzFEO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFBRTtZQUNqRCxjQUFjLEVBQUUsR0FBRyxPQUFPLGFBQWE7WUFDdkMsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztZQUN4QyxhQUFhLEVBQUUsSUFBSTtZQUNuQixjQUFjLEVBQUU7Z0JBQ2QsRUFBRSxhQUFhLEVBQUUsRUFBRSxFQUFFLFdBQVcsRUFBRSxxQkFBcUIsRUFBRTthQUMxRDtTQUNGLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxHQUFHLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUU7WUFDdkQsY0FBYyxFQUFFLEdBQUcsT0FBTyxhQUFhO1lBQ3ZDLGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87WUFDeEMsYUFBYSxFQUFFLElBQUk7WUFDbkIsY0FBYyxFQUFFO2dCQUNkLEVBQUUsYUFBYSxFQUFFLEVBQUUsRUFBRSxXQUFXLEVBQUUscUJBQXFCLEVBQUU7YUFDMUQ7U0FDRixDQUFDLENBQUM7UUFFSCw2QkFBNkI7UUFDN0IsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxjQUFjLEVBQUU7WUFDdEMsS0FBSyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsYUFBYTtZQUNuQyxVQUFVLEVBQUUsR0FBRyxPQUFPLGVBQWU7U0FDdEMsQ0FBQyxDQUFDO1FBQ0gsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUU7WUFDcEMsS0FBSyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYTtZQUNqQyxVQUFVLEVBQUUsR0FBRyxPQUFPLGFBQWE7U0FDcEMsQ0FBQyxDQUFDO1FBQ0gsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUU7WUFDcEMsS0FBSyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYTtZQUNqQyxVQUFVLEVBQUUsR0FBRyxPQUFPLGFBQWE7U0FDcEMsQ0FBQyxDQUFDO1FBQ0gsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDdkMsS0FBSyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsYUFBYTtZQUNwQyxVQUFVLEVBQUUsR0FBRyxPQUFPLGdCQUFnQjtTQUN2QyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUFsRUQsa0NBa0VDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGVjciBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWNyJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFVhdEVjclN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIHJlYWRvbmx5IGVudk5hbWU6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIFVhdEVjclN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IG5naW54UmVwbzogZWNyLlJlcG9zaXRvcnk7XG4gIHB1YmxpYyByZWFkb25seSBiZmZSZXBvOiBlY3IuUmVwb3NpdG9yeTtcbiAgcHVibGljIHJlYWRvbmx5IGFwaVJlcG86IGVjci5SZXBvc2l0b3J5O1xuICBwdWJsaWMgcmVhZG9ubHkgbW9vZGxlUmVwbzogZWNyLlJlcG9zaXRvcnk7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFVhdEVjclN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IHsgZW52TmFtZSB9ID0gcHJvcHM7XG5cbiAgICAvLyBFQ1Ig44Gv55Kw5aKD44KS44G+44Gf44GE44Gn5YWx5pyJ5Y+v6IO944Gg44GM44CBVUFUIOeUqOOBq+eLrOeri+OBleOBm+OCi1xuICAgIHRoaXMubmdpbnhSZXBvID0gbmV3IGVjci5SZXBvc2l0b3J5KHRoaXMsICdOZ2lueFJlcG8nLCB7XG4gICAgICByZXBvc2l0b3J5TmFtZTogYCR7ZW52TmFtZX0tbW9vZGxlLW5naW54YCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBlbXB0eU9uRGVsZXRlOiB0cnVlLFxuICAgICAgbGlmZWN5Y2xlUnVsZXM6IFtcbiAgICAgICAgeyBtYXhJbWFnZUNvdW50OiAxMCwgZGVzY3JpcHRpb246ICdLZWVwIGxhc3QgMTAgaW1hZ2VzJyB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIHRoaXMuYmZmUmVwbyA9IG5ldyBlY3IuUmVwb3NpdG9yeSh0aGlzLCAnQmZmUmVwbycsIHtcbiAgICAgIHJlcG9zaXRvcnlOYW1lOiBgJHtlbnZOYW1lfS1tb29kbGUtYmZmYCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBlbXB0eU9uRGVsZXRlOiB0cnVlLFxuICAgICAgbGlmZWN5Y2xlUnVsZXM6IFtcbiAgICAgICAgeyBtYXhJbWFnZUNvdW50OiAxMCwgZGVzY3JpcHRpb246ICdLZWVwIGxhc3QgMTAgaW1hZ2VzJyB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIHRoaXMuYXBpUmVwbyA9IG5ldyBlY3IuUmVwb3NpdG9yeSh0aGlzLCAnQXBpUmVwbycsIHtcbiAgICAgIHJlcG9zaXRvcnlOYW1lOiBgJHtlbnZOYW1lfS1tb29kbGUtYXBpYCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBlbXB0eU9uRGVsZXRlOiB0cnVlLFxuICAgICAgbGlmZWN5Y2xlUnVsZXM6IFtcbiAgICAgICAgeyBtYXhJbWFnZUNvdW50OiAxMCwgZGVzY3JpcHRpb246ICdLZWVwIGxhc3QgMTAgaW1hZ2VzJyB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIHRoaXMubW9vZGxlUmVwbyA9IG5ldyBlY3IuUmVwb3NpdG9yeSh0aGlzLCAnTW9vZGxlUmVwbycsIHtcbiAgICAgIHJlcG9zaXRvcnlOYW1lOiBgJHtlbnZOYW1lfS1tb29kbGUtYXBwYCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBlbXB0eU9uRGVsZXRlOiB0cnVlLFxuICAgICAgbGlmZWN5Y2xlUnVsZXM6IFtcbiAgICAgICAgeyBtYXhJbWFnZUNvdW50OiAxMCwgZGVzY3JpcHRpb246ICdLZWVwIGxhc3QgMTAgaW1hZ2VzJyB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIE91dHB1dHMgKGRvY2tlciBwdXNoIOaZguOBq+S9v+eUqClcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnTmdpbnhSZXBvVXJpJywge1xuICAgICAgdmFsdWU6IHRoaXMubmdpbnhSZXBvLnJlcG9zaXRvcnlVcmksXG4gICAgICBleHBvcnROYW1lOiBgJHtlbnZOYW1lfS1OZ2lueFJlcG9VcmlgLFxuICAgIH0pO1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdCZmZSZXBvVXJpJywge1xuICAgICAgdmFsdWU6IHRoaXMuYmZmUmVwby5yZXBvc2l0b3J5VXJpLFxuICAgICAgZXhwb3J0TmFtZTogYCR7ZW52TmFtZX0tQmZmUmVwb1VyaWAsXG4gICAgfSk7XG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FwaVJlcG9VcmknLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hcGlSZXBvLnJlcG9zaXRvcnlVcmksXG4gICAgICBleHBvcnROYW1lOiBgJHtlbnZOYW1lfS1BcGlSZXBvVXJpYCxcbiAgICB9KTtcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnTW9vZGxlUmVwb1VyaScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLm1vb2RsZVJlcG8ucmVwb3NpdG9yeVVyaSxcbiAgICAgIGV4cG9ydE5hbWU6IGAke2Vudk5hbWV9LU1vb2RsZVJlcG9VcmlgLFxuICAgIH0pO1xuICB9XG59XG4iXX0=
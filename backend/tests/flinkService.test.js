import { beforeEach, describe, expect, it, jest } from '@/jest/globals';

const mockSuspend = jest.fn();
const mockResume = jest.fn();
const mockDelete = jest.fn();
const mockGetStatus = jest.fn();

jest.unstable_mockModule("../src/service/kubernetesService.js", () => ({
    suspendFlinkDeployment: mockSuspend,
    resumeFlinkDeployment: mockResume,
    deleteFlinkDeployment: mockDelete,
    getFlinkDeploymentStatus: mockGetStatus,
    createFlinkCluster: jest.fn(),
    patchFlinkDeployment: jest.fn(),
}));

const mockFindOne = jest.fn();
jest.unstable_mockModule("../src/models/index.js", () => ({
    Deployment: { findOne: mockFindOne },
    Jar: {},
}));
jest.unstable_mockModule("../src/models/flinkConfigModel.js", () => ({
    FlinkConfig: { findOne: jest.fn() },
}));
jest.unstable_mockModule("../src/config/database.js", () => ({
    default: { transaction: jest.fn() },
}));

jest.unstable_mockModule("../src/service/jarService.js", () => ({
    getJarById: jest.fn()
}));

const { stopDeployment, resumeDeployment, deleteDeployment, getDeployment } = await import("../src/service/flinkService.js");

// Minimal Sequelize model instance that mutates in place
function fakeDeployment(overrides = {}) {
    const deployment = {
        deploymentName: "my-job",
        namespace: "default",
        deploymentMode: "application",
        status: "running",
        pendingAction: null,
        errorMessage: null,
        ...overrides,
    };
    deployment.save = jest.fn(async () => deployment);
    deployment.toJSON = () => {
        const { save, toJSON, ...plain } = deployment;
        return { ...plain };
    };
    return deployment;
}

describe("FLinkService pendingAction lifecycle")
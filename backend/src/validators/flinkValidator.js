import Joi from 'joi';
import { ERROR_MESSAGES, REGEX } from '../utils/constants.js';



export const createDeploymentSchema = Joi.object({
    deploymentName: Joi.string()
      .pattern(REGEX.DNS_PATTERN).message(`deploymentName ${ERROR_MESSAGES.DNS_ERROR}`)
      .min(1).max(63).message('deploymentName must be 1-63 characters')
      .required(),
  
    namespace: Joi.string().pattern(REGEX.DNS_PATTERN).message(`namespace ${ERROR_MESSAGES.DNS_ERROR}`).optional(),
    jarName: Joi.string().pattern(REGEX.DNS_PATTERN).message(`jarName ${ERROR_MESSAGES.DNS_ERROR}`).optional(),
    jarId: Joi.number().integer().positive().optional(),
    environmentVariables: Joi.object().optional(),
    jobParallelism: Joi.number().integer().min(1).max(1024).optional(),
  
    config: Joi.object({
      image: Joi.string().optional(),
      flinkVersion: Joi.string().optional(),
      serviceAccount: Joi.string().optional(),
      jobManager: Joi.object({
        memory: Joi.string().pattern(REGEX.MEMORY_PATTERN).message(`jobManager.memory ${ERROR_MESSAGES.MEMORY_ERROR}`).optional(),
        cpu: Joi.number().min(0.1).max(32).optional(),
        replicas: Joi.number().integer().valid(1).optional()
          .messages({ 'any.only': 'jobManager.replicas must be 1' })
      }).optional(),
      taskManager: Joi.object({
        memory: Joi.string().pattern(REGEX.MEMORY_PATTERN).message(`taskManager.memory ${ERROR_MESSAGES.MEMORY_ERROR}`).optional(),
        cpu: Joi.number().min(0.1).max(32).optional(),
        replicas: Joi.number().integer().min(1).max(100).optional(),
        taskSlots: Joi.number().integer().min(1).max(32).optional()
      }).optional(),
      flinkConfiguration: Joi.object().optional()
    }).optional()
  });

export const updateDeploymentSchema = Joi.object({
  // namespace has been intentionally excluded from updates because it is immutable in K8s. Resources cannot be moved between namespaces
  // flinkVersion has been intentionally excluded from updates because it requires full pod teardown / recreate; delete + create should be used instead
  // serviceAccount has been intentionally excluded from updates due to security-sensitive identity binding. It should be immutable after creating
  // deploymentName has been intentionally excluded from updates because it is the PK in the database. CHanging it would orphan the K8s object
  // Fields such as deploymentMode, jarName, jarId, and programArgs all define the job type. Changing it requires a new deployment
  environmentVariables: Joi.object().optional(),
  jobParallelism: Joi.number().integer().min(1).max(1024).optional(),
  config: Joi.object({
    image: Joi.string().optional(),
    jobManager: Joi.object({
      memory: Joi.string().pattern(REGEX.MEMORY_PATTERN).message(`jobManager.memory ${ERROR_MESSAGES.MEMORY_ERROR}`).optional(),
      cpu: Joi.number().min(0.1).max(32).optional(),
      replicas: Joi.number().integer().valid(1).optional().messages({ 'any.only': 'jobManaager.replicas must be 1' }),
    }).optional(),
    taskManager: Joi.object({
      memory: Joi.string().pattern(REGEX.MEMORY_PATTERN).message(`taskManager.memory ${ERROR_MESSAGES.MEMORY_ERROR}`).optional(),
      cpu: Joi.number().min(0.1).max(32).optional(),
      replicas: Joi.number().integer().min(1).max(100).optional(),
      taskSlots: Joi.number().integer().min(1).max(32).optional()
    }).optional(),
    flinkConfiguration: Joi.object().optional(),
  }).optional(),
}).min(1);

import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import { FLINK_MODE, DEPLOYMENT_STATUS } from '../utils/constants.js';

const Deployment = sequelize.define('Deployment', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      deploymentName: {
        type: DataTypes.STRING(63),// Kubernetes character limit 
        allowNull: false,
        unique: true,
        field: 'deployment_name',
        validate: {
          is: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/  
        }
      },
      namespace: {
        type: DataTypes.STRING(63), // Kubernetes character limit 
        allowNull: false,
        defaultValue: 'tic4902',
        validate: {
            is: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/  
        }
      },
      status: {
        type: DataTypes.ENUM(...Object.values(DEPLOYMENT_STATUS)),
        allowNull: false,
        defaultValue: 'creating'
      },
      config: {
        type: DataTypes.JSONB,
        allowNull: false
      },
      resources: {
        type: DataTypes.JSONB,
        allowNull: true
      },
      errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'error_message'
      },
      deploymentMode: {
        type: DataTypes.ENUM(...Object.values(FLINK_MODE)),
        allowNull: false,
        defaultValue: FLINK_MODE.SESSION,
        field: 'deployment_mode'
      },
      jarId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'jarId',
        references: { model: 'flink_jars', key: 'id' }
      },
      environmentVariables: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'environment_variables'
      },
      jobParallelism: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'job_parallelism',
        validate: {
          min: 1
        }
      },
      // Track an in-flight lifecycle action (stop/force-stop/resume/delete) independently of 'status'
      // 'status' reflects the last known K8s state
      // 'pendingAction' is what the user most recently asked for and is still waiting on
      // this is what lets us block concurrent/conflicting actions (e.g. stop while deleting) reliably and what the frontend uses to show a spinner instead of a stale or flickering status
      pendingAction: {
        type: DataTypes.ENUM('stop', 'force_stop', 'resume', 'delete'),
        allowNull: true,
        field: 'pending_action'
      },
      stateBucketName: {
        type: DataTypes.STRING(63),
        allowNull: true,
        field: 'state_bucket_name'
      },
      lastSavepointPath: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'last_savepoint_path'
      }
}, {
    tableName: 'flink_deployments',
    validate: {
        applicationRequiresJar() {
          if (!this.isNewRecord && !this.changed('deploymentMode') && !this.changed('jarId')) {
            return;
          }
          if (this.deploymentMode === 'application' && !this.jarId) {
            throw new Error('Application mode deployments require a JAR reference');
          }
        }
      }
});

export default Deployment;
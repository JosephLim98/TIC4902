import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

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
        defaultValue: 'default',
        validate: {
            is: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/  
        }
      },
      status: {
        type: DataTypes.ENUM('creating', 'running', 'failed', 'deleting', 'deleted'),
        allowNull: false,
        defaultValue: 'creating'
      },
      config: {
        type: DataTypes.JSONB,
        allowNull: false
      },
      reosurces: {
        type: DataTypes.JSONB,
        allowNull: true
      },
      errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'error_message'
      },
      deploymentMode: {
        type: DataTypes.ENUM('session', 'application'),
        allowNull: false,
        defaultValue: 'session',
        field: 'deployment_mode'
      },
      jarId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'jar_id'
        //TODO: Add reference to jar here
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
      }
}, {
    tableName: 'flink_deployments',
    validate: {
        applicationRequiresJar() {
          if (this.deploymentMode === 'application' && !this.jarId) {
            throw new Error('Application mode deployments require a JAR reference');
          }
        }
      }
});

export default Deployment;
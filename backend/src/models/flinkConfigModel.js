import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const FlinkConfig = sequelize.define('FlinkConfig', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  image: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  flinkVersion: {
    type: DataTypes.STRING(20),
    allowNull: false,
    field: 'flink_version'
  },
  serviceAccount: {
    type: DataTypes.STRING(63),
    allowNull: false,
    field: 'service_account'
  },
  namespace: {
    type: DataTypes.STRING(63),
    allowNull: false
  },
  jobManagerMemory: {
    type: DataTypes.STRING(20),
    allowNull: false,
    field: 'job_manager_memory'
  },
  jobManagerCpu: {
    type: DataTypes.DECIMAL(4, 2),
    allowNull: false,
    field: 'job_manager_cpu'
  },
  jobManagerReplicas: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    field: 'job_manager_replicas'
  },
  taskManagerMemory: {
    type: DataTypes.STRING(20),
    allowNull: false,
    field: 'task_manager_memory'
  },
  taskManagerCpu: {
    type: DataTypes.DECIMAL(4, 2),
    allowNull: false,
    field: 'task_manager_cpu'
  },
  taskManagerReplicas: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'task_manager_replicas'
  },
  taskManagerSlots: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'task_manager_slots'
  }
}, {
  tableName: 'flink_config',
  timestamps: true,
  underscored: true
});

export { FlinkConfig };

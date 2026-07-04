import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Savepoint = sequelize.define('Savepoint', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  deploymentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'deployment_id',
    references: { model: 'flink_deployments', key: 'id' },
  },
  path: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  source: {
    type: DataTypes.ENUM('manual', 'stop'),
    allowNull: false,
  },
}, {
  tableName: 'flink_savepoints',
  indexes: [
    { fields: ['deployment_id', 'created_at'] },
    { unique: true, fields: ['deployment_id', 'path'] },
  ],
});

export default Savepoint;

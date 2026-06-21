import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Jar = sequelize.define('Jar', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  objectName: {
    type: DataTypes.STRING(512),
    allowNull: false,
    unique: true,
    field: 'object_name',
  },
  sizeBytes: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'size_bytes',
  },
  uploadedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'uploaded_by',
  },
}, {
  tableName: 'flink_jars',
  underscored: true,
  timestamps: true,
  paranoid: true,
});

export default Jar;

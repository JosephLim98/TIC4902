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
  // Optional fully-qualified main/entry class. Some JARs declare this in
  // their own manifest (Main-Class) and Flink picks it up automatically —
  // this field is only needed for JARs that don't (e.g. Flink's own
  // WordCount example), so the user can supply it explicitly at upload time.
  entryClass: {
    type: DataTypes.STRING(512),
    allowNull: true,
    field: 'entry_class',
  },
}, {
  tableName: 'flink_jars',
  underscored: true,
  timestamps: true,
  paranoid: true,
});

export default Jar;
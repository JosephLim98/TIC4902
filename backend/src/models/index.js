import Deployment from './deploymentModel.js';
import { FlinkConfig } from './flinkConfigModel.js';
import Jar from './jarModel.js';
import Savepoint from './savepointModel.js';

Jar.hasMany(Deployment, { foreignKey: 'jarId', as: 'deployments' });
Deployment.belongsTo(Jar, { foreignKey: 'jarId', as: 'jar' });

Deployment.hasMany(Savepoint, { foreignKey: 'deploymentId', as: 'savepoints', onDelete: 'CASCADE' });
Savepoint.belongsTo(Deployment, { foreignKey: 'deploymentId', as: 'deployment' });

export { Deployment, FlinkConfig, Jar, Savepoint };
import Deployment from './deploymentModel.js';
import { FlinkConfig } from './flinkConfigModel.js';
import Jar from './jarModel.js';

Jar.hasMany(Deployment, { foreignKey: 'jarId', as: 'deployments' });
Deployment.belongsTo(Jar, { foreignKey: 'jarId', as: 'jar' });

export { Deployment, FlinkConfig, Jar };
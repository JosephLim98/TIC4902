import { Sequelize } from 'sequelize'
import logger from '../utils/logger.js';


const sequelize = new Sequelize({
    dialect: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'example',
    database: process.env.DB_NAME || 'TIC4902_DB',
    pool: {
      max: parseInt(process.env.DB_POOL_MAX || '20', 10),
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    logging: (msg) => logger.debug(msg),
    define: {
      underscored: true,     
      freezeTableName: true,  
      timestamps: true,    
      paranoid: true          
    }
  });


  export async function testConnection() {
    try {
      await sequelize.authenticate();
      logger.info('Database connection established');
      return true;
    } catch (error) {
      logger.error('Database connection failed', { error: error.message });
      throw error;
    }
  }

  export async function initializeDatabase() {
    try {
      const { FlinkConfig } = await import('../models/index.js');
      // Sync all models
      await sequelize.sync({ alter: false });
      logger.info('Database schema synchronized');
      
      await seedFlinkConfig(FlinkConfig);

      return true;
    } catch (error) {
      logger.error('Database initialization failed', { error: error.message });
      throw error;
    }
  }

  async function seedFlinkConfig(FlinkConfig) {
    const count = await FlinkConfig.count();
    
    if (count === 0) {
      await FlinkConfig.create({
        image: 'flink:1.19',
        flinkVersion: 'v1_19',
        serviceAccount: 'flink',
        namespace: 'default',
        jobManagerMemory: '1024m',
        jobManagerCpu: 0.5,
        jobManagerReplicas: 1,
        taskManagerMemory: '1024m',
        taskManagerCpu: 0.5,
        taskManagerReplicas: 1,
        taskManagerSlots: 1
      });
      logger.info('Seeded default Flink configuration');
    }
  }

export default sequelize;
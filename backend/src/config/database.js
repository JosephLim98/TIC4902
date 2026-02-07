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
      // Import models
      await import('../models/index.js');
      
      // Sync all models
      await sequelize.sync({ alter: false });
      
      logger.info('Database schema synchronized');
      return true;
    } catch (error) {
      logger.error('Database initialization failed', { error: error.message });
      throw error;
    }
  }
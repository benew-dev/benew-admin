import winston from 'winston';

// Création d'un logger structuré
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info', // Niveau par défaut : info
  defaultMeta: { service: 'api-services' },
});

export default logger;

import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import express from 'express';
import path from 'path';

import { fileURLToPath } from 'url';

// Resolve __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'E-Voting API',
            version: '1.0.0',
            description: 'API documentation for the E-Voting application',
        },
        servers: [
            {
                url: 'http://localhost:8000/evoting/api/v1',
                description: 'Local server',
            },
        ],
    },
    apis: [path.join(__dirname, '../openapi.yaml')], // Correct path to the API docs
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

export default app;

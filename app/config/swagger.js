#!/usr/bin/env node
/**
 * Swagger Configuration
 * 
 * OpenAPI 3.0 configuration for the ITFY E-Voting System API
 */

import swaggerJSDoc from 'swagger-jsdoc';
import YAML from 'yamljs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load the comprehensive OpenAPI YAML specification
const openApiSpec = YAML.load(join(__dirname, 'openapi.yaml'));

const options = {
    definition: openApiSpec,
    apis: [
        './app/routes/v1/*.js', 
        './app/routes/**/*.js',
        './app/controllers/*.js'
    ],
};

const specs = swaggerJSDoc(options);

export default specs;

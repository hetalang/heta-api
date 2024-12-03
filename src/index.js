const express = require('express');
const OpenApiValidator = require('express-openapi-validator');
const app = express();

const emptyRoutes = require('./empty');
const buildRoutes = require('./build');

app.use(express.json());

// Load OpenAPI schema
app.use(
    OpenApiValidator.middleware({
      apiSpec: './heta-api-schema.json',
      validateRequests: true, // (default)
      //validateResponses: true, // good for debugging
    }),
);

// Register routes
app.use('/', emptyRoutes);
app.use('/build', buildRoutes);

app.use((err, req, res, next) => {
  // dev mode
  throw err;

  // production mode
  res.status(err.status || 500).json({
    message: 'Internal server error, contact the developers.'
  });
});

app.listen(3000, () => console.log('API running on http://localhost:3000'));

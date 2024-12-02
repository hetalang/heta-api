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
      validateResponses: true, // false by default
    }),
);

app.use((err, req, res, next) => {
  // format error
  res.status(err.status || 500).json({
    message: err.message,
    errors: err.errors,
  });
});

// Register routes
app.use('/', emptyRoutes);
app.use('/build', buildRoutes);

app.listen(3000, () => console.log('API running on http://localhost:3000'));

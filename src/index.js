const express = require('express');
const OpenApiValidator = require('express-openapi-validator');
const app = express();

const fs = require('fs');

require('dotenv').config();

// directory to store files
const FILES = process.env.FILES;

// empty content if exists or create
if (fs.existsSync(FILES)) {
    fs.rmSync(FILES, { recursive: true });
}
fs.mkdirSync(FILES);

const emptyRoutes = require('./empty');
const buildRoutes = require('./build');
const filesRoutes = require('./files');

app.use(express.json());
// Load OpenAPI schema

app.use(
    OpenApiValidator.middleware({
      apiSpec: __dirname + '/../heta-api-schema.json',
      validateRequests: true, // (default)
      //validateResponses: true, // good for debugging
    }),
);

// Register routes
app.use('/', emptyRoutes);
app.use('/build', buildRoutes);
app.use('/files', filesRoutes);

app.use((err, req, res, next) => {
  // dev mode
  //throw err;

  // error because of wrong input
  if (err.status === 400) {
    res.status(err.status).json({
      name: err.name,
      message: err.message,
      errors: err.errors,
    });
    return;
  }

  // access denied
  if (err.status === 403) {
    console.warn(`Unauthorized access attempt: ${err.absolutePath}`);
    res.status(err.status).json({
      message: err.message
    });
    return;
  }

  // other errors
  res.status(err.status || 500).json({
    message: err.message,
    errors: err.errors,
  });
});

app.listen(3000, () => console.log('API running on http://localhost:3000'));

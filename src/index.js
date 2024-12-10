const express = require('express');
const OpenApiValidator = require('express-openapi-validator');
const app = express();

const fs = require('fs');
const path = require('path');

// directory to store files
const { FILES, PORT } = process.env;

// empty content if exists or create
if (fs.existsSync(FILES)) {
    fs.rmSync(FILES, { recursive: true });
}
fs.mkdirSync(FILES);

const infoRoutes = require('./info');
const buildRoutes = require('./build');
const downloadRoutes = require('./download');
const schemaRoutes = require('./schema');

app.use(express.json());
// Load OpenAPI schema

// collect minimal information
app.use((req, res, next) => {
  // for additional information about the request
  // see also 'ua-parser-js'
  // const userAgent = req.headers['user-agent']; 

  // collect information about the request
  console.log(`Request: ${req.method} ${req.originalUrl} from ${req.ip} at ${new Date().toISOString()}`);

  next();
});

app.use(
    OpenApiValidator.middleware({
      apiSpec: __dirname + '/../heta-api-schema.json',
      validateRequests: true, // (default)
      //validateResponses: true, // good for debugging
    }),
);

// Register routes
app.use('/info', infoRoutes);
app.use('/build', buildRoutes);
app.use('/download', downloadRoutes);
app.use('/schema', schemaRoutes);

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
  console.error(`Error: ${err.message}`);
  res.status(err.status || 500).json({
    message: err.message,
    errors: err.errors,
  });
});

let filesAbsolutePath = path.resolve(FILES);
app.listen(PORT || 3000, () => console.log(`API running on http://localhost:${PORT || 3000} with storage in "${filesAbsolutePath}"`));

const express = require('express');
const OpenApiValidator = require('express-openapi-validator');
const { version } = require('heta-compiler/package.json');

const app = express();

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

app.get('/', (req, res) => {
    res.send({
        description: "API connector for Heta compiler",
        version: version,
        node: process.version
    })
});

app.listen(3000, () => console.log('API running on http://localhost:3000'));

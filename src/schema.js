const express = require('express');
const schemaJSON = require('../heta-api-schema.json');

const router = express.Router();

router.get('/', (req, res) => {
  res.send(schemaJSON);
});

module.exports = router;

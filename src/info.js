const express = require('express');
const { version } = require('heta-compiler/package');

const router = express.Router();

router.get('/', (req, res) => {
  res.send({
    description: 'API connector for Heta compiler',
    version: version,
    node: process.version,
    schema: '/schema'
  });
});

module.exports = router;

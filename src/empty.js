const express = require('express');
const { version } = require('heta-compiler/package.json');

const router = express.Router();

router.get('/', (req, res) => {
  res.send({
    description: 'API connector for Heta compiler',
    version: version,
    node: process.version,
  });
});

module.exports = router;

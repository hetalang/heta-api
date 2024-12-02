const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { Builder } = require('heta-compiler');

const router = express.Router();

router.post('/', (req, res) => {
    const uuid = uuidv4();
    const reqTime = new Date();
    console.log(req.body);

    // draft code
    res.send({
        statusCode: 0,
        status: 'Compilation OK!',
        filepaths: [],
        taskId: uuid,
        lifeend: [] // wrong result
    });
});

module.exports = router;

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { Builder, StringTransport, HetaLevelError } = require('heta-compiler');
const fs = require('fs-extra');
const path = require('path');
const YAML = require('js-yaml');

// directory to store files
const FILES = 'files';
// empty content if exists or create
if (fs.existsSync(FILES)) {
    fs.rmSync(FILES, { recursive: true });
}
fs.mkdirSync(FILES);

const router = express.Router();

router.post('/', (req, res) => {
    let apiOptions = req.body || {};

    // create directory for the task
    const uuid = uuidv4();
    const taskDir = path.join(FILES, uuid);
    fs.mkdirSync(taskDir);

    // copy files to the task directory
    // {filpath: 'path/to/file', format: 'binary', filebody: 'content'}
    apiOptions.files?.forEach((file) => {
        const filepath = path.join(taskDir, file.filepath);
        // write file and create directories if not exist
        fs.outputFileSync(filepath, file.filebody, file.format);
    });

    // storage for logs
    // items as strings
    let apiLogs = [];

    // run build job
    try {
        var builder = main(apiOptions, taskDir, apiLogs);
    } catch (error) {
        // delete task directory
        fs.rmSync(taskDir, { recursive: true });

        // handle errors
        if (error.name === 'BuildLevelError' || error.name === 'HetaLevelError') {
            apiLogs.push(error.message);
            apiLogs.push('STOP!');
            res.status(400).send({
                logs: apiLogs,
            });
            return;
        } else {
            throw error;
        }
    }

    // return response
    if (builder.container.hetaErrors().length > 0) {
        apiLogs.push('Compilation finished but with errors! See logs.');
    } else {
        apiLogs.push('Compilation OK!');
    }

    // calculate time to delete
    const currentTime = Math.floor(Date.now() / 1000);
    const deleteTime = currentTime + apiOptions.lifetime;
    // delete task directory after lifeTime
    setTimeout(() => {
        fs.rmSync(taskDir, { recursive: true });
    }, apiOptions.lifetime * 1000);

    

    res.send({
        filepaths: [],
        taskId: uuid,
        lifeend: deleteTime, // in seconds
        logs: apiLogs,
    });
});

// like code 2 in /bin/heta-build.js
class BuildLevelError extends Error {
    constructor(message) {
      super(message);
      this.name = 'BuildLevelError';
    }
}

function main(apiOptions, targetDir, logs) {
    // 0. empty declaration
    let declaration = {options: {}, importModule: {}, export: []};

    // 1. declaration from file
    // search
    let searches = ['', '.json', '.yml']
        .map((ext) => path.join(targetDir, (apiOptions.declaration || 'platform') + ext));
    let extensionNumber = searches
        .map((x) => fs.existsSync(x) && fs.statSync(x).isFile() ) // check if it exist and is file
        .indexOf(true);
    // is declaration file found ?
    if (!apiOptions.declaration && extensionNumber === -1) {
        logs.push('No declaration file, running with defaults...');
    } else if (extensionNumber === -1) {
        throw new BuildLevelError(`Declaration file "${apiOptions.declaration}" not found. STOP!`);
    } else {
        let declarationFile = searches[extensionNumber];
        logs.push(`Running compilation with declaration file "${path.resolve(declarationFile)}"...`);
        let declarationText = fs.readFileSync(declarationFile);
        try {
            let declarationFromFile = YAML.load(declarationText);
            if (typeof declarationFromFile !== 'object'){
                throw new Error('Not an object.');
            }
            Object.assign(declaration, declarationFromFile);
        } catch (error) {
            throw new BuildLevelError(`Wrong format of declaration file: \n"${error.message}"`);
        }
    }

    // 2. declaration from cli
    // update declaration
    apiOptions.unitsCheck !== undefined && (declaration.options.unitsCheck = apiOptions.unitsCheck);
    apiOptions.logMode !== undefined && (declaration.options.logMode = apiOptions.logMode);
    apiOptions.debug !== undefined && (declaration.options.debug = apiOptions.debug);
    apiOptions.distDir !== undefined && (declaration.options.distDir = apiOptions.distDir);
    apiOptions.metaDir !== undefined && (declaration.options.metaDir = apiOptions.metaDir);
    apiOptions.source !== undefined && (declaration.importModule.source = apiOptions.source);
    apiOptions.type !== undefined && (declaration.importModule.type = apiOptions.type);
    apiOptions.export !== undefined && (declaration.export = apiOptions.export);

    // 3. run builder (set declaration defaults internally)
    let builder = new Builder(
        declaration,
        targetDir,
        fs.readFileSync,
        fs.outputFileSync,
        [new StringTransport('info', logs)]
    ).run();

    return builder;
}

module.exports = router;

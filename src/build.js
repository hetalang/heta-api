const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { Builder, StringTransport } = require('heta-compiler');
const fs = require('fs-extra');
const path = require('path');
const YAML = require('js-yaml');

// directory to store files
const FILES = process.env.FILES;

const router = express.Router();

router.post('/', (req, res) => {
    let apiOptions = req.body || {};

    // create directory for the task
    const uuid = uuidv4();
    const basePath = path.resolve(FILES, uuid);
    fs.mkdirSync(basePath);

    // create filepaths
    let filepaths = [];

    // copy files to the task directory
    // {filpath: 'path/to/file', format: 'binary', filebody: 'content'}
    apiOptions.files?.forEach((file) => {
        const filepath = path.resolve(basePath, file.filepath);
        
        // check the user in allowed directory
        if (!filepath.startsWith(basePath)) {
            let err = new Error(`Access denied for ${file.filepath}.`);
            err.status = 403;
            err.absolutePath = filepath;
            throw err;
        }

        // write file and create directories if not exist
        fs.outputFileSync(filepath, file.filebody, file.format);
        filepaths.push(file.filepath);
    });

    // calculate time to delete
    const currentTime = Math.floor(Date.now() / 1000);
    const lifetime = apiOptions.lifetime || 3600;
    const deleteTime = currentTime + lifetime;
    // delete task directory after lifeTime
    setTimeout(() => {
        fs.rmSync(basePath, { recursive: true });
    }, lifetime * 1000);

    // storage for logs
    // items as strings
    let apiLogs = [];

    // run build job
    try {
        var builder = main(apiOptions, basePath, apiLogs, filepaths);
    } catch (error) {
        // handle errors
        if (error.name === 'BuildLevelError' || error.name === 'HetaLevelError') {
            apiLogs.push(error.message);
            apiLogs.push('STOP!');
            res.status(422).send({ // same structure as 200
                filepaths: filepaths,
                taskId: uuid,
                lifeend: deleteTime, // in seconds
                logs: apiLogs,
                downloadLink: `/files/${uuid}`,
            });
            return; // BREAK
        } else {
            // delete task directory
            fs.rmSync(basePath, { recursive: true });
            throw error;
        }
    }

    // return response
    if (builder.container.hetaErrors().length > 0) {
        apiLogs.push('Compilation finished but with errors! See logs.');
    } else {
        apiLogs.push('Compilation OK!');
    }

    res.send({
        filepaths: filepaths,
        taskId: uuid,
        lifeend: deleteTime, // in seconds
        logs: apiLogs,
        downloadLink: `/files/${uuid}`,
    });
});

// like code 2 in /bin/heta-build.js
class BuildLevelError extends Error {
    constructor(message) {
      super(message);
      this.name = 'BuildLevelError';
    }
}

function main(apiOptions, targetDir, logs, filepaths) {
    // 0. empty declaration
    let declaration = {options: {}, importModule: {}, export: []};

    // 1. declaration from file
    // search
    let searches = ['', '.json', '.yml']
        .map((ext) => (apiOptions.declaration || 'platform') + ext);
    let extensionNumber = searches
        .map((filename) => path.join(targetDir, filename))
        .map((x) => fs.existsSync(x) && fs.statSync(x).isFile() ) // check if it exist and is file
        .indexOf(true);
    // is declaration file found ?
    if (!apiOptions.declaration && extensionNumber === -1) {
        logs.push('No declaration file, running with defaults...');
    } else if (extensionNumber === -1) {
        throw new BuildLevelError(`Declaration file "${apiOptions.declaration}" not found. STOP!`);
    } else {
        let declarationFile = searches[extensionNumber];
        logs.push(`Running compilation with declaration file "${declarationFile}"...`);
        let declarationText = fs.readFileSync(path.join(targetDir, declarationFile));
        try {
            let declarationFromFile = YAML.load(declarationText);
            if (typeof declarationFromFile !== 'object'){
                throw new Error('Declaration file content must be an object.');
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
    // helper function to store  all saved files paths
    // !!! do not allow to work outside targetDir
    myOutputFileSync = (...args) => {
        let absolutePath = path.resolve(args[0]);
        let relativePath = path.relative(targetDir, args[0])

        // check the user in allowed directory
        if (!absolutePath.startsWith(targetDir)) {
            let err = new Error(`Access denied for ${relativePath}.`);
            err.status = 403;
            err.absolutePath = absolutePath;
            throw err;
        }
        
        let result = fs.outputFileSync(...args);
        
        filepaths.push(relativePath);

        return result;
    };

    myInputFileSync = (...args) => {
        let absolutePath = path.resolve(args[0]);
        let relativePath = path.relative(targetDir, args[0])

        // check the user in allowed directory
        if (!absolutePath.startsWith(targetDir)) {
            let err = new Error(`Access denied for ${relativePath}.`);
            err.status = 403;
            err.absolutePath = absolutePath;
            throw err;
        }

        return fs.readFileSync(...args);
    };

    let builder = new Builder(
        declaration,
        targetDir,
        myInputFileSync,
        myOutputFileSync,
        [new StringTransport('info', logs)]
    ).run();

    return builder;
}

module.exports = router;

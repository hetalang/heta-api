const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { Builder, StringTransport } = require('heta-compiler');
const fs = require('fs-extra');
const path = require('path');
//const YAML = require('js-yaml');

// directory to store files
const FILES = process.env.FILES;
// This should be taken from request but i don't know how to do it
const url = 'https://heta-api.insysbio.com'; 

const router = express.Router();

router.post('/', (req, res) => {
    let apiOptions = req.body || {};

    // create directory for the task
    const uuid = uuidv4();
    const basePath = path.resolve(FILES, uuid);
    fs.mkdirSync(basePath);

    // create storage for files
    let outputFiles = [];

    // copy files to the task directory
    // {filpath: 'path/to/file', format: 'binary', filebody: 'content'}
    apiOptions.inputFiles?.forEach((file) => {
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
        // uncomment it to send inputs back
        //outputFiles.push(file); 
    });

    // calculate time to delete
    const currentTime = Math.floor(Date.now() / 1000);
    const lifetime = apiOptions.lifetime;
    const deleteTime = currentTime + lifetime;

    // storage for logs
    // items as strings
    let apiLogs = [];

    // run build job
    try {
        var builder = main(apiOptions.declaration || {}, basePath, apiLogs, outputFiles);
    } catch (error) {
        // handle errors
        if (error.name === 'BuildLevelError' || error.name === 'HetaLevelError') {
            apiLogs.push(error.message);
            apiLogs.push('STOP!');
            
            !!lifetime && apiLogs.push(`Your files will be available on ${url}/files/${uuid} for ${lifetime} seconds.`);
            res.status(422).send({ // same structure as 200
                outputFiles: outputFiles,
                taskId: uuid,
                lifeend: deleteTime, // in seconds
                logs: apiLogs,
                downloadLink: `/download/${uuid}`,
                filesLink: `/files/${uuid}`,
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

    !!lifetime && apiLogs.push(`Your files will be available on ${url}/files/${uuid} for ${lifetime} seconds.`);
    res.send({
        outputFiles: outputFiles,
        taskId: uuid,
        lifeend: deleteTime, // in seconds
        logs: apiLogs,
        downloadLink: `/download/${uuid}`,
        filesLink: `/files/${uuid}`,
    });

    // delete task directory after lifeTime
    setTimeout(() => {
        fs.rmSync(basePath, { recursive: true });
    }, lifetime * 1000);
});

// like code 2 in /bin/heta-build.js
class BuildLevelError extends Error {
    constructor(message) {
      super(message);
      this.name = 'BuildLevelError';
    }
}

// take declaration and run build
function main(declaration, targetDir, logs, outputFiles) {
    // declaration file is not used in API but it generated from apiOptions
    logs.push(`Running compilation with declaration file "platform.yml"...`);    

    // save declaration file
    let declarationPath = path.resolve(targetDir, 'platform.yml');
    let declarationJSON = JSON.stringify(declaration, null, 2);
    fs.outputFileSync(declarationPath, declarationJSON); // YAML.dump(declaration)
    outputFiles.push({filepath: 'platform.yml', type: 'utf8', filebody: declarationJSON});
    
    // helper function to store  all saved files paths
    const myOutputFileSync = (...args) => {
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
        let binaryString = args[1].toString('binary');
        
        outputFiles.push({filepath: relativePath, type: 'binary', filebody: binaryString});

        return result;
    };

    const myInputFileSync = (...args) => {
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

    // run builder (set declaration defaults internally)
    process.chdir(targetDir);
    let builder = new Builder(
        declaration,
        myInputFileSync,
        myOutputFileSync,
        [new StringTransport('info', logs)]
    ).run();
    process.chdir(path.join(__dirname, '..')); // return to the original directory, project root

    return builder;
}

module.exports = router;

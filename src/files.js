const express = require('express');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver'); // To zip multiple files

// directory to store files
const FILES = 'files';

const router = express.Router();

// wildcard is not supported by OpenAPI, so we need to use paths: src%2Findex.heta instead of src/index.heta
// the alternative solution is to use a query parameter, e.g. /files/xxx-xxx-xxx?filepath=src/index.heta, but it has not been implemented here
router.get('/:taskId/*', (req, res) => {
    const { taskId } = req.params;
    const filepath = req.params[0];
    
    // Base and resolved path
    const basePath = path.resolve(FILES, taskId);
    const absolutePath = path.resolve(basePath, filepath);

    // check the user in allowed directory
    if (!absolutePath.startsWith(basePath)) {
        console.warn(`Unauthorized access attempt: ${absolutePath}`);
        res.status(403).json({
            message: 'Access denied.'
        });
        return;
    }
    
    if (!fs.existsSync(absolutePath)) {
        res.status(404).json({
            message: 'File not found.'
        });
        return; // BREAK
    }

    res.download(absolutePath, path.basename(filepath), (err) => {
        err && res.status(500).json({
            message: 'Failed to send the file.'
        });
    });
});

router.get('/:taskId', (req, res) => {
    const { taskId } = req.params;
    const taskDir = path.join(FILES, taskId);

    if (!fs.existsSync(taskDir)) {
        res.status(404).json({
            message: 'Task not found.'
        });
        return; // BREAK
    }

    let selectedFiles = getFilesRecursivelySync(taskDir);

    // prepare headers
    res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${taskId}.zip"`,
    });

    // preparing archive
    const archive = archiver('zip');
    archive.on('error', (err) => {
        res.status(500).send({
            message: err.message 
        });
    });
    archive.pipe(res);
    selectedFiles.forEach((file) => {
        archive.file(file, { name: path.relative(taskDir, file) });
    });
    archive.finalize();
});

function getFilesRecursivelySync(dirPath) {
    let files = [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        // If entry is a directory, recursively fetch its files
        files = files.concat(getFilesRecursivelySync(fullPath));
      } else if (entry.isFile()) {
        // If entry is a file, add it to the list
        files.push(fullPath);
      }
    }
  
    return files;
}

module.exports = router;
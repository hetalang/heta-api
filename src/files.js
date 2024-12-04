const express = require('express');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver'); // To zip multiple files

// directory to store files
const FILES = 'files';

const router = express.Router();

router.get('/:taskId/*', (req, res) => {
    const { taskId } = req.params;
    const filepath = req.params[0];
    const absolutePath = path.join(FILES, taskId, filepath);
    
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
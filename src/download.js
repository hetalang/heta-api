const express = require('express');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver'); // To zip multiple files

// directory to store files
const FILES = process.env.FILES;

const router = express.Router();

// downoad everything as ZIP
// /files/xxx-xxx-xxx
router.get('/:taskId', (req, res) => {
    const { taskId } = req.params;

    const basePath = path.resolve(FILES, taskId);

    if (!fs.existsSync(basePath)) {
        res.status(404).json({
            message: 'Task not found.'
        });
        return; // BREAK
    }

    let selectedFiles = getFilesRecursivelySync(basePath);

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
        archive.file(file, { name: path.relative(basePath, file) });
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
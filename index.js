#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import archiver from 'archiver'
import fse from 'fs-extra'
import { globby } from 'globby'
import os from 'os'
import { v4 as uuidv4 } from 'uuid'


const currentDirName = path.basename(process.cwd())

// Define the output ZIP file path
const outputZipName = `${currentDirName}.zip`
const outputZipPath = path.resolve(outputZipName)


function readWhitelistFile() {
  // Read the whitelist file (.zipinclude)
  const whitelistPath = path.resolve('.zipinclude')
  
  if (!fs.existsSync(whitelistPath)) {
    console.error('.zipinclude FILE NOT FOUND.')
    process.exit(1)
  }
  
  const content = fs.readFileSync(whitelistPath, 'utf8')
  const lines = content.split('\n')
  
  const patterns = lines
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#')); // Exclude empty lines and comments
  
  return patterns
}


async function getFilesToInclude(patterns) {
  // Use globby to match files based on patterns in the whitelist
  const files = await globby(patterns, {
    dot: true,
    followSymbolicLinks: false,
  })
  return files
}


(async () => {
  // Read the whitelist patterns from .zipinclude
  const patterns = readWhitelistFile()
  
  // Get the list of files to include
  const filesToInclude = await getFilesToInclude(patterns)
  
  if (filesToInclude.length === 0) {
    console.error('No files found to include in the ZIP archive based on .zipinclude.')
    process.exit(1)
  }
  
  // Generate a unique temporary directory
  const tempDir = path.join(os.tmpdir(), 'ziptemp-' + uuidv4())
  
  // Create the temporary directory
  fse.ensureDirSync(tempDir)
  
  // Copy the files to the temporary directory
  for (const relativeFilePath of filesToInclude) {
    const absoluteFilePath = path.resolve(relativeFilePath)
    const destPath = path.join(tempDir, relativeFilePath)
    
    // Ensure the destination directory exists
    fse.ensureDirSync(path.dirname(destPath))
    
    try {
      await fse.copy(absoluteFilePath, destPath)
    } catch (err) {
      console.error(`Error copying ${absoluteFilePath} to ${destPath}:`, err)
    }
  }
  
  const output = fs.createWriteStream(outputZipPath)
  const archive = archiver('zip', {
    zlib: { level: 9 }, // Sets the compression level
  })
  
  output.on('close', function () {
    console.log(`Deployment package created at ${outputZipPath}`)
    console.log(`${archive.pointer()} total bytes`)
    
    // Remove the temporary directory
    fse.remove(tempDir, (err) => {
      if (err) {
        console.error(`Error removing temporary directory ${tempDir}:`, err)
      } else {
        console.log(`Temporary directory ${tempDir} removed.`)
      }
    })
  })
  
  archive.on('error', function (err) {
    throw err
  })
  
  // Pipe archive data to the file
  archive.pipe(output)
  
  // Add the contents of the temporary directory to the archive
  archive.directory(tempDir + '/', false)
  
  // Finalize the archive (this is when the archive is actually created)
  await archive.finalize()
})()
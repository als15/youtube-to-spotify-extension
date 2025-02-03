// scripts/post-build.js
import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, '..')

const filesToCopy = [
  ['public/manifest.json', 'dist/manifest.json'],
  ['public/background.js', 'dist/background.js']
  // Add other files as needed
]

// Ensure dist directory exists
const distDir = resolve(rootDir, 'dist')
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true })
}

// Copy files
filesToCopy.forEach(([src, dest]) => {
  const srcPath = resolve(rootDir, src)
  const destPath = resolve(rootDir, dest)

  if (existsSync(srcPath)) {
    copyFileSync(srcPath, destPath)
    console.log(`Copied ${src} to ${dest}`)
  } else {
    console.warn(`Warning: Source file ${src} does not exist`)
  }
})

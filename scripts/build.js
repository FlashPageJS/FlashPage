import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SRC = path.resolve(ROOT, 'src')

async function bundleModule(entryFile, outputFile, isLite = false) {
    const visited = new Set()
    const moduleCodes = []

    async function resolveImports(filePath) {
        const absPath = path.resolve(path.dirname(filePath), filePath)
        if (visited.has(absPath)) return
        visited.add(absPath)

        const content = await fs.readFile(absPath, 'utf8')
        const dir = path.dirname(absPath)

        // Find all local imports: import ... from './...'
        const importRegex = /import\s+[^'"]*?['"](\.[^'"]+)['"]/g
        const matches = Array.from(content.matchAll(importRegex))

        for (const match of matches) {
            const relPath = match[1]
            const fullPath = path.resolve(dir, relPath.endsWith('.js') ? relPath : relPath + '.js')
            await resolveImports(fullPath)
        }

        // Strip imports from file content
        let cleanCode = content.replace(/import\s+[^'"]*?['"](\.[^'"]+)['"];?/g, '')
        // Strip file banners
        cleanCode = cleanCode.replace(/^\/\*![\s\S]*?\*\/\n?/, '')

        // For internal modules, convert 'export function/const' into local declarations
        if (absPath !== path.resolve(entryFile)) {
            cleanCode = cleanCode
                .replace(/^export\s+(default\s+)?(async\s+)?function\s+/gm, '$2function ')
                .replace(/^export\s+(const|let|var)\s+/gm, '$1 ')
                .replace(/^export\s*\{[^}]*\}\s*;?/gm, '')
        }

        moduleCodes.push(cleanCode.trim())
    }

    await resolveImports(entryFile)

    const banner = isLite
        ? '/*! Flash Page Lite v1.0.0 | GPL-3.0-or-later */\n\n'
        : '/*! Flash Page v1.0.0 | GPL-3.0-or-later */\n\n'

    // Combine and deduplicate exports
    let combined = moduleCodes.join('\n\n')

    await fs.writeFile(outputFile, banner + combined + '\n', 'utf8')
    console.log(`📦 Bundled: ${path.relative(ROOT, outputFile)} (${(banner + combined).length} bytes)`)

    // Minify
    const minifiedFile = outputFile.replace(/\.js$/, '.min.js')
    await minifyCode(banner + combined, minifiedFile)
}

async function minifyCode(code, outputPath) {
    const minified = minifyJS(code)
    await fs.writeFile(outputPath, minified, 'utf8')
    console.log(`⚡ Minified: ${path.relative(ROOT, outputPath)} (${minified.length} bytes)`)
}

function minifyJS(code) {
    let banner = ''
    const bannerMatch = code.match(/^\/\*![\s\S]*?\*\/\n?/)
    if (bannerMatch) {
        banner = bannerMatch[0].trim() + '\n'
    }

    const len = code.length
    let i = bannerMatch ? bannerMatch[0].length : 0
    let clean = ''
    let prevNonWsChar = ''

    let state = 'CODE'
    let templateDepth = 0

    while (i < len) {
        const c = code[i]
        const next = i + 1 < len ? code[i + 1] : ''

        if (state === 'CODE') {
            if (c === '\'') {
                state = 'SINGLE_QUOTE'
                clean += c
                i++
            } else if (c === '"') {
                state = 'DOUBLE_QUOTE'
                clean += c
                i++
            } else if (c === '`') {
                state = 'TEMPLATE'
                clean += c
                i++
            } else if (c === '/' && next === '/') {
                state = 'COMMENT_LINE'
                i += 2
            } else if (c === '/' && next === '*') {
                state = 'COMMENT_BLOCK'
                i += 2
            } else if (c === '/' && isRegexStart(prevNonWsChar)) {
                state = 'REGEX'
                clean += c
                i++
            } else {
                clean += c
                if (c !== ' ' && c !== '\t' && c !== '\r' && c !== '\n') {
                    prevNonWsChar = c
                }
                i++
            }
        } else if (state === 'SINGLE_QUOTE') {
            clean += c
            if (c === '\\') {
                clean += next
                i += 2
            } else {
                if (c === '\'') state = 'CODE'
                i++
            }
        } else if (state === 'DOUBLE_QUOTE') {
            clean += c
            if (c === '\\') {
                clean += next
                i += 2
            } else {
                if (c === '"') state = 'CODE'
                i++
            }
        } else if (state === 'TEMPLATE') {
            clean += c
            if (c === '\\') {
                clean += next
                i += 2
            } else if (c === '$' && next === '{') {
                templateDepth++
                clean += next
                i += 2
            } else if (c === '}' && templateDepth > 0) {
                templateDepth--
                i++
            } else if (c === '`' && templateDepth === 0) {
                state = 'CODE'
                i++
            } else {
                i++
            }
        } else if (state === 'REGEX') {
            clean += c
            if (c === '\\') {
                clean += next
                i += 2
            } else if (c === '[') {
                i++
                while (i < len && code[i] !== ']') {
                    if (code[i] === '\\') {
                        clean += code[i] + (code[i + 1] || '')
                        i += 2
                    } else {
                        clean += code[i]
                        i++
                    }
                }
                if (i < len) {
                    clean += code[i]
                    i++
                }
            } else if (c === '/') {
                state = 'CODE'
                i++
            } else {
                i++
            }
        } else if (state === 'COMMENT_LINE') {
            if (c === '\n') {
                state = 'CODE'
                clean += '\n'
            }
            i++
        } else if (state === 'COMMENT_BLOCK') {
            if (c === '*' && next === '/') {
                state = 'CODE'
                i += 2
            } else {
                i++
            }
        }
    }

    // Split clean code into lines
    const lines = clean.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0)

    // Tokenize each line into code vs literals, and apply safe compression
    // When joining lines: if line does not end with { , ( [ ; : && || ? + - =>
    // AND next line does not start with else catch finally . } ) ] , : ;
    // insert a semicolon ; to guarantee ASI is never broken!
    let minifiedLines = []

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const nextLine = i + 1 < lines.length ? lines[i + 1] : ''

        minifiedLines.push(line)

        const lastChar = line.slice(-1)
        const lastTwo = line.slice(-2)

        const isPostfix = lastTwo === '++' || lastTwo === '--'
        const noSemiEnd = !isPostfix && (['{', ',', '(', '[', ';', ':', '?', '+', '-', '*', '/', '=', '>', '<'].includes(lastChar)
            || ['&&', '||', '??', '=>', '?.', '==', '!='].includes(lastTwo))
        const noSemiNextStart = /^(else\b|catch\b|finally\b|\.|\?|\:|\}|\)|\;|\,|\&|\||\+|\-|\*|\/|\])/.test(nextLine)

        if (!noSemiEnd && !noSemiNextStart && nextLine.length > 0) {
            minifiedLines.push(';')
        }
    }

    let joined = minifiedLines.join('')

    // Safe whitespace collapsing around delimiters outside of strings:
    let result = ''
    state = 'CODE'
    templateDepth = 0
    let prevC = ''

    for (let i = 0; i < joined.length; i++) {
        const c = joined[i]
        const next = joined[i + 1] || ''

        if (state === 'CODE') {
            if (c === '\'') {
                state = 'SINGLE_QUOTE'
                result += c
            } else if (c === '"') {
                state = 'DOUBLE_QUOTE'
                result += c
            } else if (c === '`') {
                state = 'TEMPLATE'
                result += c
            } else if (c === '/' && isRegexStart(prevC)) {
                state = 'REGEX'
                result += c
            } else if (c === ' ' || c === '\t') {
                // Keep space ONLY between word characters / identifiers / keywords
                if (/[a-zA-Z0-9_$]/.test(prevC) && /[a-zA-Z0-9_$]/.test(next)) {
                    result += ' '
                }
            } else {
                result += c
                prevC = c
            }
        } else if (state === 'SINGLE_QUOTE') {
            result += c
            if (c === '\\') {
                result += next
                i++
            } else if (c === '\'') {
                state = 'CODE'
                prevC = '\''
            }
        } else if (state === 'DOUBLE_QUOTE') {
            result += c
            if (c === '\\') {
                result += next
                i++
            } else if (c === '"') {
                state = 'CODE'
                prevC = '"'
            }
        } else if (state === 'TEMPLATE') {
            result += c
            if (c === '\\') {
                result += next
                i++
            } else if (c === '$' && next === '{') {
                templateDepth++
                result += next
                i++
            } else if (c === '}' && templateDepth > 0) {
                templateDepth--
            } else if (c === '`' && templateDepth === 0) {
                state = 'CODE'
                prevC = '`'
            }
        } else if (state === 'REGEX') {
            result += c
            if (c === '\\') {
                result += next
                i++
            } else if (c === '[') {
                i++
                while (i < joined.length && joined[i] !== ']') {
                    if (joined[i] === '\\') {
                        result += joined[i] + (joined[i + 1] || '')
                        i += 2
                    } else {
                        result += joined[i]
                        i++
                    }
                }
                if (i < joined.length) {
                    result += joined[i]
                }
            } else if (c === '/') {
                state = 'CODE'
                prevC = '/'
            }
        }
    }

    // Clean duplicate semicolons
    result = result.replace(/;+/g, ';')
    result = result.replace(/;}/g, '}')
    result = result.replace(/{;/g, '{')

    return banner + result.trim() + '\n'
}

function isRegexStart(prevChar) {
    if (!prevChar) return true
    return '([={,:;!&|?~^+-*%<>'.includes(prevChar)
}

async function build() {
    console.log('🚀 Building Flash Page Enterprise Bundles...')
    await bundleModule(path.resolve(SRC, 'index.js'), path.resolve(ROOT, 'flashpage.js'), false)
    await bundleModule(path.resolve(SRC, 'index-lite.js'), path.resolve(ROOT, 'flashpage.lite.js'), true)
    console.log('✅ All Bundles Built Successfully!')
}

build().catch(err => {
    console.error('Build failed:', err)
    process.exit(1)
})

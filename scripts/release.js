import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

function run(command) {
    console.log(`> ${command}`)
    return execSync(command, { cwd: ROOT, stdio: 'inherit' })
}

function calculateNextVersion(currentVersion, bumpType) {
    const parts = currentVersion.split('.').map(Number)
    if (parts.length !== 3 || parts.some(isNaN)) {
        throw new Error(`Invalid current version in package.json: ${currentVersion}`)
    }
    let [major, minor, patch] = parts
    if (bumpType === 'major') {
        major++
        minor = 0
        patch = 0
    } else if (bumpType === 'minor') {
        minor++
        patch = 0
    } else if (bumpType === 'patch') {
        patch++
    } else {
        throw new Error(`Unknown bump type: ${bumpType}`)
    }
    return `${major}.${minor}.${patch}`
}

async function release() {
    const pkgPath = path.resolve(ROOT, 'package.json')
    const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'))
    const currentVersion = pkg.version

    let targetVersion = process.argv[2]
    if (!targetVersion || targetVersion === 'patch') {
        targetVersion = calculateNextVersion(currentVersion, 'patch')
    } else if (targetVersion === 'minor') {
        targetVersion = calculateNextVersion(currentVersion, 'minor')
    } else if (targetVersion === 'major') {
        targetVersion = calculateNextVersion(currentVersion, 'major')
    } else if (targetVersion.startsWith('v')) {
        targetVersion = targetVersion.slice(1)
    }

    if (!/^\d+\.\d+\.\d+$/.test(targetVersion)) {
        throw new Error(`Target version "${targetVersion}" is not a valid Semantic Version (X.Y.Z)`)
    }

    console.log(`\n🚀 Preparing Flash Page Release: v${targetVersion} (current: v${currentVersion})\n`)

    // 1. Update package.json
    pkg.version = targetVersion
    await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8')
    console.log(`✓ Updated package.json version to ${targetVersion}`)

    // 2. Update README.md
    const readmePath = path.resolve(ROOT, 'README.md')
    try {
        let readme = await fs.readFile(readmePath, 'utf8')
        readme = readme.replace(/# Flash Page \(v\d+\.\d+\.\d+\)/g, `# Flash Page (v${targetVersion})`)
        readme = readme.replace(/\| `Flash Page` \(v\d+\.\d+\.\d+\) \|/g, `| \`Flash Page\` (v${targetVersion}) |`)
        readme = readme.replace(/wp_enqueue_script\('flash-page',[^,]+,[^,]+,\s*'[^']+',/g, `wp_enqueue_script('flash-page', get_template_directory_uri() . '/flashpage.min.js', array(), '${targetVersion}',`)
        await fs.writeFile(readmePath, readme, 'utf8')
        console.log(`✓ Updated README.md version references to ${targetVersion}`)
    } catch (err) {
        console.warn('! Warning: Could not update README.md:', err.message)
    }

    // 3. Check Changelog.txt
    const changelogPath = path.resolve(ROOT, 'Changelog.txt')
    try {
        let changelog = await fs.readFile(changelogPath, 'utf8')
        if (!changelog.includes(`Version ${targetVersion}`)) {
            const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
            const entryHeader = `Flash Page Changelog\n====================\n\nVersion ${targetVersion} (${dateStr})\n-----------------------------------\n\nChanged:\n- Maintenance and version release sync.\n\n`
            changelog = changelog.replace(/^Flash Page Changelog\s*\n=+\s*\n+/, entryHeader)
            await fs.writeFile(changelogPath, changelog, 'utf8')
            console.log(`✓ Added Version ${targetVersion} entry to Changelog.txt`)
        } else {
            console.log(`✓ Changelog.txt already contains Version ${targetVersion} entry`)
        }
    } catch (err) {
        console.warn('! Warning: Could not verify Changelog.txt:', err.message)
    }

    // 4. Update WordPress plugin version headers
    const wpPluginPath = path.resolve(ROOT, 'integrations/wordpress/flash-page/flash-page.php')
    try {
        let wpCode = await fs.readFile(wpPluginPath, 'utf8')
        wpCode = wpCode.replace(/define\('FLASH_PAGE_VERSION',\s*'[^']+'\);/, `define('FLASH_PAGE_VERSION', '${targetVersion}');`)
        wpCode = wpCode.replace(/Version:\s*\d+\.\d+\.\d+/g, `Version: ${targetVersion}`)
        await fs.writeFile(wpPluginPath, wpCode, 'utf8')
        console.log(`✓ Updated WordPress plugin version in flash-page.php to ${targetVersion}`)
    } catch (err) {
        console.warn('! Warning: Could not update WordPress plugin version:', err.message)
    }

    const wpReadmePath = path.resolve(ROOT, 'integrations/wordpress/flash-page/readme.txt')
    try {
        let wpReadme = await fs.readFile(wpReadmePath, 'utf8')
        wpReadme = wpReadme.replace(/Stable tag:\s*\d+\.\d+\.\d+/g, `Stable tag: ${targetVersion}`)
        await fs.writeFile(wpReadmePath, wpReadme, 'utf8')
        console.log(`✓ Updated WordPress plugin readme.txt stable tag to ${targetVersion}`)
    } catch (err) {
        console.warn('! Warning: Could not update WordPress readme.txt:', err.message)
    }

    // 5. Rebuild all distribution bundles
    console.log('\n📦 Rebuilding all universal bundles & updating TypeScript definitions...')
    run('node ./scripts/build.js')

    // 6. Run syntax check & tests
    console.log('\n🧪 Running test suite and syntax verification...')
    run('npm run check')
    run('npm test')

    console.log(`\n🎉 Flash Page v${targetVersion} built and tested successfully!`)
    console.log(`📦 WordPress Plugin Bundle: dist/flash-page.zip (Ready for WP Admin upload)`)
    console.log('\nTo commit, tag, and publish via GitHub Actions, run:')
    console.log(`  git add .`)
    console.log(`  git commit -m "chore: release v${targetVersion}"`)
    console.log(`  git tag v${targetVersion}`)
    console.log(`  git push origin main --tags`)
    console.log('\nGitHub Actions will automatically publish flash-page@' + targetVersion + ' to npm with provenance.\n')
}

release().catch(err => {
    console.error('\n❌ Release failed:', err.message)
    process.exit(1)
})

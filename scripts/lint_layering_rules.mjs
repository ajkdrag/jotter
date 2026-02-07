import fs from 'node:fs'
import path from 'node:path'

const project_root = process.cwd()

const source_extensions = new Set(['.ts', '.js', '.mjs', '.cjs', '.svelte'])

const layering_roots = {
  components: path.join(project_root, 'src/lib/components'),
  stores: path.join(project_root, 'src/lib/stores'),
  services: path.join(project_root, 'src/lib/services'),
  reactors: path.join(project_root, 'src/lib/reactors'),
  actions: path.join(project_root, 'src/lib/actions'),
  routes: path.join(project_root, 'src/routes')
}

const internal_roots = {
  ports: path.join(project_root, 'src/lib/ports'),
  adapters: path.join(project_root, 'src/lib/adapters'),
  stores: path.join(project_root, 'src/lib/stores'),
  services: path.join(project_root, 'src/lib/services'),
  reactors: path.join(project_root, 'src/lib/reactors'),
  actions: path.join(project_root, 'src/lib/actions'),
  components: path.join(project_root, 'src/lib/components')
}

const layer_rules = [
  {
    layer: 'components',
    disallow_import_categories: new Set(['ports', 'adapters', 'services', 'reactors']),
    disallow_patterns: [
      {
        regex: /\bxstate\b/g,
        message: 'components must not depend on xstate'
      }
    ]
  },
  {
    layer: 'stores',
    disallow_import_categories: new Set(['ports', 'adapters', 'services', 'reactors', 'actions', 'components']),
    disallow_patterns: [
      {
        regex: /\bawait\b/g,
        message: 'stores must stay synchronous (await found)'
      },
      {
        regex: /\basync\b/g,
        message: 'stores must stay synchronous (async found)'
      }
    ]
  },
  {
    layer: 'services',
    disallow_import_categories: new Set(['adapters', 'components', 'reactors']),
    disallow_patterns: [
      {
        regex: /\$effect\b/g,
        message: 'services must not subscribe to reactive effects; use reactors'
      }
    ]
  },
  {
    layer: 'reactors',
    disallow_import_categories: new Set(['adapters', 'components']),
    disallow_patterns: [
      {
        regex: /\bawait\b/g,
        message: 'reactors should trigger services; avoid inline async control-flow'
      }
    ]
  },
  {
    layer: 'actions',
    disallow_import_categories: new Set(['ports', 'adapters', 'components']),
    disallow_patterns: []
  },
  {
    layer: 'routes',
    disallow_import_categories: new Set(['ports', 'services', 'stores', 'reactors', 'actions']),
    disallow_patterns: [
      {
        regex: /\bsetContext\(/g,
        message: 'routes should use app context helpers, not raw setContext'
      }
    ]
  }
]

function list_source_files(dir_path) {
  const files = []
  if (!fs.existsSync(dir_path)) return files

  for (const entry of fs.readdirSync(dir_path, { withFileTypes: true })) {
    const full_path = path.join(dir_path, entry.name)
    if (entry.isDirectory()) {
      files.push(...list_source_files(full_path))
      continue
    }

    const extension = path.extname(entry.name)
    if (!source_extensions.has(extension)) continue
    files.push(full_path)
  }

  return files
}

function resolve_internal_import(file_path, import_path) {
  if (import_path.startsWith('$lib/')) {
    return path.resolve(project_root, 'src/lib', import_path.slice('$lib/'.length))
  }

  if (import_path.startsWith('./') || import_path.startsWith('../')) {
    return path.resolve(path.dirname(file_path), import_path)
  }

  return null
}

function path_in_dir(candidate, dir_path) {
  return candidate === dir_path || candidate.startsWith(`${dir_path}${path.sep}`)
}

function categorize_import(file_path, import_path) {
  const resolved = resolve_internal_import(file_path, import_path)
  if (!resolved) return null

  for (const [category, root_path] of Object.entries(internal_roots)) {
    if (path_in_dir(resolved, root_path)) return category
  }

  return null
}

function line_number(content, index) {
  return content.slice(0, index).split('\n').length
}

function extract_imports(content) {
  const imports = []

  const from_import_regex = /^\s*import[\s\S]*?\sfrom\s+['"]([^'"]+)['"]/gm
  let from_match = from_import_regex.exec(content)
  while (from_match) {
    imports.push({ module: from_match[1], index: from_match.index })
    from_match = from_import_regex.exec(content)
  }

  const side_effect_import_regex = /^\s*import\s+['"]([^'"]+)['"]/gm
  let side_effect_match = side_effect_import_regex.exec(content)
  while (side_effect_match) {
    imports.push({ module: side_effect_match[1], index: side_effect_match.index })
    side_effect_match = side_effect_import_regex.exec(content)
  }

  return imports
}

function relative_path(file_path) {
  return path.relative(project_root, file_path).split(path.sep).join('/')
}

const violations = []

for (const rule of layer_rules) {
  const files = list_source_files(layering_roots[rule.layer])

  for (const file_path of files) {
    const content = fs.readFileSync(file_path, 'utf8')
    const imports = extract_imports(content)

    for (const current_import of imports) {
      const category = categorize_import(file_path, current_import.module)
      if (category && rule.disallow_import_categories.has(category)) {
        violations.push({
          file: relative_path(file_path),
          line: line_number(content, current_import.index),
          message: `${rule.layer} cannot import ${category} (${current_import.module})`
        })
      }
    }

    for (const pattern of rule.disallow_patterns) {
      let match = pattern.regex.exec(content)
      while (match) {
        violations.push({
          file: relative_path(file_path),
          line: line_number(content, match.index),
          message: `${rule.layer}: ${pattern.message}`
        })
        match = pattern.regex.exec(content)
      }
      pattern.regex.lastIndex = 0
    }
  }
}

if (violations.length > 0) {
  console.error(`Layering rules failed with ${String(violations.length)} violation(s):`)
  for (const violation of violations) {
    console.error(`- ${violation.file}:${String(violation.line)} ${violation.message}`)
  }
  process.exit(1)
}

console.log('Layering rules passed.')

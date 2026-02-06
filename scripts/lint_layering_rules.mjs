import fs from 'node:fs'
import path from 'node:path'

const project_root = process.cwd()

const source_extensions = new Set([
  '.ts',
  '.js',
  '.mjs',
  '.cjs',
  '.svelte'
])

const layering_roots = {
  components: path.join(project_root, 'src/lib/components'),
  controllers: path.join(project_root, 'src/lib/controllers'),
  flows: path.join(project_root, 'src/lib/flows'),
  use_cases: path.join(project_root, 'src/lib/use_cases'),
  stores: path.join(project_root, 'src/lib/stores'),
  shell: path.join(project_root, 'src/lib/shell')
}

const internal_roots = {
  ports: path.join(project_root, 'src/lib/ports'),
  adapters: path.join(project_root, 'src/lib/adapters'),
  use_cases: path.join(project_root, 'src/lib/use_cases'),
  components: path.join(project_root, 'src/lib/components'),
  stores: path.join(project_root, 'src/lib/stores'),
  flows: path.join(project_root, 'src/lib/flows'),
  shell: path.join(project_root, 'src/lib/shell')
}

const layer_rules = [
  {
    layer: 'components',
    disallow_import_categories: new Set(['xstate', 'ports', 'adapters', 'use_cases']),
    disallow_patterns: []
  },
  {
    layer: 'controllers',
    disallow_import_categories: new Set(['ports', 'adapters', 'use_cases']),
    disallow_patterns: []
  },
  {
    layer: 'flows',
    disallow_import_categories: new Set(['adapters', 'components', 'ui_lib']),
    disallow_patterns: [
      {
        regex: /\b(?:context\.)?ports\.[a-zA-Z_]\w*\.[a-zA-Z_]\w*\s*\(/g,
        message: 'flows must not call ports directly; call a use case instead'
      },
      {
        regex: /\bdocument\./g,
        message: 'flows must not touch DOM APIs'
      },
      {
        regex: /\bwindow\./g,
        message: 'flows must not touch window APIs'
      },
      {
        regex: /\btoast\s*\(/g,
        message: 'flows must not call toast APIs directly'
      }
    ]
  },
  {
    layer: 'use_cases',
    disallow_import_categories: new Set(['components', 'adapters', 'flows', 'stores', 'shell', 'ui_lib']),
    disallow_patterns: [
      {
        regex: /\bdocument\./g,
        message: 'use cases must not touch DOM APIs'
      },
      {
        regex: /\bwindow\./g,
        message: 'use cases must not touch window APIs'
      },
      {
        regex: /\btoast\s*\(/g,
        message: 'use cases must not call toast APIs directly'
      }
    ]
  },
  {
    layer: 'stores',
    disallow_import_categories: new Set(['ports', 'adapters', 'use_cases', 'flows', 'components', 'shell']),
    disallow_patterns: [
      {
        regex: /\bawait\b/g,
        message: 'stores must not use async work (await found)'
      },
      {
        regex: /\basync\b/g,
        message: 'stores must not use async work (async found)'
      }
    ]
  },
  {
    layer: 'shell',
    disallow_import_categories: new Set(['stores', 'use_cases']),
    disallow_patterns: []
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
  if (import_path === 'xstate' || import_path.startsWith('xstate/')) {
    return 'xstate'
  }
  if (import_path === 'svelte-sonner' || import_path.startsWith('svelte-sonner/')) {
    return 'ui_lib'
  }

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
    imports.push({
      module: from_match[1],
      index: from_match.index,
      statement: from_match[0]
    })
    from_match = from_import_regex.exec(content)
  }

  const side_effect_import_regex = /^\s*import\s+['"]([^'"]+)['"]/gm
  let side_effect_match = side_effect_import_regex.exec(content)
  while (side_effect_match) {
    imports.push({
      module: side_effect_match[1],
      index: side_effect_match.index,
      statement: side_effect_match[0]
    })
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

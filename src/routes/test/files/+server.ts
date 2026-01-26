import { readdirSync } from 'fs'
import { resolve } from 'path'
import { error } from '@sveltejs/kit'

export async function GET() {
  try {
    const test_files_dir = resolve(process.cwd(), 'test', 'files')
    const files = readdirSync(test_files_dir)
      .filter(file => file.endsWith('.md'))
      .sort()
    
    return new Response(JSON.stringify(files), {
      headers: {
        'Content-Type': 'application/json'
      }
    })
  } catch {
    throw error(500, 'Failed to list test files')
  }
}

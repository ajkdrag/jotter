import { readdirSync } from 'fs'
import { join, resolve } from 'path'
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
  } catch (e) {
    throw error(500, 'Failed to list test files')
  }
}

import { readFileSync } from 'fs'
import { join, resolve } from 'path'
import { error } from '@sveltejs/kit'

export async function GET({ params }: { params: { path: string } }) {
  try {
    const test_files_dir = resolve(process.cwd(), 'test', 'files')
    const requested_path = join(test_files_dir, params.path)
    const resolved_path = resolve(requested_path)
    
    if (!resolved_path.startsWith(test_files_dir)) {
      throw error(403, 'Access denied')
    }
    
    const content = readFileSync(resolved_path, 'utf-8')
    return new Response(content, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8'
      }
    })
  } catch (e) {
    if (e && typeof e === 'object' && 'status' in e) {
      throw e
    }
    throw error(404, 'File not found')
  }
}

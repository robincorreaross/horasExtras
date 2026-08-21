import { exec } from 'child_process';
import path from 'path';
import { NextResponse } from 'next/server';

// POST /api/contas/run-script - Executar scripts Python locais via WebApp
export async function POST(request) {
  try {
    const body = await request.json();
    const scriptType = body.script; // 'contas_lojas' ou 'conta_pdf_download'

    if (!scriptType || (scriptType !== 'contas_lojas' && scriptType !== 'conta_pdf_download')) {
      return NextResponse.json({ success: false, error: 'Tipo de script inválido' }, { status: 400 });
    }

    const scriptFile = scriptType === 'contas_lojas' ? 'contas_lojas.py' : 'conta-pdf-download.py';
    const scriptPath = path.resolve('scripts_py', scriptFile);

    const env = { ...process.env, AUTO_CONFIRM: 'true', PYTHONIOENCODING: 'utf-8' };


    return new Promise((resolve) => {
      exec(`python "${scriptPath}" --auto`, { env, cwd: process.cwd() }, (error, stdout, stderr) => {
        if (error) {
          console.error(`Erro ao executar script ${scriptFile}:`, error);
          resolve(
            NextResponse.json({
              success: false,
              error: `Erro ao executar ${scriptFile}: ${error.message}`,
              output: (stdout || '') + '\n' + (stderr || ''),
            }, { status: 500 })
          );
        } else {
          resolve(
            NextResponse.json({
              success: true,
              script: scriptFile,
              output: stdout,
            })
          );
        }
      });
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import sql from '@/lib/db';
import { NextResponse } from 'next/server';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas.');
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

const DIRS_CONTAS = [
  `D:\\work-Ross\\Administrativo\\Docs Colaboradores\\enviarExtrato\\extrato_contas`,
  `D:\\work-projetos_ross\\scripts_diversos\\download-contas\\downloads_clientes`,
  `D:\\work-Ross\\Administrativo\\Docs Colaboradores\\enviarExtrato`
];

const DIRS_HOLERITES = [
  `D:\\work-Ross\\Administrativo\\Docs Colaboradores\\enviarExtrato\\holerites`,
  `D:\\work-Ross\\Administrativo\\Docs Colaboradores\\holerites`
];

/**
 * Tenta encontrar o colaborador correspondente ao nome do arquivo PDF.
 * Suporta formatos: "ID_Nome.pdf" (ex: 2957_Raissa.pdf), "ID-Nome.pdf", "ID.pdf" ou "Nome.pdf"
 */
function findMatchingEmployee(pdfNameClean, employees) {
  const targetName = pdfNameClean.toLowerCase().trim();

  // 1. Tentar extrair ID numérico do início ou do fim do nome do arquivo (ex: "2957_Raissa", "26-Maria", "2957")
  const idMatch = targetName.match(/^(\d+)(?:[_\s-]|$)|(?:[_\s-]|^)(\d+)$/);
  if (idMatch) {
    const extractedId = idMatch[1] || idMatch[2];
    const matchById = employees.find(e => String(e.id_loja) === String(extractedId));
    if (matchById) {
      return matchById; // Match 100% garantido pelo ID da loja!
    }
  }

  // 2. Match por nome completo exato
  let match = employees.find(e => e.nome && e.nome.toLowerCase().trim() === targetName);
  if (match) return match;

  // 3. Se houver texto além de dígitos, limpa os números para tentar pelo nome
  const cleanWithoutDigits = targetName.replace(/^\d+[_\s-]*/, '').replace(/[_\s-]*\d+$/, '').trim();

  if (cleanWithoutDigits) {
    // 4. Match pelo primeiro nome
    match = employees.find(e => {
      if (!e.nome) return false;
      const primeiroNome = e.nome.trim().split(' ')[0].toLowerCase();
      return primeiroNome === cleanWithoutDigits;
    });
    if (match) return match;

    // 5. Match por inclusão de nome
    match = employees.find(e => {
      if (!e.nome) return false;
      const eNome = e.nome.toLowerCase().trim();
      return eNome.includes(cleanWithoutDigits) || cleanWithoutDigits.includes(eNome.split(' ')[0]);
    });
    if (match) return match;
  }

  return null;
}

// POST /api/contas/sync-local - Lê os PDFs locais e envia para o Supabase Storage
export async function POST(request) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json().catch(() => ({}));
    const tipoSync = body.tipo || 'todos'; // 'contas', 'holerites', 'todos'

    // 1. Buscar todos os colaboradores para fazer a correlação de IDs e nomes
    const employees = await sql`
      SELECT id, id_loja, nome, loja
      FROM colaboradores
    `;

    const logs = [];
    let contasSuccess = 0;
    let holeritesSuccess = 0;
    const processedContas = new Set();
    const processedHolerites = new Set();

    // --- 1. PROCESSAR EXTRATOS DE CONTAS ---
    if (tipoSync === 'contas' || tipoSync === 'todos') {
      for (const dirPath of DIRS_CONTAS) {
        if (!fs.existsSync(dirPath)) continue;
        const files = fs.readdirSync(dirPath).filter(f => f.toLowerCase().endsWith('.pdf'));
        if (files.length === 0) continue;

        logs.push(`📁 Lendo ${files.length} PDF(s) em: ${dirPath}`);

        for (const file of files) {
          const pdfNameClean = path.parse(file).name;
          const matchedEmp = findMatchingEmployee(pdfNameClean, employees);

          if (!matchedEmp || processedContas.has(matchedEmp.id)) {
            continue;
          }

          try {
            const filePath = path.join(dirPath, file);
            const buffer = fs.readFileSync(filePath);
            const refCode = matchedEmp.id_loja || matchedEmp.nome.trim().split(' ')[0];
            const filenameInBucket = `${matchedEmp.nome.trim().split(' ')[0]}_${refCode}.pdf`;

            const { error: uploadError } = await supabase.storage
              .from('conta-pdf')
              .upload(filenameInBucket, buffer, {
                contentType: 'application/pdf',
                upsert: true,
              });

            if (uploadError) {
              logs.push(`❌ ${file} (${matchedEmp.nome}): Erro no Supabase - ${uploadError.message}`);
              continue;
            }

            const { data: publicUrlData } = supabase.storage
              .from('conta-pdf')
              .getPublicUrl(filenameInBucket);

            const publicUrl = publicUrlData?.publicUrl;

            await sql`
              UPDATE colaboradores
              SET "contaPDF" = ${publicUrl}
              WHERE id = ${matchedEmp.id}
            `;

            processedContas.add(matchedEmp.id);
            contasSuccess++;
            logs.push(`✅ Extrato de ${matchedEmp.nome} atualizado!`);
          } catch (fileErr) {
            logs.push(`❌ Erro ao processar arquivo ${file}: ${fileErr.message}`);
          }
        }
      }
    }

    // --- 2. PROCESSAR HOLERITES ---
    if (tipoSync === 'holerites' || tipoSync === 'todos') {
      for (const dirPath of DIRS_HOLERITES) {
        if (!fs.existsSync(dirPath)) continue;
        const files = fs.readdirSync(dirPath).filter(f => f.toLowerCase().endsWith('.pdf'));
        if (files.length === 0) continue;

        logs.push(`📁 Lendo ${files.length} PDF(s) em: ${dirPath}`);

        for (const file of files) {
          const pdfNameClean = path.parse(file).name;
          const matchedEmp = findMatchingEmployee(pdfNameClean, employees);

          if (!matchedEmp || processedHolerites.has(matchedEmp.id)) {
            continue;
          }

          try {
            const filePath = path.join(dirPath, file);
            const buffer = fs.readFileSync(filePath);
            const refCode = matchedEmp.id_loja || matchedEmp.nome.trim().split(' ')[0];
            const filenameInBucket = `Holerite_${matchedEmp.nome.trim().split(' ')[0]}_${refCode}.pdf`;

            const { error: uploadError } = await supabase.storage
              .from('holerites')
              .upload(filenameInBucket, buffer, {
                contentType: 'application/pdf',
                upsert: true,
              });

            if (uploadError) {
              logs.push(`❌ Holerite ${file} (${matchedEmp.nome}): Erro no Supabase - ${uploadError.message}`);
              continue;
            }

            const { data: publicUrlData } = supabase.storage
              .from('holerites')
              .getPublicUrl(filenameInBucket);

            const publicUrl = publicUrlData?.publicUrl;

            await sql`
              UPDATE colaboradores
              SET "holeritePDF" = ${publicUrl}
              WHERE id = ${matchedEmp.id}
            `;

            processedHolerites.add(matchedEmp.id);
            holeritesSuccess++;
            logs.push(`✅ Holerite de ${matchedEmp.nome} atualizado!`);
          } catch (fileErr) {
            logs.push(`❌ Erro ao processar holerite ${file}: ${fileErr.message}`);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      contasSuccess,
      holeritesSuccess,
      logs,
    });
  } catch (err) {
    console.error('Erro na rota sync-local:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

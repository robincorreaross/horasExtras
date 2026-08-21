import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import sql from '@/lib/db';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

const DIR_CONTAS = `D:\\work-Ross\\Administrativo\\Docs Colaboradores\\enviarExtrato\\extrato_contas`;
const DIR_HOLERITES = `D:\\work-Ross\\Administrativo\\Docs Colaboradores\\enviarExtrato\\holerites`;

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

export async function POST(request) {
  try {
    const body = await request.json();
    const tipoSync = body.tipo || 'todos'; // 'contas', 'holerites', 'todos'

    // Buscar todos os colaboradores da tabela unificada
    const employees = await sql`SELECT id, id_loja, nome FROM colaboradores`;

    const logs = [];
    let contasSuccess = 0;
    let holeritesSuccess = 0;

    // --- 1. PROCESSAR EXTRATOS DE CONTAS ---
    if (tipoSync === 'contas' || tipoSync === 'todos') {
      if (fs.existsSync(DIR_CONTAS)) {
        const files = fs.readdirSync(DIR_CONTAS).filter(f => f.toLowerCase().endsWith('.pdf'));
        logs.push(`📁 Encontrados ${files.length} PDF(s) na pasta de Extratos de Contas.`);

        for (const file of files) {
          const filePath = path.join(DIR_CONTAS, file);
          const pdfNameClean = path.parse(file).name;
          const matchedEmp = findMatchingEmployee(pdfNameClean, employees);

          if (!matchedEmp) {
            logs.push(`⚠️ ${file}: Nenhum colaborador correspondente encontrado no banco.`);
            continue;
          }

          try {
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

            contasSuccess++;
            logs.push(`✅ Extrato de ${matchedEmp.nome} atualizado!`);
          } catch (fileErr) {
            logs.push(`❌ Erro ao processar arquivo ${file}: ${fileErr.message}`);
          }
        }
      } else {
        logs.push(`⚠️ Pasta de contas não encontrada: ${DIR_CONTAS}`);
      }
    }

    // --- 2. PROCESSAR HOLERITES ---
    if (tipoSync === 'holerites' || tipoSync === 'todos') {
      if (fs.existsSync(DIR_HOLERITES)) {
        const files = fs.readdirSync(DIR_HOLERITES).filter(f => f.toLowerCase().endsWith('.pdf'));
        logs.push(`📁 Encontrados ${files.length} PDF(s) na pasta de Holerites.`);

        for (const file of files) {
          const filePath = path.join(DIR_HOLERITES, file);
          const pdfNameClean = path.parse(file).name;
          const matchedEmp = findMatchingEmployee(pdfNameClean, employees);

          if (!matchedEmp) {
            logs.push(`⚠️ ${file}: Nenhum colaborador correspondente encontrado no banco.`);
            continue;
          }

          try {
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

            holeritesSuccess++;
            logs.push(`✅ Holerite de ${matchedEmp.nome} atualizado!`);
          } catch (fileErr) {
            logs.push(`❌ Erro ao processar holerite ${file}: ${fileErr.message}`);
          }
        }
      } else {
        logs.push(`⚠️ Pasta de holerites não encontrada: ${DIR_HOLERITES}`);
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

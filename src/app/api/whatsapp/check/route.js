import { checkConnection } from '@/lib/evolution';
import { NextResponse } from 'next/server';

// GET /api/whatsapp/check - Verificar se instância está conectada
export async function GET() {
  const result = await checkConnection();
  return NextResponse.json(result);
}

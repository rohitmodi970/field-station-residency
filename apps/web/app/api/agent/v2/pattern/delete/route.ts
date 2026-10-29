import { NextRequest } from 'next/server';
import { POST as basePOST } from '../route';

export async function POST(req: NextRequest) {
  return basePOST(req);
}

export async function DELETE(req: NextRequest) {
  return basePOST(req);
}

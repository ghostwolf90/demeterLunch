import release from '../../../.openai/release.json' with { type: 'json' };

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(release, {
    headers: { 'cache-control': 'no-store, max-age=0' },
  });
}

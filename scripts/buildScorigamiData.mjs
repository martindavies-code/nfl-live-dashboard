import fs from 'node:fs';

async function main() {
  console.log('Fetching scorigamicenter.com data...');
  const res = await fetch('https://scorigamicenter.com/data/nfl.json');
  const data = await res.json();

  const table = {};
  for (const [k, ds] of Object.entries(data.datasets)) {
    if (ds && ds.cells) {
      for (const [score, cell] of Object.entries(ds.cells)) {
        if (!table[score]) {
          table[score] = [0, 0];
        }
        table[score][0] += (cell.n || 0);
        if (cell.l && cell.l[1] > table[score][1]) {
          table[score][1] = cell.l[1];
        }
      }
    }
  }

  const keys = Object.keys(table).sort((a, b) => {
    const [h1, l1] = a.split('-').map(Number);
    const [h2, l2] = b.split('-').map(Number);
    return h1 - h2 || l1 - l2;
  });

  const sortedTable = {};
  for (const k of keys) {
    sortedTable[k] = table[k];
  }

  const fileContent = `// Canonical NFL Scorigami Occurred Database (1920-present, verified through scorigamicenter.com)
// Format: Record<string, [count: number, lastYear: number]>
export const HISTORICAL_OCCURRED: Record<string, [number, number]> = ${JSON.stringify(sortedTable, null, 2)};

export const TOTAL_UNIQUE_SCORIGAMIS = ${keys.length};
`;

  fs.writeFileSync('src/utils/scorigamiHistoricalData.ts', fileContent, 'utf8');
  console.log(`Successfully generated src/utils/scorigamiHistoricalData.ts with ${keys.length} scores!`);
}

main().catch(err => {
  console.error('Error generating scorigami data:', err);
  process.exit(1);
});

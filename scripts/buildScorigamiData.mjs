import fs from 'node:fs';

async function main() {
  console.log('Fetching scorigamicenter.com data...');
  const res = await fetch('https://scorigamicenter.com/data/nfl.json');
  const data = await res.json();

  const table = {};
  for (const [, ds] of Object.entries(data.datasets)) {
    if (ds && ds.cells) {
      for (const [score, cell] of Object.entries(ds.cells)) {
        if (!table[score]) {
          table[score] = {
            count: 0,
            lastDate: '',
            lastYear: 0,
            lastWinner: '',
            lastLoser: ''
          };
        }
        table[score].count += (cell.n || 0);
        // cell.l format: [ dateString: "YYYY-MM-DD", year: number, winner: string, loser: string ]
        if (cell.l && cell.l[0] && cell.l[0] > table[score].lastDate) {
          table[score].lastDate = cell.l[0];
          table[score].lastYear = cell.l[1] || parseInt(cell.l[0].slice(0, 4), 10);
          table[score].lastWinner = cell.l[2] || '';
          table[score].lastLoser = cell.l[3] || '';
        }
      }
    }
  }

  const keys = Object.keys(table).sort((a, b) => {
    const [h1, l1] = a.split('-').map(Number);
    const [h2, l2] = b.split('-').map(Number);
    return h1 - h2 || l1 - l2;
  });

  // Convert to tuple: [count, lastYear, lastDate, lastWinner, lastLoser]
  const tupleTable = {};
  for (const k of keys) {
    const entry = table[k];
    tupleTable[k] = [
      entry.count,
      entry.lastYear,
      entry.lastDate,
      entry.lastWinner,
      entry.lastLoser
    ];
  }

  const fileContent = `// Canonical NFL Scorigami Occurred Database (1920-present, verified through scorigamicenter.com)
// Format: Record<string, [count: number, lastYear: number, lastDate: string, lastWinner: string, lastLoser: string]>
export type HistoricalScoreRecord = [
  count: number,
  lastYear: number,
  lastDate: string,
  lastWinner: string,
  lastLoser: string
];

export const HISTORICAL_OCCURRED: Record<string, HistoricalScoreRecord> = ${JSON.stringify(tupleTable, null, 2)};

export const TOTAL_UNIQUE_SCORIGAMIS = ${keys.length};
`;

  fs.writeFileSync('src/utils/scorigamiHistoricalData.ts', fileContent, 'utf8');
  console.log(`Successfully generated src/utils/scorigamiHistoricalData.ts with ${keys.length} scores including exact date and game matchups!`);
}

main().catch(err => {
  console.error('Error generating scorigami data:', err);
  process.exit(1);
});
